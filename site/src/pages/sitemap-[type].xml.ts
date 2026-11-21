import type { APIRoute } from 'astro';
import { urlset } from '../lib/sitemap';
import { sitemapEntries, SITEMAP_TYPES } from '../lib/site-data';

export async function getStaticPaths() {
  const all = await sitemapEntries();
  // Empty sitemaps are not published.
  return SITEMAP_TYPES.filter((t) => all[t].length > 0).map((type) => ({ params: { type }, props: { entries: all[type] } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(urlset(props.entries as never), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });

