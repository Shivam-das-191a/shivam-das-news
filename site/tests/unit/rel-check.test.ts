import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkRel } from '../../scripts/rel-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkRel: good pages', () => {
  it('a page with no rel passes', () => { expect(checkRel('<main><h1>x</h1><p>hello <a href="/x/">link</a></p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkRel(v as any).errors).toEqual(['the page is not text']);
  });
  it('real rel words on a link pass', () => {
    expect(checkRel('<a href="https://x.org/" target="_blank" rel="noopener noreferrer nofollow">x</a><a href="/y/" rel="sponsored ugc">y</a><a href="/me/" rel="me">me</a><a href="/n/" rel="next">n</a><a href="/t/" rel="tag">t</a><a href="/e/" rel="external license author bookmark help">e</a>')).toEqual(none);
  });
  it('real head links pass', () => {
    expect(checkRel('<link rel="stylesheet" href="/a.css"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/a.png"><link rel="manifest" href="/site.webmanifest"><link rel="alternate" type="application/rss+xml" href="/feed.xml"><link rel="canonical" href="https://x.org/"><link rel="shortcut icon" href="/f.ico"><link rel="mask-icon" href="/m.svg"><link rel="amphtml" href="/amp/">')).toEqual(none);
  });
  it('preconnect, dns-prefetch, prefetch and modulepreload with an address pass', () => {
    expect(checkRel('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="dns-prefetch" href="https://x.org"><link rel="prefetch" href="/next/"><link rel="modulepreload" href="/m.js">')).toEqual(none);
  });
  it('a preload with a real "as" passes', () => {
    for (const as of ['audio', 'document', 'embed', 'fetch', 'image', 'object', 'script', 'style', 'track', 'video', 'worker'])
      expect(checkRel(`<link rel="preload" href="/x" as="${as}">`), as).toEqual(none);
  });
  it('a font preload with crossorigin passes', () => {
    expect(checkRel('<link rel="preload" href="/f.woff2" as="font" type="font/woff2" crossorigin>')).toEqual(none);
    expect(checkRel('<link rel="preload" href="/f.woff2" as="font" crossorigin="anonymous">')).toEqual(none);
  });
  it('a preload of pictures with imagesrcset and no href passes', () => {
    expect(checkRel('<link rel="preload" as="image" imagesrcset="/a-400.jpg 400w, /a-800.jpg 800w" imagesizes="100vw">')).toEqual(none);
  });
  it('the case of a word is not read', () => { expect(checkRel('<a href="/x/" rel="NoOpener NoReferrer">x</a><LINK REL="Stylesheet" HREF="/a.css">')).toEqual(none); });
  it('single quotes, no quotes and extra spaces are read', () => {
    expect(checkRel("<a href='/x/' rel='  noopener   noreferrer '>x</a><a href=/y/ rel=nofollow>y</a>")).toEqual(none);
  });
  it('words that are not near any real word are left alone (the list is open)', () => {
    expect(checkRel('<link rel="webmention" href="/w"><link rel="pingback" href="/p"><link rel="x-custom-hint" href="/c"><a href="/x/" rel="friend">x</a>')).toEqual(none);
  });
  it('short words are never taken for typos', () => { expect(checkRel('<a href="/x/" rel="me ugc tag">x</a>')).toEqual(none); });
  it('a link with no rel at all is not read', () => { expect(checkRel('<link href="/a.css" itemprop="url"><a href="/x/">x</a>')).toEqual(none); });
  it('an area with a real rel passes', () => { expect(checkRel('<map name="m"><area href="/x/" alt="x" rel="noopener"></map>')).toEqual(none); });
});

describe('checkRel: typos are errors', () => {
  it('noopner is an error', () => {
    expect(checkRel('<a href="https://x.org/" target="_blank" rel="noopner">x</a>').errors).toEqual(['a <a> has rel word "noopner", which looks like a typo of "noopener"; the browser ignores an unknown word, so use "noopener"']);
  });
  it('the usual typos are errors', () => {
    for (const [bad, good] of [['noreferer', 'noreferrer'], ['nofolow', 'nofollow'], ['nofollows', 'nofollow'], ['sponsered', 'sponsored'], ['stylesheeet', 'stylesheet'], ['styelsheet', 'stylesheet'], ['prelaod', 'preload'], ['preconect', 'preconnect'], ['licence', 'license'], ['bookmarks', 'bookmark'], ['alternat', 'alternate'], ['manifset', 'manifest']]) {
      const r = checkRel(`<a href="/x/" rel="${bad}">x</a>`);
      expect(r.errors, bad).toHaveLength(1);
      expect(r.errors[0], bad).toContain(`typo of "${good}"`);
    }
  });
  it('a typo next to a real word is still found', () => {
    expect(checkRel('<a href="/x/" rel="noreferrer noopner">x</a>').errors).toHaveLength(1);
  });
  it('a typo on a link tag and on an area is found', () => {
    expect(checkRel('<link rel="stylesheeet" href="/a.css">').errors).toHaveLength(1);
    expect(checkRel('<map name="m"><area href="/x/" alt="x" rel="noopner"></map>').errors).toHaveLength(1);
  });
  it('the case of a typo does not hide it', () => { expect(checkRel('<a href="/x/" rel="NoOpner">x</a>').errors).toHaveLength(1); });
  it('a very long unknown word is left alone', () => { expect(checkRel('<a href="/x/" rel="' + 'noopener'.repeat(20) + '">x</a>').errors).toEqual([]); });
  it('the same message is not printed twice', () => { expect(checkRel('<a href="/x/" rel="noopner">x</a><a href="/y/" rel="noopner">y</a>').errors).toHaveLength(1); });
});

describe('checkRel: links that cannot work', () => {
  it('an empty rel on a link tag is an error', () => {
    expect(checkRel('<link rel="" href="/a.css">').errors).toEqual(['a <link> has an empty rel, so the browser ignores it']);
    expect(checkRel('<link rel href="/a.css">').errors).toHaveLength(1);
  });
  it('an empty rel on a plain link is left alone', () => { expect(checkRel('<a href="/x/" rel="">x</a>')).toEqual(none); });
  it('a link that needs a file and has no href is an error', () => {
    for (const w of ['stylesheet', 'icon', 'manifest', 'preconnect', 'dns-prefetch', 'prefetch', 'modulepreload', 'alternate'])
      expect(checkRel(`<link rel="${w}">`).errors, w).toEqual([`a <link rel="${w}"> has no href, so the browser has nothing to load`]);
  });
  it('an empty href counts as no href', () => { expect(checkRel('<link rel="stylesheet" href="">').errors).toHaveLength(1); });
  it('a preload with no href and no imagesrcset is an error', () => { expect(checkRel('<link rel="preload" as="image">').errors).toHaveLength(1); });
  it('a canonical link with no href is left to head-check', () => { expect(checkRel('<link rel="canonical">')).toEqual(none); });
  it('a preload with no "as" is an error', () => {
    expect(checkRel('<link rel="preload" href="/a.woff2">').errors).toEqual(['a <link rel="preload" href="/a.woff2"> has no "as", so the browser throws the hint away; add as="font", "image", "script" or "style"']);
    expect(checkRel('<link rel="preload" href="/a.css" as="">').errors).toHaveLength(1);
  });
  it('a preload with an "as" that is not real is an error', () => {
    expect(checkRel('<link rel="preload" href="/a.css" as="css">').errors).toEqual(['a <link rel="preload"> has as="css", which is not a real value; use audio, document, embed, fetch, font and so on']);
    expect(checkRel('<link rel="modulepreload" href="/m.js" as="module">').errors).toHaveLength(1);
  });
  it('a modulepreload with no "as" is fine (script is the default)', () => { expect(checkRel('<link rel="modulepreload" href="/m.js">')).toEqual(none); });
});

describe('checkRel: warnings', () => {
  it('a font preload with no crossorigin is a warning', () => {
    const r = checkRel('<link rel="preload" href="/f.woff2" as="font" type="font/woff2">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a font preload of /f.woff2 has no crossorigin, so the browser fetches the font twice; add crossorigin']);
  });
  it('a preload of a picture with no crossorigin is fine', () => { expect(checkRel('<link rel="preload" href="/a.jpg" as="image">')).toEqual(none); });
  it('rel="opener" on a link is a warning', () => {
    const r = checkRel('<a href="https://x.org/" target="_blank" rel="opener">x</a>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a link to https://x.org/ has rel="opener", which lets the page it opens control this one; remove it or use noopener']);
  });
  it('a link-only word on an a or area tag is a warning', () => {
    expect(checkRel('<a href="/x/" rel="stylesheet">x</a>').warnings).toEqual(['an <a> has rel="stylesheet", which only works on a <link> tag, so it does nothing here']);
    expect(checkRel('<map name="m"><area href="/x/" alt="x" rel="preload"></map>').warnings).toHaveLength(1);
  });
  it('a link-only word on a link tag is fine', () => { expect(checkRel('<link rel="icon" href="/f.ico">').warnings).toEqual([]); });
});

describe('checkRel: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<a rel="noopner" href="/">x</a>\';</script><template><link rel="stylesheeet" href="/a.css"></template><!-- <a rel="noopner" href="/x/">x</a> --><style>a[rel="noopner"]{}</style>';
    expect(checkRel(extra + '<p>ok</p>')).toEqual(none);
  });
  it('names that only contain rel or as are not read', () => {
    expect(checkRel('<a href="/x/" data-rel="noopner" aria-label="x">x</a><link href="/a.css" data-as="css" itemprop="url">')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkRel('<main>' + '<a class="a b" href="https://x.org/" target="_blank" rel="noopener noreferrer">link text</a>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout head links pass', () => {
    const r = checkRel(readFileSync('src/layouts/Base.astro', 'utf8'));
    expect(r.errors).toEqual([]);
  });
  it('the footer and the header pass', () => {
    expect(checkRel(readFileSync('src/components/Footer.astro', 'utf8')).errors).toEqual([]);
    expect(checkRel(readFileSync('src/components/Header.astro', 'utf8')).errors).toEqual([]);
  });
  it('the links of the base layout use real words', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toMatch(/rel="canonical"/);
    expect(base).toMatch(/rel="manifest"/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'relchk-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>See <a href="https://other.org/" target="_blank" rel="noopener noreferrer">the report (opens in a new tab)</a>.</p>')).code).toBe(0); });
  it('a mistyped noopener stops the build and names the page', () => {
    const r = run(FULL('<p><a href="/x/" rel="noopner">a long link name</a></p>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <a> has rel word "noopner"/);
  });
  it('a preload with no "as" stops the build', () => {
    const r = run(FULL('<p>x</p>').replace('</head>', '<link rel="preload" href="/f.woff2"></head>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has no "as"/);
  });
  it('a font preload with no crossorigin is a warning, not an error', () => {
    const r = run(FULL('<p>x</p>').replace('</head>', '<link rel="preload" href="/f.woff2" as="font" type="font/woff2"></head>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*crossorigin/);
  });
});
