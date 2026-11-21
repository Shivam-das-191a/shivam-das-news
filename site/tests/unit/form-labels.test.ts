import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkFormLabels } from '../../scripts/form-labels-lib.mjs';

const wrap = (body: string) => `<!doctype html><html lang="en"><head><title>T</title></head><body><main id="main"><h1>T</h1>${body}</main></body></html>`;
const errs = (body: string) => checkFormLabels(wrap(body)).errors;
const warns = (body: string) => checkFormLabels(wrap(body)).warnings;

describe('checkFormLabels', () => {
  it('a page with no form passes with no message', () => {
    expect(checkFormLabels(wrap('<p>Hello</p>'))).toEqual({ errors: [], warnings: [] });
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkFormLabels(v as any).errors.length).toBe(1);
  });
  it('a label for the id of the field gives it a name', () => {
    expect(checkFormLabels(wrap('<label for="a">Your name</label><input id="a" name="n">'))).toEqual({ errors: [], warnings: [] });
    expect(errs('<input id="a" name="n">').join()).toMatch(/no label/);
  });
  it('the label may come after the field', () => {
    expect(errs('<input id="a"><label for="a">Your name</label>')).toEqual([]);
  });
  it('a field inside a label with text has a name', () => {
    expect(errs('<label><span>From</span><input type="time" name="from"></label>')).toEqual([]);
    expect(errs('<label><input type="checkbox" name="x"> Remember me</label>')).toEqual([]);
  });
  it('a label with no text gives no name', () => {
    expect(errs('<label for="a"></label><input id="a">').length).toBe(1);
    expect(errs('<label for="a">   </label><input id="a">').length).toBe(1);
    expect(errs('<label for="a">&nbsp;</label><input id="a">').length).toBe(1);
    expect(errs('<label><input name="x"></label>').length).toBe(1);
    expect(errs('<label><span> </span><input name="x"></label>').length).toBe(1);
  });
  it('the options of a select and the text of a textarea inside a label are not the label text', () => {
    expect(errs('<label><select name="s"><option>One</option><option>Two</option></select></label>').length).toBe(1);
    expect(errs('<label><textarea name="t">Some text</textarea></label>').length).toBe(1);
    expect(errs('<label><span>Digest</span><select name="s"><option>One</option></select></label>')).toEqual([]);
  });
  it('the alt text of a picture inside a label counts', () => {
    expect(errs('<label><img src="/a.png" alt="Search"><input name="q"></label>')).toEqual([]);
    expect(errs('<label><img src="/a.png" alt=""><input name="q"></label>').length).toBe(1);
  });
  it('aria-label gives a name, an empty one does not', () => {
    expect(errs('<input type="search" aria-label="Search the site">')).toEqual([]);
    expect(errs('<input type="search" aria-label="">').length).toBe(1);
    expect(errs('<input type="search" aria-label="   ">').length).toBe(1);
  });
  it('aria-labelledby gives a name only when an id of the page is named', () => {
    expect(errs('<h2 id="t">Title</h2><input aria-labelledby="t">')).toEqual([]);
    expect(errs('<h2 id="t">Title</h2><input aria-labelledby="zzz t">')).toEqual([]);
    expect(errs('<input aria-labelledby="zzz">').length).toBe(1);
    expect(errs('<input aria-labelledby="">').length).toBe(1);
  });
  it('a placeholder or a title alone is not a label', () => {
    expect(errs('<input placeholder="Your name">').length).toBe(1);
    expect(errs('<input title="Your name">').length).toBe(1);
    expect(errs('<textarea placeholder="Message"></textarea>').length).toBe(1);
  });
  it('hidden, submit, button, reset and image inputs need no label, in any letter case', () => {
    for (const t of ['hidden', 'submit', 'button', 'reset', 'image', 'HIDDEN', 'Submit']) expect(errs(`<input type="${t}" value="x">`), t).toEqual([]);
    expect(errs('<input type=hidden name=csrf>')).toEqual([]);
  });
  it('checkbox, radio, file, time, email and no type all need a label', () => {
    for (const t of ['checkbox', 'radio', 'file', 'time', 'email', 'text', 'search', 'number']) expect(errs(`<input type="${t}">`).length, t).toBe(1);
    expect(errs('<input>').length).toBe(1);
  });
  it('select and textarea need a label too', () => {
    expect(errs('<select name="s"><option>a</option></select>').length).toBe(1);
    expect(errs('<textarea name="t"></textarea>').length).toBe(1);
    expect(errs('<label for="s">Pick</label><select id="s"><option>a</option></select>')).toEqual([]);
    expect(errs('<label for="t">Message</label><textarea id="t"></textarea>')).toEqual([]);
  });
  it('the message names the field in plain words', () => {
    expect(errs('<input type="email" name="email">')[0]).toBe('the form field input (type "email", name "email") has no label (add a label with text, or an aria-label); a placeholder is not a label');
    expect(errs('<input id="zip">')[0]).toMatch(/input \(type "text", id "zip"\)/);
    expect(errs('<select><option>a</option></select>')[0]).toMatch(/select \(no name or id\)/);
    expect(errs('<textarea name="m"></textarea>')[0]).toMatch(/textarea \(name "m"\)/);
  });
  it('gives every missing label at once', () => {
    expect(errs('<input name="a"><input name="b"><select name="c"></select>').length).toBe(3);
  });
  it('a label that points to a missing id warns, and its field has no name', () => {
    const r = checkFormLabels(wrap('<label for="ghost">Name</label><input id="real">'));
    expect(r.warnings.join()).toMatch(/"ghost"/);
    expect(r.errors.length).toBe(1);
  });
  it('a label that points to an element that exists does not warn', () => {
    expect(warns('<label for="a">Name</label><input id="a">')).toEqual([]);
  });
  it('a label for a field that has its own aria-label still works', () => {
    expect(checkFormLabels(wrap('<label for="a">Name</label><input id="a" aria-label="Name">'))).toEqual({ errors: [], warnings: [] });
  });
  it('fields inside script, style, template and comments are ignored', () => {
    expect(errs('<script>var x = "<input name=a>";</script>')).toEqual([]);
    expect(errs('<style>/* <input> */</style>')).toEqual([]);
    expect(errs('<template><input name="a"></template>')).toEqual([]);
    expect(errs('<!-- <input name="a"> -->')).toEqual([]);
  });
  it('reads upper case tags, single quotes and unquoted values', () => {
    expect(errs("<LABEL FOR='a'>Name</LABEL><INPUT ID='a' TYPE='text'>")).toEqual([]);
    expect(errs('<label for=a>Name</label><input id=a>')).toEqual([]);
    expect(errs('<INPUT TYPE="text">').length).toBe(1);
  });
  it('a > sign inside an attribute does not break the reading', () => {
    expect(errs('<label for="a">Name</label><input id="a" placeholder="a > b">')).toEqual([]);
    expect(errs('<input placeholder="a > b" name="x">').length).toBe(1);
    expect(errs('<label data-x="a>b">Name <input name="x"></label>')).toEqual([]);
    expect(errs('<input data-x="a>b" aria-label="Name">')).toEqual([]);
    expect(errs('<label for="a">Name</label><input placeholder="a > b" id="a">')).toEqual([]);
  });
  it('a tag that only starts like input, select, textarea or label is not read', () => {
    expect(errs('<inputx name="a"><selectable></selectable><textareas></textareas>')).toEqual([]);
    expect(errs('<labelled>Name</labelled><input name="a">').length).toBe(1);
  });
  it('a field in one label is not named by a different label', () => {
    expect(errs('<label><span>Name</span><input name="a"></label><input name="b">').length).toBe(1);
  });
  it('the real shapes of this site pass: for/id form and a wrapping label with a hint and a select', () => {
    const contact = '<label for="cf-name">Your name</label><input id="cf-name" name="name" type="text" required aria-describedby="cf-name-err"><span id="cf-name-err"></span>' +
      '<div aria-hidden="true"><label for="cf-website">Leave this field empty</label><input id="cf-website" name="website" type="text" tabindex="-1"></div>';
    const notify = '<fieldset><legend>Digest</legend><label class="notify-sel"> <span class="meta">A digest is one short summary.</span> <select name="digestMode"> <option value="off" selected>No digest</option> </select> </label></fieldset>' +
      '<label class="notify-opt"><input type="radio" name="level" value="balanced" checked><span>Balanced</span></label>';
    expect(checkFormLabels(wrap(contact + notify))).toEqual({ errors: [], warnings: [] });
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const shell = (body: string) =>
    '<!doctype html><html lang="en"><head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    `<body data-page-type="404"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'fl-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('a page with a labelled form passes', () => {
    const r = run(shell('<form><label for="e">Email</label><input id="e" type="email"><button>Send</button></form>'));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
  });
  it('a field with only a placeholder stops the build', () => {
    const r = run(shell('<form><input type="email" name="email" placeholder="Email"></form>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/form field input \(type "email", name "email"\) has no label/);
  });
  it('a label that points nowhere only warns when the field has another name', () => {
    const r = run(shell('<label for="ghost">Name</label><input id="real" aria-label="Name">'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn:.*"ghost"/);
  });
});
