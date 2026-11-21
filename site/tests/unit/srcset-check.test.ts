import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkSrcset } from '../../scripts/srcset-check-lib.mjs';
// @ts-ignore
import { SIZES, pictureSet } from '../../src/lib/picture-set.ts';

const none = { errors: [] as string[], warnings: [] as string[] };
const W = 'srcset="/a-400.jpg 400w, /a-800.jpg 800w, /a.jpg 1200w"';

describe('checkSrcset: good pages', () => {
  it('a page with no srcset or sizes passes', () => { expect(checkSrcset('<main><h1>x</h1><img src="/a.jpg" alt="a"></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkSrcset(v as any).errors).toEqual(['the page is not text']);
  });
  it('w descriptors with sizes pass', () => { expect(checkSrcset(`<img src="/a.jpg" ${W} sizes="(min-width: 800px) 640px, 100vw">`)).toEqual(none); });
  it('x descriptors pass', () => { expect(checkSrcset('<img src="/a.jpg" srcset="/a.jpg 1x, /a@2x.jpg 2x, /a@3x.jpg 3x">')).toEqual(none); });
  it('a decimal x descriptor passes', () => { expect(checkSrcset('<img src="/a.jpg" srcset="/a.jpg 1x, /a@15.jpg 1.5x, /b.jpg .75x">')).toEqual(none); });
  it('one plain address passes', () => { expect(checkSrcset('<img src="/a.jpg" srcset="/a.jpg">')).toEqual(none); });
  it('a source inside a picture passes', () => { expect(checkSrcset('<picture><source type="image/webp" srcset="/a-400.webp 400w, /a-800.webp 800w" sizes="100vw"><img src="/a.jpg" alt="a"></picture>')).toEqual(none); });
  it('every real length unit passes at the end of sizes', () => {
    for (const v of ['100vw', '50vw', '640px', '40em', '30rem', '100vmin', '12cm', '0', '33.3vw', '.5vw', 'calc(100vw - 2rem)', 'min(100vw, 640px)', 'clamp(200px, 50vw, 600px)'])
      expect(checkSrcset(`<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="${v}">`), v).toEqual(none);
  });
  it('a condition before the last length passes', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="(min-width: 600px) and (max-width: 900px) 50vw, (min-width: 901px) calc(100vw - 100px), 100vw">')).toEqual(none);
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="not (min-width: 600px) 100vw, 50vw">')).toEqual(none);
  });
  it('sizes="auto" passes', () => { expect(checkSrcset('<img loading="lazy" srcset="/a.jpg 400w, /b.jpg 800w" sizes="auto">')).toEqual(none); });
  it('a comma inside an address with no space after it is not a split', () => { expect(checkSrcset('<img srcset="/a,b.jpg 400w, /c,d.jpg 800w" sizes="100vw">')).toEqual(none); });
  it('the case of a value does not matter', () => { expect(checkSrcset('<img srcset="/a.jpg 400W, /b.jpg 800W" sizes="100VW">')).toEqual(none); });
  it('upper case tags, single quotes and no quotes are read', () => { expect(checkSrcset("<IMG SRCSET='/a.jpg 1x, /b.jpg 2x'><img srcset=/c.jpg>")).toEqual(none); });
  it('a newline between candidates is read', () => { expect(checkSrcset('<img srcset="/a.jpg 400w,\n  /b.jpg 800w" sizes="100vw">')).toEqual(none); });
  it('names that only end with these words are not read', () => { expect(checkSrcset('<img data-srcset="zzz 5q" data-sizes="100%" xsizes="">')).toEqual(none); });
  it('the real sizes of the site pass', () => {
    for (const [k, v] of Object.entries(SIZES)) expect(checkSrcset(`<img srcset="/a-400.jpg 400w, /a-800.jpg 800w" sizes="${v}">`), k).toEqual(none);
  });
  it('a real picture set of the site passes', () => {
    const map = { '/media/a.jpg': { width: 1600, variants: [400, 800] } };
    const set = pictureSet(map, '/media/a.jpg', SIZES.card);
    if (set) expect(checkSrcset(`<img src="/media/a.jpg" srcset="${set.srcset}" sizes="${set.sizes}">`)).toEqual(none);
  });
});

describe('checkSrcset: srcset errors', () => {
  it('an empty srcset is an error', () => {
    expect(checkSrcset('<img srcset="">').errors).toEqual(['a <img> has an empty srcset, which the browser ignores']);
    expect(checkSrcset('<img srcset>').errors).toHaveLength(1);
  });
  it('a descriptor that is not real is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400px">').errors).toEqual(['a <img> srcset has the descriptor "400px", which is not real; use a whole number and w (400w) or a number and x (2x)']);
  });
  it('the usual wrong descriptors are errors', () => {
    for (const d of ['400', 'w400', '400.5w', '-400w', '0w', '0x', '-1x', '2xx', 'x', 'w', '1,5x']) expect(checkSrcset(`<img srcset="/a.jpg ${d}">`).errors, d).toHaveLength(1);
  });
  it('two descriptors on one candidate is an error', () => { expect(checkSrcset('<img srcset="/a.jpg 400w 2x">').errors[0]).toContain('more than one descriptor'); });
  it('w and x together is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 2x" sizes="100vw">').errors).toEqual(['a <img> srcset mixes w and x descriptors, so the browser ignores the whole list; use only one kind']);
  });
  it('a plain address next to a w descriptor is the same mix', () => { expect(checkSrcset('<img srcset="/a.jpg, /b.jpg 800w" sizes="100vw">').errors).toHaveLength(1); });
  it('the same descriptor twice is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 400w" sizes="100vw">').errors).toEqual(['a <img> srcset uses 400w twice, so the browser cannot choose between the pictures']);
    expect(checkSrcset('<img srcset="/a.jpg 2x, /b.jpg 2.0x">').errors).toHaveLength(1);
    expect(checkSrcset('<img srcset="/a.jpg, /b.jpg 1x">').errors).toHaveLength(1);
  });
  it('an address on http is an error', () => {
    expect(checkSrcset('<img srcset="http://x.org/a.jpg 400w, /b.jpg 800w" sizes="100vw">').errors).toEqual(['a <img> srcset names http://x.org/a.jpg on http://, which a secure page blocks; use https://']);
  });
  it('a bad srcset on a source tag is found', () => { expect(checkSrcset('<picture><source srcset="/a.webp 400"><img src="/a.jpg" alt="a"></picture>').errors).toHaveLength(1); });
  it('a very long value is cut in the message', () => { expect(checkSrcset('<img srcset="/a.jpg ' + 'z'.repeat(300) + '">').errors[0].length).toBeLessThan(260); });
  it('the same message is not printed twice', () => { expect(checkSrcset('<img srcset="/a.jpg 400px"><img srcset="/b.jpg 400px">').errors).toHaveLength(1); });
});

describe('checkSrcset: sizes errors', () => {
  it('a percent is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="100%">').errors).toEqual(['a <img> sizes ends with "100%", which is not a length; use a width such as 100vw, 50vw or 640px (a percent is not allowed)']);
  });
  it('a word that is not a length is an error', () => {
    for (const v of ['full', 'auto-fill', '100', 'vw', '100 vw', 'fit-content']) expect(checkSrcset(`<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="${v}">`).errors, v).toHaveLength(1);
  });
  it('an empty sizes is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="">').errors).toEqual(['a <img> has an empty sizes, which the browser reads as 100vw; give the width the picture is drawn at, such as 100vw']);
  });
  it('an item with no condition before the last one is an error', () => {
    expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="50vw, 100vw">').errors).toEqual(['a <img> sizes has an item that is not a media condition in brackets and a length, such as (min-width: 800px) 640px']);
  });
  it('a condition with no length is an error', () => { expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="(min-width: 800px), 100vw">').errors).toHaveLength(1); });
  it('a comma inside brackets does not split an item', () => { expect(checkSrcset('<img srcset="/a.jpg 400w, /b.jpg 800w" sizes="(min-width: 800px) min(50vw, 600px), 100vw">')).toEqual(none); });
});

describe('checkSrcset: warnings', () => {
  it('w descriptors with no sizes on an img is a warning', () => {
    const r = checkSrcset(`<img src="/a.jpg" ${W}>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['an <img> has a srcset with w descriptors and no sizes, so the browser assumes the picture fills the screen and may load the biggest copy']);
  });
  it('w descriptors with no sizes on a source is a warning', () => {
    expect(checkSrcset('<picture><source srcset="/a.webp 400w, /b.webp 800w"><img src="/a.jpg" alt="a"></picture>').warnings).toEqual(['a <source> has a srcset with w descriptors and no sizes, so the browser assumes the picture fills the screen and may load the biggest copy']);
  });
  it('x descriptors with no sizes is fine', () => { expect(checkSrcset('<img srcset="/a.jpg 1x, /b.jpg 2x">')).toEqual(none); });
  it('sizes with no srcset is a warning', () => { expect(checkSrcset('<img src="/a.jpg" sizes="100vw">').warnings).toEqual(['a <img> has sizes but no srcset, so sizes does nothing']); });
  it('sizes with x descriptors only is a warning', () => { expect(checkSrcset('<img srcset="/a.jpg 1x, /b.jpg 2x" sizes="100vw">').warnings).toEqual(['a <img> has sizes but its srcset uses x descriptors only, so sizes does nothing']); });
  it('a broken srcset gives no warning about sizes', () => { expect(checkSrcset('<img srcset="/a.jpg 400px" sizes="100vw">').warnings).toEqual([]); });
});

describe('checkSrcset: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<img srcset="/a.jpg 400px" sizes="100%">\';</script><template><img srcset="/a.jpg 5q"></template><!-- <img srcset="/a.jpg 400px"> --><style>img[srcset="/a.jpg 400px"]{}</style>';
    expect(checkSrcset(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkSrcset('<main>' + '<img class="a b" src="/a.jpg" srcset="/a-400.jpg 400w, /a-800.jpg 800w" sizes="(min-width: 800px) 640px, 100vw" alt="a">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(4000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'srcset-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const IMG = (extra: string) => `<p>x</p><img src="/a.jpg" alt="a picture" width="800" height="450" loading="lazy" ${extra}>`;
  it('a good picture passes', () => { expect(run(FULL(IMG('srcset="/a-400.jpg 400w, /a-800.jpg 800w" sizes="(min-width: 800px) 640px, 100vw"'))).code).toBe(0); });
  it('a sizes of 100 percent stops the build and names the page', () => {
    const r = run(FULL(IMG('srcset="/a-400.jpg 400w, /a-800.jpg 800w" sizes="100%"')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <img> sizes ends with "100%"/);
  });
  it('a mixed srcset stops the build', () => {
    const r = run(FULL(IMG('srcset="/a-400.jpg 400w, /a-2x.jpg 2x" sizes="100vw"')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/mixes w and x descriptors/);
  });
  it('w descriptors with no sizes is a warning, not an error', () => {
    const r = run(FULL(IMG('srcset="/a-400.jpg 400w, /a-800.jpg 800w"')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*no sizes/);
  });
});
