import { describe, it, expect } from 'vitest';
import { urlset, sitemapIndex, newsFilter, newsUrlset } from '../../src/lib/sitemap';
import { rss } from '../../src/lib/feed';

const now = new Date('2026-11-13T12:00:00Z');
const hrs = (n: number) => new Date(now.getTime() - n * 3_600_000);

describe('sitemaps', () => {
  it('urlset escapes and adds images', () => {
    const x = urlset([{ loc: 'https://x.test/a?b=1&c=2', lastmod: now, images: ['https://x.test/i.webp'] }]);
    expect(x).toContain('&amp;c=2');
    expect(x).toContain('<image:loc>https://x.test/i.webp</image:loc>');
  });
  it('index lists each sitemap', () => {
    expect(sitemapIndex([{ loc: 'https://x.test/sitemap-posts.xml' }])).toContain('<sitemap><loc>https://x.test/sitemap-posts.xml</loc>');
  });
  it('news keeps only the last 48 hours, newest first (bug S5)', () => {
    const r = newsFilter([{ published: hrs(60) }, { published: hrs(5) }, { published: hrs(30) }], now, 48);
    expect(r.map((x) => x.published.getTime())).toEqual([hrs(5).getTime(), hrs(30).getTime()]);
  });
  it('news ignores future-dated posts', () => {
    expect(newsFilter([{ published: new Date(now.getTime() + 1000) }], now, 48)).toEqual([]);
  });
  it('news xml has publication, language and title', () => {
    const x = newsUrlset([{ loc: 'https://x.test/a/', title: 'T & U', published: now }], 'Shivam Das News');
    expect(x).toContain('<news:language>en</news:language>');
    expect(x).toContain('T &amp; U');
  });
});

describe('rss', () => {
  it('has channel, atom self link and items', () => {
    const x = rss({ title: 'S', link: 'https://x.test/', self: 'https://x.test/feed.xml', description: '', now, items: [{ title: 'A', link: 'https://x.test/a/', description: 'd', published: now, category: 'Tech', author: 'Shivam Das' }] });
    expect(x).toContain('<atom:link href="https://x.test/feed.xml" rel="self"');
    expect(x).toContain('<item><title>A</title>');
  });
});
