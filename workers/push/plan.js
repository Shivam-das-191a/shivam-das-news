// Delivery plan (v0.67.0, Phase 9 part 6d; PLAN 31.4 steps 5 and 6, PLAN 31.6, PLAN 31.7, LOGICS 19 steps 3 and 4, BUGS P-group).
// Takes one announced post and the candidate readers of part 6c, and decides for each reader: queue it, hold it for later, or skip it.
// The scoring and delivery rules themselves are in lib.js (scoreSubscriber, deliveryDecision, v0.50.0). This part is the glue:
// it reads the readers' choices and recent sends from the database, runs those rules, and writes the result into push_queue and push_held.
// It SENDS NOTHING (the sender is part 7) and nothing calls it yet: POST /announce still only records posts.
// Pure functions and SQL text, except runPlan, which needs a database object from the caller (D1 in the Worker, SQLite in the tests) and the time as a number.

import { HOLD_MAX, HOLD_HOURS, THREAD_HOURS, TTL_SEC, isValidZone, localDay, scoreSubscriber, deliveryDecision, toMs } from './lib.js';
import { findCandidates, loadCandidates, LOAD_CHUNK } from './audience.js';

export const WRITE_CHUNK = 40; // statements in one batch
export const RECENT_HOURS = THREAD_HOURS; // what was sent in the last 12 hours: enough for the thread check and the 3 hour fatigue
export const DIGEST_HOLD_HOURS = TTL_SEC.digest / 3600; // a story held for the digest stays as long as a digest lives (12 hours)
export const WHO = 'announce'; // the name written in push_audit

const marks = (n) => Array.from({ length: n }, () => '?').join(',');
const rowsOf = (r) => (r && Array.isArray(r.results) ? r.results : []);
const json = (text, fallback) => {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- reading

export const LOAD_POST_SQL = 'SELECT key, url, title, description, category, tags, focus, author, flags, image, published_at FROM push_posts WHERE key = ?';

/** A push_posts row as the scoring rules want a post. Returns null for a row that cannot be used (when unsure, do not send). */
export function postFromRow(row) {
  if (!row || typeof row.key !== 'string') return null;
  const publishedAt = toMs(Number(row.published_at));
  if (!Number.isFinite(publishedAt) || publishedAt <= 0) return null;
  const flags = json(row.flags, {});
  const tags = json(row.tags, []);
  return {
    key: row.key,
    url: row.url,
    title: row.title,
    description: row.description || '',
    category: row.category || '',
    tags: Array.isArray(tags) ? tags : [],
    focus: row.focus || '',
    author: row.author || '',
    image: row.image || null,
    breaking: flags.breaking === true,
    featured: flags.featured === true,
    trending: flags.trending === true,
    push: ['auto', 'off', 'force'].includes(flags.push) ? flags.push : 'auto',
    pushTitle: typeof flags.pushTitle === 'string' ? flags.pushTitle : '',
    pushBody: typeof flags.pushBody === 'string' ? flags.pushBody : '',
    imageWidth: Number(flags.imageWidth) || 0,
    publishedAt,
  };
}

/** The choices of up to LOAD_CHUNK readers: one row for each category, author, keyword (stored, stemmed) and muted word (stored, stemmed). */
export const loadChoicesSql = (n) => `SELECT sub_id, kind, term FROM push_terms WHERE sub_id IN (${marks(n)}) AND kind IN ('cat', 'author', 'kw', 'mute')`;

/**
 * What was sent to these readers lately, with the category of each story (for the fatigue rule).
 * One row for each send in the last RECENT_HOURS. Values: the ids, then the earliest time (ms).
 */
export const loadRecentSql = (n) =>
  `SELECT s.sub_id AS sub_id, s.post_key AS post_key, s.ts AS ts, s.thread AS thread, p.category AS category FROM push_sent s LEFT JOIN push_posts p ON p.key = s.post_key WHERE s.sub_id IN (${marks(n)}) AND s.ts >= ?`;

/** Messages of this reader that wait in the queue and are not sent yet. They count against the daily limit like a send (a reader must not get 10 in a row because the sender is slow). */
export const loadPendingSql = (n) => `SELECT sub_id, COUNT(*) AS n FROM push_queue WHERE sub_id IN (${marks(n)}) AND state IN ('queued', 'sending') GROUP BY sub_id`;

/** How many messages are held for this reader and not expired (the limit is HOLD_MAX). Used by the tests; the write itself checks it inside one statement. */
export const COUNT_HELD_SQL = 'SELECT COUNT(*) AS n FROM push_held WHERE sub_id = ? AND expires > ?';

/**
 * A subscriber as scoreSubscriber and deliveryDecision want it, from a push_subs row (audience.js columns) and the reader's rows of push_terms.
 * `pending` is the number of messages waiting in the queue. They are added to sent_today of the reader's local day (BUGS P53).
 */
export function subFromRows(row, termRows, pending, now) {
  const terms = { cat: [], author: [], kw: [], mute: [] };
  for (const t of termRows || []) if (terms[t.kind] && typeof t.term === 'string') terms[t.kind].push(t.term);
  const sameDay = isValidZone(row.tz) && row.sent_day === localDay(now, row.tz);
  const waiting = Number(pending) || 0;
  const top = json(row.top_categories, []);
  return {
    id: row.id,
    status: row.status,
    failures: Number(row.failures) || 0,
    paused_until: row.paused_until == null ? null : Number(row.paused_until),
    level: row.level,
    learn_on: row.learn_on === 1 || row.learn_on === true,
    breaking_all: row.breaking_all === 1 || row.breaking_all === true,
    breaking_in_quiet: row.breaking_in_quiet === 1 || row.breaking_in_quiet === true,
    categories: terms.cat,
    authors: terms.author,
    keywords: terms.kw,
    muted: terms.mute,
    topCategories: Array.isArray(top) ? top : [],
    weights: json(row.weights, {}),
    tz: row.tz,
    quiet_start: row.quiet_start,
    quiet_end: row.quiet_end,
    daily_limit: row.daily_limit,
    digest_mode: row.digest_mode,
    last_sent: row.last_sent == null ? null : Number(row.last_sent),
    sent_day: isValidZone(row.tz) ? localDay(now, row.tz) : row.sent_day,
    sent_today: (sameDay ? Number(row.sent_today) || 0 : 0) + waiting,
  };
}

// ---------------------------------------------------------------- the decision (pure)

/**
 * Decides for every candidate. Nothing is read or written here.
 *   post: from postFromRow. subs: from subFromRows. recentBySub: Map from sub id to [{ ts, post_key, category, thread }]. now: ms.
 * Returns { queue: [{ sub_id, score, thread, ttl, urgency, update }], held: [{ sub_id, score, reason, hours }], skipped: { reason: count }, considered }.
 * The order of the rules is the order of LOGICS 19: already sent, score and level (scoreSubscriber), then delivery (deliveryDecision).
 * skipped reasons: already_sent, not_eligible, bad_time, muted, no_match, level_breaking, below_level, limit.
 */
export function planAudience(post, subs, recentBySub, now) {
  const queue = [];
  const held = [];
  const skipped = {};
  const skip = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };
  for (const sub of subs) {
    const recent = (recentBySub && recentBySub.get(sub.id)) || [];
    if (recent.some((r) => r.post_key === post.key)) { skip('already_sent'); continue; } // the duplicate guard (BUGS P2)
    const s = scoreSubscriber(sub, post, { now, recent: recent.map((r) => ({ ts: r.ts, category: r.category })) });
    if (!s.send) { skip(s.reason); continue; }
    const d = deliveryDecision(sub, post, s.score, { now, recent: recent.map((r) => ({ ts: r.ts, thread: r.thread })) });
    if (d.action === 'skip') { skip(d.reason); continue; }
    if (d.action === 'hold') {
      held.push({ sub_id: sub.id, score: s.score, reason: d.reason, hours: d.reason === 'digest' ? DIGEST_HOLD_HOURS : d.hours });
      continue;
    }
    queue.push({ sub_id: sub.id, score: s.score, thread: d.thread, ttl: d.ttl, urgency: d.urgency, update: d.update });
  }
  return { queue, held, skipped, considered: subs.length };
}

// ---------------------------------------------------------------- writing

/** One queued message. INSERT OR IGNORE: the same reader and post can never be queued twice (UNIQUE sub_id, post_key). */
export const INSERT_QUEUE_SQL = "INSERT OR IGNORE INTO push_queue (sub_id, post_key, score, thread, ttl, urgency, state, tries, created) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?)";
export const queueValues = (postKey, q, now) => [q.sub_id, postKey, q.score, q.thread, q.ttl, q.urgency, now];

/**
 * One held story, only while the reader has fewer than HOLD_MAX held stories that are not expired (the check is inside the statement, so two calls cannot both pass it).
 * Values: sub_id, post_key, score, expires, then sub_id, now (for the count), HOLD_MAX.
 */
export const INSERT_HELD_SQL = 'INSERT OR IGNORE INTO push_held (sub_id, post_key, score, expires) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM push_held WHERE sub_id = ? AND expires > ?) < ?';
export const heldValues = (postKey, h, now) => [h.sub_id, postKey, h.score, now + Math.round(h.hours * 3600000), h.sub_id, now, HOLD_MAX];

export const INSERT_AUDIT_SQL = 'INSERT INTO push_audit (ts, who, post_key, candidates, sent) VALUES (?, ?, ?, ?, ?)';

const chunks = (list, n) => {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
};

async function readByIds(db, ids, sqlFor, extra = []) {
  const rows = [];
  for (const part of chunks(ids, LOAD_CHUNK)) rows.push(...rowsOf(await db.prepare(sqlFor(part.length)).bind(...part, ...extra).all()));
  return rows;
}

/**
 * The whole step for one announced post: read, decide, write. Returns a short summary and never throws away an error:
 * a database error while reading goes up (nothing is written: when unsure, do not send), and an error while writing goes up too.
 *   db: { prepare(sql).bind(...).all() / .first(), batch([...]) }.   postKey: the key of a row of push_posts.   now: ms.
 * Result: { ok: false, reason: 'no_post' | 'bad_post' }
 *      or { ok: true, candidates, truncated, queued, held, skipped: {reason: n}, held_full }.
 * It writes one row to push_audit with the number of candidates and the number queued (PLAN 31.10).
 * Calling it a second time for the same post queues nothing new: the queue has a unique key and push_sent is checked.
 */
export async function runPlan(db, postKey, now) {
  const row = await db.prepare(LOAD_POST_SQL).bind(postKey).first();
  if (!row) return { ok: false, reason: 'no_post' };
  const post = postFromRow(row);
  if (!post) return { ok: false, reason: 'bad_post' };

  const found = await findCandidates(db, post, now);
  const subRows = await loadCandidates(db, found.ids);
  const ids = subRows.map((r) => r.id);
  const termRows = await readByIds(db, ids, loadChoicesSql);
  const recentRows = await readByIds(db, ids, loadRecentSql, [now - RECENT_HOURS * 3600000]);
  const pendingRows = await readByIds(db, ids, loadPendingSql);

  const termsBySub = new Map();
  for (const t of termRows) (termsBySub.get(t.sub_id) || termsBySub.set(t.sub_id, []).get(t.sub_id)).push(t);
  const recentBySub = new Map();
  for (const r of recentRows) (recentBySub.get(r.sub_id) || recentBySub.set(r.sub_id, []).get(r.sub_id)).push({ ts: Number(r.ts), post_key: r.post_key, category: r.category || '', thread: r.thread });
  const pendingBySub = new Map(pendingRows.map((r) => [r.sub_id, Number(r.n) || 0]));

  const subs = subRows.map((r) => subFromRows(r, termsBySub.get(r.id), pendingBySub.get(r.id), now));
  const plan = planAudience(post, subs, recentBySub, now);

  const statements = [
    ...plan.queue.map((q) => db.prepare(INSERT_QUEUE_SQL).bind(...queueValues(post.key, q, now))),
    ...plan.held.map((h) => db.prepare(INSERT_HELD_SQL).bind(...heldValues(post.key, h, now))),
  ];
  let heldDone = plan.held.length;
  let queuedDone = plan.queue.length;
  let offset = 0;
  for (const part of chunks(statements, WRITE_CHUNK)) {
    const done = await db.batch(part);
    part.forEach((_, n) => {
      const changes = Number(done && done[n] && done[n].meta && done[n].meta.changes);
      if (changes !== 1) {
        if (offset + n < plan.queue.length) queuedDone -= 1; // already in the queue: not new
        else heldDone -= 1; // the reader already has HOLD_MAX held stories, or the story is already held
      }
    });
    offset += part.length;
  }
  await db.prepare(INSERT_AUDIT_SQL).bind(now, WHO, post.key, found.ids.length, queuedDone).run();
  return { ok: true, candidates: found.ids.length, truncated: found.truncated, queued: queuedDone, held: heldDone, held_full: plan.held.length - heldDone, skipped: plan.skipped };
}
