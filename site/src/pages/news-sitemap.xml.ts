import type { APIRoute } from 'astro';
import { newsFilter, newsUrlset } from '../lib/sitemap';
import { getPosts } from '../lib/posts';
import { absUrl } from '../lib/seo';
import site from '../../config/site.json';

// Posts older than newsMaxAgeHours leave this file at the next build (LOGICS 8). Rebuild hourly (rebuild.yml).
export const GET: APIRoute = async () => {
  const posts = (await getPosts()).filter((p) => p.data.schemaType === 'NewsArticle' && !/noindex/i.test(p.data.robots));
  const fresh = newsFilter(
    posts.map((p) => ({ loc: absUrl(p.url), title: p.data.title, published: p.data.date })),
    new Date(),
    site.newsMaxAgeHours,
  );
  return new Response(newsUrlset(fresh, site.siteName), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
