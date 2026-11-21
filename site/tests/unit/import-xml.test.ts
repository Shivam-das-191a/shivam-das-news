// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { parseXml, planImport } from '../../public/admin/js/import-xml.js';

const TEXT = 'Hello big world, this is a real looking story text that is long enough for a meta description.';
const BODY = `<p>${TEXT}</p><img src="https://img.test/a.jpg" alt="A picture"/>`;
const esc = (h: string) => h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const entry = (o: { kind?: string; title: string; labels?: string[]; published?: string; draft?: boolean; href?: string; content?: string }) => `
<entry>
  <category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#${o.kind ?? 'post'}"/>
  ${(o.labels ?? []).map((l) => `<category scheme="http://www.blogger.com/atom/ns#" term="${l}"/>`).join('')}
  <published>${o.published ?? '2020-05-01T10:00:00.000-07:00'}</published>
  <title type="text">${o.title}</title>
  <content type="html">${o.content ?? esc(BODY)}</content>
  ${o.draft ? '<app:control xmlns:app="http://purl.org/atom/app#"><app:draft>yes</app:draft></app:control>' : ''}
  ${o.href ? `<link rel="alternate" type="text/html" href="${o.href}"/>` : ''}
  <author><name>Shivam Das</name></author>
</entry>`;
const blogger = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">${entries.join('')}</feed>`;

const wpItem = (o: { title: string; type?: string; status?: string; name?: string; link?: string; date?: string; cats?: [string, string, string][]; body?: string }) => `
<item>
  <title>${o.title}</title>
  <link>${o.link ?? ''}</link>
  <dc:creator>admin</dc:creator>
  <content:encoded><![CDATA[${o.body ?? BODY}]]></content:encoded>
  <wp:post_date_gmt>${o.date ?? '2021-03-04 08:30:00'}</wp:post_date_gmt>
  <wp:post_name>${o.name ?? ''}</wp:post_name>
  <wp:status>${o.status ?? 'publish'}</wp:status>
  <wp:post_type>${o.type ?? 'post'}</wp:post_type>
  ${(o.cats ?? []).map(([d, n, t]) => `<category domain="${d}" nicename="${n}"><![CDATA[${t}]]></category>`).join('')}
</item>`;
const wp = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel><title>Old</title>${items.join('')}</channel></rss>`;

describe('parseXml, Blogger', () => {
  it('reads posts and pages, skips comments and settings, maps labels (first = category, rest = tags)', () => {
    const r = parseXml(blogger(
      entry({ title: 'First post', labels: ['World', 'Asia', 'Trade'], href: 'https://old.blogspot.com/2020/05/first-post.html' }),
      entry({ kind: 'page', title: 'About' }),
      entry({ kind: 'comment', title: 'A comment' }),
      entry({ kind: 'settings', title: 'Settings' }),
    ));
    expect(r.format).toBe('blogger');
    expect(r.items.map((i: any) => i.kind)).toEqual(['post', 'page']);
    expect(r.skipped).toEqual({ comment: 1, settings: 1 });
    const p = r.items[0];
    expect(p).toMatchObject({ title: 'First post', categories: ['World'], tags: ['Asia', 'Trade'], status: 'published', name: 'first-post', author: 'Shivam Das' });
    expect(p.date).toBe('2020-05-01T17:00:00.000Z');
    expect(p.html).toBe(BODY);
  });
  it('marks drafts', () => {
    expect(parseXml(blogger(entry({ title: 'Draft one', draft: true }))).items[0].status).toBe('draft');
  });
  it('keeps non-Latin text (BUGS I1)', () => {
    expect(parseXml(blogger(entry({ title: 'শিরোনাম – café' }))).items[0].title).toBe('শিরোনাম – café');
  });
});

describe('parseXml, WordPress', () => {
  it('reads posts and pages, categories and tags, GMT dates, and skips attachments, private and trash', () => {
    const r = parseXml(wp(
      wpItem({ title: 'Wp post', name: 'wp-post', link: 'https://old.site/2021/03/wp-post/', cats: [['category', 'uncategorized', 'Uncategorized'], ['category', 'world', 'World'], ['category', 'trade', 'Trade'], ['post_tag', 'asia', 'Asia']] }),
      wpItem({ title: 'About us', type: 'page', name: 'about-us' }),
      wpItem({ title: 'pic', type: 'attachment' }),
      wpItem({ title: 'secret', status: 'private' }),
      wpItem({ title: 'bin', status: 'trash' }),
      wpItem({ title: 'Later', status: 'future' }),
      wpItem({ title: 'Idea', status: 'draft', date: '0000-00-00 00:00:00' }),
    ));
    expect(r.format).toBe('wordpress');
    expect(r.items.map((i: any) => i.title)).toEqual(['Wp post', 'About us', 'Later', 'Idea']);
    expect(r.skipped).toEqual({ attachment: 1, 'post (private)': 1, 'post (trash)': 1 });
    expect(r.items[0]).toMatchObject({ categories: ['World', 'Trade'], tags: ['Asia'], name: 'wp-post', date: '2021-03-04T08:30:00.000Z', status: 'published', html: BODY });
    expect(r.items[2].status).toBe('published');
    expect(r.items[3]).toMatchObject({ status: 'draft', date: '' });
  });
});

describe('parseXml, bad files', () => {
  it('explains a broken file and a wrong kind of XML', () => {
    expect(() => parseXml('<feed><entry></feed>')).toThrow('not valid XML');
    expect(() => parseXml('<html><body/></html>')).toThrow('not a Blogger backup or a WordPress export');
  });
  it('accepts a leading byte order mark', () => {
    expect(parseXml('\uFEFF' + blogger(entry({ title: 'Bom' }))).items).toHaveLength(1);
  });
});

describe('planImport', () => {
  const tz = 'Asia/Kolkata';
  const items = (xml: string) => parseXml(xml).items;
  it('builds the new address, the category and a redirect from the old address', () => {
    const r = planImport(items(blogger(entry({ title: 'First post', labels: ['World News', 'Asia'], href: 'https://old.blogspot.com/2020/05/first-post.html' }))), { tz });
    const row = r.rows[0];
    expect(row).toMatchObject({ category: 'world-news', tags: ['Asia'], permalink: 'first-post', status: 'published', skip: '', oldUrl: '/2020/05/first-post.html', newUrl: '/2020/05/01/blogs/world-news/first-post/' });
    expect(r.redirects).toEqual([{ from: '/2020/05/first-post.html', to: '/2020/05/01/blogs/world-news/first-post/' }]);
    expect(r.counts).toMatchObject({ posts: 1, pages: 0, drafts: 0, redirects: 1 });
  });
  it('uses the site time zone for the date in the address (BUGS U1)', () => {
    const r = planImport(items(wp(wpItem({ title: 'Late night', name: 'late', date: '2021-03-04 20:00:00', cats: [['category', 'w', 'World']] }))), { tz });
    expect(r.rows[0].newUrl).toBe('/2021/03/05/blogs/world/late/');
  });
  it('folds extra WordPress categories and tags into tags without repeats', () => {
    const r = planImport(items(wp(wpItem({ title: 'Title', name: 't', cats: [['category', 'a', 'World'], ['category', 'b', 'Trade'], ['post_tag', 'c', 'trade'], ['post_tag', 'd', 'Asia']] }))), { tz });
    expect(r.rows[0].category).toBe('world');
    expect(r.rows[0].tags).toEqual(['Trade', 'Asia']);
  });
  it('imports a post with no label as a draft and says why', () => {
    const r = planImport(items(blogger(entry({ title: 'No label' }))), { tz });
    expect(r.rows[0].status).toBe('draft');
    expect(r.rows[0].issues.join(' ')).toContain('No usable category');
    expect(r.redirects).toEqual([]);
    expect(r.counts.drafts).toBe(1);
  });
  it('makes permalinks unique site-wide, also against existing posts (BUGS U2)', () => {
    const xml = blogger(entry({ title: 'Same name', labels: ['A'], published: '2020-01-01T00:00:00Z' }), entry({ title: 'Same name', labels: ['B'], published: '2020-02-01T00:00:00Z' }));
    const r = planImport(items(xml), { tz, existing: [{ title: 'Other', date: '2019-01-01T00:00:00Z', permalink: 'same-name', redirects: [] }] });
    expect(r.rows.map((x: any) => x.permalink)).toEqual(['same-name-2', 'same-name-3']);
  });
  it('skips duplicates by old address and by title and day, also inside the file (BUGS I4)', () => {
    const e1 = entry({ title: 'Story one', labels: ['A'], href: 'https://old.blogspot.com/2020/05/one.html' });
    const e2 = entry({ title: 'Story two', labels: ['A'], published: '2020-06-01T00:00:00Z' });
    const r = planImport(items(blogger(e1, e1, e2)), {
      tz,
      existing: [{ title: 'Story two', date: '2020-06-01T09:00:00Z', permalink: 'two', redirects: [] }],
    });
    expect(r.rows.map((x: any) => x.skip)).toEqual(['', 'Already on the site', 'Already on the site']);
    expect(r.counts).toMatchObject({ posts: 1, duplicates: 2 });
    const again = planImport(items(blogger(e1)), { tz, existing: [{ title: 'Imported before', date: '2020-05-01T00:00:00Z', permalink: 'one', redirects: ['/2020/05/one.html'] }] });
    expect(again.rows[0].skip).toBe('Already on the site');
  });
  it('skips an item without a title', () => {
    const r = planImport(items(blogger(entry({ title: '' }))), { tz });
    expect(r.rows[0].skip).toBe('No title');
    expect(r.counts.noTitle).toBe(1);
  });
  it('gives a generic permalink to a title without Latin letters and says so', () => {
    const r = planImport(items(blogger(entry({ title: 'শিরোনাম', labels: ['খবর'] }))), { tz });
    expect(r.rows[0].permalink).toBe('imported-post');
    expect(r.rows[0].status).toBe('draft');
    expect(r.rows[0].issues.length).toBeGreaterThanOrEqual(2);
  });
  it('plans a page address in the pages format', () => {
    const r = planImport(items(blogger(entry({ kind: 'page', title: 'About us', href: 'https://old.blogspot.com/p/about.html' }))), { tz });
    expect(r.rows[0]).toMatchObject({ kind: 'page', category: '', permalink: 'about', newUrl: '/2020/05/01/pages/about/' });
    expect(r.counts.pages).toBe(1);
  });
  it('counts words from the HTML text only', () => {
    const r = planImport(items(blogger(entry({ title: 'Words', labels: ['A'], content: '&lt;p&gt;one &lt;b&gt;two&lt;/b&gt; three&lt;/p&gt;&lt;script&gt;x&lt;/script&gt;' }))), { tz });
    expect(r.rows[0].words).toBeGreaterThanOrEqual(3);
  });
  it('converts the text to Markdown and finds the images', () => {
    const r = planImport(items(blogger(entry({ title: 'First post', labels: ['World'] }))), { tz });
    expect(r.rows[0].markdown).toBe(`${TEXT}\n\n![A picture](https://img.test/a.jpg)\n`);
    expect(r.rows[0].images).toEqual([{ src: 'https://img.test/a.jpg', alt: 'A picture' }]);
    expect(r.counts.images).toBe(1);
  });
  it('takes the first image as the featured image and a short excerpt as the description', () => {
    const r = planImport(items(blogger(entry({ title: 'First post', labels: ['World'] }))), { tz });
    expect(r.rows[0]).toMatchObject({ image: 'https://img.test/a.jpg', imageAlt: 'A picture', status: 'published' });
    expect(r.rows[0].description).toBe(TEXT);
    expect(r.rows[0].description.length).toBeGreaterThanOrEqual(50);
    const long = planImport(items(blogger(entry({ title: 'Long text', labels: ['World'], content: esc(`<p>${'word '.repeat(100)}</p><img src="https://img.test/a.jpg" alt="x"/>`) }))), { tz });
    expect(long.rows[0].description.length).toBeLessThanOrEqual(160);
  });
  it('imports a post without an image or with a very short text as a draft and says why', () => {
    const noImg = planImport(items(blogger(entry({ title: 'No image', labels: ['World'], content: esc(`<p>${TEXT}</p>`) }))), { tz });
    expect(noImg.rows[0].status).toBe('draft');
    expect(noImg.rows[0].issues.join(' ')).toContain('No image in the text');
    expect(noImg.redirects).toEqual([]);
    const short = planImport(items(blogger(entry({ title: 'Short one', labels: ['World'], content: esc('<p>Tiny.</p><img src="https://img.test/a.jpg"/>') }))), { tz });
    expect(short.rows[0].status).toBe('draft');
    expect(short.rows[0].issues.join(' ')).toContain('too short for a meta description');
    expect(short.rows[0].issues.join(' ')).toContain('no alt text');
    expect(short.rows[0].imageAlt).toBe('Short one');
  });
  it('skips a title that is too short for the site', () => {
    const r = planImport(items(blogger(entry({ title: 'Hi', labels: ['World'] }))), { tz });
    expect(r.rows[0].skip).toBe('Title is too short for this site');
  });
  it('plans a page without needing an image', () => {
    const r = planImport(items(blogger(entry({ kind: 'page', title: 'About', content: esc('<p>Short about text.</p>') }))), { tz });
    expect(r.rows[0].status).toBe('published');
  });
});
