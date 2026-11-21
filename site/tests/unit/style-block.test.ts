import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkStyleBlocks } from '../../scripts/style-block-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const s = (css: string) => `<style>${css}</style>`;
const err = (css: string) => checkStyleBlocks(s(css)).errors;
const warn = (css: string) => checkStyleBlocks(s(css)).warnings;

describe('checkStyleBlocks: good pages', () => {
  it('a plain page passes', () => { expect(checkStyleBlocks('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkStyleBlocks(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkStyleBlocks('')).toEqual(none); });
  it('a normal block passes', () => { expect(checkStyleBlocks(s('body{margin:0;font:16px/1.6 sans-serif}a{color:#06c;text-decoration:none}a:hover{text-decoration:underline}'))).toEqual(none); });
  it('a block with spaces, new lines and a last semicolon passes', () => { expect(checkStyleBlocks(s('\n  .card {\n    padding: 8px 12px;\n    color : #333 ;\n  }\n'))).toEqual(none); });
  it('a rule with no last semicolon passes', () => { expect(checkStyleBlocks(s('p{color:red;margin:0}'))).toEqual(none); });
  it('an empty rule passes', () => { expect(checkStyleBlocks(s('p{}  .a{ }'))).toEqual(none); });
  it('a media block passes', () => { expect(checkStyleBlocks(s('@media (min-width:600px){.a{width:50%}@media print{.b{display:none}}}'))).toEqual(none); });
  it('supports, layer and container blocks pass', () => {
    expect(checkStyleBlocks(s('@supports (display:grid){.a{display:grid}}@layer base,theme;@layer base{p{margin:0}}@container (min-width:400px){.c{gap:8px}}'))).toEqual(none);
  });
  it('keyframes pass', () => { expect(checkStyleBlocks(s('@keyframes spin{from{transform:rotate(0)}50%{opacity:.5}to{transform:rotate(360deg)}}'))).toEqual(none); });
  it('import and charset lines pass', () => { expect(checkStyleBlocks(s('@charset "utf-8";@import url("a.css");p{color:red}'))).toEqual(none); });
  it('font-face, property and page rules pass, with their own words', () => {
    expect(checkStyleBlocks(s('@font-face{font-family:"X";src:url(a.woff2) format("woff2");font-display:swap;unicode-range:U+0000-00FF}@property --a{syntax:"<length>";inherits:false;initial-value:0px}@page{size:A4;margin:1cm}'))).toEqual(none);
  });
  it('nested rules pass', () => { expect(checkStyleBlocks(s('.card{color:red;&:hover{color:blue}.t{margin:0}}'))).toEqual(none); });
  it('selectors with strange text pass', () => { expect(checkStyleBlocks(s('a[href="x{y};z"]::after{content:"}"}:is(a,b) > .c ~ d+e{color:red}'))).toEqual(none); });
  it('a data address with a semicolon inside passes', () => { expect(checkStyleBlocks(s('.a{background:url(data:image/png;base64,AAAA) no-repeat}'))).toEqual(none); });
  it('custom and vendor properties pass', () => { expect(checkStyleBlocks(s(':root{--gap:12 px;--c:#12345}p{-webkit-line-clamp:3;-moz-appearance:none}'))).toEqual(none); });
  it('a comment between rules passes', () => { expect(checkStyleBlocks(s('/* a { b */p{color:red}/* } */'))).toEqual(none); });
  it('a comment inside a rule passes', () => { expect(checkStyleBlocks(s('p{color:red;/* note: x; y */margin:0}'))).toEqual(none); });
  it('important passes', () => { expect(checkStyleBlocks(s('p{color:red !important;display:none!important}'))).toEqual(none); });
  it('a fallback with the same property twice and two values passes', () => { expect(checkStyleBlocks(s('p{display:-webkit-box;display:flex}'))).toEqual(none); });
  it('a style tag with attributes passes', () => { expect(checkStyleBlocks('<style media="print" id="x" data-a="1">p{color:#000}</style>')).toEqual(none); });
  it('type text/css passes, in any case', () => { expect(checkStyleBlocks('<style type="text/css">p{color:red}</style><STYLE TYPE="TEXT/CSS">p{color:red}</STYLE>')).toEqual(none); });
  it('two good blocks pass', () => { expect(checkStyleBlocks(s('p{color:red}') + '<p>x</p>' + s('a{color:blue}'))).toEqual(none); });
  it('an SVG style block passes', () => { expect(checkStyleBlocks('<svg><style>.a{fill:currentColor;stroke-width:2}</style></svg>')).toEqual(none); });
  it('the real style sheet of the site passes', () => { expect(checkStyleBlocks(s(readFileSync('src/styles/global.css', 'utf8')))).toEqual(none); });
  it('the words in the text of a page pass', () => { expect(checkStyleBlocks('<p>Write &lt;style&gt;p{color:red&lt;/style&gt; in the post.</p>')).toEqual(none); });
});

describe('checkStyleBlocks: braces and comments', () => {
  it('a { that is never closed is an error with the rule named', () => {
    expect(err('p{color:red')).toEqual(['a <style> block: a { is never closed (rule "p"), so the browser drops it and every rule after it']);
  });
  it('the last open rule is named when two are open', () => { expect(err('@media print{p{color:red')[0]).toMatch(/rule "p"/); });
  it('a missing } before the next rule is an error', () => { expect(err('p{color:red;a{color:blue}').length).toBeGreaterThan(0); });
  it('a } with no opening one is an error', () => {
    expect(err('p{color:red}}')).toEqual(['a <style> block: a } has no opening {, so the browser ends the rule too early']);
  });
  it('a } at the start is an error', () => { expect(err('}p{color:red}')).toHaveLength(1); });
  it('a { with no selector is an error', () => {
    expect(err('{color:red}')).toEqual(['a <style> block: a { has no selector before it, so the browser drops the rule']);
  });
  it('a comment that is never closed is an error', () => {
    expect(err('p{color:red}/* later')).toEqual(['a <style> block: a comment /* is never closed, so the browser ignores the rest of the style']);
  });
  it('the part before an unclosed comment is still read', () => { expect(err('p{width:300}/* later').length).toBe(2); });
  it('a quote that is never closed is an error', () => { expect(err('p::after{content:"abc}')[0]).toMatch(/a quote is never closed/); });
  it('a brace inside a quote does not count', () => { expect(checkStyleBlocks(s('p::before{content:"{"}'))).toEqual(none); });
  it('a brace inside a bracket does not count', () => { expect(checkStyleBlocks(s('p{background:url(a{b}.png)}'))).toEqual(none); });
});

describe('checkStyleBlocks: declarations in a rule', () => {
  it('a declaration with no colon is an error that names the rule', () => {
    expect(err('.note{color red}')).toEqual(['a <style> block, rule ".note": "color red" has no colon; write property: value']);
  });
  it('a property typo is an error', () => { expect(err('p{backgroud:red}')[0]).toMatch(/rule "p": backgroud is not a CSS property; it looks like a typo of background/); });
  it('colour, widht and magin are errors', () => { expect(err('p{colour:red;widht:1px;magin:0}')).toHaveLength(3); });
  it('a number with no unit is an error', () => { expect(err('p{width:300}')).toEqual(['a <style> block, rule "p": width: 300 is a number with no unit, so the browser ignores it; write 300px']); });
  it('margin 10 px with a space is an error', () => { expect(err('p{margin:10 px}')).toHaveLength(1); });
  it('a unit that is a typo is an error', () => { expect(err('p{height:5rme}')).toHaveLength(1); });
  it('a keyword that is a typo is an error', () => { expect(err('p{position:abosolute;display:blok}')).toHaveLength(2); });
  it('a hex color with five digits is an error', () => { expect(err('p{color:#12345}')).toHaveLength(1); });
  it('two declarations joined with no semicolon are an error', () => { expect(err('p{color:red background:blue}')).toHaveLength(1); });
  it('a declaration with no value is an error', () => { expect(err('p{color:}')).toEqual(['a <style> block, rule "p": color has no value']); });
  it('a bang that is not important is an error', () => { expect(err('p{color:red!imortant}')).toHaveLength(1); });
  it('a bracket never closed inside a rule is an error', () => { expect(err('p{background:url(a.png}')[0]).toMatch(/is never closed/); });
  it('the fault is found inside a media block', () => { expect(err('@media print{.a{width:300}}')[0]).toMatch(/rule "\.a"/); });
  it('the fault is found inside a nested rule', () => { expect(err('.a{color:red;.b{width:300}}')[0]).toMatch(/rule "\.b"/); });
  it('the fault is found inside a keyframe step', () => { expect(err('@keyframes k{from{width:300}to{width:10px}}')).toHaveLength(1); });
  it('the fault is found in a rule that has no last semicolon', () => { expect(err('p{color:red;width:300}')).toHaveLength(1); });
  it('a long selector is cut in the message', () => {
    expect(err('.' + 'a'.repeat(100) + '{width:300}')[0].length).toBeLessThan(180);
  });
  it('the same fault in many rules is told once per rule name', () => { expect(err('p{width:300}p{width:300}')).toHaveLength(1); });
  it('the same fault in different rules is told for each', () => { expect(err('p{width:300}a{width:300}')).toHaveLength(2); });
  it('the faults of two blocks are all told', () => { expect(checkStyleBlocks(s('p{width:300}') + s('a{colour:red}')).errors).toHaveLength(2); });
});

describe('checkStyleBlocks: warnings', () => {
  it('an empty block is a warning', () => {
    expect(checkStyleBlocks('<style></style>')).toEqual({ errors: [], warnings: ['a <style> block is empty and does nothing; remove it'] });
    expect(warn('  \n ')).toHaveLength(1);
  });
  it('the same property twice with the same value is a warning', () => { expect(warn('p{color:red;color:red}')).toEqual(['a <style> block, rule "p": color is written twice with the same value (red)']); });
  it('expression( is a warning when it is the only fault', () => { expect(checkStyleBlocks(s('p{width:expression(document.body.clientWidth)}')).errors).toEqual([]); });
  it('a warning does not stop the page', () => { expect(checkStyleBlocks(s('p{color:red;color:red}')).errors).toEqual([]); });
});

describe('checkStyleBlocks: what is left out', () => {
  it('a block of another type is not read', () => { expect(checkStyleBlocks('<style type="text/less">p{width:300</style><style type="text/scss">a{</style>')).toEqual(none); });
  it('text inside a script, a template and a comment is not read', () => {
    expect(checkStyleBlocks('<script>var a = \'<style>p{width:300</style>\';</script><template><style>p{</style></template><!-- <style>p{ </style> --><p>ok</p>')).toEqual(none);
  });
  it('a script with attributes is skipped', () => { expect(checkStyleBlocks('<script type="module" async>const s = \'<style>p{\';</script>')).toEqual(none); });
  it('a style tag that holds a template expression is not read', () => { expect(checkStyleBlocks('<style {...attrs}>p{</style>')).toEqual(none); });
  it('a name that only starts with style is not a style block', () => { expect(checkStyleBlocks('<style-box>p{width:300</style-box><styles>a{</styles>')).toEqual(none); });
  it('a selector is not read for faults', () => { expect(checkStyleBlocks(s('p.bad..class,,a>>b{color:red}'))).toEqual(none); });
  it('a property that is not close to a listed one is left alone', () => { expect(checkStyleBlocks(s('p{some-future-property:1;gizmo:on}'))).toEqual(none); });
  it('custom property values are left alone', () => { expect(checkStyleBlocks(s(':root{--w:300;--p:abosolute;--c:#1}'))).toEqual(none); });
  it('a rule inside font-face is not read', () => { expect(checkStyleBlocks(s('@font-face{font-famly:x;src:url(a.woff2);width:300}'))).toEqual(none); });
});

describe('speed', () => {
  it('a big block is read in a fraction of a second', () => {
    const t = Date.now();
    checkStyleBlocks('<style>' + '.card .title:hover{color:#333;margin:0 auto;padding:8px 12px;background:url(data:image/png;base64,AAAA)}@media (min-width:600px){.a{width:50%}}'.repeat(8000) + '</style>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'sblock-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<style>.a{color:#333;margin:0 auto}</style><p class="a">ok</p>')).code).toBe(0); });
  it('a brace never closed stops the build and names the page', () => {
    const r = run(FULL('<style>.a{color:red</style><p>x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <style> block: a \{ is never closed/);
  });
  it('a size with no unit in a block stops the build', () => {
    const r = run(FULL('<style>.a{width:300}</style><p>x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/rule "\.a": width: 300 is a number with no unit/);
  });
  it('a property typo in a block stops the build', () => {
    const r = run(FULL('<style>.a{backgroud:red}</style><p>x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/backgroud is not a CSS property/);
  });
  it('an empty block is a warning, not an error', () => {
    const r = run(FULL('<style></style><p>x</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is empty and does nothing/);
  });
});
