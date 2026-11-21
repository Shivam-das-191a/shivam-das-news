import { describe, it, expect } from 'vitest';
import { article, breadcrumb, jsonLdString, webSite, pageKind, organization } from '../../src/lib/schema';

const site = { siteName: 'Shivam Das News', logo: '', sameAs: [] as string[] };
const base = {
  type: 'NewsArticle' as const, title: 'A real headline', url: '/2026/11/13/blogs/tech/a/', description: 'd', image: '/media/a.webp',
  published: new Date('2026-11-13T09:00:00Z'), modified: new Date('2026-11-13T10:00:00Z'),
  authorName: 'Shivam Das', authorUrl: '/author/shivam-das/', section: 'Tech', keywords: ['a', 'b'], wordCount: 420,
};

describe('schema', () => {
  it('NewsArticle has the required fields', () => {
    const a: any = article(base, site);
    for (const f of ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage']) expect(a[f]).toBeTruthy();
    expect(a['@type']).toBe('NewsArticle');
    expect(a.keywords).toBe('a, b');
  });
  it('drops empty values instead of faking them (no logo set)', () => {
    const a: any = article(base, site);
    expect(a.publisher.logo).toBeUndefined();
    expect(organization(site) as any).not.toHaveProperty('sameAs');
  });
  it('breadcrumb positions start at 1', () => {
    const b: any = breadcrumb([{ name: 'Home', url: '/' }, { name: 'Tech', url: '/category/tech/' }]);
    expect(b.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
  it('WebSite has a SearchAction', () => {
    expect((webSite(site) as any).potentialAction['@type']).toBe('SearchAction');
  });
  it('json-ld cannot close the script tag', () => {
    expect(jsonLdString({ a: '</script><b>' })).not.toContain('</script>');
  });
  it('about and contact pages get their own type', () => {
    expect([pageKind('about'), pageKind('contact-us'), pageKind('privacy')]).toEqual(['AboutPage', 'ContactPage', 'WebPage']);
  });
});
