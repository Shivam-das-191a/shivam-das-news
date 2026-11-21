import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkEntities } from '../../scripts/entity-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkEntities: good pages', () => {
  it('a plain page passes', () => { expect(checkEntities('<main><h1>x</h1><p>hello world</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkEntities(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkEntities('')).toEqual(none); });
  it('references written once pass', () => {
    expect(checkEntities('<p>Tom &amp; Jerry &lt;b&gt; &quot;hi&quot; &nbsp; &copy; 2026 &mdash; &#8217; &#x2019; &#169;</p>')).toEqual(none);
  });
  it('a lone ampersand passes', () => { expect(checkEntities('<p>Q & A, R&D, AT&T</p>')).toEqual(none); });
  it('an ampersand in a web address passes', () => { expect(checkEntities('<a href="/s/?a=1&b=2&copy=3&amp;nbsp=4">x</a>')).toEqual(none); });
  it('a hash after an ampersand in a web address passes', () => { expect(checkEntities('<a href="/s/?a=1&#top">x</a>')).toEqual(none); });
  it('real numbers pass: letters, symbols and emoji planes', () => {
    expect(checkEntities('<p>&#65; &#x41; &#X41; &#8364; &#128512; &#x1F600; &#xFFFD; &#10; &#9; &#13; &#32;</p>')).toEqual(none);
  });
  it('the last real character passes', () => { expect(checkEntities('<p>&#1114111; &#x10FFFF;</p>')).toEqual(none); });
  it('names that are not in the list are left alone', () => { expect(checkEntities('<p>&amp;madeupname; &madeup &zzz;</p>')).toEqual(none); });
  it('a name followed by letters is not read as a name with no semicolon', () => { expect(checkEntities('<p>&copyright &ampere &nbspx</p>')).toEqual(none); });
  it('a name followed by an equals sign is not read', () => { expect(checkEntities('<p>a&copy=b</p>')).toEqual(none); });
});

describe('checkEntities: a character escaped twice is an error', () => {
  it('&amp;amp; is an error', () => {
    expect(checkEntities('<p>Tom &amp;amp; Jerry</p>').errors).toEqual(['the text holds &amp;amp;, a character escaped twice, so readers see the code and not the character; write it once (&amp;)']);
  });
  it('&amp;nbsp; and &amp;quot; are errors', () => { expect(checkEntities('<p>a&amp;nbsp;b &amp;quot;c&amp;quot;</p>').errors).toHaveLength(2); });
  it('&amp;#8217; and &amp;#x2019; are errors', () => {
    expect(checkEntities('<p>it&amp;#8217;s &amp;#x2019;</p>').errors).toEqual([
      'the text holds &amp;#8217;, a character escaped twice, so readers see the code and not the character; write it once (&#8217;)',
      'the text holds &amp;#x2019;, a character escaped twice, so readers see the code and not the character; write it once (&#x2019;)',
    ]);
  });
  it('a double escape in a headline is read', () => { expect(checkEntities('<h1>Tom &amp;amp; Jerry</h1>').errors).toHaveLength(1); });
  it('the same message is not printed twice', () => { expect(checkEntities('<p>&amp;amp;</p><p>&amp;amp;</p>').errors).toHaveLength(1); });
  it('an escaped ampersand before a word and a semicolon far away is not an error', () => { expect(checkEntities('<p>R&amp;D; a&amp;b</p>')).toEqual(none); });
  it('a double escape inside an attribute value is not read as text', () => { expect(checkEntities('<a href="/x/" title="a &amp;amp; b">x</a>')).toEqual(none); });
});

describe('checkEntities: numeric references that are not real characters are errors', () => {
  it('&#0; and &#x0; are errors', () => {
    expect(checkEntities('<p>&#0;</p>').errors).toEqual(['a character reference &#0; is the null character, which a browser replaces with a question mark box']);
    expect(checkEntities('<p>&#x0;</p>').errors).toHaveLength(1);
    expect(checkEntities('<p>&#000;</p>').errors).toHaveLength(1);
  });
  it('the surrogate range is an error', () => {
    for (const v of ['&#xD800;', '&#xDFFF;', '&#55296;', '&#57343;', '&#xdc00;'])
      expect(checkEntities(`<p>${v}</p>`).errors, v).toHaveLength(1);
  });
  it('the edge of the surrogate range passes', () => { expect(checkEntities('<p>&#xD7FF; &#xE000;</p>')).toEqual(none); });
  it('a number above 10FFFF is an error', () => {
    for (const v of ['&#1114112;', '&#x110000;', '&#99999999;'])
      expect(checkEntities(`<p>${v}</p>`, ).errors, v).toHaveLength(1);
  });
  it('a reference with no number is an error', () => {
    expect(checkEntities('<p>&#;</p>').errors).toEqual(['a character reference &#; has no number']);
    expect(checkEntities('<p>&#x;</p>').errors).toEqual(['a character reference &#x; has no number']);
  });
  it('a bad number is an error inside an attribute value too', () => { expect(checkEntities('<img alt="a&#0;b" src="/a.jpg">').errors).toHaveLength(1); });
  it('a bad number with no semicolon is an error', () => { expect(checkEntities('<p>&#0 x</p>').errors).toHaveLength(1); });
  it('a very long number is cut in the message', () => { expect(checkEntities(`<p>&#${'9'.repeat(300)};</p>`).errors[0].length).toBeLessThan(200); });
});

describe('checkEntities: warnings', () => {
  it('a name with no semicolon is a warning, not an error', () => {
    const r = checkEntities('<p>a&nbsp b</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the text holds &nbsp with no semicolon, so it can show as plain text; write &nbsp;']);
  });
  it('several common names with no semicolon are read', () => {
    expect(checkEntities('<p>&copy 2026 &mdash and &amp. &lt &gt</p>').warnings).toHaveLength(5);
  });
  it('a name with no semicolon at the end of the text is read', () => { expect(checkEntities('<p>x&mdash</p>').warnings).toHaveLength(1); });
  it('a control character reference is a warning, not an error', () => {
    const r = checkEntities('<p>&#1; &#8; &#11; &#14; &#31;</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(5);
  });
  it('an old Windows code is a warning', () => {
    const r = checkEntities('<p>it&#146;s &#150; &#x92; &#127; &#159;</p>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      'a character reference &#146; is a control character or an old Windows code; write the real character instead',
      'a character reference &#150; is a control character or an old Windows code; write the real character instead',
      'a character reference &#x92; is a control character or an old Windows code; write the real character instead',
      'a character reference &#127; is a control character or an old Windows code; write the real character instead',
      'a character reference &#159; is a control character or an old Windows code; write the real character instead',
    ]);
  });
  it('tab, line feed, carriage return, space and the first real number after the range pass', () => { expect(checkEntities('<p>&#9; &#10; &#12; &#13; &#32; &#160;</p>')).toEqual(none); });
  it('the same warning is not printed twice', () => { expect(checkEntities('<p>&#146;</p><p>&#146;</p>').warnings).toHaveLength(1); });
});

describe('checkEntities: what is left out', () => {
  it('a code sample may show &amp; with &amp;amp;', () => {
    expect(checkEntities('<pre><code>&amp;amp; &amp;nbsp; &nbsp</code></pre><p><code>&amp;amp;</code> <kbd>&amp;quot;</kbd> <samp>&nbsp</samp><textarea>&amp;amp;</textarea></p>')).toEqual(none);
  });
  it('text after a code sample is still read', () => { expect(checkEntities('<code>&amp;amp;</code><p>&amp;amp;</p>').errors).toHaveLength(1); });
  it('a custom element that starts with code is not a code sample', () => { expect(checkEntities('<code-box>x</code-box><p>&amp;amp;</p>').errors).toHaveLength(1); });
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s="&amp;amp; &#0;";</script><template>&amp;amp;</template><!-- &amp;amp; &#0; --><style>a:after{content:"&#0;"}</style>';
    expect(checkEntities(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a tag with a greater-than sign in a value does not leak its text', () => { expect(checkEntities('<a title="a > &amp;amp;" href="/x/">ok</a>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkEntities('<main>' + '<p class="a b">Tom &amp; Jerry &#8217; text &nbsp; more</p>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout has no broken reference', () => {
    expect(checkEntities(readFileSync('src/layouts/Base.astro', 'utf8')).errors).toEqual([]);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'entity-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>Tom &amp; Jerry &#8217; ok</p>')).code).toBe(0); });
  it('an ampersand escaped twice stops the build and names the page', () => {
    const r = run(FULL('<p>Tom &amp;amp; Jerry</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the text holds &amp;amp;/);
  });
  it('a numeric reference to a character that does not exist stops the build', () => {
    const r = run(FULL('<p>x &#0; y</p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is the null character/);
  });
  it('a name with no semicolon is a warning, not an error', () => {
    const r = run(FULL('<p>a&nbsp b</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*&nbsp with no semicolon/);
  });
  it('an old Windows code is a warning, not an error', () => {
    const r = run(FULL('<p>it&#146;s</p>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*old Windows code/);
  });
});
