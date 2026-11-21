import type { APIRoute } from 'astro';
import cfg from '../../config/analytics.json';
import { getPosts } from '../lib/posts';
import { trendingPlan, trendingTitles } from '../lib/trending';

// v0.41.0: address to title for the "Trending now" block. Empty ({}) while analytics is off. Real posts only (no demo data).
export const GET: APIRoute = async () => {
  const body = trendingPlan(cfg) ? trendingTitles(await getPosts()) : {};
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
