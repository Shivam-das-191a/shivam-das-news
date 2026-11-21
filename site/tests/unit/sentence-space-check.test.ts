import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkSentenceSpacing } from '../../scripts/sentence-space-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkSentenceSpacing(page(body, head));
const one = /^1 place has no space after the full stop, question mark or exclamation mark that ends a sentence/;

describe('checkSentenceSpacing: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>He left. Then she came. Why? Because it rained! Nobody knew.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkSentenceSpacing(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkSentenceSpacing('')).toEqual(none); });
  it('two paragraphs pass', () => { expect(c('<p>He left.</p><p>Then she came.</p>')).toEqual(none); });
  it('a line break passes', () => { expect(c('<p>He left.<br>Then she came.</p>')).toEqual(none); });
  it('two list items pass', () => { expect(c('<ul><li>Done.</li><li>Then more.</li></ul>')).toEqual(none); });
  it('table cells pass', () => { expect(c('<table><tr><td>One.</td><td>Then two.</td></tr></table>')).toEqual(none); });
  it('a heading followed by a paragraph passes', () => { expect(c('<h2>Why not?</h2><p>Because.</p>')).toEqual(none); });
  it('a non breaking space after the mark passes', () => { expect(c('<p>He left.&nbsp;Then she came.</p>')).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c('<p>He left.\u00a0Then she came.</p>')).toEqual(none); });
  it('a character reference after the mark passes', () => { expect(c('<p>He left.&mdash;Then she came.</p>')).toEqual(none); });
  it('a number reference after the mark passes', () => { expect(c('<p>He left.&#8212;Then she came.</p>')).toEqual(none); });
  it('a mark followed by a quote passes', () => { expect(c('<p>He said \u201cgo.\u201dThen he left.</p>')).toEqual(none); });
  it('a mark followed by a bracket passes', () => { expect(c('<p>He left.(Then she came.)</p>')).toEqual(none); });
  it('an ellipsis glued to a word passes', () => { expect(c('<p>He waited...Then she came.</p>')).toEqual(none); });
  it('two marks in a row pass', () => { expect(c('<p>Really?!Then she came. Wow!!Then</p>')).toEqual(none); });
  it('a title with a full stop and a space passes', () => { expect(c('<p>Fine text.</p>', '<title>Rain. Then sun</title>')).toEqual(none); });
  it('a web address that starts with www passes', () => { expect(c('<p>Visit www.Example.com today.</p>')).toEqual(none); });
  it('an e-mail address passes', () => { expect(c('<p>Write to me@host.Com or me@mail.host.Com now.</p>')).toEqual(none); });
  it('a word, a dot and a capital word is read as a glued sentence (a real file name is lower case)', () => { expect(c('<p>Open report.Final now.</p>').warnings[0]).toMatch(one); });
  it('a path and an underscore name pass', () => { expect(c('<p>See /docs/page.Then and my_file.Then here.</p>')).toEqual(none); });
  it('Mr, Mrs, Ms and Dr pass', () => { expect(c('<p>Mr.Smith, Mrs.Jones, Ms.Brown and Dr.White met.</p>')).toEqual(none); });
  it('titles and ranks pass', () => { expect(c('<p>Prof.Green, Gen.Marsh, Sen.Reed, Rep.Hall, Gov.Price, Rev.Moss, Hon.Lane, Lt.Dunn, Col.Wells, Sgt.Frost, Capt.Rowe met.</p>')).toEqual(none); });
  it('places and companies pass', () => { expect(c('<p>St.Louis, Mt.Everest, Ft.Worth, Acme Inc.Then, Acme Ltd.Then, Acme Co.Then, Acme Corp.Then</p>')).toEqual(none); });
  it('vs, no, est, approx, fig, vol and al pass', () => { expect(c('<p>Cats vs.Dogs, no.Three, est.Then, approx.Four, fig.Then, vol.Two and Smith et al.Then</p>')).toEqual(none); });
  it('the case of a short form does not matter', () => { expect(c('<p>MR.Smith and DR.White and Vs.Then</p>')).toEqual(none); });
  it('a letter alone before the mark passes', () => { expect(c('<p>The U.S.Army and the E.U.Council met.</p>')).toEqual(none); });
  it('a number before the mark passes', () => { expect(c('<p>In 2024.Then she came. Item 5.Then</p>')).toEqual(none); });
  it('a word after the mark with one small letter passes', () => { expect(c('<p>Use Node.Js and ASP.NET and Vue.Js today.</p>')).toEqual(none); });
  it('a small letter after the mark passes', () => { expect(c('<p>See node.js and example.com and a.b here.</p>')).toEqual(none); });
  it('a capital word of one or two letters after the mark passes', () => { expect(c('<p>He left.OK and she left.It and TV.Go</p>')).toEqual(none); });
  it('a word with accents before the mark passes', () => { expect(c('<p>Un caf\u00e9.Then</p>')).toEqual(none); });
  it('text in another script passes', () => { expect(c('<p>\u0986\u099c.\u0996\u09ac\u09b0 \u4eca\u65e5.\u660e\u65e5</p>')).toEqual(none); });
  it('a comma and a colon are not read', () => { expect(c('<p>He left,Then she came:Then more;Then</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- He left.Then she came --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="left.Then";</script><style>.a::before{content:"left.Then"}</style><template><p>left.Then</p></template><textarea>left.Then</textarea><noscript>left.Then</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>left.Then</pre><code>this.Name</code><kbd>left.Then</kbd><samp>left.Then</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>left.Then</title><text>left.Then</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>left.Then</option></select>')).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c('<p title="left.Then" data-x="left.Then">Fine text.</p><img alt="left.Then" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="He left.Then she came.">')).toEqual(none); });
  it('a mark at the end of a paragraph passes', () => { expect(c('<p>Done.</p><p>Then</p>')).toEqual(none); });
});

describe('checkSentenceSpacing: warnings', () => {
  it('a full stop glued to the next sentence', () => {
    const r = c('<p>He left.Then she came.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(one);
  });
  it('a question mark glued to the next sentence', () => { expect(c('<p>Why?Because it rained.</p>').warnings[0]).toMatch(one); });
  it('an exclamation mark glued to the next sentence', () => { expect(c('<p>Wow!Great news today.</p>').warnings[0]).toMatch(one); });
  it('a sentence that starts with a capital word before the mark', () => { expect(c('<p>Yes.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a word of two letters before the mark', () => { expect(c('<p>It is so.Then she came.</p>').warnings[0]).toMatch(one); });
  it('an all capital word before the mark', () => { expect(c('<p>Said NASA.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a word with a capital inside it before the mark', () => { expect(c('<p>Said iPhone.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a name before the mark', () => { expect(c('<p>Said McDonald.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a short form before a question mark is still a slip', () => { expect(c('<p>Is it Dr?Then who</p>').warnings[0]).toMatch(one); });
  it('a short form before an exclamation mark is still a slip', () => { expect(c('<p>Hello Mrs!Then who</p>').warnings[0]).toMatch(one); });
  it('an inline tag leaves no gap', () => { expect(c('<p>He left.<b>Then</b> she came.</p>').warnings[0]).toMatch(one); });
  it('an inline tag before the mark leaves no gap', () => { expect(c('<p>He <i>left</i>.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a link around the next word leaves no gap', () => { expect(c('<p>He left.<a href="/x/">Then</a> she came.</p>').warnings[0]).toMatch(one); });
  it('a slip in the heading is read', () => { expect(c('<h1>Rain.Then sun</h1><p>Fine text.</p>').warnings[0]).toMatch(one); });
  it('a slip in the title is read', () => { expect(c('<p>Fine text.</p>', '<title>Rain.Then sun</title>').warnings[0]).toMatch(one); });
  it('a slip in a list item is read', () => { expect(c('<ul><li>Done.Then more.</li></ul>').warnings[0]).toMatch(one); });
  it('a slip in a table cell is read', () => { expect(c('<table><tr><td>Done.Then more.</td></tr></table>').warnings[0]).toMatch(one); });
  it('a slip in a caption is read', () => { expect(c('<figure><img src="/a.png" alt="A fine picture"><figcaption>Done.Then more.</figcaption></figure>').warnings[0]).toMatch(one); });
  it('a slip after a mark with the word before in capitals', () => { expect(c('<p>THE END.Then more.</p>').warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkSentenceSpacing(page('<p>Han gick.Sedan kom hon.</p>', '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkSentenceSpacing(page('<p>He left.Then she came.</p>', '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c('<p>He left.Then she came.</p>').warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c('<p>He left.Then she came. Why?Because it rained! Wow!Great news.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^3 places have no space after the full stop/);
  });
  it('places in two paragraphs are added', () => { expect(c('<p>He left.Then.</p><p>Why?Because.</p>').warnings[0]).toMatch(/^2 places have /); });
  it('a slip right after a skipped block is still found', () => { expect(c('<code>x.Y</code><p>He left.Then she came.</p>').warnings[0]).toMatch(one); });
  it('a bad place mixed with good ones is counted once', () => { expect(c('<p>Mr.Smith left. Then she came.Then more. See www.Example.com</p>').warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c('<p>a.Then b.Then Why?Because</p>').errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'ss-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with clean sentences passes with no message about sentence gaps', () => {
    const r = run(FULL('<p>He left. Then she came. Why? Because.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/no space after the full stop, question mark or exclamation mark/);
  });
  it('a glued sentence is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>He left.Then she came.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has no space after the full stop, question mark or exclamation mark/);
  });
  it('two glued sentences are counted in one message', () => {
    const r = run(FULL('<p>He left.Then she came. Why?Because.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have no space after the full stop/);
  });
});
