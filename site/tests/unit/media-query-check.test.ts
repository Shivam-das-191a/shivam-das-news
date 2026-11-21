import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkMediaQueries } from '../../scripts/media-query-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;
const link = (m: string) => checkMediaQueries(page(`<link rel="stylesheet" href="/a.css" media="${m}">`));
const src = (m: string) => checkMediaQueries(page(`<picture><source srcset="/a.webp" media="${m}"><img src="/a.jpg" alt="x"></picture>`));

describe('checkMediaQueries: good pages', () => {
  it('a page with no media attribute passes', () => { expect(checkMediaQueries(page('<p>hi</p>'))).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkMediaQueries(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkMediaQueries('')).toEqual(none); });
  it('good queries pass', () => {
    for (const m of ['(min-width: 600px)', 'screen', 'print', 'all', 'screen and (min-width:600px) and (max-width:900px)', 'only screen and (max-width: 40em)',
      '(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(orientation: landscape)', '(hover: none) and (pointer: coarse)', '(min-resolution: 2dppx)',
      '(min-resolution: 192dpi)', '(-webkit-min-device-pixel-ratio: 2)', '(aspect-ratio: 16/9)', '(min-aspect-ratio: 16 / 9)', '(hover)', '(color)', 'not (hover)',
      'print, (min-width: 600px)', '(min-width: 0)', '(min-width: 37.5rem)', '(width >= 600px)', '(400px <= width <= 700px)', '(min-width: calc(30em + 10px))', '((hover) and (pointer: fine))',
      '(MIN-WIDTH: 600PX)', 'SCREEN AND (MIN-WIDTH:600PX)', '(forced-colors: active)', '(display-mode: standalone)', '(light-level: dim)', '(horizontal-viewport-segments: 2)'])
      expect(link(m), m).toEqual(none);
  });
  it('the same queries pass on a picture source', () => { expect(src('(min-width: 800px)')).toEqual(none); });
  it('an empty media is left to picture-check-lib.mjs', () => { expect(link('')).toEqual(none); expect(src('')).toEqual(none); });
  it('a media on a style block and its css text are not read', () => {
    expect(checkMediaQueries(page('<style media="(min-width: 600px)">@media (min-widht:600){a{color:red}}</style>'))).toEqual(none);
  });
  it('a theme colour with a good media passes', () => {
    expect(checkMediaQueries(page('<meta name="theme-color" content="#000" media="(prefers-color-scheme: dark)">'))).toEqual(none);
  });
  it('a media on a meta that is not a theme colour is not read', () => { expect(checkMediaQueries(page('<meta name="x" content="y" media="screeen">'))).toEqual(none); });
  it('a media on a link that is not a style sheet or hint is not read', () => { expect(checkMediaQueries(page('<link rel="canonical" href="/x/" media="screeen">'))).toEqual(none); });
  it('a media on a tag that is not read passes', () => { expect(checkMediaQueries(page('<video media="screeen"></video><a href="/x" media="((">x</a>'))).toEqual(none); });
  it('a bad query inside a comment, a template and a script is not read', () => {
    expect(checkMediaQueries(page('<!-- <link rel="stylesheet" media="screeen"> --><template><source media="((("></template><script>var h=\'<link media="(min-width:600)">\';</script>'))).toEqual(none);
  });
  it('the case of names and the quotes are not read', () => {
    expect(checkMediaQueries(page('<LINK REL="stylesheet" HREF="/a.css" MEDIA="(min-width:600px)">'))).toEqual(none);
    expect(checkMediaQueries(page("<link rel='stylesheet' href='/a.css' media='print'>"))).toEqual(none);
    expect(checkMediaQueries(page('<link rel=stylesheet href=/a.css media=print>'))).toEqual(none);
  });
  it('a tag called links is not a link', () => { expect(checkMediaQueries(page('<links media="screeen">'))).toEqual(none); });
  it('a rel list with stylesheet is read', () => { expect(link('screeen').errors).toHaveLength(1); });
  it('a feature far from any real name passes (the list is open)', () => { expect(link('(blorp: 4)')).toEqual(none); });
});

describe('checkMediaQueries: errors', () => {
  it('brackets that do not close', () => { expect(link('(min-width:600px').errors[0]).toMatch(/brackets that do not close/); });
  it('a bracket that closes but never opened', () => { expect(link('min-width:600px)').errors[0]).toMatch(/brackets that do not close/); });
  it('empty brackets', () => { expect(link('()').errors[0]).toMatch(/empty brackets/); });
  it('two conditions with no and', () => { expect(link('(min-width:600px)(max-width:900px)').errors[0]).toMatch(/no "and" between them/); });
  it('two conditions with a blank and no and', () => { expect(link('(min-width:600px) (max-width:900px)').errors[0]).toMatch(/no "and" between them/); });
  it('a type with a condition and no and', () => { expect(link('screen (min-width:600px)').errors[0]).toMatch(/type "screen" followed by a condition with no "and"/); });
  it('a query that starts with and', () => { expect(link('and (hover)').errors[0]).toMatch(/starts with "and"/); });
  it('a query that ends with and, or and not', () => {
    expect(link('screen and').errors[0]).toMatch(/ends with "and"/);
    expect(link('(hover) or').errors[0]).toMatch(/ends with "or"/);
    expect(link('only').errors[0]).toMatch(/ends with "only"/);
  });
  it('a media type that is not real', () => { expect(link('screeen').errors[0]).toMatch(/"screeen", which is not a media type/); });
  it('a typo after and is also read', () => { expect(link('screen and prnt').errors[0]).toMatch(/"prnt"/); });
  it('a feature with no value', () => { expect(link('(min-width:)').errors[0]).toMatch(/"min-width" with no value/); });
  it('a length with no unit', () => { expect(link('(min-width:600)').errors[0]).toMatch(/min-width: 600, which is not a length/); });
  it('a length with a unit that is not a length', () => { expect(link('(max-height: 20deg)').errors[0]).toMatch(/not a length/); });
  it('a device-width with no unit', () => { expect(link('(max-device-width: 480)').errors[0]).toMatch(/not a length/); });
  it('a width of a word', () => { expect(link('(width: big)').errors[0]).toMatch(/not a length/); });
  it('a resolution with no unit', () => { expect(link('(min-resolution: 2)').errors[0]).toMatch(/not a resolution/); });
  it('an aspect ratio with a colon', () => { expect(link('(aspect-ratio: 16:9)').errors[0]).toMatch(/not a ratio/); });
  it('a colour scheme that does not exist', () => { expect(link('(prefers-color-scheme: dim)').errors[0]).toMatch(/not a value of prefers-color-scheme \(use light, dark\)/); });
  it('motion, orientation, hover and pointer with a bad value', () => {
    expect(link('(prefers-reduced-motion: none)').errors).toHaveLength(1);
    expect(link('(orientation: wide)').errors).toHaveLength(1);
    expect(link('(hover: yes)').errors).toHaveLength(1);
    expect(link('(pointer: touch)').errors).toHaveLength(1);
  });
  it('min- in front of a feature that has no range', () => { expect(link('(min-prefers-color-scheme: dark)').errors[0]).toMatch(/takes no min- or max-/); });
  it('a typo of a real feature name is named', () => {
    expect(link('(min-widht:600px)').errors[0]).toMatch(/do you mean "min-width"/);
    expect(link('(prefers-color-schem: dark)').errors[0]).toMatch(/do you mean "prefers-color-scheme"/);
  });
  it('a bad query in a list of queries is found', () => { expect(link('print, (min-width:600)').errors).toHaveLength(1); });
  it('two bad queries give two errors', () => { expect(link('(min-width:600), screeen').errors).toHaveLength(2); });
  it('the same faults are found on a picture source, a style block and a theme colour', () => {
    expect(src('(min-width:600)').errors).toHaveLength(1);
    expect(checkMediaQueries(page('<style media="screeen">a{}</style>')).errors).toHaveLength(1);
    expect(checkMediaQueries(page('<meta name="theme-color" content="#000" media="(prefers-color-scheme: dim)">')).errors).toHaveLength(1);
  });
  it('the message names the tag and shortens a long query', () => {
    const long = '(min-width:600) and (max-width:900px) and (orientation: landscape) and (hover: hover) and (pointer: fine)';
    const r = link(long);
    expect(r.errors[0]).toMatch(/of a <link>/);
    expect(r.errors[0]).toMatch(/\.\.\./);
  });
});

describe('checkMediaQueries: warnings', () => {
  it('a media type that matches nothing', () => {
    for (const t of ['tv', 'tty', 'projection', 'handheld', 'braille', 'embossed', 'aural']) {
      const r = link(t);
      expect(r.errors).toEqual([]);
      expect(r.warnings[0]).toMatch(new RegExp(`media type "${t}"`));
    }
  });
  it('a min-width larger than the max-width of the same query', () => {
    const r = link('(min-width:900px) and (max-width:600px)');
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/min-width: 900px larger than max-width: 600px, so it never matches/);
  });
  it('a min-width equal to the max-width passes', () => { expect(link('(min-width:600px) and (max-width:600px)')).toEqual(none); });
  it('a min-width and a max-width in two queries of a list pass', () => { expect(link('(min-width:900px), (max-width:600px)')).toEqual(none); });
  it('a min-height larger than the max-height', () => { expect(link('(min-height:900px) and (max-height:600px)').warnings).toHaveLength(1); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'mq-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good media passes', () => { expect(run(FULL('<link rel="stylesheet" href="/a.css" media="(min-width: 600px)">')).code).toBe(0); });
  it('a length with no unit stops the build and names the page', () => {
    const r = run(FULL('<link rel="stylesheet" href="/a.css" media="(min-width:600)">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the media "\(min-width:600\)" of a <link> has min-width: 600, which is not a length/);
  });
  it('a media type that matches nothing is a warning, not an error', () => {
    const r = run(FULL('<link rel="stylesheet" href="/a.css" media="tv">'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*media type "tv"/);
  });
});
