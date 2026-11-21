// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildExport, exportName, addressOf, esc } from '../../public/admin/js/export-xml.js';
import { parseXml, planImport } from '../../public/admin/js/import-xml.js';

const post = (o: any = {}, body = 'First paragraph with enough words to read.\n\n## Part two\nMore text & more.') => ({
  path: 'site/content/blogs/technology/' + (o.permalink || 'new-phone') + '.md',
  body,
  data: { title: 'New phone launched', permalink: 'new-phone', category: 'technology', tags: ['phones', 'launch'], date: '2026-11-13T09:30:00Z', author: 'shivam-das', description: 'Short summary', image: '/media/a.webp', imageAlt: 'A phone', status: 'published', ...o },
});
const page = (o: any = {}) => ({ path: 'site/content/pages/about.md', body: 'About us text.', data: { title: 'About us', permalink: 'about', date: '2026-11-01T00:00:00Z', status: 'published', ...o } });
const opts = { siteName: 'Shivam Das News', base: 'https://news.test/', tz: 'Asia/Kolkata', authors: { 'shivam-das': 'Shivam Das' }, now: '2026-11-14T00:00:00.000Z' };

describe('export-xml', () => {
  it('escapes XML and removes control characters', () => {
    expect(esc('a & <b> "c"\u0001')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });

  it('builds the post and page addresses in the site time zone', () => {
    expect(addressOf('post', post().data, 'Asia/Kolkata')).toBe('/2026/11/13/blogs/technology/new-phone/');
    expect(addressOf('post', post({ date: '2026-11-13T20:00:00Z' }).data, 'Asia/Kolkata')).toBe('/2026/11/14/blogs/technology/new-phone/');
    expect(addressOf('page', page().data, 'UTC')).toBe('/2026/11/01/pages/about/');
    expect(addressOf('post', post({ category: '' }).data, 'UTC')).toBe('');
  });

  it('writes a valid feed with posts, pages, labels, author and absolute image links', () => {
    const { xml, counts } = buildExport([post()], [page()], opts);
    expect(counts).toEqual({ posts: 1, pages: 1, drafts: 0, noAddress: 0 });
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(xml).toContain('term="http://schemas.google.com/blogger/2008/kind#post"');
    expect(xml).toContain('term="http://schemas.google.com/blogger/2008/kind#page"');
    expect(xml).toContain('<author><name>Shivam Das</name></author>');
    expect(xml).toContain('href="https://news.test/2026/11/13/blogs/technology/new-phone/"');
    expect(xml).toContain('https://news.test/media/a.webp');
    expect(xml).toContain('&lt;h2&gt;Part two&lt;/h2&gt;');
    expect(xml).not.toContain('app:draft');
  });

  it('writes drafts and archived posts as drafts and counts items without an address', () => {
    const { xml, counts } = buildExport([post({ status: 'draft' }), post({ permalink: 'old', status: 'archived' }), post({ permalink: 'nocat', category: '' })], [], opts);
    expect(xml.match(/<app:draft>yes<\/app:draft>/g)!.length).toBe(2);
    expect(counts).toMatchObject({ posts: 3, drafts: 2, noAddress: 1 });
  });

  it('keeps non-Latin text and special characters', () => {
    const { xml } = buildExport([post({ title: 'ভারত & "চীন" <news>' }, 'বাংলা লেখা')], [], opts);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(doc.getElementsByTagName('title')[1].textContent).toBe('ভারত & "চীন" <news>');
    expect(xml).toContain('বাংলা লেখা');
  });

  it('round trip: the Import screen reads the backup back (category, tags, drafts, redirect, image)', () => {
    const { xml } = buildExport([post(), post({ permalink: 'second', title: 'Second story here', status: 'draft' }, 'Another body of text that is long enough to count as a real story for the plan.')], [page()], opts);
    const parsed = parseXml(xml);
    expect(parsed.format).toBe('blogger');
    expect(parsed.items.map((i: any) => i.kind).sort()).toEqual(['page', 'post', 'post']);
    const first = parsed.items.find((i: any) => i.title === 'New phone launched');
    expect(first.categories).toEqual(['technology']);
    expect(first.tags).toEqual(['phones', 'launch']);
    expect(first.status).toBe('published');
    expect(parsed.items.find((i: any) => i.title === 'Second story here').status).toBe('draft');
    const plan = planImport(parsed.items, { tz: 'Asia/Kolkata', existing: [], existingPages: [] });
    expect(plan.counts.posts).toBe(2);
    expect(plan.counts.pages).toBe(1);
    const row = plan.rows.find((r: any) => r.title === 'New phone launched');
    expect(row.image).toContain('https://news.test/media/a.webp');
  });

  it('names the file with the site and the day', () => {
    expect(exportName('Shivam Das News', '2026-11-14T20:00:00Z', 'Asia/Kolkata')).toBe('shivam-das-news-backup-2026-11-15.xml');
    expect(exportName('', '2026-11-14T10:00:00Z', 'UTC')).toBe('site-backup-2026-11-14.xml');
  });
});
