import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkPunctuation } from '../../scripts/punct-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkPunctuation(page(body, head));

describe('checkPunctuation: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council voted, then left. Was it fair? Yes: it was; and so on!</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkPunctuation(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkPunctuation('')).toEqual(none); });
  it('an ellipsis of three dots passes', () => { expect(c('<p>Wait... what</p>')).toEqual(none); });
  it('an ellipsis with a space before passes', () => { expect(c('<p>Wait ... what</p>')).toEqual(none); });
  it('an ellipsis with spaces between the dots passes', () => { expect(c('<p>Wait. . . what</p>')).toEqual(none); });
  it('a number with a comma passes', () => { expect(c('<p>It cost 1,000 dollars and 3,5 percent.</p>')).toEqual(none); });
  it('a time passes', () => { expect(c('<p>Doors open at 5:30 pm.</p>')).toEqual(none); });
  it('a web address and abbreviations pass', () => { expect(c('<p>See example.com, e.g. the U.S. page, and www.site.org/a.html.</p>')).toEqual(none); });
  it('a comma between a word and a digit passes', () => { expect(c('<p>Rooms a1,b2 and in room 5,room 6.</p>')).toEqual(none); });
  it('a comma between single letters passes', () => { expect(c('<p>Options a,b,c apply.</p>')).toEqual(none); });
  it('a smiley and a ?! pair pass', () => { expect(c('<p>Great :) Really?! Yes (really).</p>')).toEqual(none); });
  it('a space before a mark followed by another mark passes', () => { expect(c('<p>Wait :) ok ?! yes</p>')).toEqual(none); });
  it('a space before a colon written as a non breaking space passes', () => { expect(c('<p>Note&nbsp;: fine and Quoi&#160;? yes&#xa0;!</p>')).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c('<p>Note\u00a0: fine</p>')).toEqual(none); });
  it('a mark after an inline tag with no gap passes', () => { expect(c('<p><b>word</b>, next and <a href="/x">link</a>. Then <em>this</em>?</p>')).toEqual(none); });
  it('a mark at the start of the next paragraph is not joined to the last one', () => { expect(c('<p>Done</p><p>, odd start</p>')).toEqual(none); });
  it('a mark at the start of the next list item is not joined', () => { expect(c('<ul><li>One</li><li>, two</li></ul>')).toEqual(none); });
  it('a break between a word and a mark is not joined', () => { expect(c('<p>word<br>, next</p>')).toEqual(none); });
  it('two table cells pass', () => { expect(c('<table><tr><td>A</td><td>, B</td></tr></table>')).toEqual(none); });
  it('a comma after a word that follows a character reference passes', () => { expect(c('<p>Tom &amp; Jerry, fine</p>')).toEqual(none); });
  it('a mark right after a reference passes', () => { expect(c('<p>caf&eacute;, tea &amp; cake.</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- a , b ,, c.. --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="x , y,,z";</script><style>.a{margin:0 , 1px}</style><template><p>a , b</p></template><textarea>a , b</textarea><noscript>a ,, b</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>a , b</pre><code>x,,y</code><kbd>a ,b</kbd><samp>a..b</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>a , b</title><text>x,,y</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>a , b</option></select>')).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c('<p title="a , b" data-x="x,,y">Fine text.</p><img alt="a , b" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="a , b ,, c">')).toEqual(none); });
  it('a page with no Latin letters passes the third kind', () => { expect(c('<p>\u0986\u099c,\u0995\u09c7\u09b0 \u0996\u09ac\u09b0,\u09b8\u09ac</p>')).toEqual(none); });
  it('a hyphen and a dash pass', () => { expect(c('<p>A so-so result &mdash; and a long \u2014 one.</p>')).toEqual(none); });
  it('a single dot and a single comma pass', () => { expect(c('<p>One. Two, three.</p>')).toEqual(none); });
  it('a colon list passes', () => { expect(c('<p>Ingredients: eggs, milk; sugar.</p>')).toEqual(none); });
  it('a mark after a quote with no gap passes', () => { expect(c('<p>He said \u201cno\u201d, then left.</p>')).toEqual(none); });
});

describe('checkPunctuation: warnings', () => {
  it('a space before a comma', () => {
    const r = c('<p>The vote , which ended late.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a space before a comma, full stop, semicolon, colon, ! or \?/);
  });
  it('a space before a full stop', () => { expect(c('<p>The vote ended late .</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('a space before a semicolon', () => { expect(c('<p>One thing ; another</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('a space before a colon', () => { expect(c('<p>Note : fine</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('a space before an exclamation mark', () => { expect(c('<p>Stop !</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('a space before a question mark', () => { expect(c('<p>Why now ?</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after a digit', () => { expect(c('<p>In 2026 .</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after a closing bracket', () => { expect(c('<p>(yes) .</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after a closing quote', () => { expect(c('<p>He said "no" ?</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after a curly closing quote', () => { expect(c('<p>He said \u201cno\u201d ,</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('at the end of the text', () => { expect(checkPunctuation('<p>Why now ?').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after an inline tag', () => { expect(c('<p><b>word</b> , next</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('with a line break in the source', () => { expect(c('<p>The vote\n   , which</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('in a heading and in the title', () => { expect(c('<h2>Why now ?</h2>', '<title>Why now ?</title>').warnings[0]).toMatch(/^2 places have a space before/); });
  it('in a link', () => { expect(c('<a href="/x">read more</a> ,').warnings[0]).toMatch(/^1 place has a space before/); });
  it('two places give a count of two', () => { expect(c('<p>A , b</p><p>C ; d</p>').warnings[0]).toMatch(/^2 places have a space before/); });
  it('two commas in a row', () => {
    const r = c('<p>The vote,, which ended late.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has repeated punctuation/);
  });
  it('three commas are one place', () => { expect(c('<p>a,,, b</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('two semicolons', () => { expect(c('<p>a;; b</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('two colons', () => { expect(c('<p>a:: b</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('two dots', () => { expect(c('<p>The end.. Next</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('four dots', () => { expect(c('<p>The end.... Next</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('six dots are one place', () => { expect(c('<p>The end...... Next</p>').warnings[0]).toMatch(/^1 place has repeated/); });
  it('two places of repeated marks give a count of two', () => { expect(c('<p>a,, b and c..</p>').warnings[0]).toMatch(/^2 places have repeated/); });
  it('no space after a comma', () => {
    const r = c('<p>He said,then left.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has no space after a comma or semicolon/);
  });
  it('no space after a semicolon', () => { expect(c('<p>One thing;another thing</p>').warnings[0]).toMatch(/^1 place has no space after/); });
  it('no space after a comma across an inline tag', () => { expect(c('<p><b>said</b>,<i>then</i> left</p>').warnings[0]).toMatch(/^1 place has no space after/); });
  it('two places of a missing space give a count of two', () => { expect(c('<p>a ok,fine and so;then</p>').warnings[0]).toMatch(/^2 places have no space after/); });
  it('the three kinds give three messages, in order', () => {
    const r = c('<p>a , b and c,, d and said,then</p>');
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/space before/);
    expect(r.warnings[1]).toMatch(/repeated punctuation/);
    expect(r.warnings[2]).toMatch(/no space after/);
  });
  it('a tag with a > inside an attribute does not break the read', () => { expect(c('<p class="a > b" title="x">The vote , which</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('the case of the tag names is not read', () => { expect(c('<P>The vote , which</P><SCRIPT>a , b</SCRIPT>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('a page with no body tag still counts its text', () => { expect(checkPunctuation('<p>The vote , which</p>').warnings[0]).toMatch(/^1 place has a space before/); });
  it('after a skipped block the text is still read', () => { expect(c('<pre>a , b</pre><p>The vote , which</p>').warnings[0]).toMatch(/^1 place has a space before/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with normal text passes with no message about punctuation', () => {
    const r = run(FULL('<p>The council voted, then left. Was it fair? Yes.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/space before a comma|repeated punctuation|no space after a comma/);
  });
  it('a space before a comma is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>The vote , which ended late.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a space before a comma/);
  });
  it('repeated commas are a warning, not an error', () => {
    const r = run(FULL('<p>The vote,, which ended late.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*repeated punctuation/);
  });
});
