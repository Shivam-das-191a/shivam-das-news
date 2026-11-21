// Part 8b: the loading rules for the pictures of a built page (img-priority-lib.mjs) and the build gate that uses them.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkImgLoading } from '../../scripts/img-priority-lib.mjs';

const hero = '<figure class="hero"><img class="thumb" src="/media/hero.webp" alt="Hero" width="1200" height="675" fetchpriority="high"></figure>';
const lazy = '<img src="/media/b.webp" alt="B" width="1200" height="675" loading="lazy">';
const none = { errors: [], warnings: [] };

describe('checkImgLoading on an article page', () => {
  it('passes a top picture with fetchpriority high and lazy pictures in the text', () => { expect(checkImgLoading(hero + lazy + lazy, 'article')).toEqual(none); });
  it('passes an article with no picture at all', () => { expect(checkImgLoading('<p>text</p>', 'article')).toEqual(none); });
  it('errors when the top picture has no fetchpriority high', () => {
    const r = checkImgLoading('<figure class="hero"><img src="/h.webp" alt="x" width="1" height="1"></figure>', 'article');
    expect(r.errors.join()).toContain('no fetchpriority="high"');
  });
  it('reports a top picture without fetchpriority once, as an error, and not again as a warning', () => {
    const r = checkImgLoading('<figure class="hero"><img src="/h.webp" alt="x" width="1" height="1"></figure>', 'article');
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toEqual([]);
  });
  it('errors when the top picture is lazy-loaded', () => {
    const r = checkImgLoading('<figure class="hero"><img src="/h.webp" alt="x" width="1" height="1" loading="lazy"></figure>', 'article');
    expect(r.errors.join()).toContain('lazy-loaded');
  });
  it('errors when one picture has both fetchpriority high and loading lazy', () => {
    const r = checkImgLoading('<figure class="hero"><img src="/h.webp" alt="x" fetchpriority="high" loading="lazy"></figure>', 'article');
    expect(r.errors.join()).toContain('both');
  });
  it('warns for an article picture that is not lazy and is not the top picture', () => {
    const r = checkImgLoading(hero + '<img src="/c.webp" alt="C" width="1" height="1">', 'article');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toContain('/c.webp');
  });
  it('warns when two pictures have fetchpriority high', () => {
    const r = checkImgLoading(hero + '<img src="/d.webp" alt="D" fetchpriority="high">', 'article');
    expect(r.warnings.join()).toContain('2 pictures');
  });
  it('does not treat a page without a figure of class hero as having a top picture', () => {
    expect(checkImgLoading('<img src="/e.webp" alt="E" loading="lazy">', 'article')).toEqual(none);
  });
  it('finds the hero class among other classes and with single quotes', () => {
    expect(checkImgLoading("<figure class='wide hero big'><img src='/h.webp' alt='x' fetchpriority='high'></figure>", 'article')).toEqual(none);
  });
  it('is not case sensitive for the values', () => {
    expect(checkImgLoading('<figure class="hero"><img src="/h.webp" alt="x" fetchpriority="HIGH"></figure>' + '<img src="/b.webp" alt="B" loading="LAZY">', 'article')).toEqual(none);
  });
  it('skips pictures inside script and template', () => {
    expect(checkImgLoading(hero + '<script>var s=\'<img src="/x.png" loading="lazy" fetchpriority="high">\';</script><template><img src="/y.png"></template>', 'article')).toEqual(none);
  });
  it('shortens a long address and gives nothing for a value that is not text', () => {
    const long = '/media/' + 'a'.repeat(200) + '.webp';
    expect(checkImgLoading(hero + `<img src="${long}" alt="x">`, 'article').warnings[0].length).toBeLessThan(140);
    expect(checkImgLoading(undefined as any, 'article')).toEqual(none);
  });
});

describe('checkImgLoading on other pages', () => {
  it('does not ask a home or category page for lazy pictures', () => { expect(checkImgLoading('<img src="/a.webp" alt="A">', 'home')).toEqual(none); });
  it('does not ask for a top picture', () => { expect(checkImgLoading('<figure class="hero"><img src="/a.webp" alt="A"></figure>', 'page')).toEqual(none); });
  it('still errors for fetchpriority high together with lazy', () => {
    expect(checkImgLoading('<img src="/a.webp" alt="A" fetchpriority="high" loading="lazy">', 'home').errors).toHaveLength(1);
  });
  it('still warns for two pictures with fetchpriority high', () => {
    expect(checkImgLoading('<img src="/a.webp" alt="A" fetchpriority="high"><img src="/b.webp" alt="B" fetchpriority="high">', 'home').warnings).toHaveLength(1);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const article = (body: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><style>.thumb{aspect-ratio:16/9;width:100%;object-fit:cover}</style><script type="application/ld+json">{"@type":"NewsArticle","headline":"h","image":"i","datePublished":"2026-11-20T09:17:00Z","dateModified":"2026-11-20T10:00:00Z","author":"a","publisher":"p"}</script><script type="application/ld+json">{"@type":"BreadcrumbList"}</script></head><body data-page-type="article"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><article><h1>T</h1>${body}</article></main><footer>f</footer></body></html>`;
  const run = (body: string) => {
    const d = mkdtempSync(join(tmpdir(), 'ip-')); mkdirSync(join(d, 'dist'));
    writeFileSync(join(d, 'dist/index.html'), article(body));
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('passes an article with a good top picture and a lazy picture', () => { const r = run(hero + lazy); expect(r.stdout).toContain('Validation passed.'); expect(r.status).toBe(0); });
  it('fails an article whose top picture has no fetchpriority high', () => {
    const r = run('<figure class="hero"><img src="/h.webp" alt="x" width="1" height="1"></figure>');
    expect(r.stderr).toContain('no fetchpriority="high"'); expect(r.status).toBe(1);
  });
  it('only warns for an article picture that is not lazy', () => {
    const r = run(hero + '<img src="/c.webp" alt="C" width="1" height="1">');
    expect(r.status).toBe(0); expect(r.stderr).toContain('not lazy-loaded');
  });
});
