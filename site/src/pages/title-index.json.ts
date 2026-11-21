import type { APIRoute } from 'astro';
import { getPosts, getStaticPages } from '../lib/posts';

// v0.51.0: every live post and page as title + address (+ its earlier addresses). Read by scripts/title-match.mjs. Real data only.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const pages = await getStaticPages();
  const body = [...posts, ...pages].map((p) => ({ title: p.data.title, url: p.url, before: (p.data as { redirects?: string[] }).redirects ?? [] }));
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
