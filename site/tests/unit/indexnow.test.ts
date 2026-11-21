import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs helper
import { parseFront, pathsForContentFile } from '../../scripts/indexnow-lib.mjs';

const now = new Date('2026-11-14T12:00:00Z');
const post = (extra = '') => `---\ntitle: "A real headline"\npermalink: "real-headline"\ncategory: "technology"\ndate: 2026-11-13T20:00:00Z\nstatus: "published"\n${extra}---\n\nBody\n`;

describe('IndexNow: which URLs to ping (v0.2.3)', () => {
  it('reads front matter values without quotes', () => {
    expect(parseFront(post())).toMatchObject({ permalink: 'real-headline', category: 'technology', status: 'published' });
    expect(parseFront('no front matter')).toBeNull();
  });
  it('a changed live post gives its page, category page and home, using the site time zone', () => {
    expect(pathsForContentFile('site/content/blogs/technology/a.md', post(), 'Asia/Kolkata', now)).toEqual([
      '/2026/11/14/blogs/technology/real-headline/', '/category/technology/', '/',
    ]);
    expect(pathsForContentFile('site/content/blogs/technology/a.md', post(), 'UTC', now)[0]).toBe('/2026/11/13/blogs/technology/real-headline/');
  });
  it('drafts and future (scheduled) posts are not pinged yet', () => {
    expect(pathsForContentFile('site/content/blogs/t/a.md', post().replace('"published"', '"draft"'), 'UTC', now)).toEqual([]);
    expect(pathsForContentFile('site/content/blogs/t/a.md', post().replace('2026-11-13', '2026-12-30'), 'UTC', now)).toEqual([]);
  });
  it('pages use the pages URL format', () => {
    const page = '---\ntitle: "About"\npermalink: "about"\ndate: 2026-11-01T00:00:00Z\nstatus: "published"\n---\nText';
    expect(pathsForContentFile('site/content/pages/about.md', page, 'UTC', now)).toEqual(['/2026/11/01/pages/about/', '/']);
  });
  it('ignores files that are not posts or pages', () => {
    expect(pathsForContentFile('site/content/authors/a.json', '{}', 'UTC', now)).toEqual([]);
  });
});
