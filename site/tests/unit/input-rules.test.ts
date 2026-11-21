import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkInputRules } from '../../scripts/input-rules-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkInputRules: good pages', () => {
  it('a plain page passes', () => { expect(checkInputRules('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkInputRules(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkInputRules('')).toEqual(none); });
  it('a real pattern on a text field passes', () => { expect(checkInputRules('<input type="text" pattern="[0-9]{3}">')).toEqual(none); });
  it('a zip code pattern passes', () => { expect(checkInputRules('<input pattern="\\d{5}(-\\d{4})?">')).toEqual(none); });
  it('a pattern with an escaped dash passes', () => { expect(checkInputRules('<input pattern="[a-z\\-]+">')).toEqual(none); });
  it('a field with no type is a text field', () => { expect(checkInputRules('<input pattern="[a-z]+">')).toEqual(none); });
  it('a pattern on search, url, tel, email and password passes', () => {
    for (const t of ['search', 'url', 'tel', 'email', 'password']) expect(checkInputRules(`<input type="${t}" pattern="[a-z]+">`)).toEqual(none);
  });
  it('an unknown type is read as text', () => { expect(checkInputRules('<input type="fancy" pattern="[a-z]+">')).toEqual(none); });
  it('the case of the type is not read', () => { expect(checkInputRules('<INPUT TYPE="TEXT" PATTERN="[a-z]+">')).toEqual(none); });
  it('an empty pattern passes', () => { expect(checkInputRules('<input pattern="">')).toEqual(none); });
  it('accept on a file field passes', () => { expect(checkInputRules('<input type="file" accept="image/*">')).toEqual(none); });
  it('multiple on email and file passes', () => { expect(checkInputRules('<input type="email" multiple><input type="file" multiple>')).toEqual(none); });
  it('a minlength below the maxlength passes', () => { expect(checkInputRules('<input minlength="2" maxlength="10"><textarea minlength="5" maxlength="5"></textarea>')).toEqual(none); });
  it('a minlength alone and a maxlength alone pass', () => { expect(checkInputRules('<input minlength="9"><input maxlength="1">')).toEqual(none); });
  it('a minlength that is not a number is left to form-controls', () => { expect(checkInputRules('<input minlength="abc" maxlength="2">')).toEqual(none); });
  it('single quotes and no quotes pass', () => { expect(checkInputRules("<input pattern='[0-9]+'><input pattern=[0-9]+>")).toEqual(none); });
  it('the words in text pass', () => { expect(checkInputRules('<p>Write pattern="(abc" in an input.</p>')).toEqual(none); });
  it('an attribute on another tag is not read', () => { expect(checkInputRules('<div pattern="(abc" accept="x" multiple></div><select multiple></select><a pattern="(" href="/">a</a>')).toEqual(none); });
  it('a custom tag that starts with input is not read', () => { expect(checkInputRules('<input-x pattern="(abc"></input-x><textarea-x pattern="("></textarea-x>')).toEqual(none); });
  it('a data attribute is not read', () => { expect(checkInputRules('<input data-pattern="(abc" type="checkbox">')).toEqual(none); });
  it('an entity in the pattern is read as the character', () => { expect(checkInputRules('<input pattern="[a-z]&#43;">')).toEqual(none); });
  it('a quote entity in the pattern is read as a quote', () => { expect(checkInputRules('<input pattern="[&quot;a]+">')).toEqual(none); });
});

describe('checkInputRules: errors', () => {
  it('an open bracket is an error with a plain message', () => {
    expect(checkInputRules('<input pattern="(abc">').errors).toEqual(['an <input pattern="(abc"> is not a regular expression, so the browser drops it and the field accepts anything; fix the pattern']);
  });
  it('a closing bracket alone is an error', () => { expect(checkInputRules('<input pattern="abc)">').errors).toHaveLength(1); });
  it('a repeat with nothing before it is an error', () => { expect(checkInputRules('<input pattern="*abc">').errors).toHaveLength(1); });
  it('a range the wrong way round is an error', () => { expect(checkInputRules('<input pattern="a{2,1}">').errors).toHaveLength(1); });
  it('a class with a backwards range is an error', () => { expect(checkInputRules('<input pattern="[z-a]">').errors).toHaveLength(1); });
  it('an error never becomes a warning as well', () => { expect(checkInputRules('<input pattern="(abc">').warnings).toEqual([]); });
  it('the case of the tag and the attribute is not read', () => { expect(checkInputRules('<INPUT PATTERN="(abc">').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkInputRules("<input pattern='(abc'>").errors).toHaveLength(1);
    expect(checkInputRules('<input pattern=(abc>').errors).toHaveLength(1);
  });
  it('a greater-than sign in another value does not cut the tag', () => { expect(checkInputRules('<input title="a > b" pattern="(abc">').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkInputRules('<input pattern="(abc"><input pattern="(abc">').errors).toHaveLength(1); });
  it('a long pattern is shortened in the message', () => {
    const r = checkInputRules('<input pattern="(' + 'a'.repeat(100) + '">');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(260);
  });
  it('a pattern with no value is not an error', () => { expect(checkInputRules('<input pattern>').errors).toEqual([]); });
});

describe('checkInputRules: warnings', () => {
  it('an unescaped dash is a warning only', () => {
    const r = checkInputRules('<input pattern="[\\w-]+">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/dropped by new browsers/);
  });
  it('a dash at the end of a class is a warning only', () => { expect(checkInputRules('<input pattern="[a-z_-]+">').warnings).toHaveLength(1); });
  it('a pattern on a checkbox is a warning', () => {
    expect(checkInputRules('<input type="checkbox" pattern="a">').warnings).toEqual(['an <input pattern="a"> sits on a field of type "checkbox", where the browser does not read a pattern; use a text, search, url, tel, email or password field']);
  });
  it('a pattern on number, date, radio and file fields is a warning', () => {
    for (const t of ['number', 'date', 'radio', 'file', 'range', 'color', 'hidden']) expect(checkInputRules(`<input type="${t}" pattern="[0-9]+">`).warnings).toHaveLength(1);
  });
  it('a broken pattern on a checkbox is only the type warning', () => {
    const r = checkInputRules('<input type="checkbox" pattern="(abc">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it('a pattern on a textarea is a warning', () => {
    expect(checkInputRules('<textarea pattern="[a-z]+"></textarea>').warnings).toEqual(['an <textarea pattern="[a-z]+"> sits on a textarea, where the browser does not read a pattern; use a text, search, url, tel, email or password field']);
  });
  it('an accept on a text field is a warning', () => {
    expect(checkInputRules('<input type="text" accept="image/*">').warnings).toEqual(['an <input accept="image/*"> sits on a field of type "text", where the browser does not read it; accept is for type="file"']);
  });
  it('multiple on a text and a number field is a warning', () => {
    expect(checkInputRules('<input type="text" multiple>').warnings).toEqual(['an <input multiple> sits on a field of type "text", where the browser does not read it; multiple is for type="email" and type="file"']);
    expect(checkInputRules('<input type="number" multiple>').warnings).toHaveLength(1);
  });
  it('a select with multiple is not read', () => { expect(checkInputRules('<select multiple><option>a</option></select>')).toEqual(none); });
  it('a minlength above the maxlength is a warning', () => {
    expect(checkInputRules('<input minlength="10" maxlength="2">').warnings).toEqual(['an <input minlength="10" maxlength="2"> has a minlength above its maxlength, so no value can pass; swap the two numbers']);
  });
  it('a textarea with the numbers the wrong way is a warning', () => {
    expect(checkInputRules('<textarea minlength="10" maxlength="2"></textarea>').warnings).toEqual(['a <textarea minlength="10" maxlength="2"> has a minlength above its maxlength, so no value can pass; swap the two numbers']);
  });
  it('a warning never becomes an error', () => {
    expect(checkInputRules('<input type="text" accept="x" multiple minlength="9" maxlength="1"><input pattern="[a-z_-]+">').errors).toEqual([]);
  });
  it('the same warning is not printed twice', () => { expect(checkInputRules('<input type="text" accept="x"><input type="text" accept="x">').warnings).toHaveLength(1); });
});

describe('checkInputRules: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <input pattern="(abc"> --><script>var s = \'<input pattern="(abc">\';</script><style>a:after{content:"<input pattern=(>"}</style><template><input pattern="(abc"></template>';
    expect(checkInputRules(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkInputRules('<!-- x --><input pattern="(abc">').errors).toHaveLength(1);
    expect(checkInputRules('<script>var a = 1;</script><input pattern="(abc">').errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkInputRules('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><input type="text" pattern="[0-9]+">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkInputRules(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the contact form passes', () => { expect(checkInputRules(readFileSync('src/components/ContactForm.astro', 'utf8'))).toEqual(none); });
  it('the search page passes', () => { expect(checkInputRules(readFileSync('src/pages/search.astro', 'utf8'))).toEqual(none); });
  it('the notifications page passes', () => { expect(checkInputRules(readFileSync('src/pages/notifications.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'inputrules-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const field = (attrs: string) => `<form action="/x/" method="post"><label for="f">Name</label><input id="f" name="f" ${attrs}></form>`;
  it('a good page passes', () => { expect(run(FULL(field('type="text" pattern="[0-9]{3}"'))).code).toBe(0); });
  it('a broken pattern stops the build and names the page', () => {
    const r = run(FULL(field('type="text" pattern="(abc"')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <input pattern="\(abc"> is not a regular expression/);
  });
  it('a pattern that only new browsers drop is a warning, not an error', () => {
    const r = run(FULL(field('type="text" pattern="[a-z_-]+"')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*dropped by new browsers/);
  });
  it('an accept on a text field is a warning, not an error', () => {
    const r = run(FULL(field('type="text" accept="image/*"')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*accept is for type="file"/);
  });
});
