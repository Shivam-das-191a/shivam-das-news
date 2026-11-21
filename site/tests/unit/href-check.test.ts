import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkHrefs } from '../../scripts/href-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const OWN = ['news.example.org'];

describe('checkHrefs: good links', () => {
  it('relative, https, mailto, tel and #name links pass with no message', () => {
    expect(checkHrefs('<a href="/story/">a</a><a href="../x">b</a><a href="https://a.org/x">c</a><a href="mailto:a@b.org">d</a><a href="tel:+1 555 010 0100">e</a><a href="#main">f</a><a href="?page=2">g</a>', OWN)).toEqual(none);
  });
  it('a page with no link passes', () => { expect(checkHrefs('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkHrefs(v as any).errors).toEqual(['the page is not text']);
  });
  it('an a with no href is left out', () => { expect(checkHrefs('<a name="x">a</a><a>b</a>')).toEqual(none); });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkHrefs("<A HREF='/a/'>x</A><a href=/b/>y</a><AREA HREF='https://a.org'>")).toEqual(none);
  });
  it('a protocol-relative link and a feed file are not bare addresses', () => {
    expect(checkHrefs('<a href="//cdn.a.org/x">a</a><a href="feed.xml">b</a><a href="about-us/">c</a>')).toEqual(none);
  });
  it('mailto with a subject and a to= address passes', () => {
    expect(checkHrefs('<a href="mailto:?to=a@b.org&subject=Hi">a</a><a href="mailto:a@b.org?subject=Hi">b</a>')).toEqual(none);
  });
});

describe('checkHrefs: errors', () => {
  it('an empty href and a blank href are errors', () => {
    expect(checkHrefs('<a href="">a</a>').errors).toEqual(['an <a> has an empty href']);
    expect(checkHrefs('<area href="  ">').errors).toEqual(['an <area> has an empty href']);
  });
  it('javascript: and vbscript: are errors, also with case, spaces and tabs', () => {
    for (const s of ['javascript:alert(1)', 'JavaScript:void(0)', ' javascript:x', 'java\tscript:x', 'vbscript:x'])
      expect(checkHrefs(`<a href="${s}">a</a>`).errors, s).toHaveLength(1);
  });
  it('the javascript: message does not carry the whole code', () => {
    const r = checkHrefs('<a href="javascript:' + 'x'.repeat(300) + '">a</a>');
    expect(r.errors[0].length).toBeLessThan(140);
  });
  it('file: is an error', () => { expect(checkHrefs('<a href="file:///C:/a.pdf">a</a>').errors.join()).toMatch(/a file on a computer/); });
  it('mailto: with no address is an error', () => {
    expect(checkHrefs('<a href="mailto:">a</a>').errors).toEqual(['a mailto: link has no e-mail address (mailto:)']);
    expect(checkHrefs('<a href="mailto:?subject=Hi">a</a>').errors).toHaveLength(1);
    expect(checkHrefs('<a href="mailto:name">a</a>').errors).toHaveLength(1);
  });
  it('tel: with no number is an error', () => {
    expect(checkHrefs('<a href="tel:">a</a>').errors.join()).toMatch(/no phone number/);
    expect(checkHrefs('<a href="tel:12">a</a>').errors).toHaveLength(1);
  });
  it('the same message is not printed twice', () => { expect(checkHrefs('<a href="">a</a><a href="">b</a>').errors).toHaveLength(1); });
  it('a link in an area tag is read', () => { expect(checkHrefs('<map><area href="javascript:x"></map>').errors).toHaveLength(1); });
});

describe('checkHrefs: warnings', () => {
  it('href="#" is a warning, not an error', () => {
    const r = checkHrefs('<a href="#">a</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/goes nowhere/);
  });
  it('http:// to our own site says so', () => {
    expect(checkHrefs('<a href="http://news.example.org/x/">a</a>', OWN).warnings).toEqual(['a link to our own site is on http:// (http://news.example.org/x/); use https://']);
  });
  it('http:// to another site is a warning', () => {
    expect(checkHrefs('<a href="http://a.org/x/">a</a>', OWN).warnings.join()).toMatch(/is on http:\/\/ \(http:\/\/a\.org/);
  });
  it('HTTP:// in capitals is read', () => { expect(checkHrefs('<a href="HTTP://a.org/">a</a>').warnings).toHaveLength(1); });
  it('localhost and 127.0.0.1 are warnings, on http and https', () => {
    for (const u of ['http://localhost:4321/a', 'https://localhost/a', 'http://127.0.0.1/a', 'https://0.0.0.0/a'])
      expect(checkHrefs(`<a href="${u}">a</a>`).warnings.join(), u).toMatch(/own computer/);
  });
  it('a bare web address is a warning', () => {
    expect(checkHrefs('<a href="www.example.org">a</a>').warnings.join()).toMatch(/with no https:\/\//);
    expect(checkHrefs('<a href="example.com/page">a</a>').warnings).toHaveLength(1);
    expect(checkHrefs('<a href="news.bbc.co">a</a>').warnings).toHaveLength(1);
  });
  it('a relative link that only looks like a file is not a bare address', () => {
    expect(checkHrefs('<a href="page.html">a</a><a href="data.json">b</a><a href="./a.com/x">c</a>')).toEqual(none);
  });
  it('the same warning is not printed twice', () => { expect(checkHrefs('<a href="#">a</a><a href="#">b</a>').warnings).toHaveLength(1); });
});

describe('checkHrefs: what is left out', () => {
  it('links inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<a href="javascript:x">\';</script><template><a href=""></a></template><!-- <a href="javascript:y"></a> -->';
    expect(checkHrefs(extra + '<a href="/ok/">a</a>')).toEqual(none);
  });
  it('link, base and other tags with an href are not read here', () => {
    expect(checkHrefs('<link rel="canonical" href="http://a.org/"><base href="http://a.org/">')).toEqual(none);
  });
  it('a word that only starts with a is not a link', () => { expect(checkHrefs('<abbr href="javascript:x">a</abbr><article href="">b</article>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkHrefs('<main>' + '<a class="x" href="/a/">y</a>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the layout has no empty or javascript: link written by hand', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(/href=["']\s*["']/.test(base)).toBe(false);
    expect(/href=["']\s*javascript:/i.test(base)).toBe(false);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'href-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('good links pass', () => { expect(run(FULL('<a href="/a/">a</a><a href="mailto:a@b.org">b</a>')).code).toBe(0); });
  it('a javascript: link stops the build and names the page', () => {
    const r = run(FULL('<a href="javascript:alert(1)">x</a>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a link has the address javascript:alert\(1\)/);
  });
  it('an empty href stops the build', () => {
    const r = run(FULL('<a href="">x</a>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has an empty href/);
  });
  it('a link to our own site on http:// is a warning, not an error', () => {
    const r = run(FULL('<a href="http://news.example.org/a/">x</a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*our own site is on http/);
  });
});
