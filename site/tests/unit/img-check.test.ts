// Part 8a: the picture rules for a built page (img-check-lib.mjs) and the build gate that uses them (validate-html.mjs).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkImgTags, attrOf, hostOf, ownHostsOf } from '../../scripts/img-check-lib.mjs';

const own = ['news.example.org'];
const good = '<img src="/media/a.webp" alt="A bridge" width="800" height="450">';

describe('attrOf and hostOf', () => {
  it('reads quoted, single quoted and bare values', () => {
    expect(attrOf('<img src="a.png" alt=\'x y\' width=10>', 'src')).toBe('a.png');
    expect(attrOf('<img src="a.png" alt=\'x y\' width=10>', 'alt')).toBe('x y');
    expect(attrOf('<img src="a.png" alt=\'x y\' width=10>', 'width')).toBe('10');
  });
  it('treats a bare alt as present and empty, and a missing one as undefined', () => {
    expect(attrOf('<img src="a.png" alt>', 'alt')).toBe('');
    expect(attrOf('<img src="a.png">', 'alt')).toBeUndefined();
  });
  it('does not mistake data-alt or srcset for alt or src', () => {
    expect(attrOf('<img data-alt="x" srcset="a 1x">', 'alt')).toBeUndefined();
    expect(attrOf('<img srcset="a 1x">', 'src')).toBeUndefined();
  });
  it('finds the host of a full or protocol relative address only', () => {
    expect(hostOf('https://Cdn.Example.com/a.jpg')).toBe('cdn.example.com');
    expect(hostOf('//cdn.example.com/a.jpg')).toBe('cdn.example.com');
    expect(hostOf('/media/a.jpg')).toBeNull();
    expect(hostOf('media/a.jpg')).toBeNull();
  });
  it('makes the own hosts from SITE_URL, with and without www, and nothing from a bad value', () => {
    expect(ownHostsOf('https://news.example.org')).toEqual(expect.arrayContaining(['news.example.org', 'www.news.example.org']));
    expect(ownHostsOf('news.example.org')).toContain('news.example.org');
    for (const v of [undefined, '', '   ', 5, null]) expect(ownHostsOf(v as any)).toEqual([]);
  });
});

describe('checkImgTags', () => {
  it('passes a good picture with nothing to say', () => { expect(checkImgTags(good, own)).toEqual({ errors: [], warnings: [] }); });
  it('passes a page with no picture and a value that is not text', () => {
    expect(checkImgTags('<p>hi</p>', own)).toEqual({ errors: [], warnings: [] });
    expect(checkImgTags(undefined as any, own)).toEqual({ errors: [], warnings: [] });
  });
  it('errors on a missing alt attribute but allows an empty alt', () => {
    expect(checkImgTags('<img src="/a.webp" width="1" height="1">', own).errors).toHaveLength(1);
    expect(checkImgTags('<img src="/a.webp" alt="" width="1" height="1">', own).errors).toEqual([]);
  });
  it('errors on an http address', () => {
    const r = checkImgTags('<img src="http://news.example.org/a.webp" alt="x" width="1" height="1">', own);
    expect(r.errors.join()).toContain('over http');
  });
  it('warns on a picture from another website, also a protocol relative one', () => {
    expect(checkImgTags('<img src="https://cdn.other.com/a.jpg" alt="x" width="1" height="1">', own).warnings.join()).toContain('cdn.other.com');
    expect(checkImgTags('<img src="//cdn.other.com/a.jpg" alt="x" width="1" height="1">', own).warnings).toHaveLength(1);
  });
  it('does not warn for our own website, with or without www', () => {
    expect(checkImgTags('<img src="https://news.example.org/a.jpg" alt="x" width="1" height="1">', ownHostsOf('https://news.example.org')).warnings).toEqual([]);
    expect(checkImgTags('<img src="https://www.news.example.org/a.jpg" alt="x" width="1" height="1">', ownHostsOf('https://news.example.org')).warnings).toEqual([]);
  });
  it('warns when width or height is missing, and says so once per picture', () => {
    expect(checkImgTags('<img src="/a.webp" alt="x" height="5">', own).warnings).toHaveLength(1);
    expect(checkImgTags('<img src="/a.webp" alt="x" width="5">', own).warnings).toHaveLength(1);
    expect(checkImgTags('<img src="/a.webp" alt="x">', own).warnings).toHaveLength(1);
  });
  it('skips data addresses and pictures inside script, style and template', () => {
    expect(checkImgTags('<img src="data:image/gif;base64,AAAA" alt="">', own).warnings).toEqual([]);
    expect(checkImgTags('<script>var s = \'<img src="http://x.com/a.png">\';</script><template><img src="/a.png"></template>', own)).toEqual({ errors: [], warnings: [] });
  });
  it('reads a tag whose alt text holds a > sign and checks every picture of the page', () => {
    const r = checkImgTags('<img src="/a.webp" alt="a > b" width="1" height="1"><img src="/b.webp" width="1" height="1">', own);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('/b.webp');
  });
  it('shortens a very long address in the sentence', () => {
    const long = '/media/' + 'a'.repeat(200) + '.webp';
    expect(checkImgTags(`<img src="${long}" width="1" height="1">`, own).errors[0].length).toBeLessThan(140);
  });
  it('is not case sensitive for the tag and the attribute names', () => {
    expect(checkImgTags('<IMG SRC="/a.webp" ALT="x" WIDTH="1" HEIGHT="1">', own)).toEqual({ errors: [], warnings: [] });
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const page = (body: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>Page</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (body: string) => {
    const d = mkdtempSync(join(tmpdir(), 'ih-')); mkdirSync(join(d, 'dist'));
    writeFileSync(join(d, 'dist/index.html'), page(body));
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('passes a page with a good picture', () => { const r = run(good); expect(r.stdout).toContain('Validation passed.'); expect(r.status).toBe(0); });
  it('fails a page with a picture that has no alt attribute', () => { const r = run('<img src="/a.webp" width="1" height="1">'); expect(r.stderr).toContain('no alt attribute'); expect(r.status).toBe(1); });
  it('fails a page with an http picture', () => { const r = run('<img src="http://news.example.org/a.webp" alt="x" width="1" height="1">'); expect(r.stderr).toContain('over http'); expect(r.status).toBe(1); });
  it('does not warn for a full address of our own website (SITE_URL)', () => {
    const r = run('<img src="https://news.example.org/media/a.webp" alt="x" width="1" height="1">');
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain('another website');
  });
  it('only warns for a picture from another website or without a size', () => {
    const r = run('<img src="https://cdn.other.com/a.jpg" alt="x"><img src="/b.webp" alt="y">');
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('another website');
    expect(r.stderr).toContain('no width and height');
  });
});
