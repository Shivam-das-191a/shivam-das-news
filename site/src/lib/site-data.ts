/** Phase 2: shared data for sitemaps, feeds and schema. Uses only live, indexable URLs (BUGS S3, S6, S7). */
import site from '../../config/site.json';
import { getCollection } from 'astro:content';
import { getPosts, getStaticPages, getTags, groupBy } from './posts';
import { absUrl } from './seo';
import { categoryUrl, tagUrl, authorUrl } from './url';
import type { UrlEntry } from './sitemap';

export const SITEMAP_TYPES = ['posts', 'pages', 'categories', 'tags', 'authors', 'images'] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

const modified = (d: { date: Date; updated?: Date }) => d.updated ?? d.date;
const indexable = (r: string) => !/noindex/i.test(r);

export async function sitemapEntries(): Promise<Record<SitemapType, UrlEntry[]>> {
  const posts = await getPosts();
  const live = posts.filter((p) => indexable(p.data.robots) && (!p.data.canonical || p.data.canonical === absUrl(p.url)));
  const pages = await getStaticPages();
  const authors = await getCollection('authors');
  const tags = await getTags();
  const byCat = groupBy(posts, (p) => p.data.category);
  const newest = (items: typeof posts) => new Date(Math.max(...items.map((p) => modified(p.data).getTime())));

  return {
    posts: live.map((p) => ({ loc: absUrl(p.url), lastmod: modified(p.data) })),
    // v0.2.2: the home page is always listed, so the sitemap index is never empty.
    pages: [
      { loc: absUrl('/'), lastmod: posts.length ? newest(posts) : undefined },
      ...pages.map((p) => ({ loc: absUrl(p.url), lastmod: modified(p.data) })),
    ],
    // Hidden (inactive) categories stay in the sitemap on purpose (BUGS H4).
    categories: [...byCat].map(([slug, items]) => ({ loc: absUrl(categoryUrl(slug)), lastmod: newest(items) })),
    tags: tags.filter((t) => t.posts.length >= site.thinTagMinPosts).map((t) => ({ loc: absUrl(tagUrl(t.slug)), lastmod: newest(t.posts) })),
    authors: authors
      .filter((a) => posts.some((p) => p.data.author === a.id))
      .map((a) => ({ loc: absUrl(authorUrl(a.id)), lastmod: newest(posts.filter((p) => p.data.author === a.id)) })),
    images: live.filter((p) => p.data.image).map((p) => ({ loc: absUrl(p.url), lastmod: modified(p.data), images: [absUrl(p.data.image!)] })),
  };
}

