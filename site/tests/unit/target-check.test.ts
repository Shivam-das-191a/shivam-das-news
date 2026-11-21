import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTargets } from '../../scripts/target-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<a href="/a/" target="_blank" rel="noopener">a</a><a href="/b/" target="_self">b</a><a href="/c/" target="_parent">c</a><a href="/d/" target="_top">d</a><map name="m"><area shape="rect" coords="0,0,1,1" href="/e/" alt="e" target="_blank" rel="noopener"></map><form action="/s/" target="_blank"></form><button formtarget="_self">x</button><input type="submit" formtarget="_top"><base target="_self">';

describe('checkTargets: good pages', () => {
  it('a plain page passes', () => { expect(checkTargets('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkTargets(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkTargets('')).toEqual(none); });
  it('every real keyword on every tag passes', () => { expect(checkTargets(GOOD)).toEqual(none); });
  it('the keywords in any case pass', () => { expect(checkTargets('<a href="/" target="_BLANK">a</a><a href="/" target="_Self">b</a><a href="/" target="_TOP">c</a>')).toEqual(none); });
  it('a real window or frame name passes', () => { expect(checkTargets('<a href="/" target="gallery">a</a><a href="/" target="frame1">b</a><a href="/" target="my-window">c</a>')).toEqual(none); });
  it('an empty target passes', () => { expect(checkTargets('<a href="/" target="">a</a><a href="/" target="  ">b</a><a href="/" target>c</a>')).toEqual(none); });
  it('a link with no target passes', () => { expect(checkTargets('<a href="/">a</a><form action="/s/"></form><button>x</button>')).toEqual(none); });
  it('single quotes and no quotes pass', () => { expect(checkTargets("<a href='/' target='_blank'>a</a><a href=/ target=_self>b</a>")).toEqual(none); });
  it('the words in text pass', () => { expect(checkTargets('<p>Write target="_blnk" or target="blank" in a link.</p>')).toEqual(none); });
  it('a target on another tag is not read', () => { expect(checkTargets('<div target="_blnk"></div><p target="blank"></p><span formtarget="_new"></span><a formtarget="_blnk"></a><button target="_blnk">x</button>')).toEqual(none); });
  it('a custom tag that starts with a listed word is not read', () => { expect(checkTargets('<a-link target="_blnk"></a-link><form-x target="blank"></form-x><base-x target="_new"></base-x>')).toEqual(none); });
  it('a data attribute named target is not read', () => { expect(checkTargets('<a href="/" data-target="_blnk">a</a><a href="/" aria-target="blank">b</a>')).toEqual(none); });
});

describe('checkTargets: errors', () => {
  it('_blnk is an error with a plain message', () => {
    expect(checkTargets('<a href="/" target="_blnk">a</a>').errors).toEqual(['an <a target="_blnk"> starts with an underscore but is not _blank, _self, _parent or _top; the browser opens a window with that odd name; use one of the four words']);
  });
  it('_new, _window and _Blankk are errors', () => { expect(checkTargets('<a href="/" target="_new">a</a><a href="/" target="_window">b</a><a href="/" target="_Blankk">c</a>').errors).toHaveLength(3); });
  it('a lone underscore is an error', () => { expect(checkTargets('<a href="/" target="_">a</a>').errors).toHaveLength(1); });
  it('a space in front of _blank is an error with a plain message', () => {
    expect(checkTargets('<a href="/" target=" _blank">a</a>').errors).toEqual(['an <a target=" _blank"> has a space around the word; the browser reads the space as part of the name, so it is not _blank; remove the space']);
  });
  it('a space after the word is an error too', () => { expect(checkTargets('<a href="/" target="_self ">a</a>').errors).toHaveLength(1); });
  it('a space around a plain word is an error that names the keyword', () => { expect(checkTargets('<a href="/" target=" blank ">a</a>').errors[0]).toContain('so it is not _blank'); });
  it('area, form, base, button and input are read', () => {
    expect(checkTargets('<area shape="default" href="/" alt="a" target="_blnk"><form target="_blnk"></form><base target="_blnk"><button formtarget="_blnk">x</button><input type="submit" formtarget="_blnk">').errors).toHaveLength(5);
  });
  it('each tag is told by its own name', () => {
    const r = checkTargets('<area shape="default" href="/" alt="a" target="_n1"><form target="_n2"></form><base target="_n3"><button formtarget="_n4">x</button><input type="submit" formtarget="_n5">');
    expect(r.errors).toHaveLength(5);
    expect(r.errors[0]).toMatch(/^an <area target="_n1">/);
    expect(r.errors[3]).toMatch(/^a <button formtarget="_n4">/);
    expect(r.errors[4]).toMatch(/^an <input formtarget="_n5">/);
  });
  it('the case of the tag and the attribute is not read', () => { expect(checkTargets('<A HREF="/" TARGET="_blnk">a</A>').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkTargets("<a href='/' target='_blnk'>a</a>").errors).toHaveLength(1);
    expect(checkTargets('<a href=/ target=_blnk>a</a>').errors).toHaveLength(1);
  });
  it('a greater-than sign in another value does not cut the tag', () => { expect(checkTargets('<a href="/" title="a > b" target="_blnk">a</a>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkTargets('<a href="/" target="_blnk">a</a><a href="/y/" target="_blnk">b</a>').errors).toHaveLength(1); });
  it('a long name is shortened in the message', () => {
    const r = checkTargets('<a href="/" target="_' + 'a'.repeat(100) + '">a</a>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(260);
  });
  it('a link with no href is still read', () => { expect(checkTargets('<a target="_blnk">a</a>').errors).toHaveLength(1); });
});

describe('checkTargets: warnings', () => {
  it('blank with no underscore is a warning with a plain message', () => {
    expect(checkTargets('<a href="/" target="blank">a</a>').warnings).toEqual(['an <a target="blank"> is a window name, not the keyword; write _blank with the underscore']);
  });
  it('self, parent and top with no underscore are warnings', () => { expect(checkTargets('<a href="/" target="self">a</a><a href="/" target="parent">b</a><a href="/" target="TOP">c</a>').warnings).toHaveLength(3); });
  it('new is a warning that points to _blank', () => { expect(checkTargets('<a href="/" target="new">a</a>').warnings).toEqual(['an <a target="new"> is a window name, not the keyword; write _blank with the underscore']); });
  it('a warning never becomes an error', () => { expect(checkTargets('<a href="/" target="blank">a</a><form target="self"></form>').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkTargets('<a href="/" target="blank">a</a><a href="/y/" target="blank">b</a>').warnings).toHaveLength(1); });
  it('formtarget is read for a warning', () => { expect(checkTargets('<button formtarget="blank">x</button>').warnings).toHaveLength(1); });
});

describe('checkTargets: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <a href="/" target="_blnk"> --><script>var s = \'<a target="blank">\';</script><style>a:after{content:"<a target=_new>"}</style><template><a href="/" target="_blnk">x</a></template>';
    expect(checkTargets(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkTargets('<!-- x --><a href="/" target="_blnk">a</a>').errors).toHaveLength(1);
    expect(checkTargets('<script>var a = 1;</script><a href="/" target="_blnk">a</a>').errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkTargets('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the footer passes', () => { expect(checkTargets(readFileSync('src/components/Footer.astro', 'utf8'))).toEqual(none); });
  it('the base layout passes', () => { expect(checkTargets(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkTargets(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
  it('the contact form passes', () => { expect(checkTargets(readFileSync('src/components/ContactForm.astro', 'utf8')).errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'target-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p><a href="/a/">Home</a> <a href="https://x.org/" target="_blank" rel="noopener">Out (opens in a new tab)</a></p>')).code).toBe(0); });
  it('a link with target _blnk stops the build and names the page', () => {
    const r = run(FULL('<p><a href="/a/" target="_blnk" rel="noopener">Home</a></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <a target="_blnk"> starts with an underscore/);
  });
  it('a link with a space in front of _blank stops the build', () => {
    const r = run(FULL('<p><a href="/a/" target=" _blank" rel="noopener">Home</a></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has a space around the word/);
  });
  it('target blank with no underscore is a warning, not an error', () => {
    const r = run(FULL('<p><a href="/a/" target="blank" rel="noopener">Home (opens in a new tab)</a></p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is a window name, not the keyword/);
  });
});
