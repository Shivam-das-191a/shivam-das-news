import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkRanges } from '../../scripts/range-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkRanges: good pages', () => {
  it('a plain page passes', () => { expect(checkRanges('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkRanges(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkRanges('')).toEqual(none); });
  it('a progress with max and value passes', () => { expect(checkRanges('<progress max="100" value="40"></progress>')).toEqual(none); });
  it('a progress with no attribute passes', () => { expect(checkRanges('<progress></progress>')).toEqual(none); });
  it('a progress with only a value up to 1 passes', () => { expect(checkRanges('<progress value="0.5"></progress>')).toEqual(none); });
  it('a progress at both ends passes', () => { expect(checkRanges('<progress max="10" value="0"></progress><progress max="10" value="10"></progress>')).toEqual(none); });
  it('a meter with every attribute passes', () => { expect(checkRanges('<meter min="0" max="10" low="2" high="8" optimum="5" value="4"></meter>')).toEqual(none); });
  it('a meter with no attribute passes', () => { expect(checkRanges('<meter></meter>')).toEqual(none); });
  it('a meter with only a value up to 1 passes', () => { expect(checkRanges('<meter value="0.7"></meter>')).toEqual(none); });
  it('a number field with min, max, step and value passes', () => { expect(checkRanges('<input type="number" min="1" max="9" step="2" value="3">')).toEqual(none); });
  it('a range field passes', () => { expect(checkRanges('<input type="range" min="0" max="100" step="5" value="50">')).toEqual(none); });
  it('step any passes in any case', () => {
    expect(checkRanges('<input type="number" step="any">')).toEqual(none);
    expect(checkRanges('<input type="number" step="ANY">')).toEqual(none);
  });
  it('decimals, a minus sign and an exponent pass', () => { expect(checkRanges('<input type="number" min="-1.5" max="1e3" step=".25" value="-0.5">')).toEqual(none); });
  it('an empty value on a number field passes', () => { expect(checkRanges('<input type="number" value="">')).toEqual(none); });
  it('an input of another type is not read', () => {
    expect(checkRanges('<input type="date" min="abc" max="x" step="y" value="z"><input type="text" min="abc"><input min="abc" value="q">')).toEqual(none);
  });
  it('the word progress in text passes', () => { expect(checkRanges('<p>Use &lt;progress max="abc"&gt; or <code>meter value="x"</code>.</p>')).toEqual(none); });
});

describe('checkRanges: errors', () => {
  it('progress max abc is an error', () => { expect(checkRanges('<progress max="abc"></progress>').errors).toEqual(['a <progress max="abc"> is not a number; use a number such as max="100"']); });
  it('progress value x is an error', () => { expect(checkRanges('<progress max="10" value="x"></progress>').errors).toEqual(['a <progress value="x"> is not a number; use a number such as value="50"']); });
  it('progress max with px is an error', () => { expect(checkRanges('<progress max="100px"></progress>').errors).toHaveLength(1); });
  it('an empty progress max is an error', () => { expect(checkRanges('<progress max="" value="1"></progress>').errors).toHaveLength(1); });
  it('a progress max with no value is an error', () => { expect(checkRanges('<progress max></progress>').errors).toHaveLength(1); });
  it('meter value abc is an error', () => { expect(checkRanges('<meter value="abc"></meter>').errors).toEqual(['a <meter value="abc"> is not a number; use a number such as value="50"']); });
  it('every meter attribute is read', () => {
    const r = checkRanges('<meter min="a" max="b" low="c" high="d" optimum="e" value="f"></meter>');
    expect(r.errors).toHaveLength(6);
    expect(r.errors[0]).toContain('min="a"');
    expect(r.errors.some((e: string) => e.includes('value="f"'))).toBe(true);
    expect(r.errors.some((e: string) => e.includes('optimum="e"'))).toBe(true);
  });
  it('number field min abc is an error', () => { expect(checkRanges('<input type="number" min="abc">').errors).toEqual(['an <input min="abc"> is not a number; use a number such as min="0"']); });
  it('number field max and step are read too', () => {
    expect(checkRanges('<input type="number" max="x" step="y">').errors).toHaveLength(2);
  });
  it('a range field is read like a number field', () => { expect(checkRanges('<input type="range" min="a">').errors).toHaveLength(1); });
  it('the type is read in any case', () => { expect(checkRanges('<INPUT TYPE="NUMBER" MIN="abc">').errors).toHaveLength(1); });
  it('the case of the tag is not read', () => { expect(checkRanges('<PROGRESS MAX="abc"></PROGRESS>').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkRanges("<progress max='abc'></progress>").errors).toHaveLength(1);
    expect(checkRanges('<progress max=abc></progress>').errors).toHaveLength(1);
    expect(checkRanges('<progress max=10 value=5></progress>')).toEqual(none);
  });
  it('a greater-than sign in a value does not cut the tag', () => { expect(checkRanges('<progress title="a > b" max="abc"></progress>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkRanges('<progress max="abc"></progress><progress max="abc"></progress>').errors).toHaveLength(1); });
  it('a long value is shortened in the message', () => {
    const r = checkRanges('<progress max="' + 'a'.repeat(100) + '"></progress>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(160);
  });
  it('an error does not also give a range warning', () => {
    const r = checkRanges('<progress max="abc" value="5"></progress><meter min="a" value="5"></meter>');
    expect(r.warnings).toEqual([]);
  });
});

describe('checkRanges: warnings', () => {
  it('progress max 0 is a warning', () => { expect(checkRanges('<progress max="0"></progress>').warnings).toEqual(['a <progress max="0"> is 0 or below, so the browser uses 1; use a number above 0']); });
  it('progress max below 0 is a warning', () => { expect(checkRanges('<progress max="-5"></progress>').warnings).toHaveLength(1); });
  it('progress value above max is a warning', () => { expect(checkRanges('<progress max="10" value="11"></progress>').warnings).toEqual(['a <progress value="11"> is above max, so the browser changes it; use a number inside that range']); });
  it('progress value below 0 is a warning', () => { expect(checkRanges('<progress max="10" value="-1"></progress>').warnings).toEqual(['a <progress value="-1"> is below 0, so the browser changes it; use a number inside that range']); });
  it('progress value above 1 with no max is a warning', () => { expect(checkRanges('<progress value="2"></progress>').warnings).toHaveLength(1); });
  it('meter value above its default max of 1 is a warning', () => { expect(checkRanges('<meter value="2"></meter>').warnings).toHaveLength(1); });
  it('meter value below min is a warning', () => { expect(checkRanges('<meter min="5" max="10" value="4"></meter>').warnings).toEqual(['a <meter value="4"> is below min, so the browser changes it; use a number inside that range']); });
  it('meter low, high and optimum outside the range are warnings', () => {
    const r = checkRanges('<meter min="0" max="10" low="-1" high="11" optimum="12" value="5"></meter>');
    expect(r.warnings).toHaveLength(3);
  });
  it('meter min above max is one warning', () => { expect(checkRanges('<meter min="5" max="2" value="3"></meter>').warnings).toEqual(['a <meter> has a min above its max, so the browser treats max as min; use a min that is not above max']); });
  it('meter low above high is a warning', () => { expect(checkRanges('<meter low="0.9" high="0.2"></meter>').warnings).toEqual(['a <meter> has a low above its high, so the browser changes it; use a low that is not above high']); });
  it('number field min above max is a warning', () => { expect(checkRanges('<input type="number" min="10" max="1">').warnings).toEqual(['an <input type="number"> has a min above its max, so no value is allowed; use a min that is not above max']); });
  it('range field min above max names the type', () => { expect(checkRanges('<input type="range" min="10" max="1">').warnings[0]).toContain('type="range"'); });
  it('number field step 0 is a warning', () => { expect(checkRanges('<input type="number" step="0">').warnings).toEqual(['an <input step="0"> is 0 or below, so the browser uses 1; use a number above 0 or "any"']); });
  it('number field step below 0 is a warning', () => { expect(checkRanges('<input type="number" step="-2">').warnings).toHaveLength(1); });
  it('number field value that is not a number is a warning', () => { expect(checkRanges('<input type="number" value="abc">').warnings).toEqual(['an <input value="abc"> is not a number, so the browser leaves the field empty; use a number or no value']); });
  it('number field value below min is a warning', () => { expect(checkRanges('<input type="number" min="5" value="1">').warnings).toEqual(['an <input value="1"> is below its min, so the browser changes it or marks the field wrong; use a number inside the range']); });
  it('number field value above max is a warning', () => { expect(checkRanges('<input type="range" max="5" value="9">').warnings).toEqual(['an <input value="9"> is above its max, so the browser changes it or marks the field wrong; use a number inside the range']); });
  it('the same warning is not printed twice', () => { expect(checkRanges('<progress max="0"></progress><progress max="0"></progress>').warnings).toHaveLength(1); });
  it('a warning never becomes an error', () => {
    expect(checkRanges('<progress max="0" value="5"></progress><input type="number" min="9" max="1" step="0" value="q">').errors).toEqual([]);
  });
});

describe('checkRanges: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <progress max="abc"> --><script>var s = \'<meter value="x">\';</script><style>a:after{content:"<input type=number min=x>"}</style><template><progress max="abc"></progress></template>';
    expect(checkRanges(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment is still read', () => { expect(checkRanges('<!-- x --><progress max="abc"></progress>').errors).toHaveLength(1); });
  it('a custom element that starts with a listed word is not read', () => {
    expect(checkRanges('<progressive max="abc"></progressive><meters value="x"></meters><inputs type="number" min="x"></inputs><progress-bar max="x"></progress-bar>')).toEqual(none);
  });
  it('an attribute on another tag is not read', () => { expect(checkRanges('<div max="abc" min="x" step="y" low="z" value="q"></div>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkRanges('<main>' + '<p class="a b">text <a href="/x/">link</a></p><progress max="10" value="5"></progress>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkRanges(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkRanges(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'range-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p><progress max="100" value="40">40%</progress>')).code).toBe(0); });
  it('a progress max of abc stops the build and names the page', () => {
    const r = run(FULL('<progress max="abc" value="1">1</progress>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <progress max="abc"> is not a number/);
  });
  it('a meter value of x stops the build', () => {
    const r = run(FULL('<meter value="x">x</meter>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/a <meter value="x"> is not a number/);
  });
  it('a progress value above max is a warning, not an error', () => {
    const r = run(FULL('<progress max="10" value="11">11</progress>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is above max/);
  });
});
