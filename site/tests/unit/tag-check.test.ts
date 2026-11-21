import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTags } from '../../scripts/tag-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkTags: good pages', () => {
  it('a plain page passes', () => { expect(checkTags('<main><h1>x</h1><p class="a b" id="c">hello</p><a href="/x/">y</a></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkTags(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkTags('')).toEqual(none); });
  it('different attributes on one tag pass', () => { expect(checkTags('<img src="a.jpg" alt="x" width="10" height="5" loading="lazy">')).toEqual(none); });
  it('the same attribute on two different tags passes', () => { expect(checkTags('<p class="a">x</p><p class="b">y</p>')).toEqual(none); });
  it('attributes with no value pass', () => { expect(checkTags('<input disabled required type="text"><script async defer src="/a.js"></script>')).toEqual(none); });
  it('single quotes, no quotes and upper case pass', () => { expect(checkTags("<P CLASS='a' ID=b>x</P>")).toEqual(none); });
  it('a value that holds a space and a name-like word is not read as an attribute', () => {
    expect(checkTags('<p title="class=a class=b" data-x=\'id="1" id="2"\'>x</p>')).toEqual(none);
  });
  it('names that only end with an old word pass', () => { expect(checkTags('<div data-align="x" data-bgcolor="y" textalign="z" data-valign="q">a</div>')).toEqual(none); });
  it('a custom element passes, even one that starts with an old word', () => { expect(checkTags('<font-icon align="x"></font-icon><my-marquee class="a" class="b"></my-marquee>')).toEqual(none); });
  it('a closing tag is not a tag', () => { expect(checkTags('<p>x</p></center></marquee>')).toEqual(none); });
  it('tags with a similar name pass', () => { expect(checkTags('<main><menu><li>a</li></menu><image-box></image-box><fieldset></fieldset><footer></footer></main>')).toEqual(none); });
});

describe('checkTags: repeated attributes are errors', () => {
  it('a repeated class is an error', () => {
    expect(checkTags('<p class="a" class="b">x</p>').errors).toEqual(['a <p> has the attribute class twice; the browser keeps the first and ignores the second']);
  });
  it('the case of a name does not matter', () => { expect(checkTags('<p class="a" CLASS="b">x</p>').errors).toHaveLength(1); });
  it('a repeated attribute with no value is an error', () => { expect(checkTags('<input disabled disabled>').errors).toHaveLength(1); });
  it('a repeated id, href or src is an error', () => {
    expect(checkTags('<a href="/a/" href="/b/">x</a>').errors).toHaveLength(1);
    expect(checkTags('<img src="a.jpg" src="b.jpg" alt="x">').errors).toHaveLength(1);
    expect(checkTags('<p id="a" id="b">x</p>').errors).toHaveLength(1);
  });
  it('two different repeats on one tag give two messages', () => { expect(checkTags('<p class="a" class="b" id="c" id="d">x</p>').errors).toHaveLength(2); });
  it('a repeat three times is one message', () => { expect(checkTags('<p class="a" class="b" class="c">x</p>').errors).toHaveLength(1); });
  it('a repeat across a line break is read', () => { expect(checkTags('<p\n  class="a"\n  class="b">x</p>').errors).toHaveLength(1); });
  it('a repeat after a value that holds a greater-than sign is read', () => { expect(checkTags('<p title="a > b" class="a" class="b">x</p>').errors).toHaveLength(1); });
  it('a repeat on a void tag with a closing slash is read', () => { expect(checkTags('<br class="a" class="b" />').errors).toHaveLength(1); });
  it('a very long repeated name is cut in the message', () => {
    const n = 'x'.repeat(300);
    expect(checkTags(`<p ${n}="1" ${n}="2">x</p>`).errors[0].length).toBeLessThan(200);
  });
  it('the same message is not printed twice', () => { expect(checkTags('<p class="a" class="b">x</p><p class="a" class="b">y</p>').errors).toHaveLength(1); });
});

describe('checkTags: dropped tags are errors', () => {
  it('each dropped tag is an error', () => {
    for (const t of ['marquee', 'blink', 'frame', 'frameset', 'noframes', 'applet', 'bgsound', 'isindex', 'plaintext', 'xmp', 'listing', 'keygen', 'menuitem', 'noembed', 'spacer', 'command', 'nextid'])
      expect(checkTags(`<${t}>x</${t}>`).errors, t).toEqual([`a <${t}> tag is no longer part of HTML and browsers do not run it as it was meant; remove it`]);
  });
  it('upper case is read', () => { expect(checkTags('<MARQUEE>news</MARQUEE>').errors).toHaveLength(1); });
  it('a dropped tag with attributes is read', () => { expect(checkTags('<marquee behavior="scroll" scrollamount="3">x</marquee>').errors).toHaveLength(1); });
  it('a dropped tag with a closing slash is read', () => { expect(checkTags('<spacer type="block" />').errors).toHaveLength(1); });
  it('a dropped tag is an error and not also a warning', () => { expect(checkTags('<marquee>x</marquee>').warnings).toEqual([]); });
});

describe('checkTags: old tags and attributes are warnings', () => {
  it('each old tag is a warning, not an error', () => {
    for (const t of ['center', 'font', 'big', 'strike', 'tt', 'acronym', 'nobr', 'basefont', 'dir', 'rb', 'rtc']) {
      const r = checkTags(`<${t}>x</${t}>`);
      expect(r.errors, t).toEqual([]);
      expect(r.warnings, t).toEqual([`a <${t}> tag is old HTML; use CSS or a current tag instead`]);
    }
  });
  it('each old attribute is a warning, not an error', () => {
    for (const a of ['align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'hspace', 'vspace']) {
      const r = checkTags(`<td ${a}="x">y</td>`);
      expect(r.errors, a).toEqual([]);
      expect(r.warnings, a).toEqual([`a <td> has the old attribute ${a}; use CSS instead`]);
    }
  });
  it('an old attribute in upper case is read', () => { expect(checkTags('<td ALIGN="left">x</td>').warnings).toHaveLength(1); });
  it('an old attribute with no value is read', () => { expect(checkTags('<div align>x</div>').warnings).toHaveLength(1); });
  it('the same warning is not printed twice', () => { expect(checkTags('<center>a</center><center>b</center>').warnings).toHaveLength(1); });
  it('an old tag and a repeated attribute give a warning and an error', () => {
    const r = checkTags('<font color="red" color="blue">x</font>');
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('checkTags: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<marquee class="a" class="b">\';</script><template><center align="x"></center></template><!-- <blink> --><style>marquee{color:red}</style>';
    expect(checkTags(extra + '<p>ok</p>')).toEqual(none);
  });
  it('everything inside svg and math is not read', () => {
    const svg = '<svg viewBox="0 0 10 10"><font><font-face font-family="x"/></font><path d="M0 0" d="M1 1"/></svg>';
    expect(checkTags(svg + '<p>ok</p>')).toEqual(none);
    expect(checkTags('<math><mfrac class="a" class="b"></mfrac></math>')).toEqual(none);
  });
  it('a tag after an svg is still read', () => { expect(checkTags('<svg><path d="M0 0"/></svg><marquee>x</marquee>').errors).toHaveLength(1); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkTags('<main>' + '<p class="a b" data-x="1" lang="en-US" dir="ltr">text</p>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout repeats no attribute and uses no old tag', () => {
    expect(checkTags(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'tag-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p class="a">He said hello</p>')).code).toBe(0); });
  it('a repeated attribute stops the build and names the page', () => {
    const r = run(FULL('<p class="a" class="b">x</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <p> has the attribute class twice/);
  });
  it('a dropped tag stops the build', () => {
    const r = run(FULL('<marquee>x</marquee>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/no longer part of HTML/);
  });
  it('an old tag is a warning, not an error', () => {
    const r = run(FULL('<center>x</center>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*old HTML/);
  });
  it('an old attribute is a warning, not an error', () => {
    const r = run(FULL('<p align="center">x</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*old attribute align/);
  });
});
