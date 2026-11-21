import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkBlanks } from '../../scripts/blank-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;
const c = (b: string) => checkBlanks(page(b));

describe('checkBlanks: good pages', () => {
  it('a page with text passes', () => { expect(c('<p>hi</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkBlanks(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkBlanks('')).toEqual(none); });
  it('a paragraph with a picture passes', () => { expect(c('<p><img src="/a.png" alt="a"></p>')).toEqual(none); });
  it('a paragraph with an iframe, a video and an svg passes', () => {
    expect(c('<p><iframe src="https://x.test"></iframe></p><p><video controls></video></p><p><svg><path d="M0 0"/></svg></p>')).toEqual(none);
  });
  it('a paragraph with only a link passes', () => { expect(c('<p><a href="/x">Read</a></p>')).toEqual(none); });
  it('a paragraph with only an empty anchor passes (a named target)', () => { expect(c('<p><a id="top"></a></p>')).toEqual(none); });
  it('a paragraph with only a break is left to the break check', () => { expect(c('<p><br></p>')).toEqual(none); });
  it('a list item that holds a list passes', () => { expect(c('<ul><li><ul><li>a</li></ul></li></ul>')).toEqual(none); });
  it('an empty table cell passes', () => { expect(c('<table><tr><td></td><td>&nbsp;</td></tr></table>')).toEqual(none); });
  it('an empty div and an empty span pass (layout boxes)', () => { expect(c('<div></div><span></span><div>&nbsp;</div>')).toEqual(none); });
  it('an empty heading is left to the heading check', () => { expect(c('<h2></h2><h3>&nbsp;</h3>')).toEqual(none); });
  it('one single &nbsp; between a number and a unit passes', () => { expect(c('<p>5&nbsp;km</p>')).toEqual(none); });
  it('two &nbsp; apart, with a word between, pass', () => { expect(c('<p>a&nbsp;b&nbsp;c</p>')).toEqual(none); });
  it('a box with an svg is not empty', () => { expect(c('<figcaption><svg></svg></figcaption>')).toEqual(none); });
  it('blank boxes in a comment, a script, a style, a template, a textarea, a pre and a noscript are not read', () => {
    expect(c('<!-- <p></p> --><script>var h="<p></p>&nbsp;&nbsp;";</script><style>a{}</style><template><p></p></template><textarea><p></p></textarea><pre><p>&nbsp;&nbsp;&nbsp;</p></pre><noscript><p></p></noscript>')).toEqual(none);
  });
  it('the case of names is not read for a good page', () => { expect(c('<P>word</P><LI>one</LI>')).toEqual(none); });
  it('a tag called pad or p-box is not a paragraph', () => { expect(c('<pad></pad><p-box></p-box>')).toEqual(none); });
  it('an attribute value that holds a > does not break the read', () => { expect(c('<p title="a > b">text</p>')).toEqual(none); });
});

describe('checkBlanks: warnings', () => {
  it('an empty paragraph', () => {
    const r = c('<p></p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has an empty paragraph/);
  });
  it('a paragraph of one &nbsp;', () => { expect(c('<p>&nbsp;</p>').warnings[0]).toMatch(/^1 place has an empty paragraph/); });
  it('a paragraph of the number forms of a no break space', () => {
    expect(c('<p>&#160;</p><p>&#xA0;</p>').warnings[0]).toMatch(/^2 places have an empty paragraph/);
  });
  it('a paragraph of a real no break space letter', () => { expect(c('<p>\u00a0</p>').warnings[0]).toMatch(/^1 place has an empty paragraph/); });
  it('a paragraph of plain blank space and new lines', () => { expect(c('<p>  \n\t </p>').warnings[0]).toMatch(/^1 place has an empty paragraph/); });
  it('a paragraph of a zero width space', () => {
    expect(c('<p>&#8203;</p><p>&#x200B;</p><p>\u200b</p>').warnings[0]).toMatch(/^3 places have an empty paragraph/);
  });
  it('a paragraph that holds only empty inline tags', () => {
    expect(c('<p><span>&nbsp;</span></p><p><b><i></i></b></p><p><strong> </strong></p>').warnings[0]).toMatch(/^3 places have an empty paragraph/);
  });
  it('a paragraph with attributes', () => { expect(c('<p class="x" style="margin:0">&nbsp;</p>').warnings[0]).toMatch(/empty paragraph/); });
  it('the case of names is read as the same', () => { expect(c('<P>&nbsp;</P>').warnings[0]).toMatch(/empty paragraph/); });
  it('an empty list item', () => { expect(c('<ul><li></li><li>a</li></ul>').warnings[0]).toMatch(/^1 place has an empty list item/); });
  it('a list item of &nbsp;', () => { expect(c('<ol><li>&nbsp;</li></ol>').warnings[0]).toMatch(/empty list item/); });
  it('an empty quote', () => { expect(c('<blockquote></blockquote>').warnings[0]).toMatch(/^1 place has an empty quote/); });
  it('an empty caption', () => { expect(c('<figure><img src="/a.png" alt="a"><figcaption>&nbsp;</figcaption></figure>').warnings[0]).toMatch(/^1 place has an empty caption/); });
  it('two &nbsp; in a row', () => {
    const r = c('<p>&nbsp;&nbsp;Indented text</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has two or more &nbsp; in a row/);
  });
  it('many &nbsp; in a row count as one place', () => { expect(c('<p>a&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;b</p>').warnings[0]).toMatch(/^1 place has two or more/); });
  it('&nbsp; with a plain space between is still a run', () => { expect(c('<p>a&nbsp; &nbsp;b</p>').warnings[0]).toMatch(/^1 place has two or more/); });
  it('the number forms and the real letter make a run', () => { expect(c('<p>a&#160;\u00a0&#xa0;b</p>').warnings[0]).toMatch(/^1 place has two or more/); });
  it('two separate runs are counted as two places', () => { expect(c('<p>a&nbsp;&nbsp;b</p><p>c&nbsp;&nbsp;d</p>').warnings[0]).toMatch(/^2 places have two or more/); });
  it('a blank paragraph is not counted again as a run', () => {
    const r = c('<p>&nbsp;&nbsp;&nbsp;</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/empty paragraph/);
  });
  it('different kinds give each their own message', () => {
    const r = c('<p></p><ul><li></li></ul><blockquote> </blockquote><figcaption></figcaption><p>a&nbsp;&nbsp;b</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(5);
  });
  it('a double escaped &amp;nbsp;&amp;nbsp; is not a run (the entity check reads it)', () => { expect(c('<p>a&amp;nbsp;&amp;nbsp;b</p>')).toEqual(none); });
  it('an empty status line that a script fills passes (role, aria-live)', () => {
    expect(c('<p role="status"></p><p class="x" aria-live="polite"></p><p data-status role="status" aria-live="polite"></p>')).toEqual(none);
  });
  it('an empty box with an id or a data attribute passes (filled by a script)', () => { expect(c('<p id="note"></p><li data-row></li><p data-n-pause-note></p>')).toEqual(none); });
  it('a class or a style alone does not make an empty box a placeholder', () => { expect(c('<p class="meta" style="margin:0"></p>').warnings[0]).toMatch(/empty paragraph/); });
  it('an attribute that only looks like role does not count (a title, a class named role)', () => { expect(c('<p title="role" class="id data-x"></p>').warnings[0]).toMatch(/empty paragraph/); });
  it('a counted paragraph does not hide a good one next to it', () => {
    const r = c('<p></p><p>real text</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'bl-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with real paragraphs passes with no message about blanks', () => {
    const r = run(FULL('<p>Real text.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/empty paragraph|in a row/);
  });
  it('an empty paragraph is a warning, not an error, and names the page', () => {
    const r = run(FULL('<p>&nbsp;</p><p>Real text.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has an empty paragraph/);
  });
  it('a gap made with &nbsp; is a warning, not an error', () => {
    const r = run(FULL('<p>&nbsp;&nbsp;&nbsp;Indented.</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*two or more &nbsp; in a row/);
  });
});
