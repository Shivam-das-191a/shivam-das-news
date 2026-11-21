import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkBracketSpacing } from '../../scripts/bracket-space-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkBracketSpacing(page(body, head));

describe('checkBracketSpacing: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council voted (by 5 to 2) and left [see below].</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkBracketSpacing(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkBracketSpacing('')).toEqual(none); });
  it('a bracket with no gap inside passes', () => { expect(c('<p>A (b) and [c] and (d e f).</p>')).toEqual(none); });
  it('a smiley with a closing bracket passes', () => { expect(c('<p>Great :) really ;) fine =) ok :-) bye</p>')).toEqual(none); });
  it('a smiley with an opening bracket passes', () => { expect(c('<p>Sad :( sad and (: odd</p>')).toEqual(none); });
  it('a plural written word(s) passes', () => { expect(c('<p>Send the ticket(s) and the form(s) now.</p>')).toEqual(none); });
  it('a bracket with 1 or 2 characters inside passes', () => { expect(c('<p>The ticket(es) and (s)he and (ed)itor.</p>')).toEqual(none); });
  it('a function next to a bracket passes', () => { expect(c('<p>Call f(x) and g(y) and max(a, b).</p>')).toEqual(none); });
  it('a year next to a bracket passes', () => { expect(c('<p>The Title(2020) film.</p>')).toEqual(none); });
  it('a word of two letters before a bracket passes', () => { expect(c('<p>Go to(see) it.</p>')).toEqual(none); });
  it('a web address with a bracket passes', () => { expect(c('<p>See en.wikipedia.org/wiki/Rome_(city) and a/b(cdef).</p>')).toEqual(none); });
  it('an omission mark inside a bracket passes', () => { expect(c('<p>He said [ ... ] and ( ... ) later.</p>')).toEqual(none); });
  it('a gap written as a non breaking space passes', () => { expect(c('<p>Un mot (&nbsp;exemple&nbsp;) et (&#160;autre&#xa0;).</p>')).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c('<p>A (\u00a0word\u00a0) here</p>')).toEqual(none); });
  it('a bracket across an inline tag passes', () => { expect(c('<p>A (<b>bold</b> word) and [<i>it</i>] here.</p>')).toEqual(none); });
  it('a space after the closing bracket passes', () => { expect(c('<p>See (the table below) then go on.</p>')).toEqual(none); });
  it('a mark after the closing bracket passes', () => { expect(c('<p>See (the table below), then (this one).</p>')).toEqual(none); });
  it('a closing bracket at the end of a paragraph passes', () => { expect(c('<p>See (the table below)</p><p>then go.</p>')).toEqual(none); });
  it('a space at the start of the next paragraph is not joined', () => { expect(c('<p>See (the table</p><p> below)</p>')).toEqual(none); });
  it('a space at the end of a paragraph before a closing bracket is not joined', () => { expect(c('<p>See the table </p><p>) odd</p>')).toEqual(none); });
  it('a bracket in a comment passes', () => { expect(c('<!-- ( a ) said(see)then --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="( b )";</script><style>.a::before{content:"( b )"}</style><template><p>( b )</p></template><textarea>( b )</textarea><noscript>said(see)then</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>if ( a ) {</pre><code>said(see)then</code><kbd>( a )</kbd><samp>( a )</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>( a )</title><text>said(see)</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>( a )</option></select>')).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c('<p title="( a )" data-x="said(see)then">Fine text.</p><img alt="( a )" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="( a ) said(see)then">')).toEqual(none); });
  it('a br inside a bracket passes', () => { expect(c('<p>A (first line<br>second line) ends.</p>')).toEqual(none); });
  it('a page with no Latin letters passes the second and third kind', () => { expect(c('<p>\u0986\u099c(\u0995\u09c7\u09b0\u09b0)\u0996\u09ac\u09b0</p>')).toEqual(none); });
  it('a title with a clean bracket passes', () => { expect(c('<p>Fine.</p>', '<title>The (big) vote</title>')).toEqual(none); });
  it('a pair of brackets written as references passes', () => { expect(c('<p>A &lpar;b&rpar; and &#91;c&#93; fine.</p>')).toEqual(none); });
});

describe('checkBracketSpacing: warnings', () => {
  it('a space after an opening bracket', () => {
    const r = c('<p>The vote ( see below) ended late.</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a space just inside a bracket/);
  });
  it('a space before a closing bracket', () => { expect(c('<p>The vote (see below ) ended late.</p>').warnings[0]).toMatch(/^1 place has a space just inside a bracket/); });
  it('a space inside a square bracket', () => { expect(c('<p>The vote [ sic] and [sic ] ended.</p>').warnings[0]).toMatch(/^2 places have a space just inside a bracket/); });
  it('a space inside on both sides counts two', () => { expect(c('<p>The vote ( see below ) ended.</p>').warnings[0]).toMatch(/^2 places have a space just inside a bracket/); });
  it('a digit inside counts', () => { expect(c('<p>The vote ( 5 to 2 ) ended.</p>').warnings[0]).toMatch(/^2 places have a space just inside a bracket/); });
  it('a space inside across an inline tag', () => { expect(c('<p>The vote ( <b>see</b> below) ended.</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a space inside in a heading', () => { expect(c('<h1>Council ( live )</h1>').warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('a space inside in the title', () => { expect(c('<p>Fine.</p>', '<title>The vote ( live)</title>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a new line inside a bracket counts', () => { expect(c('<p>The vote (\nsee below) ended.</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a smiley next to a real slip still counts the slip', () => { expect(c('<p>Sad :( ok and ( see below) ended.</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('no space before an opening bracket', () => {
    const r = c('<p>He said(see below) and left.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has no space before an opening bracket/);
  });
  it('no space before an opening bracket across an inline tag', () => { expect(c('<p>He <b>said</b>(see below) and left.</p>').warnings[0]).toMatch(/^1 place has no space before an opening bracket/); });
  it('two places of a missing space before give a count of two', () => { expect(c('<p>One said(see below) and two wrote(read this).</p>').warnings[0]).toMatch(/^2 places have no space before an opening bracket/); });
  it('no space after a closing bracket', () => {
    const r = c('<p>He said (see below)then left.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has no space after a closing bracket/);
  });
  it('no space after a closing bracket across an inline tag', () => { expect(c('<p>He said (see below)<b>then</b> left.</p>').warnings[0]).toMatch(/^1 place has no space after a closing bracket/); });
  it('the three kinds give three messages, in order', () => {
    const r = c('<p>A ( b ) and said(see below) and (see below)then</p>');
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/space just inside/);
    expect(r.warnings[1]).toMatch(/no space before/);
    expect(r.warnings[2]).toMatch(/no space after/);
  });
  it('a slip written with references is counted', () => { expect(c('<p>A &lpar; word&rpar; and &lpar;word &rpar; ended.</p>').warnings[0]).toMatch(/^2 places have a space just inside/); });
  it('errors stay empty for every fault', () => { expect(c('<p>A ( b ) said(see below)then</p>').errors).toEqual([]); });
  it('a tag with a > inside an attribute does not break the read', () => { expect(c('<p class="a > b" title="x">The vote ( see</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('the case of the tag names is not read', () => { expect(c('<P>The vote ( see</P><SCRIPT>a ( b )</SCRIPT>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('a page with no body tag still counts its text', () => { expect(checkBracketSpacing('<p>The vote ( see</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
  it('after a skipped block the text is still read', () => { expect(c('<pre>a ( b )</pre><p>The vote ( see</p>').warnings[0]).toMatch(/^1 place has a space just inside/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'bs-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with clean brackets passes with no message about gaps', () => {
    const r = run(FULL('<p>The council voted (5 to 2) and left [see below].</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/space just inside a bracket|no space before an opening bracket|no space after a closing bracket/);
  });
  it('a space inside a bracket is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>The vote ( see below) ended late.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a space just inside a bracket/);
  });
  it('no space before a bracket is a warning, not an error', () => {
    const r = run(FULL('<p>He said(see below) and left.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*no space before an opening bracket/);
  });
});
