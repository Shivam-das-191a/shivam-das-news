import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkColonSpacing } from '../../scripts/colon-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkColonSpacing(page(body, head));
const one = /^1 place has no space after a colon that is followed at once by a word/;

describe('checkColonSpacing: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>Note: Do not wait. He said: Then she left. Time: 5:30.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkColonSpacing(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkColonSpacing('')).toEqual(none); });
  it('two paragraphs pass', () => { expect(c('<p>Note:</p><p>Do not wait.</p>')).toEqual(none); });
  it('a line break passes', () => { expect(c('<p>Note:<br>Do not wait.</p>')).toEqual(none); });
  it('two list items pass', () => { expect(c('<ul><li>Note:</li><li>Done here.</li></ul>')).toEqual(none); });
  it('table cells pass', () => { expect(c('<table><tr><td>Note:</td><td>Done here.</td></tr></table>')).toEqual(none); });
  it('a term and its description pass', () => { expect(c('<dl><dt>Note:</dt><dd>Done here.</dd></dl>')).toEqual(none); });
  it('a heading followed by a paragraph passes', () => { expect(c('<h2>Why not:</h2><p>Because.</p>')).toEqual(none); });
  it('a non breaking space after the colon passes', () => { expect(c('<p>Note:&nbsp;Do not wait.</p>')).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c('<p>Note:\u00a0Do not wait.</p>')).toEqual(none); });
  it('a character reference after the colon passes', () => { expect(c('<p>Note:&mdash;Do not wait.</p>')).toEqual(none); });
  it('a colon followed by a quote passes', () => { expect(c('<p>He said:\u201cGo.\u201d</p>')).toEqual(none); });
  it('a colon followed by a bracket passes', () => { expect(c('<p>Note:(Do not wait).</p>')).toEqual(none); });
  it('a colon followed by another mark passes', () => { expect(c('<p>Note::Do and Note:-Do and Note:.Do</p>')).toEqual(none); });
  it('a time passes', () => { expect(c('<p>At 5:30 and 10:45 and 12:Noon.</p>')).toEqual(none); });
  it('a ratio and a score pass', () => { expect(c('<p>The score was 3:Two and the ratio 16:Nine.</p>')).toEqual(none); });
  it('a smiley passes', () => { expect(c('<p>Nice :D and :P and :Dog</p>')).toEqual(none); });
  it('the scheme of an address passes', () => { expect(c('<p>See https:Example and http:Example and mailto:Me and tel:Call and ftp:Files.</p>')).toEqual(none); });
  it('the case of a scheme does not matter', () => { expect(c('<p>See HTTPS:Example and Mailto:Me.</p>')).toEqual(none); });
  it('other schemes pass', () => { expect(c('<p>file:Doc data:Blob javascript:Run urn:Isbn geo:Place sms:Text git:Repo ssh:Host sftp:Host ws:Sock wss:Sock irc:Chat news:Group magnet:Link</p>')).toEqual(none); });
  it('a word after a dot passes', () => { expect(c('<p>See host.Name:Then and a.b:Then here.</p>')).toEqual(none); });
  it('a word after a slash, an at sign and an underscore passes', () => { expect(c('<p>See /docs/page:Then and me@host:Then and my_file:Then here.</p>')).toEqual(none); });
  it('a letter alone before the colon passes', () => { expect(c('<p>Q:Why and A:Because and Vitamin B:Rich.</p>')).toEqual(none); });
  it('a word after the colon with one small letter passes', () => { expect(c('<p>Use Node:Js and Note:Ok and Note:Do now.</p>')).toEqual(none); });
  it('a capital word of one or two letters after the colon passes', () => { expect(c('<p>Note:OK and Note:It and Note:TV</p>')).toEqual(none); });
  it('a small letter after the colon passes', () => { expect(c('<p>Note:do and a:b and key:value here.</p>')).toEqual(none); });
  it('a word with accents before the colon passes', () => { expect(c('<p>Un caf\u00e9:Then</p>')).toEqual(none); });
  it('text in another script passes', () => { expect(c('<p>\u0986\u099c:\u0996\u09ac\u09b0 \u4eca\u65e5:\u660e\u65e5</p>')).toEqual(none); });
  it('a comma and a full stop are not read', () => { expect(c('<p>He left,Then she came.Then more;Then</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- Note:Do not wait --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="Note:Do";</script><style>.a:Hover{color:red}</style><template><p>Note:Do</p></template><textarea>Note:Do</textarea><noscript>Note:Do</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>Note:Do</pre><code>this:Name</code><kbd>Note:Do</kbd><samp>Note:Do</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>Note:Do</title><text>Note:Do</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>Note:Do</option></select>')).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c('<p title="Note:Do" data-x="Note:Do">Fine text.</p><img alt="Note:Do" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="Note:Do not wait.">')).toEqual(none); });
  it('a colon at the end of a paragraph passes', () => { expect(c('<p>Done:</p><p>Then</p>')).toEqual(none); });
});

describe('checkColonSpacing: warnings', () => {
  it('a colon glued to the next word', () => {
    const r = c('<p>Note:Read the rest.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(one);
  });
  it('a colon after a speech word', () => { expect(c('<p>He said:Then she left.</p>').warnings[0]).toMatch(one); });
  it('a word of two letters before the colon', () => { expect(c('<p>It is so:Then she came.</p>').warnings[0]).toMatch(one); });
  it('an all capital word before the colon', () => { expect(c('<p>NOTE:Read the rest.</p>').warnings[0]).toMatch(one); });
  it('a word with a capital inside it before the colon', () => { expect(c('<p>Said iPhone:Then she came.</p>').warnings[0]).toMatch(one); });
  it('a name before the colon', () => { expect(c('<p>Said McDonald:Then she came.</p>').warnings[0]).toMatch(one); });
  it('a word that only looks like a scheme', () => { expect(c('<p>Said httpx:Then and web:Then she came.</p>').warnings[0]).toMatch(/^2 places have /); });
  it('an inline tag leaves no gap', () => { expect(c('<p>Note:<b>Read</b> the rest.</p>').warnings[0]).toMatch(one); });
  it('an inline tag before the colon leaves no gap', () => { expect(c('<p><b>Note</b>:Read the rest.</p>').warnings[0]).toMatch(one); });
  it('a link around the next word leaves no gap', () => { expect(c('<p>Note:<a href="/x/">Read</a> the rest.</p>').warnings[0]).toMatch(one); });
  it('a slip in the heading is read', () => { expect(c('<h1>Rain:Then sun</h1><p>Fine text.</p>').warnings[0]).toMatch(one); });
  it('a slip in the title is read', () => { expect(c('<p>Fine text.</p>', '<title>Rain:Then sun</title>').warnings[0]).toMatch(one); });
  it('a slip in a list item is read', () => { expect(c('<ul><li>Done:Then more.</li></ul>').warnings[0]).toMatch(one); });
  it('a slip in a table cell is read', () => { expect(c('<table><tr><td>Done:Then more.</td></tr></table>').warnings[0]).toMatch(one); });
  it('a slip in a caption is read', () => { expect(c('<figure><img src="/a.png" alt="A fine picture"><figcaption>Done:Then more.</figcaption></figure>').warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkColonSpacing(page('<p>Han sa:Sedan kom hon.</p>', '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkColonSpacing(page('<p>Note:Read the rest.</p>', '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c('<p>Note:Read the rest.</p>').warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c('<p>Note:Read the rest. He said:Then she left. Tip:Always check.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^3 places have no space after a colon/);
  });
  it('places in two paragraphs are added', () => { expect(c('<p>Note:Read.</p><p>Tip:Wait.</p>').warnings[0]).toMatch(/^2 places have /); });
  it('a slip right after a skipped block is still found', () => { expect(c('<code>x:Y</code><p>Note:Read the rest.</p>').warnings[0]).toMatch(one); });
  it('a bad place mixed with good ones is counted once', () => { expect(c('<p>See https:Example, at 5:30, Q:Why? Note: fine. Tip:Always check.</p>').warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c('<p>Note:Read and Tip:Wait</p>').errors).toEqual([]); });
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
  it('a page with clean colons passes with no message about colons', () => {
    const r = run(FULL('<p>Note: Do not wait. At 5:30 we met.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/no space after a colon/);
  });
  it('a glued colon is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>Note:Read the rest.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has no space after a colon/);
  });
  it('two glued colons are counted in one message', () => {
    const r = run(FULL('<p>Note:Read the rest. Tip:Always check.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have no space after a colon/);
  });
});
