/**
 * Title match and lifetime redirects between the old Blogger blog and this site (PLAN 32, BUGS group T).
 * Pure functions. No network, no clock (the caller passes today's date). Plain JS so scripts and tests share it.
 * Rule: two posts match only when the title is the SAME after a safe clean-up (entities, Unicode form, spaces).
 * Case, punctuation and every letter must be equal. Anything less than 100 percent is reported, never redirected.
 */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const cp = (n) => { try { return String.fromCodePoint(n); } catch { return ''; } };

/** One pass only, so "&amp;#39;" becomes "&#39;" and not an apostrophe. */
export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

/** The match key. Only invisible differences are removed; a visible difference keeps two titles apart. */
export function strictKey(title) {
  return decodeEntities(title)
    .normalize('NFC')
    .replace(/[\u200B\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Looser key, used ONLY to list near matches for a person to read. It never creates a redirect. */
export function looseKey(title) {
  return strictKey(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Path of an old Blogger post or page, or null when the address is not one of that blog's.
 * Any country form of the host is accepted (blogspot.com, blogspot.in, blogspot.co.uk ...). Query and hash are dropped (?m=1).
 */
export function oldPathOf(url, blog) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const host = new RegExp(`^${blog.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.blogspot\\.[a-z]{2,}(\\.[a-z]{2})?$`, 'i');
  if (!host.test(u.hostname)) return null;
  const p = u.pathname;
  return /^\/(\d{4}\/\d{2}\/|p\/)[A-Za-z0-9._~%-]+\.html$/.test(p) ? p : null;
}

const groupBy = (list, key) => {
  const m = new Map();
  for (const x of list) {
    const k = key(x);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

/**
 * oldPosts: [{ title, url, path }]   (path from oldPathOf, never null)
 * newPosts: [{ title, url, before }] (url is a path on this site; before = its earlier addresses)
 * A pair needs exactly one old and exactly one new post with the same key. Two or more on either side is ambiguous and skipped.
 */
export function matchTitles(oldPosts, newPosts) {
  const O = groupBy(oldPosts, (p) => strictKey(p.title));
  const N = groupBy(newPosts, (p) => strictKey(p.title));
  const pairs = [], ambiguous = [], onlyOld = [], onlyNew = [];
  for (const [k, os] of O) {
    const ns = N.get(k);
    if (!ns) { onlyOld.push(...os); continue; }
    if (os.length === 1 && ns.length === 1) {
      pairs.push({ from: os[0].path, to: ns[0].url, title: strictKey(ns[0].title), oldUrl: os[0].url, history: ns[0].before || [] });
    } else {
      ambiguous.push({ title: k, old: os.map((o) => o.url), new: ns.map((n) => n.url) });
    }
  }
  for (const [k, ns] of N) if (!O.has(k)) onlyNew.push(...ns);
  const loose = groupBy(onlyNew, (n) => looseKey(n.title));
  const near = [];
  for (const o of onlyOld) {
    const hit = loose.get(looseKey(o.title));
    if (hit) near.push({ old: { title: o.title, url: o.url }, new: hit.map((h) => ({ title: h.title, url: h.url })) });
  }
  return { pairs, ambiguous, near, onlyOld, onlyNew };
}

const byFrom = (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0);

/**
 * LIFETIME rule: an entry is never removed and never silently pointed somewhere else.
 * - new pair: added with the date it was first seen.
 * - same pair again: nothing changes.
 * - same old address, target is an earlier address of the same post (slug or date changed): `to` moves to the current address.
 * - same old address, a different post: kept as it was and reported as a conflict (a person decides).
 * - an old entry that is not in `pairs` (old post deleted, title edited): kept untouched.
 */
export function mergeLifetime(existing, pairs, today) {
  const map = new Map((existing || []).map((e) => [e.from, { ...e }]));
  const added = [], moved = [], conflicts = [];
  for (const p of pairs) {
    const cur = map.get(p.from);
    if (!cur) {
      const e = { from: p.from, to: p.to, title: p.title, since: today };
      map.set(p.from, e);
      added.push(e);
    } else if (cur.to !== p.to) {
      if (p.history.includes(cur.to)) { moved.push({ from: p.from, was: cur.to, now: p.to }); cur.to = p.to; }
      else conflicts.push({ from: p.from, kept: cur.to, seen: p.to });
    }
  }
  return { entries: [...map.values()].sort(byFrom), added, moved, conflicts };
}

/** One entry is usable only when both addresses are plain paths of this site's shape. Returns the problems. */
export function checkEntries(entries) {
  const bad = [];
  for (const e of entries) {
    if (!/^\/(\d{4}\/\d{2}\/|p\/)[A-Za-z0-9._~%-]+\.html$/.test(e.from || '')) bad.push(`${e.from}: not a Blogger address`);
    else if (!/^\/[^\s*:?#]*$/.test(e.to || '') || (e.to || '').startsWith('//')) bad.push(`${e.from}: target "${e.to}" is not a path on this site`);
  }
  return bad;
}

/** For config/redirects style input of the existing builder (it checks live pages, chains and loops). */
export const toRedirectEntries = (entries) => entries.map((e) => ({ from: e.from, to: e.to }));

/** Blogger side: old path to new path. The origin is added by the snippet, so a target can never leave the canonical host. */
export function bloggerSnippet(entries, origin) {
  const o = String(origin).replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(o)) throw new Error('origin must be https://host with no path');
  const map = {};
  for (const e of [...entries].sort(byFrom)) map[e.from] = e.to;
  const json = JSON.stringify(map).replace(/</g, '\\u003c');
  return [
    '<script>',
    '(function () {',
    `  var M = ${json};`,
    `  var O = ${JSON.stringify(o)};`,
    '  var p = location.pathname;',
    '  var to = M[p] || M[p.toLowerCase()];',
    '  if (to) location.replace(O + to);',
    '})();',
    '</script>',
    '',
  ].join('\n');
}
