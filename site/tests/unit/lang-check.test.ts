import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkLang, isValidLang } from '../../scripts/lang-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('isValidLang: good values', () => {
  it('language, script, region and variants', () => {
    for (const v of ['en', 'fr', 'bn', 'fil', 'en-US', 'en-GB', 'pt-BR', 'zh-Hant', 'zh-Hant-TW', 'es-419', 'de-CH-1996', 'sl-rozaj', 'ca-valencia', 'und'])
      expect(isValidLang(v), v).toBe(true);
  });
  it('private use codes', () => { for (const v of ['x-news', 'x-a-b']) expect(isValidLang(v), v).toBe(true); });
  it('the case of a value does not matter and spaces are cut', () => {
    for (const v of ['EN', 'EN-us', ' en-US ']) expect(isValidLang(v), v).toBe(true);
  });
});

describe('isValidLang: bad values', () => {
  it('words, an underscore, one letter and numbers', () => {
    for (const v of ['english', 'English', 'en_US', 'e', 'en-', '-en', 'en--US', '12', 'en US', 'en-U', 'en-USA', 'en-12', 'en-1234567890', 'x', 'x-', ''])
      expect(isValidLang(v), v).toBe(false);
  });
});

describe('checkLang: good pages', () => {
  it('a page with no lang and no dir passes', () => { expect(checkLang('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkLang(v as any).errors).toEqual(['the page is not text']);
  });
  it('the html tag with a real lang passes', () => { expect(checkLang('<!doctype html><html lang="en"><body></body></html>')).toEqual(none); });
  it('a quotation in another language passes', () => { expect(checkLang('<p>He said <q lang="fr-CA">bonjour</q> and <span lang=bn>ok</span></p>')).toEqual(none); });
  it('an empty lang on a tag other than html passes (language unknown)', () => { expect(checkLang('<span lang="">x</span><i lang>y</i>')).toEqual(none); });
  it('the empty lang of the html tag is left to page-basics', () => { expect(checkLang('<html lang="">')).toEqual(none); });
  it('dir values ltr, rtl and auto pass in any case', () => { expect(checkLang('<p dir="rtl">a</p><p dir=LTR>b</p><bdi dir="auto">c</bdi>')).toEqual(none); });
  it('upper case tags and names, single quotes are read', () => { expect(checkLang("<HTML LANG='en'><P DIR='ltr'>x</P>")).toEqual(none); });
  it('names that only end with lang or dir are not read', () => {
    expect(checkLang('<a hreflang="zzz" href="/x/">x</a><link hreflang="english" href="/y/"><div data-lang="english" data-dir="up" subdir="x" idir="y">z</div>')).toEqual(none);
  });
  it('lang and xml:lang that agree pass', () => { expect(checkLang('<html lang="en" xml:lang="EN">')).toEqual(none); });
});

describe('checkLang: errors', () => {
  it('a lang that is not a language code is an error', () => {
    expect(checkLang('<html lang="english">').errors).toEqual(['a <html> has lang="english", which is not a language code; write it like en, en-US or fr']);
  });
  it('an underscore is an error', () => { expect(checkLang('<span lang="en_US">x</span>').errors).toHaveLength(1); });
  it('xml:lang is read too', () => {
    expect(checkLang('<html xml:lang="english">').errors).toEqual(['a <html> has xml:lang="english", which is not a language code; write it like en, en-US or fr']);
  });
  it('a dir that is not ltr, rtl or auto is an error', () => {
    expect(checkLang('<p dir="left">x</p>').errors).toEqual(['a <p> has dir="left", which is not ltr, rtl or auto, so the browser ignores it']);
  });
  it('an empty dir is an error', () => { expect(checkLang('<p dir="">x</p>').errors).toHaveLength(1); });
  it('a very long value is cut in the message', () => { expect(checkLang('<p lang="' + 'x'.repeat(300) + '">x</p>').errors[0].length).toBeLessThan(200); });
  it('the same message is not printed twice', () => { expect(checkLang('<p lang="bad1">a</p><p lang="bad1">b</p>').errors).toHaveLength(1); });
});

describe('checkLang: warnings', () => {
  it('lang and xml:lang that differ are a warning', () => {
    const r = checkLang('<html lang="en" xml:lang="fr">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <html> has lang="en" and xml:lang="fr", which name different languages; keep them the same']);
  });
  it('an empty one of the two is not compared', () => { expect(checkLang('<p lang="en" xml:lang="">x</p>')).toEqual(none); });
});

describe('checkLang: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<p lang="english" dir="up">\';</script><template><p lang="bad1"></p></template><!-- <p lang="bad1"> --><style>p[lang="bad1"]{}</style>';
    expect(checkLang(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkLang('<main>' + '<p class="a b" data-x="1" lang="en-US" dir="ltr">text</p>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout writes lang="en"', () => {
    const t = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(t).toMatch(/<html lang="en">/);
    expect(checkLang(t)).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string, lang = 'en') =>
    `<!doctype html><html lang="${lang}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'lang-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>He said <q lang="fr">bonjour</q></p>')).code).toBe(0); });
  it('a page language that is not a code stops the build and names the page', () => {
    const r = run(FULL('<p>x</p>', 'english'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <html> has lang="english"/);
  });
  it('a quotation with a wrong language stops the build', () => {
    const r = run(FULL('<p><q lang="en_US">x</q></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not a language code/);
  });
  it('a wrong dir stops the build', () => {
    const r = run(FULL('<p dir="left">x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not ltr, rtl or auto/);
  });
  it('lang and xml:lang that differ are a warning, not an error', () => {
    const r = run(FULL('<p lang="en" xml:lang="fr">x</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*different languages/);
  });
});
