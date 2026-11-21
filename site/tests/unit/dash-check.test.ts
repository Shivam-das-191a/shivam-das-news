import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkDoubleHyphen } from '../../scripts/dash-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkDoubleHyphen(page(body, head));
const one = /^1 place has two hyphens where a dash belongs/;

describe('checkDoubleHyphen: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>He left \u2014 then she came \u2013 and well-known people stayed.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkDoubleHyphen(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkDoubleHyphen('')).toEqual(none); });
  it('a single hyphen passes', () => { expect(c('<p>A state-of-the-art, well-known plan: 2020-2021.</p>')).toEqual(none); });
  it('a spaced single hyphen passes', () => { expect(c('<p>He left - then she came.</p>')).toEqual(none); });
  it('an em dash and an en dash pass', () => { expect(c('<p>He left\u2014then she came and 2020\u20132021 ended.</p>')).toEqual(none); });
  it('three hyphens pass', () => { expect(c('<p>left---then and left --- then</p>')).toEqual(none); });
  it('a long line of hyphens passes', () => { expect(c('<p>a ---------- b and a----------b</p>')).toEqual(none); });
  it('a command option in a sentence passes', () => { expect(c('<p>Run --help now and use --verbose or --version too.</p>')).toEqual(none); });
  it('a pair at the start of a paragraph passes', () => { expect(c('<p>-- start of a note</p><p>and more</p>')).toEqual(none); });
  it('a pair at the end of a paragraph passes', () => { expect(c('<p>end of a note --</p><p>and more</p>')).toEqual(none); });
  it('a pair alone in a paragraph passes', () => { expect(c('<p>--</p>')).toEqual(none); });
  it('a pair that touches only a space on one side passes', () => { expect(c('<p>left --then and left-- then</p>')).toEqual(none); });
  it('a pair between two paragraphs is not joined', () => { expect(c('<p>left --</p><p>-- then</p>')).toEqual(none); });
  it('a pair after a list item is not joined', () => { expect(c('<ul><li>left</li><li>-- then</li></ul>')).toEqual(none); });
  it('a table cell is not joined to the next', () => { expect(c('<table><tr><td>left --</td><td>-- then</td></tr></table>')).toEqual(none); });
  it('a line break ends the run', () => { expect(c('<p>left --<br>-- then</p>')).toEqual(none); });
  it('a pair written as references passes', () => { expect(c('<p>left&#45;&#45;then and left&minus;&minus;then</p>')).toEqual(none); });
  it('a pair in a comment passes', () => { expect(c('<!-- left--then --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="left--then";</script><style>.a{--main-color:red}.b{color:var(--main-color)}</style><template><p>left--then</p></template><textarea>left--then</textarea><noscript>left--then</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>left--then</pre><code>left -- then</code><kbd>a--b</kbd><samp>a -- b</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>left--then</title><text>left -- then</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>left--then</option></select>')).toEqual(none); });
  it('an attribute that holds a pair passes', () => { expect(c('<p title="left--then" data-x="a -- b">Fine text.</p><img alt="left--then" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="He left--then she came.">')).toEqual(none); });
  it('a custom property name in text passes', () => { expect(c('<p>Set --main-color and --accent first.</p>')).toEqual(none); });
  it('a pair next to a bracket with no word passes', () => { expect(c('<p>(--) and [--] and "--"</p>')).toEqual(none); });
  it('a comment end in text is not a pair', () => { expect(c('<p>one-two and three-four</p>')).toEqual(none); });
  it('a minus sign passes', () => { expect(c('<p>The score was \u22122 and 5\u22123.</p>')).toEqual(none); });
  it('a hyphen next to a digit passes', () => { expect(c('<p>Call 555-1234 or 555 - 1234.</p>')).toEqual(none); });
  it('a pair between two non breaking spaces passes', () => { expect(c('<p>left&nbsp;--&nbsp;then</p>')).toEqual(none); });
});

describe('checkDoubleHyphen: warnings', () => {
  it('two hyphens glued between two words', () => {
    const r = c('<p>He left--then she came.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(one);
  });
  it('two hyphens with a space on both sides', () => { expect(c('<p>He left -- then she came.</p>').warnings[0]).toMatch(one); });
  it('two hyphens between two digits', () => { expect(c('<p>From 2020--2021 it ran.</p>').warnings[0]).toMatch(one); });
  it('a word, then a mark, then spaced hyphens', () => { expect(c('<p>He said, -- then left.</p>').warnings[0]).toMatch(one); });
  it('spaced hyphens after a closing bracket', () => { expect(c('<p>He left (twice) -- then came back.</p>').warnings[0]).toMatch(one); });
  it('spaced hyphens before an opening quote', () => { expect(c('<p>He left -- \u201cno\u201d she said.</p>').warnings[0]).toMatch(one); });
  it('spaced hyphens before an opening bracket', () => { expect(c('<p>He left -- (twice) and came back.</p>').warnings[0]).toMatch(one); });
  it('an inline tag leaves no gap', () => { expect(c('<p>He <b>left</b>--<i>then</i> she came.</p>').warnings[0]).toMatch(one); });
  it('an inline tag around the pair', () => { expect(c('<p>He left <b>--</b> then she came.</p>').warnings[0]).toMatch(one); });
  it('a link around a word leaves no gap', () => { expect(c('<p>He <a href="/x/">left</a>--<a href="/y/">then</a> came.</p>').warnings[0]).toMatch(one); });
  it('a slip in the heading is read', () => { expect(c('<h1>Rain--then sun</h1><p>Fine text.</p>').warnings[0]).toMatch(one); });
  it('a slip in the title is read', () => { expect(c('<p>Fine text.</p>', '<title>Rain -- then sun</title>').warnings[0]).toMatch(one); });
  it('a slip in a list item is read', () => { expect(c('<ul><li>Done--then more.</li></ul>').warnings[0]).toMatch(one); });
  it('a slip in a table cell is read', () => { expect(c('<table><tr><td>Done--then more.</td></tr></table>').warnings[0]).toMatch(one); });
  it('a slip in a caption is read', () => { expect(c('<figure><img src="/a.png" alt="A fine picture"><figcaption>Done--then more.</figcaption></figure>').warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkDoubleHyphen(page('<p>Han gick--sedan kom hon.</p>', '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkDoubleHyphen(page('<p>He left--then she came.</p>', '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('a slip between letters of another script is read', () => { expect(c('<p>\u0986\u099c--\u0996\u09ac\u09b0</p>').warnings[0]).toMatch(one); });
  it('a slip with accented letters is read', () => { expect(c('<p>caf\u00e9--cr\u00e8me</p>').warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c('<p>He left--then she came.</p>').warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c('<p>He left--then she came -- and went. From 2020--2021 it ran.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^3 places have two hyphens where a dash belongs/);
  });
  it('places in two paragraphs are added', () => { expect(c('<p>He left--then.</p><p>Why -- because.</p>').warnings[0]).toMatch(/^2 places have /); });
  it('a slip right after a skipped block is still found', () => { expect(c('<code>x--y</code><p>He left--then she came.</p>').warnings[0]).toMatch(one); });
  it('a bad place mixed with good ones is counted once', () => { expect(c('<p>Run --help. Well-known, left---then, a - b, and he left--then.</p>').warnings[0]).toMatch(one); });
  it('a slip in a style attribute text is not read but the text is', () => { expect(c('<p style="--x:1">He left--then.</p>').warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c('<p>a--b and a -- b</p>').errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'dh-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with clean dashes passes with no message about hyphens', () => {
    const r = run(FULL('<p>He left \u2014 then she came, a well-known plan.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/two hyphens where a dash belongs/);
  });
  it('a double hyphen is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>He left--then she came.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has two hyphens where a dash belongs/);
  });
  it('two double hyphens are counted in one message', () => {
    const r = run(FULL('<p>He left--then she came -- and went.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have two hyphens where a dash belongs/);
  });
});
