import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkShouting } from '../../scripts/shout-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><title>${title}</title></head><body>${body}</body></html>`;
const c = (body: string, title = 'A fine title') => checkShouting(page(title, body));

describe('checkShouting: good pages', () => {
  it('a normal title and headings pass', () => { expect(c('<h1>City council votes on new budget</h1><h2>What changes</h2><h3>Next steps</h3>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkShouting(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkShouting('')).toEqual(none); });
  it('a short heading in capitals passes (under 12 letters)', () => { expect(c('<h2>FAQ</h2><h2>FBI RAID</h2><h2>NASA</h2>')).toEqual(none); });
  it('eleven capital letters pass', () => { expect(c('<h2>ABCDEFGHIJK</h2>')).toEqual(none); });
  it('a heading with one small letter passes', () => { expect(c('<h1>BREAKING NEWS FROM THE CAPITAL tonight</h1>')).toEqual(none); });
  it('a capital heading with a small word inside passes', () => { expect(c('<h1>FBI and CIA SHARE REPORT ON NEW THREAT</h1>')).toEqual(none); });
  it('one ! or one ? passes', () => { expect(c('<h2>Why now?</h2><h2>Stop!</h2>')).toEqual(none); });
  it('a ?! pair passes', () => { expect(c('<h2>Really?! Yes</h2>')).toEqual(none); });
  it('marks apart pass', () => { expect(c('<h2>Wait! What? No!</h2>')).toEqual(none); });
  it('a heading with no Latin letters passes', () => { expect(c('<h1>\u0986\u099c\u0995\u09c7\u09b0 \u0996\u09ac\u09b0 \u09b8\u09ac\u09be\u09b0 \u0986\u0997\u09c7</h1>')).toEqual(none); });
  it('digits and marks alone pass', () => { expect(c('<h2>2026 - 2027 / 100% 12345678901234</h2>')).toEqual(none); });
  it('capitals in a paragraph, a link, a button and a h4 are not read', () => {
    expect(c('<p>THIS IS A LOUD PARAGRAPH!!!</p><a href="/x">CLICK HERE NOW!!!</a><button>SUBSCRIBE TODAY!!!</button><h4>LOUD LITTLE HEADING!!!</h4>')).toEqual(none);
  });
  it('capitals in the meta description are not read', () => { expect(checkShouting('<html><head><title>Ok title</title><meta name="description" content="ALL CAPITAL DESCRIPTION!!!"></head><body></body></html>')).toEqual(none); });
  it('text in a comment, a script, a style, a template, a textarea, a pre and a noscript is not read', () => {
    expect(c('<!-- <h1>LOUD HEADING TEXT!!!</h1> --><script>var h="<h1>LOUD HEADING TEXT!!!</h1>";</script><style>h1{}</style><template><h2>LOUD HEADING TEXT</h2></template><textarea><h1>LOUD HEADING TEXT</h1></textarea><pre><h2>LOUD HEADING TEXT</h2></pre><noscript><h1>LOUD HEADING TEXT</h1></noscript>')).toEqual(none);
  });
  it('the title inside an svg is not read', () => { expect(c('<svg><title>ALL CAPITAL ICON NAME!!!</title></svg>')).toEqual(none); });
  it('a tag called h1x or title-box is not a heading', () => { expect(c('<h1x>LOUD HEADING TEXT!!!</h1x><title-box>LOUD TEXT HERE!!!</title-box>')).toEqual(none); });
  it('an empty heading passes (the heading check reads it)', () => { expect(c('<h1></h1><h2> </h2>')).toEqual(none); });
});

describe('checkShouting: warnings', () => {
  it('a title in capitals', () => {
    const r = checkShouting(page('BREAKING NEWS TODAY', '<h1>Fine</h1>'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a title or heading in all capital letters/);
  });
  it('an h1 in capitals', () => { expect(c('<h1>SHOCKING TRUTH ABOUT THE BUDGET</h1>').warnings[0]).toMatch(/^1 place has a title or heading in all capital letters/); });
  it('an h2 and an h3 in capitals', () => { expect(c('<h2>WHAT HAPPENED NEXT</h2><h3>THE FULL STORY HERE</h3>').warnings[0]).toMatch(/^2 places have a title or heading in all capital letters/); });
  it('exactly twelve capital letters warn', () => { expect(c('<h2>ABCDEFGHIJKL</h2>').warnings[0]).toMatch(/all capital letters/); });
  it('capitals with digits and marks warn', () => { expect(c('<h2>COVID-19 UPDATE: 5 NEW CASES</h2>').warnings[0]).toMatch(/all capital letters/); });
  it('capitals split by an inline tag warn', () => { expect(c('<h1>BIG <em>STORY</em> OF THE <b>DAY</b></h1>').warnings[0]).toMatch(/all capital letters/); });
  it('capitals with a character reference warn', () => { expect(c('<h1>TAXES &amp; SPENDING REPORT</h1>').warnings[0]).toMatch(/all capital letters/); });
  it('the case of the tag names is not read', () => { expect(c('<H1>SHOCKING TRUTH ABOUT IT</H1>').warnings[0]).toMatch(/all capital letters/); });
  it('a heading with attributes warns', () => { expect(c('<h1 class="a > b" id="t">SHOCKING TRUTH ABOUT IT</h1>').warnings[0]).toMatch(/all capital letters/); });
  it('a heading on many lines warns', () => { expect(c('<h1>SHOCKING\n   TRUTH\n   ABOUT IT</h1>').warnings[0]).toMatch(/all capital letters/); });
  it('two !', () => {
    const r = c('<h1>Big news!!</h1>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has repeated ! or \? marks/);
  });
  it('two ?', () => { expect(c('<h2>Why??</h2>').warnings[0]).toMatch(/repeated ! or \? marks/); });
  it('three mixed marks', () => { expect(c('<h2>Really?!?</h2>').warnings[0]).toMatch(/repeated ! or \? marks/); });
  it('marks in the title', () => { expect(checkShouting(page('You will not believe it!!!', '<h1>Fine</h1>')).warnings[0]).toMatch(/^1 place has repeated/); });
  it('marks in two headings count as two places', () => { expect(c('<h2>One!!</h2><h3>Two???</h3>').warnings[0]).toMatch(/^2 places have repeated/); });
  it('a heading in capitals with marks gives both messages, once each', () => {
    const r = c('<h1>THIS CHANGES EVERYTHING!!!</h1>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });
  it('different headings give each their own count', () => {
    const r = c('<h1>LOUD HEADLINE NUMBER ONE</h1><h2>Quiet!!</h2><h2>LOUD HEADLINE NUMBER TWO</h2>');
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toMatch(/^2 places have a title or heading in all capital letters/);
    expect(r.warnings[1]).toMatch(/^1 place has repeated/);
  });
  it('a quiet heading next to a loud one is not counted', () => {
    const r = c('<h2>Quiet heading here</h2><h2>LOUD HEADING RIGHT HERE</h2>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'sh-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with normal headings passes with no message about shouting', () => {
    const r = run(FULL('<h2>Normal heading</h2>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/capital letters|repeated !/);
  });
  it('a heading in capitals is a warning, not an error, and names the page', () => {
    const r = run(FULL('<h2>SHOCKING TRUTH ABOUT THE BUDGET</h2>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a title or heading in all capital letters/);
  });
  it('repeated marks in a heading are a warning, not an error', () => {
    const r = run(FULL('<h2>Big news!!!</h2>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*repeated ! or \? marks/);
  });
});
