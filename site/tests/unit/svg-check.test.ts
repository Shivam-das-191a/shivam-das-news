import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkSvg } from '../../scripts/svg-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const ICON = '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z"/></svg>';
const NO_NAME = 'an <svg role="img"> has no name (no <title>, aria-label or aria-labelledby), so a screen reader says nothing useful; add one, or aria-hidden="true" if it is only decoration';
const LOOSE = 'an <svg> has no name and is not hidden from screen readers; add aria-hidden="true" if it is decoration, or a <title> or aria-label if it carries meaning';
const HIDDEN_NAMED = 'an <svg aria-hidden="true"> has a name (<title>, aria-label or aria-labelledby) that no screen reader will ever read; remove the name or the aria-hidden';
const NO_VIEWBOX = 'an <svg> has a width or height and no viewBox, so it cannot scale on a small screen; add a viewBox';

describe('checkSvg: good pages', () => {
  it('a plain page passes', () => { expect(checkSvg('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkSvg(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkSvg('')).toEqual(none); });
  it('the icon of this site passes', () => { expect(checkSvg(ICON)).toEqual(none); });
  it('an svg with role img and a title passes', () => { expect(checkSvg('<svg role="img" viewBox="0 0 1 1"><title>Logo</title></svg>')).toEqual(none); });
  it('an svg with role img and an aria-label passes', () => { expect(checkSvg('<svg role="img" aria-label="Logo" viewBox="0 0 1 1"></svg>')).toEqual(none); });
  it('an svg with role img and an aria-labelledby passes', () => { expect(checkSvg('<svg role="img" aria-labelledby="t" viewBox="0 0 1 1"></svg>')).toEqual(none); });
  it('an svg with a title and no role passes', () => { expect(checkSvg('<svg viewBox="0 0 1 1"><title>Chart</title></svg>')).toEqual(none); });
  it('the page title and the word svg in text pass', () => { expect(checkSvg('<title>Page</title><p>Use an svg and a script tag.</p>')).toEqual(none); });
  it('a use that points to an id of the page gives no missing id warning', () => {
    expect(checkSvg('<svg style="display:none"><symbol id="a" viewBox="0 0 1 1"><path/></symbol></svg>' + '<svg viewBox="0 0 1 1" aria-hidden="true"><use href="#a"/></svg>')).toEqual({ errors: [], warnings: ['an <svg> has no name and is not hidden from screen readers; add aria-hidden="true" if it is decoration, or a <title> or aria-label if it carries meaning'] });
  });
});

describe('checkSvg: errors', () => {
  it('a script inside an svg is an error', () => {
    expect(checkSvg('<svg viewBox="0 0 1 1" aria-hidden="true"><script>alert(1)</script></svg>').errors).toEqual(['an <svg> holds a <script>, which the security rules of this site block and which a picture never needs; move the code out of the <svg>']);
  });
  it('a script after the svg is not an error', () => { expect(checkSvg(ICON + '<script>var a = 1;</script>')).toEqual(none); });
  it('a script with a src inside an svg is an error', () => { expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><script href="/a.js"></script></svg>').errors).toHaveLength(1); });
  it('a use from http:// is an error', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><use href="http://x.org/a.svg#b"/></svg>').errors).toEqual(['an <svg> <use> loads http://x.org/a.svg#b, which is not https; the browser blocks it on an https page']);
  });
  it('an xlink:href use from http:// is an error', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><use xlink:href="http://x.org/a.svg#b"/></svg>').errors).toHaveLength(1);
  });
  it('an image from http:// is an error', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><image href="http://x.org/a.png" width="1" height="1"/></svg>').errors).toEqual(['an <svg> <image> loads http://x.org/a.png, which is not https; the browser blocks it on an https page']);
  });
  it('the case of the scheme is not read', () => { expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><IMAGE HREF="HTTP://x.org/a.png"/></svg>').errors).toHaveLength(1); });
  it('an image from https is not an error', () => { expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><image href="https://x.org/a.png"/></svg>')).toEqual(none); });
  it('role img with no name is an error', () => { expect(checkSvg('<svg role="img" viewBox="0 0 1 1"><path/></svg>').errors).toEqual([NO_NAME]); });
  it('role graphics-document with no name is an error', () => { expect(checkSvg('<svg role="graphics-document" viewBox="0 0 1 1"></svg>').errors).toHaveLength(1); });
  it('the case of the role is not read', () => { expect(checkSvg('<SVG ROLE="IMG" VIEWBOX="0 0 1 1"></SVG>').errors).toHaveLength(1); });
  it('role img with an empty aria-label and an empty title is an error', () => {
    expect(checkSvg('<svg role="img" aria-label="" viewBox="0 0 1 1"><title> </title></svg>').errors).toHaveLength(1);
  });
  it('role img and aria-hidden is not an error', () => { expect(checkSvg('<svg role="img" aria-hidden="true" viewBox="0 0 1 1"></svg>')).toEqual(none); });
  it('a self closing svg with role img and no name is an error', () => { expect(checkSvg('<svg role="img" viewBox="0 0 1 1"/>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkSvg('<svg role="img" viewBox="0 0 1 1"></svg><svg role="img" viewBox="0 0 2 2"></svg>').errors).toHaveLength(1); });
  it('a long address is shortened in the message', () => {
    const r = checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><image href="http://x.org/' + 'a'.repeat(100) + '.png"/></svg>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(200);
  });
  it('a greater-than sign in a value does not cut the tag', () => {
    expect(checkSvg('<svg data-x="a > b" role="img" viewBox="0 0 1 1"></svg>').errors).toEqual([NO_NAME]);
  });
});

describe('checkSvg: warnings', () => {
  it('an svg with no role, no name and no aria-hidden is a warning', () => { expect(checkSvg('<svg viewBox="0 0 1 1"><path/></svg>')).toEqual({ errors: [], warnings: [LOOSE] }); });
  it('single quotes and no quotes are read', () => {
    expect(checkSvg("<svg aria-hidden='true' viewBox='0 0 1 1'></svg>")).toEqual(none);
    expect(checkSvg('<svg aria-hidden=true viewBox=0></svg>')).toEqual(none);
  });
  it('aria-hidden false counts as not hidden', () => { expect(checkSvg('<svg aria-hidden="false" viewBox="0 0 1 1"></svg>').warnings).toEqual([LOOSE]); });
  it('an svg with an empty role is left alone', () => { expect(checkSvg('<svg role="" viewBox="0 0 1 1"></svg>')).toEqual(none); });
  it('a hidden svg with a title is a warning', () => { expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><title>x</title></svg>')).toEqual({ errors: [], warnings: [HIDDEN_NAMED] }); });
  it('a hidden svg with an aria-label is a warning', () => { expect(checkSvg('<svg aria-hidden="true" aria-label="x" viewBox="0 0 1 1"></svg>').warnings).toEqual([HIDDEN_NAMED]); });
  it('a width and no viewBox is a warning', () => { expect(checkSvg('<svg width="24" aria-hidden="true"></svg>')).toEqual({ errors: [], warnings: [NO_VIEWBOX] }); });
  it('a height and no viewBox is a warning', () => { expect(checkSvg('<svg height="24px" aria-hidden="true"></svg>').warnings).toEqual([NO_VIEWBOX]); });
  it('a width of 0 and no viewBox is left alone', () => { expect(checkSvg('<svg width="0" height="0" aria-hidden="true"></svg>')).toEqual(none); });
  it('no size and no viewBox is left alone', () => { expect(checkSvg('<svg aria-hidden="true"></svg>')).toEqual(none); });
  it('a foreignObject is a warning', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><foreignObject><div>x</div></foreignObject></svg>').warnings).toEqual(['an <svg> holds a <foreignObject>, which is HTML inside a picture and is drawn wrong by some browsers; use plain HTML next to the picture instead']);
  });
  it('a use that points to a missing id is a warning', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><use href="#nope"/></svg>').warnings).toEqual(['an <svg> <use> points to #nope, but no element of this page has that id, so nothing is drawn']);
  });
  it('a use with xlink:href that points to a missing id is a warning', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><use xlink:href="#nope"/></svg>').warnings).toHaveLength(1);
  });
  it('an id in single quotes or with no quotes is found', () => {
    expect(checkSvg("<symbol id='a'></symbol><svg aria-hidden=\"true\" viewBox=\"0 0 1 1\"><use href=\"#a\"/></svg>")).toEqual(none);
    expect(checkSvg('<symbol id=a></symbol><svg aria-hidden="true" viewBox="0 0 1 1"><use href="#a"/></svg>')).toEqual(none);
  });
  it('a use to another file is left alone', () => { expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><use href="/sprite.svg#a"/></svg>')).toEqual(none); });
});

describe('checkSvg: what is left out', () => {
  it('text inside comments, style and template is not read', () => {
    const extra = '<!-- <svg role="img"></svg> --><style>a:after{content:"<svg role=img>"}</style><template><svg role="img"></svg></template>';
    expect(checkSvg(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a nested svg is not judged, only the outer one', () => {
    expect(checkSvg('<svg aria-hidden="true" viewBox="0 0 1 1"><svg role="img"><path/></svg></svg>')).toEqual(none);
  });
  it('a name inside a nested svg names the outer one', () => {
    expect(checkSvg('<svg role="img" viewBox="0 0 1 1"><svg viewBox="0 0 1 1"><title>Logo</title></svg></svg>')).toEqual(none);
  });
  it('a use, an image and a foreignObject outside an svg are not read', () => {
    expect(checkSvg('<use href="http://x.org/a.svg"><image href="http://x.org/a.png"><foreignObject></foreignObject>')).toEqual(none);
  });
  it('a custom element that starts with svg, use or image is not read', () => {
    expect(checkSvg('<svg-icon role="img"></svg-icon><user href="http://x.org"></user><imagemap href="http://x.org"></imagemap>')).toEqual(none);
  });
  it('an svg that is never closed is not judged', () => { expect(checkSvg('<svg role="img" viewBox="0 0 1 1"><path/>')).toEqual(none); });
  it('text after a comment is still read', () => { expect(checkSvg('<!-- x --><svg role="img" viewBox="0 0 1 1"></svg>').errors).toHaveLength(1); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkSvg('<main>' + ('<p class="a b">text <a href="/x/">link</a></p>' + ICON).repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the icon component passes', () => { expect(checkSvg(readFileSync('src/components/Icon.astro', 'utf8').split('---')[2])).toEqual(none); });
  it('the base layout passes', () => { expect(checkSvg(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'svg-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p>' + ICON)).code).toBe(0); });
  it('a script inside an svg stops the build and names the page', () => {
    const r = run(FULL('<svg aria-hidden="true" viewBox="0 0 1 1"><script>x</script></svg>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <svg> holds a <script>/);
  });
  it('an svg with role img and no name stops the build', () => {
    const r = run(FULL('<svg role="img" viewBox="0 0 1 1"></svg>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has no name \(no <title>/);
  });
  it('an image from http:// stops the build', () => {
    const r = run(FULL('<svg aria-hidden="true" viewBox="0 0 1 1"><image href="http://x.org/a.png"/></svg>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is not https; the browser blocks it/);
  });
  it('an svg with no name is a warning, not an error', () => {
    const r = run(FULL('<svg viewBox="0 0 1 1"></svg>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is not hidden from screen readers/);
  });
});
