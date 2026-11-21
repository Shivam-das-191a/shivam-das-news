import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkMeta } from '../../scripts/meta-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const PAGE = (head: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}<title>x</title></head><body><p>hi</p></body></html>`;

describe('checkMeta: good pages', () => {
  it('a plain page passes', () => { expect(checkMeta(PAGE(''))).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkMeta(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page and a fragment with no head pass', () => {
    expect(checkMeta('')).toEqual(none);
    expect(checkMeta('<main><p>hello</p></main>')).toEqual(none);
  });
  it('UTF-8 in any spelling and case passes', () => {
    for (const cs of ['utf-8', 'UTF-8', 'utf8', 'Utf-8']) expect(checkMeta(PAGE('').replace('utf-8', cs))).toEqual(none);
  });
  it('a charset with single quotes and none passes', () => {
    expect(checkMeta("<html><head><meta charset='utf-8'></head></html>")).toEqual(none);
    expect(checkMeta('<html><head><meta charset=utf-8></head></html>')).toEqual(none);
  });
  it('the old http-equiv content-type with utf-8 passes', () => {
    expect(checkMeta('<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head></html>')).toEqual(none);
  });
  it('other meta tags pass', () => {
    expect(checkMeta(PAGE('<meta name="viewport" content="width=device-width"><meta http-equiv="x-ua-compatible" content="ie=edge"><meta name="robots" content="noindex">'))).toEqual(none);
  });
  it('a base with an https address passes', () => { expect(checkMeta(PAGE('<base href="https://news.example.org/">'))).toEqual(none); });
  it('a relative base passes', () => { expect(checkMeta(PAGE('<base href="/">'))).toEqual(none); });
  it('a base with only a target passes', () => { expect(checkMeta(PAGE('<base target="_blank">'))).toEqual(none); });
  it('a refresh with a non-number content is left alone', () => { expect(checkMeta(PAGE('<meta http-equiv="refresh" content="soon">'))).toEqual(none); });
  it('a refresh with no content is left alone', () => { expect(checkMeta(PAGE('<meta http-equiv="refresh">'))).toEqual(none); });
});

describe('checkMeta: the character set', () => {
  it('a charset other than UTF-8 is an error', () => {
    expect(checkMeta('<html><head><meta charset="iso-8859-1"></head></html>').errors).toEqual(['the page declares the character set "iso-8859-1", but this site is UTF-8; letters and quotes will show as wrong signs']);
  });
  it('windows-1252 is an error', () => { expect(checkMeta('<head><meta charset="windows-1252"></head>').errors).toHaveLength(1); });
  it('an empty charset is an error', () => { expect(checkMeta('<head><meta charset=""></head>').errors).toHaveLength(1); });
  it('the old content-type with another set is an error', () => {
    expect(checkMeta('<head><meta http-equiv="content-type" content="text/html; charset=iso-8859-1"></head>').errors).toHaveLength(1);
  });
  it('the case of http-equiv is not read', () => {
    expect(checkMeta('<head><META HTTP-EQUIV="CONTENT-TYPE" CONTENT="text/html; charset=ISO-8859-1"></head>').errors).toHaveLength(1);
  });
  it('a page with a head and no charset is left alone (older fake pages have none)', () => {
    expect(checkMeta('<html><head><title>x</title></head><body></body></html>')).toEqual(none);
  });
  it('a charset declared twice is a warning', () => {
    expect(checkMeta('<head><meta charset="utf-8"><meta charset="utf-8"></head>').warnings).toEqual(['the character set is declared more than once; keep one <meta charset="utf-8">']);
  });
  it('a charset and a content-type together are a warning', () => {
    expect(checkMeta('<head><meta charset="utf-8"><meta http-equiv="content-type" content="text/html; charset=utf-8"></head>').warnings).toHaveLength(1);
  });
  it('a charset after the first 1024 bytes is a warning', () => {
    const r = checkMeta('<html><head><title>' + 'x'.repeat(1100) + '</title><meta charset="utf-8"></head></html>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the <meta charset> starts after the first 1024 bytes of the page, so a browser may miss it; put it first in the <head>']);
  });
  it('a charset inside the first 1024 bytes passes', () => { expect(checkMeta('<html><head><title>' + 'x'.repeat(500) + '</title><meta charset="utf-8"></head></html>')).toEqual(none); });
  it('a charset in a comment is not counted', () => {
    expect(checkMeta('<head><!-- <meta charset="iso-8859-1"> --><meta charset="utf-8"></head>')).toEqual(none);
  });
});

describe('checkMeta: refresh', () => {
  it('a refresh that moves the reader after some seconds is an error', () => {
    expect(checkMeta(PAGE('<meta http-equiv="refresh" content="5; url=/new/">')).errors).toEqual(['a <meta http-equiv="refresh"> moves the reader to /new/ after 5 seconds; readers lose their place and a screen reader cannot stop it']);
  });
  it('a refresh that reloads the page is an error', () => {
    expect(checkMeta(PAGE('<meta http-equiv="refresh" content="30">')).errors).toEqual(['a <meta http-equiv="refresh"> reloads the page after 30 seconds; readers lose their place and a screen reader cannot stop it']);
  });
  it('a comma, spaces, upper case and quotes around the address are read', () => {
    expect(checkMeta(PAGE('<meta http-equiv="REFRESH" content="3 , URL=\'/x/\'">')).errors).toHaveLength(1);
  });
  it('a delay with a decimal is an error', () => { expect(checkMeta(PAGE('<meta http-equiv="refresh" content="0.5; url=/x/">')).errors).toHaveLength(1); });
  it('a refresh of 0 seconds to an address is a warning, not an error', () => {
    const r = checkMeta(PAGE('<meta http-equiv="refresh" content="0; url=/new/">'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <meta http-equiv="refresh"> moves the reader to /new/ at once; a real 301 redirect (config/redirects.json) is faster and keeps the search ranking']);
  });
  it('a refresh of 0 seconds with no address passes', () => { expect(checkMeta(PAGE('<meta http-equiv="refresh" content="0">'))).toEqual(none); });
  it('the same message is not printed twice', () => {
    expect(checkMeta(PAGE('<meta http-equiv="refresh" content="5"><meta http-equiv="refresh" content="5">')).errors).toHaveLength(1);
  });
});

describe('checkMeta: base', () => {
  it('a base from http:// is an error', () => {
    expect(checkMeta(PAGE('<base href="http://news.example.org/">')).errors).toEqual(['a <base href="http://news.example.org/"> is not https, so every link and picture without a full address loads from http://']);
  });
  it('the case of the scheme is not read', () => { expect(checkMeta(PAGE('<base href="HTTP://x.org/">')).errors).toHaveLength(1); });
  it('two bases are an error', () => {
    expect(checkMeta(PAGE('<base href="/"><base href="/x/">')).errors).toEqual(['the page has more than one <base>; the browser uses the first and ignores the rest']);
  });
  it('a base with nothing in it is a warning', () => {
    expect(checkMeta(PAGE('<base>')).warnings).toEqual(['a <base> has no href and no target, so it does nothing']);
  });
  it('a base in a comment is not counted', () => { expect(checkMeta(PAGE('<!-- <base href="http://x.org/"> -->'))).toEqual(none); });
});

describe('checkMeta: what is left out', () => {
  it('text inside script, style and template is not read', () => {
    const extra = '<script>var s = \'<meta charset="iso-8859-1"><base href="http://x.org/">\';</script><style>a{content:"<meta charset=\'x\'>"}</style><template><meta http-equiv="refresh" content="5"></template>';
    expect(checkMeta(PAGE(extra))).toEqual(none);
  });
  it('a custom element that starts with meta or base is not read', () => {
    expect(checkMeta(PAGE('<meta-box charset="x"></meta-box><baseline href="http://x.org/"></baseline>'))).toEqual(none);
  });
  it('a tag with a greater-than sign in a value is read whole', () => { expect(checkMeta(PAGE('<meta name="description" content="a > b" charset="iso-8859-1">')).errors).toHaveLength(1); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkMeta('<html><head><meta charset="utf-8"></head><body>' + '<p class="a">text <a href="/x/">link</a></p><meta name="a" content="b">'.repeat(20000) + '</body></html>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout has no character set, refresh or base problem', () => {
    expect(checkMeta(readFileSync('src/layouts/Base.astro', 'utf8')).errors).toEqual([]);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (head: string, body = '') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex">${head}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'meta-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('')).code).toBe(0); });
  it('a second character set of another kind stops the build and names the page', () => {
    const r = run(FULL('<meta http-equiv="content-type" content="text/html; charset=iso-8859-1">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the page declares the character set "iso-8859-1"/);
  });
  it('a refresh with a delay stops the build', () => {
    const r = run(FULL('<meta http-equiv="refresh" content="5; url=/x/">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/moves the reader to \/x\/ after 5 seconds/);
  });
  it('a base from http:// stops the build', () => {
    const r = run(FULL('<base href="http://news.example.org/">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is not https, so every link/);
  });
  it('a refresh of 0 seconds is a warning, not an error', () => {
    const r = run(FULL('<meta http-equiv="refresh" content="0; url=/x/">'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*moves the reader to \/x\/ at once/);
  });
  it('a charset declared twice is a warning, not an error', () => {
    const r = run(FULL('<meta charset="utf-8">'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*declared more than once/);
  });
});
