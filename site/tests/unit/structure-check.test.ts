import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkStructure } from '../../scripts/structure-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (h: string, b = '<p>hi</p>') => `<!doctype html><html lang="en"><head><title>x</title>${h}</head><body>${b}</body></html>`;

describe('checkStructure: good pages', () => {
  it('a plain page passes', () => { expect(checkStructure(page(''))).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkStructure(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty or blank page passes', () => {
    expect(checkStructure('')).toEqual(none);
    expect(checkStructure('  \n ')).toEqual(none);
  });
  it('a full head with every allowed tag passes', () => {
    expect(checkStructure(page('<meta charset="utf-8"><base href="/"><link rel="canonical" href="https://a.b/"><style>a{color:red}</style><script>var a=1;</script><template><div>x</div></template><noscript><link rel="stylesheet" href="/a.css"></noscript>'))).toEqual(none);
  });
  it('the case of names is not read', () => {
    expect(checkStructure('<!DOCTYPE html><HTML><HEAD><TITLE>x</TITLE><META charset="utf-8"></HEAD><BODY><P>a</P></BODY></HTML>')).toEqual(none);
  });
  it('comments in the head and between tags pass', () => {
    expect(checkStructure('<!doctype html>\n<!-- a --><html><!-- b --><head><!-- c --><title>x</title></head><!-- d --><body>hi</body></html><!-- e -->\n')).toEqual(none);
  });
  it('a div word inside a script, a style, a template and a comment in the head is not read', () => {
    expect(checkStructure(page('<script>var h="<div>x</div>";</script><style>p::after{content:"<div>"}</style><!-- <div> -->'))).toEqual(none);
  });
  it('a div inside an attribute value in the head is not read', () => {
    expect(checkStructure(page('<meta name="description" content="a <div> b">'))).toEqual(none);
  });
  it('an svg title in the body is right', () => {
    expect(checkStructure(page('', '<svg role="img"><title>Logo</title><path d="M0 0"/></svg>'))).toEqual(none);
  });
  it('an svg inside an svg, with a title after the inner one, passes', () => {
    expect(checkStructure(page('', '<svg><svg><title>in</title></svg><title>out</title></svg>'))).toEqual(none);
  });
  it('a self closed svg does not hide the rest of the page', () => {
    const r = checkStructure(page('', '<svg width="1"/><link rel="canonical" href="https://a.b/">'));
    expect(r.errors).toHaveLength(1);
  });
  it('a meta with itemprop in the body passes (microdata)', () => {
    expect(checkStructure(page('', '<div itemscope><meta itemprop="datePublished" content="2026-11-20"></div>'))).toEqual(none);
  });
  it('a stylesheet link in the body passes', () => { expect(checkStructure(page('', '<link rel="stylesheet" href="/a.css"><p>a</p>'))).toEqual(none); });
  it('a noscript with a picture in the body passes', () => { expect(checkStructure(page('', '<noscript><img src="/p.gif" alt=""></noscript>'))).toEqual(none); });
  it('a textarea with html words in the body passes', () => { expect(checkStructure(page('', '<textarea><title>x</title><link rel="canonical"></textarea>'))).toEqual(none); });
  it('a page whose head has no head tag but only head tags passes with a warning only', () => {
    const r = checkStructure('<!doctype html><html><title>x</title><meta charset="utf-8"><body>hi</body></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the page has no <head> tag; the browser makes one']);
  });
  it('a html word as text in the body is not a tag', () => { expect(checkStructure(page('', '<p>write &lt;head&gt; and &lt;body&gt;</p>'))).toEqual(none); });
  it('a custom tag called heads or bodys is not a head or a body', () => { expect(checkStructure(page('', '<heads>a</heads><bodys>b</bodys>'))).toEqual(none); });
  it('blank space and a no break space after the head tags pass', () => { expect(checkStructure(page('\n  &nbsp;\n  '))).toEqual(none); });
});

describe('checkStructure: errors', () => {
  it('a second html tag', () => {
    const r = checkStructure(page('', '<html><body>pasted</body></html>'));
    expect(r.errors.some((e: string) => /second <html>/.test(e))).toBe(true);
    expect(r.errors.some((e: string) => /second <body>/.test(e))).toBe(true);
  });
  it('a second head tag', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><head><meta charset="utf-8"></head><body>a</body></html>');
    expect(r.errors).toEqual(['the page has a second <head> tag; the browser ignores it (a whole page pasted into another one?)']);
  });
  it('a second body tag', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><body>a</body><body>b</body></html>');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/second <body>/);
  });
  it('a head tag after the body starts', () => {
    const r = checkStructure('<!doctype html><html><body>a<head><title>x</title></head></body></html>');
    expect(r.errors.some((e: string) => /<head> tag stands after the <body> starts/.test(e))).toBe(true);
  });
  it('a div in the head ends the head', () => {
    const r = checkStructure(page('<div>x</div>'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/a <div> tag stands in the head, where only title, meta, link/);
    expect(r.errors[0]).toMatch(/lands in the body/);
  });
  it('a picture in the head ends the head', () => { expect(checkStructure(page('<img src="/p.gif" alt="">')).errors[0]).toMatch(/<img>/); });
  it('a link a (an anchor) in the head ends the head', () => { expect(checkStructure(page('<a href="/x/">x</a>')).errors[0]).toMatch(/<a>/); });
  it('an iframe and a form in the head end the head, once each head', () => {
    const r = checkStructure(page('<iframe src="/a/"></iframe><form></form>'));
    expect(r.errors).toHaveLength(1);
  });
  it('an svg in the head ends the head', () => { expect(checkStructure(page('<svg><title>x</title></svg>')).errors[0]).toMatch(/<svg>/); });
  it('text in the head ends the head', () => {
    const r = checkStructure(page('Hello there<meta charset="utf-8">'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^text stands in the head/);
  });
  it('text at the very end of the head ends the head', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title>oops</head><body>a</body></html>');
    expect(r.errors).toHaveLength(1);
  });
  it('a head tag after the early end lands in the body: a canonical link is an error', () => {
    const r = checkStructure(page('<div></div><link rel="canonical" href="https://a.b/">'));
    expect(r.errors).toHaveLength(2);
    expect(r.errors[1]).toMatch(/canonical link stands in the body/);
  });
  it('a canonical link in the body is an error', () => {
    const r = checkStructure(page('', '<link rel="canonical" href="https://a.b/"><p>a</p>'));
    expect(r.errors).toEqual(['a canonical link stands in the body; it belongs in the head, where search engines read it']);
  });
  it('a canonical link among other rel words in the body is an error', () => {
    expect(checkStructure(page('', '<link rel="alternate canonical" href="https://a.b/">')).errors).toHaveLength(1);
  });
  it('a title only in the body is an error', () => {
    const r = checkStructure('<!doctype html><html><head><meta charset="utf-8"></head><body><title>x</title><p>a</p></body></html>');
    expect(r.errors).toEqual(['the page has its <title> only inside the body; a title belongs in the head']);
  });
  it('the title of a head that ended early counts as in the body', () => {
    const r = checkStructure('<!doctype html><html><head><div></div><title>x</title></head><body>a</body></html>');
    expect(r.errors).toHaveLength(2);
    expect(r.errors[1]).toMatch(/only inside the body/);
  });
});

describe('checkStructure: warnings', () => {
  it('a second title in the body is a warning', () => {
    const r = checkStructure(page('', '<title>again</title>'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a second <title> stands in the body; only the first title of the page counts']);
  });
  it('meta tags with name, property, http-equiv and charset in the body are warnings, once each', () => {
    const r = checkStructure(page('', '<meta name="robots" content="noindex"><meta name="a" content="b"><meta property="og:title" content="x"><meta http-equiv="refresh" content="0"><meta charset="utf-8">'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(4);
    expect(r.warnings.join(' ')).toMatch(/with name/);
    expect(r.warnings.join(' ')).toMatch(/with property/);
    expect(r.warnings.join(' ')).toMatch(/with http-equiv/);
    expect(r.warnings.join(' ')).toMatch(/with charset/);
  });
  it('content after the body is a warning', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><body>a</body><div>late</div></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['content stands after </body>; the browser moves it back into the body']);
  });
  it('text after the body is a warning', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><body>a</body>late text</html>');
    expect(r.warnings).toEqual(['content stands after </body>; the browser moves it back into the body']);
  });
  it('content after the html is a warning', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><body>a</body></html><script src="/a.js"></script>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['content stands after </html>; the browser moves it into the body']);
  });
  it('text after the html is a warning', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><body>a</body></html>\nstray');
    expect(r.warnings).toEqual(['content stands after </html>; the browser moves it into the body']);
  });
  it('blanks and comments after the html are fine', () => { expect(checkStructure(page('') + '\n\n<!-- end -->\n')).toEqual(none); });
  it('a page with no body tag is a warning', () => {
    const r = checkStructure('<!doctype html><html><head><title>x</title></head><p>a</p></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the page has no <body> tag; the browser makes one']);
  });
  it('a page with no head tag and a body tag is a warning', () => {
    const r = checkStructure('<!doctype html><html><body><p>a</p></body></html>');
    expect(r.warnings).toEqual(['the page has no <head> tag; the browser makes one']);
  });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkStructure(page('', '<p class="a b" id="i">text <a href="/x/">link</a></p><svg><title>t</title></svg>'.repeat(20000)));
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (headExtra: string, bodyExtra: string, tail = '') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex">${headExtra}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body>${tail}</html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'str-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('', '<p>ok</p>')).code).toBe(0); });
  it('a div in the head stops the build and names the page', () => {
    const r = run(FULL('<div class="x"></div>', '<p>ok</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <div> tag stands in the head/);
  });
  it('a canonical link in the body stops the build', () => {
    const r = run(FULL('', '<link rel="canonical" href="https://news.example.org/x/">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/canonical link stands in the body/);
  });
  it('a second body tag stops the build', () => {
    const r = run(FULL('', '<body><p>pasted</p></body>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/second <body> tag/);
  });
  it('content after the body is a warning, not an error', () => {
    const r = run(FULL('', '<p>ok</p>', '<p>late</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*content stands after <\/body>/);
  });
});
