import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkNoscript } from '../../scripts/noscript-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const head = (h: string) => `<!doctype html><html lang="en"><head><title>x</title>${h}</head><body><p>hi</p></body></html>`;
const body = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;

describe('checkNoscript: good pages', () => {
  it('a page with no noscript passes', () => { expect(checkNoscript(body('<p>hello</p>'))).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkNoscript(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkNoscript('')).toEqual(none); });
  it('a body noscript with a paragraph passes', () => { expect(checkNoscript(body('<noscript><p class="meta">Needs JavaScript.</p></noscript>'))).toEqual(none); });
  it('a body noscript with a tracking pixel passes', () => { expect(checkNoscript(body('<noscript><img src="/p.gif" width="1" height="1" alt=""></noscript>'))).toEqual(none); });
  it('a head noscript with link, style and meta passes', () => {
    expect(checkNoscript(head('<noscript><link rel="stylesheet" href="/a.css"><style>.x{display:block}</style><meta name="a" content="b"></noscript>'))).toEqual(none);
  });
  it('a head noscript with only a style passes', () => { expect(checkNoscript(head('<noscript><style>.js-only{display:none}</style></noscript>'))).toEqual(none); });
  it('a head noscript with a comment and blanks around passes', () => {
    expect(checkNoscript(head('<noscript>\n  <!-- fallback -->\n  <link rel="stylesheet" href="/a.css">\n</noscript>'))).toEqual(none);
  });
  it('the case of names is not read', () => { expect(checkNoscript(head('<NOSCRIPT><LINK rel="stylesheet" href="/a.css"></NOSCRIPT>'))).toEqual(none); });
  it('two good blocks pass', () => {
    expect(checkNoscript(body('<noscript><p>a</p></noscript><section><noscript><p>b</p></noscript></section>'))).toEqual(none);
  });
  it('a noscript word inside a script is not read', () => {
    expect(checkNoscript(body('<script>document.write("<noscript><img src=x></noscript>"); var a = "<noscript>";</script><p>ok</p>'))).toEqual(none);
  });
  it('a noscript word inside a comment, a style block and a template is not read', () => {
    expect(checkNoscript(body('<!-- <noscript> --><style>p::after{content:"<noscript>"}</style><template><noscript></template><p>ok</p>'))).toEqual(none);
  });
  it('a script after a closed head noscript with its own tag in the head passes', () => {
    expect(checkNoscript(head('<noscript><link rel="stylesheet" href="/a.css"></noscript><script>var a=1;</script>'))).toEqual(none);
  });
  it('a custom tag called noscripts is not a noscript', () => { expect(checkNoscript(body('<noscripts><p>a</p></noscripts>'))).toEqual(none); });
});

describe('checkNoscript: errors', () => {
  it('a head noscript with a picture ends the head early', () => {
    const r = checkNoscript(head('<noscript><img src="/p.gif" alt=""></noscript>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/in the head holds <img>; only link, style and meta may stand there/);
  });
  it('a head noscript with a paragraph and a div names both', () => {
    const r = checkNoscript(head('<noscript><div><p>x</p></div></noscript>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/<div>, <p>/);
  });
  it('a head noscript with an iframe is an error', () => { expect(checkNoscript(head('<noscript><iframe src="/a/"></iframe></noscript>')).errors[0]).toMatch(/<iframe>/); });
  it('a head noscript with text is an error', () => {
    const r = checkNoscript(head('<noscript>Please turn on JavaScript</noscript>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/holds text/);
  });
  it('a head noscript with text beside a link is an error', () => {
    expect(checkNoscript(head('<noscript><link rel="stylesheet" href="/a.css"> hello</noscript>')).errors[0]).toMatch(/holds text/);
  });
  it('a head noscript with a script is an error and a warning', () => {
    const r = checkNoscript(head('<noscript><script>var a=1;</script></noscript>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/holds a <script>/);
    expect(r.warnings).toHaveLength(1);
  });
  it('a noscript that is never closed in the body is an error', () => {
    const r = checkNoscript(body('<noscript><p>a</p><main>rest of the page</main>').replace('</noscript>', ''));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/in the body is never closed/);
  });
  it('a noscript that is never closed in the head is an error', () => {
    const r = checkNoscript('<!doctype html><html><head><noscript><link rel="stylesheet" href="/a.css"><title>x</title></head><body>y</body></html>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/in the head is never closed/);
  });
  it('the second of two blocks can be the bad one', () => {
    const r = checkNoscript('<!doctype html><html><head><noscript><link rel="stylesheet" href="/a.css"></noscript><noscript><p>x</p></noscript></head><body></body></html>');
    expect(r.errors).toHaveLength(1);
  });
  it('a noscript after the head is not read as in the head', () => {
    expect(checkNoscript('<!doctype html><html><head><title>x</title></head><body><noscript><p>x</p></noscript></body></html>')).toEqual(none);
  });
});

describe('checkNoscript: warnings', () => {
  it('an empty noscript is a warning', () => {
    for (const h of [body('<noscript></noscript>'), body('<noscript>  \n </noscript>'), body('<noscript><!-- later --></noscript>')]) {
      const r = checkNoscript(h);
      expect(r.errors).toEqual([]);
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0]).toMatch(/empty <noscript> in the body/);
    }
  });
  it('an empty noscript in the head is a warning too', () => {
    const r = checkNoscript(head('<noscript></noscript>'));
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/empty <noscript> in the head/);
  });
  it('a script inside a body noscript is a warning', () => {
    const r = checkNoscript(body('<noscript><script>go()</script></noscript>'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/script never runs/);
  });
  it('a closing tag with no opening one is a warning', () => {
    const r = checkNoscript(body('<p>a</p></noscript>'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the page has a </noscript> with no opening <noscript>; it does nothing']);
  });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkNoscript(body('<p class="a b" id="i">text <a href="/x/">link</a></p><noscript><p>x</p></noscript>'.repeat(20000)));
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (headExtra: string, bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex">${headExtra}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'nsc-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<noscript><style>.js{display:none}</style></noscript>', '<noscript><p>Needs JavaScript.</p></noscript>')).code).toBe(0); });
  it('a head noscript with a picture stops the build and names the page', () => {
    const r = run(FULL('<noscript><img src="/p.gif" width="1" height="1" alt=""></noscript>', '<p>ok</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <noscript> in the head holds <img>/);
  });
  it('a noscript never closed stops the build', () => {
    const r = run(FULL('', '<noscript><p>x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is never closed/);
  });
  it('an empty noscript is a warning, not an error', () => {
    const r = run(FULL('', '<noscript></noscript>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*empty <noscript>/);
  });
});
