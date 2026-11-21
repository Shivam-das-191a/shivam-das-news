import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkCapsLockSlips } from '../../scripts/capslock-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string) => checkCapsLockSlips(page(body, head));
const one = /^1 place has a word typed with Caps Lock on by mistake/;

describe('checkCapsLockSlips: good pages', () => {
  it('normal text passes', () => { expect(c('<h1>City council votes</h1><p>Hello world. The NASA team met on Monday.</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkCapsLockSlips(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkCapsLockSlips('')).toEqual(none); });
  it('a word in all capitals passes', () => { expect(c('<p>BREAKING NEWS from NASA and UNESCO.</p>')).toEqual(none); });
  it('a word with a capital first letter passes', () => { expect(c('<p>Hello Washington.</p>')).toEqual(none); });
  it('a word in small letters passes', () => { expect(c('<p>hello world</p>')).toEqual(none); });
  it('mRNA passes', () => { expect(c('<p>The mRNA vaccine.</p>')).toEqual(none); });
  it('iOS passes', () => { expect(c('<p>The iOS update.</p>')).toEqual(none); });
  it('a product name with a small letter inside passes', () => { expect(c('<p>An iPhone, an iPad, an eBay seller, macOS, iPhoneOS and YouTube.</p>')).toEqual(none); });
  it('a word of four letters with a capital run of three passes', () => { expect(c('<p>hELL and xRAY and mNPC</p>')).toEqual(none); });
  it('a word of five letters with a capital run of three passes', () => { expect(c('<p>hELLo and aBCDe</p>')).toEqual(none); });
  it('a camel case word passes', () => { expect(c('<p>getElementById and someVariableName</p>')).toEqual(none); });
  it('a word after a hash sign passes', () => { expect(c('<p>#hELLO and #cAPSLOCK</p>')).toEqual(none); });
  it('a word after an at sign passes', () => { expect(c('<p>@hELLO and me@hELLO.com</p>')).toEqual(none); });
  it('a word after a dot passes', () => { expect(c('<p>a.hELLO and file.cAPSLOCK</p>')).toEqual(none); });
  it('a word after a slash passes', () => { expect(c('<p>docs/hELLO and /cAPSLOCK</p>')).toEqual(none); });
  it('a word after an underscore passes', () => { expect(c('<p>my_hELLO</p>')).toEqual(none); });
  it('a word after a colon passes', () => { expect(c('<p>key:hELLO</p>')).toEqual(none); });
  it('a word after a hyphen passes', () => { expect(c('<p>e-hELLO and x-cAPSLOCK</p>')).toEqual(none); });
  it('a word joined to a letter before it passes', () => { expect(c('<p>xhELLO</p>')).toEqual(none); });
  it('a word joined to a digit before it passes', () => { expect(c('<p>5hELLO</p>')).toEqual(none); });
  it('a word with a letter after it passes', () => { expect(c('<p>hELLOa</p>')).toEqual(none); });
  it('a word with a digit after it passes', () => { expect(c('<p>hELLO1</p>')).toEqual(none); });
  it('a word with an underscore after it passes', () => { expect(c('<p>hELLO_x</p>')).toEqual(none); });
  it('a word with an accented letter after it passes', () => { expect(c('<p>hELLO\u00e9</p>')).toEqual(none); });
  it('a word with an accented letter before it passes', () => { expect(c('<p>\u00e9hELLO</p>')).toEqual(none); });
  it('text in another script passes', () => { expect(c('<p>\u4eca\u65e5 \u0986\u099c \u0410\u0411\u0412\u0413\u0414\u0415</p>')).toEqual(none); });
  it('text in a comment passes', () => { expect(c('<!-- hELLO --><p>Fine text here.</p>')).toEqual(none); });
  it('text in a script, a style, a template, a textarea and a noscript passes', () => {
    expect(c('<script>var a="hELLO";</script><style>.a:before{content:"hELLO"}</style><template><p>hELLO</p></template><textarea>hELLO</textarea><noscript>hELLO</noscript>')).toEqual(none);
  });
  it('text in a pre, a code, a kbd and a samp passes', () => { expect(c('<pre>hELLO</pre><code>hELLO</code><kbd>hELLO</kbd><samp>hELLO</samp>')).toEqual(none); });
  it('text in an svg passes', () => { expect(c('<svg><title>hELLO</title><text>hELLO</text></svg>')).toEqual(none); });
  it('options of a select pass', () => { expect(c('<select><option>hELLO</option></select>')).toEqual(none); });
  it('an attribute that holds a slip passes', () => { expect(c('<p title="hELLO" data-x="hELLO">Fine text.</p><img alt="hELLO" src="/a.png">')).toEqual(none); });
  it('the meta description is not read', () => { expect(c('<p>Fine.</p>', '<title>Ok</title><meta name="description" content="hELLO world">')).toEqual(none); });
  it('a letter and a capital word apart pass', () => { expect(c('<p>a HELLO and x CAPS</p>')).toEqual(none); });
  it('capitals split by a block tag pass', () => { expect(c('<p>h</p><p>ELLO</p>')).toEqual(none); });
  it('capitals split by a line break pass', () => { expect(c('<p>h<br>ELLO</p>')).toEqual(none); });
  it('capitals split by a character reference pass', () => { expect(c('<p>h&nbsp;ELLO and h&amp;ELLO</p>')).toEqual(none); });
});

describe('checkCapsLockSlips: warnings', () => {
  it('a word typed with Caps Lock on', () => { expect(c('<p>hELLO world.</p>').warnings[0]).toMatch(one); });
  it('the word is shown', () => { expect(c('<p>hELLO world.</p>').warnings[0]).toMatch(/\(first: "hELLO"\)/); });
  it('the message asks to retype', () => { expect(c('<p>hELLO world.</p>').warnings[0]).toMatch(/retype it$/); });
  it('a longer word', () => { expect(c('<p>The cOUNCILMEMBERS voted.</p>').warnings[0]).toMatch(one); });
  it('the shortest word that is read has five letters', () => { expect(c('<p>aBCDE</p>').warnings[0]).toMatch(one); });
  it('a word at the start of a paragraph', () => { expect(c('<p>wORLD news today.</p>').warnings[0]).toMatch(one); });
  it('a word at the end of a paragraph', () => { expect(c('<p>Good morning wORLD</p>').warnings[0]).toMatch(one); });
  it('a word before a full stop', () => { expect(c('<p>Hello wORLD.</p>').warnings[0]).toMatch(one); });
  it('a word before a comma', () => { expect(c('<p>Hello wORLD, and more.</p>').warnings[0]).toMatch(one); });
  it('a word before a closing quote', () => { expect(c('<p>He said \u201cwORLD\u201d.</p>').warnings[0]).toMatch(one); });
  it('a word in brackets', () => { expect(c('<p>Hello (wORLD) and more.</p>').warnings[0]).toMatch(one); });
  it('a word after an opening quote', () => { expect(c('<p>He said \u201cwORLD news\u201d.</p>').warnings[0]).toMatch(one); });
  it('a word in a heading', () => { expect(c('<h1>Council wORLD</h1>').warnings[0]).toMatch(one); });
  it('a word in the title', () => { expect(c('<p>Fine text.</p>', '<title>Council wORLD</title>').warnings[0]).toMatch(one); });
  it('a word in a list item', () => { expect(c('<ul><li>wORLD</li></ul>').warnings[0]).toMatch(one); });
  it('a word in a table cell', () => { expect(c('<table><tr><td>wORLD</td></tr></table>').warnings[0]).toMatch(one); });
  it('a word in a block quote', () => { expect(c('<blockquote>wORLD</blockquote>').warnings[0]).toMatch(one); });
  it('a word split by an inline tag', () => { expect(c('<p>w<b>ORLD</b> news</p>').warnings[0]).toMatch(one); });
  it('a word with the capitals in a strong tag', () => { expect(c('<p>w<strong>ORLD</strong></p>').warnings[0]).toMatch(one); });
  it('a word after a skipped block is still found', () => { expect(c('<code>x</code><p>wORLD news.</p>').warnings[0]).toMatch(one); });
  it('a slip in a page in another language is read', () => { expect(checkCapsLockSlips(page('<p>Han sa wORLD.</p>', '<title>Ok</title>', 'sv')).warnings[0]).toMatch(one); });
  it('a slip in a page with no lang is read', () => { expect(checkCapsLockSlips(page('<p>wORLD news.</p>', '<title>Ok</title>', '')).warnings[0]).toMatch(one); });
  it('a slip next to text in another script is read', () => { expect(c('<p>\u4eca\u65e5 wORLD \u660e\u65e5</p>').warnings[0]).toMatch(one); });
  it('the count is told for one place', () => { expect(c('<p>wORLD news.</p>').warnings[0]).toMatch(/^1 place has /); });
  it('the count is told for several places', () => {
    const r = c('<p>wORLD news. cAPSLOCK is on. hELLO again.</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^3 places have a word typed with Caps Lock on by mistake/);
  });
  it('the first word is the one shown', () => { expect(c('<p>cAPSLOCK is on. hELLO again.</p>').warnings[0]).toMatch(/\(first: "cAPSLOCK"\)/); });
  it('places in two paragraphs are added', () => { expect(c('<p>wORLD</p><p>hELLO</p>').warnings[0]).toMatch(/^2 places have /); });
  it('a bad place mixed with good ones is counted once', () => { expect(c('<p>The mRNA, iOS and iPhone, #hELLO, then wORLD news.</p>').warnings[0]).toMatch(one); });
  it('there is never an error', () => { expect(c('<p>wORLD hELLO</p>').errors).toEqual([]); });
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
  it('a page with clean words passes with no message about Caps Lock', () => {
    const r = run(FULL('<p>The mRNA team and NASA met on Monday.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/Caps Lock/);
  });
  it('a Caps Lock slip is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>wORLD news today.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a word typed with Caps Lock on by mistake/);
  });
  it('two slips are counted in one message', () => {
    const r = run(FULL('<p>wORLD news. hELLO again.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have a word typed with Caps Lock on by mistake/);
  });
});
