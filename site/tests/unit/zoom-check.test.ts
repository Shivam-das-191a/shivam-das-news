import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkZoomHtml, checkZoomCss } from '../../scripts/zoom-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (content: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="${content}"></head><body><main id="main"><h1>T</h1></main></body></html>`;
const html = (content: string) => checkZoomHtml(page(content));

describe('checkZoomHtml: good pages', () => {
  it('the usual viewport passes with no message', () => {
    expect(html('width=device-width, initial-scale=1')).toEqual(none);
    expect(html('width=device-width, initial-scale=1, viewport-fit=cover')).toEqual(none);
  });
  it('user-scalable=yes passes', () => { expect(html('width=device-width, initial-scale=1, user-scalable=yes')).toEqual(none); });
  it('a maximum-scale of 5 or more passes', () => {
    expect(html('width=device-width, initial-scale=1, maximum-scale=5')).toEqual(none);
    expect(html('width=device-width, initial-scale=1, maximum-scale=10')).toEqual(none);
  });
  it('a page with no viewport is not reported here (page-basics does it)', () => {
    expect(checkZoomHtml('<html lang="en"><head></head><body></body></html>')).toEqual(none);
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkZoomHtml(v as any).errors).toEqual(['the page is not text']);
  });
});

describe('checkZoomHtml: user-scalable', () => {
  for (const v of ['no', '0', 'false', 'NO']) {
    it(`user-scalable=${v} is an error`, () => {
      expect(html(`width=device-width, initial-scale=1, user-scalable=${v}`).errors.join()).toMatch(/user-scalable=no/);
    });
  }
  it('spaces around the equal sign are read', () => {
    expect(html('width=device-width, user-scalable = no').errors).toHaveLength(1);
  });
  it('a semicolon between the parts is read', () => {
    expect(html('width=device-width; user-scalable=no').errors).toHaveLength(1);
  });
});

describe('checkZoomHtml: maximum-scale', () => {
  it('under 2 is an error', () => {
    expect(html('width=device-width, maximum-scale=1').errors.join()).toMatch(/maximum-scale=1;/);
    expect(html('width=device-width, maximum-scale=1.5').errors).toHaveLength(1);
    expect(html('width=device-width, maximum-scale=0.5').errors).toHaveLength(1);
  });
  it('exactly 2 passes as an error check and gives the Lighthouse warning', () => {
    const r = html('width=device-width, maximum-scale=2');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/Lighthouse/);
  });
  it('between 2 and 5 is a warning only', () => {
    const r = html('width=device-width, maximum-scale=3.5');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it('a value that is not a number is not read', () => { expect(html('width=device-width, maximum-scale=abc')).toEqual(none); });
  it('both problems give both errors', () => {
    expect(html('width=device-width, user-scalable=no, maximum-scale=1').errors).toHaveLength(2);
  });
  it('minimum-scale is not read', () => { expect(html('width=device-width, minimum-scale=1')).toEqual(none); });
});

describe('checkZoomHtml: what is left out', () => {
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkZoomHtml("<META NAME='viewport' CONTENT='width=device-width, user-scalable=no'>").errors).toHaveLength(1);
    expect(checkZoomHtml('<meta name=viewport content="user-scalable=no">').errors).toHaveLength(1);
  });
  it('another meta tag is not a viewport', () => {
    expect(checkZoomHtml('<meta name="description" content="user-scalable=no">')).toEqual(none);
  });
  it('tags inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<meta name="viewport" content="user-scalable=no">\';</script><template><meta name="viewport" content="user-scalable=no"></template><!-- <meta name="viewport" content="user-scalable=no"> -->';
    expect(checkZoomHtml(extra + page('width=device-width, initial-scale=1'))).toEqual(none);
  });
});

describe('checkZoomCss', () => {
  it('a normal style passes with no message', () => {
    expect(checkZoomCss('body{margin:0;touch-action:manipulation}html{-webkit-text-size-adjust:100%;text-size-adjust:100%}.a{touch-action:none}')).toEqual(none);
  });
  it('an empty or non-text style is no error and no crash', () => {
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(checkZoomCss(v as any)).toEqual(none);
  });
  for (const sel of ['html', 'body', ':root', 'main', '*']) {
    it(`touch-action none on ${sel} is an error`, () => {
      expect(checkZoomCss(`${sel}{touch-action:none}`).errors.join()).toMatch(new RegExp('turns off pinch zoom'));
    });
  }
  it('pan-x and pan-y without pinch-zoom is an error', () => {
    expect(checkZoomCss('body{touch-action:pan-x pan-y}').errors).toHaveLength(1);
    expect(checkZoomCss('body{touch-action:pan-y}').errors).toHaveLength(1);
  });
  it('pan with pinch-zoom, manipulation and auto are fine', () => {
    for (const v of ['pan-x pan-y pinch-zoom', 'manipulation', 'auto', 'pinch-zoom'])
      expect(checkZoomCss(`body{touch-action:${v}}`).errors).toEqual([]);
  });
  it('touch-action none on a small part is fine', () => {
    expect(checkZoomCss('.slider{touch-action:none}#map{touch-action:none}body .x{touch-action:none}')).toEqual(none);
  });
  it('a list of selectors with a global one is read', () => {
    expect(checkZoomCss('.a, body , .b{touch-action:none}').errors).toHaveLength(1);
  });
  it('a rule inside a media query is read', () => {
    expect(checkZoomCss('@media (max-width:600px){body{touch-action:none}}').errors).toHaveLength(1);
  });
  it('a comment does not count', () => { expect(checkZoomCss('/* body{touch-action:none} */a{color:red}')).toEqual(none); });
  it('text-size-adjust none on html warns, 100% does not', () => {
    expect(checkZoomCss('html{-webkit-text-size-adjust:none}').warnings.join()).toMatch(/text-size-adjust to none/);
    expect(checkZoomCss('html{text-size-adjust:none}').warnings).toHaveLength(1);
    expect(checkZoomCss('html{text-size-adjust:100%}').warnings).toEqual([]);
  });
  it('the same message is never printed twice', () => {
    expect(checkZoomCss('body{touch-action:none}body{touch-action:none}').errors).toHaveLength(1);
  });
});

describe('the real site', () => {
  it('the template viewport and the style pass with no message', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    const tag = (base.match(/<meta name="viewport"[^>]*>/) || [''])[0];
    expect(tag).toMatch(/width=device-width/);
    expect(checkZoomHtml(`<html><head>${tag}</head></html>`)).toEqual(none);
    expect(checkZoomCss(readFileSync('src/styles/global.css', 'utf8'))).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (viewport: string, style = '') =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="${viewport}"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}${style}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1></main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'zoom-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('width=device-width, initial-scale=1')).code).toBe(0); });
  it('user-scalable=no stops the build and names the page', () => {
    const r = run(FULL('width=device-width, initial-scale=1, user-scalable=no'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the viewport has user-scalable=no/);
  });
  it('maximum-scale=1 stops the build', () => {
    expect(run(FULL('width=device-width, maximum-scale=1')).out).toMatch(/maximum-scale=1;/);
  });
  it('touch-action none on body stops the build', () => {
    const r = run(FULL('width=device-width, initial-scale=1', 'body{touch-action:none}'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/dist: the rule "body" sets touch-action to none/);
  });
  it('maximum-scale=3 is a warning, not an error', () => {
    const r = run(FULL('width=device-width, maximum-scale=3'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*Lighthouse/);
  });
});
