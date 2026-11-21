// Editor side of the redirect rule (PLAN 9): when the URL of a live post changes, the old URL is
// kept in `redirects` (BUGS U3, U4, U8). v0.5.0 adds the helpers for the Redirect Manager screen.
import { postUrl } from './url.js';

// opts.keepOld === false means the owner switched the 301 off for a post younger than 24 hours (PLAN 33.2, LOGICS 21).
export function nextRedirects(prev, next, tz, opts = {}) {
  const list = [...(next.redirects || [])];
  const newUrl = postUrl(next.category, next.permalink, new Date(next.date), tz);
  if (prev && prev.status === 'published' && opts.keepOld !== false) {
    const oldUrl = postUrl(prev.category, prev.permalink, new Date(prev.date), tz);
    if (oldUrl !== newUrl && !list.includes(oldUrl)) list.push(oldUrl);
  }
  // Loop guard: a redirect whose source is the live URL must go.
  return list.filter((u) => u !== newUrl);
}

/** Same rules as normalizePath() in src/lib/redirects.ts. */
export function normalizePath(input) {
  let p = String(input || '').trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) { try { p = new URL(p).pathname; } catch { return null; } }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith('/')) return null;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  if (/[\s*:]/.test(p)) return null;
  return p;
}

/** One checked manual redirect, or an Error with a plain message. */
export function cleanEntry(from, to, live = new Set(), existing = []) {
  const f = normalizePath(from);
  const t = normalizePath(to);
  if (!f) throw new Error(`"${from}" is not a usable old address. Start with / and use no spaces, ":" or "*".`);
  if (!t) throw new Error(`"${to}" is not a usable new address. Start with / and use no spaces, ":" or "*".`);
  if (f === t) throw new Error('The old and new address are the same.');
  if (live.has(f)) throw new Error(`${f} is a live page, so it cannot redirect somewhere else.`);
  if (existing.some((e) => e.from === f)) throw new Error(`${f} already has a redirect. Remove it first.`);
  return { from: f, to: t };
}

/** CSV with two columns, from,to. A header row and blank lines are skipped. */
export function parseCsv(text) {
  return String(text).split(/\r?\n/).map((l) => l.split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))).filter((r) => r[0] && r[1] && !(r[0].toLowerCase() === 'from' && r[1].toLowerCase() === 'to'));
}

export const toCsv = (rows) => 'from,to,source\n' + rows.map((r) => `${r.from},${r.to},${r.source || 'manual'}`).join('\n') + (rows.length ? '\n' : '');
