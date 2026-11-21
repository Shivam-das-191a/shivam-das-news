import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkHead, checkDuplicateTitles } from '../../scripts/head-check-lib.mjs';

const HEAD = '<title>Story | News</title><meta name="description" content="A short description."><link rel="canonical" href="https://news.example.org/a/"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#d94a00"><meta property="og:title" content="Story"><meta property="og:url" content="https://news.example.org/a/"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary_large_image">';
const page = (head: string) => `<!doctype html><html lang="en"><head>${head}</head><body></body></html>`;
const GOOD = page(HEAD);
const swap = (from: string, to: string) => page(HEAD.replace(from, to));
const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkHead: a good head', () => {
  it('passes with no message and returns the title and the noindex flag', () => {
    const r = checkHead(GOOD);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.title).toBe('Story | News');
    expect(r.noindex).toBe(false);
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkHead(v as any).errors).toEqual(['the page is not text']);
  });
  it('a page with no head is one error', () => {
    expect(checkHead('<html><body>x</body></html>').errors).toEqual(['the page has no head']);
  });
  it('single quotes, no quotes and upper case names are read', () => {
    const h = "<TITLE>T</TITLE><META NAME='description' CONTENT='d'><link rel=canonical href=https://a.org/x/><meta name=robots content=index><meta property=og:title content=T><meta property=og:image content=https://a.org/i.png><meta name=twitter:card content=summary><meta name=theme-color content=#fff>";
    expect(checkHead(page(h))).toMatchObject(none);
  });
});

describe('checkHead: the title', () => {
  it('no title is an error', () => { expect(checkHead(swap('<title>Story | News</title>', '')).errors.join()).toMatch(/no title tag/); });
  it('two titles are an error', () => { expect(checkHead(swap('<title>Story | News</title>', '<title>A</title><title>B</title>')).errors.join()).toMatch(/more than one title tag \(2\)/); });
  it('an empty or blank title is an error', () => {
    expect(checkHead(swap('<title>Story | News</title>', '<title></title>')).errors.join()).toMatch(/title is empty/);
    expect(checkHead(swap('<title>Story | News</title>', '<title>  \n </title>')).errors.join()).toMatch(/title is empty/);
  });
  it('a title over 70 characters only warns', () => {
    const r = checkHead(swap('Story | News', 'x'.repeat(71)));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/title is 71 characters/);
  });
  it('70 characters is fine', () => { expect(checkHead(swap('Story | News', 'x'.repeat(70))).warnings).toEqual([]); });
  it('entities are counted as one character: &amp; is one', () => {
    expect(checkHead(swap('Story | News', 'a&amp;b'.repeat(10))).warnings).toEqual([]);
    expect(checkHead(swap('Story | News', 'Tom &amp; Jerry')).title).toBe('Tom & Jerry');
    expect(checkHead(swap('Story | News', 'It&#39;s &#x41;')).title).toBe("It's A");
  });
  it('a title inside a script or a comment does not count', () => {
    expect(checkHead(page(HEAD + '<script>var t="<title>x</title>"</script><!-- <title>y</title> -->')).errors).toEqual([]);
  });
  it('a title in the body is not read', () => {
    expect(checkHead('<html><head>' + HEAD.replace('<title>Story | News</title>', '') + '</head><body><title>b</title></body></html>').errors.join()).toMatch(/no title tag/);
  });
});

describe('checkHead: the canonical link', () => {
  it('a relative canonical is an error', () => { expect(checkHead(swap('https://news.example.org/a/"><meta name="robots"', '/a/"><meta name="robots"')).errors.join()).toMatch(/canonical link is not a full http or https address: "\/a\/"/); });
  it('a canonical with another scheme is an error', () => { expect(checkHead(swap('<link rel="canonical" href="https://news.example.org/a/">', '<link rel="canonical" href="ftp://news.example.org/a/">')).errors.join()).toMatch(/canonical link is not a full/); });
  it('two canonicals are an error', () => { expect(checkHead(swap('<meta name="robots"', '<link rel="canonical" href="https://news.example.org/b/"><meta name="robots"')).errors.join()).toMatch(/more than one canonical link \(2\)/); });
  it('a missing canonical is not reported here (validate-html does it)', () => { expect(checkHead(swap('<link rel="canonical" href="https://news.example.org/a/">', '')).errors).toEqual([]); });
  it('rel with several words still counts', () => { expect(checkHead(swap('rel="canonical"', 'rel="Canonical nofollow"')).errors).toEqual([]); });
  it('http warns, but not on localhost', () => {
    const r = checkHead(swap('<link rel="canonical" href="https://news.example.org/a/">', '<link rel="canonical" href="http://news.example.org/a/">'));
    expect(r.warnings.join()).toMatch(/uses http, not https/);
    const l = checkHead(page(HEAD.replaceAll('https://news.example.org/a/', 'http://localhost:4321/a/')));
    expect(l.warnings).toEqual([]);
    expect(l.errors).toEqual([]);
  });
});

describe('checkHead: description and robots', () => {
  it('two descriptions are an error', () => { expect(checkHead(swap('<link rel="canonical"', '<meta name="description" content="x"><link rel="canonical"')).errors.join()).toMatch(/more than one meta description/); });
  it('an empty description warns; a missing one says nothing here', () => {
    expect(checkHead(swap('content="A short description."', 'content=""')).warnings.join()).toMatch(/description is empty/);
    expect(checkHead(swap('<meta name="description" content="A short description.">', '')).warnings).toEqual([]);
  });
  it('a description over 160 characters warns; 160 is fine', () => {
    expect(checkHead(swap('A short description.', 'd'.repeat(161))).warnings.join()).toMatch(/161 characters/);
    expect(checkHead(swap('A short description.', 'd'.repeat(160))).warnings).toEqual([]);
  });
  it('two robots tags are an error', () => { expect(checkHead(swap('<meta name="theme-color"', '<meta name="robots" content="noindex"><meta name="theme-color"')).errors.join()).toMatch(/more than one robots tag/); });
  it('index and noindex together are an error', () => { expect(checkHead(swap('index,follow', 'index,noindex')).errors.join()).toMatch(/both index and noindex/); });
  it('noindex is read, with spaces and capitals', () => {
    expect(checkHead(swap('index,follow,max-image-preview:large', ' NoIndex , follow ')).noindex).toBe(true);
    expect(checkHead(swap('index,follow,max-image-preview:large', 'none')).noindex).toBe(true);
    expect(checkHead(swap('index,follow,max-image-preview:large', 'noindex,follow')).errors).toEqual([]);
  });
  it('noindexfoo is not noindex', () => { expect(checkHead(swap('index,follow', 'noindexfoo')).noindex).toBe(false); });
});

describe('checkHead: the share tags', () => {
  it('no og:title or an empty one is an error', () => {
    expect(checkHead(swap('<meta property="og:title" content="Story">', '')).errors.join()).toMatch(/no og:title/);
    expect(checkHead(swap('content="Story"', 'content=" "')).errors.join()).toMatch(/no og:title/);
  });
  it('og:url and og:image must be full addresses', () => {
    expect(checkHead(swap('property="og:url" content="https://news.example.org/a/"', 'property="og:url" content="/a/"')).errors.join()).toMatch(/og:url is not a full/);
    expect(checkHead(swap('content="https://news.example.org/og.png"', 'content="/og.png"')).errors.join()).toMatch(/og:image is not a full http or https address: "\/og.png"/);
  });
  it('og:url that is not the canonical warns', () => { expect(checkHead(swap('property="og:url" content="https://news.example.org/a/"', 'property="og:url" content="https://news.example.org/b/"')).warnings.join()).toMatch(/is not the canonical/); });
  it('no og:image, no twitter:card and no theme-color only warn', () => {
    const r = checkHead(page(HEAD.replace(/<meta property="og:image"[^>]*>/, '').replace(/<meta name="twitter:card"[^>]*>/, '').replace(/<meta name="theme-color"[^>]*>/, '')));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('|')).toMatch(/og:image.*twitter:card.*theme-color/);
  });
  it('a meta that holds the words in another attribute is not a match', () => {
    expect(checkHead(swap('<meta name="twitter:card" content="summary_large_image">', '<meta content="twitter:card">')).warnings.join()).toMatch(/twitter:card/);
  });
});

describe('checkHead: odd input', () => {
  it('a very long head and a broken tag do not hang or throw', () => {
    expect(() => checkHead(page('<meta ' + 'a="b" '.repeat(20000) + HEAD))).not.toThrow();
    expect(() => checkHead(page('<meta name="robots content="x"' + HEAD))).not.toThrow();
    expect(() => checkHead('<head><title>')).not.toThrow();
  });
  it('a > inside a quoted value does not end the tag', () => {
    const r = checkHead(swap('content="A short description."', 'content="a > b"'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('checkDuplicateTitles', () => {
  const e = (file: string, title: string, noindex = false) => ({ file, title, noindex });
  it('unique titles say nothing', () => { expect(checkDuplicateTitles([e('a', 'A'), e('b', 'B')])).toEqual([]); });
  it('two pages with one title: one warning naming both', () => {
    const w = checkDuplicateTitles([e('dist/a/index.html', 'Same'), e('dist/b/index.html', 'same ')]);
    expect(w.length).toBe(1);
    expect(w[0]).toMatch(/^2 indexable pages share the title "Same": dist\/a\/index.html, dist\/b\/index.html$/);
  });
  it('a noindex page and an empty title are left out', () => {
    expect(checkDuplicateTitles([e('a', 'Same'), e('b', 'Same', true), e('c', ''), e('d', '')])).toEqual([]);
  });
  it('more than three pages: the first three and a count', () => {
    const w = checkDuplicateTitles(['a', 'b', 'c', 'd', 'e'].map((f) => e(f, 'Same')));
    expect(w[0]).toMatch(/5 indexable pages share the title "Same": a, b, c, and 2 more$/);
  });
  it('bad input is not a crash', () => {
    expect(checkDuplicateTitles(undefined as any)).toEqual([]);
    expect(checkDuplicateTitles([null, 5, {}] as any)).toEqual([]);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const SHELL = (head: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style>${head}</head><body data-page-type="page"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1></main><footer>f</footer></body></html>`;
  const run = (pages: Record<string, string>) => {
    const d = mkdtempSync(join(tmpdir(), 'hc-'));
    for (const [name, html] of Object.entries(pages)) {
      mkdirSync(join(d, 'dist', name), { recursive: true });
      writeFileSync(join(d, 'dist', name, 'index.html'), html);
    }
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  const goodHead = (n: string) => HEAD.replace('Story | News', 'Story ' + n).replace(/news\.example\.org\/a\//g, `news.example.org/${n}/`);
  it('a good page passes', () => {
    const r = run({ a: SHELL(goodHead('a')) });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
    expect(r.stderr).not.toMatch(/warn: dist\/a/);
  });
  it('no title stops the build and names the page', () => {
    const r = run({ a: SHELL(goodHead('a').replace(/<title>[^<]*<\/title>/, '')) });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/dist[\\/]a[\\/]index\.html: no title tag/);
  });
  it('a relative canonical stops the build', () => {
    const r = run({ a: SHELL(goodHead('a').replace('href="https://news.example.org/a/"', 'href="/a/"')) });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/canonical link is not a full/);
  });
  it('index and noindex together stop the build', () => {
    const r = run({ a: SHELL(goodHead('a').replace('index,follow', 'index,noindex')) });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/both index and noindex/);
  });
  it('a shared title between two indexable pages only warns', () => {
    const r = run({ a: SHELL(goodHead('a')), b: SHELL(goodHead('b').replace('Story b', 'Story a')) });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn: 2 indexable pages share the title "Story a"/);
  });
  it('a long title only warns', () => {
    const r = run({ a: SHELL(goodHead('a').replace('Story a', 'x'.repeat(80))) });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn: .*title is 80 characters/);
  });
});
