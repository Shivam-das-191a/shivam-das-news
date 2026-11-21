import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkHandlers } from '../../scripts/handler-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const btn = (attr: string) => `<button ${attr}>x</button>`;
const err = (attr: string) => checkHandlers(btn(attr)).errors;
const warn = (attr: string) => checkHandlers(btn(attr)).warnings;

describe('checkHandlers: good pages', () => {
  it('a plain page passes', () => { expect(checkHandlers('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkHandlers(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkHandlers('')).toEqual(none); });
  it('a page with no handler passes', () => { expect(checkHandlers('<a href="/x/" class="a" id="i" title="online">x</a><button type="button" data-open="1">y</button>')).toEqual(none); });
  it('a working handler has no error', () => { expect(checkHandlers(btn('onclick="go()"')).errors).toEqual([]); });
  it('every common event name is known', () => {
    const names = ['onclick', 'onload', 'onerror', 'onsubmit', 'onchange', 'oninput', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onmouseover', 'onmouseout', 'onscroll', 'onresize', 'ontouchstart', 'onpointerdown', 'ontoggle', 'onplay', 'onended', 'ondblclick', 'oncontextmenu', 'onpaste', 'oncopy'];
    for (const n of names) expect(checkHandlers(`<div ${n}="go()">x</div>`).errors).toEqual([]);
  });
  it('the case of the name is not read', () => { expect(checkHandlers('<a onClick="go()">x</a><a ONCLICK="go()">y</a>').errors).toEqual([]); });
  it('code with a return passes', () => { expect(checkHandlers(btn('onclick="return false;"')).errors).toEqual([]); });
  it('code with several statements passes', () => { expect(checkHandlers(btn('onclick="a(); b(); if (c) { d() }"')).errors).toEqual([]); });
  it('code that uses the event passes', () => { expect(checkHandlers(btn('onclick="event.preventDefault();this.classList.toggle(\'on\')"')).errors).toEqual([]); });
  it('quote characters written as entities are read', () => { expect(checkHandlers('<a onclick="go(&quot;a&quot;)">x</a>').errors).toEqual([]); });
  it('single quotes around the value pass', () => { expect(checkHandlers('<a onclick=\'go("a")\'>x</a>').errors).toEqual([]); });
  it('a value with no quotes passes', () => { expect(checkHandlers('<a onclick=go()>x</a>').errors).toEqual([]); });
  it('a name that is not close to any event is left alone', () => { expect(checkHandlers('<a online="x" onfoobarbaz="y" onceonly="z">x</a>').errors).toEqual([]); });
  it('framework words are not read', () => { expect(checkHandlers('<a x-on:click="a" @click="b" v-on:click="c" data-onclick="d" :onclick="e">x</a>').errors).toEqual([]); });
  it('an attribute that only holds the word in its value passes', () => { expect(checkHandlers('<a title="onclik" data-a="onclick=go()">x</a>')).toEqual(none); });
  it('a template expression is not read', () => {
    expect(checkHandlers('<a onclick={fn}>x</a><a onclick={() => go()}>y</a><a onclick="${code}">z</a>')).toEqual(none);
  });
  it('a custom element is read', () => { expect(checkHandlers('<my-box onclik="go()">x</my-box>').errors).toHaveLength(1); });
  it('the words in the text of a page pass', () => { expect(checkHandlers('<p>Write onclik="go(" in a tag.</p>')).toEqual(none); });
  it('a tag that holds a greater than sign in another attribute is read', () => { expect(checkHandlers('<a title="a > b" onclik="go()">x</a>').errors).toHaveLength(1); });
  it('the real templates pass with no message', () => {
    for (const f of ['src/layouts/Base.astro', 'src/components/PostCard.astro', 'src/components/Header.astro', 'src/components/Footer.astro', 'src/components/ContactForm.astro', 'src/pages/notifications.astro', 'src/pages/index.astro', 'src/pages/404.astro'])
      expect(checkHandlers(readFileSync(f, 'utf8'))).toEqual(none);
  });
});

describe('checkHandlers: errors', () => {
  it('a typo of an event is an error with a plain message', () => {
    expect(err('onclik="go()"')).toEqual(['a <button> has an onclik attribute; it is not a real event, so nothing ever runs; it looks like a typo of onclick']);
  });
  it('onlaod, onsumbit, onchnage and onmouseovr are errors', () => {
    expect(checkHandlers('<body onlaod="a()">').errors).toHaveLength(1);
    expect(checkHandlers('<form onsumbit="a()">').errors).toHaveLength(1);
    expect(checkHandlers('<input onchnage="a()">').errors).toHaveLength(1);
    expect(checkHandlers('<div onmouseovr="a()">').errors).toHaveLength(1);
  });
  it('a typo in capital letters is found', () => { expect(err('onClik="go()"')).toHaveLength(1); });
  it('a typo with a missing letter is found', () => { expect(err('onclck="go()"')).toHaveLength(1); });
  it('a typo with an extra letter is found', () => { expect(err('oncclick="go()"')).toHaveLength(1); });
  it('a typo with no value is still an error', () => { expect(err('onclik')).toHaveLength(1); });
  it('a bracket never closed is an error', () => {
    const e = err('onclick="go("');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/whose code is not valid JavaScript \(.+\), so it never runs; code: go\(/);
  });
  it('a quote never closed is an error', () => { expect(err('onclick="go(\'a)"')[0]).toMatch(/not valid JavaScript/); });
  it('a brace never closed is an error', () => { expect(err('onclick="if (a) { b()"')[0]).toMatch(/not valid JavaScript/); });
  it('a stray word is an error', () => { expect(err('onclick="go() now"')[0]).toMatch(/not valid JavaScript/); });
  it('a plain sentence is an error', () => { expect(err('onclick="open the menu"')[0]).toMatch(/not valid JavaScript/); });
  it('a long code is cut in the message', () => { expect(err('onclick="' + 'a('.repeat(60) + '"')[0].length).toBeLessThan(220); });
  it('the tag name is in the message', () => {
    expect(checkHandlers('<DIV onclik="a()">x</DIV>').errors[0]).toMatch(/^a <div> has an onclik attribute/);
  });
  it('the same fault on many tags is told once', () => { expect(checkHandlers('<a onclik="a()">1</a>'.repeat(5)).errors).toHaveLength(1); });
  it('different faults on different tags are all told', () => { expect(checkHandlers('<a onclik="a()">1</a><b onclick="a(">2</b><i onlaod="x">3</i>').errors).toHaveLength(3); });
  it('both a typo and a bad code on one tag are told', () => { expect(checkHandlers('<a onclik="a()" onclick="b(">x</a>').errors).toHaveLength(2); });
  it('the code of a javascript: label with a fault is an error', () => { expect(err('onclick="javascript:go("')[0]).toMatch(/not valid JavaScript/); });
  it('the code is never run', () => {
    (globalThis as any).__ran = false;
    checkHandlers(btn('onclick="globalThis.__ran = true"'));
    expect((globalThis as any).__ran).toBe(false);
  });
  it('code that would throw when run is only compiled, so it passes', () => { expect(checkHandlers(btn('onclick="undefinedThing.call()"')).errors).toEqual([]); });
});

describe('checkHandlers: warnings', () => {
  it('an empty handler is a warning', () => {
    expect(checkHandlers(btn('onclick=""'))).toEqual({ errors: [], warnings: ['a <button> has an onclick attribute that is empty and does nothing; remove it'] });
    expect(warn('onclick="   "')).toHaveLength(1);
    expect(warn('onclick')).toHaveLength(1);
  });
  it('a javascript: label is a warning', () => { expect(warn('onclick="javascript:go()"')).toContain('a <button> has an onclick attribute whose code starts with javascript:; the word is only a label there, remove it'); });
  it('a working inline handler is no warning and no error', () => { expect(checkHandlers(btn('onclick="go()"'))).toEqual(none); });
  it('many working handlers on many tags are quiet', () => { expect(checkHandlers('<a onclick="a()">x</a><form onsubmit="return false">y</form>'.repeat(5))).toEqual(none); });
  it('a bad code gets the error and no warning', () => { expect(checkHandlers(btn('onclick="go("')).warnings).toEqual([]); });
  it('a warning does not stop the page: errors stay empty', () => { expect(checkHandlers(btn('onclick="javascript:go()"')).errors).toEqual([]); });
});

describe('checkHandlers: what is left out', () => {
  it('text inside a script, a style block, a template and a comment is not read', () => {
    const h = '<script>var a = \'<a onclik="x(">\';</script><style>p::after{content:\'<i onlaod="">\'}</style><template><a onclik="x(">y</a></template><!-- <a onclik="x("> --><p>ok</p>';
    expect(checkHandlers(h)).toEqual(none);
  });
  it('a script with attributes is skipped', () => { expect(checkHandlers('<script type="module" async>const s = \'<a onclik="x(">\';</script>')).toEqual(none); });
  it('the code is not judged, only its syntax', () => { expect(checkHandlers(btn('onclick="nothingDefined(1,2,3)"')).errors).toEqual([]); });
  it('an on word that is not close to any event is not an error', () => { expect(checkHandlers('<a onwhatever="x" onfoo="y">z</a>').errors).toEqual([]); });
  it('an attribute that is just on is left alone', () => { expect(checkHandlers('<a on="x" onx="y">z</a>').errors).toEqual([]); });
  it('an attribute with digits is left alone', () => { expect(checkHandlers('<a onclick2="x" on1="y">z</a>').errors).toEqual([]); });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkHandlers('<main>' + '<p class="a b" id="i" data-x="1">text <a href="/x/" title="t">link</a></p><button onclick="go(1)">b</button>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'hand-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p>')).code).toBe(0); });
  it('a typo of an event stops the build and names the page', () => {
    const r = run(FULL('<p><button type="button" onclik="go()">x</button></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <button> has an onclik attribute; it is not a real event/);
  });
  it('code with a bracket never closed stops the build', () => {
    const r = run(FULL('<p><button type="button" onclick="go(">x</button></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/whose code is not valid JavaScript/);
  });
  it('a javascript: label is a warning, not an error', () => {
    const r = run(FULL('<p><button type="button" onclick="javascript:go()">x</button></p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*code starts with javascript:/);
  });
  it('a working inline handler passes with no message', () => {
    const r = run(FULL('<p><button type="button" onclick="go()">x</button></p>'));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/onclick/);
  });
});
