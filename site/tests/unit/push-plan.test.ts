import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import * as P from '../../../workers/push/plan.js';
// @ts-ignore plain JS Worker code
import { keywordIndexTerms, cleanKeyword, threadKey, localDay, HOLD_MAX, TTL_SEC } from '../../../workers/push/lib.js';

const NOW = Date.parse('2026-11-16T10:00:00Z');
const MIN = 60000;
const HOUR = 3600000;
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

const postInput = (o: any = {}) => ({
  key: 'phone-launch',
  title: 'A new phone is launched today',
  description: 'The company showed its new phone at an event in the capital this morning.',
  category: 'tech',
  tags: ['phones', 'launch'],
  focus: 'new phone',
  author: 'shivam-das',
  breaking: false,
  featured: false,
  trending: false,
  push: 'auto',
  publishedAt: NOW - 10 * MIN,
  ...o,
});

// ---------------------------------------------------------------- database helpers

function d1(db: any, o: { failAll?: boolean; failBatch?: boolean } = {}) {
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async first() { if (o.failAll) throw new Error('db down'); return db.prepare(sql).get(...this.values) ?? null; },
    async all() {
      if (o.failAll) throw new Error('db down');
      if (this.values.length > 100) throw new Error('too many values for D1');
      return { results: db.prepare(sql).all(...this.values) };
    },
    async run() { const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: mk,
    async batch(statements: any[]) {
      if (o.failBatch) throw new Error('db down');
      db.exec('BEGIN');
      try { const out = []; for (const s of statements) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const freshDb = () => { const db = new Sqlite(':memory:'); db.exec(SCHEMA); return db; };
const count = (db: any, table: string) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

function addPost(db: any, o: any = {}) {
  const p = postInput(o);
  const flags = { breaking: p.breaking, featured: p.featured, trending: p.trending, push: p.push };
  db.prepare('INSERT INTO push_posts (key, url, title, description, category, tags, focus, author, flags, image, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)').run(
    p.key, `https://news.test/${p.key}/`, p.title, p.description, p.category, JSON.stringify(p.tags), p.focus, p.author, o.flagsRaw ?? JSON.stringify(flags), o.publishedRaw ?? p.publishedAt, NOW,
  );
  return p;
}

/** One reader and the push_terms rows the Worker would write. Defaults: balanced, 4 a day, UTC, quiet hours 22:00 to 07:00 (not now at 10:00). */
function addSub(db: any, o: any = {}) {
  const c = (k: string, d: any) => (k in o ? o[k] : d);
  const r = db.prepare(
    `INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, level, daily_limit, tz, quiet_start, quiet_end, breaking_all, breaking_in_quiet,
       learn_on, digest_mode, top_categories, weights, sent_today, sent_day, last_sent, failures, paused_until, status, created, last_seen)
     VALUES (?, ?, 'k', 'a', 't', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `https://push.test/${Math.random()}`, `h${Math.random()}`, c('level', 'balanced'), c('daily_limit', 4), c('tz', 'UTC'), c('quiet_start', 1320), c('quiet_end', 420),
    c('breaking_all', 0), c('breaking_in_quiet', 0), c('learn_on', 0), c('digest_mode', 'off'), c('top_categories', '[]'), c('weights', '{}'),
    c('sent_today', 0), c('sent_day', null), c('last_sent', null), c('failures', 0), c('paused_until', null), c('status', 'active'), NOW, NOW,
  );
  const id = Number(r.lastInsertRowid);
  const add = (kind: string, term: string) => db.prepare('INSERT OR IGNORE INTO push_terms (sub_id, kind, term) VALUES (?, ?, ?)').run(id, kind, term);
  for (const x of o.cats ?? []) add('cat', x);
  for (const x of o.authors ?? []) add('author', x);
  for (const text of o.kws ?? []) {
    const k = cleanKeyword(text);
    add('kw', k.keyword);
    for (const t of keywordIndexTerms(k.keyword)) add('kwtok', t);
  }
  for (const m of o.mutes ?? []) add('mute', cleanKeyword(m).keyword);
  return id;
}
const addSent = (db: any, sub: number, key: string, ts: number, thread: string, category?: string) => {
  if (category !== undefined) db.prepare('INSERT OR IGNORE INTO push_posts (key, url, title, category, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?)').run(key, `https://news.test/${key}/`, 'Old', category, ts, ts);
  db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(sub, key, ts, thread);
};
const queue = (db: any) => db.prepare('SELECT * FROM push_queue ORDER BY sub_id').all();
const held = (db: any) => db.prepare('SELECT * FROM push_held ORDER BY sub_id, post_key').all();

// ---------------------------------------------------------------- pure parts

describe('postFromRow', () => {
  const row = (o: any = {}) => ({ key: 'a-b', url: 'https://news.test/a-b/', title: 'T', description: 'D', category: 'tech', tags: '["x","y"]', focus: 'f', author: 'me', flags: '{"breaking":true,"push":"force","pushTitle":"PT","imageWidth":1600}', image: null, published_at: NOW, ...o });
  it('reads the row into a post', () => {
    expect(P.postFromRow(row())).toMatchObject({ key: 'a-b', category: 'tech', tags: ['x', 'y'], focus: 'f', author: 'me', breaking: true, featured: false, push: 'force', pushTitle: 'PT', pushBody: '', imageWidth: 1600, publishedAt: NOW });
  });
  it('is safe with broken JSON and strange values', () => {
    const p = P.postFromRow(row({ tags: 'nope', flags: 'nope' }));
    expect(p).toMatchObject({ tags: [], breaking: false, push: 'auto' });
    expect(P.postFromRow(row({ flags: '{"push":"maybe","breaking":"yes"}' }))).toMatchObject({ push: 'auto', breaking: false });
  });
  it('returns null for a row that cannot be used', () => {
    for (const r of [null, undefined, {}, row({ key: 5 }), row({ published_at: 'x' }), row({ published_at: 0 })]) expect(P.postFromRow(r as any)).toBeNull();
  });
});

describe('subFromRows', () => {
  const base = (o: any = {}) => ({ id: 7, status: 'active', level: 'balanced', daily_limit: 4, tz: 'UTC', quiet_start: 1320, quiet_end: 420, breaking_all: 1, breaking_in_quiet: 0, learn_on: 0, digest_mode: 'off', top_categories: '["tech"]', weights: '{"tech":0.5}', sent_today: 3, sent_day: '2026-11-16', last_sent: NOW - HOUR, failures: 0, paused_until: null, ...o });
  it('builds the reader with the choices from push_terms', () => {
    const s = P.subFromRows(base(), [{ kind: 'cat', term: 'tech' }, { kind: 'kw', term: 'phon' }, { kind: 'mute', term: 'cricket' }, { kind: 'author', term: 'me' }, { kind: 'kwtok', term: 'phon' }], 0, NOW);
    expect(s).toMatchObject({ id: 7, categories: ['tech'], keywords: ['phon'], muted: ['cricket'], authors: ['me'], topCategories: ['tech'], weights: { tech: 0.5 }, breaking_all: true, learn_on: false, sent_today: 3, last_sent: NOW - HOUR });
  });
  it('the counter of another day is zero, and waiting messages are added', () => {
    expect(P.subFromRows(base({ sent_day: '2026-11-15' }), [], 0, NOW).sent_today).toBe(0);
    expect(P.subFromRows(base({ sent_day: '2026-11-15' }), [], 2, NOW).sent_today).toBe(2);
    expect(P.subFromRows(base(), [], 2, NOW).sent_today).toBe(5);
  });
  it('the local day of the reader decides, not the day in UTC', () => {
    const day = localDay(NOW, 'Pacific/Kiritimati'); // UTC+14: already the next day there
    expect(day).not.toBe('2026-11-16');
    expect(P.subFromRows(base({ tz: 'Pacific/Kiritimati', sent_day: day }), [], 0, NOW).sent_today).toBe(3);
    expect(P.subFromRows(base({ tz: 'Pacific/Kiritimati', sent_day: '2026-11-16' }), [], 0, NOW).sent_today).toBe(0);
  });
  it('is safe with broken JSON, an unknown kind and a null time', () => {
    const s = P.subFromRows(base({ top_categories: 'x', weights: 'x', last_sent: null }), [{ kind: 'weird', term: 'a' }, { kind: 'cat', term: 5 }], undefined, NOW);
    expect(s).toMatchObject({ topCategories: [], weights: {}, last_sent: null, categories: [] });
  });
});

describe('SQL text', () => {
  it('numbers its marks', () => {
    expect(P.loadChoicesSql(3)).toContain('IN (?,?,?)');
    expect(P.loadRecentSql(2)).toContain('IN (?,?) AND s.ts >= ?');
    expect(P.loadPendingSql(1)).toContain("state IN ('queued', 'sending')");
  });
  it('the held statement checks the limit inside itself', () => {
    expect(P.INSERT_HELD_SQL).toContain('< ?');
    expect(P.heldValues('k', { sub_id: 3, score: 50, hours: 6 }, NOW)).toEqual([3, 'k', 50, NOW + 6 * HOUR, 3, NOW, HOLD_MAX]);
    expect(P.queueValues('k', { sub_id: 3, score: 50, thread: 't', ttl: 21600, urgency: 'normal' }, NOW)).toEqual([3, 'k', 50, 't', 21600, 'normal', NOW]);
  });
});

describe('planAudience', () => {
  const sub = (o: any = {}) => ({ id: 1, status: 'active', failures: 0, paused_until: null, level: 'balanced', learn_on: false, breaking_all: false, breaking_in_quiet: false, categories: ['tech'], keywords: ['phon'], muted: [], authors: [], topCategories: [], weights: {}, tz: 'UTC', quiet_start: 1320, quiet_end: 420, daily_limit: 4, digest_mode: 'off', last_sent: null, sent_day: '2026-11-16', sent_today: 0, ...o });
  const run = (subs: any[], p: any = postInput(), recent = new Map()) => P.planAudience(p, subs, recent, NOW);

  it('queues a good match with the thread, ttl and urgency', () => {
    const r = run([sub()]);
    expect(r.queue).toHaveLength(1);
    expect(r.queue[0]).toMatchObject({ sub_id: 1, thread: threadKey(postInput()), ttl: TTL_SEC.normal, urgency: 'normal', update: false });
    expect(r.queue[0].score).toBeGreaterThanOrEqual(48);
    expect(r.held).toEqual([]);
    expect(r.skipped).toEqual({});
    expect(r.considered).toBe(1);
  });
  it('counts every reason a reader is skipped', () => {
    const r = run([
      sub({ id: 1, muted: ['phon'] }),
      sub({ id: 2, categories: ['sports'], keywords: [] }),
      sub({ id: 3, categories: ['tech'], keywords: [] }), // category only: below Balanced
      sub({ id: 4, level: 'breaking_only' }),
      sub({ id: 5, sent_today: 4 }),
      sub({ id: 6, status: 'gone' }),
      sub({ id: 7 }),
    ]);
    expect(r.queue.map((q: any) => q.sub_id)).toEqual([7]);
    expect(r.skipped).toEqual({ muted: 1, no_match: 1, below_level: 1, level_breaking: 1, limit: 1, not_eligible: 1 });
  });
  it('a reader who already got this post is skipped first', () => {
    const recent = new Map([[1, [{ ts: NOW - 5 * MIN, post_key: 'phone-launch', category: 'tech', thread: 'x' }]]]);
    expect(run([sub()], postInput(), recent)).toMatchObject({ queue: [], skipped: { already_sent: 1 } });
  });
  it('a breaking post reaches a breaking_all reader without a category match, with urgency high', () => {
    const r = run([sub({ categories: [], keywords: [], breaking_all: true })], postInput({ breaking: true }));
    expect(r.queue[0]).toMatchObject({ sub_id: 1, urgency: 'high', ttl: TTL_SEC.breaking });
  });
  it('holds inside quiet hours, for 6 hours, and lets breaking news through only when the reader allows it', () => {
    const quiet = { quiet_start: 9 * 60, quiet_end: 11 * 60 }; // 10:00 is inside
    expect(run([sub(quiet)]).held).toEqual([expect.objectContaining({ sub_id: 1, reason: 'quiet', hours: 6 })]);
    const b = postInput({ breaking: true });
    expect(run([sub({ ...quiet })], b).held).toHaveLength(1);
    expect(run([sub({ ...quiet, breaking_in_quiet: true })], b).queue).toHaveLength(1);
  });
  it('holds for the minimum gap and for the digest (12 hours)', () => {
    expect(run([sub({ last_sent: NOW - 10 * MIN })]).held[0]).toMatchObject({ reason: 'gap', hours: 6 });
    expect(run([sub({ digest_mode: 'morning' })]).held[0]).toMatchObject({ reason: 'digest', hours: 12 });
    expect(run([sub({ last_sent: NOW - 10 * MIN })], postInput({ breaking: true })).queue).toHaveLength(1); // breaking has no gap
  });
  it('a story update replaces the old one and ignores the daily limit', () => {
    const thread = threadKey(postInput());
    const recent = new Map([[1, [{ ts: NOW - 2 * HOUR, post_key: 'older-post', category: 'tech', thread }]]]);
    const r = run([sub({ sent_today: 4 })], postInput(), recent);
    expect(r.queue[0]).toMatchObject({ sub_id: 1, update: true, thread });
    const old = new Map([[1, [{ ts: NOW - 13 * HOUR, post_key: 'older-post', category: 'tech', thread }]]]);
    expect(run([sub({ sent_today: 4 })], postInput(), old).skipped).toEqual({ limit: 1 }); // 13 hours: no longer the same story
  });
  it('fatigue lowers the score of a reader who got several stories lately', () => {
    const fresh = run([sub({ level: 'everything' })]).queue[0].score;
    const recent = new Map([[1, [1, 2].map((n) => ({ ts: NOW - n * 20 * MIN - 30 * MIN, post_key: `x${n}`, category: 'tech', thread: `t${n}` }))]]);
    const tired = run([sub({ level: 'everything' })], postInput(), recent).queue[0].score;
    expect(tired).toBeCloseTo(fresh - 20, 5); // two sends in 3 hours (10) and one of the same category in the last hour (10)
  });
  it('the order of the readers does not change who gets what', () => {
    const subs = [sub({ id: 1 }), sub({ id: 2, muted: ['phon'] }), sub({ id: 3, last_sent: NOW - MIN })];
    const a = run(subs);
    const b = run([...subs].reverse());
    expect(a.queue.map((q: any) => q.sub_id).sort()).toEqual(b.queue.map((q: any) => q.sub_id).sort());
    expect(a.held.map((q: any) => q.sub_id)).toEqual(b.held.map((q: any) => q.sub_id));
    expect(a.skipped).toEqual(b.skipped);
  });
  it('handles an empty audience', () => {
    expect(run([])).toEqual({ queue: [], held: [], skipped: {}, considered: 0 });
  });
});

// ---------------------------------------------------------------- the whole step on a real database

withDb('runPlan', () => {
  it('queues for the readers who match, writes the audit row and sends nothing', async () => {
    const db = freshDb();
    addPost(db);
    const a = addSub(db, { cats: ['tech'], kws: ['phones'] });
    addSub(db, { cats: ['sports'] });
    const r = await P.runPlan(d1(db), 'phone-launch', NOW);
    expect(r).toEqual({ ok: true, candidates: 1, truncated: false, queued: 1, held: 0, held_full: 0, skipped: {} });
    expect(queue(db)).toEqual([expect.objectContaining({ sub_id: a, post_key: 'phone-launch', state: 'queued', tries: 0, ttl: 21600, urgency: 'normal', created: NOW, thread: threadKey(postInput()) })]);
    expect(db.prepare('SELECT * FROM push_audit').all()).toEqual([expect.objectContaining({ ts: NOW, who: 'announce', post_key: 'phone-launch', candidates: 1, sent: 1 })]);
    expect(count(db, 'push_sent')).toBe(0);
    expect(db.prepare('SELECT sent_today FROM push_subs WHERE id = ?').get(a).sent_today).toBe(0); // only the sender changes counters
  });
  it('a second call for the same post queues nothing new', async () => {
    const db = freshDb();
    addPost(db);
    addSub(db, { cats: ['tech'], kws: ['phones'] });
    await P.runPlan(d1(db), 'phone-launch', NOW);
    const again = await P.runPlan(d1(db), 'phone-launch', NOW + MIN);
    expect(again.queued).toBe(0);
    expect(count(db, 'push_queue')).toBe(1);
    expect(db.prepare('SELECT sent FROM push_audit ORDER BY id').all().map((x: any) => x.sent)).toEqual([1, 0]);
  });
  it('skips a reader who already got the post', async () => {
    const db = freshDb();
    addPost(db);
    const a = addSub(db, { cats: ['tech'], kws: ['phones'] });
    addSent(db, a, 'phone-launch', NOW - 5 * MIN, 'x');
    expect(await P.runPlan(d1(db), 'phone-launch', NOW)).toMatchObject({ queued: 0, skipped: { already_sent: 1 } });
  });
  it('applies a muted word, the gate and the level', async () => {
    const db = freshDb();
    addPost(db);
    addSub(db, { cats: ['tech'], kws: ['phones'], mutes: ['launch'] });
    addSub(db, { cats: ['tech'] }); // category only: below Balanced
    addSub(db, { cats: ['tech'], level: 'everything' }); // category only but the lowest level: passes
    const r = await P.runPlan(d1(db), 'phone-launch', NOW);
    expect(r).toMatchObject({ candidates: 3, queued: 1, skipped: { muted: 1, below_level: 1 } });
  });
  it('queued messages count against the daily limit (the sender may be slow)', async () => {
    const db = freshDb();
    const a = addSub(db, { cats: ['tech'], kws: ['phones'], daily_limit: 2 });
    for (const k of ['first-story', 'second-story']) db.prepare("INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, urgency, state, tries, created) VALUES (?, ?, 60, ?, 21600, 'normal', 'queued', 0, ?)").run(a, k, k, NOW - 5 * MIN);
    addPost(db);
    expect(await P.runPlan(d1(db), 'phone-launch', NOW)).toMatchObject({ queued: 0, skipped: { limit: 1 } });
    expect(count(db, 'push_queue')).toBe(2);
  });
  it('a sent message of a state other than queued does not count as waiting', async () => {
    const db = freshDb();
    const a = addSub(db, { cats: ['tech'], kws: ['phones'], daily_limit: 2 });
    for (const k of ['first-story', 'second-story']) db.prepare("INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, urgency, state, tries, created) VALUES (?, ?, 60, ?, 21600, 'normal', 'sent', 0, ?)").run(a, k, k, NOW - 5 * MIN);
    addPost(db);
    expect((await P.runPlan(d1(db), 'phone-launch', NOW)).queued).toBe(1);
  });
  it('holds a story in quiet hours and keeps at most HOLD_MAX held stories for a reader', async () => {
    const db = freshDb();
    const a = addSub(db, { cats: ['tech'], kws: ['phones'], quiet_start: 9 * 60, quiet_end: 11 * 60 });
    for (let i = 0; i < HOLD_MAX; i++) db.prepare('INSERT INTO push_held (sub_id, post_key, score, expires) VALUES (?, ?, 50, ?)').run(a, `old-${i}`, NOW + HOUR);
    addPost(db);
    const full = await P.runPlan(d1(db), 'phone-launch', NOW);
    expect(full).toMatchObject({ queued: 0, held: 0, held_full: 1 });
    expect(held(db)).toHaveLength(HOLD_MAX);
    db.prepare('UPDATE push_held SET expires = ? WHERE post_key = ?').run(NOW - 1, 'old-0'); // one has expired: a slot is free
    const free = await P.runPlan(d1(db), 'phone-launch', NOW + MIN);
    expect(free).toMatchObject({ held: 1, held_full: 0 });
    expect(held(db).find((h: any) => h.post_key === 'phone-launch')).toMatchObject({ sub_id: a, expires: NOW + MIN + 6 * HOUR });
  });
  it('holds for the gap and the digest', async () => {
    const db = freshDb();
    addPost(db);
    const gap = addSub(db, { cats: ['tech'], kws: ['phones'], last_sent: NOW - 5 * MIN });
    const dig = addSub(db, { cats: ['tech'], kws: ['phones'], digest_mode: 'both' });
    const r = await P.runPlan(d1(db), 'phone-launch', NOW);
    expect(r).toMatchObject({ queued: 0, held: 2 });
    const rows = held(db);
    expect(rows.find((h: any) => h.sub_id === gap).expires).toBe(NOW + 6 * HOUR);
    expect(rows.find((h: any) => h.sub_id === dig).expires).toBe(NOW + 12 * HOUR);
  });
  it('fatigue uses the category of what was sent before', async () => {
    const db = freshDb();
    addPost(db);
    const a = addSub(db, { cats: ['tech'], kws: ['phones'] });
    addSent(db, a, 'earlier-1', NOW - 40 * MIN, 'other-1', 'tech');
    await P.runPlan(d1(db), 'phone-launch', NOW);
    const withHistory = queue(db)[0].score;
    const db2 = freshDb();
    addPost(db2);
    addSub(db2, { cats: ['tech'], kws: ['phones'] });
    await P.runPlan(d1(db2), 'phone-launch', NOW);
    expect(withHistory).toBeCloseTo(queue(db2)[0].score - 5 - 10, 5); // one send in 3 hours and one of the same category in the last hour
  });
  it('a breaking post goes to a breaking_all reader without a category match, urgency high', async () => {
    const db = freshDb();
    addPost(db, { breaking: true, category: 'world', tags: [], focus: '', author: '', title: 'Big event now', description: '' });
    const a = addSub(db, { breaking_all: 1 });
    expect(await P.runPlan(d1(db), 'phone-launch', NOW)).toMatchObject({ candidates: 1, queued: 1 });
    expect(queue(db)[0]).toMatchObject({ sub_id: a, urgency: 'high', ttl: TTL_SEC.breaking });
  });
  it('a story update is queued even when the daily limit is reached', async () => {
    const db = freshDb();
    addPost(db);
    const a = addSub(db, { cats: ['tech'], kws: ['phones'], sent_today: 4, sent_day: '2026-11-16' });
    addSent(db, a, 'older-post', NOW - 2 * HOUR, threadKey(postInput()), 'tech');
    expect((await P.runPlan(d1(db), 'phone-launch', NOW)).queued).toBe(1);
  });
  it('never queues paused, failed or gone readers', async () => {
    const db = freshDb();
    addPost(db);
    addSub(db, { cats: ['tech'], kws: ['phones'], status: 'paused' });
    addSub(db, { cats: ['tech'], kws: ['phones'], failures: 5 });
    addSub(db, { cats: ['tech'], kws: ['phones'], paused_until: NOW + HOUR });
    expect(await P.runPlan(d1(db), 'phone-launch', NOW)).toMatchObject({ candidates: 0, queued: 0 });
  });
  it('works for more readers than one chunk and one batch', async () => {
    const db = freshDb();
    addPost(db);
    db.exec('BEGIN');
    for (let i = 0; i < 150; i++) addSub(db, { cats: ['tech'], kws: ['phones'] });
    db.exec('COMMIT');
    const r = await P.runPlan(d1(db), 'phone-launch', NOW);
    expect(r).toMatchObject({ candidates: 150, queued: 150, truncated: false });
    expect(count(db, 'push_queue')).toBe(150);
    expect(db.prepare('SELECT candidates, sent FROM push_audit').get()).toEqual({ candidates: 150, sent: 150 });
  });
  it('answers for a missing or unusable post and writes nothing', async () => {
    const db = freshDb();
    addSub(db, { cats: ['tech'] });
    expect(await P.runPlan(d1(db), 'nothing-here', NOW)).toEqual({ ok: false, reason: 'no_post' });
    addPost(db, { key: 'broken', publishedRaw: 0 });
    expect(await P.runPlan(d1(db), 'broken', NOW)).toEqual({ ok: false, reason: 'bad_post' });
    for (const t of ['push_queue', 'push_held', 'push_audit']) expect(count(db, t), t).toBe(0);
  });
  it('a database error while reading goes up and nothing is written', async () => {
    const db = freshDb();
    addPost(db);
    addSub(db, { cats: ['tech'], kws: ['phones'] });
    await expect(P.runPlan(d1(db, { failAll: true }), 'phone-launch', NOW)).rejects.toThrow('db down');
    for (const t of ['push_queue', 'push_held', 'push_audit']) expect(count(db, t), t).toBe(0);
  });
  it('a database error while writing goes up and the queue stays empty', async () => {
    const db = freshDb();
    addPost(db);
    addSub(db, { cats: ['tech'], kws: ['phones'] });
    await expect(P.runPlan(d1(db, { failBatch: true }), 'phone-launch', NOW)).rejects.toThrow('db down');
    expect(count(db, 'push_queue')).toBe(0);
    expect(count(db, 'push_audit')).toBe(0);
  });
  it('never reads the push address or the keys', () => {
    const all = [P.LOAD_POST_SQL, P.loadChoicesSql(1), P.loadRecentSql(1), P.loadPendingSql(1)].join(' ');
    expect(all).not.toMatch(/endpoint|p256dh|token_hash|auth\b/);
  });
});
