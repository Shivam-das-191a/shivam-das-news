import type { APIRoute } from 'astro';
import { sitemapIndex } from '../lib/sitemap';
import { sitemapEntries, SITEMAP_TYPES } from '../lib/site-data';
import { absUrl } from '../lib/seo';
import { getPosts } from '../lib/posts';
import site from '../../config/site.json';
import { newsFilter } from '../lib/sitemap';

export const GET: APIRoute = async () => {
  const all = await sitemapEntries();
  const items: { loc: string; lastmod?: Date }[] = SITEMAP_TYPES.filter((t) => all[t].length > 0).map((t) => {
    const times = all[t].map((e) => e.lastmod?.getTime()).filter((n): n is number => typeof n === 'number');
    return { loc: absUrl(`/sitemap-${t}.xml`), lastmod: times.length ? new Date(Math.max(...times)) : undefined };
  });
  const posts = await getPosts();
  const news = newsFilter(posts.filter((p) => p.data.schemaType === 'NewsArticle').map((p) => ({ published: p.data.date })), new Date(), site.newsMaxAgeHours);
  if (news.length) items.push({ loc: absUrl('/news-sitemap.xml'), lastmod: news[0].published });
  return new Response(sitemapIndex(items), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
