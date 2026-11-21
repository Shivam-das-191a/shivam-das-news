import type { APIRoute } from 'astro';
import { rss } from '../../lib/feed';
import { getPosts, groupBy } from '../../lib/posts';
import { absUrl } from '../../lib/seo';
import { catName } from '../../lib/categories';
import { categoryUrl } from '../../lib/url';
import { authorNameMap } from '../../lib/authors';
import site from '../../../config/site.json';

export async function getStaticPaths() {
  const groups = groupBy(await getPosts(), (p) => p.data.category);
  return [...groups].map(([category, posts]) => ({ params: { category }, props: { category, posts: posts.slice(0, site.feedItems) } }));
}

export const GET: APIRoute = async ({ props }) => {
  const names = await authorNameMap();
  const { category, posts } = props as { category: string; posts: Awaited<ReturnType<typeof getPosts>> };
  const xml = rss({
    title: `${catName(category)} | ${site.siteName}`,
    link: absUrl(categoryUrl(category)),
    self: absUrl(`/feed/${category}.xml`),
    description: site.description,
    now: new Date(),
    items: posts.map((p) => ({ title: p.data.title, link: absUrl(p.url), description: p.data.description, published: p.data.date, category: catName(category), author: names.get(p.data.author) ?? p.data.author })),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
