import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkQuoteSpacing } from '../../scripts/quote-space-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const LQ = '\u201c', RQ = '\u201d';
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkQuoteSpacing(page(body, head));

describe('checkQuoteSpacing: good pages', () => {
  it('normal text passes', () => { expect(c(`<h1>City council votes</h1><p>He said ${LQ}no${RQ} and then ${LQ}yes${RQ}.</p>`)).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkQuoteSpacing(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkQuoteSpacing('')).toEqual(none); });
  it('a mark after the closing quote passes', () => { expect(c(`<p>He said ${LQ}no${RQ}, then ${LQ}yes${RQ}. Why ${LQ}not${RQ}?</p>`)).toEqual(none); });
  it('a closing quote after a mark passes', () => { expect(c(`<p>${LQ}Stop.${RQ} ${LQ}Why?${RQ} ${LQ}Go!${RQ}</p>`)).toEqual(none); });
  it('a quote inside a bracket passes', () => { expect(c(`<p>See (${LQ}the table${RQ}) and [${LQ}sic${RQ}].</p>`)).toEqual(none); });
  it('a quote after a dash passes', () => { expect(c(`<p>He said \u2014${LQ}no${RQ}\u2014 and left.</p>`)).toEqual(none); });
  it('a quote next to a single quote passes', () => { expect(c(`<p>He said ${LQ}\u2018no\u2019${RQ} and left.</p>`)).toEqual(none); });
  it('a quote at the start of a paragraph passes', () => { expect(c(`<p>${LQ}No${RQ}</p><p>${LQ}Yes${RQ}</p>`)).toEqual(none); });
  it('a space at the start of the next paragraph is not joined', () => { expect(c(`<p>He said ${LQ}no</p><p> yes${RQ}</p>`)).toEqual(none); });
  it('a space at the end of a paragraph before a closing quote is not joined', () => { expect(c(`<p>He said no </p><p>${RQ} odd</p>`)).toEqual(none); });
  it('an apostrophe and a possessive pass', () => { expect(c(`<p>The ${LQ}Bob${RQ}\u2019s car and Tom\u2019s hat.</p>`)).toEqual(none); });
  it('a quote across an inline tag with no gap passes', () => { expect(c(`<p>He said ${LQ}<b>no</b>${RQ} and ${LQ}<i>yes</i>${RQ} too.</p>`)).toEqual(none); });
  it('quotes written as references pass', () => { expect(c('<p>He said &ldquo;no&rdquo; and &#8220;yes&#8221; and &#x201c;ok&#x201d;.</p>')).toEqual(none); });
  it('a gap written as a non breaking space passes', () => { expect(c(`<p>Un mot ${LQ}&nbsp;exemple&nbsp;${RQ} et ${LQ}&#160;autre&#xa0;${RQ}.</p>`)).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c(`<p>A ${LQ}\u00a0word\u00a0${RQ} here</p>`)).toEqual(none); });
  it('straight quotes with gaps are not read', () => { expect(c('<p>He said " no " and said"no"then.</p>')).toEqual(none); });
  it('a German style quote passes', () => { expect(c('<p>Er sagte \u201eja\u201c und \u201enein\u201d und\u201eso\u201cdann.</p>')).toEqual(none); });
  it('a quote in a comment passes', () => { expect(c(`<!-- ${LQ} a ${RQ} said${LQ}no${RQ}then --><p>Fine text here.</p>`)).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c(`<script>var a="${LQ} b ${RQ}";</script><style>.a::before{content:"${LQ} b ${RQ}"}</style><template><p>${LQ} b ${RQ}</p></template><textarea>${LQ} b ${RQ}</textarea><noscript>said${LQ}no${RQ}then</noscript>`)).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c(`<pre>${LQ} a ${RQ}</pre><code>said${LQ}no</code><kbd>${LQ} a</kbd><samp>a ${RQ}</samp>`)).toEqual(none); });
  it('text in an svg passes', () => { expect(c(`<svg><title>${LQ} a ${RQ}</title><text>said${LQ}no</text></svg>`)).toEqual(none); });
  it('options of a select pass', () => { expect(c(`<select><option>${LQ} a ${RQ}</option></select>`)).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c(`<p title="${LQ} a ${RQ}" data-x="said${LQ}no">Fine text.</p><img alt="${LQ} a ${RQ}" src="/a.png">`)).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', `<title>Ok</title><meta name="description" content="${LQ} a ${RQ} said${LQ}no${RQ}then">`)).toEqual(none); });
  it('a br inside a quote passes', () => { expect(c(`<p>He said ${LQ}first line<br>second line${RQ} and left.</p>`)).toEqual(none); });
  it('a possessive of the word after a closing quote with one letter passes', () => { expect(c(`<p>The ${LQ}mom${RQ}s are here.</p>`)).toEqual(none); });
  it('a page with no Latin letters passes the third kind', () => { expect(c(`<p>\u0986\u099c ${LQ}\u0995\u09c7\u09b0${RQ}\u0996\u09ac\u09b0</p>`)).toEqual(none); });
  it('a page in another language is not read', () => { expect(checkQuoteSpacing(page(`<p>Han sa${LQ}ja${RQ}sedan ${LQ} nej ${RQ}.</p>`, '<title>Ok</title>', 'sv'))).toEqual(none); });
  it('a page in another language with a region is not read', () => { expect(checkQuoteSpacing(page(`<p>Er sagte${LQ}ja${RQ}dann.</p>`, '<title>Ok</title>', 'de-AT'))).toEqual(none); });
  it('a page in English with a region is read', () => { expect(checkQuoteSpacing(page(`<p>He said${LQ}no${RQ}.</p>`, '<title>Ok</title>', 'en-US')).warnings).toHaveLength(1); });
  it('a page with no lang is read', () => { expect(checkQuoteSpacing(page(`<p>He said${LQ}no${RQ}.</p>`, '<title>Ok</title>', '')).warnings).toHaveLength(1); });
  it('the case of the lang is not read', () => { expect(checkQuoteSpacing(page(`<p>He said${LQ}no${RQ}.</p>`, '<title>Ok</title>', 'EN')).warnings).toHaveLength(1); });
});

describe('checkQuoteSpacing: warnings', () => {
  it('a space after an opening quote', () => {
    const r = c(`<p>He said ${LQ} no${RQ} and left.</p>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a space just inside a curly double quote/);
  });
  it('a space before a closing quote', () => { expect(c(`<p>He said ${LQ}no ${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has a space just inside a curly double quote/); });
  it('a space before a closing quote after a mark', () => { expect(c(`<p>He said ${LQ}no. ${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a space inside on both sides counts two', () => { expect(c(`<p>He said ${LQ} no ${RQ} and left.</p>`).warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('a digit inside counts', () => { expect(c(`<p>He said ${LQ} 5 ${RQ} and left.</p>`).warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('a space inside across an inline tag', () => { expect(c(`<p>He said ${LQ} <b>no</b>${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a space inside in a heading', () => { expect(c(`<h1>Council ${LQ} live ${RQ}</h1>`).warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('a space inside in the title', () => { expect(c('<p>Fine.</p>', `<title>The vote ${LQ} live${RQ}</title>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a new line inside a quote counts', () => { expect(c(`<p>He said ${LQ}\nno${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('no space before an opening quote', () => {
    const r = c(`<p>He said${LQ}no${RQ} and left.</p>`);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has no space before an opening curly double quote/);
  });
  it('no space before an opening quote across an inline tag', () => { expect(c(`<p>He <b>said</b>${LQ}no${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has no space before an opening curly double quote/); });
  it('two places of a missing space before give a count of two', () => { expect(c(`<p>One said${LQ}no${RQ} and two wrote${LQ}yes${RQ}.</p>`).warnings[0]).toMatch(/^2 places have no space before an opening curly double quote/); });
  it('no space after a closing quote', () => {
    const r = c(`<p>He said ${LQ}no${RQ}then left.</p>`);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has no space after a closing curly double quote/);
  });
  it('no space after a closing quote across an inline tag', () => { expect(c(`<p>He said ${LQ}no${RQ}<b>then</b> left.</p>`).warnings[0]).toMatch(/^1 place has no space after a closing curly double quote/); });
  it('the three kinds give three messages, in order', () => {
    const r = c(`<p>A ${LQ} b ${RQ} and said${LQ}no${RQ} and ${LQ}no${RQ}then</p>`);
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/space just inside/);
    expect(r.warnings[1]).toMatch(/no space before/);
    expect(r.warnings[2]).toMatch(/no space after/);
  });
  it('a slip written with references is counted', () => { expect(c('<p>A &ldquo; word&rdquo; and &ldquo;word &rdquo; ended.</p>').warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('errors stay empty for every fault', () => { expect(c(`<p>A ${LQ} b ${RQ} said${LQ}no${RQ}then</p>`).errors).toEqual([]); });
  it('a tag with a > inside an attribute does not break the read', () => { expect(c(`<p class="a > b" title="x">He said ${LQ} no${RQ}</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('the case of the tag names is not read', () => { expect(c(`<P>He said ${LQ} no${RQ}</P><SCRIPT>a ${LQ} b ${RQ}</SCRIPT>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a page with no html tag still counts its text', () => { expect(checkQuoteSpacing(`<p>He said ${LQ} no${RQ}</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('after a skipped block the text is still read', () => { expect(c(`<pre>a ${LQ} b</pre><p>He said ${LQ} no${RQ}</p>`).warnings[0]).toMatch(/^1 place has a space just inside/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'qs-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with clean quotes passes with no message about quote gaps', () => {
    const r = run(FULL(`<p>He said ${LQ}no${RQ}, then ${LQ}yes${RQ}.</p>`));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/space just inside a curly|no space before an opening curly|no space after a closing curly/);
  });
  it('a space inside a quote is a warning, not an error, and names the page', () => {
    const r = run(FULL(`<p>He said ${LQ} no${RQ} and left.</p>`));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a space just inside a curly double quote/);
  });
  it('no space before a quote is a warning, not an error', () => {
    const r = run(FULL(`<p>He said${LQ}no${RQ} and left.</p>`));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*no space before an opening curly double quote/);
  });
});
