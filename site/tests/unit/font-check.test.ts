import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkFontCss, checkFontLinks } from '../../scripts/font-check-lib.mjs';

const FACE = '@font-face{font-family:Lexend;font-style:normal;font-display:swap;font-weight:600;src:url(/_astro/a.woff2) format("woff2"),url(/_astro/a.woff) format("woff")}';
const face = (family: string, weight: number, extra = 'font-display:swap') => `@font-face{font-family:${family};font-style:normal;${extra};font-weight:${weight};src:url(/_astro/x.woff2)}`;

describe('checkFontCss', () => {
  it('passes a good font face with no message', () => {
    expect(checkFontCss(FACE)).toEqual({ errors: [], warnings: [] });
  });
  it('a style with no font at all is fine (system fonts)', () => {
    expect(checkFontCss('.a{color:red}')).toEqual({ errors: [], warnings: [] });
  });
  it('not text: no message, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkFontCss(v as any)).toEqual({ errors: [], warnings: [] });
  });
  it('needs font-display swap, fallback or optional', () => {
    for (const ok of ['swap', 'fallback', 'optional', 'SWAP']) expect(checkFontCss(face('A', 400, `font-display:${ok}`)).errors).toEqual([]);
    for (const bad of ['block', 'auto', '', 'swapx']) expect(checkFontCss(face('A', 400, `font-display:${bad}`)).errors.join()).toMatch(/A 400 has no font-display/);
    expect(checkFontCss(face('A', 400, 'color:red')).errors.join()).toMatch(/font-display/);
  });
  it('the sentence names the family and the weight', () => {
    expect(checkFontCss(face('"Fira Sans"', 700, 'x:y')).errors[0]).toContain('Fira Sans 700');
  });
  it('font-display in another rule does not count', () => {
    expect(checkFontCss('@font-face{font-family:A;src:url(/a.woff2)}.x{font-display:swap}').errors.length).toBe(1);
  });
  it('a font file from another website is an error', () => {
    for (const u of ['https://fonts.gstatic.com/a.woff2', 'http://x.org/a.woff2', '//cdn.x.org/a.woff2', ' "https://x.org/a.woff2"', "'//x.org/a.woff2'"])
      expect(checkFontCss(`@font-face{font-family:A;font-display:swap;src:url( ${u} )}`).errors.join()).toMatch(/another website/);
    expect(checkFontCss(face('A', 400)).errors).toEqual([]);
    expect(checkFontCss('@font-face{font-family:A;font-display:swap;src:url(/media/a.woff2)}').errors).toEqual([]);
    expect(checkFontCss('@font-face{font-family:A;font-display:swap;src:url("data:font/woff2;base64,AAAA")}').errors).toEqual([]);
  });
  it('an import from a font website is an error', () => {
    expect(checkFontCss('@import url("https://fonts.googleapis.com/css2?family=Inter");').errors.join()).toMatch(/imports a font/);
    expect(checkFontCss("@import 'https://fonts.bunny.net/css?family=x';").errors.join()).toMatch(/imports a font/);
    expect(checkFontCss('@import url(//fonts.googleapis.com/css);').errors.join()).toMatch(/imports a font/);
  });
  it('an import of something else, or of our own file, is not a font error', () => {
    expect(checkFontCss('@import "/local.css";').errors).toEqual([]);
    expect(checkFontCss('@import url(https://example.org/a.css);').errors).toEqual([]);
  });
  it('a comment is not a rule', () => {
    expect(checkFontCss('/* @font-face{font-family:A;src:url(https://x.org/a.woff2)} */' + FACE).errors).toEqual([]);
  });
  it('warns above four different faces, not for the same face repeated', () => {
    const four = face('A', 400) + face('A', 600) + face('B', 400) + face('B', 600);
    expect(checkFontCss(four).warnings).toEqual([]);
    expect(checkFontCss(four + face('B', 800)).warnings.join()).toMatch(/5 different font faces/);
    expect(checkFontCss(four + four + four).warnings).toEqual([]);
    expect(checkFontCss(four + face('B', 600).replace('normal', 'italic')).warnings.join()).toMatch(/5 different/);
  });
  it('a face with no weight counts as weight 400', () => {
    const four = face('A', 400) + face('A', 600) + face('B', 400) + face('B', 600);
    expect(checkFontCss(four + '@font-face{font-family:A;font-display:swap;src:url(/a.woff2)}').warnings).toEqual([]);
  });
  it('a word that only ends like a property is not that property', () => {
    expect(checkFontCss('@font-face{font-family:A;x-font-display:swap;src:url(/a.woff2)}').errors.join()).toMatch(/font-display/);
  });
  it('reads upper case and spaces', () => {
    expect(checkFontCss('@FONT-FACE { font-family : A ; FONT-DISPLAY : swap ; src : url(/a.woff2) }').errors).toEqual([]);
  });
});

describe('checkFontLinks', () => {
  it('passes a page with no font link', () => {
    expect(checkFontLinks('<head><link rel="stylesheet" href="/a.css"><script src="/a.js"></script></head>')).toEqual([]);
  });
  it('not text: no message, no crash', () => {
    for (const v of [undefined, null, 5]) expect(checkFontLinks(v as any)).toEqual([]);
  });
  it('a link to a font website is an error', () => {
    for (const u of ['https://fonts.googleapis.com/css2?family=Inter', 'https://fonts.gstatic.com/', '//fonts.bunny.net/css', 'https://use.typekit.net/abc.css'])
      expect(checkFontLinks(`<link rel="stylesheet" href="${u}">`).length).toBe(1);
    expect(checkFontLinks("<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>").length).toBe(1);
    expect(checkFontLinks('<script src="https://kit.fontawesome.com/x.js"></script>').length).toBe(1);
  });
  it('a host that only contains the name is not a font host', () => {
    expect(checkFontLinks('<link rel="stylesheet" href="https://notfonts.googleapis.com.evil.org/x">')).toEqual([]);
    expect(checkFontLinks('<link rel="stylesheet" href="/local/fonts.googleapis.com.css">').length).toBe(0);
  });
  it('a name that only ends like a font host is not a font host', () => {
    expect(checkFontLinks('<link rel="stylesheet" href="https://notfonts.googleapis.com/x">')).toEqual([]);
    expect(checkFontLinks('<link rel="stylesheet" href="https://cdn.fonts.googleapis.com/x">').length).toBe(1);
  });
  it('the words inside a script or style text are not a link', () => {
    expect(checkFontLinks('<script>var u="<link href=https://fonts.googleapis.com/x>"</script><style>/* https://fonts.gstatic.com */</style>')).toEqual([]);
  });
  it('a > sign inside an attribute does not break the reading', () => {
    expect(checkFontLinks('<link data-x="a>b" href="https://fonts.googleapis.com/x">').length).toBe(1);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const CSS = '@media print{a{color:#000}}:focus-visible{outline:3px solid #000}';
  const html = (head: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><style>${CSS}</style>${head}</head><body data-page-type="404"><a class="skip" href="#main">S</a><header>h</header><main id="main"><h1>P</h1></main><footer>f</footer></body></html>`;
  const run = (head: string, css = '') => {
    const d = mkdtempSync(join(tmpdir(), 'fc-')); mkdirSync(join(d, 'dist/_astro'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html(head));
    if (css) writeFileSync(join(d, 'dist/_astro/site.css'), css);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('a good font in a css file passes', () => {
    const r = run('', FACE);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
  });
  it('a font with no font-display stops the build', () => {
    const r = run('', face('A', 400, 'x:y'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/font-display/);
  });
  it('a font file from another website stops the build', () => {
    const r = run('', '@font-face{font-family:A;font-display:swap;src:url(https://x.org/a.woff2)}');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/another website/);
  });
  it('a link to Google Fonts stops the build', () => {
    const r = run('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/loads a font from another website/);
  });
  it('five faces only warn', () => {
    const r = run('', face('A', 400) + face('A', 600) + face('B', 400) + face('B', 600) + face('B', 800));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn:.*5 different font faces/);
  });
});
