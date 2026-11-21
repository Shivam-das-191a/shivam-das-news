import { describe, it, expect } from 'vitest';
import { autoLink, buildTargets, linkLimit, type LinkPost } from '../../src/lib/autolink';

const post = (id: string, title: string, o: Partial<LinkPost['data']> = {}, url = `/2026/11/13/blogs/tech/${id}/`): LinkPost => ({
  id, url, data: { title, category: 'tech', tags: [], focusKeyword: '', date: new Date('2026-11-10T00:00:00Z'), ...o },
});
const cur = post('cur', 'Current story');

describe('linkLimit', () => {
  it('is one per 250 words, at most 5', () => {
    expect(linkLimit(200)).toBe(0);
    expect(linkLimit(500)).toBe(2);
    expect(linkLimit(5000)).toBe(5);
  });
});

describe('buildTargets', () => {
  it('uses focus keyword and title of other posts, never the current post', () => {
    const t = buildTargets({ cur, posts: [cur, post('a', 'Solar power grows', { focusKeyword: 'solar power' })] });
    expect(t.map((x) => x.phrase.toLowerCase()).sort()).toEqual(['solar power', 'solar power grows']);
    expect(t.every((x) => x.url !== cur.url)).toBe(true);
  });
  it('ignores one-word post phrases, short phrases and phrases with odd characters', () => {
    const t = buildTargets({ cur, posts: [post('a', 'Budget', { focusKeyword: 'tax' }), post('b', 'AI & you today')] });
    expect(t).toEqual([]);
  });
  it('keeps one target per phrase and prefers a hand-made entry', () => {
    const t = buildTargets({ cur, posts: [post('a', 'Solar power grows', { focusKeyword: 'solar power' })], manual: [{ keyword: 'Solar Power', url: '/category/energy/' }] });
    const s = t.filter((x) => x.phrase.toLowerCase() === 'solar power');
    expect(s).toHaveLength(1);
    expect(s[0].url).toBe('/category/energy/');
  });
  it('drops hand-made entries that are not local paths', () => {
    expect(buildTargets({ cur, posts: [], manual: [{ keyword: 'bad link', url: 'https://other.site/' }, { keyword: 'worse link', url: '//other.site/' }] })).toEqual([]);
  });
  it('adds tag and category pages', () => {
    const t = buildTargets({ cur, posts: [], tags: [{ name: 'phones', url: '/tag/phones/' }], categories: [{ name: 'Technology', url: '/category/technology/' }] });
    expect(t.map((x) => x.url).sort()).toEqual(['/category/technology/', '/tag/phones/']);
  });
});

describe('autoLink', () => {
  const t = [{ phrase: 'solar power', url: '/a/', weight: 20 }, { phrase: 'phones', url: '/tag/phones/', weight: 10 }];
  it('links the first mention inside a paragraph', () => {
    const r = autoLink('<p>Solar power is growing. More solar power next year.</p>', t, { limit: 5 });
    expect(r.html).toBe('<p><a href="/a/">Solar power</a> is growing. More solar power next year.</p>');
    expect(r.used).toEqual(['/a/']);
  });
  it('never links inside headings, links, code, figcaption or outside paragraphs', () => {
    const html = '<h2>Solar power</h2><p><a href="/x/">solar power</a> <code>solar power</code></p><figcaption>solar power</figcaption><div>solar power</div>';
    expect(autoLink(html, t, { limit: 5 }).html).toBe(html);
  });
  it('links inside list items and keeps the text after a skipped place', () => {
    const r = autoLink('<p><a href="/x/">old</a> then solar power.</p><ul><li>phones</li></ul>', t, { limit: 5 });
    expect(r.html).toContain('then <a href="/a/">solar power</a>.');
    expect(r.html).toContain('<li><a href="/tag/phones/">phones</a></li>');
  });
  it('respects the limit and picks the heavier target first', () => {
    const r = autoLink('<p>phones and solar power</p>', t, { limit: 1 });
    expect(r.used).toEqual(['/a/']);
    expect(r.html).toBe('<p>phones and <a href="/a/">solar power</a></p>');
  });
  it('does nothing with limit 0, no targets or an empty page', () => {
    expect(autoLink('<p>solar power</p>', t, { limit: 0 }).html).toBe('<p>solar power</p>');
    expect(autoLink('<p>solar power</p>', [], { limit: 3 }).used).toEqual([]);
    expect(autoLink('', t, { limit: 3 }).html).toBe('');
  });
  it('skips targets the article already links to by hand', () => {
    const r = autoLink('<p>solar power</p>', t, { limit: 3, skipUrls: ['/a/'] });
    expect(r.used).toEqual([]);
  });
  it('matches whole words only and not inside HTML entities', () => {
    const r = autoLink('<p>smartphones &amp;amp; phonesx</p>', [{ phrase: 'phones', url: '/p/', weight: 1 }, { phrase: 'amp', url: '/q/', weight: 1 }], { limit: 5 });
    expect(r.used).toEqual([]);
  });
  it('uses each address only once and does not overlap links', () => {
    const r = autoLink('<p>solar power plants</p>', [{ phrase: 'solar power', url: '/a/', weight: 20 }, { phrase: 'solar power plants', url: '/a/', weight: 20 }, { phrase: 'power plants', url: '/b/', weight: 19 }], { limit: 5 });
    expect(r.used).toHaveLength(1);
    expect((r.html.match(/<a /g) ?? []).length).toBe(1);
  });
  it('matches across a line break and keeps the original letters', () => {
    const r = autoLink('<p>Big Solar\n  Power deal</p>', t, { limit: 2 });
    expect(r.html).toBe('<p>Big <a href="/a/">Solar\n  Power</a> deal</p>');
  });
});
