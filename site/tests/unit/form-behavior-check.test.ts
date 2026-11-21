import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkFormBehavior } from '../../scripts/form-behavior-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const PW = 'a password field sits in a form that sends with GET (the default when there is no method), so the password would show in the address and in the browser history; write method="post"';
const FILE = 'a file field sits in a form that is not method="post" with enctype="multipart/form-data"; the browser sends only the file name, not the file';

describe('checkFormBehavior: good pages', () => {
  it('a plain page passes', () => { expect(checkFormBehavior('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkFormBehavior(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkFormBehavior('')).toEqual(none); });
  it('a normal form passes', () => {
    expect(checkFormBehavior('<form method="post" action="/send/"><input name="a"><input type="email" name="b"><textarea name="c"></textarea><select name="d"><option>x</option></select><button type="submit">Go</button></form>')).toEqual(none);
  });
  it('a get search form passes', () => { expect(checkFormBehavior('<form action="/search/" method="get"><input type="search" name="q"><input type="submit" value="Go"></form>')).toEqual(none); });
  it('a form with no method and no password passes', () => { expect(checkFormBehavior('<form><input name="q"></form>')).toEqual(none); });
  it('a form with no action passes', () => { expect(checkFormBehavior('<form method="post"><input name="q"></form>')).toEqual(none); });
  it('an https and a relative action pass', () => { expect(checkFormBehavior('<form method="post" action="https://x.org/a/"><input name="q"></form><form method="post" action="/a/"><input name="q"></form>')).toEqual(none); });
  it('a password in a post form passes', () => { expect(checkFormBehavior('<form method="post"><input type="password" name="p"></form>')).toEqual(none); });
  it('a password in a dialog form passes', () => { expect(checkFormBehavior('<form method="dialog"><input type="password" name="p"></form>')).toEqual(none); });
  it('a file field in a post multipart form passes', () => { expect(checkFormBehavior('<form method="post" enctype="multipart/form-data"><input type="file" name="f"></form>')).toEqual(none); });
  it('buttons with no name pass', () => { expect(checkFormBehavior('<form method="post"><input type="submit"><input type="button" value="x"><input type="reset"><input type="image" src="/a.png" alt="Go"></form>')).toEqual(none); });
  it('radio buttons and check boxes that share a name pass', () => {
    expect(checkFormBehavior('<form method="post"><input type="radio" name="r"><input type="radio" name="r"><input type="checkbox" name="c"><input type="checkbox" name="c"></form>')).toEqual(none);
  });
  it('a name that ends with [] may repeat', () => { expect(checkFormBehavior('<form method="post"><input name="t[]"><input name="t[]"></form>')).toEqual(none); });
  it('the same name in two different forms passes', () => { expect(checkFormBehavior('<form method="post"><input name="q"></form><form method="post"><input name="q"></form>')).toEqual(none); });
  it('fields outside any form are not read', () => { expect(checkFormBehavior('<input><input type="password"><input type="file"><textarea></textarea>')).toEqual(none); });
  it('a disabled field with no name passes', () => { expect(checkFormBehavior('<form method="post"><input disabled><textarea disabled></textarea></form>')).toEqual(none); });
  it('the case of a tag, a method, a type and an enctype does not matter', () => {
    expect(checkFormBehavior('<FORM METHOD="POST" ENCTYPE="Multipart/Form-Data"><INPUT TYPE="FILE" NAME="f"><INPUT TYPE="Password" NAME="p"></FORM>')).toEqual(none);
  });
  it('a select with options and groups passes', () => { expect(checkFormBehavior('<form method="post"><select name="s"><optgroup label="g"><option>a<option>b</optgroup></select></form>')).toEqual(none); });
});

describe('checkFormBehavior: errors', () => {
  it('a form that sends to http://', () => {
    expect(checkFormBehavior('<form method="post" action="http://x.org/a/"><input name="q"></form>').errors).toEqual(['a form sends to http://x.org/a/, which is not https; what the reader types can be read on the way, and browsers warn about it']);
  });
  it('an http:// action in capitals', () => { expect(checkFormBehavior('<form method="post" action="HTTP://x.org/"><input name="q"></form>').errors).toHaveLength(1); });
  it('a long http:// action is shortened in the message', () => {
    expect(checkFormBehavior('<form method="post" action="http://example.org/a/very/long/address/that/goes/on/and/on/"><input name="q"></form>').errors[0]).toMatch(/\.\.\., which is not https/);
  });
  it('a password in a form with no method', () => { expect(checkFormBehavior('<form><input type="password" name="p"></form>').errors).toEqual([PW]); });
  it('a password in a get form', () => { expect(checkFormBehavior('<form method="get"><input type="password" name="p"></form>').errors).toEqual([PW]); });
  it('a password in a form with an empty or wrong method', () => {
    expect(checkFormBehavior('<form method=""><input type="password" name="p"></form>').errors).toEqual([PW]);
    expect(checkFormBehavior('<form method="put"><input type="password" name="p"></form>').errors).toEqual([PW]);
  });
  it('a password with no name is still an error', () => { expect(checkFormBehavior('<form><input type="password"></form>').errors).toEqual([PW]); });
  it('the same error is not printed twice', () => { expect(checkFormBehavior('<form><input type="password" name="a"><input type="password" name="b"></form>').errors).toHaveLength(1); });
  it('an error is not also a warning about the same fault', () => { expect(checkFormBehavior('<form method="post" action="http://x.org/"><input name="q"></form>').warnings).toEqual([]); });
});

describe('checkFormBehavior: warnings', () => {
  it('a file field in a form with no method', () => { expect(checkFormBehavior('<form><input type="file" name="f"></form>').warnings).toEqual([FILE]); });
  it('a file field in a post form with no enctype', () => { expect(checkFormBehavior('<form method="post"><input type="file" name="f"></form>').warnings).toEqual([FILE]); });
  it('a file field in a multipart get form', () => { expect(checkFormBehavior('<form method="get" enctype="multipart/form-data"><input type="file" name="f"></form>').warnings).toEqual([FILE]); });
  it('a field with no name', () => {
    expect(checkFormBehavior('<form method="post"><input type="email"></form>').warnings).toEqual(['an <input type="email"> has no name inside a form, so the browser does not send what the reader types; add a name']);
  });
  it('an input with no type is a text box with no name', () => { expect(checkFormBehavior('<form method="post"><input></form>').warnings[0]).toMatch(/an <input type="text"> has no name/); });
  it('a select and a textarea with no name', () => {
    expect(checkFormBehavior('<form method="post"><select><option>a</option></select></form>').warnings).toEqual(['a <select> has no name inside a form, so the browser does not send what the reader types; add a name']);
    expect(checkFormBehavior('<form method="post"><textarea></textarea></form>').warnings).toEqual(['a <textarea> has no name inside a form, so the browser does not send what the reader types; add a name']);
  });
  it('an empty or blank name', () => {
    expect(checkFormBehavior('<form method="post"><input name=""></form>').warnings).toHaveLength(1);
    expect(checkFormBehavior('<form method="post"><input name="  "></form>').warnings).toHaveLength(1);
  });
  it('a radio button or a check box with no name', () => { expect(checkFormBehavior('<form method="post"><input type="checkbox"><input type="radio"></form>').warnings).toHaveLength(2); });
  it('a hidden field with no name', () => { expect(checkFormBehavior('<form method="post"><input type="hidden" value="x"></form>').warnings).toHaveLength(1); });
  it('two fields with the same name', () => {
    expect(checkFormBehavior('<form method="post"><input name="q"><input name="q"></form>').warnings).toEqual(['two fields of one form share the name "q"; the server gets both values, so give each field its own name (only radio buttons and check boxes share a name)']);
  });
  it('a text box and a select with the same name', () => { expect(checkFormBehavior('<form method="post"><input name="q"><select name="q"><option>a</option></select></form>').warnings).toHaveLength(1); });
  it('a radio button that is alone', () => {
    expect(checkFormBehavior('<form method="post"><input type="radio" name="r"></form>').warnings).toEqual(['a radio button named "r" is alone; a reader cannot undo the choice, so use a check box or add the other choices']);
  });
  it('two radio groups, one of them alone', () => { expect(checkFormBehavior('<form method="post"><input type="radio" name="a"><input type="radio" name="a"><input type="radio" name="b"></form>').warnings).toHaveLength(1); });
  it('a select with no option', () => { expect(checkFormBehavior('<form method="post"><select name="s"></select></form>').warnings).toEqual(['a <select> has no <option>, so the reader has nothing to choose']); });
  it('a select with no option outside a form', () => { expect(checkFormBehavior('<select></select>').warnings).toHaveLength(1); });
  it('a warning is not an error', () => { expect(checkFormBehavior('<form method="post"><input></form>').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkFormBehavior('<form method="post"><input><input></form>').warnings).toHaveLength(1); });
  it('the next form starts clean', () => {
    expect(checkFormBehavior('<form method="post"><input name="q"></form><form method="post"><input name="q"><input type="radio" name="x"></form>').warnings).toHaveLength(1);
  });
});

describe('checkFormBehavior: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    expect(checkFormBehavior('<script>var s="<form><input type=password>";</script><template><form><input></form></template><!-- <form><input type="password"> --><style>a{}</style><p>ok</p>')).toEqual(none);
  });
  it('names that only start with a listed word are left alone', () => { expect(checkFormBehavior('<form-box><input-box>x</input-box><inputs>y</inputs><selection>z</selection><optionbar>w</optionbar></form-box>')).toEqual(none); });
  it('a tag with a greater-than sign in a value does not break the reading', () => { expect(checkFormBehavior('<form method="post" title="a > b"><input name="q" title="x > y"></form>')).toEqual(none); });
  it('an unquoted value is read', () => { expect(checkFormBehavior('<form method=post action=http://x.org/><input name=q></form>').errors).toHaveLength(1); });
  it('an end tag with no opening tag is ignored', () => { expect(checkFormBehavior('</form></select><form method="post"><input name="q"></form></form>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkFormBehavior('<main>' + '<form method="post" action="/a/"><input name="a"><input type="radio" name="r"><input type="radio" name="r"><select name="s"><option>x</select></form>'.repeat(10000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it('one form with very many fields is read quickly', () => {
    const t = Date.now();
    checkFormBehavior('<form method="post">' + Array.from({ length: 20000 }, (_, i) => `<input name="f${i}">`).join('') + '</form>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the contact form and the push prompt have no fault', () => {
    for (const f of ['src/components/ContactForm.astro', 'src/components/PushPrompt.astro', 'src/layouts/Base.astro', 'src/pages/search.astro', 'src/pages/notifications.astro']) {
      const r = checkFormBehavior(readFileSync(f, 'utf8'));
      expect(r.errors, f).toEqual([]);
    }
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'fbeh-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<form method="post" action="/send/"><label for="a">A</label><input id="a" name="a"><button type="submit">Go</button></form>')).code).toBe(0); });
  it('a password in a get form stops the build and names the page', () => {
    const r = run(FULL('<form><label for="p">Password</label><input id="p" type="password" name="p"><button type="submit">Go</button></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a password field sits in a form that sends with GET/);
  });
  it('a form that sends to http:// stops the build', () => {
    const r = run(FULL('<form method="post" action="http://x.org/"><label for="a">A</label><input id="a" name="a"><button type="submit">Go</button></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/which is not https/);
  });
  it('a field with no name is a warning, not an error', () => {
    const r = run(FULL('<form method="post" action="/send/"><label for="a">A</label><input id="a"><button type="submit">Go</button></form>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*has no name inside a form/);
  });
  it('a select with no option is a warning, not an error', () => {
    const r = run(FULL('<form method="post" action="/send/"><label for="s">S</label><select id="s" name="s"></select><button type="submit">Go</button></form>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a <select> has no <option>/);
  });
});
