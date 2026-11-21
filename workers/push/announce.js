// Announce rules (v0.64.0, Phase 9 part 6a; PLAN 31.4 step 2 and 31.5; BUGS P-group).
// POST /announce is called by the deploy job (GitHub Actions) with a secret header, never by a browser.
// It gets the posts that went live in one deploy and decides for each one: accepted (recorded in push_posts) or skipped (with a short reason).
// This part only CHECKS and RECORDS. It finds no readers, scores nothing and sends nothing: that is parts 6b and later.
// Pure functions and SQL text: no network, no database object, no clock of its own (the caller gives "now").
// v0.65.0 (part 6b): the live check itself is in livecheck.js (it needs the network). Here it is only a step between the two halves of the decision:
// prepare() runs the checks that need no network, the caller opens the pages of the posts that passed, finish() applies the answers and the import guard.

import { MAX_AGE_MIN, IMPORT_GUARD, IMPORT_KEEP, URL_MAX, TITLE_MAX, BODY_MAX, toMs, importance, buildPayload } from './lib.js';
import { safeEqual, tokenHash } from './prefs.js';

export const ANNOUNCE_MAX_BODY = 64000; // bytes of JSON for one call
export const ANNOUNCE_MAX_POSTS = 25; // posts in one call
export const SECRET_MIN = 32; // a shorter ANNOUNCE_SECRET is refused: the route stays off
export const FUTURE_SLACK_MS = 5 * 60000; // a clock difference of up to 5 minutes is fine; a post dated later than that is not live yet
export const PUSH_VALUES = ['auto', 'off', 'force'];
export const SECRET_HEADER = 'X-Announce-Secret';

/** Every reason a post can be skipped. The answer only ever holds one of these words, never a text from the post. */
export const REASONS = [
  'bad_post', // a field is missing or wrong (the answer names the field)
  'duplicate', // the same key twice in one call
  'push_off', // the editor set push to off
  'sponsored',
  'not_published', // status is given and is not "published"
  'noindex',
  'not_yet', // dated in the future
  'too_old', // older than MAX_AGE_MIN
  'emoji', // an emoji in the title, description or the notification text (PLAN 29.3)
  'bad_url', // not https, too long, or not an address of this site
  'too_big', // the notification cannot be made small enough
  'already_announced', // the key is in push_posts
  'not_live', // v0.65.0 (6b): the live check got a status other than 200 (404, 410, a redirect, an error) or a page that is not HTML
  'check_failed', // v0.65.0 (6b): the live check could not finish (timeout, network): when unsure, do not send. Not recorded, so a later call may try again
  'import_guard', // more than IMPORT_GUARD new posts in one call: only the best IMPORT_KEEP (and every "force") go on
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isStr = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isSlug = (v, max) => isStr(v, 1, max) && SLUG.test(v);
const isBool = (v) => typeof v === 'boolean';
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const absent = (v) => v === undefined || v === null;

const bad = (field) => ({ ok: false, reason: 'bad_post', field });

/**
 * Checks the shape of one post as the deploy job sends it (PLAN 31.4 step 2) and returns a clean copy.
 * Returns { ok: true, post } or { ok: false, reason: 'bad_post', field }.
 * Nothing is trusted: every text has a length limit, every list a size limit, and the keys are the permalink form the site uses.
 */
export function cleanPost(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('post');
  const r = raw;
  if (!isSlug(r.key, 120)) return bad('key');
  if (!isStr(r.url, 1, URL_MAX)) return bad('url');
  if (!isStr(r.title, 1, 200) || !r.title.trim()) return bad('title');
  if (!absent(r.description) && !isStr(r.description, 0, 400)) return bad('description');
  if (!absent(r.category) && !(r.category === '' || isSlug(r.category, 60))) return bad('category');
  if (!absent(r.tags) && !(Array.isArray(r.tags) && r.tags.length <= 20 && r.tags.every((t) => isStr(t, 1, 60)))) return bad('tags');
  if (!absent(r.focus) && !isStr(r.focus, 0, 80)) return bad('focus');
  if (!absent(r.author) && !(r.author === '' || isSlug(r.author, 60))) return bad('author');
  for (const f of ['breaking', 'featured', 'trending', 'sponsored']) if (!absent(r[f]) && !isBool(r[f])) return bad(f);
  if (!absent(r.push) && !PUSH_VALUES.includes(r.push)) return bad('push');
  if (!absent(r.pushTitle) && !isStr(r.pushTitle, 0, TITLE_MAX)) return bad('pushTitle');
  if (!absent(r.pushBody) && !isStr(r.pushBody, 0, BODY_MAX)) return bad('pushBody');
  if (!absent(r.image) && !isStr(r.image, 1, URL_MAX)) return bad('image');
  if (!absent(r.imageWidth) && !isInt(r.imageWidth, 1, 20000)) return bad('imageWidth');
  if (!absent(r.wordCount) && !isInt(r.wordCount, 0, 1000000)) return bad('wordCount');
  if (!absent(r.robots) && !isStr(r.robots, 0, 100)) return bad('robots');
  if (!absent(r.status) && !isStr(r.status, 0, 20)) return bad('status');
  const publishedAt = toMs(r.publishedAt);
  if (!Number.isFinite(publishedAt) || publishedAt <= 0) return bad('publishedAt');

  const post = {
    key: r.key,
    url: r.url,
    title: r.title.trim(),
    description: absent(r.description) ? '' : r.description,
    category: absent(r.category) ? '' : r.category,
    tags: absent(r.tags) ? [] : r.tags,
    focus: absent(r.focus) ? '' : r.focus,
    author: absent(r.author) ? '' : r.author,
    breaking: r.breaking === true,
    featured: r.featured === true,
    trending: r.trending === true,
    sponsored: r.sponsored === true,
    push: absent(r.push) ? 'auto' : r.push,
    pushTitle: absent(r.pushTitle) ? '' : r.pushTitle,
    pushBody: absent(r.pushBody) ? '' : r.pushBody,
    image: absent(r.image) ? null : r.image,
    imageWidth: absent(r.imageWidth) ? 0 : r.imageWidth,
    wordCount: absent(r.wordCount) ? 0 : r.wordCount,
    robots: absent(r.robots) ? '' : r.robots,
    status: absent(r.status) ? '' : r.status,
    publishedAt,
  };
  return { ok: true, post };
}

/** True when the url is https and on the same site as siteOrigin (the notification may only open this site). */
export function onSite(url, siteOrigin) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && u.origin === new URL(siteOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * The rules of PLAN 31.5 that need no database, in a fixed order. Returns the reason to skip, or null when the post may go on.
 * Order: editor choice, sponsored, not published, noindex, not yet live, too old, then the notification text itself (emoji, address, size).
 * "force" never skips these: it only skips the importance part later (and the import guard).
 */
export function checkPost(post, now, siteOrigin) {
  if (post.push === 'off') return 'push_off';
  if (post.sponsored) return 'sponsored';
  if (post.status && post.status !== 'published') return 'not_published';
  if (/noindex/i.test(post.robots)) return 'noindex';
  if (post.publishedAt > now + FUTURE_SLACK_MS) return 'not_yet';
  if (now - post.publishedAt > MAX_AGE_MIN * 60000) return 'too_old';
  if (!onSite(post.url, siteOrigin)) return 'bad_url';
  const built = buildPayload(post);
  if (!built.ok) return built.reason === 'no_title' ? 'bad_post' : built.reason; // emoji, bad_url, too_big
  return null;
}

/**
 * The import guard (PLAN 31.5): when one call brings more than IMPORT_GUARD posts that passed every other check, only the IMPORT_KEEP
 * with the highest importance go on, and every post with push "force". The others are skipped. Ties go to the newer post, then the key.
 * Takes the posts that passed; returns the set of keys that are dropped.
 */
export function importGuard(posts) {
  const dropped = new Set();
  if (posts.length <= IMPORT_GUARD) return dropped;
  const rest = posts.filter((p) => p.push !== 'force');
  rest.sort((a, b) => importance(b) - importance(a) || b.publishedAt - a.publishedAt || (a.key < b.key ? -1 : 1));
  for (const p of rest.slice(IMPORT_KEEP)) dropped.add(p.key);
  return dropped;
}

// ---------------------------------------------------------------- SQL

export const existingKeysSql = (n) => `SELECT key FROM push_posts WHERE key IN (${Array.from({ length: n }, () => '?').join(',')})`;

/** One row for one post. INSERT OR IGNORE: a key that is already there changes nothing (the duplicate guard, BUGS P-group). */
export const INSERT_POST_SQL =
  'INSERT OR IGNORE INTO push_posts (key, url, title, description, category, tags, focus, author, flags, image, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

/** What is kept in the flags column (JSON): the importance flags, the push choice, the editor's notification text and what the sender needs later. */
export function flagsOf(post) {
  const f = { breaking: post.breaking, featured: post.featured, trending: post.trending, push: post.push };
  if (post.pushTitle) f.pushTitle = post.pushTitle;
  if (post.pushBody) f.pushBody = post.pushBody;
  if (post.imageWidth) f.imageWidth = post.imageWidth;
  if (post.wordCount) f.wordCount = post.wordCount;
  return f;
}

export const insertValues = (post, now) => [
  post.key,
  post.url,
  post.title,
  post.description,
  post.category,
  JSON.stringify(post.tags),
  post.focus,
  post.author,
  JSON.stringify(flagsOf(post)),
  post.image,
  post.publishedAt,
  now,
];

// ---------------------------------------------------------------- the whole decision

/**
 * First half of the decision (no network). `known` is the set of keys already in push_posts.
 * Returns { results, passed }: results has one entry for each input post in the same order (the skipped ones are filled in, the others are still empty),
 * passed is the list of { i, post } that passed every check and still wait for the live check (6b) and the import guard.
 */
export function prepare(rawPosts, known, now, siteOrigin) {
  const results = new Array(rawPosts.length);
  const passed = []; // { i, post }
  const seen = new Set();
  rawPosts.forEach((raw, i) => {
    const c = cleanPost(raw);
    if (!c.ok) {
      results[i] = { key: raw && typeof raw === 'object' && isSlug(raw.key, 120) ? raw.key : null, status: 'skipped', reason: 'bad_post', field: c.field };
      return;
    }
    const post = c.post;
    const skip = (reason) => { results[i] = { key: post.key, status: 'skipped', reason }; };
    if (seen.has(post.key)) return skip('duplicate');
    seen.add(post.key);
    const reason = checkPost(post, now, siteOrigin);
    if (reason) return skip(reason);
    if (known.has(post.key)) return skip('already_announced');
    passed.push({ i, post });
  });
  return { results, passed };
}

/**
 * Second half of the decision. `live` is a Map from key to { ok, reason? } (the answers of livecheck.js), or null when no live check was made (older callers).
 * A post whose live check failed is skipped with its reason BEFORE the import guard, so a page that is not live cannot take the place of a live one.
 * Returns { results, record }: record is the list of clean posts to write (the accepted ones).
 */
export function finish(prep, live) {
  const { results, passed } = prep;
  const alive = [];
  for (const item of passed) {
    const l = live ? live.get(item.post.key) : { ok: true };
    if (!l || !l.ok) results[item.i] = { key: item.post.key, status: 'skipped', reason: l && REASONS.includes(l.reason) ? l.reason : 'check_failed' }; // a missing answer is a failed check
    else alive.push(item);
  }
  const dropped = importGuard(alive.map((x) => x.post));
  const record = [];
  for (const { i, post } of alive) {
    if (dropped.has(post.key)) results[i] = { key: post.key, status: 'skipped', reason: 'import_guard' };
    else {
      results[i] = { key: post.key, status: 'accepted' };
      record.push(post);
    }
  }
  return { results, record };
}

/** Both halves in one step, with no live check (kept for the 6a callers and the unit tests of the rules). The Worker route uses prepare, the live check and finish. */
export function decide(rawPosts, known, now, siteOrigin) {
  return finish(prepare(rawPosts, known, now, siteOrigin), null);
}

/** The secret check: both sides are hashed first, so the comparison time does not show the length or the content. A missing or short secret is never a match. */
export async function secretMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || expected.length < SECRET_MIN) return false;
  return safeEqual(await tokenHash(given), await tokenHash(expected));
}
