import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkParents } from '../../scripts/parent-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkParents: good pages', () => {
  it('a plain page passes', () => { expect(checkParents('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkParents(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkParents('')).toEqual(none); });
  it('a list passes', () => { expect(checkParents('<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol><menu><li>m</li></menu>')).toEqual(none); });
  it('a list inside a list item passes', () => { expect(checkParents('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>')).toEqual(none); });
  it('a list with the end tags left out passes', () => { expect(checkParents('<ul><li>a<li>b<li>c</ul>')).toEqual(none); });
  it('a list with a paragraph left open inside an item passes', () => { expect(checkParents('<ul><li><p>a<li><p>b</ul>')).toEqual(none); });
  it('a nested list after an open item passes', () => { expect(checkParents('<ul><li>a<ul><li>b<li>c</ul><li>d</ul>')).toEqual(none); });
  it('a description list passes, with and without div groups', () => {
    expect(checkParents('<dl><dt>a</dt><dd>b</dd></dl><dl><div><dt>a</dt><dd>b</dd></div></dl><dl><dt>a<dd>b<dt>c<dd>d</dl>')).toEqual(none);
  });
  it('a select with options and groups passes', () => {
    expect(checkParents('<select><option>a</option><optgroup label="g"><option>b<option>c</optgroup><optgroup label="h"><option>d</optgroup></select>')).toEqual(none);
  });
  it('a datalist passes', () => { expect(checkParents('<datalist id="d"><option value="a"><option value="b"></datalist>')).toEqual(none); });
  it('a figure with a caption passes', () => { expect(checkParents('<figure><img src="/a.jpg" alt="a"><figcaption>c</figcaption></figure>')).toEqual(none); });
  it('a details with a summary passes', () => { expect(checkParents('<details><summary>More</summary><p>x</p></details>')).toEqual(none); });
  it('a fieldset with a legend passes', () => { expect(checkParents('<fieldset><legend>Pick</legend><input type="radio"></fieldset>')).toEqual(none); });
  it('a picture, video and audio with sources and tracks pass', () => {
    expect(checkParents('<picture><source srcset="/a.webp"><img src="/a.jpg" alt=""></picture><video controls><source src="/v.mp4"><track src="/c.vtt"></video><audio controls><source src="/a.mp3"></audio>')).toEqual(none);
  });
  it('the case of a tag does not matter', () => { expect(checkParents('<UL><LI>a</LI></UL><Figure><FigCaption>c</FigCaption></Figure>')).toEqual(none); });
  it('a self closed tag is not kept open', () => { expect(checkParents('<ul><li>a<br/></li><li>b<img src="/a.jpg" alt="" /></li></ul>')).toEqual(none); });
});

describe('checkParents: a tag outside its parent is an error', () => {
  it('an li with nothing around it', () => {
    expect(checkParents('<li>a</li>').errors).toEqual(['a <li> sits outside any tag, but HTML wants it directly inside <ul>, <ol>, <menu>; the browser does not repair it, so a screen reader does not announce it as part of the group']);
  });
  it('an li inside a div or a p', () => {
    expect(checkParents('<div><li>a</li></div>').errors).toHaveLength(1);
    expect(checkParents('<p><li>a</li></p>').errors[0]).toMatch(/a <li> sits inside a <p>/);
  });
  it('an li inside a table cell', () => { expect(checkParents('<table><tr><td><li>a</li></td></tr></table>').errors).toHaveLength(1); });
  it('a dt or dd outside a dl', () => {
    expect(checkParents('<div><dt>a</dt></div>').errors).toHaveLength(1);
    expect(checkParents('<p><dd>a</dd></p>').errors[0]).toMatch(/directly inside <dl>/);
  });
  it('a dt inside a div that is not inside a dl', () => { expect(checkParents('<section><div><dt>a</dt></div></section>').errors).toHaveLength(1); });
  it('an option outside a select', () => { expect(checkParents('<div><option>a</option></div>').errors[0]).toMatch(/a <option> sits inside a <div>/); });
  it('an optgroup outside a select', () => { expect(checkParents('<div><optgroup label="x"></optgroup></div>').errors).toHaveLength(1); });
  it('a figcaption outside a figure', () => { expect(checkParents('<div><figcaption>c</figcaption></div>').errors[0]).toMatch(/directly inside <figure>/); });
  it('a legend outside a fieldset', () => { expect(checkParents('<form><legend>x</legend></form>').errors[0]).toMatch(/directly inside <fieldset>/); });
  it('a summary outside a details', () => { expect(checkParents('<div><summary>x</summary></div>').errors[0]).toMatch(/directly inside <details>/); });
  it('a source outside a picture, video or audio', () => { expect(checkParents('<div><source src="/a.mp4"></div>').errors[0]).toMatch(/<picture>, <video>, <audio>/); });
  it('a track outside a video or audio', () => { expect(checkParents('<div><track src="/c.vtt"></div>').errors[0]).toMatch(/<video>, <audio>/); });
  it('an li inside a list that was closed early', () => { expect(checkParents('<ul><li>a</li></ul><li>b</li>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkParents('<div><li>a</li></div><div><li>b</li></div>').errors).toHaveLength(1); });
});

describe('checkParents: warnings', () => {
  it('a list with a direct child that is not an li', () => {
    expect(checkParents('<ul><div>x</div><li>a</li></ul>').warnings).toEqual(['a <ul> holds a <div> directly; only <li> belongs directly inside a list, so wrap the content in an <li>']);
    expect(checkParents('<ol><p>x</p></ol>').warnings).toHaveLength(1);
    expect(checkParents('<menu><a href="/x/">x</a></menu>').warnings).toHaveLength(1);
  });
  it('a dl with a stray child', () => { expect(checkParents('<dl><p>x</p><dt>a</dt><dd>b</dd></dl>').warnings[0]).toMatch(/a <dl> holds a <p> directly/); });
  it('a details with no summary', () => { expect(checkParents('<details><p>x</p></details>').warnings[0]).toMatch(/<details> has no <summary>/); });
  it('a fieldset with no legend', () => { expect(checkParents('<fieldset><input></fieldset>').warnings[0]).toMatch(/<fieldset> has no <legend>/); });
  it('a summary or legend nested one level deeper does not count', () => {
    expect(checkParents('<details><div><summary>x</summary></div></details>').warnings).toHaveLength(1);
    expect(checkParents('<fieldset><div><legend>x</legend></div></fieldset>').warnings).toHaveLength(1);
  });
  it('a warning is not an error', () => { expect(checkParents('<ul><div>x</div></ul>').errors).toEqual([]); });
  it('the same warning is not printed twice', () => { expect(checkParents('<ul><div>a</div></ul><ul><div>b</div></ul>').warnings).toHaveLength(1); });
});

describe('checkParents: what is left out', () => {
  it('a code sample may show a loose li', () => {
    expect(checkParents('<pre><code><li>a</li><option>b</option></code></pre><p><code><li>x</li></code> <kbd><dt>x</dt></kbd> <samp><li>x</li></samp></p><textarea><li>x</li></textarea>')).toEqual(none);
  });
  it('a custom element that starts with code is not a code sample', () => { expect(checkParents('<code-box>x</code-box><div><li>a</li></div>').errors).toHaveLength(1); });
  it('text inside script, style, template, svg and comments is not read', () => {
    expect(checkParents('<script>var s="<li>a</li>";</script><template><li>a</li></template><!-- <li>a</li> --><style>a{}</style><svg><source/><li></li></svg><p>ok</p>')).toEqual(none);
  });
  it('names that only start with a listed word are left alone', () => { expect(checkParents('<div><link rel="x" href="/a.css"><listing-box>x</listing-box><optionbar>x</optionbar><summaryline>x</summaryline></div>')).toEqual(none); });
  it('an end tag with no opening tag is ignored', () => { expect(checkParents('</li></ul><ul><li>a</li></ul></div>')).toEqual(none); });
  it('a tag with a greater-than sign in a value does not break the reading', () => { expect(checkParents('<ul><li title="a > b">x</li></ul>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkParents('<main>' + '<ul class="a b"><li>one</li><li>two<ul><li>x</li></ul></li></ul><figure><figcaption>c</figcaption></figure>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it('a deeply nested page does not crash', () => { expect(() => checkParents('<div>'.repeat(20000) + '<li>a</li>' + '</div>'.repeat(20000))).not.toThrow(); });
});

describe('the real templates', () => {
  it('the base layout has no tag outside its parent', () => {
    expect(checkParents(readFileSync('src/layouts/Base.astro', 'utf8')).errors).toEqual([]);
  });
  it('the real components have no tag outside its parent', () => {
    for (const f of ['Header', 'Footer', 'Listing', 'PostCard', 'Trending', 'Pager', 'ContactForm'])
      expect(checkParents(readFileSync(`src/components/${f}.astro`, 'utf8')).errors, f).toEqual([]);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'parent-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<ul><li>a</li><li>b</li></ul><figure><figcaption>c</figcaption></figure>')).code).toBe(0); });
  it('an li outside a list stops the build and names the page', () => {
    const r = run(FULL('<div><li>a</li></div>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <li> sits inside a <div>/);
  });
  it('a figcaption outside a figure stops the build', () => {
    const r = run(FULL('<div><figcaption>c</figcaption></div>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/directly inside <figure>/);
  });
  it('a list with a stray div is a warning, not an error', () => {
    const r = run(FULL('<ul><div>x</div><li>a</li></ul>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*a <ul> holds a <div> directly/);
  });
  it('a details with no summary is a warning, not an error', () => {
    const r = run(FULL('<details><p>x</p></details>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*<details> has no <summary>/);
  });
});
