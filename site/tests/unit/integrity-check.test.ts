import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkIntegrity } from '../../scripts/integrity-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const S256 = 'sha256-LXEWQrcmsEQBYnyp+6wy9chTD7GQPMTbAiWHF5IaSIE=';
const S384 = 'sha384-11LCxR+6DimqGQVwqdQlPkQHegWNMpf6OlYw1b0BJiL5fCisrtMTtcg7uZDKp9qF';
const S512 = 'sha512-pKvURIxJVi2CgRXROh/M6pJ/UrTVRZKX+LQ+QtqJI4vBNibkPcs43bCCSIkn7JBPtCBXRDmD6IWFF51QVRr+Yg==';
const OWN = ['news.example.org'];
const page = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;
const lib = 'https://cdn.jsdelivr.net/npm/lib@1.2.3/dist/lib.min.js';
const css = 'https://cdnjs.cloudflare.com/ajax/libs/x/1.0.0/x.min.css';
const run1 = (b: string) => checkIntegrity(page(b), OWN);

describe('checkIntegrity: good pages', () => {
  it('a page with no script passes', () => { expect(run1('<p>hi</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkIntegrity(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkIntegrity('', OWN)).toEqual(none); });
  it('a library script with sha384 and crossorigin passes', () => { expect(run1(`<script src="${lib}" integrity="${S384}" crossorigin="anonymous"></script>`)).toEqual(none); });
  it('sha256 and sha512 pass', () => {
    expect(run1(`<script src="${lib}" integrity="${S256}" crossorigin></script>`)).toEqual(none);
    expect(run1(`<script src="${lib}" integrity="${S512}" crossorigin="anonymous"></script>`)).toEqual(none);
  });
  it('a library style sheet with a fingerprint passes', () => { expect(run1(`<link rel="stylesheet" href="${css}" integrity="${S384}" crossorigin="anonymous">`)).toEqual(none); });
  it('several fingerprints separated by blanks pass', () => { expect(run1(`<script src="${lib}" integrity="${S256} ${S384}" crossorigin="anonymous"></script>`)).toEqual(none); });
  it('an option after a question mark passes', () => { expect(run1(`<script src="${lib}" integrity="${S384}?ct=application/javascript" crossorigin="anonymous"></script>`)).toEqual(none); });
  it('url-safe base64 passes', () => {
    const safe = S384.replace(/\+/g, '-').replace(/\//g, '_');
    expect(run1(`<script src="${lib}" integrity="${safe}" crossorigin="anonymous"></script>`)).toEqual(none);
  });
  it('an own script with a fingerprint and no crossorigin passes', () => {
    expect(run1(`<script src="/app.js" integrity="${S384}"></script>`)).toEqual(none);
    expect(run1(`<script src="https://news.example.org/app.js" integrity="${S384}"></script>`)).toEqual(none);
  });
  it('an own script with no fingerprint passes', () => { expect(run1('<script src="/pagefind/pagefind-ui.js"></script>')).toEqual(none); });
  it('Cloudflare Turnstile, ad and analytics hosts with no fingerprint pass', () => {
    expect(run1('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>')).toEqual(none);
    expect(run1('<script src="https://pl123.example-ads.com/a.js"></script>')).toEqual(none);
    expect(run1('<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>')).toEqual(none);
  });
  it('a relative and a protocol-relative own address with no fingerprint pass', () => { expect(run1('<script src="app.js"></script><link rel="stylesheet" href="/a.css">')).toEqual(none); });
  it('an inline script with no integrity passes', () => { expect(run1('<script>var a=1;</script>')).toEqual(none); });
  it('the case of names is not read', () => { expect(run1(`<SCRIPT SRC="${lib}" INTEGRITY="${S384}" CROSSORIGIN="anonymous"></SCRIPT>`)).toEqual(none); });
  it('single quotes and no quotes are read', () => {
    expect(run1(`<script src='${lib}' integrity='${S384}' crossorigin=anonymous></script>`)).toEqual(none);
  });
  it('a modulepreload and a preload with a fingerprint pass', () => {
    expect(run1(`<link rel="modulepreload" href="${lib}" integrity="${S384}" crossorigin>`)).toEqual(none);
    expect(run1(`<link rel="preload" as="script" href="${lib}" integrity="${S384}" crossorigin>`)).toEqual(none);
  });
  it('a script inside a comment and a template is not read', () => {
    expect(run1(`<!-- <script src="${lib}" integrity="sha1-abc"></script> --><template><script src="${lib}"></script></template>`)).toEqual(none);
  });
  it('a tag called scripts is not a script', () => { expect(run1(`<scripts src="${lib}" integrity="x">`)).toEqual(none); });
  it('a library host that is not on the list passes', () => { expect(run1('<script src="https://static.example-cdn.net/a.js"></script>')).toEqual(none); });
  it('a library host with no ownHosts given still passes a good tag', () => {
    expect(checkIntegrity(page(`<script src="${lib}" integrity="${S384}" crossorigin="anonymous"></script>`))).toEqual(none);
  });
});

describe('checkIntegrity: errors', () => {
  it('sha1 is not read by a browser', () => {
    const r = run1(`<script src="${lib}" integrity="sha1-2jmj7l5rSw0yVb/vlWAYkK/YBwk=" crossorigin="anonymous"></script>`);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/kind "sha1" is not read by a browser/);
  });
  it('md5 is not read either', () => { expect(run1(`<script src="${lib}" integrity="md5-abc" crossorigin></script>`).errors[0]).toMatch(/kind "md5"/); });
  it('a missing dash is an error', () => { expect(run1(`<script src="${lib}" integrity="${S384.replace('sha384-', 'sha384')}" crossorigin></script>`).errors[0]).toMatch(/no kind-dash-fingerprint form/); });
  it('a word with no kind at all is an error', () => { expect(run1(`<script src="${lib}" integrity="abcdef" crossorigin></script>`).errors[0]).toMatch(/no kind-dash-fingerprint form/); });
  it('a dash first is an error', () => { expect(run1(`<script src="${lib}" integrity="-abc" crossorigin></script>`).errors[0]).toMatch(/no kind-dash-fingerprint form/); });
  it('a fingerprint that is too short is an error that says the lengths', () => {
    const r = run1(`<script src="${lib}" integrity="${S384.slice(0, 40)}" crossorigin></script>`);
    expect(r.errors[0]).toMatch(/a sha384 fingerprint is 64 characters long, this one is 33/);
  });
  it('a fingerprint that is too long is an error', () => { expect(run1(`<script src="${lib}" integrity="sha256-${'A'.repeat(50)}" crossorigin></script>`).errors[0]).toMatch(/sha256 fingerprint is 44 characters long, this one is 50/); });
  it('letters that are not base64 are an error', () => {
    const r = run1(`<script src="${lib}" integrity="sha256-${'!'.repeat(43)}=" crossorigin></script>`);
    expect(r.errors[0]).toMatch(/not base64/);
  });
  it('a sha256 fingerprint under a sha384 name is an error', () => { expect(run1(`<script src="${lib}" integrity="sha384-${S256.slice(7)}" crossorigin></script>`).errors[0]).toMatch(/sha384 fingerprint is 64/); });
  it('one bad word among good ones is named', () => {
    const r = run1(`<script src="${lib}" integrity="${S384} sha1-zzz" crossorigin></script>`);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/"sha1-zzz"/);
  });
  it('two bad words give two errors', () => { expect(run1(`<script src="${lib}" integrity="md5-a sha1-b" crossorigin></script>`).errors).toHaveLength(2); });
  it('a bad fingerprint on a style sheet is an error', () => { expect(run1(`<link rel="stylesheet" href="${css}" integrity="sha1-abc" crossorigin>`).errors[0]).toMatch(/kind "sha1"/); });
  it('a bad fingerprint on an own file is an error too', () => { expect(run1('<script src="/app.js" integrity="sha1-abc"></script>').errors[0]).toMatch(/kind "sha1"/); });
  it('a good fingerprint with no crossorigin on another website is an error', () => {
    const r = run1(`<script src="${lib}" integrity="${S384}"></script>`);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/no crossorigin attribute, so the browser blocks the file/);
  });
  it('the same on a style sheet and on a protocol-relative address', () => {
    expect(run1(`<link rel="stylesheet" href="${css}" integrity="${S384}">`).errors[0]).toMatch(/no crossorigin/);
    expect(run1(`<script src="//cdn.jsdelivr.net/npm/lib@1/a.js" integrity="${S384}"></script>`).errors[0]).toMatch(/no crossorigin/);
  });
  it('a host that is another website but not on the library list still needs crossorigin', () => {
    expect(run1(`<script src="https://static.example-cdn.net/a.js" integrity="${S384}"></script>`).errors[0]).toMatch(/no crossorigin/);
  });
  it('the error names the address, shortened', () => {
    const long = 'https://cdn.jsdelivr.net/npm/some-very-long-package-name@12.34.56/dist/some-very-long-file-name.min.js';
    expect(run1(`<script src="${long}" integrity="${S384}"></script>`).errors[0]).toMatch(/\.\.\./);
  });
  it('a www host of the owner is own', () => {
    expect(checkIntegrity(page(`<script src="https://www.news.example.org/a.js" integrity="${S384}"></script>`), ['news.example.org', 'www.news.example.org'])).toEqual(none);
  });
});

describe('checkIntegrity: warnings', () => {
  it('an empty integrity is a warning', () => {
    const r = run1(`<script src="${lib}" integrity="" crossorigin></script>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/empty integrity .* protects nothing/);
  });
  it('an integrity of blanks only is a warning', () => { expect(run1(`<script src="${lib}" integrity="   " crossorigin></script>`).warnings[0]).toMatch(/empty integrity/); });
  it('an integrity with no value is a warning', () => { expect(run1(`<link rel="stylesheet" href="${css}" integrity crossorigin>`).warnings[0]).toMatch(/empty integrity/); });
  it('an integrity on an inline script does nothing', () => {
    const r = run1(`<script integrity="${S384}">var a=1;</script>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]).toMatch(/script with no src/);
  });
  it('an integrity on an icon link does nothing', () => {
    const r = run1(`<link rel="icon" href="/favicon.ico" integrity="${S384}">`);
    expect(r.warnings[0]).toMatch(/link that is not a style sheet or preload/);
  });
  it('an integrity on a picture, a frame and a link does nothing', () => {
    expect(run1(`<img src="/a.jpg" alt="x" integrity="${S384}">`).warnings[0]).toMatch(/<img> tag/);
    expect(run1(`<iframe title="x" src="/a" integrity="${S384}"></iframe>`).warnings[0]).toMatch(/<iframe> tag/);
    expect(run1(`<a href="/a" integrity="${S384}">x</a>`).warnings[0]).toMatch(/<a> tag/);
  });
  it('a library script with no integrity is a warning that names the host', () => {
    const r = run1(`<script src="${lib}"></script>`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/script from the library host cdn\.jsdelivr\.net has no integrity/);
  });
  it('a library style sheet with no integrity is a warning', () => { expect(run1(`<link rel="stylesheet" href="${css}">`).warnings[0]).toMatch(/style sheet from the library host cdnjs\.cloudflare\.com/); });
  it('unpkg, jQuery and Google library hosts are read', () => {
    for (const h of ['unpkg.com/lib@1/a.js', 'code.jquery.com/jquery-3.7.1.min.js', 'ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js'])
      expect(run1(`<script src="https://${h}"></script>`).warnings).toHaveLength(1);
  });
  it('a library preload with no integrity is left alone (only scripts and style sheets are asked)', () => { expect(run1(`<link rel="preload" as="script" href="${lib}">`)).toEqual(none); });
  it('a mix gives each its own message', () => {
    const r = run1(`<script src="${lib}"></script><script src="${lib}2" integrity="sha1-abc" crossorigin></script><script integrity="${S384}">1</script>`);
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'sri-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good fingerprint passes', () => { expect(run(FULL(`<script src="${lib}" integrity="${S384}" crossorigin="anonymous"></script>`)).code).toBe(0); });
  it('a sha1 fingerprint stops the build and names the page', () => {
    const r = run(FULL(`<script src="${lib}" integrity="sha1-abc" crossorigin="anonymous"></script>`));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the integrity "sha1-abc" on .* is not a real fingerprint/);
  });
  it('a fingerprint with no crossorigin stops the build', () => {
    const r = run(FULL(`<script src="${lib}" integrity="${S384}"></script>`));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/no crossorigin attribute, so the browser blocks the file/);
  });
  it('a library script with no fingerprint is a warning, not an error', () => {
    const r = run(FULL(`<script src="${lib}"></script>`));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*library host cdn\.jsdelivr\.net has no integrity/);
  });
});
