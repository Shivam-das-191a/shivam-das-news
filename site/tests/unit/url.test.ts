import { describe, it, expect } from 'vitest';
import { postUrl, pageUrl, ampUrl } from '../../src/lib/url';

describe('url builder', () => {
  const d = new Date('2026-11-13T18:30:00Z');
  it('uses the configured site time zone for the date (bug U1)', () => {
    expect(postUrl('technology', 'x', d, 'UTC')).toBe('/2026/11/13/blogs/technology/x/');
    expect(postUrl('technology', 'x', d, 'Asia/Kolkata')).toBe('/2026/11/14/blogs/technology/x/');
  });
  it('builds page and amp urls', () => {
    expect(pageUrl('about', d, 'UTC')).toBe('/2026/11/13/pages/about/');
    expect(ampUrl('/a/b/')).toBe('/a/b/amp/');
  });
});
