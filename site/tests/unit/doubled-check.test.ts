import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkDoubledWords } from '../../scripts/doubled-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkDoubledWords(page(body, head));

describe('checkDoubledWords: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council voted on the new budget on Monday.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkDoubledWords(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkDoubledWords('')).toEqual(none); });
  it('"had had" passes', () => { expect(c('<p>She had had enough of it.</p>')).toEqual(none); });
  it('"that that" passes', () => { expect(c('<p>He said that that was fine.</p>')).toEqual(none); });
  it('"Had had" with a capital passes', () => { expect(c('<p>Had had been the word.</p>')).toEqual(none); });
  it('a comma between the words passes', () => { expect(c('<p>No, no, it is fine and the, the story ends.</p>')).toEqual(none); });
  it('a full stop after the first word passes', () => { expect(c('<p>I said no. No more.</p>')).toEqual(none); });
  it('a question mark after the first word passes', () => { expect(c('<p>Is it true? True or not, we wait.</p>')).toEqual(none); });
  it('words of one or two letters pass', () => { expect(c('<p>It is is a test and we go to to the shop.</p>')).toEqual(none); });
  it('words with digits pass', () => { expect(c('<p>Room 101 101 and A1 A1 and 2026 2026.</p>')).toEqual(none); });
  it('a word with an apostrophe inside passes', () => { expect(c('<p>The don\'t don\'t list.</p>')).toEqual(none); });
  it('a hyphen word passes', () => { expect(c('<p>A so-so so-so result.</p>')).toEqual(none); });
  it('two neighbouring list items with the same word pass', () => { expect(c('<ul><li>News</li><li>News</li></ul>')).toEqual(none); });
  it('two neighbouring paragraphs pass', () => { expect(c('<p>Read the</p><p>the rest</p>')).toEqual(none); });
  it('a heading and the paragraph under it pass', () => { expect(c('<h2>Budget</h2><p>Budget talks start today.</p>')).toEqual(none); });
  it('a line break between the words passes', () => { expect(c('<p>first line the<br>the second line</p>')).toEqual(none); });
  it('two table cells pass', () => { expect(c('<table><tr><td>Total</td><td>Total</td></tr></table>')).toEqual(none); });
  it('two buttons pass', () => { expect(c('<button>Share</button><button>Share</button>')).toEqual(none); });
  it('a dash between the words passes', () => { expect(c('<p>very &mdash; very good indeed</p>')).toEqual(none); });
  it('a curly quote reference between the words passes', () => { expect(c('<p>the &rsquo; the end</p>')).toEqual(none); });
  it('a numeric reference between the words passes', () => { expect(c('<p>the &#8212; the end</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- the the --><p>Fine text here.</p>')).toEqual(none); });
  it('text in the head passes', () => { expect(c('<p>Fine.</p>', '<title>the the story</title><meta name="description" content="the the">')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="the the";</script><style>.a{}</style><template><p>the the</p></template><textarea>the the</textarea><noscript>the the</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>the the</pre><code>and and</code><kbd>ctrl ctrl</kbd><samp>ok ok ok</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>the the</title><text>the the</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>Any Any</option></select>')).toEqual(none); });
  it('a tag called pre-box or code-box is not skipped', () => { expect(c('<pre-box>the</pre-box><p>fine</p>')).toEqual(none); });
  it('an attribute that holds a doubled word passes', () => { expect(c('<p title="the the" data-x="and and">Fine text.</p><img alt="the the" src="/a.png">')).toEqual(none); });
  it('a page with no Latin letters passes', () => { expect(c('<p>\u0986\u099c \u0986\u099c \u0996\u09ac\u09b0 \u0996\u09ac\u09b0</p>')).toEqual(none); });
  it('words split by an inline tag with a break entity pass', () => { expect(c('<p>the<b>&mdash;</b>the end</p>')).toEqual(none); });
  it('two different words pass', () => { expect(c('<p>the then and an other</p>')).toEqual(none); });
  it('a word inside a longer word passes', () => { expect(c('<p>the them then there</p>')).toEqual(none); });
});

describe('checkDoubledWords: warnings', () => {
  it('"the the" in a paragraph', () => {
    const r = c('<p>The council voted on the the new budget.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place repeats the same word twice in a row \(first: "the the"\)/);
  });
  it('"and and"', () => { expect(c('<p>Rain and and wind</p>').warnings[0]).toMatch(/first: "and and"/); });
  it('a capital first word is read and shown as typed', () => { expect(c('<p>The the council</p>').warnings[0]).toMatch(/first: "The the"/); });
  it('a different case counts', () => { expect(c('<p>big BIG news</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('in a heading', () => { expect(c('<h2>Budget budget talks</h2>').warnings[0]).toMatch(/first: "Budget budget"/); });
  it('a 2 letter word in a list item is still not counted', () => { expect(c('<ul><li>this is is wrong</li></ul>').warnings).toEqual([]); });
  it('in a list item with a 3 letter word', () => { expect(c('<ul><li>see the the list</li></ul>').warnings[0]).toMatch(/^1 place repeats/); });
  it('in a quote', () => { expect(c('<blockquote>He said the the thing</blockquote>').warnings[0]).toMatch(/^1 place repeats/); });
  it('in a figure caption', () => { expect(c('<figure><img src="/a.png" alt="x"><figcaption>The the crowd</figcaption></figure>').warnings[0]).toMatch(/^1 place repeats/); });
  it('in a link', () => { expect(c('<p><a href="/x">read read more</a></p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with a full stop after the second word', () => { expect(c('<p>It ended with the the.</p>').warnings[0]).toMatch(/first: "the the"/); });
  it('with a comma after the second word', () => { expect(c('<p>Then the the, as said.</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with a question mark after the second word', () => { expect(c('<p>Is it the the?</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with quotes around the words', () => { expect(c('<p>He said "the the" twice.</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with curly quotes around the words', () => { expect(c('<p>He said \u201cthe the\u201d twice.</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('across an inline tag', () => { expect(c('<p>so <b>the</b> the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('across two inline tags', () => { expect(c('<p>so <em>the</em> <strong>the</strong> end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('across a line break in the source', () => { expect(c('<p>so the\n   the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with a non breaking space between', () => { expect(c('<p>so the&nbsp;the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('with a numeric non breaking space between', () => { expect(c('<p>so the&#160;the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('three in a row are one place', () => {
    const r = c('<p>go and and and stop</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place repeats/);
  });
  it('two places give a count of two', () => {
    const r = c('<p>The the first.</p><p>And the second one is is the the.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^2 places repeat/);
    expect(r.warnings[0]).toMatch(/first: "The the"/);
  });
  it('the first place is the one shown', () => { expect(c('<p>See see this. Then the the.</p>').warnings[0]).toMatch(/first: "See see"/); });
  it('a tag with attributes holding > does not break the read', () => { expect(c('<p class="a > b" title="x">so the the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('the case of the tag names is not read', () => { expect(c('<P>So the the end</P><SCRIPT>a a a</SCRIPT>').warnings[0]).toMatch(/^1 place repeats/); });
  it('only the body is read, a page with no body tag still counts its text', () => { expect(checkDoubledWords('<p>so the the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
  it('after a skipped block the text is still read', () => { expect(c('<pre>x x</pre><p>so the the end</p>').warnings[0]).toMatch(/^1 place repeats/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'db-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with normal text passes with no message about a repeated word', () => {
    const r = run(FULL('<p>The council voted on the new budget.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/same word twice/);
  });
  it('a repeated word is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>The council voted on the the new budget.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place repeats the same word twice in a row \(first: "the the"\)/);
  });
  it('had had in the text is not a warning', () => {
    const r = run(FULL('<p>She had had enough.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/same word twice/);
  });
});
