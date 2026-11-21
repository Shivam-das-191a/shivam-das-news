import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkNumbers } from '../../scripts/number-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const PCT = (k: string, v: string, ex: number) => `an <img ${k}="${v}"> is not a whole number of pixels, so the browser cannot reserve the space before it loads; use a whole number such as ${k}="${ex}" and let the style scale it`;

describe('checkNumbers: good pages', () => {
  it('a plain page passes', () => { expect(checkNumbers('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkNumbers(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkNumbers('')).toEqual(none); });
  it('a picture with a width and a height passes', () => { expect(checkNumbers('<img src="/a.png" alt="a" width="640" height="360">')).toEqual(none); });
  it('a video and a canvas with whole sizes pass', () => { expect(checkNumbers('<video width="320" height="180" controls></video><canvas width="10" height="10"></canvas>')).toEqual(none); });
  it('a table with colspan and rowspan passes', () => { expect(checkNumbers('<table><tr><th colspan="2">a</th></tr><tr><td rowspan="2">b</td><td>c</td></tr></table>')).toEqual(none); });
  it('rowspan 0 is real and passes', () => { expect(checkNumbers('<td rowspan="0">a</td>')).toEqual(none); });
  it('a colgroup with span passes', () => { expect(checkNumbers('<colgroup span="2"></colgroup><col span="3">')).toEqual(none); });
  it('an ol start and an li value pass, a negative one too', () => { expect(checkNumbers('<ol start="5"><li value="9">a</li></ol><ol start="-2"><li value="-1">b</li></ol>')).toEqual(none); });
  it('a textarea and an input with rows, cols and size pass', () => { expect(checkNumbers('<textarea rows="5" cols="40"></textarea><input type="text" size="20"><select size="4"></select>')).toEqual(none); });
  it('no attribute at all passes', () => { expect(checkNumbers('<img src="/a.png" alt="a"><td>a</td><ol><li>a</li></ol><textarea></textarea>')).toEqual(none); });
  it('an empty width on a picture is left to the picture check', () => { expect(checkNumbers('<img src="/a.png" width="" height="">')).toEqual(none); });
  it('the word colspan in text passes', () => { expect(checkNumbers('<p>Use colspan="abc" and width="auto" in a td or img.</p>')).toEqual(none); });
});

describe('checkNumbers: errors', () => {
  it('width auto on a picture is an error', () => { expect(checkNumbers('<img width="auto">').errors).toEqual(['an <img width="auto"> is not a number; use a whole number of pixels such as width="640"']); });
  it('height abc on a picture is an error and the example is 360', () => { expect(checkNumbers('<img height="abc">').errors).toEqual(['an <img height="abc"> is not a number; use a whole number of pixels such as height="360"']); });
  it('a negative width is an error', () => { expect(checkNumbers('<img width="-5">').errors).toHaveLength(1); });
  it('a video and a canvas are read too', () => {
    expect(checkNumbers('<video width="x"></video>').errors).toEqual(['a <video width="x"> is not a number; use a whole number of pixels such as width="640"']);
    expect(checkNumbers('<canvas height="x"></canvas>').errors).toHaveLength(1);
  });
  it('colspan abc is an error', () => { expect(checkNumbers('<td colspan="abc">a</td>').errors).toEqual(['a <td colspan="abc"> is not a whole number; use a number such as colspan="2"']); });
  it('colspan 2.5 is an error', () => { expect(checkNumbers('<th colspan="2.5">a</th>').errors).toHaveLength(1); });
  it('colspan with a minus is an error', () => { expect(checkNumbers('<td colspan="-1">a</td>').errors).toHaveLength(1); });
  it('an empty colspan is an error', () => { expect(checkNumbers('<td colspan="">a</td>').errors).toHaveLength(1); });
  it('a colspan with no value is an error', () => { expect(checkNumbers('<td colspan>a</td>').errors).toHaveLength(1); });
  it('rowspan abc is an error', () => { expect(checkNumbers('<td rowspan="abc">a</td>').errors).toHaveLength(1); });
  it('span abc on a col is an error', () => { expect(checkNumbers('<col span="abc">').errors).toHaveLength(1); });
  it('rows and cols abc on a textarea are two errors', () => { expect(checkNumbers('<textarea rows="a" cols="b"></textarea>').errors).toHaveLength(2); });
  it('size abc on an input and a select are errors', () => { expect(checkNumbers('<input size="a"><select size="b"></select>').errors).toHaveLength(2); });
  it('ol start x is an error', () => { expect(checkNumbers('<ol start="x"></ol>').errors).toEqual(['an <ol start="x"> is not a whole number; use a number such as start="1"']); });
  it('li value 1.5 is an error', () => { expect(checkNumbers('<li value="1.5">a</li>').errors).toEqual(['a <li value="1.5"> is not a whole number; use a number such as value="1"']); });
  it('the case of the tag, attribute and value is not read', () => { expect(checkNumbers('<TD COLSPAN="ABC">a</TD>').errors).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkNumbers("<td colspan='abc'>a</td>").errors).toHaveLength(1);
    expect(checkNumbers('<td colspan=abc>a</td>').errors).toHaveLength(1);
    expect(checkNumbers('<td colspan=2>a</td>')).toEqual(none);
  });
  it('a greater-than sign in a value does not cut the tag', () => { expect(checkNumbers('<td title="a > b" colspan="abc">a</td>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkNumbers('<td colspan="abc">a</td><td colspan="abc">b</td>').errors).toHaveLength(1); });
  it('a long value is shortened in the message', () => {
    const r = checkNumbers('<td colspan="' + 'a'.repeat(100) + '">a</td>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(160);
  });
});

describe('checkNumbers: warnings', () => {
  it('a width in px is a warning', () => { expect(checkNumbers('<img width="640px">').warnings).toEqual([PCT('width', '640px', 640)]); });
  it('a height in percent is a warning', () => { expect(checkNumbers('<img height="100%">').warnings).toEqual([PCT('height', '100%', 360)]); });
  it('a decimal width is a warning', () => { expect(checkNumbers('<img width="640.5">').warnings).toHaveLength(1); });
  it('colspan 0 is a warning', () => { expect(checkNumbers('<td colspan="0">a</td>').warnings).toEqual(['a <td colspan="0"> is outside 1 to 1000, so the browser changes it; use a number inside that range']); });
  it('colspan 1001 is a warning', () => { expect(checkNumbers('<td colspan="1001">a</td>').warnings).toHaveLength(1); });
  it('colspan 1000 passes', () => { expect(checkNumbers('<td colspan="1000">a</td>')).toEqual(none); });
  it('rowspan 65535 is a warning and 65534 passes', () => {
    expect(checkNumbers('<td rowspan="65535">a</td>').warnings).toEqual(['a <td rowspan="65535"> is outside 0 to 65534, so the browser changes it; use a number inside that range']);
    expect(checkNumbers('<td rowspan="65534">a</td>')).toEqual(none);
  });
  it('span 0 on a col is a warning', () => { expect(checkNumbers('<col span="0">').warnings).toHaveLength(1); });
  it('rows 0 is a warning', () => { expect(checkNumbers('<textarea rows="0"></textarea>').warnings).toEqual(['a <textarea rows="0"> is 0, so the browser uses its own default; use a number above 0']); });
  it('size 0 on an input is a warning', () => { expect(checkNumbers('<input size="0">').warnings).toEqual(['an <input size="0"> is 0, so the browser uses its own default; use a number above 0']); });
  it('the same warning is not printed twice', () => { expect(checkNumbers('<td colspan="0">a</td><td colspan="0">b</td>').warnings).toHaveLength(1); });
});

describe('checkNumbers: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <td colspan="abc"> --><script>var s = \'<img width="auto">\';</script><style>a:after{content:"<td colspan=x>"}</style><template><img width="auto"></template>';
    expect(checkNumbers(extra + '<p>ok</p>')).toEqual(none);
  });
  it('the size of an iframe is not read', () => { expect(checkNumbers('<iframe width="100%" height="auto" title="v"></iframe>')).toEqual(none); });
  it('a custom element that starts with a listed word is not read', () => {
    expect(checkNumbers('<imgs width="auto"></imgs><tdx colspan="abc"></tdx><olist start="x"></olist><li-box value="x"></li-box>')).toEqual(none);
  });
  it('an attribute on another tag is not read', () => { expect(checkNumbers('<div colspan="abc" width="auto" start="x" size="x" rows="x"></div>')).toEqual(none); });
  it('text after a comment is still read', () => { expect(checkNumbers('<!-- x --><td colspan="abc">a</td>').errors).toHaveLength(1); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkNumbers('<main>' + '<p class="a b">text <a href="/x/">link</a></p><img src="/a.png" alt="a" width="10" height="10">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkNumbers(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the post card passes', () => { expect(checkNumbers(readFileSync('src/components/PostCard.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'number-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p><img src="/a.png" alt="a" width="10" height="10">')).code).toBe(0); });
  it('a width of auto stops the build and names the page', () => {
    const r = run(FULL('<img src="/a.png" alt="a" width="auto" height="10">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <img width="auto"> is not a number/);
  });
  it('a colspan of abc stops the build', () => {
    const r = run(FULL('<table><caption>c</caption><tr><th scope="col">a</th></tr><tr><td colspan="abc">b</td></tr></table>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is not a whole number; use a number such as colspan/);
  });
  it('a width of 100% is a warning, not an error', () => {
    const r = run(FULL('<img src="/a.png" alt="a" width="100%" height="10">'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*is not a whole number of pixels/);
  });
});
