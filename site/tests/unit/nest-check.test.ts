import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkNesting } from '../../scripts/nest-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const A_IN_A = 'an <a> sits inside another <a>; the browser closes the first link early, so the page shows two broken links';
const B_IN_B = 'a <button> sits inside another <button>; the browser closes the first one early, so the page shows two broken buttons';
const F_IN_F = 'a <form> sits inside another <form>; the browser drops the inner form tag, so the inner fields are sent with the outer form';

describe('checkNesting: good pages', () => {
  it('a plain page passes', () => { expect(checkNesting('<main><h1>x</h1><p>hello <a href="/x/">y</a></p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkNesting(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkNesting('')).toEqual(none); });
  it('links side by side pass', () => { expect(checkNesting('<a href="/a/">a</a><a href="/b/">b</a><a href="/c/">c</a>')).toEqual(none); });
  it('buttons side by side pass', () => { expect(checkNesting('<button>a</button><button>b</button>')).toEqual(none); });
  it('forms side by side pass', () => { expect(checkNesting('<form><input name="a"></form><form><input name="b"></form>')).toEqual(none); });
  it('a form with fields and a button passes', () => {
    expect(checkNesting('<form><label>Name <input name="n"></label><select name="s"><option>a</option></select><textarea name="t"></textarea><button type="submit">Send</button></form>')).toEqual(none);
  });
  it('a link around a picture or text passes', () => { expect(checkNesting('<a href="/x/"><img src="a.jpg" alt="x"><span>Read</span></a>')).toEqual(none); });
  it('a link inside a form passes', () => { expect(checkNesting('<form><a href="/help/">Help</a><button>Go</button></form>')).toEqual(none); });
  it('upper case tags pass', () => { expect(checkNesting('<A HREF="/x/">x</A><BUTTON>y</BUTTON><FORM></FORM>')).toEqual(none); });
  it('names that only start with a listed word pass', () => {
    expect(checkNesting('<a href="/x/"><abbr>x</abbr><article>y</article><button-group>z</button-group><formula-box></formula-box><input-box></input-box></a>')).toEqual(none);
  });
  it('a hidden input inside a link or a button passes', () => {
    expect(checkNesting('<button><input type="hidden" name="a"></button><a href="/x/"><input type=hidden name=b></a><a href="/y/"><input TYPE=\'hidden\'></a>')).toEqual(none);
  });
  it('a closing tag with no opening tag is ignored', () => { expect(checkNesting('</a></button></form><a href="/x/">x</a><button>y</button>')).toEqual(none); });
  it('a value that holds a greater-than sign does not break the reading', () => {
    expect(checkNesting('<a href="/x/" title="a > b">x</a><a href="/y/" title="c > d">y</a>')).toEqual(none);
  });
});

describe('checkNesting: errors', () => {
  it('a link inside a link is an error', () => { expect(checkNesting('<a href="/a/">one <a href="/b/">two</a></a>').errors).toEqual([A_IN_A]); });
  it('a link inside a link is an error even with other tags between', () => { expect(checkNesting('<a href="/a/"><span><em><a href="/b/">x</a></em></span></a>').errors).toEqual([A_IN_A]); });
  it('a button inside a button is an error', () => { expect(checkNesting('<button>one <button>two</button></button>').errors).toEqual([B_IN_B]); });
  it('a form inside a form is an error', () => { expect(checkNesting('<form><div><form><input name="a"></form></div></form>').errors).toEqual([F_IN_F]); });
  it('upper case is read', () => { expect(checkNesting('<A HREF="/a/"><A HREF="/b/">x</A></A>').errors).toEqual([A_IN_A]); });
  it('an a with no href inside a link is still an error', () => { expect(checkNesting('<a href="/a/"><a name="top">x</a></a>').errors).toEqual([A_IN_A]); });
  it('a tag after the first one is closed is fine', () => { expect(checkNesting('<a href="/a/">x</a><a href="/b/">y</a>').errors).toEqual([]); });
  it('a link inside a link after a closed pair is read', () => { expect(checkNesting('<a href="/a/">x</a><a href="/b/"><a href="/c/">y</a></a>').errors).toEqual([A_IN_A]); });
  it('the same message is not printed twice', () => { expect(checkNesting('<a href="/a/"><a href="/b/"></a></a><a href="/c/"><a href="/d/"></a></a>').errors).toEqual([A_IN_A]); });
  it('three different faults give three errors', () => {
    expect(checkNesting('<a href="/a/"><a href="/b/"></a></a><button><button></button></button><form><form></form></form>').errors).toHaveLength(3);
  });
  it('an attribute value that holds a greater-than sign is read', () => { expect(checkNesting('<a href="/a/" title="a > b"><a href="/b/" title="c > d">x</a></a>').errors).toEqual([A_IN_A]); });
});

describe('checkNesting: warnings', () => {
  it('a button inside a link is a warning, not an error', () => {
    const r = checkNesting('<a href="/x/"><button>Read</button></a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <button> sits inside a link; the Tab key and a screen reader meet two controls in one place, so use only one']);
  });
  it('a link inside a button is a warning, not an error', () => {
    const r = checkNesting('<button><a href="/x/">Read</a></button>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a link sits inside a <button>; the Tab key and a screen reader meet two controls in one place, so use only one']);
  });
  it('an input, select and textarea inside a link are warnings', () => {
    const r = checkNesting('<a href="/x/"><input name="a"><select name="b"></select><textarea name="c"></textarea></a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      'a <input> sits inside a link; the Tab key and a screen reader meet two controls in one place, so use only one',
      'a <select> sits inside a link; the Tab key and a screen reader meet two controls in one place, so use only one',
      'a <textarea> sits inside a link; the Tab key and a screen reader meet two controls in one place, so use only one',
    ]);
  });
  it('an input inside a button is a warning', () => {
    expect(checkNesting('<button><input name="a"></button>').warnings).toEqual(['a <input> sits inside a <button>; the Tab key and a screen reader meet two controls in one place, so use only one']);
  });
  it('a button inside a link and a link inside a button give two different warnings', () => {
    expect(checkNesting('<a href="/a/"><button>x</button></a><button><a href="/b/">y</a></button>').warnings).toHaveLength(2);
  });
  it('the same warning is not printed twice', () => {
    expect(checkNesting('<a href="/a/"><button>x</button></a><a href="/b/"><button>y</button></a>').warnings).toHaveLength(1);
  });
});

describe('checkNesting: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<a href="/a/"><a href="/b/">\';</script><template><button><button></button></button></template><!-- <form><form> --><style>a a{color:red}</style>';
    expect(checkNesting(extra + '<p>ok</p>')).toEqual(none);
  });
  it('everything inside svg and math is not read', () => {
    expect(checkNesting('<svg viewBox="0 0 10 10"><a href="#x"><a href="#y"><path d="M0 0"/></a></a></svg><math><a><a></a></a></math><p>ok</p>')).toEqual(none);
  });
  it('a fault after an svg is still read', () => { expect(checkNesting('<svg><path d="M0 0"/></svg><a href="/a/"><a href="/b/">x</a></a>').errors).toEqual([A_IN_A]); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkNesting('<main>' + '<p class="a b"><a href="/x/" data-x="1">text</a><button type="button">go</button></p>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout nests no link, button or form', () => {
    expect(checkNesting(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'nest-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p><a href="/x/">Read more</a></p>')).code).toBe(0); });
  it('a link inside a link stops the build and names the page', () => {
    const r = run(FULL('<p><a href="/a/">one <a href="/b/">two</a></a></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <a> sits inside another <a>/);
  });
  it('a button inside a button stops the build', () => {
    const r = run(FULL('<button type="button">one <button type="button">two</button></button>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/sits inside another <button>/);
  });
  it('a form inside a form stops the build', () => {
    const r = run(FULL('<form action="/a/" method="post"><form action="/b/" method="post"></form></form>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/sits inside another <form>/);
  });
  it('a button inside a link is a warning, not an error', () => {
    const r = run(FULL('<a href="/x/"><button type="button">Read</button></a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a <button> sits inside a link/);
  });
});
