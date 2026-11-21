import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkAllCapsRuns } from '../../scripts/allcaps-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkAllCapsRuns(page(body, head));
const one = /^1 place has a run of 10 or more words in capital letters/;
const R11 = 'BREAKING NEWS THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE';
const R10 = 'THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE';
const R9 = 'THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD';

describe('checkAllCapsRuns: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council met on Monday. NASA and the FBI agreed.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkAllCapsRuns(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkAllCapsRuns('')).toEqual(none); });
  it('a run of 9 words passes', () => { expect(c(`<p>${R9}</p>`)).toEqual(none); });
  it('a run of 9 words with a full stop passes', () => { expect(c(`<p>${R9}.</p>`)).toEqual(none); });
  it('a short run passes', () => { expect(c('<p>BREAKING NEWS today.</p>')).toEqual(none); });
  it('a name in capitals passes', () => { expect(c('<p>UNITED STATES OF AMERICA and the UNITED NATIONS SECURITY COUNCIL.</p>')).toEqual(none); });
  it('a long run of one letter words passes', () => { expect(c('<p>A I A I A I A I A I A I A I</p>')).toEqual(none); });
  it('a run with only four long words and many one letter words passes', () => { expect(c('<p>UNITED STATES OF AMERICA A I A I A I A I A I A I</p>')).toEqual(none); });
  it('a small letter word splits a run', () => { expect(c(`<p>${R9} and ${R9}</p>`)).toEqual(none); });
  it('a word with a dot inside ends the run', () => { expect(c('<p>THE U.S. COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE TODAY</p>')).toEqual(none); });
  it('a word with a digit ends the run', () => { expect(c('<p>THE COVID-19 COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE TODAY</p>')).toEqual(none); });
  it('a word with an apostrophe ends the run', () => { expect(c("<p>THE CITY COUNCIL HAS VOTED TO CLOSE THE DON'T OLD BRIDGE TODAY</p>")).toEqual(none); });
  it('a word with a small letter ends the run', () => { expect(c('<p>THE CITY COUNCIL HAS VOTED TO CLOSE THE iPhone OLD BRIDGE TODAY</p>')).toEqual(none); });
  it('a mixed case word ends the run', () => { expect(c('<p>THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD Bridge TODAY</p>')).toEqual(none); });
  it('two paragraphs split a run', () => { expect(c(`<p>${R9}</p><p>${R9}</p>`)).toEqual(none); });
  it('a line break splits a run', () => { expect(c(`<p>${R9}<br>${R9}</p>`)).toEqual(none); });
  it('two list items split a run', () => { expect(c(`<ul><li>${R9}</li><li>${R9}</li></ul>`)).toEqual(none); });
  it('table cells split a run', () => { expect(c(`<table><tr><td>${R9}</td><td>${R9}</td></tr></table>`)).toEqual(none); });
  it('a character reference splits a run', () => { expect(c(`<p>${R9}&mdash;${R9}</p>`)).toEqual(none); });
  it('a long run in the title is left to the title check', () => { expect(c('<p>Fine text.</p>', `<title>${R11}</title>`)).toEqual(none); });
  it('a long run in a heading is left to the heading check', () => { expect(c(`<h1>${R11}</h1><h2>${R11}</h2><h3>${R11}</h3><p>Fine.</p>`)).toEqual(none); });
  it('a long run in a heading with attributes is left to the heading check', () => { expect(c(`<h2 id="a" class="b">${R11}</h2><p>Fine.</p>`)).toEqual(none); });
  it('text in a comment passes', () => { expect(c(`<!-- ${R11} --><p>Fine text here.</p>`)).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c(`<script>var a="${R11}";</script><style>.a:before{content:"${R11}"}</style><template><p>${R11}</p></template><textarea>${R11}</textarea><noscript>${R11}</noscript>`)).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c(`<pre>${R11}</pre><code>${R11}</code><kbd>${R11}</kbd><samp>${R11}</samp>`)).toEqual(none); });
  it('text in an svg passes', () => { expect(c(`<svg><title>${R11}</title><text>${R11}</text></svg>`)).toEqual(none); });
  it('options of a select pass', () => { expect(c(`<select><option>${R11}</option></select>`)).toEqual(none); });
  it('an attribute that holds a run passes', () => { expect(c(`<p title="${R11}" data-x="${R11}">Fine text.</p><img alt="${R11}" src="/a.png">`)).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', `<title>Ok</title><meta name="description" content="${R11}">`)).toEqual(none); });
  it('text in another script passes', () => { expect(c('<p>\u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413 \u0410\u0411\u0412\u0413</p>')).toEqual(none); });
  it('words with accents end the run', () => { expect(c('<p>THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD CAF\u00c9 TODAY</p>')).toEqual(none); });
  it('a hyphen joined word ends the run', () => { expect(c('<p>THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE-SIDE TODAY</p>')).toEqual(none); });
  it('a long number run passes', () => { expect(c('<p>1 2 3 4 5 6 7 8 9 10 11 12</p>')).toEqual(none); });
});

describe('checkAllCapsRuns: warnings', () => {
  it('a run of 10 words', () => { expect(c(`<p>${R10}</p>`).warnings[0]).toMatch(one); });
  it('a run of 11 words', () => { expect(c(`<p>${R11}</p>`).warnings[0]).toMatch(one); });
  it('a long run is one place', () => { expect(c(`<p>${R11} ${R11} ${R11}</p>`).warnings[0]).toMatch(one); });
  it('the first four words are shown', () => { expect(c(`<p>${R11}</p>`).warnings[0]).toMatch(/\(first: "BREAKING NEWS THE CITY \.\.\."\)/); });
  it('the message asks for normal letters', () => { expect(c(`<p>${R11}</p>`).warnings[0]).toMatch(/write it in normal letters$/); });
  it('a run with a full stop at the end', () => { expect(c(`<p>${R10}.</p>`).warnings[0]).toMatch(one); });
  it('a run with commas between the words', () => { expect(c('<p>THE, CITY, COUNCIL, HAS, VOTED, TO, CLOSE, THE, OLD, BRIDGE</p>').warnings[0]).toMatch(one); });
  it('a run inside quotes', () => { expect(c(`<p>He said \u201c${R10}\u201d and left.</p>`).warnings[0]).toMatch(one); });
  it('a run inside brackets', () => { expect(c(`<p>Text (${R10}) more text.</p>`).warnings[0]).toMatch(one); });
  it('a run with one letter words inside', () => { expect(c('<p>THIS IS A VERY BIG STORY AND I THINK IT MATTERS TO ALL</p>').warnings[0]).toMatch(one); });
  it('a run after normal text', () => { expect(c(`<p>The notice said ${R10}</p>`).warnings[0]).toMatch(one); });
  it('a run before normal text', () => { expect(c(`<p>${R10} was the notice.</p>`).warnings[0]).toMatch(one); });
  it('a run split by an inline tag with a space is read', () => { expect(c('<p>THE CITY COUNCIL <b>HAS VOTED</b> TO CLOSE THE OLD BRIDGE</p>').warnings[0]).toMatch(one); });
  it('a run in a list item', () => { expect(c(`<ul><li>${R10}</li></ul>`).warnings[0]).toMatch(one); });
  it('a run in a table cell', () => { expect(c(`<table><tr><td>${R10}</td></tr></table>`).warnings[0]).toMatch(one); });
  it('a run in a block quote', () => { expect(c(`<blockquote>${R10}</blockquote>`).warnings[0]).toMatch(one); });
  it('a run in a figure caption', () => { expect(c(`<figure><figcaption>${R10}</figcaption></figure>`).warnings[0]).toMatch(one); });
  it('a run in a heading of level four', () => { expect(c(`<h4>${R10}</h4>`).warnings[0]).toMatch(one); });
  it('a run split by a non breaking space is read', () => { expect(c('<p>THE&nbsp;CITY&nbsp;COUNCIL&nbsp;HAS&nbsp;VOTED&nbsp;TO&nbsp;CLOSE&nbsp;THE&nbsp;OLD&nbsp;BRIDGE</p>').warnings[0]).toMatch(one); });
  it('a run on several lines is read', () => { expect(c('<p>THE CITY COUNCIL HAS\nVOTED TO CLOSE\nTHE OLD BRIDGE</p>').warnings[0]).toMatch(one); });
  it('a run after a skipped block is still found', () => { expect(c(`<code>x</code><p>${R10}</p>`).warnings[0]).toMatch(one); });
  it('a run after a heading is still found', () => { expect(c(`<h1>Fine</h1><p>${R10}</p>`).warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkAllCapsRuns(page(`<p>${R10}</p>`, '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkAllCapsRuns(page(`<p>${R10}</p>`, '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c(`<p>${R10}</p>`).warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c(`<p>${R10}</p><p>${R11}</p><p>${R10} and text and ${R10}</p>`);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^4 places have a run of 10 or more words in capital letters/);
  });
  it('places in two paragraphs are added', () => { expect(c(`<p>${R10}</p><p>${R10}</p>`).warnings[0]).toMatch(/^2 places have /); });
  it('a bad place mixed with good ones is counted once', () => { expect(c(`<p>The NASA team. ${R9}. Then ${R10}. UNITED STATES OF AMERICA.</p>`).warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c(`<p>${R11}</p>`).errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with a short run of capitals passes with no message about capital runs', () => {
    const r = run(FULL('<p>BREAKING NEWS from NASA and the FBI today.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/words in capital letters/);
  });
  it('a long run of capitals is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>BREAKING NEWS THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a run of 10 or more words in capital letters/);
  });
  it('two long runs are counted in one message', () => {
    const r = run(FULL('<p>BREAKING NEWS THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE</p><p>BREAKING NEWS THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have a run of 10 or more words in capital letters/);
  });
});
