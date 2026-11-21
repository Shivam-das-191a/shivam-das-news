import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkDoctype } from '../../scripts/doctype-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (d: string) => `${d}<html lang="en"><head><title>x</title></head><body><p>hi</p></body></html>`;

describe('checkDoctype: good pages', () => {
  it('the plain doctype passes', () => { expect(checkDoctype(page('<!doctype html>'))).toEqual(none); });
  it('capital letters pass', () => { expect(checkDoctype(page('<!DOCTYPE html>'))).toEqual(none); expect(checkDoctype(page('<!DOCTYPE HTML>'))).toEqual(none); });
  it('blanks inside the doctype pass', () => { expect(checkDoctype(page('<!doctype   html  >'))).toEqual(none); });
  it('blanks and a new line before the doctype pass', () => { expect(checkDoctype(page('\n  \r\n<!doctype html>'))).toEqual(none); });
  it('a byte order mark before the doctype passes', () => { expect(checkDoctype(page('﻿<!doctype html>'))).toEqual(none); });
  it('the legacy-compat form passes', () => {
    expect(checkDoctype(page('<!doctype html system "about:legacy-compat">'))).toEqual(none);
    expect(checkDoctype(page("<!DOCTYPE html SYSTEM 'about:legacy-compat'>"))).toEqual(none);
  });
  it('a doctype followed on the same line by html passes', () => { expect(checkDoctype('<!doctype html><html lang="en"><body>x</body></html>')).toEqual(none); });
  it('the word doctype inside a script, style, template or comment is not a second doctype', () => {
    const h = page('<!doctype html>').replace('<p>hi</p>', '<script>var a = "<!doctype html>";</script><style>p::after{content:"<!doctype html>"}</style><template><!doctype html></template><!-- <!doctype html> -->');
    expect(checkDoctype(h)).toEqual(none);
  });
  it('the word in the text of a page after the doctype is a warning only when it is a real tag', () => {
    expect(checkDoctype(page('<!doctype html>').replace('<p>hi</p>', '<p>Write &lt;!doctype html&gt; first.</p>'))).toEqual(none);
  });
});

describe('checkDoctype: errors', () => {
  it('not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkDoctype(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page has no doctype', () => { expect(checkDoctype('').errors).toHaveLength(1); expect(checkDoctype('   \n ').errors[0]).toMatch(/no <!doctype html>/); });
  it('a page with no doctype is an error', () => {
    const r = checkDoctype('<html lang="en"><head></head><body>x</body></html>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/no <!doctype html>.*quirks mode/);
  });
  it('a page that starts with a tag is an error', () => { expect(checkDoctype('<head><title>x</title></head><body>y</body>').errors[0]).toMatch(/no <!doctype html>/); });
  it('a page that starts with text is an error', () => { expect(checkDoctype('hello <!doctype html><html></html>').errors[0]).toMatch(/does not come first/); });
  it('a tag before the doctype is an error', () => { expect(checkDoctype('<div></div><!doctype html><html></html>').errors[0]).toMatch(/does not come first/); });
  it('a doctype in the middle of the page is an error', () => { expect(checkDoctype('<html><body><!doctype html></body></html>').errors[0]).toMatch(/does not come first/); });
  it('a typo of the doctype is named', () => {
    for (const t of ['<!doctyp html>', '<!doctpye html>', '<!doctype1 html>', '<!doctipe html>', '<!DOCTYE html>', '<!doctyyype html>']) {
      const r = checkDoctype(page(t));
      expect(r.errors, t).toHaveLength(1);
      expect(r.errors[0], t).toMatch(/typo of <!doctype html>/);
    }
  });
  it('a doctype with no "!" is an error', () => {
    const r = checkDoctype(page('<doctype html>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/no "!"/);
    expect(checkDoctype(page('<DOCTYPE html>')).errors[0]).toMatch(/no "!"/);
  });
  it('a doctype with no name is an error', () => {
    expect(checkDoctype(page('<!doctype>')).errors[0]).toMatch(/has no name/);
    expect(checkDoctype(page('<!doctype >')).errors[0]).toMatch(/has no name/);
  });
  it('a name that is not html is an error', () => {
    for (const n of ['htm', 'body', 'xhtml', 'html5', 'htmml']) {
      const r = checkDoctype(page(`<!doctype ${n}>`));
      expect(r.errors, n).toHaveLength(1);
      expect(r.errors[0], n).toMatch(new RegExp(`names "${n}", not html`));
    }
  });
  it('a long name is shortened in the message', () => {
    const r = checkDoctype(page('<!doctype ' + 'x'.repeat(100) + '>'));
    expect(r.errors[0]).toMatch(/\.\.\./);
    expect(r.errors[0].length).toBeLessThan(200);
  });
  it('a different tag with a word near doctype is not named a typo', () => {
    expect(checkDoctype('<!docs html><html></html>').errors[0]).toMatch(/no <!doctype html>/);
  });
  it('a comment alone, then no doctype, is an error', () => { expect(checkDoctype('<!-- a --><html></html>').errors[0]).toMatch(/no <!doctype html>/); });
});

describe('checkDoctype: warnings', () => {
  it('an HTML 4.01 doctype is a warning', () => {
    const r = checkDoctype(page('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/old identifier/);
  });
  it('an XHTML doctype is a warning', () => {
    const r = checkDoctype(page('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'));
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/old identifier/);
  });
  it('a system identifier other than legacy-compat is a warning', () => {
    expect(checkDoctype(page('<!doctype html system "about:blank">')).warnings[0]).toMatch(/old identifier/);
  });
  it('a second doctype is a warning', () => {
    const r = checkDoctype('<!doctype html><html><body><!doctype html></body></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the page has a second doctype; the browser ignores it, remove it']);
  });
  it('a comment before the doctype is a warning', () => {
    const r = checkDoctype('<!-- built by a tool -->\n<!doctype html><html></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/comment comes before the doctype/);
  });
  it('several comments give one warning', () => {
    expect(checkDoctype('<!-- a --><!-- b -->\n<!doctype html><html></html>').warnings).toHaveLength(1);
  });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkDoctype('<!doctype html><html><body>' + '<p class="a" id="i">text <a href="/x/">link</a></p>'.repeat(40000) + '</body></html>');
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const BODY = (body: string) =>
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'dtp-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run('<!doctype html>' + BODY('<p>ok</p>')).code).toBe(0); });
  it('a page with no doctype stops the build and names the page', () => {
    const r = run(BODY('<p>ok</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the page has no <!doctype html>/);
  });
  it('a mistyped doctype stops the build', () => {
    const r = run('<!doctyp html>' + BODY('<p>ok</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/typo of <!doctype html>/);
  });
  it('a doctype with another name stops the build', () => {
    const r = run('<!doctype htm>' + BODY('<p>ok</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/names "htm", not html/);
  });
  it('an old doctype is a warning, not an error', () => {
    const r = run('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">' + BODY('<p>ok</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*old identifier/);
  });
});
