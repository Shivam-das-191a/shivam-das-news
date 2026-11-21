import type { APIRoute } from 'astro';
import { join } from 'node:path';
import { getCollection } from 'astro:content';
import manual from '../../config/redirects.json';
import titleRedirects from '../../config/title-redirects.json';
import site from '../../config/site.json';
import { getPosts, getStaticPages, groupBy } from '../lib/posts';
import { buildRedirects } from '../lib/redirects';
import { toRedirectEntries, checkEntries } from '../lib/title-match.js';
import { buildGone } from '../lib/gone';
import { listMediaFiles, mediaUrls } from '../lib/media-live';
import { categoryUrl, postUrl } from '../lib/url';

// Build helper only: scripts/build-redirects.mjs turns this file into dist/_redirects, dist/gone.json and dist/_routes.json, then deletes it.
// Redirects come from each post's `redirects` list (automatic) and from config/redirects.json (added in the dashboard, v0.5.0).
// Gone (410) addresses come from archived posts and the old addresses they used (v0.6.0).
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const pages = await getStaticPages();
  const live = new Set<string>(['/', ...posts.map((p) => p.url), ...pages.map((p) => p.url), ...[...groupBy(posts, (p) => p.data.category).keys()].map(categoryUrl),
    // v0.101.33: a picture that exists is a live address, so a file renamed in the dashboard can redirect from its old address to the new one (PLAN 33.3).
    ...mediaUrls(listMediaFiles(join(process.cwd(), 'public/media')))]);
  const auto = posts.flatMap((p) => p.data.redirects.map((from) => ({ from, to: p.url })));
  const hand = (Array.isArray(manual) ? manual : []).filter((e: any) => e && typeof e.from === 'string' && typeof e.to === 'string');
  // v0.51.0: old Blogger addresses kept for life (scripts/title-match.mjs). Same chain, loop and live-page rules as the others.
  const title = toRedirectEntries(Array.isArray(titleRedirects) ? titleRedirects : []);
  const { map, problems } = buildRedirects([...auto, ...hand, ...title], live);
  checkEntries(titleRedirects as any).forEach((m) => problems.push(`title-redirects: ${m}`));
  const archived = (await getCollection('blogs')).filter((p) => p.data.status === 'archived');
  const candidates = archived.flatMap((p) => [postUrl(p.data.category, p.data.permalink, p.data.date, site.timeZone), ...p.data.redirects]);
  const gone = buildGone(candidates, live, new Set(Object.keys(map)));
  [...problems, ...gone.problems].forEach((m) => console.warn(`[redirects] ${m}`));
  return new Response(JSON.stringify({ map, gone: gone.paths }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
