// Push clean-up (Cloudflare Worker, v0.83.0, Phase 9 part 7c; PLAN 31.3 "Retention", 31.7, 31.10).
// Deletes old rows so the free D1 database stays small and the privacy promises of PLAN 31.3 are kept:
//   - a reader with no delivery and no visit for 90 days is deleted, with every row that belongs to them (a reader marked "gone" at once);
//   - delivery rows (push_sent) and audit rows (push_audit) older than 30 days;
//   - announced post summaries (push_posts) older than 3 days;
//   - held stories (push_held) that have expired;
//   - finished queue rows (sent, failed, expired) older than 1 day; queued and sending rows are never touched here;
//   - search words (push_terms) of a reader who no longer exists.
// Every delete takes at most a fixed number of rows per run, so one run is short; the next hour continues.
// It needs only the database: it runs even when sending is paused or the sender keys are missing, because keeping data longer than promised is worse than a pause.
// It never throws, never logs, and the answer holds counts only (no push address, no key, no text).

export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;
export const RETENTION = {
  readerDays: 90, // no delivery and no visit
  sentDays: 30, // push_sent
  auditDays: 30, // push_audit
  postDays: 3, // push_posts
  queueDoneDays: 1, // finished rows of push_queue
};
export const CLEANUP_MINUTE = 7; // runs once an hour, when the UTC minute is this one
export const ROWS_PER_RUN = 2000; // for each simple table
export const READERS_PER_RUN = 50; // D1 allows about 100 bound values in one statement, so 50 readers fit in one IN list

/** true when this minute is the hourly clean-up minute (UTC). A bad time gives false. */
export function cleanupDue(now) {
  const t = Number(now);
  if (!Number.isFinite(t) || t <= 0) return false;
  return new Date(t).getUTCMinutes() === CLEANUP_MINUTE;
}

const changes = (r) => {
  const n = r && r.meta ? Number(r.meta.changes) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Runs the clean-up once. Returns { ok: true, readers, sent, audit, posts, held, queue, terms } (rows deleted), or { ok: false, reason }.
 * 'no_db' when there is no database; 'error' when the database failed (the next hour tries again, nothing is half deleted for one reader: see below).
 */
export async function runCleanup(db, now) {
  if (!db || typeof db.prepare !== 'function') return { ok: false, reason: 'no_db' };
  const t = Number(now);
  if (!Number.isFinite(t) || t <= 0) return { ok: false, reason: 'bad_time' };
  try {
    const out = { ok: true, readers: 0, sent: 0, audit: 0, posts: 0, held: 0, queue: 0, terms: 0 };
    const limit = ROWS_PER_RUN;

    // 1. Readers first, with everything that belongs to them, in ONE batch (all or nothing for the chunk).
    const readerCut = t - RETENTION.readerDays * DAY_MS;
    const found = await db
      .prepare(
        `SELECT id FROM push_subs
         WHERE status = 'gone' OR (last_seen < ? AND (last_sent IS NULL OR last_sent < ?))
         ORDER BY id LIMIT ?`,
      )
      .bind(readerCut, readerCut, READERS_PER_RUN)
      .all();
    const ids = ((found && found.results) || []).map((r) => Number(r.id)).filter((n) => Number.isInteger(n));
    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const del = (table, col) => db.prepare(`DELETE FROM ${table} WHERE ${col} IN (${marks})`).bind(...ids);
      const res = await db.batch([
        del('push_terms', 'sub_id'),
        del('push_queue', 'sub_id'),
        del('push_held', 'sub_id'),
        del('push_sent', 'sub_id'),
        del('push_subs', 'id'),
      ]);
      out.readers = changes(res && res[4]);
    }

    // 2. Simple tables, each limited. The inner SELECT keeps the delete short.
    const simple = [
      ['sent', `DELETE FROM push_sent WHERE rowid IN (SELECT rowid FROM push_sent WHERE ts < ? LIMIT ?)`, t - RETENTION.sentDays * DAY_MS],
      ['audit', `DELETE FROM push_audit WHERE id IN (SELECT id FROM push_audit WHERE ts < ? LIMIT ?)`, t - RETENTION.auditDays * DAY_MS],
      ['posts', `DELETE FROM push_posts WHERE id IN (SELECT id FROM push_posts WHERE announced_at < ? LIMIT ?)`, t - RETENTION.postDays * DAY_MS],
      ['held', `DELETE FROM push_held WHERE rowid IN (SELECT rowid FROM push_held WHERE expires < ? LIMIT ?)`, t],
      [
        'queue',
        `DELETE FROM push_queue WHERE id IN (SELECT id FROM push_queue WHERE state IN ('sent','failed','expired') AND created < ? LIMIT ?)`,
        t - RETENTION.queueDoneDays * DAY_MS,
      ],
    ];
    for (const [name, sql, cut] of simple) {
      out[name] = changes(await db.prepare(sql).bind(cut, limit).run());
    }

    // 3. Search words whose reader is gone (a safety net: step 1 removes them with the reader).
    out.terms = changes(
      await db
        .prepare(
          `DELETE FROM push_terms WHERE rowid IN (SELECT rowid FROM push_terms WHERE sub_id NOT IN (SELECT id FROM push_subs) LIMIT ?)`,
        )
        .bind(limit)
        .run(),
    );
    return out;
  } catch {
    return { ok: false, reason: 'error' };
  }
}
