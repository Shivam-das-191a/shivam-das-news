import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkAria } from '../../scripts/aria-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkAria: good pages', () => {
  it('a page with no aria and no role passes', () => { expect(checkAria('<main><h1>x</h1><a href="/a/">a</a></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkAria(v as any).errors).toEqual(['the page is not text']);
  });
  it('real roles and real names pass', () => {
    expect(checkAria('<div role="group" aria-label="Share"></div><div role="status" aria-live="polite"></div><section role="region" aria-labelledby="h"></section><nav aria-label="Main"></nav>')).toEqual(none);
  });
  it('an icon with aria-hidden and focusable=false passes', () => {
    expect(checkAria('<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"></svg>')).toEqual(none);
  });
  it('the honeypot pattern (hidden box, field with tabindex -1) passes', () => {
    expect(checkAria('<div class="cf-hp" aria-hidden="true"><label for="w">x</label><input id="w" type="text" tabindex="-1" autocomplete="off"></div>')).toEqual(none);
  });
  it('aria-hidden on a plain span with no link inside passes', () => { expect(checkAria('<span class="logo" aria-hidden="true"><img src="/a.png" alt=""></span>')).toEqual(none); });
  it('aria-hidden="false" hides nothing and passes', () => { expect(checkAria('<a href="/a/" aria-hidden="false">a</a>')).toEqual(none); });
  it('upper case tags and names, single quotes and no quotes are read', () => {
    expect(checkAria("<DIV ROLE='group' ARIA-LABEL='x'></DIV><div aria-live=polite></div>")).toEqual(none);
  });
  it('doc- and graphics- roles pass', () => { expect(checkAria('<section role="doc-chapter"></section><svg role="graphics-document"></svg>')).toEqual(none); });
  it('a role with a fallback word passes when one word is real', () => { expect(checkAria('<div role="foo button"></div>')).toEqual(none); });
  it('aria-hidden on a disabled button or a hidden input passes', () => {
    expect(checkAria('<button disabled aria-hidden="true">x</button><input type="hidden" aria-hidden="true">')).toEqual(none);
  });
  it('aria-checked mixed and aria-current page pass', () => { expect(checkAria('<div role="checkbox" aria-checked="mixed"></div><a href="/" aria-current="page">h</a>')).toEqual(none); });
});

describe('checkAria: errors', () => {
  it('a role that is not real is an error', () => {
    expect(checkAria('<div role="buton">x</div>').errors).toEqual(['<div> has role="buton", which is not a real role']);
  });
  it('an abstract role is an error', () => { expect(checkAria('<div role="widget">x</div>').errors).toHaveLength(1); });
  it('an empty role is an error', () => { expect(checkAria('<div role="">x</div>').errors).toHaveLength(1); });
  it('an aria name that does not exist is an error', () => {
    const r = checkAria('<a href="/a/" aria-lable="Home">x</a>');
    expect(r.errors).toEqual(['<a> has aria-lable, which is not a real aria attribute (a typo is ignored by every screen reader)']);
  });
  it('a wrong value for aria-hidden is an error', () => {
    expect(checkAria('<span aria-hidden="yes">x</span>').errors).toEqual(['<span> has aria-hidden="yes"; allowed: true, false, undefined']);
  });
  it('a bare aria-hidden with no value is an error', () => { expect(checkAria('<span aria-hidden>x</span>').errors).toHaveLength(1); });
  it('wrong values of other attributes are errors', () => {
    for (const s of ['aria-live="loud"', 'aria-expanded="maybe"', 'aria-pressed="on"', 'aria-current="now"', 'aria-haspopup="popup"', 'aria-invalid="yes"', 'aria-orientation="diagonal"', 'aria-sort="up"'])
      expect(checkAria(`<div ${s}></div>`).errors, s).toHaveLength(1);
  });
  it('aria-level must be a whole number from 1', () => {
    for (const v of ['0', '-1', '1.5', 'two', '']) expect(checkAria(`<div role="heading" aria-level="${v}"></div>`).errors, v).toHaveLength(1);
    expect(checkAria('<div role="heading" aria-level="2"></div>')).toEqual(none);
  });
  it('aria-hidden on body or html is an error', () => {
    expect(checkAria('<body aria-hidden="true"><p>x</p></body>').errors.join()).toMatch(/sees an empty page/);
    expect(checkAria('<html aria-hidden="true"></html>').errors).toHaveLength(1);
  });
  it('aria-hidden on a link, button, field or summary is an error', () => {
    for (const t of ['<a href="/a/" aria-hidden="true">x</a>', '<button aria-hidden="true">x</button>', '<input type="text" aria-hidden="true">', '<select aria-hidden="true"></select>',
      '<textarea aria-hidden="true"></textarea>', '<summary aria-hidden="true">x</summary>', '<div tabindex="0" aria-hidden="true">x</div>', '<div contenteditable aria-hidden="true">x</div>'])
      expect(checkAria(t).errors.join(), t).toMatch(/Tab key still reaches it/);
  });
  it('aria-hidden="TRUE" in capitals is read', () => { expect(checkAria('<a href="/a/" aria-hidden="TRUE">x</a>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkAria('<span aria-hidden="yes">a</span><span aria-hidden="yes">b</span>').errors).toHaveLength(1); });
});

describe('checkAria: warnings', () => {
  it('aria-hidden around a link the Tab key reaches is a warning', () => {
    const r = checkAria('<div aria-hidden="true"><p>x</p><a href="/a/">go</a></div>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <div> with aria-hidden="true" holds a link, button or field that the Tab key reaches; add tabindex="-1" to it']);
  });
  it('a nested div of the same name does not cut the search short', () => {
    expect(checkAria('<div aria-hidden="true"><div><div>a</div></div><button>x</button></div>').warnings).toHaveLength(1);
  });
  it('a link after the closing tag is not inside', () => {
    expect(checkAria('<div aria-hidden="true"><div>a</div></div><a href="/a/">go</a>')).toEqual(none);
  });
  it('an unclosed hidden element reads to the end of the page', () => {
    expect(checkAria('<div aria-hidden="true"><a href="/a/">go</a>').warnings).toHaveLength(1);
  });
  it('an empty aria-label is a warning, a blank one too', () => {
    expect(checkAria('<button aria-label="">x</button>').warnings.join()).toMatch(/empty aria-label/);
    expect(checkAria('<button aria-label="  ">x</button>').warnings).toHaveLength(1);
  });
  it('a role the tag already has is a warning', () => {
    expect(checkAria('<nav role="navigation">x</nav>').warnings).toEqual(['<nav> has role="navigation", which it already has; take the role away']);
    expect(checkAria('<main role="main"></main><button role="button">x</button><h2 role="heading">x</h2>').warnings).toHaveLength(3);
  });
  it('a role that differs from the tag is not a warning', () => { expect(checkAria('<nav role="menubar"></nav><ul role="list"></ul>')).toEqual(none); });
  it('role presentation on something the Tab key reaches is a warning', () => {
    expect(checkAria('<a href="/a/" role="presentation">x</a>').warnings.join()).toMatch(/the role is ignored there/);
    expect(checkAria('<img src="/a.png" alt="" role="presentation"><table role="none"></table>')).toEqual(none);
  });
});

describe('checkAria: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<div role="buton" aria-lable="x">\';</script><template><a href="/a/" aria-hidden="true"></a></template><!-- <div role="zzz"></div> --><style>a[aria-hidden="yes"]{}</style>';
    expect(checkAria(extra + '<p>ok</p>')).toEqual(none);
  });
  it('an aria word inside an attribute value is not read', () => {
    expect(checkAria('<div title="aria-lable=x role=zzz" data-x=\'aria-hidden="yes"\'>x</div>')).toEqual(none);
  });
  it('a self closing hidden tag has nothing inside', () => { expect(checkAria('<svg aria-hidden="true" />')).toEqual(none); });
  it('aria-labelledby and aria-describedby ids are not checked here', () => { expect(checkAria('<div aria-labelledby="nope" aria-describedby="nope2"></div>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkAria('<main>' + '<a class="x" href="/a/" aria-label="y" role="link">y</a>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it('many hidden boxes with no focus inside are read quickly', () => {
    const t = Date.now();
    checkAria('<main>' + '<div aria-hidden="true"><span>a</span></div>'.repeat(3000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  const files = ['src/components/Icon.astro', 'src/components/Header.astro', 'src/components/ContactForm.astro', 'src/layouts/Base.astro'];
  it('no template writes aria-hidden on body or html', () => {
    for (const f of files) expect(/<(body|html)\b[^>]*aria-hidden/i.test(readFileSync(f, 'utf8')), f).toBe(false);
  });
  it('the honeypot field keeps tabindex -1 inside its hidden box', () => {
    const t = readFileSync('src/components/ContactForm.astro', 'utf8');
    expect(/class="cf-hp" aria-hidden="true"[\s\S]*?<input[^>]*tabindex="-1"/.test(t)).toBe(true);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'aria-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('good aria passes', () => { expect(run(FULL('<div role="group" aria-label="Share"></div><svg aria-hidden="true" focusable="false"></svg>')).code).toBe(0); });
  it('a link hidden from a screen reader but reached by Tab stops the build and names the page', () => {
    const r = run(FULL('<a href="/a/" aria-hidden="true">x</a>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: <a> has aria-hidden="true" but the Tab key still reaches it/);
  });
  it('a typo in a role stops the build', () => {
    const r = run(FULL('<div role="buton">x</div>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not a real role/);
  });
  it('an empty aria-label is a warning, not an error', () => {
    const r = run(FULL('<div aria-label="">x</div>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*empty aria-label/);
  });
});
