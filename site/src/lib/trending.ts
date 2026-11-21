/** v0.41.0 (Phase 6 part 9): settings and data for the "Trending now" block (PLAN 7, 28.2; LOGICS 6). Pure functions, unit tested.
 *  The address of the numbers comes from the same file as the beacon (config/analytics.json): the Worker's /collect address
 *  gives its /trending address. With the default file (empty endpoint) the block is not added to any page. */
import { beaconPlan, type AnalyticsConfig } from './beacon';

export const TRENDING_LIMIT = 5;
/** The title list holds at most this many newest articles (it is only fetched when the Worker has trending numbers). */
export const TITLES_MAX = 2000;

export interface TrendingPlan { url: string; titles: string }

/** null when analytics is off. A bad endpoint stops the build with the same message as the beacon (one place for the check). */
export function trendingPlan(cfg: AnalyticsConfig | null | undefined): TrendingPlan | null {
  const b = beaconPlan(cfg);
  if (!b) return null;
  const u = new URL(b.endpoint);
  u.pathname = '/trending';
  u.search = `?limit=${TRENDING_LIMIT}`;
  u.hash = '';
  return { url: u.href, titles: '/trending-titles.json' };
}

/** Address to title for the newest articles. The Worker knows addresses only, so the page looks the title up here. Posts must be newest first. */
export function trendingTitles(posts: { url: string; data: { title: string } }[], max: number = TITLES_MAX): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of posts.slice(0, Math.max(0, max))) out[p.url] = p.data.title;
  return out;
}
