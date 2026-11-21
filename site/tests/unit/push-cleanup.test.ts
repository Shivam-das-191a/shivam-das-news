import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as K from '../../../workers/push/cleanup.js';
// @ts-ignore plain JS Worker code
import * as C from '../../../workers/push/control.js';

const DAY = 86400000;
const HOUR = 3600000;
// 2026-11-16 10:07:00 UTC: minute 7, the clean-up minute.
const NOW = Date.parse('2026-11-16T10:07:00Z');
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

/** D1-like object over node:sqlite. failWhen makes any statement whose text matches throw. */
function d1(db: any, o: { failWhen?: (sql: string) => boolean } = {}) {
  const guard = (sql: string) => { if (o.failWhen && o.failWhen(sql)) throw new Error('db down'); };
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async first() { guard(sql); return db.prepare(sql).get(...this.values) ?? null; },
    async all() { guard(sql); return { results: db.prepare(sql).all(...this.values) }; },
    async run() { guard(sql); return this.raw(); },
    raw() { guard(sql); const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: mk,
    async batch(statements: any[]) {
      db.exec('BEGIN');
      try { const out = statements.map((s) => s.raw()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

const freshDb = () => { const db = new Sqlite(':memory:'); db.exec(SCHEMA); return db; };
const count = (db: any, table: string) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
let counter = 0;

function addReader(db: any, o: { lastSeen?: number; lastSent?: number | null; status?: string } = {}) {
  counter += 1;
  const r = db.prepare(
    `INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, status, created, last_seen, last_sent)
     VALUES (?, ?, 'k', 'a', 't', ?, ?, ?, ?)`,
  ).run(`https://push.test/send/secret-${counter}`, `h${counter}`, o.status ?? 'active', NOW - 200 * DAY, o.lastSeen ?? NOW - HOUR, o.lastSent ?? null);
  const id = Number(r.lastInsertRowid);
  db.prepare(`INSERT INTO push_terms (sub_id, kind, term) VALUES (?, 'cat', 'tech')`).run(id);
  db.prepare(`INSERT INTO push_held (sub_id, post_key, score, expires) VALUES (?, 'p', 50, ?)`).run(id, NOW + HOUR);
  db.prepare(`INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, 'p', ?, 't')`).run(id, NOW - HOUR);
  db.prepare(`INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, state, created) VALUES (?, 'p', 50, 't', 3600, 'queued', ?)`).run(id, NOW - HOUR);
  return id;
}
const exists = (db: any, id: number) => db.prepare('SELECT 1 AS x FROM push_subs WHERE id = ?').get(id) != null;
const rowsOf = (db: any, table: string, id: number) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE sub_id = ?`).get(id).n;

describe('cleanupDue', () => {
  it('is true only at minute 7 of the hour (UTC)', () => {
    expect(K.cleanupDue(NOW)).toBe(true);
    expect(K.cleanupDue(NOW + 60000)).toBe(false);
    expect(K.cleanupDue(NOW - 7 * 60000)).toBe(false);
    expect(K.cleanupDue(NOW + 5 * HOUR)).toBe(true);
  });
  it('is false for a missing, zero, negative or junk time', () => {
    for (const v of [undefined, null, 0, -5, NaN, 'abc', {}]) expect(K.cleanupDue(v as any)).toBe(false);
  });
});

describe('runCleanup without a good start', () => {
  it('answers no_db and bad_time and does not throw', async () => {
    expect(await K.runCleanup(null, NOW)).toEqual({ ok: false, reason: 'no_db' });
    expect(await K.runCleanup({}, NOW)).toEqual({ ok: false, reason: 'no_db' });
    const db = d1(freshDb());
    expect(await K.runCleanup(db, 0)).toEqual({ ok: false, reason: 'bad_time' });
    expect(await K.runCleanup(db, NaN)).toEqual({ ok: false, reason: 'bad_time' });
  });
  it('does nothing and answers zeros on an empty database', async () => {
    const r = await K.runCleanup(d1(freshDb()), NOW);
    expect(r).toEqual({ ok: true, readers: 0, sent: 0, audit: 0, posts: 0, held: 0, queue: 0, terms: 0 });
  });
});

withDb('readers (PLAN 31.3: 90 days, gone at once)', () => {
  it('deletes a reader never sent to and not seen for 91 days, with every row of theirs', async () => {
    const raw = freshDb();
    const old = addReader(raw, { lastSeen: NOW - 91 * DAY });
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.ok).toBe(true);
    expect(r.readers).toBe(1);
    expect(exists(raw, old)).toBe(false);
    for (const t of ['push_terms', 'push_held', 'push_sent', 'push_queue']) expect(rowsOf(raw, t, old)).toBe(0);
  });
  it('keeps a reader seen 89 days ago', async () => {
    const raw = freshDb();
    const id = addReader(raw, { lastSeen: NOW - 89 * DAY });
    await K.runCleanup(d1(raw), NOW);
    expect(exists(raw, id)).toBe(true);
    expect(rowsOf(raw, 'push_terms', id)).toBe(1);
  });
  it('keeps a reader who did not visit for 120 days but got a delivery 10 days ago', async () => {
    const raw = freshDb();
    const id = addReader(raw, { lastSeen: NOW - 120 * DAY, lastSent: NOW - 10 * DAY });
    await K.runCleanup(d1(raw), NOW);
    expect(exists(raw, id)).toBe(true);
  });
  it('deletes a reader with an old visit and an old delivery', async () => {
    const raw = freshDb();
    const id = addReader(raw, { lastSeen: NOW - 120 * DAY, lastSent: NOW - 100 * DAY });
    await K.runCleanup(d1(raw), NOW);
    expect(exists(raw, id)).toBe(false);
  });
  it('deletes a reader marked gone at once, even one seen a minute ago', async () => {
    const raw = freshDb();
    const gone = addReader(raw, { status: 'gone', lastSeen: NOW - 60000 });
    const live = addReader(raw);
    await K.runCleanup(d1(raw), NOW);
    expect(exists(raw, gone)).toBe(false);
    expect(exists(raw, live)).toBe(true);
    expect(rowsOf(raw, 'push_terms', live)).toBe(1);
  });
  it('takes at most READERS_PER_RUN readers per run and the next run continues', async () => {
    const raw = freshDb();
    for (let i = 0; i < K.READERS_PER_RUN + 10; i += 1) addReader(raw, { status: 'gone' });
    const db = d1(raw);
    expect((await K.runCleanup(db, NOW)).readers).toBe(K.READERS_PER_RUN);
    expect(count(raw, 'push_subs')).toBe(10);
    expect((await K.runCleanup(db, NOW)).readers).toBe(10);
    expect(count(raw, 'push_subs')).toBe(0);
    expect(count(raw, 'push_terms')).toBe(0);
  });
  it('is all or nothing for one chunk: a failing last delete leaves the reader and all rows of theirs', async () => {
    const raw = freshDb();
    const id = addReader(raw, { status: 'gone' });
    const r = await K.runCleanup(d1(raw, { failWhen: (s) => s.startsWith('DELETE FROM push_subs') }), NOW);
    expect(r).toEqual({ ok: false, reason: 'error' });
    expect(exists(raw, id)).toBe(true);
    for (const t of ['push_terms', 'push_held', 'push_sent', 'push_queue']) expect(rowsOf(raw, t, id)).toBe(1);
  });
});

withDb('old rows by table (30, 30, 3 days, expired, 1 day)', () => {
  it('push_sent: 30 days', async () => {
    const raw = freshDb();
    const id = addReader(raw);
    raw.prepare(`DELETE FROM push_sent`).run();
    raw.prepare(`INSERT INTO push_sent VALUES (?, 'old', ?, 't')`).run(id, NOW - 31 * DAY);
    raw.prepare(`INSERT INTO push_sent VALUES (?, 'new', ?, 't')`).run(id, NOW - 29 * DAY);
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.sent).toBe(1);
    expect(raw.prepare(`SELECT post_key FROM push_sent`).all().map((x: any) => x.post_key)).toEqual(['new']);
  });
  it('push_audit: 30 days', async () => {
    const raw = freshDb();
    const ins = raw.prepare(`INSERT INTO push_audit (ts, who, post_key) VALUES (?, 'action', 'k')`);
    ins.run(NOW - 31 * DAY); ins.run(NOW - 31 * DAY); ins.run(NOW - DAY);
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.audit).toBe(2);
    expect(count(raw, 'push_audit')).toBe(1);
  });
  it('push_posts: 3 days', async () => {
    const raw = freshDb();
    const ins = raw.prepare(`INSERT INTO push_posts (key, url, title, published_at, announced_at) VALUES (?, 'u', 't', 0, ?)`);
    ins.run('old', NOW - 4 * DAY); ins.run('new', NOW - 2 * DAY);
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.posts).toBe(1);
    expect(raw.prepare(`SELECT key FROM push_posts`).all().map((x: any) => x.key)).toEqual(['new']);
  });
  it('push_held: only the expired ones', async () => {
    const raw = freshDb();
    const ins = raw.prepare(`INSERT INTO push_held VALUES (?, ?, 50, ?)`);
    ins.run(1, 'a', NOW - 1); ins.run(1, 'b', NOW + 1);
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.held).toBe(1);
    expect(raw.prepare(`SELECT post_key FROM push_held`).all().map((x: any) => x.post_key)).toEqual(['b']);
  });
  it('push_queue: finished rows older than 1 day go; queued and sending rows stay however old', async () => {
    const raw = freshDb();
    const ins = raw.prepare(`INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, state, created) VALUES (1, ?, 50, 't', 60, ?, ?)`);
    ins.run('s-old', 'sent', NOW - 2 * DAY);
    ins.run('f-old', 'failed', NOW - 2 * DAY);
    ins.run('e-old', 'expired', NOW - 2 * DAY);
    ins.run('s-new', 'sent', NOW - HOUR);
    ins.run('q-old', 'queued', NOW - 9 * DAY);
    ins.run('g-old', 'sending', NOW - 9 * DAY);
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.queue).toBe(3);
    expect(raw.prepare(`SELECT post_key FROM push_queue ORDER BY post_key`).all().map((x: any) => x.post_key)).toEqual(['g-old', 'q-old', 's-new']);
  });
  it('push_terms of a reader who is not there are removed; others stay', async () => {
    const raw = freshDb();
    const id = addReader(raw);
    raw.prepare(`INSERT INTO push_terms VALUES (9999, 'kw', 'orphan')`).run();
    const r = await K.runCleanup(d1(raw), NOW);
    expect(r.terms).toBe(1);
    expect(rowsOf(raw, 'push_terms', id)).toBe(1);
    expect(rowsOf(raw, 'push_terms', 9999)).toBe(0);
  });
  it('a second run right after deletes nothing more', async () => {
    const raw = freshDb();
    addReader(raw, { status: 'gone' });
    raw.prepare(`INSERT INTO push_audit (ts, who, post_key) VALUES (?, 'action', 'k')`).run(NOW - 40 * DAY);
    const db = d1(raw);
    await K.runCleanup(db, NOW);
    expect(await K.runCleanup(db, NOW)).toEqual({ ok: true, readers: 0, sent: 0, audit: 0, posts: 0, held: 0, queue: 0, terms: 0 });
  });
  it('a failing database gives ok false, never throws, and the answer holds no address or key', async () => {
    const raw = freshDb();
    addReader(raw, { status: 'gone' });
    const r = await K.runCleanup(d1(raw, { failWhen: () => true }), NOW);
    expect(r).toEqual({ ok: false, reason: 'error' });
    const ok = await K.runCleanup(d1(raw), NOW);
    expect(JSON.stringify(ok)).not.toMatch(/push\.test|secret-|https?:/);
  });
});

describe('runCleanupTick (control.js)', () => {
  it('says no_db without a database and not_due outside minute 7', async () => {
    expect(await C.runCleanupTick({}, NOW)).toEqual({ ran: false, reason: 'no_db' });
    expect(await C.runCleanupTick(undefined, NOW)).toEqual({ ran: false, reason: 'no_db' });
    expect(await C.runCleanupTick({ DB: {} }, NOW + 60000)).toEqual({ ran: false, reason: 'not_due' });
  });
  it('wraps a database that throws in ok false', async () => {
    const env = { DB: { prepare() { throw new Error('boom'); } } };
    const r = await C.runCleanupTick(env, NOW);
    expect(r.ran).toBe(true);
    expect(r.ok).toBe(false);
  });
});

withDb('the scheduled handler', () => {
  it('cleans at minute 7 even when sending is paused and there are no sender keys', async () => {
    const raw = freshDb();
    const gone = addReader(raw, { status: 'gone' });
    const env = { DB: d1(raw), PUSH_PAUSED: 'true' };
    await worker.scheduled({ scheduledTime: NOW }, env, undefined, async () => { throw new Error('no network'); });
    expect(exists(raw, gone)).toBe(false);
  });
  it('does nothing at another minute', async () => {
    const raw = freshDb();
    const gone = addReader(raw, { status: 'gone' });
    await worker.scheduled({ scheduledTime: NOW + 60000 }, { DB: d1(raw) }, undefined, async () => { throw new Error('no network'); });
    expect(exists(raw, gone)).toBe(true);
  });
  it('does nothing when the event has no time of its own', async () => {
    const raw = freshDb();
    const gone = addReader(raw, { status: 'gone' });
    await worker.scheduled({}, { DB: d1(raw) }, undefined, async () => { throw new Error('no network'); });
    await worker.scheduled(undefined, { DB: d1(raw) }, undefined, async () => { throw new Error('no network'); });
    expect(exists(raw, gone)).toBe(true);
  });
  it('never throws with a broken database', async () => {
    const raw = freshDb();
    const env = { DB: d1(raw, { failWhen: () => true }) };
    await expect(worker.scheduled({ scheduledTime: NOW }, env, undefined, async () => { throw new Error('x'); })).resolves.toBeUndefined();
  });
});
