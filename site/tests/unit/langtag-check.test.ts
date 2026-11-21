import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkLangTags } from '../../scripts/langtag-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<link rel="alternate" hreflang="en" href="/en/"><link rel="alternate" hreflang="en-US" href="/us/"><link rel="alternate" hreflang="zh-Hant-TW" href="/tw/"><link rel="alternate" hreflang="es-419" href="/es/"><link rel="alternate" hreflang="x-default" href="/"><a href="/fr/" hreflang="fr">Fr</a><map name="m"><area shape="rect" coords="0,0,1,1" href="/de/" alt="de" hreflang="de"></map><video><track kind="subtitles" srclang="en" src="/a.vtt"><track kind="captions" srclang="fr-CA" src="/b.vtt"></video>';

describe('checkLangTags: good pages', () => {
  it('a plain page passes', () => { expect(checkLangTags('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkLangTags(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkLangTags('')).toEqual(none); });
  it('real codes on every tag pass', () => { expect(checkLangTags(GOOD)).toEqual(none); });
  it('the case of a code is not read', () => { expect(checkLangTags('<a href="/" hreflang="EN-us">a</a><link rel="alternate" hreflang="X-Default" href="/">')).toEqual(none); });
  it('spaces around a code are ignored', () => { expect(checkLangTags('<a href="/" hreflang=" en ">a</a>')).toEqual(none); });
  it('a track of another kind with no srclang passes', () => { expect(checkLangTags('<video><track kind="chapters" src="/a.vtt"><track kind="metadata" src="/b.vtt"><track src="/c.vtt"></video>')).toEqual(none); });
  it('a link with no hreflang passes', () => { expect(checkLangTags('<a href="/">a</a><link rel="alternate" href="/x/"><area shape="default" href="/" alt="a">')).toEqual(none); });
  it('lang and xml:lang are not read here', () => { expect(checkLangTags('<p lang="english" xml:lang="en_US">x</p>')).toEqual(none); });
  it('single quotes and no quotes pass', () => { expect(checkLangTags("<a href=/ hreflang='fr'>a</a><a href=/ hreflang=de>b</a>")).toEqual(none); });
  it('the words in text pass', () => { expect(checkLangTags('<p>Write hreflang="english" or srclang="french" in a tag.</p>')).toEqual(none); });
  it('an attribute on another tag is not read', () => { expect(checkLangTags('<div hreflang="english"></div><p srclang="french"></p><track hreflang="english"><a srclang="french" href="/">a</a>')).toEqual(none); });
  it('a custom tag that starts with a listed word is not read', () => { expect(checkLangTags('<a-link hreflang="english"></a-link><link-x hreflang="en_US"></link-x><track-x srclang="french"></track-x>')).toEqual(none); });
  it('a data attribute is not read', () => { expect(checkLangTags('<a href="/" data-hreflang="english">a</a>')).toEqual(none); });
});

describe('checkLangTags: errors', () => {
  it('hreflang english is an error with a plain message', () => {
    expect(checkLangTags('<link rel="alternate" hreflang="english" href="/en/">').errors).toEqual(['a <link hreflang="english"> is not a language code, so search engines and browsers ignore it; write it like en, en-US or x-default']);
  });
  it('en_US is an error', () => { expect(checkLangTags('<a href="/" hreflang="en_US">a</a>').errors).toHaveLength(1); });
  it('a one letter code and a long word are errors', () => { expect(checkLangTags('<a href="/" hreflang="e">a</a><a href="/" hreflang="bengali">b</a>').errors).toHaveLength(2); });
  it('a code with a space inside is an error', () => { expect(checkLangTags('<a href="/" hreflang="en US">a</a>').errors).toHaveLength(1); });
  it('a, area and link are read', () => {
    const r = checkLangTags('<a href="/" hreflang="bad1">a</a><area shape="default" href="/" alt="a" hreflang="bad2"><link rel="alternate" href="/" hreflang="bad3">');
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0]).toMatch(/^an? <a hreflang="bad1">/);
    expect(r.errors[1]).toMatch(/^an <area hreflang="bad2">/);
    expect(r.errors[2]).toMatch(/^a <link hreflang="bad3">/);
  });
  it('srclang french is an error with a plain message', () => {
    expect(checkLangTags('<video><track kind="subtitles" srclang="french" src="/a.vtt"></video>').errors).toEqual(['a <track srclang="french"> is not a language code, so the browser cannot name the language of the track; write it like en or fr']);
  });
  it('srclang is read on a track of any kind', () => { expect(checkLangTags('<video><track kind="captions" srclang="en_US" src="/a.vtt"></video>').errors).toHaveLength(1); });
  it('the case of the tag and the attribute is not read', () => { expect(checkLangTags('<A HREF="/" HREFLANG="english">a</A>').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkLangTags("<a href='/' hreflang='english'>a</a>").errors).toHaveLength(1);
    expect(checkLangTags('<a href=/ hreflang=english>a</a>').errors).toHaveLength(1);
  });
  it('a greater-than sign in another value does not cut the tag', () => { expect(checkLangTags('<a href="/" title="a > b" hreflang="english">a</a>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkLangTags('<a href="/" hreflang="english">a</a><a href="/y/" hreflang="english">b</a>').errors).toHaveLength(1); });
  it('a long value is shortened in the message', () => {
    const r = checkLangTags('<a href="/" hreflang="' + 'a'.repeat(100) + '">a</a>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(260);
  });
  it('a link with no href is still read', () => { expect(checkLangTags('<a hreflang="english">a</a>').errors).toHaveLength(1); });
});

describe('checkLangTags: warnings', () => {
  it('an empty hreflang is a warning with a plain message', () => {
    expect(checkLangTags('<a href="/" hreflang="">a</a>').warnings).toEqual(['an <a hreflang=""> is empty; write a language code such as en, en-US or x-default']);
  });
  it('an hreflang with no value is a warning', () => { expect(checkLangTags('<a href="/" hreflang>a</a>').warnings).toHaveLength(1); });
  it('a subtitles track with no srclang is a warning', () => {
    expect(checkLangTags('<video><track kind="subtitles" src="/a.vtt"></video>').warnings).toEqual(['a <track kind="subtitles"> has no srclang, so the browser cannot offer it by language; add srclang="en" (or the real language)']);
  });
  it('a subtitles track with an empty srclang is a warning', () => { expect(checkLangTags('<video><track kind="subtitles" srclang="" src="/a.vtt"></video>').warnings).toHaveLength(1); });
  it('the kind is read in any case', () => { expect(checkLangTags('<video><track kind="SUBTITLES" src="/a.vtt"></video>').warnings).toHaveLength(1); });
  it('a warning never becomes an error', () => { expect(checkLangTags('<a href="/" hreflang="">a</a><video><track kind="subtitles" src="/a.vtt"></video>').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkLangTags('<video><track kind="subtitles" src="/a.vtt"><track kind="subtitles" src="/b.vtt"></video>').warnings).toHaveLength(1); });
});

describe('checkLangTags: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <a hreflang="english"> --><script>var s = \'<track srclang="french">\';</script><style>a:after{content:"<a hreflang=bad>"}</style><template><a href="/" hreflang="english">x</a></template>';
    expect(checkLangTags(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkLangTags('<!-- x --><a href="/" hreflang="english">a</a>').errors).toHaveLength(1);
    expect(checkLangTags('<script>var a = 1;</script><a href="/" hreflang="english">a</a>').errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkLangTags('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkLangTags(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the footer passes', () => { expect(checkLangTags(readFileSync('src/components/Footer.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkLangTags(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'langtag-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p><a href="/fr/" hreflang="fr">Fr</a></p>')).code).toBe(0); });
  it('an hreflang that is not a code stops the build and names the page', () => {
    const r = run(FULL('<p><a href="/fr/" hreflang="french">Fr</a></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an? <a hreflang="french"> is not a language code/);
  });
  it('a track srclang that is not a code stops the build', () => {
    const r = run(FULL('<video controls width="640" height="360" poster="/p.png"><source src="/a.mp4" type="video/mp4"><track kind="subtitles" srclang="french" src="/a.vtt"></video>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/srclang="french"> is not a language code/);
  });
  it('a subtitles track with no srclang is a warning, not an error', () => {
    const r = run(FULL('<video controls width="640" height="360" poster="/p.png" preload="none"><source src="/a.mp4" type="video/mp4"><track kind="subtitles" src="/a.vtt"></video>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*has no srclang/);
  });
});
