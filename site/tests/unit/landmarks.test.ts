import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkLandmarks } from '../../scripts/landmarks-lib.mjs';

const wrap = (body: string) => `<!doctype html><html lang="en"><head><title>T</title></head><body><header>h</header>${body}<footer>f</footer></body></html>`;
const PAGE = wrap('<main id="main"><h1>T</h1><p>x</p></main>');
const STORY = wrap('<main id="main"><div class="layout"><article class="card"><nav aria-label="Breadcrumb">c</nav><h1>T</h1><p>x</p></article><aside aria-label="Related">r</aside></div></main>');
const none = { errors: [] as string[], warnings: [] as string[] };

describe('checkLandmarks: good pages', () => {
  it('a plain page passes with no message', () => { expect(checkLandmarks(PAGE, '404')).toEqual(none); });
  it('a plain page with no type passes', () => { expect(checkLandmarks(PAGE, undefined)).toEqual(none); });
  it('a story page with the h1 inside its article inside main passes', () => { expect(checkLandmarks(STORY, 'article')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkLandmarks(v as any, 'article').errors).toEqual(['the page is not text']);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkLandmarks(wrap("<MAIN id=main><ARTICLE><H1>T</H1></ARTICLE><ASIDE aria-label='x'>r</ASIDE></MAIN>"), 'article')).toEqual(none);
  });
});

describe('checkLandmarks: the h1 and main', () => {
  it('an h1 outside main is an error', () => {
    expect(checkLandmarks(wrap('<h1>T</h1><main id="main"><p>x</p></main>'), '404').errors.join()).toMatch(/h1 is outside the main/);
  });
  it('an h1 inside main in a nested div passes', () => { expect(checkLandmarks(wrap('<main id="main"><div><section><h1>T</h1></section></div></main>'), '404')).toEqual(none); });
  it('a page with no main is not reported here (page-basics does it)', () => { expect(checkLandmarks(wrap('<h1>T</h1>'), '404')).toEqual(none); });
  it('a page with no h1 is not reported here (the h1 count does it)', () => { expect(checkLandmarks(wrap('<main id="main"><p>x</p></main>'), '404')).toEqual(none); });
  for (const outer of ['header', 'footer', 'nav', 'aside', 'article']) {
    it(`a main inside a ${outer} is an error`, () => {
      expect(checkLandmarks(`<html lang="en"><head></head><body><${outer}><main id="main"><h1>T</h1></main></${outer}></body></html>`, '404').errors.join()).toMatch(/main landmark sits inside/);
    });
  }
  it('a main after a closed header is fine', () => { expect(checkLandmarks(PAGE, '404').errors).toEqual([]); });
});

describe('checkLandmarks: the article of a story page', () => {
  it('no article is an error', () => { expect(checkLandmarks(PAGE, 'article').errors.join()).toMatch(/no article element/); });
  it('two articles are an error', () => {
    expect(checkLandmarks(wrap('<main id="main"><article><h1>T</h1></article><article>b</article></main>'), 'article').errors.join()).toMatch(/found 2/);
  });
  it('an article outside main is an error', () => {
    expect(checkLandmarks(wrap('<article><h1>T</h1></article><main id="main"><p>x</p></main>'), 'article').errors.join()).toMatch(/article element of a story page is outside the main/);
  });
  it('an h1 outside the article is an error', () => {
    expect(checkLandmarks(wrap('<main id="main"><h1>T</h1><article><p>x</p></article></main>'), 'article').errors.join()).toMatch(/h1 of a story page is outside its article/);
  });
  it('other page types are never asked for an article', () => {
    for (const t of ['home', 'category', 'tag', 'author', 'page', '404', 'search']) expect(checkLandmarks(PAGE, t)).toEqual(none);
  });
  it('an article element on a page that is not a story is fine', () => {
    expect(checkLandmarks(wrap('<main id="main"><h1>T</h1><article>a</article><article>b</article></main>'), 'category')).toEqual(none);
  });
  it('post cards (links, not articles) on a story page do not count', () => {
    expect(checkLandmarks(wrap('<main id="main"><article><h1>T</h1></article><a class="card post" href="/x/"><h3>Y</h3></a></main>'), 'article')).toEqual(none);
  });
});

describe('checkLandmarks: asides', () => {
  it('an aside with no label warns once', () => {
    const r = checkLandmarks(wrap('<main id="main"><h1>T</h1><aside>a</aside><aside>b</aside></main>'), '404');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/aside has no aria-label/);
  });
  it('aria-labelledby is a label', () => { expect(checkLandmarks(wrap('<main id="main"><h1>T</h1><aside aria-labelledby="k">a</aside></main>'), '404')).toEqual(none); });
  it('a blank aria-label is no label', () => { expect(checkLandmarks(wrap('<main id="main"><h1>T</h1><aside aria-label="  ">a</aside></main>'), '404').warnings).toHaveLength(1); });
});

describe('checkLandmarks: what is left out', () => {
  it('tags inside script, style, template and comments are not read', () => {
    const extra = '<script>var s="<article><h1>x</h1></article><main>";</script><style>/* <main> */</style><template><main><h1>t</h1></main></template><!-- <article> --><!-- </main> -->';
    expect(checkLandmarks(wrap(extra + '<main id="main"><article><h1>T</h1></article></main>'), 'article')).toEqual(none);
  });
  it('a closing tag with no opening tag does not crash', () => { expect(checkLandmarks(wrap('</article></main><main id="main"><h1>T</h1></main>'), '404')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkLandmarks(wrap('<main id="main"><article><h1>T</h1>' + '<p>x</p>'.repeat(50000) + '</article></main>'), 'article');
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe('the real templates', () => {
  it('the story template has one article with the h1 inside, and Base has the main', async () => {
    const { readFileSync } = await import('node:fs');
    const story = readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8');
    expect((story.match(/<article[\s>]/g) || []).length).toBe(1);
    expect(story.indexOf('<article')).toBeLessThan(story.indexOf('<h1'));
    expect(story.indexOf('<h1')).toBeLessThan(story.indexOf('</article>'));
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toMatch(/<main id="main"><slot \/><\/main>/);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string, type: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="${type}"><a class="skip" href="#main">Skip</a><header>h</header>${body}<footer>f</footer></body></html>`;
  const run = (html: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'landmarks-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), html);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good plain page passes', () => { expect(run(FULL('<main id="main"><h1>P</h1></main>', '404')).code).toBe(0); });
  it('an h1 outside main stops the build and names the page', () => {
    const r = run(FULL('<h1>P</h1><main id="main"><p>x</p></main>', '404'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the h1 is outside the main landmark/);
  });
  it('a story page with no article stops the build', () => {
    const r = run(FULL('<main id="main"><h1>P</h1></main>', 'article'));
    expect(r.out).toMatch(/a story page has no article element/);
  });
});
