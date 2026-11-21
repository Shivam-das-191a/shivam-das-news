import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkRefs } from '../../scripts/ref-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<table><caption>c</caption><tr><th id="a" scope="col">A</th><th id="b" scope="col">B</th></tr><tr><td headers="a b">1</td></tr></table><form id="f" action="/s/"><input id="x" name="x"></form><input name="q" list="l" form="f"><datalist id="l"><option value="a"></option></datalist><output for="x" name="o"></output><button popovertarget="p" type="button">Open</button><div id="p" popover>Hi</div>';

describe('checkRefs: good pages', () => {
  it('a plain page passes', () => { expect(checkRefs('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkRefs(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkRefs('')).toEqual(none); });
  it('every reference to a real element passes', () => { expect(checkRefs(GOOD)).toEqual(none); });
  it('a target may come after the pointer', () => { expect(checkRefs('<input list="l"><datalist id="l"></datalist>')).toEqual(none); });
  it('a th may point to another th', () => { expect(checkRefs('<th id="a">A</th><th id="b" headers="a">B</th>')).toEqual(none); });
  it('an empty headers, list, form and popovertarget are left alone', () => { expect(checkRefs('<td headers="">a</td><input list=""><input form=""><button popovertarget="">x</button>')).toEqual(none); });
  it('an output with no for passes', () => { expect(checkRefs('<output name="o"></output>')).toEqual(none); });
  it('a headers list with extra spaces passes', () => { expect(checkRefs('<th id="a">A</th><th id="b">B</th><td headers="  a   b ">1</td>')).toEqual(none); });
  it('a popover button on an input passes', () => { expect(checkRefs('<input type="button" popovertarget="p" value="o"><div id="p" popover="manual"></div>')).toEqual(none); });
  it('a form attribute on a select, textarea and fieldset passes', () => { expect(checkRefs('<form id="f"></form><select form="f"></select><textarea form="f"></textarea><fieldset form="f"></fieldset>')).toEqual(none); });
  it('the words headers and list in text pass', () => { expect(checkRefs('<p>Write headers="x" in a td and list="y" in an input.</p>')).toEqual(none); });
});

describe('checkRefs: errors', () => {
  it('headers to a missing id is an error', () => { expect(checkRefs('<td headers="h1">1</td>').errors).toEqual(['a <td headers="h1"> names an id that is not on the page; point it at the id of a <th> in the same table']); });
  it('every name in a headers list is read', () => { expect(checkRefs('<th id="a">A</th><td headers="a b c">1</td>').errors).toHaveLength(2); });
  it('headers on a th is read too', () => { expect(checkRefs('<th headers="x">A</th>').errors).toHaveLength(1); });
  it('list to a missing id is an error', () => { expect(checkRefs('<input list="cities">').errors).toEqual(['an <input list="cities"> names an id that is not on the page, so the field shows no suggestions; add a <datalist> with that id']); });
  it('form to a missing id is an error', () => { expect(checkRefs('<input form="signup">').errors).toEqual(['an <input form="signup"> names an id that is not on the page, so the field belongs to no form and is never sent; point it at the id of a <form>']); });
  it('form is read on a button, select, textarea, output, fieldset, object, meter and progress', () => {
    expect(checkRefs('<button form="a"></button><select form="b"></select><textarea form="c"></textarea><output form="d"></output><fieldset form="e"></fieldset><object form="f"></object><meter form="g"></meter><progress form="h"></progress>').errors).toHaveLength(8);
  });
  it('for on an output to a missing id is an error', () => { expect(checkRefs('<output for="x y"></output>').errors).toHaveLength(2); });
  it('popovertarget to a missing id is an error', () => { expect(checkRefs('<button popovertarget="menu">m</button>').errors).toEqual(['a <button popovertarget="menu"> names an id that is not on the page, so the button does nothing; point it at the id of the element to show']); });
  it('popovertarget on an input is read', () => { expect(checkRefs('<input type="button" popovertarget="menu">').errors).toHaveLength(1); });
  it('an id is read with its case', () => { expect(checkRefs('<div id="Menu"></div><button popovertarget="menu"></button>').errors).toHaveLength(1); });
  it('the case of the tag and the attribute is not read', () => { expect(checkRefs('<INPUT LIST="nope">').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkRefs("<input list='nope'>").errors).toHaveLength(1);
    expect(checkRefs('<input list=nope>').errors).toHaveLength(1);
    expect(checkRefs('<input list=l><datalist id=l></datalist>')).toEqual(none);
  });
  it('a greater-than sign in a value does not cut the tag', () => { expect(checkRefs('<input title="a > b" list="nope">').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkRefs('<input list="nope"><input list="nope">').errors).toHaveLength(1); });
  it('a long name is shortened in the message', () => {
    const r = checkRefs('<input list="' + 'a'.repeat(100) + '">');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(220);
  });
  it('an empty id does not count as a target', () => { expect(checkRefs('<div id=""></div><input list="">')).toEqual(none); });
});

describe('checkRefs: warnings', () => {
  it('headers to something that is not a th is a warning', () => { expect(checkRefs('<td id="a">A</td><td headers="a">1</td>').warnings).toEqual(['a <td headers="a"> points to a <td>, not a <th>; point it at the id of a <th>']); });
  it('list to something that is not a datalist is a warning', () => { expect(checkRefs('<ul id="l"></ul><input list="l">').warnings).toEqual(['an <input list="l"> points to an <ul>, not a <datalist>, so the field shows no suggestions']); });
  it('form to something that is not a form is a warning', () => { expect(checkRefs('<div id="f"></div><input form="f">').warnings).toEqual(['an <input form="f"> points to a <div>, not a <form>, so the field is never sent']); });
  it('popovertarget to an element with no popover is a warning', () => { expect(checkRefs('<div id="p"></div><button popovertarget="p">x</button>').warnings).toEqual(['a <button popovertarget="p"> points to an element with no popover attribute, so the button does nothing; add popover to it']); });
  it('an empty popover attribute counts as a popover', () => { expect(checkRefs('<div id="p" popover></div><button popovertarget="p">x</button>')).toEqual(none); });
  it('the same warning is not printed twice', () => { expect(checkRefs('<div id="p"></div><button popovertarget="p"></button><button popovertarget="p"></button>').warnings).toHaveLength(1); });
  it('a warning never becomes an error', () => { expect(checkRefs('<div id="d"></div><td headers="d"></td><input list="d" form="d"><button popovertarget="d"></button>').errors).toEqual([]); });
  it('the first element with an id is the target', () => { expect(checkRefs('<th id="a">A</th><div id="a"></div><td headers="a">1</td>')).toEqual(none); });
});

describe('checkRefs: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <input list="x"> --><script>var s = \'<td headers="y">\';</script><style>a:after{content:"<input form=z>"}</style><template><button popovertarget="q"></button></template>';
    expect(checkRefs(extra + '<p>ok</p>')).toEqual(none);
  });
  it('an id inside a template does not count as a target', () => { expect(checkRefs('<template><datalist id="l"></datalist></template><input list="l">').errors).toHaveLength(1); });
  it('text after a comment is still read', () => { expect(checkRefs('<!-- x --><input list="nope">').errors).toHaveLength(1); });
  it('label for and the aria references are not read', () => { expect(checkRefs('<label for="nope">a</label><div aria-labelledby="no" aria-describedby="no" aria-controls="no"></div>')).toEqual(none); });
  it('an attribute on another tag is not read', () => { expect(checkRefs('<div headers="x" list="y" popovertarget="z" for="w"></div><a form="x"></a>')).toEqual(none); });
  it('a custom element that starts with a listed word is not read', () => { expect(checkRefs('<input-box list="x"></input-box><td-cell headers="y"></td-cell><button-x popovertarget="z"></button-x>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkRefs('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkRefs(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkRefs(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'ref-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p><button type="button" popovertarget="p">Open</button><div id="p" popover>Hi</div>')).code).toBe(0); });
  it('a td headers to a missing id stops the build and names the page', () => {
    const r = run(FULL('<table><caption>c</caption><tr><th scope="col">a</th></tr><tr><td headers="h1">b</td></tr></table>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <td headers="h1"> names an id that is not on the page/);
  });
  it('a popovertarget to a missing id stops the build', () => {
    const r = run(FULL('<button type="button" popovertarget="menu">Open</button>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/names an id that is not on the page, so the button does nothing/);
  });
  it('a popovertarget to an element with no popover is a warning, not an error', () => {
    const r = run(FULL('<button type="button" popovertarget="p">Open</button><div id="p">Hi</div>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*points to an element with no popover attribute/);
  });
});
