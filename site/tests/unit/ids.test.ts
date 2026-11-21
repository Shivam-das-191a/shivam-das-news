import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkIds } from '../../scripts/ids-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkIds: good pages', () => {
  it('a page with unique ids and working links passes with no message', () => {
    expect(checkIds('<a class="skip" href="#main">Skip</a><main id="main"><h1 id="t">T</h1><a href="#t">up</a></main>')).toEqual(none);
  });
  it('a page with no ids passes', () => { expect(checkIds('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkIds(v as any).errors).toEqual(['the page is not text']);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkIds("<DIV ID='a'></DIV><P id=b></P><A HREF='#a'>x</A><a href=#b>y</a>")).toEqual(none);
  });
});

describe('checkIds: bad ids', () => {
  it('an empty id is an error', () => {
    expect(checkIds('<div id=""></div>').errors.join()).toMatch(/<div> has an empty id/);
    expect(checkIds('<div id="  "></div>').errors).toHaveLength(1);
  });
  it('an id with a space is an error', () => {
    expect(checkIds('<div id="a b"></div>').errors.join()).toMatch(/"a b" on a <div> has a space/);
  });
  it('the same id twice is an error that says how many', () => {
    expect(checkIds('<div id="a"></div><p id="a"></p>').errors.join()).toMatch(/"a" is used 2 times/);
    expect(checkIds('<i id="a"></i><i id="a"></i><i id="a"></i>').errors.join()).toMatch(/3 times/);
  });
  it('ids that differ only by case are different ids', () => { expect(checkIds('<i id="a"></i><i id="A"></i>')).toEqual(none); });
  it('an id on an svg element counts', () => { expect(checkIds('<svg><path id="p"/></svg><svg><path id="p"/></svg>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkIds('<i id=""></i><i id=""></i>').errors).toHaveLength(1); });
  it('two different repeated ids give two errors', () => {
    expect(checkIds('<i id="a"></i><i id="a"></i><i id="b"></i><i id="b"></i>').errors).toHaveLength(2);
  });
});

describe('checkIds: in-page links', () => {
  it('a link to a missing id is a warning, not an error', () => {
    const r = checkIds('<a href="#nope">x</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a link goes to #nope but nothing on the page has that id']);
  });
  it('href="#" and href="#top" are left out', () => {
    expect(checkIds('<a href="#">x</a><a href="#top">y</a><a href="#TOP">z</a>')).toEqual(none);
  });
  it('a link to an a name passes', () => { expect(checkIds('<a name="x"></a><a href="#x">y</a>')).toEqual(none); });
  it('a link whose name is written with percent signs passes', () => {
    expect(checkIds('<h2 id="a b"></h2>').errors).toHaveLength(1);
    expect(checkIds('<h2 id="caf\u00e9"></h2><a href="#caf%C3%A9">x</a>')).toEqual(none);
  });
  it('a link to another page that ends in a name is left out', () => {
    expect(checkIds('<a href="/other/#part">x</a><a href="https://x.org/#y">z</a>')).toEqual(none);
  });
  it('a link with no href is left out', () => { expect(checkIds('<a>x</a>')).toEqual(none); });
  it('the same missing target is warned once', () => { expect(checkIds('<a href="#n">x</a><a href="#n">y</a>').warnings).toHaveLength(1); });
  it('an id that only looks like the target does not count', () => { expect(checkIds('<i id="main2"></i><a href="#main">x</a>').warnings).toHaveLength(1); });
});

describe('checkIds: aria references', () => {
  it('aria-controls to a missing id is a warning', () => {
    expect(checkIds('<button aria-controls="menu">m</button>').warnings.join()).toMatch(/aria-controls points to "menu"/);
  });
  it('aria-controls and aria-describedby to real ids pass', () => {
    expect(checkIds('<button aria-controls="menu" aria-describedby="h1 h2">m</button><nav id="menu"></nav><p id="h1"></p><p id="h2"></p>')).toEqual(none);
  });
  it('a list with one missing id warns for that one', () => {
    const r = checkIds('<i aria-describedby="a b"></i><p id="a"></p>');
    expect(r.warnings).toEqual(['aria-describedby points to "b" but nothing on the page has that id']);
  });
  it('aria-labelledby is left out (other checks read it)', () => { expect(checkIds('<i aria-labelledby="zzz"></i>')).toEqual(none); });
});

describe('checkIds: what is left out', () => {
  it('ids and links inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<i id="a"></i><i id="a"></i><a href="#zz">\';</script><template><i id="a"></i><i id="a"></i></template><!-- <i id="b"></i><i id="b"></i> -->';
    expect(checkIds(extra + '<i id="a"></i>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkIds('<main>' + '<p class="x">y</p>'.repeat(40000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the skip link target main exists once in Base', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect((base.match(/id="main"/g) || []).length).toBe(1);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'ids-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p id="a">x</p><a href="#a">y</a>')).code).toBe(0); });
  it('a repeated id stops the build and names the page', () => {
    const r = run(FULL('<p id="a">x</p><p id="a">y</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the id "a" is used 2 times/);
  });
  it('a second main id stops the build', () => {
    expect(run(FULL('<p id="main">x</p>')).out).toMatch(/the id "main" is used 2 times/);
  });
  it('a link to a missing id is a warning, not an error', () => {
    const r = run(FULL('<a href="#nope">x</a>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*#nope/);
  });
});
