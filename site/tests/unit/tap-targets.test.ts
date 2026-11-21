import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTapTargets, controlClassesOf } from '../../scripts/tap-targets-lib.mjs';

const errs = (css: string, classes: string[] = ['btn']) => checkTapTargets(css, classes).errors;
const warns = (css: string, classes: string[] = ['btn']) => checkTapTargets(css, classes).warnings;
const none = { errors: [], warnings: [] };

describe('controlClassesOf', () => {
  it('is not text: an empty list, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(controlClassesOf(v as any)).toEqual([]);
  });
  it('takes the classes of every kind of control, sorted, once each', () => {
    const html = '<button class="b1">x</button><summary class="s1">x</summary><select class="se"></select><textarea class="t1"></textarea>' +
      '<input class="i1"><a href="/x/" class="a1 b1">x</a><span role="button" class="r1">x</span>';
    expect(controlClassesOf(html)).toEqual(['a1', 'b1', 'i1', 'r1', 's1', 'se', 't1']);
  });
  it('an a without href, a hidden input, a span and a div are not controls', () => {
    const html = '<a class="n1">x</a><input type="hidden" class="n2"><span class="n3">x</span><div class="n4"></div><p class="n5">x</p>';
    expect(controlClassesOf(html)).toEqual([]);
  });
  it('an input of another type is a control', () => {
    expect(controlClassesOf('<input type="email" class="e"><input type="checkbox" class="c">')).toEqual(['c', 'e']);
  });
  it('an element with aria-hidden true is not counted', () => {
    expect(controlClassesOf('<button class="x" aria-hidden="true">x</button><button class="y">y</button>')).toEqual(['y']);
  });
  it('comments, script, style and template are ignored', () => {
    const html = '<!-- <button class="c1">x</button> --><script>var s="<button class=\\"c2\\">x</button>";</script><style>.c3{}</style><template><button class="c4">x</button></template><button class="ok">x</button>';
    expect(controlClassesOf(html)).toEqual(['ok']);
  });
  it('reads upper case tags, single quotes, unquoted values and a > inside an attribute', () => {
    expect(controlClassesOf("<BUTTON CLASS='up'>x</BUTTON><button class=plain>x</button><button data-x=\"a>b\" class=\"gt\">x</button>")).toEqual(['gt', 'plain', 'up']);
  });
  it('splits several classes and ignores extra spaces', () => {
    expect(controlClassesOf('<button class="  btn   cf-send ">x</button>')).toEqual(['btn', 'cf-send']);
  });
  it('a data-type or a data-class attribute is not read as type or class', () => {
    expect(controlClassesOf('<input data-type="hidden" class="z"><button data-class="no">x</button>')).toEqual(['z']);
  });
});

describe('checkTapTargets: the basics', () => {
  it('a big control passes with no message', () => {
    expect(checkTapTargets('.btn{min-width:44px;height:44px}', ['btn'])).toEqual(none);
  });
  it('is not a style: one error, no crash', () => {
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(checkTapTargets(v as any).errors.length).toBe(1);
  });
  it('under 24px is an error that names the rule and the size', () => {
    const e = errs('.btn{width:20px;height:20px}');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/^"\.btn" is drawn 20px wide and 20px tall; a tap target must be at least 24px each way/);
    expect(warns('.btn{width:20px;height:20px}')).toEqual([]);
  });
  it('only the side that is too small is named', () => {
    expect(errs('.btn{width:20px;height:50px}')[0]).toMatch(/is drawn 20px wide;/);
    expect(errs('.btn{width:50px;height:20px}')[0]).toMatch(/is drawn 20px tall;/);
  });
  it('the limits: 23.9 is an error, 24 is a warning, 43 is a warning, 44 is fine', () => {
    expect(errs('.btn{height:23.9px}').length).toBe(1);
    expect(errs('.btn{height:24px}')).toEqual([]);
    expect(warns('.btn{height:24px}').length).toBe(1);
    expect(warns('.btn{height:43px}').length).toBe(1);
    expect(checkTapTargets('.btn{height:44px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{height:60px}', ['btn'])).toEqual(none);
  });
  it('between 24 and 44 is a warning that names the rule and the size, and not an error', () => {
    const r = checkTapTargets('.dot{width:38px;height:38px}', ['dot']);
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/^"\.dot" is drawn 38px wide and 38px tall; this site uses 44px for touch/);
  });
  it('a rule with an error gives no second warning for the same rule', () => {
    const r = checkTapTargets('.btn{width:20px;height:30px}', ['btn']);
    expect(r.errors.length).toBe(1);
    expect(r.warnings).toEqual([]);
  });
  it('one side small and the other big: the small side decides', () => {
    expect(errs('.btn{width:300px;height:10px}').length).toBe(1);
    expect(warns('.btn{width:300px;height:30px}').length).toBe(1);
  });
  it('a decimal size is written plainly', () => {
    expect(errs('.btn{height:12.5px}')[0]).toMatch(/12\.5px tall/);
    expect(errs('.btn{height:12.0px}')[0]).toMatch(/12px tall/);
  });
});

describe('checkTapTargets: how a size is read', () => {
  it('the minimum size counts: the biggest of size and minimum wins', () => {
    expect(checkTapTargets('.btn{height:20px;min-height:44px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{width:20px;min-width:44px}', ['btn'])).toEqual(none);
    expect(errs('.btn{min-height:20px}').length).toBe(1);
    expect(errs('.btn{min-width:20px}').length).toBe(1);
  });
  it('rem and em count as 16px', () => {
    expect(errs('.btn{height:1rem}')[0]).toMatch(/16px tall/);
    expect(warns('.btn{height:2rem}')[0]).toMatch(/32px tall/);
    expect(checkTapTargets('.btn{height:2.75rem}', ['btn'])).toEqual(none);
    expect(errs('.btn{width:1em}')[0]).toMatch(/16px wide/);
    expect(checkTapTargets('.btn{min-height:3em}', ['btn'])).toEqual(none);
  });
  it('a bare 0 is zero; another bare number is not a length and is not judged', () => {
    expect(errs('.btn{height:0}').length).toBe(1);
    expect(checkTapTargets('.btn{height:5}', ['btn'])).toEqual(none);
  });
  it('a size that cannot be known gives no message', () => {
    for (const v of ['100%', '50vw', '10vh', 'calc(100% - 20px)', 'var(--h)', 'auto', 'clamp(10px,2vw,30px)', 'min(10px,5vw)', 'fit-content', 'inherit'])
      expect(checkTapTargets(`.btn{height:${v};width:${v}}`, ['btn'])).toEqual(none);
  });
  it('one part that cannot be known makes the whole side unknown (a var may be big)', () => {
    expect(checkTapTargets('.btn{height:20px;min-height:var(--x)}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{width:100%;min-width:20px}', ['btn'])).toEqual(none);
  });
  it('the other side is still judged when one side is unknown', () => {
    expect(errs('.btn{width:100%;height:20px}').length).toBe(1);
  });
  it('the last declaration wins, and !important is read through', () => {
    expect(checkTapTargets('.btn{height:20px;height:44px}', ['btn'])).toEqual(none);
    expect(errs('.btn{height:44px;height:20px}').length).toBe(1);
    expect(errs('.btn{height:20px!important}').length).toBe(1);
    expect(errs('.btn{height:20px ! important}').length).toBe(1);
  });
  it('a size with spaces, upper case or a tab is read', () => {
    expect(errs('.btn{ HEIGHT : 20PX }').length).toBe(1);
    expect(errs('.btn{\n\theight:\t20px;\n}').length).toBe(1);
  });
  it('a rule with no width or height says nothing', () => {
    expect(checkTapTargets('.btn{padding:0;color:red;border:2px solid}', ['btn'])).toEqual(none);
  });
  it('line-height, max-height and a property that only ends like height are not the size', () => {
    expect(checkTapTargets('.btn{line-height:10px;max-height:10px;max-width:10px;x-height:10px;border-width:1px}', ['btn'])).toEqual(none);
  });
});

describe('checkTapTargets: which rules are about a control', () => {
  it('a tag of a control is a control with no class given', () => {
    for (const t of ['button', 'a', 'summary', 'select', 'textarea', 'input'])
      expect(checkTapTargets(`${t}{height:20px}`).errors.length).toBe(1);
  });
  it('a tag that only starts like a control is not one', () => {
    expect(checkTapTargets('abbr{height:20px}article{height:20px}aside{height:20px}buttons{height:20px}inputs{height:20px}selection{height:20px}').errors).toEqual([]);
  });
  it('a part that is not a control and not in the list is not judged', () => {
    expect(checkTapTargets('.card{height:20px}div{width:10px}.logo{width:30px;height:30px}span{height:5px}h2{height:2px}', ['btn', 'dot'])).toEqual(none);
  });
  it('a class counts only when it is in the list', () => {
    expect(errs('.logo{width:20px}', ['btn']).length).toBe(0);
    expect(errs('.logo{width:20px}', ['logo']).length).toBe(1);
  });
  it('the class list may be left out or be something else', () => {
    expect(checkTapTargets('.btn{height:20px}').errors).toEqual([]);
    expect(checkTapTargets('.btn{height:20px}', 'btn' as any).errors).toEqual([]);
    expect(checkTapTargets('.btn{height:20px}', [5, null, 'btn'] as any).errors.length).toBe(1);
  });
  it('only the LAST part of a selector counts', () => {
    expect(checkTapTargets('.foot-row a{min-height:44px;min-width:44px}')).toEqual(none);
    expect(errs('.menu nav a{height:20px}').length).toBe(1);
    expect(checkTapTargets('a .icon{width:16px;height:16px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn .icon{width:16px;height:16px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('button > svg{width:16px;height:16px}', ['btn'])).toEqual(none);
  });
  it('a child, a next and a later sibling combinator end the part', () => {
    expect(errs('.x > .btn{height:20px}').length).toBe(1);
    expect(errs('.x + .btn{height:20px}').length).toBe(1);
    expect(errs('.x ~ .btn{height:20px}').length).toBe(1);
    expect(errs('.x>.btn{height:20px}').length).toBe(1);
    expect(checkTapTargets('.btn>.x{height:20px}', ['btn'])).toEqual(none);
  });
  it('a combinator with no space around it ends the part too', () => {
    expect(errs('.x~.btn{height:20px}').length).toBe(1);
    expect(errs('.x+.btn{height:20px}').length).toBe(1);
    expect(errs('.x>.btn{height:20px}').length).toBe(1);
    expect(checkTapTargets('.btn~.x{height:20px}.btn+.x{height:20px}.btn>.x{height:20px}', ['btn'])).toEqual(none);
  });
  it('spaces inside an attribute selector do not split the part', () => {
    expect(errs('input[ type = text ]{height:20px}').length).toBe(1);
    expect(errs('.x [ role = button ]{height:20px}').length).toBe(1);
  });
  it('a list of selectors: one control among others is enough, and it is named', () => {
    const e = errs('.card, .btn, .x{height:20px}');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/^"\.btn" is drawn/);
    expect(checkTapTargets('.card, .x{height:20px}', ['btn'])).toEqual(none);
  });
  it('two controls in one list give two messages', () => {
    expect(errs('.btn, .dot{height:20px}', ['btn', 'dot']).length).toBe(2);
  });
  it('a class with a hyphen or an underscore and a compound of two classes', () => {
    expect(errs('.cf-send{height:20px}', ['cf-send']).length).toBe(1);
    expect(errs('.my_btn{height:20px}', ['my_btn']).length).toBe(1);
    expect(errs('.btn.ico{height:20px}', ['btn']).length).toBe(1);
    expect(errs('.btn.ico{height:20px}', ['ico']).length).toBe(1);
  });
  it('a state of a control is judged (:hover, :focus, :disabled, :not())', () => {
    expect(errs('.btn:hover{height:20px}').length).toBe(1);
    expect(errs('.btn:focus-visible{height:20px}').length).toBe(1);
    expect(errs('.btn:disabled{height:20px}').length).toBe(1);
    expect(errs('.btn:not(.big){height:20px}').length).toBe(1);
    expect(errs('.x:not(.a .b) .btn{height:20px}').length).toBe(1);
    expect(errs('.btn:nth-child(2n+1){height:20px}').length).toBe(1);
  });
  it('a ::before or ::after is not the control', () => {
    expect(checkTapTargets('.btn::before{width:6px;height:6px}.btn::after{width:6px;height:6px}.btn:before{width:6px;height:6px}.btn:after{width:6px;height:6px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('summary::marker{width:6px}input::placeholder{height:6px}.btn::-webkit-scrollbar{width:4px}', ['btn']).errors).toEqual([]);
  });
  it('an attribute selector: type, role and the scoped Astro attribute', () => {
    expect(errs('input[type=text]{height:20px}').length).toBe(1);
    expect(errs('.cform input[type="text"]{height:20px}').length).toBe(1);
    expect(errs('[role=button]{height:20px}').length).toBe(1);
    expect(errs('[role="button"]{height:20px}').length).toBe(1);
    expect(errs('.btn[data-astro-cid-abc123]{height:20px}').length).toBe(1);
    expect(errs('a[href^="http"]{height:20px}').length).toBe(1);
    expect(checkTapTargets('input[type=time]{min-height:44px}')).toEqual(none);
  });
  it('a quoted type is read the same as an unquoted one (not square, so the box rule cannot hide a mistake)', () => {
    expect(checkTapTargets('input[type="checkbox"]{width:16px;height:30px}input[type=\'radio\']{width:16px;height:30px}input[type="hidden"]{width:3px;height:30px}', [])).toEqual(none);
    expect(checkTapTargets('input[type="text"]{width:16px;height:30px}', []).errors.length).toBe(1);
    expect(checkTapTargets('input[ type = "checkbox" ]{width:16px;height:30px}', [])).toEqual(none); // spaces inside the brackets are fine too
  });
  it('a checkbox, a radio and a hidden input are not judged by size', () => {
    expect(checkTapTargets('input[type=checkbox]{width:16px;height:16px}input[type="radio"]{width:14px;height:14px}input[type=hidden]{width:0;height:0}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.notify input[type=checkbox]{width:16px;height:16px}', ['btn'])).toEqual(none);
  });
  it('a square input with no type up to 32px is a box of a checkbox or a radio; any other size is judged', () => {
    expect(checkTapTargets('.notify-opt input{width:22px;height:22px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('input{width:32px;height:32px}', [])).toEqual(none);
    expect(checkTapTargets('input{width:33px;height:33px}', []).warnings.length).toBe(1);
    expect(checkTapTargets('input{width:22px;height:30px}', []).errors.length).toBe(1);
    expect(checkTapTargets('input{height:20px}', []).errors.length).toBe(1);
  });
  it('an input of text type with a small square size is judged', () => {
    expect(checkTapTargets('input[type=text]{width:22px;height:22px}', []).errors.length).toBe(1);
  });
});

describe('checkTapTargets: rules that are left out', () => {
  it('display none is left out', () => {
    expect(checkTapTargets('.btn{display:none;width:10px;height:10px}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{display:NONE;height:10px}', ['btn'])).toEqual(none);
    expect(errs('.btn{display:block;height:10px}').length).toBe(1);
  });
  it('box-sizing content-box is left out (the padding is not counted here)', () => {
    expect(checkTapTargets('.btn{box-sizing:content-box;height:20px;padding:12px}', ['btn'])).toEqual(none);
    expect(errs('.btn{box-sizing:border-box;height:20px}').length).toBe(1);
  });
  it('a thing of 1px by 1px (a hidden trap field) is left out; 1px on one side only is not', () => {
    expect(checkTapTargets('.btn{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{width:0;height:0}', ['btn'])).toEqual(none);
    expect(errs('.btn{width:1px}').length).toBe(1);
    expect(errs('.btn{width:1px;height:30px}').length).toBe(1);
  });
  it('inside @media print, @keyframes, @font-face and @page nothing is judged', () => {
    expect(checkTapTargets('@media print{.btn{height:20px}}@media(print){.btn{height:20px}}@media only print and (min-width:1px){.btn{height:20px}}', ['btn'])).toEqual(none);
    expect(checkTapTargets('@keyframes k{from{width:0}to{width:10px}}@-webkit-keyframes k{0%{height:0}}@font-face{font-family:x;src:url(a.woff2);width:0}@page{height:20px}', ['btn'])).toEqual(none);
  });
  it('a control rule written inside @keyframes, @font-face or @page is left out', () => {
    expect(checkTapTargets('@keyframes k{button{height:1px}a{width:1px;height:5px}}@-webkit-keyframes k{button{height:1px}}', [])).toEqual(none);
    expect(checkTapTargets('@font-face{button{height:1px}}@page{button{height:1px}}', [])).toEqual(none);
    expect(checkTapTargets('@keyframes k{button{height:1px}}button{height:20px}', []).errors.length).toBe(1);
  });
  it('inside a media query for a mouse only (pointer: fine, hover: hover) nothing is judged', () => {
    expect(checkTapTargets('@media (pointer:fine){.btn{height:20px}}', ['btn'])).toEqual(none);
    expect(checkTapTargets('@media (any-pointer: fine) and (min-width:1px){.btn{height:20px}}', ['btn'])).toEqual(none);
    expect(checkTapTargets('@media (hover:hover){.btn{height:20px}}', ['btn'])).toEqual(none);
    expect(checkTapTargets('@media(hover: hover) and (pointer: fine){.btn{height:20px}}', ['btn'])).toEqual(none);
  });
  it('a media query for a phone or a touch screen is judged, also when nested', () => {
    expect(errs('@media(max-width:767px){.btn{height:20px}}').length).toBe(1);
    expect(errs('@media (pointer:coarse){.btn{height:20px}}').length).toBe(1);
    expect(errs('@media (hover:none){.btn{height:20px}}').length).toBe(1);
    expect(errs('@media screen{@media(max-width:380px){.btn{height:20px}}}').length).toBe(1);
    expect(errs('@supports (display:grid){@media(max-width:380px){.btn{height:20px}}}').length).toBe(1);
    expect(errs('@layer base{.btn{height:20px}}').length).toBe(1);
  });
  it('a print block inside another block is still left out, and a rule after it is judged', () => {
    const css = '@media screen{@media print{.btn{height:20px}}.btn{height:10px}}';
    expect(errs(css)).toEqual([expect.stringMatching(/10px tall/)]);
  });
});

describe('checkTapTargets: reading the style', () => {
  it('a comment is not a rule', () => {
    expect(checkTapTargets('/* .btn{height:20px} */.btn{height:44px}/* x */', ['btn'])).toEqual(none);
    expect(checkTapTargets('.btn{/* height:20px; */height:44px}', ['btn'])).toEqual(none);
  });
  it('a string or a url with a brace does not break the reading', () => {
    expect(errs('.x::before{content:"}"}.btn{height:20px}').length).toBe(1);
    expect(errs(".x::before{content:'{'}.btn{height:20px}").length).toBe(1);
    expect(errs('.x{background:url(data:image/svg+xml;utf8,<svg xmlns="x">{</svg>)}.btn{height:20px}').length).toBe(1);
    expect(errs('.x::before{content:"a;b"}.btn{height:20px}').length).toBe(1);
  });
  it('a brace inside a string or a url cannot pull the next rule into a print block', () => {
    expect(errs('@media print{.x::before{content:"{"}}.btn{height:20px}').length).toBe(1);
    expect(errs("@media print{.x::before{content:'{'}}.btn{height:20px}").length).toBe(1);
    expect(errs('@media print{.x{background:url(data:image/svg+xml;utf8,<svg>{</svg>)}}.btn{height:20px}').length).toBe(1);
    expect(errs('@media print{.x{background:url( "a{b.png" )}}.btn{height:20px}').length).toBe(1);
  });
  it('@import and @charset lines before a rule do not hide it', () => {
    expect(errs('@charset "utf-8";@import url(x.css);.btn{height:20px}').length).toBe(1);
  });
  it('the same rule many times (the style is inside every page) is one message', () => {
    const one = '.btn{height:20px}.dot{height:30px}';
    const r = checkTapTargets(one.repeat(17), ['btn', 'dot']);
    expect(r.errors.length).toBe(1);
    expect(r.warnings.length).toBe(1);
  });
  it('errors and warnings are kept apart', () => {
    const r = checkTapTargets('.btn{height:20px}.dot{height:30px}', ['btn', 'dot']);
    expect(r.errors[0]).toMatch(/"\.btn"/);
    expect(r.warnings[0]).toMatch(/"\.dot"/);
  });
  it('a long selector is shortened in the message', () => {
    const sel = '.a-very-long-class-name-one .a-very-long-class-name-two .a-very-long-class-name-three button';
    const e = errs(`${sel}{height:20px}`);
    expect(e[0]).toMatch(/^"[^"]{57}\.\.\." is drawn/);
  });
  it('a selector with new lines and many spaces is written on one line', () => {
    expect(errs('.menu\n   nav\n\ta{height:20px}')[0]).toMatch(/^"\.menu nav a" is drawn/);
  });
  it('a style with no closing brace or with extra braces does not crash', () => {
    expect(() => checkTapTargets('.btn{height:20px', ['btn'])).not.toThrow();
    expect(() => checkTapTargets('}}}.btn{height:20px}{{', ['btn'])).not.toThrow();
    expect(errs('}}}.btn{height:20px}').length).toBe(1);
    expect(() => checkTapTargets('{}{}{', [])).not.toThrow();
  });
  it('a rule with no selector says nothing', () => {
    expect(checkTapTargets('{height:20px}', ['btn'])).toEqual(none);
  });
  it('the real rules of this site: no error and no warning (the colour dots are 44px since v0.101.112)', () => {
    const css = '.btn{display:inline-grid;place-items:center;min-width:44px;height:44px;padding:0 12px}' +
      '.dot{width:44px;height:44px;border-radius:50%;border:2px solid var(--line);cursor:pointer;padding:0}' +
      '.foot-row a{display:inline-flex;min-height:44px;min-width:44px;padding:0 4px}' +
      '.cform input,.cform textarea{display:block;width:100%;min-height:44px;padding:10px 12px}.cform textarea{min-height:150px}' +
      '.cf-hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}' +
      '.push-prompt-ico{display:inline-grid;width:44px;height:44px}.notify-opt{display:flex;min-height:44px}.notify-opt input{width:22px;height:22px;accent-color:var(--acc)}' +
      '.notify input[type=time]{min-height:44px}.notify select{min-height:44px}.logo{width:38px;height:38px}@media(max-width:767px){.logo{width:34px;height:34px}}' +
      '.sr{position:absolute;width:1px;height:1px;overflow:hidden}.thumb{aspect-ratio:16/9;width:100%}.ava{width:56px;height:56px}';
    const r = checkTapTargets(css, ['brand', 'btn', 'dot', 'skip', 'cf-send']);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const shell = (css: string, body: string) =>
    `<!doctype html><html lang="en"><head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}${css}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
    `<body data-page-type="404"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'tt-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('big controls pass with no tap message', () => {
    const r = run(shell('.tiny{min-width:44px;height:44px}', '<button class="tiny" aria-label="Go">Go</button>'));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
    expect(r.stderr).not.toMatch(/tap target|finger/);
  });
  it('a button drawn under 24px stops the build and the message names the rule', () => {
    const r = run(shell('.tiny{width:20px;height:20px}', '<button class="tiny" aria-label="Go">Go</button>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/dist: "\.tiny" is drawn 20px wide and 20px tall; a tap target must be at least 24px/);
  });
  it('a button of 38px only warns', () => {
    const r = run(shell('.tiny{width:38px;height:38px}', '<button class="tiny" aria-label="Go">Go</button>'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn: dist: "\.tiny" is drawn 38px wide and 38px tall/);
  });
  it('a small size on a class that sits on no control is not judged', () => {
    const r = run(shell('.tiny{width:10px;height:10px}', '<div class="tiny"></div>'));
    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/tap target|finger/);
  });
  it('a link with a class counts as a control, a link without href does not', () => {
    expect(run(shell('.tiny{height:10px}', '<a class="tiny" href="/x/">Go</a>')).status).toBe(1);
    expect(run(shell('.tiny{height:10px}', '<a class="tiny">Go</a>')).status).toBe(0);
  });
  it('a plain button tag with a small size stops the build with no class at all', () => {
    const r = run(shell('button{height:16px}', '<button aria-label="Go">Go</button>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/"button" is drawn 16px tall/);
  });
});
