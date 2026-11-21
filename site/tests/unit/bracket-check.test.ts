import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkBrackets } from '../../scripts/bracket-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkBrackets(page(body, head));
const LQ = '\u201c', RQ = '\u201d';

describe('checkBrackets: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council voted (by 5 to 2) and left [see below].</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkBrackets(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkBrackets('')).toEqual(none); });
  it('nested brackets pass', () => { expect(c('<p>A (b (c) d) e [f [g] h].</p>')).toEqual(none); });
  it('a smiley with a closing bracket passes', () => { expect(c('<p>Great :) really ;) fine =) ok :-)</p>')).toEqual(none); });
  it('a smiley with an opening bracket passes', () => { expect(c('<p>Sad :( and (: odd</p>')).toEqual(none); });
  it('a list marker with a closing bracket passes', () => { expect(c('<p>1) one 2) two 3) three</p>')).toEqual(none); });
  it('a letter marker passes', () => { expect(c('<p>a) first b) second</p>')).toEqual(none); });
  it('a roman marker passes', () => { expect(c('<p>iv) fourth</p>')).toEqual(none); });
  it('a marker at the start of a paragraph passes', () => { expect(c('<p>1) Start here</p><p>2) Then here</p>')).toEqual(none); });
  it('a bracket with a number inside passes', () => { expect(c('<p>See (fig 1) and (table 2).</p>')).toEqual(none); });
  it('curly quotes in pairs pass', () => { expect(c(`<p>He said ${LQ}no${RQ} and ${LQ}yes${RQ}.</p>`)).toEqual(none); });
  it('straight quotes in pairs pass', () => { expect(c('<p>He said "no" and "yes".</p>')).toEqual(none); });
  it('quotes written as references pass', () => { expect(c('<p>He said &quot;no&quot; and &ldquo;yes&rdquo; and &#8220;ok&#8221; and &#x201c;go&#x201d;.</p>')).toEqual(none); });
  it('brackets written as references pass', () => { expect(c('<p>A &lpar;b&rpar; and &#40;c&#41; and &lsqb;d&rsqb; and &#91;e&#93;.</p>')).toEqual(none); });
  it('an inch mark after a digit passes', () => { expect(c('<p>He is 5\'10" tall and ate a 12" pizza.</p>')).toEqual(none); });
  it('a quotation over two paragraphs with curly quotes passes', () => {
    expect(c(`<p>He said: ${LQ}First part.</p><p>${LQ}Second part.${RQ}</p>`)).toEqual(none);
  });
  it('a quotation over three paragraphs with curly quotes passes', () => {
    expect(c(`<p>${LQ}One.</p><p>${LQ}Two.</p><p>${LQ}Three.${RQ}</p>`)).toEqual(none);
  });
  it('a quotation over two paragraphs with straight quotes passes', () => {
    expect(c('<p>He said: "First part.</p><p>"Second part."</p>')).toEqual(none);
  });
  it('a single quote and an apostrophe are not read', () => { expect(c('<p>It\'s Tom\'s \'quoted\' word and \u2018this\u2019 one.</p>')).toEqual(none); });
  it('a bracket in a comment passes', () => { expect(c('<!-- (open [ " --><p>Fine text here.</p>')).toEqual(none); });
  it('a bracket in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="(";</script><style>.a::before{content:"("}</style><template><p>(a</p></template><textarea>(a</textarea><noscript>(a</noscript>')).toEqual(none);
  });
  it('a bracket in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>if (a {</pre><code>f(x</code><kbd>(</kbd><samp>[</samp>')).toEqual(none); });
  it('a bracket in an svg passes', () => { expect(c('<svg><title>(a</title><text>[b</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>(a</option></select>')).toEqual(none); });
  it('an attribute that holds an open bracket passes', () => { expect(c('<p title="(a" data-x="&quot;">Fine text.</p><img alt="(a" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="(a b &quot; c">')).toEqual(none); });
  it('a bracket across an inline tag passes', () => { expect(c('<p>A (<b>bold</b> word) and [<i>it</i>] here.</p>')).toEqual(none); });
  it('a bracket pair with a br inside passes', () => { expect(c('<p>A (first line<br>second line) ends.</p>')).toEqual(none); });
  it('a page with no Latin letters passes', () => { expect(c('<p>\u0986\u099c (\u0995\u09c7\u09b0) \u0996\u09ac\u09b0</p>')).toEqual(none); });
  it('a German style quote with a curly closing mark passes', () => { expect(c('<p>Er sagte \u201eja\u201c und \u201enein\u201d.</p>')).toEqual(none); });
  it('a different kind of quote mark is not read', () => { expect(c('<p>\u00abBonjour\u00bb and \u201eHallo\u201c</p>')).toEqual(none); });
  it('a page with a quote and brackets in the title passes when closed', () => { expect(c('<p>Fine.</p>', '<title>The (big) vote</title>')).toEqual(none); });
});

describe('checkBrackets: warnings', () => {
  it('a bracket never closed', () => {
    const r = c('<p>The vote (see below ended late.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a round or square bracket that is opened and never closed/);
  });
  it('a bracket never opened', () => { expect(c('<p>The vote ended late) and left.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a square bracket never closed', () => { expect(c('<p>The vote [sic ended.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a square bracket never opened', () => { expect(c('<p>The vote sic] ended.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a closing bracket before the opening one', () => { expect(c('<p>The vote ) ended ( late.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('an inner bracket never closed', () => { expect(c('<p>A (b (c) d e.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a closing bracket after a number that is not a marker still counts when a bracket is open', () => { expect(c('<p>See (fig 1 and more.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('two paragraphs with a loose bracket give a count of two', () => {
    expect(c('<p>One (open</p><p>Two (open</p><p>Fine (ok)</p>').warnings[0]).toMatch(/^2 places have a round or square bracket/);
  });
  it('a bracket opened in one paragraph and closed in the next is a fault in each', () => {
    expect(c('<p>One (open</p><p>close)</p>').warnings[0]).toMatch(/^2 places have a round or square bracket/);
  });
  it('a loose bracket in a list item', () => { expect(c('<ul><li>Item (one</li></ul>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a loose bracket in a heading', () => { expect(c('<h1>Council (live</h1>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a loose bracket in the title', () => { expect(c('<p>Fine.</p>', '<title>The vote (live</title>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a bracket written as a reference is counted', () => { expect(c('<p>A &lpar;b ended.</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a curly quote never closed', () => {
    const r = c(`<p>He said ${LQ}no and left.</p>`);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a curly double quote that is opened and never closed/);
  });
  it('a curly quote never opened', () => { expect(c(`<p>He said no${RQ} and left.</p>`).warnings[0]).toMatch(/^1 place has a curly double quote/); });
  it('a quotation over paragraphs that is never closed', () => { expect(c(`<p>${LQ}One.</p><p>${LQ}Two.</p>`).warnings[0]).toMatch(/^1 place has a curly double quote/); });
  it('two loose curly quotes give a count of two', () => { expect(c(`<p>A b${RQ} and c${RQ}</p>`).warnings[0]).toMatch(/^2 places have a curly double quote/); });
  it('a curly quote written as a reference is counted', () => { expect(c('<p>He said &ldquo;no and left.</p>').warnings[0]).toMatch(/^1 place has a curly double quote/); });
  it('a straight quote never closed', () => {
    const r = c('<p>He said "no and left.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a straight double quote that is opened and never closed/);
  });
  it('three straight quotes', () => { expect(c('<p>He said "no" and "yes.</p>').warnings[0]).toMatch(/^1 place has a straight double quote/); });
  it('a straight quote written as a reference is counted', () => { expect(c('<p>He said &quot;no and left.</p>').warnings[0]).toMatch(/^1 place has a straight double quote/); });
  it('a straight quote in a heading', () => { expect(c('<h1>The "big vote</h1>').warnings[0]).toMatch(/^1 place has a straight double quote/); });
  it('the three kinds give three messages, in order', () => {
    const r = c(`<p>A (b</p><p>C ${LQ}d</p><p>E "f</p>`);
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/bracket/);
    expect(r.warnings[1]).toMatch(/curly/);
    expect(r.warnings[2]).toMatch(/straight/);
  });
  it('errors stay empty for every fault', () => { expect(c(`<p>A (b ${LQ}c "d</p>`).errors).toEqual([]); });
  it('a tag with a > inside an attribute does not break the read', () => { expect(c('<p class="a > b" title="x">The vote (see</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('the case of the tag names is not read', () => { expect(c('<P>The vote (see</P><SCRIPT>a )</SCRIPT>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a page with no body tag still counts its text', () => { expect(checkBrackets('<p>The vote (see</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('after a skipped block the text is still read', () => { expect(c('<pre>a )</pre><p>The vote (see</p>').warnings[0]).toMatch(/^1 place has a round or square bracket/); });
  it('a straight quote left open after an inch mark still counts', () => { expect(c('<p>A 12" pizza and "open</p>').warnings[0]).toMatch(/^1 place has a straight double quote/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'bc-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with balanced text passes with no message about brackets', () => {
    const r = run(FULL('<p>The council voted (5 to 2) and said "fine".</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/round or square bracket|curly double quote|straight double quote/);
  });
  it('a bracket never closed is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>The vote (see below ended late.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a round or square bracket/);
  });
  it('a straight quote never closed is a warning, not an error', () => {
    const r = run(FULL('<p>He said "no and left.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*straight double quote/);
  });
});
