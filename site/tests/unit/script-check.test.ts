import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkScripts } from '../../scripts/script-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkScripts: good pages', () => {
  it('a plain page passes', () => { expect(checkScripts('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkScripts(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkScripts('')).toEqual(none); });
  it('a script from https passes', () => { expect(checkScripts('<script src="https://cdn.example.org/a.js" defer></script>')).toEqual(none); });
  it('a relative and a protocol-relative script pass', () => {
    expect(checkScripts('<script src="/a.js"></script><script src="//cdn.example.org/b.js"></script><script src="c.js"></script>')).toEqual(none);
  });
  it('an inline script passes', () => { expect(checkScripts('<script>var a = 1;</script>')).toEqual(none); });
  it('a module script with async passes', () => { expect(checkScripts('<script type="module" src="/m.js" async></script>')).toEqual(none); });
  it('an inline module script with async passes', () => { expect(checkScripts('<script type="module" async>import "/m.js";</script>')).toEqual(none); });
  it('a style sheet from https and a relative one pass', () => {
    expect(checkScripts('<link rel="stylesheet" href="https://fonts.example.org/a.css"><link rel="stylesheet" href="/b.css">')).toEqual(none);
  });
  it('a link that is not a style sheet is left alone', () => {
    expect(checkScripts('<link rel="icon" href="http://x.org/i.png"><link rel="canonical" href="http://x.org/">')).toEqual(none);
  });
  it('JSON and data blocks are left alone', () => {
    expect(checkScripts('<script type="application/ld+json">{"a":"http://x.org"}</script><script type="importmap">{"imports":{}}</script><script type="speculationrules">{}</script>')).toEqual(none);
  });
  it('the case of the tag and of the type is not read', () => {
    expect(checkScripts('<SCRIPT TYPE="Application/LD+JSON">{}</SCRIPT><LINK REL="Stylesheet" HREF="https://x.org/a.css">')).toEqual(none);
  });
  it('single quotes and no quotes pass', () => { expect(checkScripts("<script src='/a.js'></script><script src=/b.js></script>")).toEqual(none); });
  it('a different src is not a repeat', () => { expect(checkScripts('<script src="/a.js"></script><script src="/b.js"></script>')).toEqual(none); });
  it('a script with a greater-than sign in a value is read whole', () => { expect(checkScripts('<script data-x="a > b" src="/a.js"></script>')).toEqual(none); });
});

describe('checkScripts: http scripts and style sheets are errors', () => {
  it('a script from http:// is an error', () => {
    expect(checkScripts('<script src="http://cdn.example.org/a.js"></script>').errors).toEqual(['a script loads from http://cdn.example.org/a.js, which is not https; the browser blocks it on an https page, so the script never runs']);
  });
  it('the case of the scheme is not read', () => { expect(checkScripts('<script src="HTTP://x.org/a.js"></script>').errors).toHaveLength(1); });
  it('a style sheet from http:// is an error', () => {
    expect(checkScripts('<link rel="stylesheet" href="http://x.org/a.css">').errors).toEqual(['a style sheet loads from http://x.org/a.css, which is not https; the browser blocks it on an https page, so the page loses its look']);
  });
  it('a rel with several words that has stylesheet is read', () => { expect(checkScripts('<link rel="alternate stylesheet" href="http://x.org/a.css">').errors).toHaveLength(1); });
  it('a style sheet with attributes in another order is read', () => { expect(checkScripts('<link href="http://x.org/a.css" media="print" rel="stylesheet">').errors).toHaveLength(1); });
  it('a long address is shortened in the message', () => {
    const r = checkScripts('<script src="http://x.org/' + 'a'.repeat(100) + '.js"></script>');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(200);
  });
  it('the same message is not printed twice', () => { expect(checkScripts('<script src="http://x.org/a.js"></script><script src="http://x.org/a.js"></script>').errors).toHaveLength(1); });
  it('two different http scripts give two errors', () => { expect(checkScripts('<script src="http://x.org/a.js"></script><script src="http://x.org/b.js"></script>').errors).toHaveLength(2); });
  it('a module script from http:// is an error', () => { expect(checkScripts('<script type="module" src="http://x.org/a.js"></script>').errors).toHaveLength(1); });
});

describe('checkScripts: an empty src is an error', () => {
  it('src="" is an error', () => { expect(checkScripts('<script src=""></script>').errors).toEqual(['a <script> has an empty src, so it never runs']); });
  it('src with only spaces is an error', () => { expect(checkScripts('<script src="   "></script>').errors).toHaveLength(1); });
  it('src with no value is an error', () => { expect(checkScripts('<script src></script>').errors).toHaveLength(1); });
  it('an empty src is not also reported as a script with text', () => { expect(checkScripts('<script src="">var a=1;</script>').warnings).toEqual([]); });
});

describe('checkScripts: warnings', () => {
  it('a script with a src and text of its own is a warning', () => {
    const r = checkScripts('<script src="/a.js">var a = 1;</script>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <script src="/a.js"> also holds text of its own; the browser ignores that text, so put it in a separate script']);
  });
  it('a script with a src and only spaces is fine', () => { expect(checkScripts('<script src="/a.js">  \n </script>')).toEqual(none); });
  it('async and defer together pass (the Cloudflare Turnstile snippet writes both)', () => {
    expect(checkScripts('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>')).toEqual(none);
  });
  it('async alone and defer alone pass', () => { expect(checkScripts('<script src="/a.js" async></script><script src="/b.js" defer></script>')).toEqual(none); });
  it('async on an inline classic script is a warning', () => { expect(checkScripts('<script async>var a=1;</script>').warnings).toHaveLength(1); });
  it('defer on an inline classic script is a warning', () => { expect(checkScripts('<script defer>var a=1;</script>').warnings).toHaveLength(1); });
  it('nomodule on a module is a warning', () => {
    expect(checkScripts('<script type="module" src="/m.js" nomodule></script>').warnings).toEqual(['a <script type="module"> also has nomodule, so a modern browser never runs it; remove nomodule']);
  });
  it('nomodule on a classic script passes', () => { expect(checkScripts('<script src="/legacy.js" nomodule></script>')).toEqual(none); });
  it('the same classic script twice is a warning', () => {
    expect(checkScripts('<script src="/a.js"></script><p>x</p><script src="/a.js"></script>').warnings).toEqual(['the script /a.js is loaded twice on one page, so it runs twice']);
  });
  it('the same module twice is not a warning (a module runs once)', () => { expect(checkScripts('<script type="module" src="/a.js"></script><script type="module" src="/a.js"></script>')).toEqual(none); });
  it('document.write is a warning', () => {
    expect(checkScripts('<script>document.write("<b>x</b>");</script>').warnings).toHaveLength(1);
  });
  it('document . writeln with spaces is a warning', () => { expect(checkScripts('<script>document . writeln ("x")</script>').warnings).toHaveLength(1); });
  it('a word that only contains document.write is left alone', () => { expect(checkScripts('<script>var x = mydocument.writer;</script>')).toEqual(none); });
  it('document.write in the text of a post (not a script) is left alone', () => { expect(checkScripts('<p>Do not call document.write( in new code.</p>')).toEqual(none); });
  it('a warning never becomes an error', () => { expect(checkScripts('<script src="/a.js">x</script>').errors).toEqual([]); });
});

describe('checkScripts: what is left out', () => {
  it('a script inside a comment is not read', () => { expect(checkScripts('<!-- <script src="http://x.org/a.js"></script> --><p>ok</p>')).toEqual(none); });
  it('a script inside a template is not read', () => { expect(checkScripts('<template><script src="http://x.org/a.js"></script></template>')).toEqual(none); });
  it('a comment inside a script does not hide the next script', () => {
    expect(checkScripts('<script>/* <!-- */ var a=1;</script><script src="http://x.org/a.js"></script>').errors).toHaveLength(1);
  });
  it('a custom element that starts with script or link is not read', () => {
    expect(checkScripts('<script-box src="http://x.org/a.js"></script-box><linkbar rel="stylesheet" href="http://x.org/a.css">')).toEqual(none);
  });
  it('a script that is never closed is left alone, no crash', () => { expect(checkScripts('<script src="http://x.org/a.js">')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkScripts('<main>' + '<p class="a b">text <a href="/x/">link</a></p><script>var a=1;</script>'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout has no script or style sheet problem', () => {
    const r = checkScripts(readFileSync('src/layouts/Base.astro', 'utf8'));
    expect(r.errors).toEqual([]);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'script-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p><script src="https://cdn.example.org/a.js" defer></script>')).code).toBe(0); });
  it('a script from http:// stops the build and names the page', () => {
    const r = run(FULL('<script src="http://cdn.example.org/a.js"></script>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a script loads from http:\/\/cdn\.example\.org\/a\.js/);
  });
  it('a style sheet from http:// stops the build', () => {
    const r = run(FULL('<link rel="stylesheet" href="http://x.org/a.css">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/a style sheet loads from http:\/\/x\.org\/a\.css/);
  });
  it('an empty src stops the build', () => {
    const r = run(FULL('<script src=""></script>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/empty src/);
  });
  it('a script src with text of its own is a warning, not an error', () => {
    const r = run(FULL('<script src="/a.js">var a=1;</script>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*holds text of its own/);
  });
  it('document.write is a warning, not an error', () => {
    const r = run(FULL('<script>document.write("x");</script>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*document\.write/);
  });
});
