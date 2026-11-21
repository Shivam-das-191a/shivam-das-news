/** v0.6.0: addresses that answer "410 Gone" (archived posts and their old addresses). Pure functions, unit tested. */
import { normalizePath } from './redirects';

/** _routes.json allows 100 rules in total and each rule up to 100 characters. */
export const MAX_GONE = 100;
export const MAX_RULE_LENGTH = 100;

/**
 * candidates: addresses of archived posts and the old addresses they used.
 * live: addresses that exist in this build (a live page always wins).
 * redirected: addresses that already have a 301 (a redirect always wins).
 */
export function buildGone(candidates: string[], live: Set<string>, redirected: Set<string>): { paths: string[]; problems: string[] } {
  const problems: string[] = [];
  const keep = new Set<string>();
  for (const c of candidates) {
    const p = normalizePath(c);
    if (!p) { problems.push(`gone: ignored "${c}", not a usable path`); continue; }
    if (live.has(p)) { problems.push(`gone: dropped ${p}, it is a live page`); continue; }
    if (redirected.has(p)) { problems.push(`gone: dropped ${p}, it already has a redirect`); continue; }
    if (p.length > MAX_RULE_LENGTH) { problems.push(`gone: dropped ${p}, longer than ${MAX_RULE_LENGTH} characters (Cloudflare rule limit)`); continue; }
    keep.add(p);
  }
  const all = [...keep].sort();
  if (all.length > MAX_GONE) problems.push(`gone: ${all.length} addresses but Cloudflare allows ${MAX_GONE} rules; ${all.length - MAX_GONE} will answer 404 instead of 410`);
  return { paths: all.slice(0, MAX_GONE), problems };
}
