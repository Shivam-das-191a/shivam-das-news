import { getCollection } from 'astro:content';
import site from '../../config/site.json';
import { postUrl, pageUrl, categoryUrl, dateParts } from './url';
import { slugify } from './slug';
import { activeCategories } from './active';
import { catName } from './categories';
import { lintHeadings } from './headings';
import { gateWarnings } from './gate';
import { wordCount } from './readtime';
import { isLive } from './live';
import { missingLocalImage, imageWidth, MIN_IMAGE_WIDTH } from './media';
import path from 'node:path';

let postsCache: Awaited<ReturnType<typeof load>> | undefined;

async function load() {
  const all = await getCollection('blogs');
  const seen = new Map<string, string>();
  const now = new Date();
  const built = await Promise.all(
    all
    .filter((p) => p.data.status === 'published')
    .map(async (p) => {
      // Bug U2: permalink must be unique site-wide.
      const prev = seen.get(p.data.permalink);
      if (prev) throw new Error(`Duplicate permalink "${p.data.permalink}" in ${prev} and ${p.id}`);
      seen.set(p.data.permalink, p.id);
      // v0.2.2: a missing local image stops the build (checked for scheduled posts too, so the error shows early).
      const img = missingLocalImage(p.data.image, path.join(process.cwd(), 'public'));
      if (img) throw new Error(`Image problem in ${p.id}: ${img}`);
      // v0.2.3: Google Discover wants a featured image at least 1200 px wide (BUGS S9). A warning, not a stop.
      const w = await imageWidth(p.data.image, path.join(process.cwd(), 'public'));
      if (w !== null && w < MIN_IMAGE_WIDTH) console.warn(`[gate] ${p.id}: image is only ${w} px wide (Discover needs ${MIN_IMAGE_WIDTH}+)`);
      // Bug S1: only the title is H1; body headings start at H2 and never skip a level.
      const bad = lintHeadings(p.body ?? '');
      if (bad.length) throw new Error(`Heading problem in ${p.id}: ${bad.join('; ')}`);
      const warn = gateWarnings({ title: p.data.title, words: wordCount(p.body ?? ''), hasInternalLink: /\]\((\/|https?:\/\/[^)]*\/)[^)]*\)/.test(p.body ?? '') });
      if (warn.length) console.warn(`[gate] ${p.id}: ${warn.join('; ')}`);
      return {
        ...p,
        url: postUrl(p.data.category, p.data.permalink, p.data.date, site.timeZone),
        parts: dateParts(p.data.date, site.timeZone),
      };
    }));
  return built
    // v0.2.2: published + future date = scheduled. It goes live at the first (hourly) build after its date.
    .filter((p) => {
      if (isLive(p.data.date, now)) return true;
      console.log(`[schedule] ${p.id} goes live after ${p.data.date.toISOString()}`);
      return false;
    })
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPosts() {
  return (postsCache ??= await load());
}

export async function getStaticPages() {
  const all = await getCollection('pages');
  const now = new Date();
  return all
    .filter((p) => p.data.status === 'published' && isLive(p.data.date, now))
    .map((p) => ({
      ...p,
      url: pageUrl(p.data.permalink, p.data.date, site.timeZone),
      parts: dateParts(p.data.date, site.timeZone),
    }));
}

export async function getMenuCategories() {
  const posts = await getPosts();
  const slugs = activeCategories(
    posts.map((p) => ({ category: p.data.category, date: p.data.date })),
    new Date(),
    site.activeCategoryDays,
  );
  return slugs.map((s) => ({ slug: s, name: catName(s), url: categoryUrl(s) }));
}

export function groupBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

export async function getTags() {
  const posts = await getPosts();
  const names = new Map<string, string>();
  const map = new Map<string, typeof posts>();
  for (const p of posts)
    for (const t of p.data.tags) {
      const s = slugify(t);
      if (!s) continue;
      names.set(s, names.get(s) ?? t);
      map.set(s, [...(map.get(s) ?? []), p]);
    }
  return [...map].map(([slug, items]) => ({ slug, name: names.get(slug)!, posts: items }));
}

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: site.timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(d);
