import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkUrlAttrs } from '../../scripts/url-attr-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const btn = (attr: string) => `<form method="post"><button ${attr}>x</button></form>`;

describe('checkUrlAttrs: good pages', () => {
  it('a plain page passes', () => { expect(checkUrlAttrs('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkUrlAttrs(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkUrlAttrs('')).toEqual(none); });
  it('a form with a normal action passes', () => { expect(checkUrlAttrs('<form action="/contact/" method="post"></form><form action="https://x.org/a"></form>')).toEqual(none); });
  it('a form with no action or an empty action passes', () => { expect(checkUrlAttrs('<form></form><form action=""></form>')).toEqual(none); });
  it('a mailto: action passes', () => { expect(checkUrlAttrs('<form action="mailto:a@b.org"></form>')).toEqual(none); });
  it('a button with a formaction passes', () => { expect(checkUrlAttrs(btn('formaction="/other/"'))).toEqual(none); });
  it('an input of type submit or image with a formaction passes', () => {
    expect(checkUrlAttrs('<input type="submit" formaction="/a/"><input type="IMAGE" src="/i.png" alt="x" formaction="/b/">')).toEqual(none);
  });
  it('a blockquote, q, ins and del with a cite pass', () => {
    expect(checkUrlAttrs('<blockquote cite="https://a.org/x">a</blockquote><q cite="/x/">b</q><ins cite="/y/">c</ins><del cite="https://a.org/">d</del>')).toEqual(none);
  });
  it('a link with a ping to https passes', () => { expect(checkUrlAttrs('<a href="/x/" ping="https://a.org/p">x</a><area ping="/p">')).toEqual(none); });
  it('a ping with two addresses passes', () => { expect(checkUrlAttrs('<a href="/x/" ping="https://a.org/p /q/">x</a>')).toEqual(none); });
  it('a video with a poster passes, also a data: poster', () => {
    expect(checkUrlAttrs('<video poster="/p.webp"></video><video poster="data:image/png;base64,AAAA"></video>')).toEqual(none);
  });
  it('the case of names and of the scheme is not read', () => { expect(checkUrlAttrs('<form ACTION="HTTPS://a.org/x"></form>')).toEqual(none); });
  it('a template expression is not read', () => {
    expect(checkUrlAttrs('<form action={url}></form><form action="${u}"></form><blockquote cite={c}>x</blockquote>')).toEqual(none);
  });
  it('the words in the text of a page pass', () => { expect(checkUrlAttrs('<p>Write action="javascript:go()" in a form.</p>')).toEqual(none); });
  it('a longer attribute name that only contains the word passes', () => { expect(checkUrlAttrs('<a data-action="javascript:x()" data-cite="file:///a">x</a>')).toEqual(none); });
  it('text inside a script, a style block, a template and a comment is not read', () => {
    const h = '<script>var a = \'<form action="javascript:x()">\';</script><style>p::after{content:\'<a ping="http://a.org">\'}</style><template><form action="file:///a"></form></template><!-- <form action="javascript:x()"> --><p>ok</p>';
    expect(checkUrlAttrs(h)).toEqual(none);
  });
});

describe('checkUrlAttrs: errors', () => {
  it('a javascript: action is an error', () => {
    const r = checkUrlAttrs('<form action="javascript:go()"></form>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/<form> has a action of javascript:go\(\); a javascript: address runs code/);
  });
  it('a javascript: formaction is an error', () => { expect(checkUrlAttrs(btn('formaction="javascript:go()"')).errors).toHaveLength(1); });
  it('a mixed case or broken up scheme is still javascript:', () => {
    expect(checkUrlAttrs('<form action="JavaScript:go()"></form>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<form action="  javascript:go()"></form>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<form action="java&#10;script:go()"></form>'.replace('&#10;', '\n')).errors).toHaveLength(1);
    expect(checkUrlAttrs('<form action="java\tscript:go()"></form>').errors).toHaveLength(1);
  });
  it('a javascript: cite, ping, poster and longdesc are errors', () => {
    expect(checkUrlAttrs('<blockquote cite="javascript:x()">a</blockquote>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<a href="/x/" ping="javascript:x()">a</a>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<video poster="javascript:x()"></video>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<img src="/a.png" alt="a" longdesc="javascript:x()">').errors).toHaveLength(1);
  });
  it('a file: address is an error', () => {
    const r = checkUrlAttrs('<form action="file:///etc/x"></form>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/reader's own disk/);
    expect(checkUrlAttrs('<video poster="file:///a.png"></video>').errors).toHaveLength(1);
  });
  it('a data: address is an error except in a poster', () => {
    expect(checkUrlAttrs('<form action="data:text/html,x"></form>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<blockquote cite="data:text/plain,x">a</blockquote>').errors).toHaveLength(1);
    expect(checkUrlAttrs('<video poster="data:image/gif;base64,R0lGOD"></video>').errors).toEqual([]);
  });
  it('a formaction to http:// is an error', () => {
    const r = checkUrlAttrs(btn('formaction="http://a.org/x"'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/not https/);
  });
  it('an action to http:// is left to the form check', () => { expect(checkUrlAttrs('<form action="http://a.org/x"></form>')).toEqual(none); });
  it('the quote characters written as entities are read', () => { expect(checkUrlAttrs('<form action="javascript:go(&quot;a&quot;)"></form>').errors).toHaveLength(1); });
  it('a value with no quotes is read', () => { expect(checkUrlAttrs('<form action=javascript:go()></form>').errors).toHaveLength(1); });
  it('a long value is shortened in the message', () => {
    const r = checkUrlAttrs('<form action="javascript:' + 'x'.repeat(100) + '"></form>');
    expect(r.errors[0]).toMatch(/\.\.\./);
    expect(r.errors[0].length).toBeLessThan(200);
  });
  it('every bad address of a page is listed', () => {
    const r = checkUrlAttrs('<form action="javascript:a()"></form><form action="file:///b"></form>');
    expect(r.errors).toHaveLength(2);
  });
  it('a custom element is read', () => { expect(checkUrlAttrs('<my-form action="javascript:a()"></my-form>').errors).toHaveLength(1); });
});

describe('checkUrlAttrs: warnings', () => {
  it('a ping to http:// is a warning', () => {
    const r = checkUrlAttrs('<a href="/x/" ping="http://a.org/p">x</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/not https/);
  });
  it('a ping with a word that is not an address is a warning', () => {
    const r = checkUrlAttrs('<a href="/x/" ping="track">x</a>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/"track" is not an address/);
  });
  it('a formaction on a tag that does not read it is a warning', () => {
    for (const h of ['<form formaction="/a/"></form>', '<a href="/x/" formaction="/a/">x</a>', '<input type="text" formaction="/a/">', '<input formaction="/a/">', '<div formaction="/a/">x</div>']) {
      const r = checkUrlAttrs(h);
      expect(r.errors, h).toEqual([]);
      expect(r.warnings, h).toHaveLength(1);
      expect(r.warnings[0], h).toMatch(/only a button or an input of type submit or image reads formaction/);
    }
  });
  it('a cite on a tag that does not read it is a warning', () => {
    const r = checkUrlAttrs('<div cite="/x/">a</div><p cite="https://a.org/">b</p>');
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/only blockquote, q, ins and del read cite/);
  });
  it('a ping on a tag that does not read it is a warning', () => {
    const r = checkUrlAttrs('<button ping="/p">x</button>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/only a and area read ping/);
  });
  it('a poster on a tag that does not read it is a warning', () => {
    const r = checkUrlAttrs('<audio poster="/p.png"></audio><img src="/a.png" alt="a" poster="/b.png">');
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/only video reads poster/);
  });
  it('a javascript: formaction on a div is an error and a warning', () => {
    const r = checkUrlAttrs('<div formaction="javascript:x()">a</div>');
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkUrlAttrs('<main>' + '<p class="a b" id="i">text <a href="/x/" title="t">link</a></p><blockquote cite="/c/">q</blockquote>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'uat-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const FORM = (attr: string) => `<form method="post" action="/contact/"><label>Name <input name="n" autocomplete="name"></label><button type="submit" ${attr}>Send</button></form>`;
  it('a good page passes', () => { expect(run(FULL(FORM('formaction="/other/"'))).code).toBe(0); });
  it('a javascript: formaction stops the build and names the page', () => {
    const r = run(FULL(FORM('formaction="javascript:go()"')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <button> has a formaction of javascript:go\(\); a javascript: address runs code/);
  });
  it('a file: cite stops the build', () => {
    const r = run(FULL('<blockquote cite="file:///a">q</blockquote>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/reader's own disk/);
  });
  it('a cite on a div is a warning, not an error', () => {
    const r = run(FULL('<div cite="/x/">q</div>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*only blockquote, q, ins and del read cite/);
  });
});
