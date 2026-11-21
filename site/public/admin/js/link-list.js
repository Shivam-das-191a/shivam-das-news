// v0.15.0: helpers for the "Links" screen, the hand-made keyword-to-address list (config/links.json, PLAN 7).
// Same rules as the build (src/lib/autolink.ts): a keyword is 4+ characters of letters, digits, spaces, ' and -,
// and the address must be a path of this site. Pure functions, no DOM.
import { normalizePath } from './redirects.js';

export const MAX_LINKS = 500;
const SAFE = /^[A-Za-z0-9][A-Za-z0-9 '-]*$/;
const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Reads the file text. Anything that is not a list of { keyword, url } gives an empty list. */
export function readLinks(text) {
  let j;
  try { j = JSON.parse(text); } catch { return []; }
  return Array.isArray(j) ? j.filter((x) => x && typeof x.keyword === 'string' && typeof x.url === 'string').map((x) => ({ keyword: tidy(x.keyword), url: x.url })) : [];
}

/** One checked entry, or an Error with a plain message. `existing` is the current list. */
export function cleanLink(keyword, url, existing = []) {
  const k = tidy(keyword);
  if (k.length < 4) throw new Error('The keyword needs at least 4 characters.');
  if (!SAFE.test(k)) throw new Error('The keyword may only hold letters, numbers, spaces, apostrophes and hyphens.');
  const u = normalizePath(url);
  if (!u || u.startsWith('//')) throw new Error(`"${url}" is not a usable address. Start with / (for example /category/energy/), no full web address needed.`);
  if (existing.some((e) => tidy(e.keyword).toLowerCase() === k.toLowerCase())) throw new Error(`"${k}" is already in the list. Remove it first to change its address.`);
  if (existing.length >= MAX_LINKS) throw new Error(`The list is full (${MAX_LINKS} entries).`);
  return { keyword: k, url: u };
}

export const writeLinks = (list) => JSON.stringify(list, null, 2) + '\n';
