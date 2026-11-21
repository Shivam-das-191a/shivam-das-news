import { describe, it, expect } from 'vitest';
import { planRename, MAX_RENAME_POSTS } from '../../public/admin/js/category-rename.js';
import { parse } from '../../public/admin/js/frontmatter.js';

const mk = (permalink: string, o: any = {}) => ({ path: `site/content/blogs/tech/${permalink}.md`, body: '## Body\ntext', data: { title: 'T ' + permalink, permalink, category: 'tech', tags: [], date: '2026-11-13T09:30:00Z', author: 'shivam-das', status: 'published', redirects: [], ...o } });
const base = { root: 'site', tz: 'Asia/Kolkata', cats: { tech: { name: 'Technology' } }, manualRedirects: [], existingRedirects: 0, takenPaths: [] };
const text = (r: any, path: string) => r.files.find((f: any) => f.path === path)?.text as string;

describe('planRename', () => {
  it('moves every post, keeps the old address and redirects the old category page', () => {
    const r = planRename([mk('a'), mk('b'), mk('c', { category: 'world', path: 'x' })], 'tech', 'technology', base);
    expect(r.counts).toEqual({ posts: 2, redirects: 3, live: 2 });
    const a = parse(text(r, 'site/content/blogs/technology/a.md'));
    expect(a.data.category).toBe('technology');
    expect(a.data.redirects).toEqual(['/2026/11/13/blogs/tech/a/']);
    expect(r.files.filter((f: any) => f.delete).map((f: any) => f.path)).toEqual(['site/content/blogs/tech/a.md', 'site/content/blogs/tech/b.md']);
    expect(JSON.parse(text(r, 'site/config/redirects.json'))).toEqual([{ from: '/category/tech/', to: '/category/technology/' }]);
    expect(JSON.parse(text(r, 'site/config/categories.json'))).toEqual({ technology: { name: 'Technology' } });
  });

  it('keeps earlier old addresses (no chain is written, the build collapses it) and never lists the new address', () => {
    const r = planRename([mk('a', { redirects: ['/2026/11/10/blogs/news/a/'] })], 'tech', 'technology', base);
    expect(parse(text(r, 'site/content/blogs/technology/a.md')).data.redirects).toEqual(['/2026/11/10/blogs/news/a/', '/2026/11/13/blogs/tech/a/']);
  });

  it('gives drafts no redirect, archived posts their old address (for the 410), and uses the site time zone for the date', () => {
    const r = planRename([mk('d', { status: 'draft' }), mk('z', { status: 'archived' }), mk('n', { date: '2026-11-13T20:00:00Z' })], 'tech', 'technology', base);
    expect(parse(text(r, 'site/content/blogs/technology/d.md')).data.redirects).toEqual([]);
    expect(parse(text(r, 'site/content/blogs/technology/z.md')).data.redirects).toEqual(['/2026/11/13/blogs/tech/z/']);
    expect(parse(text(r, 'site/content/blogs/technology/n.md')).data.redirects).toEqual(['/2026/11/14/blogs/tech/n/']);
    expect(r.counts).toEqual({ posts: 3, redirects: 3, live: 1 });
  });

  it('adds no category-page redirect when nothing is live, and keeps one that already exists', () => {
    expect(text(planRename([mk('d', { status: 'draft' })], 'tech', 'technology', base), 'site/config/redirects.json')).toBeUndefined();
    const r = planRename([mk('a')], 'tech', 'technology', { ...base, manualRedirects: [{ from: '/category/tech/', to: '/category/other/' }, { from: '/category/technology/', to: '/x/' }] });
    expect(JSON.parse(text(r, 'site/config/redirects.json'))).toEqual([{ from: '/category/tech/', to: '/category/other/' }]);
  });

  it('refuses bad names, the same name, an existing category, an unknown category and a taken path', () => {
    const p = [mk('a'), mk('w', { category: 'world' })];
    expect(() => planRename(p, 'tech', 'Bad Name', base)).toThrow('lowercase');
    expect(() => planRename(p, 'tech', 'tech', base)).toThrow('same');
    expect(() => planRename(p, 'tech', 'world', base)).toThrow('already exists');
    expect(() => planRename(p, 'tech', 'listed', { ...base, cats: { listed: {} } })).toThrow('already exists');
    expect(() => planRename(p, 'nothing', 'fresh', base)).toThrow('No post uses');
    expect(() => planRename(p, 'tech', 'technology', { ...base, takenPaths: ['site/content/blogs/technology/a.md'] })).toThrow('already exists');
  });

  it('refuses when the Cloudflare redirect limit would be passed, and when one commit cannot hold the posts', () => {
    expect(() => planRename([mk('a')], 'tech', 'technology', { ...base, existingRedirects: 1999 })).toThrow('allows 2000');
    const many = Array.from({ length: MAX_RENAME_POSTS + 1 }, (_, i) => mk('p' + i));
    expect(() => planRename(many, 'tech', 'technology', base)).toThrow('one safe save');
  });
});
