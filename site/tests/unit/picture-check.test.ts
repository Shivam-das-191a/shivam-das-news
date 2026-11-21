import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkPicture } from '../../scripts/picture-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<picture><source type="image/webp" srcset="/a.webp 1x"><img src="/a.jpg" alt="a" width="10" height="10"></picture>';
const NO_IMG = 'a <picture> has no <img>, so it draws nothing in a browser that cannot choose a source and it has no alt text; add an <img> as the last child';
const TWO_IMG = 'a <picture> has more than one <img>; the browser draws one, so keep a single <img> as the last child';
const AFTER = 'a <source> comes after the <img> inside a <picture>, and the browser ignores it; put every <source> before the <img>';
const NO_SET = 'a <source> inside a <picture> has no srcset, so the browser has nothing to load; add a srcset';
const NO_KIND = 'a <source> has neither type nor media, so the browser always picks it and the sources after it and the <img> are never used; add a type or a media';

describe('checkPicture: good pages', () => {
  it('a plain page passes', () => { expect(checkPicture('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkPicture(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkPicture('')).toEqual(none); });
  it('a good picture passes', () => { expect(checkPicture(GOOD)).toEqual(none); });
  it('a picture with a media source passes', () => { expect(checkPicture('<picture><source media="(min-width: 800px)" srcset="/big.jpg"><img src="/a.jpg" alt="a"></picture>')).toEqual(none); });
  it('a picture with two sources and an img passes', () => {
    expect(checkPicture('<picture><source type="image/avif" srcset="/a.avif"><source type="image/webp" srcset="/a.webp"><img src="/a.jpg" alt=""></picture>')).toEqual(none);
  });
  it('a plain img passes', () => { expect(checkPicture('<img src="/a.jpg" alt="a">')).toEqual(none); });
  it('the word picture in text passes', () => { expect(checkPicture('<p>Use a picture element and a source tag.</p>')).toEqual(none); });
  it('two good pictures in a row pass', () => { expect(checkPicture(GOOD + GOOD)).toEqual(none); });
});

describe('checkPicture: errors', () => {
  it('a picture with no img is an error', () => { expect(checkPicture('<picture><source type="image/webp" srcset="/a.webp"></picture>').errors).toEqual([NO_IMG]); });
  it('an empty picture is an error', () => { expect(checkPicture('<picture></picture>').errors).toEqual([NO_IMG]); });
  it('a picture with two img is an error', () => { expect(checkPicture('<picture><img src="/a.jpg" alt=""><img src="/b.jpg" alt=""></picture>').errors).toEqual([TWO_IMG]); });
  it('three img give the same message once', () => { expect(checkPicture('<picture><img src="/a"><img src="/b"><img src="/c"></picture>').errors).toEqual([TWO_IMG]); });
  it('a source after the img is an error', () => {
    expect(checkPicture('<picture><img src="/a.jpg" alt=""><source type="image/webp" srcset="/a.webp"></picture>').errors).toEqual([AFTER]);
  });
  it('a source with no srcset is an error', () => { expect(checkPicture('<picture><source type="image/webp"><img src="/a.jpg" alt=""></picture>').errors).toEqual([NO_SET]); });
  it('a source with an empty srcset is an error', () => { expect(checkPicture('<picture><source type="image/webp" srcset=""><img src="/a.jpg" alt=""></picture>').errors).toEqual([NO_SET]); });
  it('a source with a src is an error and the message says so', () => {
    expect(checkPicture('<picture><source type="image/webp" src="/a.webp"><img src="/a.jpg" alt=""></picture>').errors).toEqual(['a <source> inside a <picture> has no srcset (it has a src, which is not read there), so the browser has nothing to load; add a srcset']);
  });
  it('the case of the tags and attributes is not read', () => {
    expect(checkPicture('<PICTURE><SOURCE TYPE="image/webp"><IMG SRC="/a.jpg"></PICTURE>').errors).toEqual([NO_SET]);
  });
  it('single quotes and no quotes are read', () => {
    expect(checkPicture("<picture><source type='image/webp' srcset='/a.webp'><img src=/a.jpg alt=a></picture>")).toEqual(none);
    expect(checkPicture('<picture><source type=image/webp><img src=/a.jpg alt=a></picture>').errors).toEqual([NO_SET]);
  });
  it('a greater-than sign in a value does not cut the tag', () => {
    expect(checkPicture('<picture><source media="(min-width: 1px) and (max-width: 9px)" title="a > b"><img src="/a" alt=""></picture>').errors).toEqual([NO_SET]);
  });
  it('the same message is not printed twice', () => {
    expect(checkPicture('<picture></picture><picture></picture>').errors).toEqual([NO_IMG]);
  });
  it('a picture with an error does not hide the next good one', () => { expect(checkPicture('<picture></picture>' + GOOD).errors).toEqual([NO_IMG]); });
});

describe('checkPicture: warnings', () => {
  it('a source with neither type nor media is a warning', () => {
    expect(checkPicture('<picture><source srcset="/a.webp"><img src="/a.jpg" alt=""></picture>')).toEqual({ errors: [], warnings: [NO_KIND] });
  });
  it('a type that is not an image type is a warning', () => {
    expect(checkPicture('<picture><source type="video/mp4" srcset="/a"><img src="/a.jpg" alt=""></picture>').warnings).toEqual(['a <source type="video/mp4"> is not an image type, so the browser skips it; use a type such as image/webp']);
  });
  it('an empty type is left alone', () => { expect(checkPicture('<picture><source type="" srcset="/a"><img src="/a.jpg" alt=""></picture>').warnings).toEqual([]); });
  it('an empty media is a warning', () => {
    expect(checkPicture('<picture><source media="" srcset="/a"><img src="/a.jpg" alt=""></picture>').warnings).toEqual(['a <source> has an empty media; remove it or give it a media query']);
  });
  it('the same warning is not printed twice', () => {
    expect(checkPicture('<picture><source srcset="/a"><img src="/a" alt=""></picture><picture><source srcset="/b"><img src="/b" alt=""></picture>').warnings).toEqual([NO_KIND]);
  });
});

describe('checkPicture: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <picture></picture> --><script>var s = \'<picture></picture>\';</script><style>a:after{content:"<picture>"}</style><template><picture></picture></template>';
    expect(checkPicture(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a source inside a video or an audio is not read', () => {
    expect(checkPicture('<video controls><source src="/a.mp4" type="video/mp4"></video><audio controls><source src="/a.mp3"></audio>')).toEqual(none);
  });
  it('a source and an img outside a picture are not read', () => { expect(checkPicture('<source srcset="/a"><img src="/a" alt="">')).toEqual(none); });
  it('a picture that is never closed is not judged', () => { expect(checkPicture('<picture><source srcset="/a" type="image/webp">')).toEqual(none); });
  it('a custom element that starts with picture, source or img is not read', () => {
    expect(checkPicture('<picture-box><source-list></source-list></picture-box><sources></sources><imgs></imgs>')).toEqual(none);
  });
  it('text after a comment is still read', () => { expect(checkPicture('<!-- x --><picture></picture>').errors).toEqual([NO_IMG]); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkPicture('<main>' + ('<p class="a b">text <a href="/x/">link</a></p>' + GOOD).repeat(15000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkPicture(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkPicture(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'picture-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p>' + GOOD)).code).toBe(0); });
  it('a picture with no img stops the build and names the page', () => {
    const r = run(FULL('<picture><source type="image/webp" srcset="/a.webp"></picture>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <picture> has no <img>/);
  });
  it('a source with no srcset stops the build', () => {
    const r = run(FULL('<picture><source type="image/webp"><img src="/a.jpg" alt="a" width="1" height="1"></picture>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has no srcset/);
  });
  it('a source with neither type nor media is a warning, not an error', () => {
    const r = run(FULL('<picture><source srcset="/a.webp"><img src="/a.jpg" alt="a" width="1" height="1"></picture>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*neither type nor media/);
  });
});
