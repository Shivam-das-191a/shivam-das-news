// Push feedback rules (Cloudflare Worker, v0.98.0, Phase 9 part 8a; PLAN 31.8, signal 1: taps on notifications).
// The service worker (public/push-sw.js, v0.54.0) reports what the reader did: POST /feedback { sub, token, event, tag }.
//   event: open (the reader opened the story), close (dismissed it), less (the button "Less like this")
//   tag:   the story thread key of the notification
// The Worker finds the category from its own record of what it sent under that tag (push_sent joined with push_posts).
// The text of a story is never sent back and nothing about the tap is kept except the learned weight and the engagement number.
// A reader's own choices are never removed here: only the learned weight of one category moves, always inside -1 and 1 (PLAN 31.8).
// v0.99.0 (part 8b): the weights fade by 5 percent a week, so old habits fade (runFade, called by the hourly clean-up tick in control.js).
// v0.100.0 (part 8c-1): every "Less like this" tap is also counted in push_less (30 days). A category with 3 or more taps that the reader still follows is
// given back as `suggestRemove` when the page reads the choices. The page shows the offer in part 8c-2; this part never removes a choice (PLAN 31.8).
// v0.101.0 (part 8c-2): when the reader saves choices without a category, the counted taps of that category are removed (CLEAR_LESS_SQL, removedCategories), so the offer
// does not come back for a topic that is already gone. The page shows the offer and the one-tap button (site/src/lib/notifications-page.js).
// Not in these parts: the adaptive limit (later parts of 8).

export const FEEDBACK_EVENTS = ['open', 'close', 'less'];
export const OPEN_STEP = 0.1; // open: the weight moves this share of the remaining distance to +1
export const CLOSE_DELTA = -0.04; // closed without opening
export const LESS_DELTA = -0.25; // "Less like this"
export const ENGAGEMENT_OPEN = 1; // engagement goes up on an open
export const MAX_WEIGHT_CATEGORIES = 40; // the weights field never grows without a limit
export const TAG_MAX = 80;

const norm = (s) => String(s ?? '').trim().toLowerCase();
/** A category in the form used for weights and for the "Less like this" count. */
export const categoryKey = norm;
const round = (n, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits;
const clamp = (n) => Math.max(-1, Math.min(1, n));

/** The stored weights text (or object) as a clean object: category -> number from -1 to 1. Anything else is dropped. */
export function cleanWeights(raw, digits = 4) {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    const key = norm(k);
    const num = Number(n);
    if (key && Number.isFinite(num) && Object.keys(out).length < MAX_WEIGHT_CATEGORIES) out[key] = round(clamp(num), digits);
  }
  return out;
}

/**
 * The new weights and engagement after one tap.
 * Returns { applied, weights, engagement }. applied is false for an unknown event or an empty category (nothing changes then).
 */
export function applyFeedback(weights, engagement, category, event) {
  const w = cleanWeights(weights);
  const eng = Number.isFinite(Number(engagement)) ? Number(engagement) : 0;
  const cat = norm(category);
  if (!FEEDBACK_EVENTS.includes(event) || !cat) return { applied: false, weights: w, engagement: eng };
  // A new category is added only while there is room; a known one always moves.
  if (!(cat in w) && Object.keys(w).length >= MAX_WEIGHT_CATEGORIES) return { applied: false, weights: w, engagement: eng };
  const old = cat in w ? w[cat] : 0;
  let next;
  if (event === 'open') next = old + OPEN_STEP * (1 - old);
  else if (event === 'close') next = old + CLOSE_DELTA;
  else next = old + LESS_DELTA;
  w[cat] = round(clamp(next));
  return { applied: true, weights: w, engagement: round(eng + (event === 'open' ? ENGAGEMENT_OPEN : 0)) };
}

/** The category of the story that was sent to this reader under this tag (the newest one). */
export const TAG_CATEGORY_SQL =
  'SELECT p.category AS category FROM push_sent s JOIN push_posts p ON p.key = s.post_key WHERE s.sub_id = ? AND s.thread = ? ORDER BY s.ts DESC LIMIT 1';

/** Saves the new numbers. The weights text only changes while the reader row is still there. */
export const SAVE_FEEDBACK_SQL = 'UPDATE push_subs SET weights = ?, engagement = ? WHERE id = ?';

/** A tag as the service worker sends it: text, trimmed, not longer than TAG_MAX. Anything else is an empty tag. */
export const cleanTag = (v) => (typeof v === 'string' ? v.trim().slice(0, TAG_MAX) : '');

// ---------------------------------------------------------------- the weekly fade (part 8b, PLAN 31.8: "all weights move back toward 0 by 5 percent a week")

export const FADE_PER_WEEK = 0.05; // 5 percent a week
export const FADE_RUNS_PER_WEEK = 168; // one run an hour (the clean-up tick)
export const FADE_FACTOR = (1 - FADE_PER_WEEK) ** (1 / FADE_RUNS_PER_WEEK); // what one run multiplies every weight by
export const FADE_DROP = 0.005; // a weight whose size falls under this is removed: it no longer says anything
export const FADE_DIGITS = 6; // enough digits so that one hour of fading is not rounded away

/**
 * One statement for ALL readers (the free plan allows only a few database calls in one run, so no reader-by-reader loop).
 * Every number in `weights` is multiplied by the factor; a number that becomes smaller than the drop size is removed;
 * the text becomes '{}' when nothing is left. A row whose weights text is not valid JSON, and a reader marked gone, are not touched.
 */
export const FADE_SQL =
  "UPDATE push_subs SET weights = COALESCE((SELECT json_group_object(j.key, ROUND(j.value * ?, 6)) FROM json_each(push_subs.weights) AS j WHERE ABS(j.value * ?) >= ?), '{}') WHERE weights != '{}' AND status != 'gone' AND json_valid(weights)";

/** The same rule in plain code (used by the tests to check the SQL, and to read the rule in one place). */
export function fadeWeights(raw) {
  const w = cleanWeights(raw, FADE_DIGITS);
  const out = {};
  for (const [k, n] of Object.entries(w)) {
    const next = n * FADE_FACTOR;
    if (Math.abs(next) >= FADE_DROP) out[k] = Math.round(next * 10 ** FADE_DIGITS) / 10 ** FADE_DIGITS;
  }
  return out;
}

/**
 * Fades the weights of every reader once. Returns { ok: true, faded } (rows changed) or { ok: false, reason }.
 * It never throws. Nothing but the weights text changes; engagement and the reader's own choices stay.
 */
export async function runFade(db) {
  if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'no_db' };
  try {
    const r = await db.prepare(FADE_SQL).bind(FADE_FACTOR, FADE_FACTOR, FADE_DROP).run();
    const n = r && r.meta ? Number(r.meta.changes) : 0;
    return { ok: true, faded: Number.isFinite(n) && n > 0 ? n : 0 };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// ---------------------------------------------------------------- "Less like this" count (part 8c-1, PLAN 31.8)

export const LESS_WINDOW_DAYS = 30;
export const LESS_OFFER_AFTER = 3; // taps in the window for one category
export const LESS_MAX_ROWS = 20; // rows kept for one reader and one category in the window (a flood cannot grow the table)
export const DAY_MS = 86400000;

/** Writes one tap, unless this reader already has LESS_MAX_ROWS taps for this category in the window. Values: sub id, category, now, sub id, category, window start, max. */
export const RECORD_LESS_SQL =
  'INSERT INTO push_less (sub_id, category, ts) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM push_less WHERE sub_id = ? AND category = ? AND ts >= ?) < ?';

/** The categories with enough taps. Values: sub id, window start, the number of taps. */
export const LESS_COUNTS_SQL =
  'SELECT category, COUNT(*) AS n FROM push_less WHERE sub_id = ? AND ts >= ? GROUP BY category HAVING COUNT(*) >= ? ORDER BY n DESC, category LIMIT 10';

/** Removes the counted taps of one reader, found by the reader's `sub` id. Run BEFORE the reader row is deleted. */
export const DELETE_LESS_SQL = 'DELETE FROM push_less WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)';

/** Removes the counted taps of one reader for a list of categories. Values: the reader's `sub` id, a JSON text with the list of categories. */
export const CLEAR_LESS_SQL =
  'DELETE FROM push_less WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?) AND category IN (SELECT value FROM json_each(?))';

/** The categories that were followed before and are not followed now (lower case, no repeats). Anything that is not a list gives an empty list. */
export function removedCategories(before, after) {
  const now = new Set((Array.isArray(after) ? after : []).map(norm));
  const out = [];
  for (const c of Array.isArray(before) ? before : []) {
    const k = norm(c);
    if (k && !now.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

export const lessWindowStart = (now) => Number(now) - LESS_WINDOW_DAYS * DAY_MS;

/**
 * The offer: [{ category, count }] for each counted category that the reader still follows (their own list of categories).
 * A category the reader no longer follows gives no offer. The site never removes a choice by itself.
 */
export function suggestRemove(rows, followed) {
  const mine = new Set((Array.isArray(followed) ? followed : []).map(norm));
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const category = norm(r && r.category);
    const count = Number(r && r.n);
    if (category && mine.has(category) && Number.isFinite(count) && count >= LESS_OFFER_AFTER) out.push({ category, count });
  }
  return out;
}

/** Deletes counted taps that are older than the window, and taps of readers that no longer exist. Never throws. Returns { ok, deleted }. */
export async function runLessCleanup(db, now) {
  if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'no_db' };
  const t = Number(now);
  if (!Number.isFinite(t) || t <= 0) return { ok: false, reason: 'bad_time' };
  try {
    const n = (r) => (r && r.meta && Number(r.meta.changes) > 0 ? Number(r.meta.changes) : 0);
    const old = await db.prepare('DELETE FROM push_less WHERE rowid IN (SELECT rowid FROM push_less WHERE ts < ? LIMIT 2000)').bind(lessWindowStart(t)).run();
    const orphan = await db.prepare('DELETE FROM push_less WHERE rowid IN (SELECT rowid FROM push_less WHERE sub_id NOT IN (SELECT id FROM push_subs) LIMIT 2000)').run();
    return { ok: true, deleted: n(old) + n(orphan) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
