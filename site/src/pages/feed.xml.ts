import type { APIRoute } from 'astro';
import { rss } from '../lib/feed';
import { getPosts } from '../lib/posts';
import { absUrl } from '../lib/seo';
import { catName } from '../lib/categories';
import { authorNameMap } from '../lib/authors';
import site from '../../config/site.json';

export const GET: APIRoute = async () => {
  const names = await authorNameMap();
  const posts = (await getPosts()).slice(0, site.feedItems);
  const xml = rss({
    title: site.siteName,
    link: absUrl('/'),
    self: absUrl('/feed.xml'),
    description: site.description,
    now: new Date(),
    items: posts.map((p) => ({ title: p.data.title, link: absUrl(p.url), description: p.data.description, published: p.data.date, category: catName(p.data.category), author: names.get(p.data.author) ?? p.data.author })),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
