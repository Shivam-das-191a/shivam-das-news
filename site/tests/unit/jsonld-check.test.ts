import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkJsonLd } from '../../scripts/jsonld-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const block = (body: string, type = 'application/ld+json') => `<script type="${type}">${body}</script>`;
const ld = (o: unknown, type?: string) => block(JSON.stringify(o), type);
const article = {
  '@context': 'https://schema.org', '@type': 'NewsArticle', headline: 'A title', datePublished: '2026-11-20T09:17:00Z', dateModified: '2026-11-20T10:00:00Z',
  author: { '@type': 'Person', name: 'Shivam Das' }, publisher: { '@type': 'Organization', name: 'Shivam Das News' },
};

describe('checkJsonLd: good pages', () => {
  it('a plain page passes', () => { expect(checkJsonLd('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkJsonLd(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkJsonLd('')).toEqual(none); });
  it('a real article block passes', () => { expect(checkJsonLd(ld(article))).toEqual(none); });
  it('a list of objects passes', () => {
    expect(checkJsonLd(ld([{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'x' }, { '@context': 'https://schema.org', '@type': 'Organization', name: 'y' }]))).toEqual(none);
  });
  it('a @graph with the context on the top node passes', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'x' }, { '@type': 'BreadcrumbList', itemListElement: [] }] }))).toEqual(none);
  });
  it('several blocks on one page pass', () => {
    expect(checkJsonLd(ld(article) + ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] }) + ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'x' }))).toEqual(none);
  });
  it('http://schema.org and a trailing slash pass', () => {
    for (const c of ['http://schema.org', 'https://schema.org/', 'http://schema.org/', 'HTTPS://SCHEMA.ORG']) expect(checkJsonLd(ld({ '@context': c, '@type': 'Thing' }))).toEqual(none);
  });
  it('a context that is a list or an object is left alone', () => {
    expect(checkJsonLd(ld({ '@context': ['https://schema.org', { x: 'https://x.example/' }], '@type': 'Thing' }))).toEqual(none);
    expect(checkJsonLd(ld({ '@context': { '@vocab': 'https://schema.org/' }, '@type': 'Thing' }))).toEqual(none);
  });
  it('the case of the type and a charset after it are not read', () => {
    expect(checkJsonLd(ld(article, 'Application/LD+JSON'))).toEqual(none);
    expect(checkJsonLd(ld(article, 'application/ld+json; charset=utf-8'))).toEqual(none);
  });
  it('single quotes and no quotes around the type pass', () => {
    expect(checkJsonLd(`<script type='application/ld+json'>${JSON.stringify(article)}</script>`)).toEqual(none);
    expect(checkJsonLd(`<script type=application/ld+json>${JSON.stringify(article)}</script>`)).toEqual(none);
  });
  it('other attributes on the script tag pass', () => {
    expect(checkJsonLd(`<script id="schema" nonce="abc" type="application/ld+json">${JSON.stringify(article)}</script>`)).toEqual(none);
  });
  it('every listed news type passes', () => {
    for (const t of ['NewsArticle', 'Article', 'BlogPosting', 'WebPage', 'WebSite', 'Organization', 'NewsMediaOrganization', 'Person', 'BreadcrumbList', 'ImageObject', 'CollectionPage', 'ProfilePage', 'ContactPage', 'AboutPage', 'SearchAction']) {
      expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': t }))).toEqual(none);
    }
  });
  it('a type that is a list passes', () => { expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': ['NewsArticle', 'Article'] }))).toEqual(none); });
  it('a type with a prefix passes', () => { expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 'schema:Article' }))).toEqual(none); });
  it('a real schema.org type that is not on the list passes', () => {
    for (const t of ['MusicRecording', 'Recipe', 'JobPosting', 'Vehicle', 'SoftwareApplication']) expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': t }))).toEqual(none);
  });
  it('real dates pass: date only, with Z, with milliseconds, with an offset', () => {
    for (const t of ['2026-11-20', '2026-11-20T09:17Z', '2026-11-20T09:17:00Z', '2026-11-20T09:17:00.000Z', '2026-11-20T09:17:00+05:30', '2026-11-20T09:17:00-0500']) {
      expect(checkJsonLd(ld({ ...article, datePublished: t, dateModified: undefined }))).toEqual(none);
    }
  });
  it('a date that is not a text is left alone', () => { expect(checkJsonLd(ld({ ...article, datePublished: 20261120 }))).toEqual(none); });
  it('the ampersand and the angle signs written the way the site writes them pass', () => {
    const html = block(JSON.stringify({ ...article, headline: 'Tom & Jerry <live>' }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
    expect(checkJsonLd(html)).toEqual(none);
  });
  it('a block with a long text passes', () => { expect(checkJsonLd(ld({ ...article, articleBody: 'word '.repeat(5000) }))).toEqual(none); });
});

describe('checkJsonLd: errors', () => {
  it('a comma too many is an error', () => {
    const r = checkJsonLd(block('{"@context":"https://schema.org","@type":"Thing",}'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/the structured data block \(application\/ld\+json\) is not valid JSON \(/);
    expect(r.errors[0]).toMatch(/search engines ignore all of it/);
  });
  it('single quotes in the JSON are an error', () => { expect(checkJsonLd(block("{'@type':'Thing'}")).errors[0]).toMatch(/not valid JSON/); });
  it('a missing bracket is an error', () => { expect(checkJsonLd(block('{"@type":"Thing"')).errors[0]).toMatch(/not valid JSON/); });
  it('text that is not JSON at all is an error', () => { expect(checkJsonLd(block('hello')).errors[0]).toMatch(/not valid JSON/); });
  it('a comment before the JSON is an error with a hint', () => {
    const r = checkJsonLd(block('// schema\n{"@type":"Thing"}'));
    expect(r.errors[0]).toMatch(/not valid JSON/);
    expect(r.errors[0]).toMatch(/a comment or a CDATA wrapper is not JSON, remove it/);
  });
  it('a CDATA wrapper is an error with a hint', () => { expect(checkJsonLd(block('<![CDATA[{"@type":"Thing"}]]>')).errors[0]).toMatch(/CDATA/); });
  it('with several blocks the message says which one', () => {
    const r = checkJsonLd(ld(article) + block('{oops}'));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^structured data block 2 \(application\/ld\+json\) is not valid JSON/);
  });
  it('two broken blocks give two errors', () => { expect(checkJsonLd(block('{a}') + block('{b}')).errors).toHaveLength(2); });
  it('a plain value is an error', () => {
    for (const v of ['5', '"text"', 'true', 'null']) expect(checkJsonLd(block(v)).errors[0]).toMatch(/holds a plain value; it must be an object or a list of objects/);
  });
  it('a type written application/ld-json is an error', () => {
    const r = checkJsonLd(ld(article, 'application/ld-json'));
    expect(r.errors).toEqual(['<script type="application/ld-json"> is a typo of "application/ld+json", so search engines never read this structured data']);
  });
  it('the usual wrong types are errors', () => {
    for (const t of ['application/jsonld', 'application/json+ld', 'text/ld+json', 'application/ld+jason', 'application/ld+jsn', 'application/ldjson', 'application/ld_json', 'aplication/ld+json']) {
      expect(checkJsonLd(ld(article, t)).errors, t).toHaveLength(1);
    }
  });
  it('a NewsArticle written NewsArtcle is an error', () => {
    const r = checkJsonLd(ld({ ...article, '@type': 'NewsArtcle' }));
    expect(r.errors).toEqual(['the structured data block has an @type "NewsArtcle" that is a typo of "NewsArticle", so search engines do not read this node']);
  });
  it('two letters swapped is a typo', () => { expect(checkJsonLd(ld({ ...article, '@type': 'NewsArticel' })).errors[0]).toMatch(/typo of "NewsArticle"/); });
  it('Organisation is a typo of Organization', () => { expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 'Organisation' })).errors[0]).toMatch(/typo of "Organization"/); });
  it('a type with the wrong capital letters is an error', () => {
    expect(checkJsonLd(ld({ ...article, '@type': 'newsarticle' })).errors).toEqual(['the structured data block has an @type "newsarticle" with the wrong capital letters; write "NewsArticle"']);
    expect(checkJsonLd(ld({ ...article, '@type': 'Newsarticle' })).errors[0]).toMatch(/write "NewsArticle"/);
  });
  it('a typo inside a list of types is an error', () => { expect(checkJsonLd(ld({ ...article, '@type': ['Article', 'NewsArtcle'] })).errors[0]).toMatch(/typo of "NewsArticle"/); });
  it('a typo on a node of @graph is an error', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, { '@type': 'BreadcrumbLst' }] })).errors[0]).toMatch(/typo of "BreadcrumbList"/);
  });
  it('a typo in a node of a list is an error', () => {
    expect(checkJsonLd(ld([{ '@context': 'https://schema.org', '@type': 'WebSte' }])).errors[0]).toMatch(/typo of "WebSite"/);
  });
  it('a date that does not exist is an error', () => {
    const r = checkJsonLd(ld({ ...article, datePublished: '2026-02-30' }));
    expect(r.errors).toEqual(['the structured data block has a datePublished "2026-02-30" that is not a real ISO date or time; write it like 2026-11-20T09:17:00Z']);
  });
  it('a date written in words or with slashes is an error', () => {
    for (const v of ['20 November 2026', '2026/11/20', '11/20/2026', 'yesterday', '2026-11', '2026-13-01', '2026-11-20T25:00:00Z']) {
      expect(checkJsonLd(ld({ ...article, dateModified: v, datePublished: undefined })).errors, v).toHaveLength(1);
    }
  });
  it('a bad dateModified, dateCreated and uploadDate are errors', () => {
    for (const k of ['dateModified', 'dateCreated', 'uploadDate']) expect(checkJsonLd(ld({ ...article, dateModified: undefined, [k]: 'soon' })).errors[0], k).toMatch(new RegExp(`has a ${k} "soon"`));
  });
  it('a bad date on a node deeper down is an error', () => {
    expect(checkJsonLd(ld({ ...article, video: { '@type': 'VideoObject', uploadDate: 'soon' } })).errors[0]).toMatch(/uploadDate "soon"/);
  });
  it('a bad date in a @graph node is an error', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'NewsArticle', datePublished: 'x' }] })).errors[0]).toMatch(/datePublished "x"/);
  });
  it('the same fault twice on a page is said once', () => {
    expect(checkJsonLd(ld({ ...article, datePublished: 'x', video: { '@type': 'VideoObject', datePublished: 'x' } })).errors).toHaveLength(1);
  });
  it('a long bad text is cut short in the message', () => {
    const r = checkJsonLd(ld({ ...article, datePublished: 'x'.repeat(200) }));
    expect(r.errors[0].length).toBeLessThan(200);
  });
});

describe('checkJsonLd: warnings', () => {
  it('an empty block is a warning', () => {
    expect(checkJsonLd(block(''))).toEqual({ errors: [], warnings: ['the structured data block (application/ld+json) is empty, so it says nothing'] });
    expect(checkJsonLd(block('  \n  ')).warnings).toHaveLength(1);
  });
  it('a node with no @context is a warning', () => {
    const { '@context': _c, ...rest } = article;
    expect(checkJsonLd(ld(rest))).toEqual({ errors: [], warnings: ['the structured data block has a node with no @context; write "@context": "https://schema.org"'] });
  });
  it('each node of a list needs its own context', () => {
    expect(checkJsonLd(ld([{ '@context': 'https://schema.org', '@type': 'WebSite' }, { '@type': 'Organization' }])).warnings).toHaveLength(1);
  });
  it('a context that is not schema.org is a warning', () => {
    for (const c of ['schema.org', 'https://schema.com', 'https://example.org/context', '']) {
      expect(checkJsonLd(ld({ ...article, '@context': c })).warnings, c).toHaveLength(1);
    }
  });
  it('a node with no @type is a warning', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', name: 'x' }))).toEqual({ errors: [], warnings: ['the structured data block has a node with no @type, so search engines do not know what it is'] });
  });
  it('a @graph node with no @type is a warning', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@graph': [{ name: 'x' }] })).warnings[0]).toMatch(/no @type/);
  });
  it('a list entry that is not an object is a warning', () => {
    const r = checkJsonLd(ld([article, 'text', 5]));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the structured data block holds a list entry that is not an object, so search engines skip it']);
  });
  it('a @graph entry that is not an object is a warning', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, 'text'] })).warnings[0]).toMatch(/@graph entry that is not an object/);
  });
  it('an HTML entity in a text is a warning', () => {
    for (const e of ['&amp;', '&quot;', '&nbsp;', '&#8217;', '&#x2019;', '&lt;', '&gt;', '&apos;']) {
      const r = checkJsonLd(ld({ ...article, headline: `Tom ${e} Jerry` }));
      expect(r.errors, e).toEqual([]);
      expect(r.warnings, e).toEqual([`the structured data block holds the HTML entity "${e}" in a text; search engines show it as typed, so write the real character`]);
    }
  });
  it('an entity deeper down and in a list is found', () => {
    expect(checkJsonLd(ld({ ...article, author: { '@type': 'Person', name: 'A &amp; B' } })).warnings).toHaveLength(1);
    expect(checkJsonLd(ld({ ...article, keywords: ['a', 'b &amp; c'] })).warnings).toHaveLength(1);
  });
  it('an ampersand with no entity after it is fine', () => {
    expect(checkJsonLd(ld({ ...article, headline: 'Tom & Jerry; AT&T; R&D; a&b;' }))).toEqual(none);
  });
  it('a date with a space instead of T is a warning', () => {
    const r = checkJsonLd(ld({ ...article, datePublished: '2026-11-20 09:17:00', dateModified: undefined }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the structured data block has a datePublished "2026-11-20 09:17:00" with a space between the date and the time; write a T there']);
  });
  it('a dateModified before the datePublished is a warning', () => {
    const r = checkJsonLd(ld({ ...article, datePublished: '2026-11-20T10:00:00Z', dateModified: '2026-11-19T10:00:00Z' }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the structured data block has a dateModified (2026-11-19T10:00:00Z) before its datePublished (2026-11-20T10:00:00Z)']);
  });
  it('the same time on both dates is fine', () => {
    expect(checkJsonLd(ld({ ...article, datePublished: '2026-11-20T10:00:00Z', dateModified: '2026-11-20T10:00:00Z' }))).toEqual(none);
  });
  it('a bad date does not also give a before-warning', () => {
    const r = checkJsonLd(ld({ ...article, datePublished: 'x', dateModified: '2026-11-19T10:00:00Z' }));
    expect(r.warnings).toEqual([]);
  });
});

describe('checkJsonLd: what is left out', () => {
  it('a block inside a comment is not read', () => { expect(checkJsonLd(`<!-- ${block('{oops}')} -->`)).toEqual(none); });
  it('a block inside a template is not read', () => { expect(checkJsonLd(`<template>${block('{oops}')}</template>`)).toEqual(none); });
  it('a block whose tag holds a template expression or set:html is not read', () => {
    expect(checkJsonLd('<script type="application/ld+json" set:html={jsonLdString(o)}></script>')).toEqual(none);
    expect(checkJsonLd('<script is:inline type="application/ld+json" set:html={x}></script>')).toEqual(none);
  });
  it('other data blocks are not read', () => {
    expect(checkJsonLd(block('{oops}', 'application/json'))).toEqual(none);
    expect(checkJsonLd(block('{oops}', 'importmap'))).toEqual(none);
    expect(checkJsonLd(block('{oops}', 'speculationrules'))).toEqual(none);
  });
  it('ordinary scripts are not read', () => {
    expect(checkJsonLd('<script>var a = {oops</script><script type="module">import x from "y"</script><script src="/a.js" type="text/javascript"></script>')).toEqual(none);
    expect(checkJsonLd('<script type="text/javascript">1</script><script type="module">1</script><script type="text/plain">x</script>')).toEqual(none);
  });
  it('a script with no type is not read', () => { expect(checkJsonLd('<script>{"@type":"NewsArtcle"}</script>')).toEqual(none); });
  it('a type that is not close to a listed type is left alone', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 'TotallyNewThing' }))).toEqual(none);
  });
  it('a very short or very long type is left alone', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 'Zed' }))).toEqual(none);
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 'N'.repeat(300) }))).toEqual(none);
  });
  it('a type that is not a text is left alone', () => {
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': 5 }))).toEqual(none);
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', '@type': null }))).toEqual(none);
  });
  it('the type of a node deeper than the top is not read', () => {
    expect(checkJsonLd(ld({ ...article, author: { '@type': 'Persn', name: 'x' } }))).toEqual(none);
  });
  it('a block with a deep object does not crash', () => {
    let o: any = { '@type': 'Thing' };
    for (let i = 0; i < 100; i++) o = { '@type': 'Thing', child: o };
    expect(checkJsonLd(ld({ '@context': 'https://schema.org', ...o })).errors).toEqual([]);
  });
  it('a script that is never closed does not crash', () => { expect(checkJsonLd('<script type="application/ld+json">{"a":1}')).toEqual(none); });
  it('a page that is very big is read in a short time', () => {
    const t = Date.now();
    checkJsonLd('<p>x</p>'.repeat(50000) + ld(article));
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkJsonLd(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the search page passes', () => { expect(checkJsonLd(readFileSync('src/pages/search.astro', 'utf8'))).toEqual(none); });
  it('the 404 page passes', () => { expect(checkJsonLd(readFileSync('src/pages/404.astro', 'utf8'))).toEqual(none); });
  it('the site writes its JSON-LD with the safe string of schema.ts and the check reads that string', () => {
    const src = readFileSync('src/lib/schema.ts', 'utf8');
    expect(src).toMatch(/jsonLdString/);
    expect(src).toMatch(/u003c/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (extra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex,follow">${extra}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1><p>x</p></main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'jsonld-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL(ld(article))).code).toBe(0); });
  it('a page with no structured data passes', () => { expect(run(FULL('')).code).toBe(0); });
  it('a wrong block type stops the build and names the page', () => {
    const r = run(FULL(ld(article, 'application/ld-json')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: <script type="application\/ld-json"> is a typo of "application\/ld\+json"/);
  });
  it('a typo of a type stops the build', () => {
    const r = run(FULL(ld({ ...article, '@type': 'NewsArtcle' })));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/NewsArtcle/);
  });
  it('a date that does not exist stops the build', () => {
    const r = run(FULL(ld({ ...article, datePublished: '2026-02-30' })));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/datePublished "2026-02-30"/);
  });
  it('a broken block stops the build with the reason', () => {
    const r = run(FULL(block('{"@type":"Thing",}')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the structured data block \(application\/ld\+json\) is not valid JSON/);
  });
  it('an entity in a text is a warning, not an error', () => {
    const r = run(FULL(ld({ ...article, headline: 'Tom &amp; Jerry' })));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*HTML entity "&amp;"/);
  });
});
