import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTabindex } from '../../scripts/tabindex-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkTabindex: good pages', () => {
  it('a page with no tabindex passes', () => { expect(checkTabindex('<main><h1>x</h1><a href="/a/">a</a></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkTabindex(v as any).errors).toEqual(['the page is not text']);
  });
  it('tabindex 0 and -1 pass on any tag', () => {
    expect(checkTabindex('<div tabindex="0">a</div><main id="main" tabindex="-1">b</main><input tabindex="-1"><pre tabindex="0">c</pre>')).toEqual(none);
  });
  it('a plus sign and spaces around a number are read', () => { expect(checkTabindex('<div tabindex=" 0 ">a</div><div tabindex="+0">b</div>')).toEqual(none); });
  it('upper case names, single quotes and no quotes are read', () => { expect(checkTabindex("<DIV TABINDEX='0'>a</DIV><div tabindex=-1>b</div>")).toEqual(none); });
  it('an onclick on a button, a link or a field is fine', () => {
    expect(checkTabindex('<button onclick="a()">x</button><a href="/a/" onclick="a()">y</a><input onclick="a()"><select onclick="a()"></select>')).toEqual(none);
  });
  it('an onclick on a plain tag with a role is fine', () => { expect(checkTabindex('<div role="button" tabindex="0" onclick="a()">x</div>')).toEqual(none); });
  it('an empty accesskey is left out', () => { expect(checkTabindex('<a href="/a/" accesskey="">x</a>')).toEqual(none); });
});

describe('checkTabindex: errors', () => {
  it('a number above 0 is an error', () => {
    expect(checkTabindex('<a href="/a/" tabindex="1">x</a>').errors).toEqual(['<a> has tabindex="1"; a number above 0 breaks the order of the Tab key, use 0 or -1']);
    expect(checkTabindex('<div tabindex="+3">x</div><div tabindex="999">y</div>').errors).toHaveLength(2);
  });
  it('a value that is not a whole number is an error', () => {
    for (const v of ['', 'abc', '1.5', '-', 'true', '0x1']) expect(checkTabindex(`<div tabindex="${v}">x</div>`).errors, v).toHaveLength(1);
  });
  it('a bare tabindex with no value is an error', () => { expect(checkTabindex('<div tabindex>x</div>').errors).toHaveLength(1); });
  it('the message does not carry a very long value', () => {
    expect(checkTabindex('<div tabindex="' + 'x'.repeat(300) + '">a</div>').errors[0].length).toBeLessThan(120);
  });
  it('the same message is not printed twice', () => { expect(checkTabindex('<div tabindex="2">a</div><div tabindex="2">b</div>').errors).toHaveLength(1); });
});

describe('checkTabindex: warnings', () => {
  it('an accesskey is a warning', () => {
    const r = checkTabindex('<a href="/a/" accesskey="s">x</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['<a> has accesskey="s"; it clashes with the shortcuts of browsers and screen readers']);
  });
  it('an onclick on a plain tag with no role is a warning', () => {
    for (const t of ['div', 'span', 'p', 'li', 'img', 'section', 'svg', 'h2'])
      expect(checkTabindex(`<${t} onclick="a()">x</${t}>`).warnings.join(), t).toMatch(/keyboard cannot use it/);
  });
  it('an onclick with capitals is read', () => { expect(checkTabindex('<DIV ONCLICK="a()">x</DIV>').warnings).toHaveLength(1); });
  it('the same warning is not printed twice', () => { expect(checkTabindex('<div onclick="a()">a</div><div onclick="b()">b</div>').warnings).toHaveLength(1); });
});

describe('checkTabindex: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<div tabindex="5" onclick="x">\';</script><template><div tabindex="9"></div></template><!-- <div tabindex="3"></div> --><style>div[tabindex="4"]{}</style>';
    expect(checkTabindex(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a tabindex word inside another attribute value is not read', () => { expect(checkTabindex('<div title="tabindex=5 onclick=x">a</div>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkTabindex('<main>' + '<a class="x" href="/a/" tabindex="0">y</a>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.astro') ? [join(d, e.name)] : []));
  it('no template of the site has a tabindex above 0 or an accesskey', () => {
    for (const f of walk('src')) {
      const t = readFileSync(f, 'utf8');
      expect(/tabindex=["']?\s*\+?[1-9]/i.test(t), f).toBe(false);
      expect(/accesskey=/i.test(t), f).toBe(false);
    }
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'tabindex-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('tabindex 0 and -1 pass', () => { expect(run(FULL('<div tabindex="0">a</div><div tabindex="-1">b</div>')).code).toBe(0); });
  it('a tabindex above 0 stops the build and names the page', () => {
    const r = run(FULL('<a href="/a/" tabindex="3">x</a>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: <a> has tabindex="3"/);
  });
  it('a tabindex that is not a number stops the build', () => {
    const r = run(FULL('<div tabindex="abc">x</div>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/must be a whole number/);
  });
  it('an accesskey is a warning, not an error', () => {
    const r = run(FULL('<a href="/a/" accesskey="s">x</a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*accesskey/);
  });
});
