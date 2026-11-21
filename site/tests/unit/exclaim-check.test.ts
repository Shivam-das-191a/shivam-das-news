import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkExclaimRuns } from '../../scripts/exclaim-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkExclaimRuns(page(body, head));
const one = /^1 place has a pile of exclamation or question marks/;

describe('checkExclaimRuns: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>Is it true? Yes! Really? Yes.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkExclaimRuns(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkExclaimRuns('')).toEqual(none); });
  it('one mark passes', () => { expect(c('<p>Wow! Why? Fine.</p>')).toEqual(none); });
  it('the pair question then exclamation passes', () => { expect(c('<p>What?! Really.</p>')).toEqual(none); });
  it('the pair exclamation then question passes', () => { expect(c('<p>What!? Really.</p>')).toEqual(none); });
  it('a mark, a space and another mark pass', () => { expect(c('<p>Why? ? Because! !</p>')).toEqual(none); });
  it('marks in two words pass', () => { expect(c('<p>Wow! Wow? Wow!</p>')).toEqual(none); });
  it('a mark at the end of one paragraph and the start of the next pass', () => { expect(c('<p>Wow!</p><p>!Fine</p>')).toEqual(none); });
  it('a mark at the end of one list item and the start of the next pass', () => { expect(c('<ul><li>Wow?</li><li>?Fine</li></ul>')).toEqual(none); });
  it('table cells pass', () => { expect(c('<table><tr><td>Wow!</td><td>!Fine</td></tr></table>')).toEqual(none); });
  it('a line break passes', () => { expect(c('<p>Wow!<br>!Fine</p>')).toEqual(none); });
  it('a character reference between two marks passes', () => { expect(c('<p>Wow!&nbsp;!Fine and Wow?&mdash;?Fine</p>')).toEqual(none); });
  it('a real non breaking space between two marks passes', () => { expect(c('<p>Wow!\u00a0!Fine</p>')).toEqual(none); });
  it('a pile in the title is left to the title check', () => { expect(c('<p>Fine text.</p>', '<title>Wow!!!</title>')).toEqual(none); });
  it('a pile in a heading is left to the heading check', () => { expect(c('<h1>Wow!!</h1><h2>Why???</h2><h3>What?!?!</h3><p>Fine.</p>')).toEqual(none); });
  it('a pile in a heading with attributes is left to the heading check', () => { expect(c('<h2 id="a" class="b">Why???</h2><p>Fine.</p>')).toEqual(none); });
  it('a web address with marks passes', () => { expect(c('<p>See https://example.com/a?x=1?? and www.example.com/a?? here.</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- Wow!! --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="Wow!!";</script><style>.a{content:"??"}</style><template><p>Wow!!</p></template><textarea>Wow!!</textarea><noscript>Wow!!</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>Wow!!</pre><code>a!!b</code><kbd>!!</kbd><samp>??</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>Wow!!</title><text>Wow??</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>Wow!!</option></select>')).toEqual(none); });
  it('an attribute that holds a pile passes', () => { expect(c('<p title="Wow!!" data-x="???">Fine text.</p><img alt="Wow!!" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="Wow!! Really???">')).toEqual(none); });
  it('three dots and a mark pass', () => { expect(c('<p>Wait... what? Really...! Fine.</p>')).toEqual(none); });
  it('full width marks of other scripts pass', () => { expect(c('<p>\uff01\uff01 and \uff1f\uff1f</p>')).toEqual(none); });
  it('commas, dots and colons are not read', () => { expect(c('<p>Well,, fine.. then:: done</p>')).toEqual(none); });
  it('a heading followed by a paragraph passes', () => { expect(c('<h2>Why?</h2><p>?Because.</p>')).toEqual(none); });
  it('a mark in a paragraph before a skipped block passes', () => { expect(c('<p>Wow!<code>!</code></p>')).toEqual(none); });
});

describe('checkExclaimRuns: warnings', () => {
  it('two exclamation marks', () => { expect(c('<p>Wow!! That was fast.</p>').warnings[0]).toMatch(one); });
  it('two question marks', () => { expect(c('<p>Really?? I did not know.</p>').warnings[0]).toMatch(one); });
  it('three exclamation marks', () => { expect(c('<p>Wow!!! Nice.</p>').warnings[0]).toMatch(one); });
  it('three question marks', () => { expect(c('<p>Really??? Nice.</p>').warnings[0]).toMatch(one); });
  it('a pair repeated', () => { expect(c('<p>What?!?! No way.</p>').warnings[0]).toMatch(one); });
  it('three mixed marks', () => { expect(c('<p>What?!? No way.</p>').warnings[0]).toMatch(one); });
  it('three mixed marks the other way', () => { expect(c('<p>What!?! No way.</p>').warnings[0]).toMatch(one); });
  it('a long run is one place', () => { expect(c('<p>Wow!!!!!!!!!! Nice.</p>').warnings[0]).toMatch(one); });
  it('the first run is shown', () => { expect(c('<p>Wow!!! Nice. Really??</p>').warnings[0]).toMatch(/\(first: "!!!"\)/); });
  it('the shown run can be question marks', () => { expect(c('<p>Really??? Nice.</p>').warnings[0]).toMatch(/\(first: "\?\?\?"\)/); });
  it('the message asks for one mark', () => { expect(c('<p>Wow!!</p>').warnings[0]).toMatch(/use one mark$/); });
  it('a run in the middle of a sentence', () => { expect(c('<p>He said wow!! and left.</p>').warnings[0]).toMatch(one); });
  it('a run before a closing quote', () => { expect(c('<p>He said \u201cwow!!\u201d and left.</p>').warnings[0]).toMatch(one); });
  it('a run before a closing bracket', () => { expect(c('<p>It was fast (wow!!) and cheap.</p>').warnings[0]).toMatch(one); });
  it('a run at the end of a paragraph', () => { expect(c('<p>Nice work!!</p>').warnings[0]).toMatch(one); });
  it('a run at the start of a paragraph', () => { expect(c('<p>??? Who knows.</p>').warnings[0]).toMatch(one); });
  it('an inline tag leaves no gap', () => { expect(c('<p>Wow!<b>!</b> Nice.</p>').warnings[0]).toMatch(one); });
  it('an inline tag around the whole run', () => { expect(c('<p>Wow<strong>!!</strong> Nice.</p>').warnings[0]).toMatch(one); });
  it('a run in a list item', () => { expect(c('<ul><li>Wow!!</li></ul>').warnings[0]).toMatch(one); });
  it('a run in a table cell', () => { expect(c('<table><tr><td>Wow??</td></tr></table>').warnings[0]).toMatch(one); });
  it('a run in a block quote', () => { expect(c('<blockquote>Wow!!</blockquote>').warnings[0]).toMatch(one); });
  it('a run in a figure caption', () => { expect(c('<figure><figcaption>Wow!!</figcaption></figure>').warnings[0]).toMatch(one); });
  it('a run in a heading of level four', () => { expect(c('<h4>Wow!!</h4>').warnings[0]).toMatch(one); });
  it('a run after a skipped block is still found', () => { expect(c('<code>x</code><p>Wow!! Nice.</p>').warnings[0]).toMatch(one); });
  it('a run after a heading is still found', () => { expect(c('<h1>Fine</h1><p>Wow!! Nice.</p>').warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkExclaimRuns(page('<p>Vad bra!! Sedan kom hon.</p>', '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkExclaimRuns(page('<p>Wow!! Nice.</p>', '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('a run next to text in another script is read', () => { expect(c('<p>\u4eca\u65e5!! \u660e\u65e5</p>').warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c('<p>Wow!! Nice.</p>').warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c('<p>Wow!! Really??? What?!?! Nice.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^3 places have a pile of exclamation or question marks/);
  });
  it('places in two paragraphs are added', () => { expect(c('<p>Wow!!</p><p>Really??</p>').warnings[0]).toMatch(/^2 places have /); });
  it('two runs in one word are two places', () => { expect(c('<p>Wow!!and?? Nice.</p>').warnings[0]).toMatch(/^2 places have /); });
  it('a bad place mixed with good ones is counted once', () => { expect(c('<p>See https://a.com/x?? Why?! Fine. Wow!! Nice? Yes!</p>').warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c('<p>Wow!! Really???</p>').errors).toEqual([]); });
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
  it('a page with single marks passes with no message about piles of marks', () => {
    const r = run(FULL('<p>Is it true? Yes! What?! Fine.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/pile of exclamation or question marks/);
  });
  it('a pile of marks is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>Wow!! That was fast.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a pile of exclamation or question marks/);
  });
  it('two piles are counted in one message', () => {
    const r = run(FULL('<p>Wow!! Really???</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have a pile of exclamation or question marks/);
  });
});
