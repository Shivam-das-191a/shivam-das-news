import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createECDH, randomBytes } from 'node:crypto';
// @ts-ignore plain JS Worker code
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as C from '../../../workers/push/control.js';
// @ts-ignore plain JS Worker code
import * as V from '../../../workers/push/vapid.js';

const SITE = 'https://news.test';
const SECRET = 's'.repeat(40);
const NOW = Date.parse('2026-11-16T10:00:00Z');
const MIN = 60000;
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

afterEach(() => vi.useRealTimers());
function at() { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); }

// ---------------------------------------------------------------- helpers

/** D1-like object over node:sqlite. failWhen makes any statement whose text matches throw. */
function d1(db: any, o: { failWhen?: (sql: string) => boolean } = {}) {
  const guard = (sql: string) => { if (o.failWhen && o.failWhen(sql)) throw new Error('db down'); };
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async first() { guard(sql); return db.prepare(sql).get(...this.values) ?? null; },
    async all() { guard(sql); return { results: db.prepare(sql).all(...this.values) }; },
    async run() { guard(sql); return this.raw(); },
    raw() { const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
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
const b64 = (u: Uint8Array | Buffer) => Buffer.from(u).toString('base64url');
let counter = 0;

/** One reader who wants all breaking news. A real browser key pair, so the message can be encrypted. */
function addReader(db: any, o: any = {}) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  counter += 1;
  const r = db.prepare(
    `INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, level, daily_limit, tz, quiet_start, quiet_end, breaking_all, breaking_in_quiet,
       learn_on, digest_mode, top_categories, weights, sent_today, sent_day, last_sent, failures, paused_until, status, created, last_seen)
     VALUES (?, ?, ?, ?, 't', 'balanced', 4, 'UTC', 1320, 420, 1, 0, 0, 'off', '[]', '{}', 0, NULL, NULL, 0, NULL, 'active', ?, ?)`,
  ).run(`https://push.test/send/secret-${counter}`, `h${counter}`, b64(ecdh.getPublicKey()), b64(randomBytes(16)), NOW - 1000, NOW - 1000);
  return Number(r.lastInsertRowid);
}

const announced = (o: any = {}) => ({
  key: 'phone-launch',
  url: `${SITE}/2026/11/16/blogs/tech/phone-launch/`,
  title: 'A new phone is launched today',
  description: 'The company showed its new phone at an event in the capital this morning.',
  category: 'tech',
  tags: ['phones'],
  focus: 'new phone',
  author: 'shivam-das',
  breaking: true,
  publishedAt: new Date(NOW - 10 * MIN).toISOString(),
  ...o,
});

/** Writes a post row like /announce does, for the tests that call the plan directly. */
function addPost(db: any, key: string, breaking = true) {
  db.prepare('INSERT INTO push_posts (key, url, title, description, category, tags, focus, author, flags, image, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)').run(
    key, `${SITE}/${key}/`, `Headline of ${key}`, 'A short description of the story.', 'tech', '[]', '', 'shivam-das', JSON.stringify({ breaking, push: 'auto' }), NOW - 10 * MIN, NOW,
  );
}

/** A fake that answers the live check of /announce with a page, and every other address like a push service. */
function network() {
  const push: { url: string; headers: any }[] = [];
  const fetch = async (url: string, init: any) => {
    if (String(url).startsWith(SITE)) return new Response('<!doctype html><html><head><title>x</title></head><body></body></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    push.push({ url, headers: init.headers });
    return { status: 201, headers: new Headers(), body: null };
  };
  return { push, fetch };
}

let keys: { privateKey: string; publicKey: string };
beforeAll(async () => { keys = await V.generateVapidKeys(); });
const ready = (db: any, extra: any = {}) => ({
  SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: d1(db), VAPID_PRIVATE_KEY: keys.privateKey, VAPID_PUBLIC_KEY: keys.publicKey, VAPID_SUBJECT: 'mailto:owner@news.test', ...extra,
});

// ---------------------------------------------------------------- the switch

describe('the kill switch', () => {
  it('pauses for true, 1, yes and on in any case, with spaces', () => {
    for (const v of ['true', 'TRUE', ' 1 ', 'Yes', 'on', 'ON']) expect(C.isPaused({ PUSH_PAUSED: v }), v).toBe(true);
  });
  it('does not pause for false, 0, empty, missing or any other word', () => {
    for (const v of ['false', '0', '', 'no', 'off', 'paused', undefined, null]) expect(C.isPaused({ PUSH_PAUSED: v }), String(v)).toBe(false);
    expect(C.isPaused({})).toBe(false);
    expect(C.isPaused(undefined)).toBe(false);
  });
});

withDb('sendingState', () => {
  it('reports the first problem: no database, then the pause, then the keys', async () => {
    const db = freshDb();
    expect(await C.sendingState({})).toEqual({ ready: false, reason: 'no_db' });
    expect(await C.sendingState(undefined)).toEqual({ ready: false, reason: 'no_db' });
    expect(await C.sendingState(ready(db, { PUSH_PAUSED: 'true' }))).toEqual({ ready: false, reason: 'paused' });
    expect(await C.sendingState({ DB: d1(db) })).toEqual({ ready: false, reason: 'no_keys' });
  });
  it('is not ready with a wrong private key, a key of another pair or a bad contact address', async () => {
    const db = freshDb();
    const other = await V.generateVapidKeys();
    expect((await C.sendingState(ready(db, { VAPID_PRIVATE_KEY: 'not-a-key' }))).reason).toBe('no_keys');
    expect((await C.sendingState(ready(db, { VAPID_PRIVATE_KEY: other.privateKey }))).reason).toBe('no_keys');
    expect((await C.sendingState(ready(db, { VAPID_SUBJECT: 'owner@news.test' }))).reason).toBe('no_keys');
    expect((await C.sendingState(ready(db, { VAPID_SUBJECT: undefined }))).reason).toBe('no_keys');
  });
  it('is ready with the database, the keys and no pause', async () => {
    const s = await C.sendingState(ready(freshDb(), { PUSH_PAUSED: 'false' }));
    expect(s.ready).toBe(true);
    expect(s.subject).toBe('mailto:owner@news.test');
    expect(s.vapid).toBeTruthy();
  });
});

// ---------------------------------------------------------------- planning

withDb('planAccepted', () => {
  it('plans nothing for an empty or a bad list', async () => {
    const db = freshDb();
    for (const k of [[], undefined, null, 'x', [''], [5]]) expect(await C.planAccepted(ready(db), k as any, NOW), JSON.stringify(k)).toEqual({ ran: false, reason: 'no_posts' });
  });
  it('plans nothing and queues nothing when sending is not ready (no keys, a pause, no database)', async () => {
    const db = freshDb();
    addPost(db, 'story-one');
    addReader(db);
    expect(await C.planAccepted({ DB: d1(db) }, ['story-one'], NOW)).toEqual({ ran: false, reason: 'no_keys' });
    expect(await C.planAccepted(ready(db, { PUSH_PAUSED: 'true' }), ['story-one'], NOW)).toEqual({ ran: false, reason: 'paused' });
    expect(await C.planAccepted({}, ['story-one'], NOW)).toEqual({ ran: false, reason: 'no_db' });
    expect(count(db, 'push_queue')).toBe(0);
    expect(count(db, 'push_audit')).toBe(0);
  });
  it('queues one message for a reader who wants breaking news, and writes the audit row', async () => {
    const db = freshDb();
    addPost(db, 'story-one');
    const id = addReader(db);
    const r = await C.planAccepted(ready(db), ['story-one'], NOW);
    expect(r).toEqual({ ran: true, planned: 1, queued: 1, held: 0, errors: 0, left: 0 });
    const q = db.prepare('SELECT * FROM push_queue').all();
    expect(q.length).toBe(1);
    expect(q[0]).toMatchObject({ sub_id: id, post_key: 'story-one', state: 'queued', urgency: 'high' });
    expect(count(db, 'push_audit')).toBe(1);
  });
  it('a post that is not recorded is counted as an error and the others still go on', async () => {
    const db = freshDb();
    addPost(db, 'story-one');
    addReader(db);
    const r = await C.planAccepted(ready(db), ['missing-one', 'story-one'], NOW);
    expect(r).toMatchObject({ ran: true, planned: 1, queued: 1, errors: 1 });
  });
  it('a database error inside one plan is counted, never thrown', async () => {
    const db = freshDb();
    addPost(db, 'story-one');
    addReader(db);
    const env = ready(db);
    env.DB = d1(db, { failWhen: (sql) => /push_terms/.test(sql) });
    const r = await C.planAccepted(env, ['story-one'], NOW);
    expect(r).toMatchObject({ ran: true, planned: 0, errors: 1 });
    expect(count(db, 'push_queue')).toBe(0);
  });
  it('plans at most PLAN_MAX_POSTS posts in one call and says how many were left', async () => {
    const db = freshDb();
    const names = Array.from({ length: C.PLAN_MAX_POSTS + 2 }, (_, i) => `story-${i}`);
    names.forEach((n) => addPost(db, n));
    const r = await C.planAccepted(ready(db), names, NOW);
    expect(r.planned + r.errors).toBe(C.PLAN_MAX_POSTS);
    expect(r.left).toBe(2);
  });
  it('the answer holds counts only', async () => {
    const db = freshDb();
    addPost(db, 'story-one');
    addReader(db);
    const text = JSON.stringify(await C.planAccepted(ready(db), ['story-one'], NOW));
    expect(text).not.toMatch(/push\.test|secret-|Headline|news\.test|VAPID/);
  });
});

// ---------------------------------------------------------------- the cron tick

withDb('runCron', () => {
  function queued(db: any) {
    addPost(db, 'story-one');
    const sub = addReader(db);
    db.prepare("INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, urgency, state, tries, created, next_try) VALUES (?, 'story-one', 60, 'story-one', 21600, 'normal', 'queued', 0, ?, 0)").run(sub, NOW - 5 * MIN);
    return sub;
  }
  it('is a quiet skip, not an error, when sending is not ready', async () => {
    const db = freshDb();
    queued(db);
    const net = network();
    expect(await C.runCron({ DB: d1(db) }, NOW, net.fetch)).toEqual({ ok: true, skipped: 'no_keys' });
    expect(await C.runCron(ready(db, { PUSH_PAUSED: '1' }), NOW, net.fetch)).toEqual({ ok: true, skipped: 'paused' });
    expect(await C.runCron({}, NOW, net.fetch)).toEqual({ ok: true, skipped: 'no_db' });
    expect(net.push.length).toBe(0);
    expect(db.prepare('SELECT state FROM push_queue').get().state).toBe('queued');
  });
  it('sends one batch and marks the message sent', async () => {
    const db = freshDb();
    queued(db);
    const net = network();
    const r = await C.runCron(ready(db), NOW, net.fetch);
    expect(r).toMatchObject({ ok: true, claimed: 1, sent: 1 });
    expect(net.push.length).toBe(1);
    expect(net.push[0].url).toMatch(/^https:\/\/push\.test\/send\/secret-/);
    expect(db.prepare('SELECT state FROM push_queue').get().state).toBe('sent');
    expect(count(db, 'push_sent')).toBe(1);
  });
  it('an empty queue is a normal tick', async () => {
    const db = freshDb();
    const net = network();
    expect(await C.runCron(ready(db), NOW, net.fetch)).toMatchObject({ ok: true, claimed: 0, sent: 0 });
    expect(net.push.length).toBe(0);
  });
  it('a database error is answered as { ok: false, reason: "error" } and never thrown', async () => {
    const db = freshDb();
    queued(db);
    const env = ready(db);
    env.DB = d1(db, { failWhen: (sql) => /^SELECT id FROM push_queue/.test(sql) });
    expect(await C.runCron(env, NOW, network().fetch)).toEqual({ ok: false, reason: 'error' });
  });
  it('the answer holds counts only: no push address, key or text', async () => {
    const db = freshDb();
    queued(db);
    const text = JSON.stringify(await C.runCron(ready(db), NOW, network().fetch));
    expect(text).not.toMatch(/push\.test|secret-|Headline|news\.test|VAPID|mailto/);
  });
});

// ---------------------------------------------------------------- the Worker

withDb('the Worker: announce plans, the cron sends', () => {
  const announce = (env: any, posts: any[], f: any) => worker.fetch(new Request('https://push.test/announce', { method: 'POST', headers: { 'X-Announce-Secret': SECRET }, body: JSON.stringify({ posts }) }), env, undefined, f);

  it('with sending ready, /announce records the post, plans it and says so in counts', async () => {
    at();
    const db = freshDb();
    const id = addReader(db);
    const net = network();
    const res = await announce(ready(db), [announced()], net.fetch);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ ok: true, accepted: 1, skipped: 0, planning: { planned: 1, queued: 1, held: 0, errors: 0, left: 0 } });
    expect(db.prepare('SELECT sub_id, state FROM push_queue').all()).toEqual([{ sub_id: id, state: 'queued' }]);
    expect(net.push.length).toBe(0); // /announce plans, it never sends
  });
  it('the cron then sends it, and a second tick sends nothing more', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const net = network();
    const env = ready(db);
    await announce(env, [announced()], net.fetch);
    await worker.scheduled({}, env, undefined, net.fetch);
    expect(net.push.length).toBe(1);
    expect(db.prepare('SELECT state FROM push_queue').get().state).toBe('sent');
    await worker.scheduled({}, env, undefined, net.fetch);
    expect(net.push.length).toBe(1);
  });
  it('the same post announced again is not planned or sent a second time', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const net = network();
    const env = ready(db);
    await announce(env, [announced()], net.fetch);
    const again = await (await announce(env, [announced()], net.fetch)).json();
    expect(again.accepted).toBe(0);
    expect(again.planning).toBeUndefined();
    await worker.scheduled({}, env, undefined, net.fetch);
    await worker.scheduled({}, env, undefined, net.fetch);
    expect(count(db, 'push_queue')).toBe(1);
    expect(net.push.length).toBe(1);
  });
  it('without the sender keys the answer of /announce is exactly as before and the queue stays empty', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const env = { SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: d1(db) };
    const out = await (await announce(env, [announced()], network().fetch)).json();
    expect(out).toEqual({ ok: true, accepted: 1, skipped: 0, results: [{ key: 'phone-launch', status: 'accepted' }] });
    expect(count(db, 'push_queue')).toBe(0);
    expect(count(db, 'push_posts')).toBe(1);
  });
  it('with the kill switch on, the post is recorded but nothing is planned or sent', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const net = network();
    const env = ready(db, { PUSH_PAUSED: 'true' });
    const out = await (await announce(env, [announced()], net.fetch)).json();
    expect(out.accepted).toBe(1);
    expect(out.planning).toBeUndefined();
    await worker.scheduled({}, env, undefined, net.fetch);
    expect(count(db, 'push_queue')).toBe(0);
    expect(net.push.length).toBe(0);
  });
  it('the kill switch also stops a queue that already exists, and sending goes on when it is switched off', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const net = network();
    await announce(ready(db), [announced()], net.fetch);
    expect(count(db, 'push_queue')).toBe(1);
    await worker.scheduled({}, ready(db, { PUSH_PAUSED: 'true' }), undefined, net.fetch);
    expect(net.push.length).toBe(0);
    await worker.scheduled({}, ready(db, { PUSH_PAUSED: 'false' }), undefined, net.fetch);
    expect(net.push.length).toBe(1);
  });
  it('a planning failure does not turn /announce into an error: the post stays recorded', async () => {
    at();
    const db = freshDb();
    addReader(db);
    const env = ready(db);
    env.DB = d1(db, { failWhen: (sql) => /FROM push_terms/.test(sql) });
    const res = await announce(env, [announced()], network().fetch);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ accepted: 1, planning: { planned: 0, errors: 1 } });
    expect(count(db, 'push_posts')).toBe(1);
  });
  it('scheduled never throws, even with no database or a broken one', async () => {
    await expect(worker.scheduled({}, {}, undefined, network().fetch)).resolves.toBeUndefined();
    const db = freshDb();
    const env = ready(db);
    env.DB = d1(db, { failWhen: () => true });
    await expect(worker.scheduled({}, env, undefined, network().fetch)).resolves.toBeUndefined();
  });
  it('the other routes are not changed by the cron handler', async () => {
    const db = freshDb();
    expect((await worker.fetch(new Request('https://push.test/other', { method: 'POST' }), { SITE_ORIGIN: SITE, DB: d1(db) })).status).toBe(404);
  });
});

// ---------------------------------------------------------------- the files

describe('the files', () => {
  const code = readFileSync(new URL('../../../workers/push/control.js', import.meta.url), 'utf8');
  const toml = readFileSync(new URL('../../../workers/push/wrangler.toml', import.meta.url), 'utf8');
  it('control.js prints nothing and reads no clock of its own', () => {
    expect(code).not.toMatch(/console\.|Date\.now|new Date/);
  });
  it('wrangler.toml has the every-minute cron trigger and the kill switch variable, switched off', () => {
    expect(toml).toMatch(/^\[triggers\]\s*\ncrons = \[ "\* \* \* \* \*" \]/m);
    expect(toml).toMatch(/^PUSH_PAUSED = "false"/m);
  });
  it('wrangler.toml holds no secret value', () => {
    expect(toml).not.toMatch(/^\s*(VAPID_PRIVATE_KEY|VAPID_SUBJECT|ANNOUNCE_SECRET)\s*=/m);
  });
});
