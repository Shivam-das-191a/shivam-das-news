import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkSideScrollCss, checkSideScrollHtml, declarations } from '../../scripts/side-scroll-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const css = (s: string, f: any = {}) => checkSideScrollCss(s, f);

describe('checkSideScrollCss: good styles', () => {
  it('a normal style passes with no message', () => {
    expect(css('body{margin:0}.wrap{max-width:1100px;margin:auto;padding:8px 12px}img{max-width:100%;height:auto}', { images: true })).toEqual(none);
  });
  it('an empty or non-text style is no error and no crash', () => {
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(css(v as any)).toEqual(none);
  });
  it('widths of 320px or less pass', () => {
    expect(css('.a{width:320px}.b{min-width:44px}.c{width:20rem}.d{width:12em}').errors).toEqual([]);
  });
  it('percent widths, vw other than 100vw, auto and 0 pass', () => {
    expect(css('.a{width:100%}.b{width:90vw}.c{width:auto}.d{min-width:0}.e{width:50%}').errors).toEqual([]);
  });
  it('calc, var, clamp, min and max lengths are not read', () => {
    expect(css('.a{width:calc(100% - 700px)}.b{width:var(--w)}.c{width:clamp(200px,50vw,900px)}.d{width:min(100%,900px)}.e{min-width:max(10px,600px)}')).toEqual(none);
  });
  it('max-width and other lengths are never a problem', () => {
    expect(css('.a{max-width:900px}.b{height:900px}.c{margin-left:500px}.d{padding:0 500px}')).toEqual(none);
  });
});

describe('checkSideScrollCss: fixed widths', () => {
  it('a width over 320px is an error that names the rule', () => {
    const r = css('.card{width:500px}');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"\.card" sets width to 500px/);
  });
  it('a min-width over 320px is an error', () => { expect(css('.a{min-width:321px}').errors.join()).toMatch(/min-width to 321px/); });
  it('rem and em count as 16px', () => {
    expect(css('.a{width:30rem}').errors).toHaveLength(1);
    expect(css('.a{width:21em}').errors).toHaveLength(1);
    expect(css('.a{width:20.1rem}').errors).toHaveLength(1);
  });
  it('the minified style is read too', () => { expect(css('a{color:red}.x{width:900px;color:blue}b{top:0}').errors).toHaveLength(1); });
  it('a cap of max-width 100% fixes it', () => { expect(css('.a{width:500px;max-width:100%}').errors).toEqual([]); });
  it('a cap of 320px or less fixes it, a cap of 400px does not', () => {
    expect(css('.a{width:500px;max-width:300px}').errors).toEqual([]);
    expect(css('.a{width:500px;max-width:400px}').errors).toHaveLength(1);
  });
  it('overflow auto, scroll, hidden or clip on the same rule fixes it', () => {
    for (const o of ['overflow:auto', 'overflow-x:scroll', 'overflow:hidden', 'overflow-x:clip'])
      expect(css(`.a{width:500px;${o}}`).errors).toEqual([]);
    expect(css('.a{width:500px;overflow:visible}').errors).toHaveLength(1);
  });
  it('important is read through', () => { expect(css('.a{width:500px!important}').errors).toHaveLength(1); });
  it('upper case is read', () => { expect(css('.a{WIDTH:500PX}').errors.length + css('.a{Width:500px}').errors.length).toBeGreaterThan(0); });
  it('one error per property of a rule', () => { expect(css('.a{width:500px;min-width:600px}').errors).toHaveLength(2); });
});

describe('checkSideScrollCss: which rules count', () => {
  it('a rule in a min-width media query over 320px is left out', () => {
    expect(css('@media (min-width:768px){.a{width:700px}}').errors).toEqual([]);
    expect(css('@media (min-width:321px){.a{width:700px}}').errors).toEqual([]);
    expect(css('@media(min-width:48rem){.a{width:700px}}').errors).toEqual([]);
  });
  it('a rule in a min-width media query of 320px or less is read', () => {
    expect(css('@media (min-width:320px){.a{width:700px}}').errors).toHaveLength(1);
  });
  it('a rule in a max-width media query is read', () => { expect(css('@media (max-width:767px){.a{width:700px}}').errors).toHaveLength(1); });
  it('a rule in a print media query is left out', () => { expect(css('@media print{.a{width:900px}}').errors).toEqual([]); });
  it('nested media and supports blocks are read', () => {
    expect(css('@supports (display:grid){@media (max-width:700px){.a{width:700px}}}').errors).toHaveLength(1);
    expect(css('@media (min-width:700px){@media (max-width:900px){.a{width:700px}}}').errors).toEqual([]);
  });
  it('keyframes, font-face and page blocks are left out', () => {
    expect(css('@keyframes k{from{width:900px}to{width:1000px}}@font-face{font-family:x;width:900px}@page{width:900px}').errors).toEqual([]);
  });
  it('an import line and a comment do not hide the next rule', () => {
    expect(css('@import "a.css";/* .x{width:1px} */.b{width:900px}').errors).toHaveLength(1);
  });
  it('a data address with a semicolon does not cut a rule', () => {
    expect(css('.a{background:url(data:image/png;base64,AAAA);width:900px}').errors).toHaveLength(1);
  });
  it('an unclosed block does not crash', () => { expect(() => css('.a{width:900px')).not.toThrow(); expect(() => css('@media (max-width:300px){.a{width:1px}')).not.toThrow(); });
});

describe('checkSideScrollCss: warnings', () => {
  it('100vw warns, 100vw with overflow does not', () => {
    expect(css('.a{width:100vw}').warnings.join()).toMatch(/100vw/);
    expect(css('.a{width:100vw;overflow-x:hidden}').warnings).toEqual([]);
  });
  it('white-space nowrap with nothing to save it warns', () => {
    expect(css('.a{white-space:nowrap}').warnings.join()).toMatch(/"\.a" sets white-space to nowrap/);
    expect(css('.a{white-space:pre}').warnings).toHaveLength(1);
  });
  it('nowrap with overflow, ellipsis or wrapping does not warn', () => {
    for (const x of ['overflow:hidden', 'overflow-x:auto', 'text-overflow:ellipsis', 'overflow-wrap:anywhere', 'word-wrap:break-word'])
      expect(css(`.a{white-space:nowrap;${x}}`).warnings).toEqual([]);
  });
  it('pictures on the pages with no max-width 100% rule warn once', () => {
    const r = css('body{margin:0}', { images: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/max-width: 100%/);
  });
  it('no pictures on the pages: no picture warning', () => { expect(css('body{margin:0}', { images: false })).toEqual(none); });
  it('img, picture, video, iframe, svg and the star rule all count as the cap', () => {
    for (const s of ['img', 'picture', 'video', 'iframe', 'svg', '*', '.post img', 'img,video', 'a>img'])
      expect(css(`${s}{max-width:100%}`, { images: true }).warnings).toEqual([]);
  });
  it('width 100% on img counts as the cap too', () => { expect(css('img{width:100%}', { images: true }).warnings).toEqual([]); });
  it('a max-width 100% rule on a class that is not a media tag does not count', () => {
    expect(css('.box{max-width:100%}', { images: true }).warnings).toHaveLength(1);
  });
  it('pre blocks on the pages need a rule that lets them scroll or wrap', () => {
    expect(css('body{margin:0}', { pre: true }).warnings.join()).toMatch(/pre blocks/);
    expect(css('pre{overflow-x:auto}', { pre: true }).warnings).toEqual([]);
    expect(css('pre{white-space:pre-wrap}', { pre: true }).warnings).toEqual([]);
    expect(css('.post pre{overflow-wrap:anywhere}', { pre: true }).warnings).toEqual([]);
  });
  it('the same warning is never printed twice', () => {
    const w = css('.a{width:100vw}.b{width:100vw}').warnings;
    expect(w).toHaveLength(2);
    expect(css('.a{white-space:nowrap}.a{white-space:nowrap}').warnings).toHaveLength(1);
  });
});

describe('declarations', () => {
  it('reads properties in lower case and cuts important', () => {
    expect(declarations('WIDTH: 500PX !important; color:red;;bad;')).toEqual({ width: '500px', color: 'red' });
  });
});

describe('checkSideScrollHtml', () => {
  it('a plain page passes', () => { expect(checkSideScrollHtml('<div class="a"><p style="color:red">x</p><img width="800" height="450" src="/a.png" alt=""></div>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkSideScrollHtml(v as any).errors).toEqual(['the page is not text']);
  });
  it('an inline width over 320px is an error', () => {
    expect(checkSideScrollHtml('<div style="width:600px">x</div>').errors.join()).toMatch(/<div> has an inline width of 600px/);
    expect(checkSideScrollHtml('<p style="min-width: 40rem">x</p>').errors).toHaveLength(1);
  });
  it('an inline width that is capped or small passes', () => {
    expect(checkSideScrollHtml('<div style="width:600px;max-width:100%">x</div>')).toEqual(none);
    expect(checkSideScrollHtml('<div style="width:300px">x</div>')).toEqual(none);
    expect(checkSideScrollHtml('<div style="width:600px;overflow-x:auto">x</div>')).toEqual(none);
  });
  it('an inline 100vw warns', () => { expect(checkSideScrollHtml('<div style="width:100vw">x</div>').warnings).toHaveLength(1); });
  it('a width attribute over 320 on a table, div or cell is an error', () => {
    for (const t of ['table', 'td', 'th', 'div', 'section', 'aside', 'pre', 'code'])
      expect(checkSideScrollHtml(`<${t} width="700">x</${t}>`).errors.join()).toMatch(new RegExp(`<${t}> has a width attribute of 700`));
    expect(checkSideScrollHtml('<table width="700px"></table>').errors).toHaveLength(1);
  });
  it('a width attribute of 320 or less, or in percent, passes', () => {
    expect(checkSideScrollHtml('<table width="320"></table><table width="100%"></table><td width="50"></td>')).toEqual(none);
  });
  it('the width attribute of a picture or a frame is not read here', () => {
    expect(checkSideScrollHtml('<img width="1200" height="600" src="/a.png" alt=""><iframe width="560" height="315"></iframe>')).toEqual(none);
  });
  it('text inside script, style, template and comments is not read', () => {
    expect(checkSideScrollHtml('<script>var s=\'<div style="width:900px">\';</script><style>.a{width:900px}</style><template><div style="width:900px"></div></template><!-- <table width="900"> -->')).toEqual(none);
  });
  it('single quotes, no quotes and upper case are read', () => {
    expect(checkSideScrollHtml("<DIV STYLE='width:600px'>x</DIV>").errors).toHaveLength(1);
    expect(checkSideScrollHtml('<table width=700></table>').errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkSideScrollHtml('<div>' + '<p style="color:red">x</p>'.repeat(40000) + '</div>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real style', () => {
  it('the style of the site passes with no message', () => {
    const real = readFileSync('src/styles/global.css', 'utf8');
    expect(checkSideScrollCss(real, { images: true })).toEqual(none);
  });
  it('the site name is cut with an ellipsis, not allowed to push the header wider', () => {
    const real = readFileSync('src/styles/global.css', 'utf8');
    expect(real).toMatch(/\.brand span:last-child\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string, style = '') =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}${style}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header>${body}<footer>f</footer></body></html>`;
  const run = (html: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'sidescroll-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), html);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const MAIN = '<main id="main"><h1>P</h1></main>';
  it('a good page passes', () => { expect(run(FULL(MAIN, '.a{max-width:900px}')).code).toBe(0); });
  it('a fixed width in the style stops the build', () => {
    const r = run(FULL(MAIN, '.card{width:500px}'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/dist: the rule "\.card" sets width to 500px/);
  });
  it('a fixed width in a min-width media query does not stop it', () => { expect(run(FULL(MAIN, '@media (min-width:768px){.card{width:500px}}')).code).toBe(0); });
  it('an inline width stops the build and names the page', () => {
    const r = run(FULL('<main id="main"><h1>P</h1><div style="width:700px">x</div></main>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <div> has an inline width of 700px/);
  });
  it('a picture with no max-width 100% rule is a warning, not an error', () => {
    const r = run(FULL('<main id="main"><h1>P</h1><img src="/a.png" width="800" height="450" alt="a"></main>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: dist: the pages have pictures, video or frames but no rule gives them max-width: 100%/);
  });
  it('a picture with the rule gives no such warning', () => {
    const r = run(FULL('<main id="main"><h1>P</h1><img src="/a.png" width="800" height="450" alt="a"></main>', 'img{max-width:100%;height:auto}'));
    expect(r.out).not.toMatch(/max-width: 100%/);
  });
});
