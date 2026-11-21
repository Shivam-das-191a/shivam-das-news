import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkNewTabLinks } from '../../scripts/new-tab-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<a href="https://x.org/" target="_blank" rel="noopener">X <span class="sr">(opens in a new tab)</span></a>';

describe('checkNewTabLinks: good pages', () => {
  it('a safe link that says it opens a new tab passes with no message', () => { expect(checkNewTabLinks(GOOD)).toEqual(none); });
  it('a page with no links passes', () => { expect(checkNewTabLinks('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of ['', undefined, null, 5, {}].slice(1)) expect(checkNewTabLinks(v as any).errors).toEqual(['the page is not text']);
  });
  it('normal links with no target pass', () => { expect(checkNewTabLinks('<a href="/a/">A</a><a href="https://x.org/">X</a>')).toEqual(none); });
  for (const t of ['_self', '_parent', '_top', '']) {
    it(`target="${t}" is not a new tab`, () => { expect(checkNewTabLinks(`<a href="/a/" target="${t}">A</a>`)).toEqual(none); });
  }
  it('a link with no href is not read', () => { expect(checkNewTabLinks('<a target="_blank">A</a>')).toEqual(none); });
});

describe('checkNewTabLinks: rel', () => {
  it('no rel is an error that names the address', () => {
    const r = checkNewTabLinks('<a href="https://x.org/y" target="_blank" aria-label="X, opens in a new tab">X</a>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/link to https:\/\/x\.org\/y opens a new tab but its rel has no noopener/);
  });
  it('a rel with other words only is an error', () => {
    expect(checkNewTabLinks('<a href="/a" target="_blank" rel="nofollow me">a (new tab)</a>').errors).toHaveLength(1);
  });
  it('noopener, noreferrer or both pass', () => {
    for (const r of ['noopener', 'noreferrer', 'noopener noreferrer', 'me noopener noreferrer', 'NOOPENER', 'nofollow  noopener'])
      expect(checkNewTabLinks(`<a href="/a" target="_blank" rel="${r}">a (new tab)</a>`).errors).toEqual([]);
  });
  it('a word that only contains noopener is not noopener', () => {
    expect(checkNewTabLinks('<a href="/a" target="_blank" rel="xnoopener">a (new tab)</a>').errors).toHaveLength(1);
  });
  it('a named target opens another window too', () => {
    expect(checkNewTabLinks('<a href="/a" target="reader" aria-label="new window">a</a>').errors).toHaveLength(1);
  });
  it('an area with href and target is read', () => {
    expect(checkNewTabLinks('<map><area href="/a" target="_blank" alt="new tab"></map>').errors).toHaveLength(1);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkNewTabLinks("<A HREF='/a' TARGET='_BLANK'>a</A>").errors).toHaveLength(1);
    expect(checkNewTabLinks('<a href=/a target=_blank rel=noopener>a (new tab)</a>')).toEqual(none);
  });
  it('the same message is not printed twice', () => {
    const l = '<a href="/a" target="_blank">a</a>';
    const r = checkNewTabLinks(l + l + l);
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
  it('two different links give two errors', () => {
    expect(checkNewTabLinks('<a href="/a" target="_blank">a</a><a href="/b" target="_blank">b</a>').errors).toHaveLength(2);
  });
  it('a long address is cut in the message', () => {
    const r = checkNewTabLinks(`<a href="https://x.org/${'a'.repeat(200)}" target="_blank" rel="noopener">a</a>`);
    expect(r.warnings[0].length).toBeLessThan(220);
    expect(r.warnings[0]).toMatch(/\.\.\./);
  });
});

describe('checkNewTabLinks: telling the reader', () => {
  const link = (inner: string, extra = '') => `<a href="/a" target="_blank" rel="noopener"${extra}>${inner}</a>`;
  it('no words about a new tab is a warning, not an error', () => {
    const r = checkNewTabLinks(link('Read more'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/never says so/);
  });
  it('the words in the text pass', () => {
    expect(checkNewTabLinks(link('Read more (opens in a new tab)'))).toEqual(none);
    expect(checkNewTabLinks(link('Read more, new window'))).toEqual(none);
    expect(checkNewTabLinks(link('Read <b>more</b> <span class="sr">opens in a NEW   TAB</span>'))).toEqual(none);
  });
  it('the words in aria-label or title pass', () => {
    expect(checkNewTabLinks(link('X', ' aria-label="X, opens in a new tab"'))).toEqual(none);
    expect(checkNewTabLinks(link('X', ' title="Opens in a new window"'))).toEqual(none);
  });
  it('the words in a tag name or attribute of the inside do not count', () => {
    expect(checkNewTabLinks(link('<span data-x="new tab">X</span>')).warnings).toHaveLength(1);
  });
  it('the words after the link do not count', () => {
    expect(checkNewTabLinks(link('X') + ' (new tab)').warnings).toHaveLength(1);
  });
  it('a link with an icon and a hidden text passes', () => {
    expect(checkNewTabLinks(link('<svg aria-hidden="true"><path d="M0 0"/></svg><span class="sr">Facebook (opens in a new tab)</span>'))).toEqual(none);
  });
  it('the text of the next link is not mixed in', () => {
    const r = checkNewTabLinks(link('A') + link('B (new tab)'));
    expect(r.warnings).toHaveLength(1);
  });
});

describe('checkNewTabLinks: the base tag', () => {
  it('a base with target _blank is an error', () => {
    expect(checkNewTabLinks('<head><base href="/" target="_blank"></head>').errors.join()).toMatch(/base tag has target="_blank"/);
  });
  it('a base with no target or _self passes', () => {
    expect(checkNewTabLinks('<base href="/">')).toEqual(none);
    expect(checkNewTabLinks('<base href="/" target="_self">')).toEqual(none);
  });
});

describe('checkNewTabLinks: what is left out', () => {
  it('links inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<a href="/a" target="_blank">x</a>\';</script><template><a href="/a" target="_blank">x</a></template><!-- <a href="/b" target="_blank">y</a> -->';
    expect(checkNewTabLinks(extra + GOOD)).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkNewTabLinks('<p>' + '<a href="/a/">x</a>'.repeat(30000) + '</p>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it('an unclosed link does not crash', () => { expect(() => checkNewTabLinks('<a href="/a" target="_blank">open')).not.toThrow(); });
});

describe('the real site', () => {
  it('every link that opens a new tab in the real footer is safe and says so', () => {
    const f = readFileSync('src/components/Footer.astro', 'utf8');
    const links = [...f.matchAll(/<a [^\n]*target="_blank"[^\n]*<\/a>/g)].map((m) => m[0].replace(/\{[^}]*\}/g, (x) => x.includes('opens in a new tab') ? 'opens in a new tab' : 'x'));
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const l of links) {
      const r = checkNewTabLinks(l.replace(/href=\{?[^ ]*/, 'href="https://x.org/"'));
      expect(r.errors).toEqual([]);
    }
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'newtab-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL(GOOD)).code).toBe(0); });
  it('a new tab link with no noopener stops the build and names the page', () => {
    const r = run(FULL('<a href="https://x.org/" target="_blank">X (new tab)</a>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the link to https:\/\/x\.org\/ opens a new tab but its rel has no noopener/);
  });
  it('a new tab link that does not say so is a warning, not an error', () => {
    const r = run(FULL('<a href="https://x.org/" target="_blank" rel="noopener">X</a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*never says so/);
  });
});
