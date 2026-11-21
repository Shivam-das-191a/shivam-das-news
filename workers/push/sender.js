// Sender (v0.68.0, Phase 9 part 7a; PLAN 31.4 steps 7 and 8, PLAN 31.7, PLAN 31.9, PLAN 31.11, LOGICS 19 step 5, BUGS P-group).
// Takes the next messages from push_queue (written by plan.js, part 6d), builds the notification, sends it with sendPush (webpush.js, part 3)
// and writes the result: push_queue, push_sent and the counters of the reader.
// One call of runSender is one batch. It does NOT run by itself: the cron that calls it and the switch that turns it off are part 7b,
// so no reader gets anything until 7b is built. No console call anywhere: the push address is a secret (BUGS P13) and is never logged or returned.
// It needs a database object from the caller (D1 in the Worker, SQLite in the tests), the sender keys, and the time as a number.
//
// Free plan (PLAN 31.11): a free Worker call makes about 50 outgoing requests, so one batch is SEND_BATCH sends plus a fixed small number of
// database calls (about 10). The numbers are written down in the constants below and checked by a test; check the current Cloudflare limits before you raise them.

import { MAX_FAILURES, THREAD_HOURS, isValidZone, localDay, buildPayload } from './lib.js';
import { sendPush } from './webpush.js';
import { postFromRow } from './plan.js';

export const SEND_BATCH = 36; // messages in one call: 36 sends and about 10 database calls stay under the 50 of the free plan
export const SEND_CONCURRENCY = 6; // a Worker may keep 6 outgoing connections open at the same time
export const LEASE_MS = 5 * 60000; // a claimed message not finished after this time is taken back (the Worker stopped in the middle)
export const MAX_TRIES = 3; // the first try and 2 retries (PLAN 31.7)
export const RETRY_SEC = [60, 300]; // wait before retry 1 and retry 2
export const AUTH_WAIT_SEC = 600; // a key problem of ours (401, 403, no key): try again in 10 minutes, nothing is counted against the reader
export const RESULT_CHUNK = 100; // statements in one database batch when the results are written
export const TOPIC_CHARS = 22; // Topic header: the first 22 characters of the hash of the thread (LOGICS 19 step 5; the push service allows 32)

const marks = (n) => Array.from({ length: n }, () => '?').join(',');
const rowsOf = (r) => (r && Array.isArray(r.results) ? r.results : []);
const chunks = (list, n) => {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
};

// ---------------------------------------------------------------- SQL

/** A claimed message that was never finished (the Worker stopped): back to the queue, and the try counts. Values: MAX_TRIES, now. */
export const RECOVER_SQL = "UPDATE push_queue SET state = CASE WHEN tries + 1 >= ? THEN 'failed' ELSE 'queued' END, tries = tries + 1, next_try = 0 WHERE state = 'sending' AND next_try <= ?";

/** A queued message older than its time to live is dropped (a phone must not wake up to old news). Value: now. */
export const EXPIRE_SQL = "UPDATE push_queue SET state = 'expired' WHERE state = 'queued' AND created + ttl * 1000 <= ?";

/** The next messages: breaking first, then the higher score, then the older. Values: now, limit. */
export const NEXT_SQL = "SELECT id FROM push_queue WHERE state = 'queued' AND next_try <= ? ORDER BY CASE urgency WHEN 'high' THEN 0 ELSE 1 END, score DESC, created, id LIMIT ?";

/** Claims one message. It changes one row only if it is still queued, so two runs at the same time never send the same message. Values: lease end, id. */
export const CLAIM_SQL = "UPDATE push_queue SET state = 'sending', next_try = ? WHERE id = ? AND state = 'queued'";

/** The claimed messages with the reader's push data and the post. LEFT JOIN: a deleted reader or post comes back with empty columns. */
export const loadSql = (n) =>
  'SELECT q.id AS id, q.sub_id AS sub_id, q.post_key AS post_key, q.score AS score, q.thread AS thread, q.ttl AS ttl, q.urgency AS urgency, q.tries AS tries, q.created AS created, ' +
  's.endpoint AS endpoint, s.p256dh AS p256dh, s.auth AS auth, s.status AS sub_status, s.tz AS tz, s.failures AS failures, s.paused_until AS paused_until, ' +
  'p.key AS key, p.url AS url, p.title AS title, p.description AS description, p.category AS category, p.tags AS tags, p.focus AS focus, p.author AS author, p.flags AS flags, p.image AS image, p.published_at AS published_at ' +
  `FROM push_queue q LEFT JOIN push_subs s ON s.id = q.sub_id LEFT JOIN push_posts p ON p.key = q.post_key WHERE q.id IN (${marks(n)})`;

/** What these readers were sent lately (the story thread check) or for these posts (the duplicate guard). Values: the reader ids, the earliest time, the post keys. */
export const knownSql = (nSubs, nKeys) => `SELECT sub_id, post_key, thread, ts FROM push_sent WHERE sub_id IN (${marks(nSubs)}) AND (ts >= ? OR post_key IN (${marks(nKeys)}))`;

export const QUEUE_STATE_SQL = 'UPDATE push_queue SET state = ? WHERE id = ?';
/** Back to the queue for a retry. Values: tries to add, the earliest next time, id. */
export const QUEUE_RETRY_SQL = "UPDATE push_queue SET state = 'queued', tries = tries + ?, next_try = ? WHERE id = ?";
export const SENT_SQL = 'INSERT OR IGNORE INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)';
/** A real send uses one slot of the day. The day is the reader's own local day, so the counter starts again at the reader's midnight. Values: day, day, now, id. */
export const COUNT_SQL = 'UPDATE push_subs SET sent_today = CASE WHEN sent_day = ? THEN sent_today + 1 ELSE 1 END, sent_day = ?, last_sent = ?, failures = 0 WHERE id = ?';
/** A story update replaces the old notification and uses no slot and no gap (PLAN 31.7). */
export const RESET_FAILURES_SQL = 'UPDATE push_subs SET failures = 0 WHERE id = ?';
export const COUNT_FAILURE_SQL = 'UPDATE push_subs SET failures = failures + 1 WHERE id = ?';
/** 404, 410 or keys that cannot be used: the reader and everything of the reader is deleted at once (BUGS P5). Same list as the delete button of prefs.js, by id. */
export const DELETE_READER_SQL = [
  'DELETE FROM push_terms WHERE sub_id = ?',
  'DELETE FROM push_queue WHERE sub_id = ?',
  'DELETE FROM push_held WHERE sub_id = ?',
  'DELETE FROM push_sent WHERE sub_id = ?',
  'DELETE FROM push_subs WHERE id = ?',
];

// ---------------------------------------------------------------- decisions (pure)

/** The Topic header: a short fixed hash of the thread, so a push service also replaces a message that was not delivered yet. */
export async function topicOf(thread) {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(thread ?? ''))));
  let bin = '';
  for (const b of digest) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, TOPIC_CHARS);
}

/** The local day of a reader; an unusable zone name counts as UTC (the plan does the same: it never blocks a send). */
export const dayOf = (now, tz) => localDay(now, isValidZone(tz) ? tz : 'UTC');

/**
 * What to do with one claimed message, before anything is sent.
 *   row    one row of loadSql
 *   known  { sent: Map("subId|postKey" -> true), threads: Map("subId|thread" -> latest ts) }
 * Returns { kind: 'expire' }   the reader is gone, paused or failed, or the message is too old: nothing is sent
 *      or { kind: 'done' }     this reader was already sent this post (duplicate guard)
 *      or { kind: 'fail', why } the post is missing or its text cannot be used: never tried again
 *      or { kind: 'send', json, ttl, update }
 */
export function decideRow(row, known, now) {
  if (!row || row.endpoint == null) return { kind: 'expire' };
  if (row.sub_status !== 'active' || (Number(row.failures) || 0) >= MAX_FAILURES || (row.paused_until != null && Number(row.paused_until) > now)) return { kind: 'expire' };
  const ttl = Number(row.ttl) - Math.floor((now - Number(row.created)) / 1000);
  if (!(ttl > 0)) return { kind: 'expire' };
  if (known.sent.has(`${row.sub_id}|${row.post_key}`)) return { kind: 'done' };
  if (row.key == null) return { kind: 'fail', why: 'no_post' };
  const post = postFromRow(row);
  if (!post) return { kind: 'fail', why: 'bad_post' };
  const built = buildPayload(post, { thread: row.thread });
  if (!built.ok) return { kind: 'fail', why: built.reason };
  const last = known.threads.get(`${row.sub_id}|${row.thread}`);
  const update = last !== undefined && now - last < THREAD_HOURS * 3600000;
  return { kind: 'send', json: built.json, ttl, update };
}

/**
 * What the answer of the push service means for the message (LOGICS 19 step 5, PLAN 31.7).
 *   sent                      sent
 *   gone, bad_sub             delete the reader
 *   retry, rate_limited       back to the queue after Retry-After; the batch stops; no try counted, no failure counted
 *   rejected with auth        a key problem of ours: back to the queue after AUTH_WAIT_SEC; the batch stops; nothing counted against the reader
 *   retry (other)             back to the queue, try counted; after MAX_TRIES it fails and the reader gets one failure
 *   rejected (other)          fails at once and the reader gets one failure
 */
export function judgeResult(row, res, now) {
  if (res.ok) return { act: 'sent' };
  if (res.outcome === 'gone' || res.outcome === 'bad_sub') return { act: 'delete' };
  if (res.outcome === 'retry' && res.reason === 'rate_limited') {
    const wait = Number.isFinite(res.retryAfter) && res.retryAfter != null ? res.retryAfter : RETRY_SEC[0];
    return { act: 'wait', until: now + wait * 1000, stop: 'rate_limited' };
  }
  if (res.outcome === 'rejected' && res.auth) return { act: 'wait', until: now + AUTH_WAIT_SEC * 1000, stop: 'auth' };
  if (res.outcome === 'retry') {
    const tries = (Number(row.tries) || 0) + 1;
    if (tries >= MAX_TRIES) return { act: 'fail', countFailure: true };
    const wait = Number.isFinite(res.retryAfter) && res.retryAfter != null ? Math.max(res.retryAfter, RETRY_SEC[tries - 1]) : RETRY_SEC[tries - 1];
    return { act: 'retry', until: now + wait * 1000 };
  }
  return { act: 'fail', countFailure: true };
}

// ---------------------------------------------------------------- the batch

async function pool(items, limit, work, stopped) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      if (stopped()) return;
      const n = next++;
      out[n] = await work(items[n]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return out;
}

/**
 * One batch.
 *   db    { prepare(sql).bind(...).all() / .run(), batch([...]) }
 *   opts  { vapid, subject, fetch?, paused?, batch? }   vapid is what loadVapid gave (vapid.js); paused: true leaves the queue alone (the kill switch, part 7b)
 *   now   ms
 * Returns { ok: true, skipped: 'paused' }
 *      or { ok: false, reason: 'no_keys' }
 *      or { ok: true, recovered, claimed, sent, updates, expired, failed, deleted, retried, released, stopped }
 * A database error while reading goes up and nothing is sent. An error while writing the results goes up too: the claimed messages stay
 * "sending" and are taken back after LEASE_MS (a message may then be sent twice; the tag of the notification makes the second one replace the first).
 */
export async function runSender(db, opts, now) {
  if (opts.paused) return { ok: true, skipped: 'paused' };
  if (!opts.vapid || !opts.subject) return { ok: false, reason: 'no_keys' };
  const limit = Math.max(1, Math.min(Number(opts.batch) || SEND_BATCH, SEND_BATCH));

  const recovered = Number((await db.prepare(RECOVER_SQL).bind(MAX_TRIES, now).run())?.meta?.changes) || 0;
  await db.prepare(EXPIRE_SQL).bind(now).run();

  const ids = rowsOf(await db.prepare(NEXT_SQL).bind(now, limit).all()).map((r) => r.id);
  const summary = { ok: true, recovered, claimed: 0, sent: 0, updates: 0, expired: 0, failed: 0, deleted: 0, retried: 0, released: 0, stopped: null };
  if (!ids.length) return summary;

  const claimed = await db.batch(ids.map((id) => db.prepare(CLAIM_SQL).bind(now + LEASE_MS, id)));
  const mine = ids.filter((_, n) => Number(claimed?.[n]?.meta?.changes) === 1);
  if (!mine.length) return summary;
  summary.claimed = mine.length;

  const rows = rowsOf(await db.prepare(loadSql(mine.length)).bind(...mine).all());
  const subIds = [...new Set(rows.map((r) => r.sub_id))];
  const keys = [...new Set(rows.map((r) => r.post_key))];
  const knownRows = rowsOf(await db.prepare(knownSql(subIds.length, keys.length)).bind(...subIds, now - THREAD_HOURS * 3600000, ...keys).all());
  const known = { sent: new Map(), threads: new Map() };
  for (const k of knownRows) {
    known.sent.set(`${k.sub_id}|${k.post_key}`, true);
    const at = `${k.sub_id}|${k.thread}`;
    const ts = Number(k.ts);
    if (!known.threads.has(at) || known.threads.get(at) < ts) known.threads.set(at, ts);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const work = [];
  const results = [];
  for (const id of mine) {
    const row = byId.get(id);
    if (!row) {
      results.push({ id, act: 'state', state: 'expired' }); // the row vanished between the claim and the read (the reader was deleted)
      continue;
    }
    const d = decideRow(row, known, now);
    if (d.kind === 'expire') results.push({ id, row, act: 'state', state: 'expired' });
    else if (d.kind === 'done') results.push({ id, row, act: 'state', state: 'sent' });
    else if (d.kind === 'fail') results.push({ id, row, act: 'state', state: 'failed' });
    else work.push({ id, row, d });
  }

  let stop = null;
  let waitUntil = 0;
  const sent = await pool(
    work,
    SEND_CONCURRENCY,
    async (w) => {
      const res = await sendPush({ endpoint: w.row.endpoint, p256dh: w.row.p256dh, auth: w.row.auth }, w.d.json, {
        vapid: opts.vapid,
        subject: opts.subject,
        ttl: w.d.ttl,
        urgency: w.row.urgency,
        topic: await topicOf(w.row.thread),
        now,
        fetch: opts.fetch,
      });
      const j = judgeResult(w.row, res, now);
      if (j.stop && !stop) stop = j.stop;
      if (j.stop && j.until > waitUntil) waitUntil = j.until;
      return { ...w, j };
    },
    () => stop !== null,
  );
  work.forEach((w, n) => {
    const r = sent[n];
    if (r) results.push({ id: w.id, row: w.row, d: w.d, ...r.j });
    else results.push({ id: w.id, row: w.row, act: 'release' }); // the batch stopped before this message: give it back unchanged
  });

  const statements = [];
  const st = (sql, ...values) => statements.push(db.prepare(sql).bind(...values));
  for (const r of results) {
    if (r.act === 'state') {
      st(QUEUE_STATE_SQL, r.state, r.id);
      if (r.state === 'expired') summary.expired += 1;
      else if (r.state === 'failed') summary.failed += 1;
    } else if (r.act === 'sent') {
      st(QUEUE_STATE_SQL, 'sent', r.id);
      st(SENT_SQL, r.row.sub_id, r.row.post_key, now, r.row.thread);
      if (r.d.update) {
        st(RESET_FAILURES_SQL, r.row.sub_id);
        summary.updates += 1;
      } else {
        const day = dayOf(now, r.row.tz);
        st(COUNT_SQL, day, day, now, r.row.sub_id);
      }
      summary.sent += 1;
    } else if (r.act === 'delete') {
      for (const sql of DELETE_READER_SQL) st(sql, r.row.sub_id);
      summary.deleted += 1;
    } else if (r.act === 'wait') {
      st(QUEUE_RETRY_SQL, 0, r.until, r.id);
      summary.released += 1;
    } else if (r.act === 'retry') {
      st(QUEUE_RETRY_SQL, 1, r.until, r.id);
      summary.retried += 1;
    } else if (r.act === 'fail') {
      st(QUEUE_STATE_SQL, 'failed', r.id);
      if (r.countFailure) st(COUNT_FAILURE_SQL, r.row.sub_id);
      summary.failed += 1;
    } else if (r.act === 'release') {
      st(QUEUE_RETRY_SQL, 0, waitUntil || now, r.id);
      summary.released += 1;
    }
  }
  for (const part of chunks(statements, RESULT_CHUNK)) await db.batch(part);
  summary.stopped = stop;
  return summary;
}
