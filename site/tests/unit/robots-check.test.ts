import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkRobots } from '../../scripts/robots-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const meta = (content: string, name = 'robots') => `<meta name="${name}" content="${content}">`;

describe('checkRobots: good pages', () => {
  it('a plain page passes', () => { expect(checkRobots('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkRobots(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkRobots('')).toEqual(none); });
  it('the real default of the site passes', () => { expect(checkRobots(meta('index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'))).toEqual(none); });
  it('the real noindex values of the site pass', () => {
    for (const v of ['noindex, nofollow', 'noindex,follow', 'noindex,nofollow']) expect(checkRobots(meta(v))).toEqual(none);
  });
  it('every real word passes', () => {
    for (const w of ['all', 'none', 'index', 'noindex', 'follow', 'nofollow', 'noarchive', 'nosnippet', 'notranslate', 'noimageindex', 'indexifembedded', 'nositelinkssearchbox', 'nopagereadaloud']) expect(checkRobots(meta(w))).toEqual(none);
  });
  it('googlebot, googlebot-news and bingbot are read and pass', () => {
    for (const n of ['googlebot', 'googlebot-news', 'bingbot']) expect(checkRobots(meta('noindex,nofollow', n))).toEqual(none);
  });
  it('the case of the words, the name and the tag is not read', () => { expect(checkRobots('<META NAME="ROBOTS" CONTENT="NoIndex, NoFollow">')).toEqual(none); });
  it('spaces around a comma are fine', () => { expect(checkRobots(meta('  noindex ,  nofollow  '))).toEqual(none); });
  it('max-image-preview none, standard and large pass', () => {
    for (const v of ['none', 'standard', 'large']) expect(checkRobots(meta(`max-image-preview:${v}`))).toEqual(none);
  });
  it('max-snippet and max-video-preview with -1, 0 and a number pass', () => {
    for (const v of ['-1', '0', '160']) expect(checkRobots(meta(`max-snippet:${v},max-video-preview:${v}`))).toEqual(none);
  });
  it('a space after the colon passes', () => { expect(checkRobots(meta('max-snippet: 50'))).toEqual(none); });
  it('unavailable_after with a real date passes', () => {
    expect(checkRobots(meta('unavailable_after: 25 Jun 2030 15:00:00 EST'))).toEqual(none);
    expect(checkRobots(meta('unavailable_after:2030-06-25'))).toEqual(none);
  });
  it('single quotes and no quotes pass', () => {
    expect(checkRobots("<meta name='robots' content='noindex,follow'>")).toEqual(none);
    expect(checkRobots('<meta name=robots content=noindex,follow>')).toEqual(none);
  });
  it('another meta name is not read', () => { expect(checkRobots('<meta name="description" content="noindx banana"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#fff">')).toEqual(none); });
  it('a content written as a template expression is not read', () => { expect(checkRobots('<meta name="robots" content={robotsValue}>')).toEqual(none); });
  it('a meta with no name is not read', () => { expect(checkRobots('<meta charset="utf-8"><meta property="og:title" content="noindx">')).toEqual(none); });
  it('the words in text pass', () => { expect(checkRobots('<p>Write &lt;meta name="robots" content="noindx"&gt; in the head.</p>')).toEqual(none); });
  it('a tag that only starts with meta is not read', () => { expect(checkRobots('<meta-x name="robots" content="noindx"></meta-x>')).toEqual(none); });
  it('a data attribute is not read', () => { expect(checkRobots('<meta name="robots" data-content="noindx" content="noindex">')).toEqual(none); });
});

describe('checkRobots: errors', () => {
  it('noindx is an error with a plain message', () => {
    expect(checkRobots(meta('noindx')).errors).toEqual(['the word "noindx" in a <meta name="robots"> is a typo of "noindex", so crawlers ignore it']);
  });
  it('no-index and no_index are errors', () => {
    expect(checkRobots(meta('no-index')).errors).toHaveLength(1);
    expect(checkRobots(meta('no_index')).errors).toHaveLength(1);
  });
  it('nofolow, nofollo and noarchve are errors', () => {
    for (const w of ['nofolow', 'nofollo', 'noarchve']) expect(checkRobots(meta(w)).errors).toHaveLength(1);
  });
  it('a typo inside a good list is found', () => { expect(checkRobots(meta('index,follow,nosnipet')).errors).toHaveLength(1); });
  it('a typo names the right real word', () => { expect(checkRobots(meta('nofolow')).errors[0]).toContain('"nofollow"'); });
  it('a typo on googlebot is found', () => { expect(checkRobots(meta('noindx', 'googlebot')).errors[0]).toContain('<meta name="googlebot">'); });
  it('a name that is a typo of robots is an error', () => {
    expect(checkRobots(meta('noindex', 'robot')).errors).toEqual(['a <meta name="robot"> is not read by any crawler; the name is robots']);
    expect(checkRobots(meta('noindex', 'robtos')).errors).toHaveLength(1);
    expect(checkRobots(meta('noindex', 'roboots')).errors).toHaveLength(1);
  });
  it('max-image-preview with a wrong size is an error', () => {
    expect(checkRobots(meta('max-image-preview:big')).errors).toEqual(['max-image-preview:big in a <meta name="robots"> is not a size a crawler knows; write none, standard or large']);
  });
  it('max-snippet that is not a number is an error', () => {
    expect(checkRobots(meta('max-snippet:lots')).errors).toEqual(['max-snippet:lots in a <meta name="robots"> is not a number; write -1 (no limit), 0 or a number of characters']);
  });
  it('max-video-preview that is not a number is an error', () => { expect(checkRobots(meta('max-video-preview:long')).errors[0]).toContain('number of seconds'); });
  it('a number below -1 is an error', () => { expect(checkRobots(meta('max-snippet:-5')).errors).toEqual(['max-snippet:-5 in a <meta name="robots"> is below -1; write -1 (no limit), 0 or a larger number']); });
  it('a decimal number is an error', () => { expect(checkRobots(meta('max-snippet:1.5')).errors).toHaveLength(1); });
  it('a parameter word written wrong is an error', () => {
    expect(checkRobots(meta('max-snipet:50')).errors).toEqual(['the word "max-snipet" in a <meta name="robots"> is a typo of "max-snippet", so crawlers ignore it']);
  });
  it('follow and nofollow together is an error', () => { expect(checkRobots(meta('follow,nofollow')).errors).toEqual(['a <meta name="robots"> says both follow and nofollow; keep one']); });
  it('the case of the tag and the attribute is not read', () => { expect(checkRobots('<META NAME="ROBOTS" CONTENT="NOINDX">').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkRobots("<meta name='robots' content='noindx'>").errors).toHaveLength(1);
    expect(checkRobots('<meta name=robots content=noindx>').errors).toHaveLength(1);
  });
  it('a greater-than sign in another value does not cut the tag', () => { expect(checkRobots('<meta title="a > b" name="robots" content="noindx">').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkRobots(meta('noindx') + meta('noindx')).errors).toHaveLength(1); });
  it('a long word is shortened in the message', () => {
    const r = checkRobots(meta('max-image-preview:' + 'x'.repeat(100)));
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(260);
  });
});

describe('checkRobots: warnings', () => {
  it('an empty content is a warning with a plain message', () => {
    expect(checkRobots(meta('')).warnings).toEqual(['a <meta name="robots"> has an empty content, so it says nothing; write for example index,follow']);
  });
  it('a robots tag with no content is a warning', () => { expect(checkRobots('<meta name="robots">').warnings).toHaveLength(1); });
  it('a list with spaces and no commas is a warning', () => {
    const r = checkRobots(meta('noindex nofollow'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <meta name="robots"> lists words with spaces and no commas ("noindex nofollow"); separate the words with commas']);
  });
  it('an old word is a warning', () => {
    expect(checkRobots(meta('index,noodp')).warnings).toEqual(['the word "noodp" in a <meta name="robots"> is old and ignored now; remove it']);
    expect(checkRobots(meta('noydir')).warnings).toHaveLength(1);
  });
  it('a word no crawler knows is a warning', () => {
    expect(checkRobots(meta('banana')).warnings).toEqual(['the word "banana" in a <meta name="robots"> is not one a crawler knows']);
  });
  it('an unknown parameter is a warning', () => { expect(checkRobots(meta('max-color:red')).warnings).toHaveLength(1); });
  it('an unreadable unavailable_after date is a warning', () => { expect(checkRobots(meta('unavailable_after:someday')).warnings).toHaveLength(1); });
  it('none with another word is a warning', () => {
    expect(checkRobots(meta('none,noarchive')).warnings).toEqual(['a <meta name="robots"> has none together with other words; none already means noindex,nofollow']);
  });
  it('none alone is not a warning', () => { expect(checkRobots(meta('none'))).toEqual(none); });
  it('a warning never becomes an error', () => { expect(checkRobots(meta('') + meta('banana') + meta('noodp') + meta('noindex nofollow')).errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkRobots(meta('banana') + meta('banana')).warnings).toHaveLength(1); });
});

describe('checkRobots: what is left out', () => {
  it('more than one robots tag is left to head-check', () => { expect(checkRobots(meta('index,follow') + meta('noindex,follow'))).toEqual(none); });
  it('index with noindex is left to head-check', () => { expect(checkRobots(meta('index,noindex'))).toEqual(none); });
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <meta name="robots" content="noindx"> --><script>var s = \'<meta name="robots" content="noindx">\';</script><style>a:after{content:"<meta name=robots content=noindx>"}</style><template><meta name="robots" content="noindx"></template>';
    expect(checkRobots(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkRobots('<!-- x -->' + meta('noindx')).errors).toHaveLength(1);
    expect(checkRobots('<script>var a = 1;</script>' + meta('noindx')).errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkRobots('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><meta name="viewport" content="width=device-width">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkRobots(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the search page passes', () => { expect(checkRobots(readFileSync('src/pages/search.astro', 'utf8'))).toEqual(none); });
  it('the 404 page passes', () => { expect(checkRobots(readFileSync('src/pages/404.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (robots: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/">${robots}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1><p>x</p></main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'robots-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL(meta('noindex,follow'))).code).toBe(0); });
  it('a typo of a word stops the build and names the page', () => {
    const r = run(FULL(meta('noindx,follow')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the word "noindx" in a <meta name="robots"> is a typo of "noindex"/);
  });
  it('a wrong image size stops the build', () => {
    const r = run(FULL(meta('index,follow,max-image-preview:big')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/max-image-preview:big/);
  });
  it('a list with spaces is a warning, not an error', () => {
    const r = run(FULL(meta('noindex nofollow')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*lists words with spaces and no commas/);
  });
});
