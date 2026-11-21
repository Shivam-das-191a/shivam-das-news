import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkMaps } from '../../scripts/map-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<img src="/a.png" alt="a" width="10" height="10" usemap="#shop"><map name="shop"><area shape="rect" coords="0,0,10,10" href="/a/" alt="A"><area shape="circle" coords="5,5,3" href="/b/" alt="B"><area shape="poly" coords="0,0,10,0,5,9" href="/c/" alt="C"><area shape="default" href="/d/" alt="D"></map>';

describe('checkMaps: good pages', () => {
  it('a plain page passes', () => { expect(checkMaps('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkMaps(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkMaps('')).toEqual(none); });
  it('a picture with a map and all four shapes passes', () => { expect(checkMaps(GOOD)).toEqual(none); });
  it('the map may come before the picture', () => { expect(checkMaps('<map name="m"><area coords="0,0,1,1" href="/a/" alt="A"></map><img src="/a.png" usemap="#m">')).toEqual(none); });
  it('an area with no shape is a rect and passes with 4 numbers', () => { expect(checkMaps('<img usemap="#m"><map name="m"><area coords="0,0,5,5" href="/a/" alt="A"></map>')).toEqual(none); });
  it('coords may use spaces, decimals and minus signs', () => { expect(checkMaps('<img usemap="#m"><map name="m"><area shape="rect" coords="0, 0 , 5.5, -2" href="/a/" alt="A"></map>')).toEqual(none); });
  it('an area with no href needs no alt', () => { expect(checkMaps('<img usemap="#m"><map name="m"><area shape="rect" coords="0,0,5,5"></map>')).toEqual(none); });
  it('a default area needs no coords', () => { expect(checkMaps('<img usemap="#m"><map name="m"><area shape="default" href="/a/" alt="A"></map>')).toEqual(none); });
  it('two pictures may use one map', () => { expect(checkMaps('<img usemap="#m"><img usemap="#m"><map name="m"><area coords="0,0,1,1" alt="A" href="/a/"></map>')).toEqual(none); });
  it('a picture with no usemap passes', () => { expect(checkMaps('<img src="/a.png" alt="a">')).toEqual(none); });
  it('a poly with 8 numbers passes', () => { expect(checkMaps('<img usemap="#m"><map name="m"><area shape="poly" coords="0,0,9,0,9,9,0,9" href="/a/" alt="A"></map>')).toEqual(none); });
  it('the words usemap and area in text pass', () => { expect(checkMaps('<p>Write usemap="#x" and <code>&lt;area shape="star"&gt;</code>.</p>')).toEqual(none); });
});

describe('checkMaps: errors on the picture', () => {
  it('a usemap with no hash is an error', () => { expect(checkMaps('<img usemap="shop"><map name="shop"></map>').errors).toEqual(['an <img usemap="shop"> is not "#" and a map name; use usemap="#name"']); });
  it('an empty usemap is an error', () => { expect(checkMaps('<img usemap="">').errors).toHaveLength(1); });
  it('a usemap of only a hash is an error', () => { expect(checkMaps('<img usemap="#">').errors).toHaveLength(1); });
  it('a usemap with a space is an error', () => { expect(checkMaps('<img usemap="#a b">').errors).toHaveLength(1); });
  it('a usemap with no value is an error', () => { expect(checkMaps('<img usemap>').errors).toHaveLength(1); });
  it('a usemap to a missing map is an error', () => { expect(checkMaps('<img usemap="#nope">').errors).toEqual(['an <img usemap="#nope"> names a map that is not on the page; add <map name="nope">']); });
  it('a map name is read with its case', () => { expect(checkMaps('<img usemap="#Shop"><map name="shop"></map>').errors).toHaveLength(1); });
  it('the case of the tag and the attribute is not read', () => { expect(checkMaps('<IMG USEMAP="#nope">').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkMaps("<img usemap='#nope'>").errors).toHaveLength(1);
    expect(checkMaps('<img usemap=#nope>').errors).toHaveLength(1);
  });
  it('a greater-than sign in a value does not cut the tag', () => { expect(checkMaps('<img alt="a > b" usemap="#nope">').errors).toHaveLength(1); });
});

describe('checkMaps: errors on the map', () => {
  it('a map with no name is an error', () => { expect(checkMaps('<map></map>').errors).toEqual(['a <map> has no name, so no picture can use it; add name="..."']); });
  it('a map with an empty name is an error', () => { expect(checkMaps('<map name=""></map>').errors).toHaveLength(1); });
  it('a map name with a space is an error', () => { expect(checkMaps('<map name="a b"></map>').errors).toEqual(['a <map name="a b"> has a space in its name; use letters, digits and hyphens']); });
  it('two maps with one name are an error', () => { expect(checkMaps('<img usemap="#m"><map name="m"></map><map name="m"></map>').errors).toEqual(['two <map> tags have the name "m"; every map needs its own name']); });
  it('the same message is not printed twice', () => { expect(checkMaps('<img usemap="#x"><img usemap="#x">').errors).toHaveLength(1); });
  it('a long name is shortened in the message', () => {
    const r = checkMaps('<img usemap="#' + 'a'.repeat(100) + '">');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(200);
  });
});

describe('checkMaps: errors on the area', () => {
  const area = (a: string) => checkMaps(`<img usemap="#m"><map name="m"><area ${a}></map>`);
  it('an unknown shape is an error', () => { expect(area('shape="star" coords="1,2,3,4" alt="x"').errors).toEqual(['an <area shape="star"> is not rect, circle, poly or default']); });
  it('a shape is read in any case', () => { expect(area('shape="RECT" coords="1,2,3,4" alt="x"')).toEqual(none); });
  it('a rect with no coords is an error', () => { expect(area('shape="rect" alt="x"').errors).toEqual(['an <area shape="rect"> has no coords, so the browser ignores it; add coords="..."']); });
  it('an area with no shape and no coords is an error', () => { expect(area('alt="x"').errors).toHaveLength(1); });
  it('an empty coords is an error', () => { expect(area('shape="circle" coords="" alt="x"').errors).toHaveLength(1); });
  it('coords that are not numbers are an error', () => { expect(area('shape="rect" coords="a,b,c,d" alt="x"').errors).toEqual(['an <area coords="a,b,c,d"> is not a list of numbers; use numbers like coords="0,0,100,50"']); });
  it('coords with a unit are an error', () => { expect(area('shape="rect" coords="0px,0,5,5" alt="x"').errors).toHaveLength(1); });
  it('a rect with 3 numbers is an error', () => { expect(area('shape="rect" coords="1,2,3" alt="x"').errors).toEqual(['an <area shape="rect" coords="1,2,3"> has 3 numbers, but a rect has 4 numbers']); });
  it('a rect with 5 numbers is an error', () => { expect(area('shape="rect" coords="1,2,3,4,5" alt="x"').errors).toHaveLength(1); });
  it('a circle with 4 numbers is an error', () => { expect(area('shape="circle" coords="1,2,3,4" alt="x"').errors).toEqual(['an <area shape="circle" coords="1,2,3,4"> has 4 numbers, but a circle has 3 numbers']); });
  it('a poly with 4 numbers is an error', () => { expect(area('shape="poly" coords="1,2,3,4" alt="x"').errors).toHaveLength(1); });
  it('a poly with 7 numbers is an error', () => { expect(area('shape="poly" coords="1,2,3,4,5,6,7" alt="x"').errors).toHaveLength(1); });
  it('an area with an href and no alt is an error', () => { expect(area('shape="rect" coords="1,2,3,4" href="/a/"').errors).toEqual(['an <area> with an href has no alt, so the link has no name; add alt="..."']); });
  it('an empty alt is read as present', () => { expect(area('shape="rect" coords="1,2,3,4" href="/a/" alt=""')).toEqual(none); });
});

describe('checkMaps: warnings', () => {
  it('a map that no picture uses is a warning', () => { expect(checkMaps('<map name="m"></map>').warnings).toEqual(['a <map name="m"> is not used by any <img usemap>; remove it or add usemap="#m"']); });
  it('an area outside a map is a warning', () => { expect(checkMaps('<area shape="rect" coords="1,2,3,4" alt="x">').warnings).toEqual(['an <area> is outside a <map>, so no picture can use it; put it inside a <map>']); });
  it('an area after the map has closed is a warning', () => { expect(checkMaps('<img usemap="#m"><map name="m"></map><area shape="rect" coords="1,2,3,4">').warnings).toHaveLength(1); });
  it('an old shape name is a warning and is read as the new one', () => {
    const r = checkMaps('<img usemap="#m"><map name="m"><area shape="rectangle" coords="1,2,3,4" alt="x"><area shape="circ" coords="1,2,3" alt="x"><area shape="polygon" coords="0,0,9,0,5,9" alt="x"></map>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['an <area shape="rectangle"> is an old name; use shape="rect"', 'an <area shape="circ"> is an old name; use shape="circle"', 'an <area shape="polygon"> is an old name; use shape="poly"']);
  });
  it('the same warning is not printed twice', () => { expect(checkMaps('<map name="a"></map><map name="a"></map>').warnings).toHaveLength(1); });
  it('a warning never becomes an error', () => { expect(checkMaps('<map name="m"></map><area coords="1,2,3,4">').errors).toEqual([]); });
});

describe('checkMaps: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <img usemap="#x"> --><script>var s = \'<map></map>\';</script><style>a:after{content:"<area shape=star>"}</style><template><img usemap="#y"><area shape="star"></template>';
    expect(checkMaps(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment is still read', () => { expect(checkMaps('<!-- x --><img usemap="#nope">').errors).toHaveLength(1); });
  it('a custom element that starts with a listed word is not read', () => {
    expect(checkMaps('<imgs usemap="#x"></imgs><mapping></mapping><areas shape="star"></areas><map-box></map-box>')).toEqual(none);
  });
  it('an attribute on another tag is not read', () => { expect(checkMaps('<div usemap="#x" shape="star" coords="a"></div>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkMaps('<main>' + '<p class="a b">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkMaps(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkMaps(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'map-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL(GOOD)).code).toBe(0); });
  it('a usemap to a missing map stops the build and names the page', () => {
    const r = run(FULL('<img src="/a.png" alt="a" width="10" height="10" usemap="#nope">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <img usemap="#nope"> names a map that is not on the page/);
  });
  it('an area with coords of the wrong length stops the build', () => {
    const r = run(FULL('<img src="/a.png" alt="a" width="10" height="10" usemap="#m"><map name="m"><area shape="rect" coords="1,2,3" href="/a/" alt="A"></map>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has 3 numbers, but a rect has 4 numbers/);
  });
  it('a map that nothing uses is a warning, not an error', () => {
    const r = run(FULL('<map name="m"></map>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is not used by any <img usemap>/);
  });
});
