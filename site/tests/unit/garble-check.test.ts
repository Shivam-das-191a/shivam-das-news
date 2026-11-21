import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkGarbledText } from '../../scripts/garble-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkGarbledText(page(body, head));
// A curly apostrophe saved as UTF-8 and read as Windows-1252: three odd characters.
const APOS = '\u00e2\u20ac\u2122';
const EACUTE = '\u00c3\u00a9';

describe('checkGarbledText: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>The council voted on the new budget on Monday.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkGarbledText(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkGarbledText('')).toEqual(none); });
  it('a real curly apostrophe and curly quotes pass', () => { expect(c('<p>It\u2019s \u201cfine\u201d and \u2018ok\u2019 \u2014 yes \u2026</p>')).toEqual(none); });
  it('real accented letters pass', () => { expect(c('<p>caf\u00e9 na\u00efve fa\u00e7ade se\u00f1or M\u00fcnchen</p>')).toEqual(none); });
  it('a real a with a hat inside a word passes', () => { expect(c('<p>Rom\u00e2nia \u00e2n \u00e2ntr-un</p>')).toEqual(none); });
  it('a capital A with a hat in a word passes', () => { expect(c('<p>\u00c2NCORA</p>')).toEqual(none); });
  it('a capital A with a tilde in a word passes', () => { expect(c('<p>A\u00c7\u00c3O \u00c3O S\u00c3O</p>')).toEqual(none); });
  it('a lone lead letter passes', () => { expect(c('<p>\u00c3 \u00c2 \u00e2</p>')).toEqual(none); });
  it('a lead letter at the end of the text passes', () => { expect(c('<p>end \u00c3</p>')).toEqual(none); });
  it('a non breaking space written as a reference passes', () => { expect(c('<p>5&nbsp;km and&#160;more &copy; 2026</p>')).toEqual(none); });
  it('a real non breaking space character passes', () => { expect(c('<p>5\u00a0km</p>')).toEqual(none); });
  it('a copyright sign and a pound sign pass', () => { expect(c('<p>\u00a9 2026 \u00a3 5 \u00ae</p>')).toEqual(none); });
  it('the zero width characters pass', () => { expect(c('<p>a\u200bb\u200cc\u200dd\ufeffe</p>')).toEqual(none); });
  it('text in other scripts passes', () => { expect(c('<p>\u0986\u099c\u0995\u09c7\u09b0 \u0996\u09ac\u09b0 \u4eca\u65e5\u306e\u30cb\u30e5\u30fc\u30b9</p>')).toEqual(none); });
  it('an emoji passes (another check reads it)', () => { expect(c('<p>\ud83d\ude00</p>')).toEqual(none); });
  it('a broken mark in an attribute is not read', () => { expect(c(`<img src="/a.png" alt="x\ufffd${APOS}"><p title="${APOS}" data-x="\ufffd">Fine text.</p>`)).toEqual(none); });
  it('a broken mark in the meta description is not read', () => { expect(c('<p>Fine.</p>', `<title>Ok</title><meta name="description" content="${APOS} \ufffd">`)).toEqual(none); });
  it('text in a comment passes', () => { expect(c(`<!-- ${APOS} \ufffd --><p>Fine text here.</p>`)).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c(`<script>var a="${APOS}\ufffd";</script><style>.a{content:"${APOS}"}</style><template><p>\ufffd</p></template><textarea>${APOS}</textarea><noscript>\ufffd</noscript>`)).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c(`<pre>${APOS}</pre><code>\ufffd</code><kbd>${EACUTE}</kbd><samp>\u0085</samp>`)).toEqual(none); });
  it('text in an svg passes', () => { expect(c(`<svg><title>${APOS}</title><text>\ufffd</text></svg>`)).toEqual(none); });
  it('a tag called pre-box is not skipped but holds nothing broken', () => { expect(c('<pre-box>fine</pre-box>')).toEqual(none); });
  it('a lead letter followed by a plain letter passes', () => { expect(c('<p>\u00c3a \u00c2b \u00e2c</p>')).toEqual(none); });
  it('a tilde A followed by a space passes', () => { expect(c('<p>\u00c3 word</p>')).toEqual(none); });
});

describe('checkGarbledText: broken text', () => {
  it('a curly apostrophe turned into three odd letters', () => {
    const r = c(`<p>It${APOS}s here</p>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has text saved in one encoding and read in another/);
  });
  it('a curly quote pair turned into odd letters', () => { expect(c('<p>\u00e2\u20ac\u0153hello\u00e2\u20ac\u009d</p>').warnings[0]).toMatch(/^2 places have text saved in one encoding/); });
  it('a long dash turned into odd letters', () => { expect(c('<p>a \u00e2\u20ac\u201d b</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('a short dash turned into odd letters', () => { expect(c('<p>a \u00e2\u20ac\u201c b</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('an ellipsis turned into odd letters', () => { expect(c('<p>wait\u00e2\u20ac\u00a6</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('an e with an acute turned into two letters', () => { expect(c(`<p>caf${EACUTE}</p>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('an i with a diaeresis turned into two letters', () => { expect(c('<p>na\u00c3\u00afve</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('an n with a tilde turned into two letters', () => { expect(c('<p>se\u00c3\u00b1or</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('a non breaking space turned into a hat and a space', () => { expect(c('<p>5\u00c2\u00a0km</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('a copyright sign turned into two letters', () => { expect(c('<p>\u00c2\u00a9 2026</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('a euro sign turned into three letters', () => { expect(c('<p>\u00e2\u201a\u00ac 5</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('a mojibake pair with a Windows symbol after a tilde A', () => { expect(c('<p>\u00c3\u0178</p>').warnings[0]).toMatch(/^1 place has text saved/); });
  it('in a heading', () => { expect(c(`<h2>Don${APOS}t miss it</h2>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('in the title', () => { expect(c('<p>Fine.</p>', `<title>Don${APOS}t miss</title>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('in a link', () => { expect(c(`<a href="/x">Don${APOS}t</a>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('across an inline tag around the whole word', () => { expect(c(`<p><b>It${APOS}s</b> here</p>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('two places give a count of two', () => { expect(c(`<p>It${APOS}s</p><p>caf${EACUTE}</p>`).warnings[0]).toMatch(/^2 places have text saved/); });
  it('the replacement mark', () => {
    const r = c('<p>Bad \ufffd word</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a broken character mark/);
  });
  it('a run of replacement marks is one place', () => { expect(c('<p>Bad \ufffd\ufffd\ufffd word</p>').warnings[0]).toMatch(/^1 place has a broken character mark/); });
  it('two runs of replacement marks are two places', () => { expect(c('<p>a \ufffd b \ufffd\ufffd c</p>').warnings[0]).toMatch(/^2 places have a broken character mark/); });
  it('a replacement mark in a heading and the title', () => { expect(c('<h1>Big \ufffd news</h1>', '<title>Big \ufffd news</title>').warnings[0]).toMatch(/^2 places have a broken/); });
  it('a hidden control character', () => {
    const r = c('<p>a\u0085b</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has a hidden control character/);
  });
  it('a run of control characters is one place', () => { expect(c('<p>a\u0085\u0091\u0092b</p>').warnings[0]).toMatch(/^1 place has a hidden control character/); });
  it('a control character inside a mojibake pair is not counted twice', () => {
    const r = c('<p>\u00e2\u20ac\u009d</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has text saved/);
  });
  it('the three kinds give three messages, in order', () => {
    const r = c(`<p>x\ufffdy ${APOS} a\u0085b</p>`);
    expect(r.warnings).toHaveLength(3);
    expect(r.warnings[0]).toMatch(/broken character mark/);
    expect(r.warnings[1]).toMatch(/one encoding and read in another/);
    expect(r.warnings[2]).toMatch(/hidden control character/);
  });
  it('a tag with a > inside an attribute does not break the read', () => { expect(c(`<p class="a > b" title="x">It${APOS}s</p>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('the case of the tag names is not read', () => { expect(c(`<P>It${APOS}s</P><SCRIPT>${APOS}</SCRIPT>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('a page with no body tag still counts its text', () => { expect(checkGarbledText(`<p>It${APOS}s</p>`).warnings[0]).toMatch(/^1 place has text saved/); });
  it('after a skipped block the text is still read', () => { expect(c(`<pre>${APOS}</pre><p>caf${EACUTE}</p>`).warnings[0]).toMatch(/^1 place has text saved/); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'gb-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with normal text passes with no message about broken text', () => {
    const r = run(FULL('<p>It\u2019s a fine caf\u00e9 story.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/broken character|encoding and read|control character/);
  });
  it('text read in the wrong encoding is a warning, not an error, and names the page', () => {
    const r = run(FULL(`<p>It${APOS}s a story.</p>`));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has text saved in one encoding and read in another/);
  });
  it('a replacement mark is a warning, not an error', () => {
    const r = run(FULL('<p>A \ufffd mark.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a broken character mark/);
  });
});
