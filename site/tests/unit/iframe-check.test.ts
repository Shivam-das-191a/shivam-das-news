import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkIframes } from '../../scripts/iframe-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<iframe src="https://www.youtube-nocookie.com/embed/abc" title="Video: city council vote" loading="lazy" width="560" height="315" sandbox="allow-scripts allow-same-origin"></iframe>';

describe('checkIframes: good frames', () => {
  it('a named, lazy, sized, sandboxed https frame passes with no message', () => { expect(checkIframes(GOOD)).toEqual(none); });
  it('a page with no frame passes', () => { expect(checkIframes('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkIframes(v as any).errors).toEqual(['the page is not text']);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkIframes("<IFRAME SRC='https://a.org/x' TITLE='Map of the area' LOADING=lazy WIDTH=5 HEIGHT=5 SANDBOX></IFRAME>")).toEqual(none);
  });
  it('aria-label is a name', () => {
    expect(checkIframes('<iframe src="/a/" aria-label="Chart of results" loading="lazy" width="5" height="5"></iframe>')).toEqual(none);
  });
  it('aria-labelledby is a name', () => {
    expect(checkIframes('<h2 id="t">Chart</h2><iframe src="/a/" aria-labelledby="t" loading="lazy" width="5" height="5"></iframe>')).toEqual(none);
  });
  it('a frame from our own site needs no sandbox', () => {
    expect(checkIframes('<iframe src="https://news.example.org/embed/" title="Calculator" loading="lazy" width="5" height="5"></iframe>', ['news.example.org'])).toEqual(none);
  });
  it('a relative address needs no sandbox', () => {
    expect(checkIframes('<iframe src="/embed/" title="Calculator" loading="lazy" width="5" height="5"></iframe>')).toEqual(none);
  });
  it('an aspect-ratio in the style takes the place of width and height', () => {
    expect(checkIframes('<iframe src="/e/" title="Calculator" loading="lazy" style="aspect-ratio:16/9;width:100%"></iframe>')).toEqual(none);
  });
  it('a srcdoc frame with no src is not "empty"', () => {
    expect(checkIframes('<iframe srcdoc="<p>x</p>" title="Note" loading="lazy" width="5" height="5"></iframe>')).toEqual(none);
  });
});

describe('checkIframes: the name', () => {
  it('no title is an error that names the address', () => {
    const r = checkIframes('<iframe src="https://a.org/x" loading="lazy" width="5" height="5" sandbox></iframe>');
    expect(r.errors).toEqual(['an iframe (https://a.org/x) has no name; add a title that says what is inside']);
  });
  it('an empty title and a blank title are errors', () => {
    expect(checkIframes('<iframe src="/a/" title=""></iframe>').errors).toHaveLength(1);
    expect(checkIframes('<iframe src="/a/" title="   "></iframe>').errors).toHaveLength(1);
  });
  it('an empty aria-label does not count', () => { expect(checkIframes('<iframe src="/a/" aria-label=""></iframe>').errors).toHaveLength(1); });
  it('no address and no title says (no address)', () => { expect(checkIframes('<iframe srcdoc="x"></iframe>').errors.join()).toMatch(/\(no address\)/); });
  it('a vague title is a warning, not an error', () => {
    const r = checkIframes('<iframe src="/a/" title="iframe" loading="lazy" width="5" height="5"></iframe>');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/is named "iframe"/);
  });
  it('a vague title is found with different case and a full stop', () => {
    expect(checkIframes('<iframe src="/a/" title="Video." loading="lazy" width="5" height="5"></iframe>').warnings.join()).toMatch(/named "Video\."/);
    expect(checkIframes('<iframe src="/a/" title="EMBED" loading="lazy" width="5" height="5"></iframe>').warnings).toHaveLength(1);
  });
  it('a long real title is not vague', () => {
    expect(checkIframes('<iframe src="/a/" title="Video of the video game panel" loading="lazy" width="5" height="5"></iframe>')).toEqual(none);
  });
  it('a long address is cut in the message', () => {
    const r = checkIframes('<iframe src="https://a.org/' + 'x'.repeat(200) + '"></iframe>');
    expect(r.errors[0].length).toBeLessThan(150);
    expect(r.errors[0]).toMatch(/\.\.\./);
  });
});

describe('checkIframes: the address', () => {
  it('http:// is an error', () => {
    expect(checkIframes('<iframe src="http://a.org/x" title="Map of the area"></iframe>').errors).toEqual(['an iframe loads http://a.org/x over http://; use https://']);
  });
  it('HTTP:// in capitals is an error', () => { expect(checkIframes('<iframe src="HTTP://a.org/x" title="Map of the area"></iframe>').errors).toHaveLength(1); });
  it('javascript: data: and vbscript: are errors', () => {
    for (const s of ['javascript:alert(1)', 'data:text/html,<p>x</p>', 'vbscript:x', 'JavaScript:void(0)'])
      expect(checkIframes(`<iframe src='${s}' title="Map of the area"></iframe>`).errors, s).toHaveLength(1);
  });
  it('a scheme-less address is a warning', () => {
    const r = checkIframes('<iframe src="//a.org/x" title="Map of the area" loading="lazy" width="5" height="5"></iframe>');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/has no scheme/);
  });
  it('about:blank and about:srcdoc are fine', () => {
    for (const s of ['about:blank', 'about:srcdoc'])
      expect(checkIframes(`<iframe src="${s}" title="Map of the area" loading="lazy" width="5" height="5"></iframe>`), s).toEqual(none);
  });
  it('no src and no srcdoc is a warning', () => {
    expect(checkIframes('<iframe title="Map of the area" loading="lazy" width="5" height="5"></iframe>').warnings).toEqual(['an iframe has no src and no srcdoc, so it shows nothing']);
  });
});

describe('checkIframes: loading, size and sandbox', () => {
  it('no loading="lazy" is a warning', () => {
    expect(checkIframes('<iframe src="/a/" title="Map of the area" width="5" height="5"></iframe>').warnings.join()).toMatch(/no loading="lazy"/);
  });
  it('loading="eager" is a warning', () => {
    expect(checkIframes('<iframe src="/a/" title="Map of the area" loading="eager" width="5" height="5"></iframe>').warnings).toHaveLength(1);
  });
  it('width only (no height) is a warning', () => {
    expect(checkIframes('<iframe src="/a/" title="Map of the area" loading="lazy" width="5"></iframe>').warnings.join()).toMatch(/no width and height/);
  });
  it('a frame from another website with no sandbox is a warning that names the host', () => {
    const r = checkIframes('<iframe src="https://maps.example.net/x" title="Map of the area" loading="lazy" width="5" height="5"></iframe>', ['news.example.org']);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the iframe from maps.example.net has no sandbox attribute']);
  });
  it('the own host list is not case sensitive', () => {
    expect(checkIframes('<iframe src="https://News.Example.org/x" title="Map of the area" loading="lazy" width="5" height="5"></iframe>', ['NEWS.example.org'])).toEqual(none);
  });
  it('a frame with sandbox is not warned', () => {
    expect(checkIframes('<iframe src="https://x.org/e" title="Map of the area" loading="lazy" width="5" height="5" sandbox="allow-scripts"></iframe>')).toEqual(none);
  });
  it('the same message is not printed twice', () => {
    const f = '<iframe src="/a/" title="Map of the area" width="5" height="5"></iframe>';
    expect(checkIframes(f + f).warnings).toHaveLength(1);
  });
  it('two bad frames give two errors', () => {
    expect(checkIframes('<iframe src="/a/"></iframe><iframe src="/b/"></iframe>').errors).toHaveLength(2);
  });
});

describe('checkIframes: what is left out', () => {
  it('a hidden frame is not read', () => {
    for (const t of ['hidden', 'aria-hidden="true"', 'role="presentation"', 'role="none"'])
      expect(checkIframes(`<iframe src="http://a.org/pixel" ${t}></iframe>`), t).toEqual(none);
  });
  it('aria-hidden="false" is still read', () => { expect(checkIframes('<iframe src="/a/" aria-hidden="false"></iframe>').errors).toHaveLength(1); });
  it('amp-iframe is another tag and is not read', () => { expect(checkIframes('<amp-iframe src="http://a.org/x"></amp-iframe>')).toEqual(none); });
  it('frames inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<iframe src="http://a.org"></iframe>\';</script><template><iframe src="/a/"></iframe></template><!-- <iframe src="/b/"></iframe> -->';
    expect(checkIframes(extra + GOOD)).toEqual(none);
  });
  it('a word that only starts with iframe is not a frame', () => { expect(checkIframes('<iframes src="http://a.org/x"></iframes>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkIframes('<main>' + '<p class="x">y</p>'.repeat(40000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('no template of the site writes an iframe by hand (frames come from posts and are checked at build)', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(/<iframe[\s>]/i.test(base)).toBe(false);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'iframe-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good frame passes', () => { expect(run(FULL(GOOD)).code).toBe(0); });
  it('a frame with no title stops the build and names the page', () => {
    const r = run(FULL('<iframe src="https://a.org/x" loading="lazy" width="5" height="5" sandbox></iframe>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an iframe \(https:\/\/a\.org\/x\) has no name/);
  });
  it('a frame on http:// stops the build', () => {
    const r = run(FULL('<iframe src="http://a.org/x" title="Map of the area" loading="lazy" width="5" height="5" sandbox></iframe>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/over http:\/\//);
  });
  it('a frame with no lazy loading is a warning, not an error', () => {
    const r = run(FULL('<iframe src="/e/" title="Map of the area" width="5" height="5"></iframe>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*loading="lazy"/);
  });
  it('a frame from our own site (SITE_URL) needs no sandbox', () => {
    const r = run(FULL('<iframe src="https://news.example.org/e/" title="Map of the area" loading="lazy" width="5" height="5"></iframe>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/sandbox/);
  });
});
