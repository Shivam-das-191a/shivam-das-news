import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkBreaks } from '../../scripts/break-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;
const c = (b: string) => checkBreaks(page(b));

describe('checkBreaks: good pages', () => {
  it('a page with no break passes', () => { expect(c('<p>hi</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkBreaks(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkBreaks('')).toEqual(none); });
  it('one break between two pieces of text passes (an address)', () => { expect(c('<p>1 Main Street<br>Springfield</p>')).toEqual(none); });
  it('the self closing forms pass', () => { expect(c('<p>a<br/>b<br />c</p>')).toEqual(none); });
  it('one break before and after an inline tag passes', () => { expect(c('<p>a <b>x</b><br><b>y</b> <a href="/x">z</a><br><span>q</span></p>')).toEqual(none); });
  it('a break in a heading between words passes', () => { expect(c('<h2>Title<br>subtitle</h2>')).toEqual(none); });
  it('a break in a list item between words passes', () => { expect(c('<ul><li>one<br>two</li></ul>')).toEqual(none); });
  it('a break in a cell between words passes', () => { expect(c('<table><tr><td>a<br>b</td></tr></table>')).toEqual(none); });
  it('breaks in a pre, a textarea, a script, a style, a template and an svg are not read', () => {
    expect(c('<pre>a<br><br>b</pre><textarea><br><br></textarea><script>var h="<br><br></br>";</script><style>a{}</style><template><br><br></template><svg><br><br></svg>')).toEqual(none);
  });
  it('a break in a comment is not read', () => { expect(c('<!-- <br><br></br> --><p>x</p>')).toEqual(none); });
  it('the case of names is not read', () => { expect(c('<P>a<BR>b</P>')).toEqual(none); });
  it('a tag called brx or br-box is not a break', () => { expect(c('<p><brx><br-box></p>')).toEqual(none); });
  it('an end tag of a normal element passes', () => { expect(c('<p>a</p><div>b</div>')).toEqual(none); });
  it('a wbr and an hr pass', () => { expect(c('<p>long<wbr>word</p><hr>')).toEqual(none); });
});

describe('checkBreaks: errors', () => {
  it('a stray </br>', () => {
    const r = c('<p>a</br>b</p>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^1 place has a stray <\/br>/);
    expect(r.warnings).toEqual([]);
  });
  it('the case of </BR> is not read', () => { expect(c('<p>a</BR>b</p>').errors).toHaveLength(1); });
  it('three stray end tags give one message with the count', () => {
    const r = c('<p>a</br>b</br>c</br>d</p>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^3 places have a stray <\/br>/);
  });
});

describe('checkBreaks: warnings', () => {
  it('two breaks in a row', () => {
    const r = c('<p>a<br><br>b</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has two or more line breaks/);
  });
  it('three breaks with blanks and new lines between them are one run', () => {
    const r = c('<p>a<br>\n  <br />\n<br>b</p>');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^1 place has two or more/);
  });
  it('two runs are counted in one message', () => { expect(c('<p>a<br><br>b</p><p>c<br><br>d</p>').warnings[0]).toMatch(/^2 places have two or more/); });
  it('a paragraph that holds only a break', () => {
    expect(c('<p><br></p>').warnings[0]).toMatch(/holds only a line break/);
    expect(c('<p> <br/> </p>').warnings[0]).toMatch(/holds only a line break/);
  });
  it('a box that holds only a break', () => { expect(c('<div><br></div>').warnings[0]).toMatch(/holds only a line break/); });
  it('a paragraph that holds only two breaks is read as the empty paragraph', () => { expect(c('<p><br><br></p>').warnings[0]).toMatch(/holds only a line break/); });
  it('a break right after the opening tag', () => {
    for (const t of ['p', 'li', 'td', 'th', 'div', 'h2', 'blockquote', 'figcaption', 'dd', 'dt'])
      expect(c(`<${t}><br>text</${t}>`).warnings[0], t).toMatch(/right after the opening tag/);
  });
  it('a break right before the closing tag', () => {
    for (const t of ['p', 'li', 'td', 'div', 'h3', 'blockquote'])
      expect(c(`<${t}>text<br></${t}>`).warnings[0], t).toMatch(/right before the closing tag/);
  });
  it('a break between two paragraphs', () => { expect(c('<p>a</p><br><p>b</p>').warnings[0]).toMatch(/next to a block tag/); });
  it('a break after a box, a heading, a list, a table, a quote and a figure', () => {
    for (const t of ['div', 'h2', 'ul', 'table', 'blockquote', 'figure', 'section'])
      expect(c(`<${t}>x</${t}><br>text`).warnings[0], t).toMatch(/next to a block tag/);
  });
  it('a break before a box and after a rule', () => {
    expect(c('text<br><div>x</div>').warnings[0]).toMatch(/next to a block tag/);
    expect(c('<hr><br>text').warnings[0]).toMatch(/next to a block tag/);
  });
  it('a break directly inside a list', () => {
    expect(c('<ul><li>a</li><br><li>b</li></ul>').warnings[0]).toMatch(/directly inside a list, a table or a select/);
    expect(c('<ol><br><li>a</li></ol>').warnings[0]).toMatch(/directly inside/);
  });
  it('a break directly inside a table', () => {
    expect(c('<table><tr><td>a</td><br></tr></table>').warnings[0]).toMatch(/directly inside/);
    expect(c('<table><br><tr><td>a</td></tr></table>').warnings[0]).toMatch(/directly inside/);
  });
  it('a break directly inside a select', () => { expect(c('<select><option>a</option><br></select>').warnings[0]).toMatch(/directly inside/); });
  it('a break inside a cell between tags is a lead break, not an inside break', () => { expect(c('<table><tr><td><br>x</td></tr></table>').warnings[0]).toMatch(/right after the opening tag/); });
  it('an end tag of an empty element', () => {
    const r = c('<img src="/a.jpg" alt="x"></img>');
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/^1 place has an end tag <\/img>; <img> has no end tag/);
  });
  it('input, hr, meta, link and source end tags', () => {
    for (const t of ['input', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track'])
      expect(c(`<${t}></${t}>`).warnings.join(' '), t).toMatch(new RegExp(`</${t}>`));
  });
  it('different kinds give each their own message', () => {
    const r = c('<p>a<br><br>b</p><p><br></p><p>a</br>b</p>');
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
  });
  it('a break after a close tag of an inline element does not warn', () => { expect(c('<p><em>a</em><br>b</p>')).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'br-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('one break between words passes', () => { expect(run(FULL('<p>1 Main Street<br>Springfield</p>')).code).toBe(0); });
  it('a stray </br> stops the build and names the page', () => {
    const r = run(FULL('<p>a</br>b</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: 1 place has a stray <\/br>/);
  });
  it('two breaks in a row is a warning, not an error', () => {
    const r = run(FULL('<p>a<br><br>b</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*two or more line breaks/);
  });
});
