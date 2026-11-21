import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkStyleAttrs } from '../../scripts/style-attr-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const p = (style: string) => (style.includes('"') ? `<p style='${style}'>x</p>` : `<p style="${style}">x</p>`);
const err = (style: string) => checkStyleAttrs(p(style)).errors;
const warn = (style: string) => checkStyleAttrs(p(style)).warnings;

describe('checkStyleAttrs: good pages', () => {
  it('a plain page passes', () => { expect(checkStyleAttrs('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkStyleAttrs(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkStyleAttrs('')).toEqual(none); });
  it('a normal style passes', () => { expect(checkStyleAttrs(p('color:#333;margin:0 auto;padding:8px 12px;font-size:1.1rem;display:flex'))).toEqual(none); });
  it('spaces and a last semicolon pass', () => { expect(checkStyleAttrs(p(' color : red ; background : #fff ; '))).toEqual(none); });
  it('upper case names and values pass', () => { expect(checkStyleAttrs(p('COLOR:RED;Display:BLOCK;WIDTH:10PX'))).toEqual(none); });
  it('custom properties pass, with any value', () => { expect(checkStyleAttrs(p('--gap:12 px;--Accent:#12345;--x:foo bar:baz'))).toEqual(none); });
  it('vendor properties pass', () => { expect(checkStyleAttrs(p('-webkit-line-clamp:3;-moz-appearance:none;-ms-filter:foo'))).toEqual(none); });
  it('functions pass', () => { expect(checkStyleAttrs(p('width:calc(100% - 2rem);margin:min(4vw,20px);color:var(--ink);padding:env(safe-area-inset-top)'))).toEqual(none); });
  it('a data address with a semicolon inside the bracket passes', () => { expect(checkStyleAttrs(p('background:url(data:image/png;base64,AAAA);color:red'))).toEqual(none); });
  it('a quoted text with a colon and a semicolon passes', () => { expect(checkStyleAttrs(p('content:"a: b; c";font-family:"Open Sans",sans-serif'))).toEqual(none); });
  it('line-height with a plain number passes', () => { expect(checkStyleAttrs(p('line-height:1.6;opacity:0.5;z-index:10;flex:1;order:2'))).toEqual(none); });
  it('zero without a unit passes', () => { expect(checkStyleAttrs(p('margin:0;padding:0 0 0 0;top:0;border-width:0;border-radius:0'))).toEqual(none); });
  it('every real unit passes', () => { expect(checkStyleAttrs(p('width:10px;height:5em;margin:2rem;top:3vh;left:4vw;max-width:60ch;padding:1ex;gap:1cm;font-size:12pt;inset:5%;column-gap:2mm'))).toEqual(none); });
  it('newer units pass', () => { expect(checkStyleAttrs(p('width:50dvw;height:100svh;padding:1lh;margin:2ic;gap:3cqw'))).toEqual(none); });
  it('auto and keywords in length properties pass', () => { expect(checkStyleAttrs(p('width:auto;margin:auto;height:fit-content;max-width:none;font-size:larger'))).toEqual(none); });
  it('negative and decimal lengths pass', () => { expect(checkStyleAttrs(p('margin:-4px .5em;top:-1.5rem;left:+2px'))).toEqual(none); });
  it('a fallback with the same property twice and two values passes', () => { expect(checkStyleAttrs(p('display:-webkit-box;display:flex;width:100%;width:calc(100% - 1px)'))).toEqual(none); });
  it('all hex lengths pass', () => { expect(checkStyleAttrs(p('color:#fff;background:#ffff;border-color:#a1b2c3;outline-color:#a1b2c3d4'))).toEqual(none); });
  it('a hash inside a bracket passes', () => { expect(checkStyleAttrs(p('fill:url(#grad);filter:url(#blur)'))).toEqual(none); });
  it('important passes in every spelling', () => { expect(checkStyleAttrs(p('color:red !important;display:none!important;margin:0 ! important'))).toEqual(none); });
  it('a comment inside the style passes', () => { expect(checkStyleAttrs(p('color:red;/* note: x */background:#fff'))).toEqual(none); });
  it('a real display, position and overflow pass', () => { expect(checkStyleAttrs(p('display:inline-flex;position:sticky;overflow:hidden auto;overflow-x:clip;float:inline-start'))).toEqual(none); });
  it('global keywords pass', () => { expect(checkStyleAttrs(p('display:inherit;position:initial;overflow:unset;text-align:revert'))).toEqual(none); });
  it('a style written with single quotes passes', () => { expect(checkStyleAttrs("<p style='color:red;font-family:\"Inter\",sans-serif'>x</p>")).toEqual(none); });
  it('a style with no quotes passes', () => { expect(checkStyleAttrs('<p style=color:red>x</p>')).toEqual(none); });
  it('quote characters written as entities are read', () => { expect(checkStyleAttrs('<p style="font-family:&quot;Inter&quot;,sans-serif">x</p>')).toEqual(none); });
  it('an SVG style passes', () => { expect(checkStyleAttrs('<svg style="fill:currentColor;stroke:none;stroke-width:2;width:24px"><path d="M0 0" style="stroke-linecap:round"/></svg>')).toEqual(none); });
  it('a CSS property that is not in the list and not close to one passes', () => { expect(checkStyleAttrs(p('some-future-property:1;gizmo:on'))).toEqual(none); });
  it('a keyword far from every real one passes', () => { expect(checkStyleAttrs(p('display:zzzzzzz;position:whatever'))).toEqual(none); });
  it('the words in the text of a page pass', () => { expect(checkStyleAttrs('<p>Write style="width:300" in the tag.</p>')).toEqual(none); });
  it('a data-style attribute is not read', () => { expect(checkStyleAttrs('<p data-style="width:300;colour:red">x</p>')).toEqual(none); });
  it('a tag with no style passes', () => { expect(checkStyleAttrs('<a href="/x/" class="a b" id="i">x</a>')).toEqual(none); });
  it('a template expression passes', () => {
    expect(checkStyleAttrs('<p style={{ color: c }}>x</p><p style={`width:${w}px`}>y</p><p style="width:{w}px">z</p>')).toEqual(none);
  });
  it('grid areas and aspect ratios pass', () => { expect(checkStyleAttrs(p('grid-template-areas:"a b" "c d";aspect-ratio:16 / 9;grid-column:1 / -1'))).toEqual(none); });
  it('an old filter with progid passes', () => { expect(checkStyleAttrs(p('filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#80000000,endColorstr=#80000000)'))).toEqual(none); });
});

describe('checkStyleAttrs: errors', () => {
  it('a declaration with no colon is an error with a plain message', () => {
    expect(err('color red')).toEqual(['a <p> style attribute: "color red" has no colon; write property: value']);
  });
  it('one bad word between good ones is found', () => { expect(err('color:red;bold;margin:0')).toHaveLength(1); });
  it('a name with a space or a symbol is an error', () => {
    expect(err('col or:red')).toEqual(['a <p> style attribute: "col or" is not a property name']);
    expect(err('1color:red')).toHaveLength(1);
    expect(err('color@:red')).toHaveLength(1);
  });
  it('a typo of a property is an error', () => {
    expect(err('backgroud:red')).toEqual(['a <p> style attribute: backgroud is not a CSS property; it looks like a typo of background, so the browser ignores it']);
  });
  it('widht, colour, magin-top and font-wieght are errors', () => {
    expect(err('widht:10px')).toHaveLength(1);
    expect(err('colour:red')).toHaveLength(1);
    expect(err('magin-top:4px')).toHaveLength(1);
    expect(err('font-wieght:700')).toHaveLength(1);
  });
  it('a typo in capital letters is found', () => { expect(err('Backgroud:red')).toHaveLength(1); });
  it('a declaration with no value is an error', () => {
    expect(err('color:')).toEqual(['a <p> style attribute: color has no value']);
    expect(err('color: ;width:10px')).toHaveLength(1);
  });
  it('an unclosed bracket is an error', () => {
    expect(err('background:url(x.png;color:red')).toEqual(['a <p> style attribute: a bracket ( is never closed, so the browser drops this declaration and the ones after it']);
  });
  it('a closing bracket with no opening one is an error', () => { expect(err('width:10px);color:red')).toEqual(['a <p> style attribute: a closing bracket ) has no opening one']); });
  it('an unclosed quote is an error', () => { expect(err('font-family:"Inter;color:red')).toEqual(['a <p> style attribute: a quote is never closed, so the browser drops this declaration and the ones after it']); });
  it('a whole rule is an error', () => {
    expect(err('p{color:red}')[0]).toMatch(/holds a whole rule \(p\{color:red\}\)/);
    expect(err('.a { color: red; }')).toHaveLength(1);
  });
  it('two declarations joined with no semicolon are an error', () => {
    expect(err('color:red background:blue')).toEqual(['a <p> style attribute: color: red background:blue looks like two declarations joined with no semicolon between them']);
  });
  it('a number with no unit is an error', () => {
    expect(err('width:300')).toEqual(['a <p> style attribute: width: 300 is a number with no unit, so the browser ignores it; write 300px']);
  });
  it('margin, padding, top and font-size with no unit are errors', () => {
    expect(err('margin:10')).toHaveLength(1);
    expect(err('padding:4 8')).toHaveLength(2);
    expect(err('top:5')).toHaveLength(1);
    expect(err('font-size:14')).toHaveLength(1);
    expect(err('letter-spacing:2')).toHaveLength(1);
  });
  it('a decimal with no unit is an error', () => { expect(err('width:1.5')).toHaveLength(1); });
  it('a space between the number and the unit is an error', () => { expect(err('margin:10 px')).toHaveLength(1); });
  it('a unit that is a typo is an error', () => {
    expect(err('width:10xp')).toEqual(['a <p> style attribute: width: the unit of 10xp looks like a typo of px, so the browser ignores it']);
    expect(err('height:5rme')).toHaveLength(1);
    expect(err('margin:2pxx')).toHaveLength(1);
  });
  it('a keyword that is a typo is an error', () => {
    expect(err('position:abosolute')).toEqual(['a <p> style attribute: position: abosolute looks like a typo of absolute, so the browser ignores it']);
    expect(err('display:blok')).toHaveLength(1);
    expect(err('text-align:cener')).toHaveLength(1);
    expect(err('overflow:hiden')).toHaveLength(1);
    expect(err('float:rigth')).toHaveLength(1);
  });
  it('a keyword typo in a two word value is found', () => { expect(err('overflow:hidden scrol')).toHaveLength(1); });
  it('a hex color with the wrong number of digits is an error', () => {
    expect(err('color:#12345')).toEqual(['a <p> style attribute: color: #12345 is not a color; a hex color has 3, 4, 6 or 8 digits']);
    expect(err('background:#ff')).toHaveLength(1);
    expect(err('border:1px solid #gggggg')).toHaveLength(1);
  });
  it('a bang that is not important is an error', () => {
    expect(err('color:red!imortant')).toEqual(['a <p> style attribute: color: "!imortant" is not valid; write !important']);
    expect(err('color:red !')).toHaveLength(1);
  });
  it('the tag name is in the message', () => {
    expect(checkStyleAttrs('<div style="width:300">x</div>').errors[0]).toMatch(/^a <div> style attribute/);
    expect(checkStyleAttrs('<SPAN STYLE="width:300">x</SPAN>').errors[0]).toMatch(/^a <span> style attribute/);
  });
  it('the same fault on many tags is told once', () => { expect(checkStyleAttrs(p('width:300').repeat(5)).errors).toHaveLength(1); });
  it('different faults on different tags are all told', () => { expect(checkStyleAttrs(p('width:300') + p('colour:red') + p('color red')).errors).toHaveLength(3); });
  it('a long value is cut in the message', () => {
    const long = 'x'.repeat(100);
    expect(err(`${long}`)[0].length).toBeLessThan(160);
  });
  it('a custom element is read', () => { expect(checkStyleAttrs('<my-box style="width:300">x</my-box>').errors).toHaveLength(1); });
  it('the first style attribute of a tag is the one read', () => {
    expect(checkStyleAttrs('<p style="width:10px" style="width:300">x</p>')).toEqual(none);
    expect(checkStyleAttrs('<p style="width:300" style="width:10px">x</p>').errors).toHaveLength(1);
  });
  it('a tag whose other attribute holds a greater than sign is read', () => { expect(checkStyleAttrs('<p title="a > b" style="width:300">x</p>').errors).toHaveLength(1); });
  it('a pasted rule starting with a brace is left to the template rule, not crashed on', () => { expect(() => checkStyleAttrs(p('{color:red}'))).not.toThrow(); });
});

describe('checkStyleAttrs: warnings', () => {
  it('an empty style attribute is a warning', () => {
    expect(checkStyleAttrs('<p style="">x</p>')).toEqual({ errors: [], warnings: ['a <p> style attribute: it is empty and does nothing; remove it'] });
    expect(warn('   ')).toHaveLength(1);
  });
  it('a style with only a comment is a warning', () => { expect(warn('/* later */')).toHaveLength(1); });
  it('expression( is a warning, not an error', () => {
    const r = checkStyleAttrs(p('width:expression(document.body.clientWidth)'));
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/modern browsers ignore these/);
  });
  it('javascript:, behavior: and -moz-binding are warnings', () => {
    expect(warn('background:url(javascript:alert(1))')).toHaveLength(1);
    expect(warn('behavior:url(x.htc)')).toHaveLength(1);
    expect(warn('-moz-binding:url(x.xml#a)')).toHaveLength(1);
  });
  it('the same property with the same value twice is a warning', () => {
    expect(warn('color:red;color:red')).toEqual(['a <p> style attribute: color is written twice with the same value (red)']);
  });
  it('the same property twice with a different case of the same value is a warning', () => { expect(warn('color:RED;color:red')).toHaveLength(1); });
  it('a warning does not stop the page: errors stay empty', () => { expect(checkStyleAttrs(p('color:red;color:red')).errors).toEqual([]); });
});

describe('checkStyleAttrs: what is left out', () => {
  it('text inside a script, a style block, a template and a comment is not read', () => {
    const h = '<script>var a = \'<p style="width:300">\';</script><style>p::after{content:\'<i style="colour:red">\'}</style><template><p style="width:300">x</p></template><!-- <p style="width:300"> --><p>ok</p>';
    expect(checkStyleAttrs(h)).toEqual(none);
  });
  it('a script with attributes is skipped', () => { expect(checkStyleAttrs('<script type="module" async>const s = \'<p style="width:300">\';</script>')).toEqual(none); });
  it('a vendor property with a bad value is left alone', () => { expect(checkStyleAttrs(p('-webkit-box-orient:vertcal;-moz-foo:10'))).toEqual(none); });
  it('a custom property with a bad value is left alone', () => { expect(checkStyleAttrs(p('--w:300;--c:#12345;--p:abosolute'))).toEqual(none); });
  it('a number with no unit in a property that is not a length is left alone', () => { expect(checkStyleAttrs(p('opacity:1;flex-grow:2;z-index:3;font-weight:700;line-height:2;order:1'))).toEqual(none); });
  it('a keyword typo in a property that is not listed is left alone', () => { expect(checkStyleAttrs(p('cursor:pointr;list-style:disk'))).toEqual(none); });
  it('a unit that is not close to a real one is left alone', () => { expect(checkStyleAttrs(p('width:10zz;margin:3abc'))).toEqual(none); });
  it('a one letter unit is left alone', () => { expect(checkStyleAttrs(p('width:10p'))).toEqual(none); });
  it('a hex color inside a quoted text is left alone', () => { expect(checkStyleAttrs(p('content:"#12345"'))).toEqual(none); });
  it('a name that only starts with a style word is not a style attribute', () => { expect(checkStyleAttrs('<p stylesheet="width:300" styles="width:300">x</p>')).toEqual(none); });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkStyleAttrs('<main>' + '<p class="a b" id="i" style="color:#333;margin:0 auto;padding:8px 12px;background:url(data:image/png;base64,AAAA)">text <a href="/x/">link</a></p>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  const files = ['src/layouts/Base.astro', 'src/components/PostCard.astro', 'src/components/Header.astro', 'src/components/Footer.astro', 'src/components/ContactForm.astro', 'src/pages/notifications.astro', 'src/pages/index.astro', 'src/pages/404.astro'];
  for (const f of files) it(`${f} passes`, () => { expect(checkStyleAttrs(readFileSync(f, 'utf8')).errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'style-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p style="color:#333;margin:0 auto">ok</p>')).code).toBe(0); });
  it('a size with no unit stops the build and names the page', () => {
    const r = run(FULL('<p style="width:300">x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <p> style attribute: width: 300 is a number with no unit/);
  });
  it('a property typo stops the build', () => {
    const r = run(FULL('<p style="backgroud:red">x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/backgroud is not a CSS property/);
  });
  it('a color with five digits stops the build', () => {
    const r = run(FULL('<p style="color:#12345">x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is not a color/);
  });
  it('an empty style attribute is a warning, not an error', () => {
    const r = run(FULL('<p style="">x</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*it is empty and does nothing/);
  });
});
