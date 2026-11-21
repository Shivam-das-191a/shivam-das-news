import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkAttrValues } from '../../scripts/attr-values-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkAttrValues: good pages', () => {
  it('a page with none of these attributes passes', () => { expect(checkAttrValues('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkAttrValues(v as any).errors).toEqual(['the page is not text']);
  });
  it('loading, decoding and fetchpriority with real values pass', () => {
    expect(checkAttrValues('<img src="/a.jpg" loading="lazy" decoding="async" fetchpriority="high"><iframe loading="eager" fetchpriority="low"></iframe><img decoding="sync"><img decoding="auto" fetchpriority="auto">')).toEqual(none);
  });
  it('every referrer policy passes', () => {
    for (const p of ['no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'])
      expect(checkAttrValues(`<a href="/x/" referrerpolicy="${p}">x</a>`), p).toEqual(none);
  });
  it('crossorigin: anonymous, use-credentials and empty pass', () => {
    expect(checkAttrValues('<img crossorigin="anonymous"><script crossorigin="use-credentials"></script><link crossorigin><video crossorigin=""></video>')).toEqual(none);
  });
  it('form method and enctype pass', () => {
    expect(checkAttrValues('<form method="post" enctype="multipart/form-data"></form><form method="GET"></form><form method="dialog" enctype="text/plain"></form><form enctype="application/x-www-form-urlencoded"></form>')).toEqual(none);
  });
  it('an ordered list type passes', () => { for (const t of ['1', 'a', 'A', 'i', 'I']) expect(checkAttrValues(`<ol type="${t}"></ol>`), t).toEqual(none); });
  it('the case of a value does not matter (except the type of an ol)', () => { expect(checkAttrValues('<img loading="LAZY" fetchpriority="High">')).toEqual(none); });
  it('upper case tags and names, single quotes and no quotes are read', () => { expect(checkAttrValues("<IMG LOADING='lazy' DECODING=async>")).toEqual(none); });
  it('the same names on other tags are not read', () => {
    expect(checkAttrValues('<input type="text" method="zzz" loading="zzz"><div loading="zzz" decoding="x" fetchpriority="x"></div><ul type="disc"></ul><button type="submit" formmethod="post"></button><a href="/" crossorigin="x" loading="x">x</a>')).toEqual(none);
  });
  it('names that only contain these words are not read', () => { expect(checkAttrValues('<img data-loading="x" lazyloading="y" data-fetchpriority="z">')).toEqual(none); });
});

describe('checkAttrValues: errors', () => {
  it('a loading that is not real is an error', () => {
    expect(checkAttrValues('<img loading="laz">').errors).toEqual(['a <img> has loading="laz", which is not a real value, so the browser ignores it; use lazy or eager']);
  });
  it('an empty loading is an error', () => { expect(checkAttrValues('<img loading="">').errors).toHaveLength(1); expect(checkAttrValues('<iframe loading></iframe>').errors).toHaveLength(1); });
  it('fetchpriority and decoding that are not real are errors', () => {
    expect(checkAttrValues('<img fetchpriority="hihg">').errors).toEqual(['a <img> has fetchpriority="hihg", which is not a real value, so the browser ignores it; use high, low or auto']);
    expect(checkAttrValues('<img decoding="fast">').errors).toEqual(['a <img> has decoding="fast", which is not a real value, so the browser ignores it; use async, sync or auto']);
  });
  it('fetchpriority is read on link and script too', () => { expect(checkAttrValues('<link fetchpriority="x"><script fetchpriority="y"></script>').errors).toHaveLength(2); });
  it('a referrer policy that is not real is an error', () => {
    expect(checkAttrValues('<a href="/x/" referrerpolicy="none">x</a>').errors[0]).toMatch(/^a <a> has referrerpolicy="none", which is not a real value, so the browser ignores it; use one of no-referrer, /);
  });
  it('a crossorigin that is not real is an error', () => { expect(checkAttrValues('<img crossorigin="true">').errors).toHaveLength(1); });
  it('a form method or enctype that is not real is an error', () => {
    expect(checkAttrValues('<form method="put"></form>').errors).toEqual(['a <form> has method="put", which is not a real value, so the browser ignores it; use get, post or dialog']);
    expect(checkAttrValues('<form enctype="json"></form>').errors).toHaveLength(1);
  });
  it('an ordered list type that is not real is an error, and its case counts', () => {
    expect(checkAttrValues('<ol type="roman"></ol>').errors).toHaveLength(1);
    expect(checkAttrValues('<ol type="B"></ol>').errors).toHaveLength(1);
  });
  it('a very long value is cut in the message', () => { expect(checkAttrValues('<img loading="' + 'x'.repeat(300) + '">').errors[0].length).toBeLessThan(200); });
  it('the same message is not printed twice', () => { expect(checkAttrValues('<img loading="bad"><img loading="bad">').errors).toHaveLength(1); });
});

describe('checkAttrValues: warnings', () => {
  it('referrerpolicy unsafe-url is a warning', () => {
    const r = checkAttrValues('<a href="https://x.org/" referrerpolicy="unsafe-url">x</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <a> has referrerpolicy="unsafe-url", which sends the full address of this page to other sites; use strict-origin-when-cross-origin or no-referrer']);
  });
});

describe('checkAttrValues: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<img loading="bad">\';</script><template><img fetchpriority="bad"></template><!-- <img loading="bad"> --><style>img[loading="bad"]{}</style>';
    expect(checkAttrValues(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkAttrValues('<main>' + '<img class="a b" src="/a.jpg" loading="lazy" decoding="async" width="10" height="10">'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the hero pictures of the home page and the story page use fetchpriority high', () => {
    expect(readFileSync('src/pages/index.astro', 'utf8')).toMatch(/fetchpriority="high"/);
    expect(readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8')).toMatch(/fetchpriority="high"/);
  });
  it('the header logo and the post card use real values', () => {
    expect(checkAttrValues(readFileSync('src/components/Header.astro', 'utf8'))).toEqual(none);
    expect(readFileSync('src/components/Header.astro', 'utf8')).toMatch(/decoding="async"/);
    expect(readFileSync('src/components/PostCard.astro', 'utf8')).toMatch(/loading=\{lazy \? 'lazy' : 'eager'\}|loading=\{lazy/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'attrv-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good frame passes', () => { expect(run(FULL('<form method="post"><label>E <input type="email"></label><button type="submit">Go</button></form>')).code).toBe(0); });
  it('a mistyped loading stops the build and names the page', () => {
    const r = run(FULL('<p>x</p><img src="/a.jpg" alt="a" width="10" height="10" loading="laz">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <img> has loading="laz"/);
  });
  it('a mistyped form method stops the build', () => {
    const r = run(FULL('<form method="put"><button type="submit">Go</button></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has method="put"/);
  });
  it('unsafe-url is a warning, not an error', () => {
    const r = run(FULL('<a href="/x/" referrerpolicy="unsafe-url">x link</a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*unsafe-url/);
  });
});
