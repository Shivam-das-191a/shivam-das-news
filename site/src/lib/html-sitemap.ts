/** v0.45.0: the HTML sitemap page (/sitemap/), PLAN 16 ("Sitemap (HTML)"). Pure functions, unit tested.
 *  It is a page for readers and for crawl depth: pages, the categories that are active today (PLAN 29.2),
 *  authors, tags with enough posts (BUGS S7) and the newest stories grouped by month.
 *  Only real data goes in. Nothing is invented; an empty site gives an empty result (PLAN 25).
 *  The month of a story comes from the site time zone, like the date in its address (BUGS U1). */
import { dateParts } from './url';

/** At most this many stories are listed. Older ones stay reachable through the category and tag pages. */
export const MAX_STORIES = 500;

export interface Link { name: string; url: string }
export interface CountLink extends Link { count: number }
export interface StoryInput { title: string; url: string; date: Date; robots: string }
export interface Month { key: string; label: string; stories: Link[] }

export interface HtmlSitemapInput {
  pages: { title: string; url: string }[];
  /** Categories that are active now (the same list the menu shows). */
  categories: { name: string; url: string; count: number }[];
  authors: { name: string; url: string }[];
  tags: { name: string; url: string; count: number }[];
  stories: StoryInput[];
  timeZone: string;
  thinTagMinPosts: number;
  maxStories?: number;
}

export interface HtmlSitemap {
  pages: Link[];
  categories: CountLink[];
  authors: Link[];
  tags: CountLink[];
  months: Month[];
  /** Stories listed on the page. */
  shown: number;
  /** Indexable stories that did not fit (listed through categories and tags instead). */
  omitted: number;
  empty: boolean;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const indexable = (robots: string) => !/noindex/i.test(robots);

export function buildHtmlSitemap(input: HtmlSitemapInput): HtmlSitemap {
  const max = input.maxStories ?? MAX_STORIES;
  const pages: Link[] = input.pages.map((p) => ({ name: p.title, url: p.url })).sort(byName);
  const categories = [...input.categories].filter((c) => c.count > 0).sort(byName);
  const authors = [...input.authors].sort(byName);
  // BUGS S7: a tag with fewer posts than the limit is a thin page; it is not listed.
  const tags = [...input.tags].filter((t) => t.count >= input.thinTagMinPosts).sort(byName);

  // A story that is marked noindex is left out, like in the XML sitemap (BUGS S6).
  const all = input.stories.filter((s) => indexable(s.robots)).sort((a, b) => b.date.getTime() - a.date.getTime());
  const listed = all.slice(0, Math.max(0, max));
  const label = new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone, month: 'long', year: 'numeric' });

  const months: Month[] = [];
  for (const s of listed) {
    const { y, m } = dateParts(s.date, input.timeZone);
    const key = `${y}-${m}`;
    let g = months[months.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: label.format(s.date), stories: [] };
      months.push(g);
    }
    g.stories.push({ name: s.title, url: s.url });
  }

  return {
    pages,
    categories,
    authors,
    tags,
    months,
    shown: listed.length,
    omitted: all.length - listed.length,
    empty: !pages.length && !categories.length && !authors.length && !tags.length && !listed.length,
  };
}
