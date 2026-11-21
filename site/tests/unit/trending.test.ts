// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS rules of the Worker
import { trendingList } from '../../../workers/analytics/lib.js';
import { trendingPlan, trendingTitles, TRENDING_LIMIT, TITLES_MAX } from '../../src/lib/trending';

// The browser file is plain text that the build puts into pages. Here the very same text is run against a real (jsdom) page.
const trendingClient: any = new Function(readFileSync('src/lib/trending-client.js', 'utf8') + '\nreturn trendingClient;')();
const CFG = { url: 'https://an.test/trending?limit=5', titles: '/trending-titles.json' };
const A = '/2026/11/14/blogs/world/first-story/';
const B = '/2026/11/14/blogs/sports/second-story/';
const C = '/2026/11/13/blogs/tech/third-story/';

function page(type: string | null, withBlock = true, path = '/') {
  document.body.innerHTML = withBlock ? '<section data-trending hidden><h2>Trending now</h2><ol></ol></section>' : '<p>none</p>';
  if (type === null) document.body.removeAttribute('data-page-type'); else document.body.setAttribute('data-page-type', type);
  const calls: string[] = [];
  const answers: Record<string, any> = {};
  const w: any = {
    document, location: { pathname: path },
    fetch: (u: string, init: any) => {
      calls.push(u);
      expect(init).toEqual({ credentials: 'omit' });
      const a = answers[u];
      if (a === 'fail') return Promise.reject(new Error('network'));
      if (a === undefined) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(a) });
    },
  };
  return { w, calls, answers, box: () => document.querySelector('[data-trending]') as HTMLElement | null, lis: () => [...document.querySelectorAll('[data-trending] li a')] as HTMLAnchorElement[] };
}

describe('trending settings (config/analytics.json)', () => {
  it('is off with an empty or missing endpoint', () => {
    expect(trendingPlan({ endpoint: '' })).toBeNull();
    expect(trendingPlan({})).toBeNull();
    expect(trendingPlan(null)).toBeNull();
  });
  it('builds the /trending address from the /collect address', () => {
    expect(trendingPlan({ endpoint: 'https://news-analytics.me.workers.dev/collect' })).toEqual({ url: `https://news-analytics.me.workers.dev/trending?limit=${TRENDING_LIMIT}`, titles: '/trending-titles.json' });
  });
  it('stops the build on a bad endpoint (same rules as the beacon)', () => {
    expect(() => trendingPlan({ endpoint: 'http://an.test/collect' })).toThrow(/https/);
    expect(() => trendingPlan({ endpoint: 'https://an.test/other' })).toThrow(/collect/);
    expect(() => trendingPlan({ endpoint: 'not a url' })).toThrow();
  });
});

describe('title list', () => {
  const post = (url: string, title: string) => ({ url, data: { title } });
  it('maps address to title and keeps only the newest ones', () => {
    expect(trendingTitles([post(A, 'One'), post(B, 'Two'), post(C, 'Three')])).toEqual({ [A]: 'One', [B]: 'Two', [C]: 'Three' });
    expect(trendingTitles([post(A, 'One'), post(B, 'Two'), post(C, 'Three')], 2)).toEqual({ [A]: 'One', [B]: 'Two' });
    expect(trendingTitles([post(A, 'One')], 0)).toEqual({});
    expect(trendingTitles([])).toEqual({});
    expect(TITLES_MAX).toBe(2000);
  });
});

describe('the Trending block in the browser', () => {
  it('does nothing on other page types, without the block, or without fetch', () => {
    for (const t of ['category', 'tag', 'author', 'page', 'search', '404', null]) {
      const x = page(t);
      expect(trendingClient(x.w, CFG)).toBeNull();
      expect(x.calls).toEqual([]);
    }
    const y = page('home', false);
    expect(trendingClient(y.w, CFG)).toBeNull();
    const z = page('home');
    delete z.w.fetch;
    expect(trendingClient(z.w, CFG)).toBeNull();
    expect(trendingClient(page('home').w, null)).toBeNull();
    expect(trendingClient(page('home').w, { url: '', titles: '' })).toBeNull();
  });

  it('shows the list in the order of the Worker, with real titles and links', async () => {
    const x = page('home');
    x.answers[CFG.url] = { items: [{ url: B, score: 9 }, { url: A, score: 5 }] };
    x.answers[CFG.titles] = { [A]: 'First story', [B]: 'Second story' };
    expect(await trendingClient(x.w, CFG)).toBe(true);
    expect(x.box()!.hasAttribute('hidden')).toBe(false);
    expect(x.lis().map((a) => [a.getAttribute('href'), a.textContent])).toEqual([[B, 'Second story'], [A, 'First story']]);
    expect(x.calls).toEqual([CFG.url, CFG.titles]);
  });

  it('stays hidden and asks for no titles when the Worker has nothing', async () => {
    const x = page('home');
    x.answers[CFG.url] = { items: [] };
    expect(await trendingClient(x.w, CFG)).toBe(false);
    expect(x.box()!.hasAttribute('hidden')).toBe(true);
    expect(x.calls).toEqual([CFG.url]);
  });

  it('stays hidden when a call fails, the answer is odd, or no title is known', async () => {
    const f1 = page('home'); f1.answers[CFG.url] = 'fail';
    expect(await trendingClient(f1.w, CFG)).toBe(false);
    expect(f1.box()!.hasAttribute('hidden')).toBe(true);
    const f2 = page('home');
    expect(await trendingClient(f2.w, CFG)).toBe(false);
    const f3 = page('home'); f3.answers[CFG.url] = { items: 'x' };
    expect(await trendingClient(f3.w, CFG)).toBe(false);
    const f4 = page('home'); f4.answers[CFG.url] = { items: [{ url: A }] }; f4.answers[CFG.titles] = 'fail';
    expect(await trendingClient(f4.w, CFG)).toBe(false);
    expect(f4.box()!.hasAttribute('hidden')).toBe(true);
    const f5 = page('home'); f5.answers[CFG.url] = { items: [{ url: A }, { url: B }] }; f5.answers[CFG.titles] = { [C]: 'Other', [A]: '   ', [B]: 7 };
    expect(await trendingClient(f5.w, CFG)).toBe(false);
    expect(f5.lis()).toEqual([]);
    expect(f5.box()!.hasAttribute('hidden')).toBe(true);
  });

  it('skips an article without a title but shows the others', async () => {
    const x = page('home');
    x.answers[CFG.url] = { items: [{ url: A }, { url: B }, { url: C }] };
    x.answers[CFG.titles] = { [A]: 'First story', [C]: 'Third story' };
    expect(await trendingClient(x.w, CFG)).toBe(true);
    expect(x.lis().map((a) => a.textContent)).toEqual(['First story', 'Third story']);
  });

  it('leaves the article being read out of its own list', async () => {
    const x = page('article', true, A);
    x.answers[CFG.url] = { items: [{ url: A }, { url: B }] };
    x.answers[CFG.titles] = { [A]: 'First story', [B]: 'Second story' };
    expect(await trendingClient(x.w, CFG)).toBe(true);
    expect(x.lis().map((a) => a.getAttribute('href'))).toEqual([B]);
    const y = page('article', true, A);
    y.answers[CFG.url] = { items: [{ url: A }] };
    expect(await trendingClient(y.w, CFG)).toBe(false);
    expect(y.calls).toEqual([CFG.url]);
  });

  it('writes titles as plain text, never as HTML', async () => {
    const x = page('home');
    const evil = '<img src=x onerror=alert(1)> & <b>bold</b>';
    x.answers[CFG.url] = { items: [{ url: A }] };
    x.answers[CFG.titles] = { [A]: evil };
    await trendingClient(x.w, CFG);
    expect(x.lis()[0].textContent).toBe(evil);
    expect(document.querySelector('[data-trending] img, [data-trending] b')).toBeNull();
  });

  it('accepts only real article addresses and shows each one once', async () => {
    const x = page('home');
    const bad = ['javascript:alert(1)', 'https://evil.test/2026/11/14/blogs/a/b/', '/category/world/', '/2026/11/14/blogs/a/b', '//evil.test/x/', 42, null, { u: 1 }];
    x.answers[CFG.url] = { items: [...bad.map((u) => ({ url: u })), { url: A }, { url: A }, null, 'x'] };
    x.answers[CFG.titles] = { [A]: 'First story', 'javascript:alert(1)': 'No' };
    expect(await trendingClient(x.w, CFG)).toBe(true);
    expect(x.lis().map((a) => a.getAttribute('href'))).toEqual([A]);
  });

  it('shows at most 5 and ignores inherited property names as titles', async () => {
    const x = page('home');
    const urls = Array.from({ length: 8 }, (_, i) => `/2026/11/14/blogs/world/story-${i}/`);
    x.answers[CFG.url] = { items: urls.map((url) => ({ url })) };
    x.answers[CFG.titles] = Object.fromEntries(urls.map((u, i) => [u, `Story ${i}`]));
    await trendingClient(x.w, CFG);
    expect(x.lis().length).toBe(5);
    const y = page('home');
    y.answers[CFG.url] = { items: [{ url: '/2026/11/14/blogs/world/constructor/' }] };
    y.answers[CFG.titles] = {};
    expect(await trendingClient(y.w, CFG)).toBe(false);
  });

  it('works on the real Worker answer (trendingList output)', async () => {
    const now = Math.floor(Date.parse('2026-11-14T12:00:00Z') / 1000);
    const items = trendingList([{ url: A, v24: 10, v1: 2, r: 600 }, { url: B, v24: 2, v1: 2, r: 100 }, { url: '/about/', v24: 50, v1: 5, r: 9 }], now, 5);
    expect(items.map((i: any) => i.url)).toEqual([A]);
    const x = page('home');
    x.answers[CFG.url] = { items };
    x.answers[CFG.titles] = { [A]: 'First story' };
    expect(await trendingClient(x.w, CFG)).toBe(true);
    expect(x.lis().length).toBe(1);
  });
});

describe('where the block is used', () => {
  const read = (f: string) => readFileSync(f, 'utf8');
  it('only the home page and the article page use it; nothing is rendered with analytics off', () => {
    const using = ['src/pages/index.astro', 'src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro'];
    for (const f of using) expect(read(f)).toContain('<Trending />');
    for (const f of ['src/layouts/Base.astro', 'src/components/Header.astro', 'src/components/Footer.astro', 'src/pages/404.astro', 'src/pages/search.astro', 'src/pages/category/[category]/[...rest].astro', 'src/pages/tag/[tag]/[...rest].astro', 'src/pages/author/[author]/[...rest].astro', 'src/pages/[year]/[month]/[day]/pages/[slug].astro'])
      expect(read(f), f).not.toMatch(/Trending/);
    const c = read('src/components/Trending.astro');
    expect(c).toMatch(/\{plan && \(/);
    expect(c).toMatch(/data-trending\s+hidden/);
  });
  it('the block is hidden by default in CSS too, and the titles file is not indexed', () => {
    expect(read('src/styles/global.css')).toMatch(/\.trending\[hidden\]\{display:none\}/);
    expect(read('public/_headers')).toMatch(/\/trending-titles\.json\s+X-Robots-Tag: noindex/);
  });
  it('the shipped config keeps analytics off (no block until the owner sets the endpoint)', () => {
    expect(trendingPlan(JSON.parse(read('tests/fixtures/shipped/config/analytics.json')))).toBeNull();
  });
});
