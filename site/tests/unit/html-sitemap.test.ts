import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';
import { buildHtmlSitemap, MAX_STORIES, type HtmlSitemapInput } from '../../src/lib/html-sitemap';

const read = (f: string) => readFileSync(f, 'utf8');
const base: HtmlSitemapInput = { pages: [], categories: [], authors: [], tags: [], stories: [], timeZone: 'Asia/Kolkata', thinTagMinPosts: 2 };
const story = (title: string, iso: string, robots = 'index,follow') => ({ title, url: `/s/${title.toLowerCase().replace(/\W+/g, '-')}/`, date: new Date(iso), robots });

describe('HTML sitemap data (v0.45.0)', () => {
  it('an empty site gives an empty result and no invented entries', () => {
    const m = buildHtmlSitemap(base);
    expect(m).toEqual({ pages: [], categories: [], authors: [], tags: [], months: [], shown: 0, omitted: 0, empty: true });
  });

  it('sorts pages, sections, authors and topics by name', () => {
    const m = buildHtmlSitemap({
      ...base,
      pages: [{ title: 'Terms', url: '/t/' }, { title: 'about us', url: '/a/' }],
      categories: [{ name: 'World', url: '/w/', count: 2 }, { name: 'Business', url: '/b/', count: 1 }],
      authors: [{ name: 'Zed', url: '/z/' }, { name: 'Amy', url: '/am/' }],
      tags: [{ name: 'Rail', url: '/r/', count: 3 }, { name: 'Air', url: '/ai/', count: 2 }],
    });
    expect(m.pages.map((p) => p.name)).toEqual(['about us', 'Terms']);
    expect(m.categories.map((p) => p.name)).toEqual(['Business', 'World']);
    expect(m.authors.map((p) => p.name)).toEqual(['Amy', 'Zed']);
    expect(m.tags.map((p) => p.name)).toEqual(['Air', 'Rail']);
    expect(m.empty).toBe(false);
  });

  it('leaves out a section with no posts and a thin topic (BUGS S7)', () => {
    const m = buildHtmlSitemap({
      ...base,
      categories: [{ name: 'Empty', url: '/e/', count: 0 }, { name: 'Real', url: '/r/', count: 1 }],
      tags: [{ name: 'One', url: '/o/', count: 1 }, { name: 'Two', url: '/t/', count: 2 }],
    });
    expect(m.categories.map((c) => c.name)).toEqual(['Real']);
    expect(m.tags.map((c) => c.name)).toEqual(['Two']);
  });

  it('lists stories newest first, grouped by month in the site time zone (BUGS U1)', () => {
    const m = buildHtmlSitemap({
      ...base,
      stories: [
        story('Old one', '2026-09-30T10:00:00Z'),
        // 19:00 UTC on 31 Oct is 00:30 on 1 Nov in India: it belongs to November.
        story('Boundary', '2026-10-31T19:00:00Z'),
        story('Newest', '2026-11-14T05:00:00Z'),
      ],
    });
    expect(m.months.map((g) => g.label)).toEqual(['November 2026', 'September 2026']);
    expect(m.months[0].stories.map((s) => s.name)).toEqual(['Newest', 'Boundary']);
    expect(m.months[1].stories.map((s) => s.name)).toEqual(['Old one']);
    expect(m.shown).toBe(3);
    expect(m.omitted).toBe(0);
  });

  it('does not list a story that is marked noindex (BUGS S6)', () => {
    const m = buildHtmlSitemap({ ...base, stories: [story('Visible', '2026-11-01T00:00:00Z'), story('Hidden', '2026-11-02T00:00:00Z', 'noindex,follow')] });
    expect(m.months.flatMap((g) => g.stories.map((s) => s.name))).toEqual(['Visible']);
    expect(m.shown).toBe(1);
  });

  it('caps the list and reports how many were left out', () => {
    const stories = Array.from({ length: 7 }, (_, i) => story(`Story ${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T06:00:00Z`));
    const m = buildHtmlSitemap({ ...base, stories, maxStories: 5 });
    expect(m.shown).toBe(5);
    expect(m.omitted).toBe(2);
    expect(m.months[0].stories[0].name).toBe('Story 6');
    expect(MAX_STORIES).toBe(500);
  });

  it('a site with only stories is not empty', () => {
    expect(buildHtmlSitemap({ ...base, stories: [story('A story', '2026-11-01T00:00:00Z')] }).empty).toBe(false);
  });
});

describe('the sitemap page template', () => {
  const page = read('src/pages/sitemap.astro');
  it('is noindex, a plain page, and has exactly one H1', () => {
    expect(page).toMatch(/robots="noindex,follow"/);
    expect(page).toMatch(/pageType="page"/);
    expect((page.match(/<h1[\s>]/g) || []).length).toBe(1);
  });
  it('holds no ad, analytics or script code (PLAN 29.1)', () => {
    expect(page).not.toMatch(/<script|data-ad|ad-slot|adsterra|googlesyndication|beacon|AdLoader|Beacon|Trending/i);
  });
  it('uses the shared builder and has no emoji', () => {
    expect(page).toMatch(/buildHtmlSitemap/);
    expect(findEmoji(page)).toEqual([]);
  });
  it('is not added to the XML sitemaps (it is noindex)', () => {
    expect(read('src/lib/site-data.ts')).not.toMatch(/\/sitemap\//);
  });
  it('the footer links to it on every page', () => {
    expect(read('src/components/Footer.astro')).toMatch(/href="\/sitemap\/"/);
  });
});
