import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkParagraphs } from '../../scripts/paragraph-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const msg = (tag: string) => `a <${tag}> sits inside a <p>; the browser closes the paragraph early and leaves an empty paragraph after it, so close the <p> before the <${tag}>, or make the outer tag a <div>`;

describe('checkParagraphs: good pages', () => {
  it('a plain page passes', () => { expect(checkParagraphs('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkParagraphs(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkParagraphs('')).toEqual(none); });
  it('text level tags inside a paragraph pass', () => {
    expect(checkParagraphs('<p>a <a href="/x/">b</a> <strong>c</strong> <em>d</em> <span>e</span> <img src="/a.jpg" alt=""> <br> <code>f</code> <time datetime="2026-01-01">g</time></p>')).toEqual(none);
  });
  it('a paragraph followed by a block passes', () => { expect(checkParagraphs('<p>a</p><div>b</div><ul><li>c</li></ul><table><tr><td>d</td></tr></table>')).toEqual(none); });
  it('a paragraph inside a block passes', () => { expect(checkParagraphs('<div><p>a</p></div><section><article><p>b</p></article></section><blockquote><p>c</p></blockquote>')).toEqual(none); });
  it('a paragraph closed by the next paragraph passes', () => { expect(checkParagraphs('<p>a<p>b<p>c')).toEqual(none); });
  it('a paragraph left open in a list item passes', () => { expect(checkParagraphs('<ul><li><p>a<li><p>b</p><ul><li>c</ul><li><p>d<li>e</ul>')).toEqual(none); });
  it('a paragraph left open in dt and dd passes', () => { expect(checkParagraphs('<dl><dt><p>a<dd><p>b<dt>c<dd><ul><li>x</ul></dl>')).toEqual(none); });
  it('a paragraph in a table cell next to a block passes', () => { expect(checkParagraphs('<table><tr><td><p>a</td><td><div>x</div></td></tr></table>')).toEqual(none); });
  it('a block inside a link or a button outside a paragraph passes', () => { expect(checkParagraphs('<a href="/x/"><div>a</div></a><button><div>b</div></button>')).toEqual(none); });
  it('a block inside a button inside a paragraph passes (the button is a scope)', () => { expect(checkParagraphs('<p>a <button><div>b</div></button></p>')).toEqual(none); });
  it('a block inside a template inside a paragraph is not read', () => { expect(checkParagraphs('<p>a<template><div>x</div></template></p>')).toEqual(none); });
  it('a heading with text level tags passes', () => { expect(checkParagraphs('<h2>a <span>b</span> <a href="/x/">c</a></h2>')).toEqual(none); });
  it('a label and a span with text pass', () => { expect(checkParagraphs('<label>a <input type="text"></label><span>b</span>')).toEqual(none); });
  it('the case of a tag does not matter', () => { expect(checkParagraphs('<P>a</P><DIV>b</DIV>')).toEqual(none); });
  it('a self closed tag is not kept open', () => { expect(checkParagraphs('<p>a<br/>b</p><div>c</div><p><img src="/a.jpg" alt="" /></p><div>d</div>')).toEqual(none); });
});

describe('checkParagraphs: a block tag inside a paragraph is an error', () => {
  it('a div', () => { expect(checkParagraphs('<p>a<div>x</div>b</p>').errors).toEqual([msg('div')]); });
  it('a list', () => {
    expect(checkParagraphs('<p>a<ul><li>x</li></ul></p>').errors).toEqual([msg('ul')]);
    expect(checkParagraphs('<p>a<ol><li>x</li></ol></p>').errors).toEqual([msg('ol')]);
    expect(checkParagraphs('<p>a<dl><dt>x</dt></dl></p>').errors).toEqual([msg('dl')]);
  });
  it('a table', () => { expect(checkParagraphs('<p>a<table><tr><td>x</td></tr></table></p>').errors).toEqual([msg('table')]); });
  it('a heading', () => {
    for (const t of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) expect(checkParagraphs(`<p>a<${t}>x</${t}></p>`).errors, t).toEqual([msg(t)]);
  });
  it('a figure, a blockquote, a pre and a form', () => {
    for (const t of ['figure', 'blockquote', 'pre', 'form']) expect(checkParagraphs(`<p>a<${t}>x</${t}></p>`).errors, t).toEqual([msg(t)]);
  });
  it('an hr, a fieldset, a details and an address', () => {
    for (const t of ['hr', 'fieldset', 'details', 'address']) expect(checkParagraphs(`<p>a<${t}>x</${t}></p>`).errors, t).toEqual([msg(t)]);
  });
  it('a section, an article, an aside, a header, a footer, a nav and a main', () => {
    for (const t of ['section', 'article', 'aside', 'header', 'footer', 'nav', 'main']) expect(checkParagraphs(`<p>a<${t}>x</${t}></p>`).errors, t).toEqual([msg(t)]);
  });
  it('a block inside a span inside a paragraph', () => { expect(checkParagraphs('<p><span><div>x</div></span></p>').errors).toEqual([msg('div')]); });
  it('a block inside a link inside a paragraph (the link is not a scope)', () => { expect(checkParagraphs('<p><a href="/x/"><div>x</div></a></p>').errors).toEqual([msg('div')]); });
  it('a block inside a paragraph inside a list item', () => { expect(checkParagraphs('<ul><li><p>a<ul><li>b</li></ul></p></li></ul>').errors).toEqual([msg('ul')]);});
  it('a block inside a paragraph inside a table cell', () => { expect(checkParagraphs('<table><tr><td><p>a<div>x</div></p></td></tr></table>').errors).toEqual([msg('div')]); });
  it('the stray end tag after the early close does not make a second error', () => { expect(checkParagraphs('<p>a<div>x</div></p><p>b</p>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkParagraphs('<p>a<div>x</div></p><p>b<div>y</div></p>').errors).toHaveLength(1); });
  it('two different blocks print two messages', () => { expect(checkParagraphs('<p>a<div>x</div></p><p>b<ul><li>y</li></ul></p>').errors).toHaveLength(2); });
  it('an error is not also a warning', () => { expect(checkParagraphs('<p>a<div>x</div></p>').warnings).toEqual([]); });
});

describe('checkParagraphs: warnings', () => {
  it('a div directly inside a span', () => {
    expect(checkParagraphs('<span><div>x</div></span>').warnings).toEqual(['a <div> sits directly inside an inline <span>; HTML allows only text-level tags there, so a screen reader may read it wrongly']);
  });
  it('a block directly inside other inline tags', () => {
    for (const t of ['b', 'i', 'em', 'strong', 'u', 's', 'small', 'abbr', 'cite', 'q', 'sub', 'sup', 'mark', 'label', 'var', 'time'])
      expect(checkParagraphs(`<${t}><div>x</div></${t}>`).warnings, t).toHaveLength(1);
  });
  it('a paragraph directly inside an inline tag', () => { expect(checkParagraphs('<span><p>x</p></span>').warnings).toHaveLength(1); });
  it('a paragraph or a div directly inside a heading', () => {
    expect(checkParagraphs('<h2><p>x</p></h2>').warnings).toEqual(['a <p> sits directly inside a <h2> heading; HTML allows only text-level tags there, so a screen reader may read it wrongly']);
    expect(checkParagraphs('<h3><div>x</div></h3>').warnings).toHaveLength(1);
  });
  it('a heading directly inside a heading', () => { expect(checkParagraphs('<h2><h3>x</h3></h2>').warnings).toHaveLength(1); });
  it('a block two levels down is not read', () => { expect(checkParagraphs('<span><a href="/x/"><div>x</div></a></span>')).toEqual(none); });
  it('a warning is not an error', () => { expect(checkParagraphs('<span><div>x</div></span>').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkParagraphs('<span><div>a</div></span><span><div>b</div></span>').warnings).toHaveLength(1); });
});

describe('checkParagraphs: what is left out', () => {
  it('a code sample may show a div inside a p', () => {
    expect(checkParagraphs('<p>a<code><div>x</div></code> <kbd><ul></kbd> <samp><table></samp></p><pre><p><div></pre><textarea><p><div></textarea>')).toEqual(none);
  });
  it('a custom element that starts with code is not a code sample', () => { expect(checkParagraphs('<p><code-box>x</code-box><div>a</div></p>').errors).toHaveLength(1); });
  it('text inside script, style, template, svg, math and comments is not read', () => {
    expect(checkParagraphs('<p>a<script>var s="<div>";</script><style>a{}</style><!-- <div> --><svg><div></div></svg><math><ul></ul></math></p>')).toEqual(none);
  });
  it('names that only start with a listed word are left alone', () => { expect(checkParagraphs('<p>a<para-box>x</para-box><spanner>y</spanner><table-of-contents>z</table-of-contents><divider>w</divider></p>')).toEqual(none); });
  it('an end tag with no opening tag is ignored', () => { expect(checkParagraphs('</p></div><p>a</p></span>')).toEqual(none); });
  it('a tag with a greater-than sign in a value does not break the reading', () => { expect(checkParagraphs('<p title="a > b">x</p><div>y</div>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkParagraphs('<main>' + '<p class="a b">one <a href="/x/">two</a></p><ul><li><p>x</p></li></ul>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it('a very deep page does not crash', () => { expect(() => checkParagraphs('<div>'.repeat(20000) + '<p>a<div>b</div></p>' + '</div>'.repeat(20000))).not.toThrow(); });
  it('many paragraphs left open do not slow the reading', () => {
    const t = Date.now();
    checkParagraphs('<main>' + '<p>a'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout has no block inside a paragraph', () => {
    expect(checkParagraphs(readFileSync('src/layouts/Base.astro', 'utf8')).errors).toEqual([]);
  });
  it('the real components have no block inside a paragraph', () => {
    for (const f of ['Header', 'Footer', 'Listing', 'PostCard', 'Trending', 'Pager', 'ContactForm', 'Related', 'ReadNext', 'Empty'])
      expect(checkParagraphs(readFileSync(`src/components/${f}.astro`, 'utf8')).errors, f).toEqual([]);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'para-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>a <strong>b</strong></p><div><p>c</p></div>')).code).toBe(0); });
  it('a div inside a paragraph stops the build and names the page', () => {
    const r = run(FULL('<p>a<div>x</div>b</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <div> sits inside a <p>/);
  });
  it('a list inside a paragraph stops the build', () => {
    const r = run(FULL('<p>a<ul><li>x</li></ul></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/a <ul> sits inside a <p>/);
  });
  it('a div directly inside a span is a warning, not an error', () => {
    const r = run(FULL('<span><div>x</div></span>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a <div> sits directly inside an inline <span>/);
  });
  it('a paragraph directly inside a heading is a warning, not an error', () => {
    const r = run(FULL('<h2><p>x</p></h2>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a <p> sits directly inside a <h2> heading/);
  });
});
