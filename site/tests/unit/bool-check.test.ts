import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkBools } from '../../scripts/bool-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<form novalidate action="/s/"><input name="a" required disabled readonly checked multiple autofocus><select name="s" multiple required><option selected disabled>x</option></select><textarea name="t" readonly></textarea><button formnovalidate disabled="disabled">Go</button></form><details open><summary>s</summary>t</details><dialog open></dialog><video controls autoplay="" loop muted playsinline></video><audio controls loop></audio><script async defer src="/a.js"></script><script nomodule src="/b.js"></script><ol reversed><li>a</li></ol><img src="/a.png" alt="a" ismap><iframe title="t" src="https://x.org/" allowfullscreen></iframe><video><track default src="/t.vtt"></video><div hidden inert itemscope></div>';

describe('checkBools: good pages', () => {
  it('a plain page passes', () => { expect(checkBools('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkBools(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkBools('')).toEqual(none); });
  it('every on/off attribute written the right way passes', () => { expect(checkBools(GOOD)).toEqual(none); });
  it('the attribute with its own name passes, in any case', () => { expect(checkBools('<input disabled="DISABLED"><input CHECKED="Checked">')).toEqual(none); });
  it('an empty value passes in all three quote styles', () => { expect(checkBools("<input disabled=\"\"><input disabled=''><input disabled=>")).toEqual(none); });
  it('hidden until-found passes', () => { expect(checkBools('<div hidden="until-found">x</div><div hidden="Until-Found">y</div>')).toEqual(none); });
  it('hidden with its own name or no value passes', () => { expect(checkBools('<p hidden>a</p><p hidden="hidden">b</p><p hidden="">c</p>')).toEqual(none); });
  it('aria attributes with false pass', () => { expect(checkBools('<button aria-disabled="false" aria-hidden="false" aria-checked="false" aria-expanded="false" aria-selected="false">x</button>')).toEqual(none); });
  it('data attributes with false pass', () => { expect(checkBools('<div data-disabled="false" data-open="0" data-hidden="no">x</div>')).toEqual(none); });
  it('contenteditable, draggable and spellcheck with false pass', () => { expect(checkBools('<div contenteditable="false" draggable="false" spellcheck="false">x</div>')).toEqual(none); });
  it('the words in text pass', () => { expect(checkBools('<p>Write disabled="false" or checked="0" in a tag.</p>')).toEqual(none); });
  it('a value that has the word inside passes quietly when the attribute is not read', () => { expect(checkBools('<a href="/x/" title="disabled=false">x</a>')).toEqual(none); });
  it('a custom tag is not read', () => { expect(checkBools('<input-box disabled="false"></input-box><my-details open="no"></my-details>')).toEqual(none); });
});

describe('checkBools: errors', () => {
  it('disabled false is an error with a plain message', () => {
    expect(checkBools('<input disabled="false">').errors).toEqual(['an <input disabled="false"> is still ON: an on/off attribute is on whenever it is there, whatever its value says; delete disabled to switch it off']);
  });
  it('0, no and off are errors too', () => { expect(checkBools('<input checked="0"><input required="no"><input readonly="off">').errors).toHaveLength(3); });
  it('upper case values are read', () => { expect(checkBools('<input disabled="FALSE"><input checked="Off">').errors).toHaveLength(2); });
  it('spaces around the value are ignored', () => { expect(checkBools('<input disabled=" false ">').errors).toHaveLength(1); });
  it('no quotes and single quotes are read', () => {
    expect(checkBools('<input disabled=false>').errors).toHaveLength(1);
    expect(checkBools("<input checked='0'>").errors).toHaveLength(1);
  });
  it('the case of the tag and the attribute is not read', () => { expect(checkBools('<INPUT DISABLED="false">').errors).toHaveLength(1); });
  it('details open false is an error', () => { expect(checkBools('<details open="false"><summary>s</summary>t</details>').errors).toEqual(['a <details open="false"> is still ON: an on/off attribute is on whenever it is there, whatever its value says; delete open to switch it off']); });
  it('hidden false is an error on any tag', () => { expect(checkBools('<div hidden="false">x</div><p hidden="0">y</p>').errors).toHaveLength(2); });
  it('autofocus, inert and itemscope false are errors on any tag', () => { expect(checkBools('<div autofocus="false" inert="no" itemscope="0"></div>').errors).toHaveLength(3); });
  it('a video that plays by itself with autoplay false is an error', () => { expect(checkBools('<video autoplay="false" controls></video>').errors).toHaveLength(1); });
  it('controls, loop, muted and playsinline false are errors on a video', () => { expect(checkBools('<video controls="false" loop="no" muted="0" playsinline="off"></video>').errors).toHaveLength(4); });
  it('audio is read', () => { expect(checkBools('<audio controls="false"></audio>').errors).toHaveLength(1); });
  it('the opening tag of a script is read', () => { expect(checkBools('<script src="/a.js" async="false"></script>').errors).toEqual(['a <script async="false"> is still ON: an on/off attribute is on whenever it is there, whatever its value says; delete async to switch it off']); });
  it('defer and nomodule false are errors on a script', () => { expect(checkBools('<script src="/a.js" defer="false"></script><script src="/b.js" nomodule="no"></script>').errors).toHaveLength(2); });
  it('a form with novalidate false is an error', () => { expect(checkBools('<form novalidate="false" action="/s/"></form>').errors).toHaveLength(1); });
  it('formnovalidate false on a button and an input is read', () => { expect(checkBools('<button formnovalidate="false">x</button><input formnovalidate="0">').errors).toHaveLength(2); });
  it('selected false on an option is an error', () => { expect(checkBools('<select><option selected="false">a</option></select>').errors).toHaveLength(1); });
  it('multiple false on a select and an input is read', () => { expect(checkBools('<select multiple="false"></select><input type="file" multiple="no">').errors).toHaveLength(2); });
  it('disabled false on a fieldset, optgroup and textarea is read', () => { expect(checkBools('<fieldset disabled="false"></fieldset><optgroup disabled="no"></optgroup><textarea disabled="0"></textarea>').errors).toHaveLength(3); });
  it('reversed, ismap, allowfullscreen and default false are errors', () => {
    expect(checkBools('<ol reversed="false"></ol><img src="/a.png" alt="a" ismap="no"><iframe title="t" src="https://x.org/" allowfullscreen="0"></iframe><track default="off">').errors).toHaveLength(4);
  });
  it('a greater-than sign in another value does not cut the tag', () => { expect(checkBools('<input title="a > b" disabled="false">').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkBools('<input disabled="false"><input disabled="false">').errors).toHaveLength(1); });
  it('a long value is shortened in the message', () => {
    const r = checkBools('<input disabled="false">');
    expect(r.errors[0].length).toBeLessThan(220);
    const w = checkBools('<input disabled="' + 'a'.repeat(100) + '">');
    expect(w.warnings[0]).toContain('...');
    expect(w.warnings[0].length).toBeLessThan(220);
  });
  it('each wrong attribute of one tag is told', () => { expect(checkBools('<input disabled="false" checked="no" required="0">').errors).toHaveLength(3); });
});

describe('checkBools: warnings', () => {
  it('disabled true is a warning with a plain message', () => {
    expect(checkBools('<input disabled="true">').warnings).toEqual(['an <input disabled="true"> works, but write disabled with no value, or as disabled="disabled"']);
  });
  it('1, yes and on are warnings', () => { expect(checkBools('<input checked="1"><input required="yes"><input readonly="on">').warnings).toHaveLength(3); });
  it('another word is a warning, never an error', () => {
    const r = checkBools('<details open="open now"><summary>s</summary>t</details>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it('a warning never becomes an error', () => { expect(checkBools('<input disabled="true" checked="1" required="yes">').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkBools('<input disabled="true"><input disabled="true">').warnings).toHaveLength(1); });
  it('hidden with another word is a warning', () => { expect(checkBools('<div hidden="yes">x</div>').warnings).toHaveLength(1); });
});

describe('checkBools: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <input disabled="false"> --><script>var s = \'<input checked="0">\';</script><style>a:after{content:"<details open=no>"}</style><template><input required="false"></template>';
    expect(checkBools(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkBools('<!-- x --><input disabled="false">').errors).toHaveLength(1);
    expect(checkBools('<script>var a = 1;</script><input disabled="false">').errors).toHaveLength(1);
  });
  it('an attribute on a tag that does not take it is not read', () => {
    expect(checkBools('<div disabled="false" checked="0" open="no" selected="off" required="no" controls="0"></div><a disabled="false"></a><p multiple="no" async="false"></p>')).toEqual(none);
  });
  it('a checked on a select is not read, it is not an attribute there', () => { expect(checkBools('<select checked="false"></select>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkBools('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkBools(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkBools(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
  it('the contact form passes', () => { expect(checkBools(readFileSync('src/components/ContactForm.astro', 'utf8')).errors).toEqual([]); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'bool-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p><details open><summary>s</summary>t</details>')).code).toBe(0); });
  it('a details with open false stops the build and names the page', () => {
    const r = run(FULL('<details open="false"><summary>s</summary>t</details>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <details open="false"> is still ON/);
  });
  it('a field with disabled false stops the build', () => {
    const r = run(FULL('<form action="/s/" method="post"><label>Name <input name="n" disabled="false"></label></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/an <input disabled="false"> is still ON/);
  });
  it('disabled true is a warning, not an error', () => {
    const r = run(FULL('<form action="/s/" method="post"><label>Name <input name="n" disabled="true"></label></form>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*works, but write disabled with no value/);
  });
});
