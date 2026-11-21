import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createECDH, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
// @ts-ignore plain JS Worker code
import * as S from '../../../workers/push/sender.js';
// @ts-ignore plain JS Worker code
import * as V from '../../../workers/push/vapid.js';
// @ts-ignore plain JS Worker code
import { MAX_FAILURES } from '../../../workers/push/lib.js';

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

// ---------------------------------------------------------------- helpers

const b64 = (u: Uint8Array | Buffer) => Buffer.from(u).toString('base64url');

/** A browser made with Node's own crypto, so the test does not use the code it checks. */
function browser() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const authSecret = randomBytes(16);
  return { ecdh, authSecret, p256dh: b64(ecdh.getPublicKey()), auth: b64(authSecret) };
}

/** Opens a push message the way a browser does (RFC 8291 and RFC 8188). */
function open(body: Uint8Array, br: { ecdh: any; authSecret: Buffer }) {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16);
  const idlen = buf[20];
  const asPublic = buf.subarray(21, 21 + idlen);
  const cipher = buf.subarray(21 + idlen);
  const secret = br.ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync('sha256', secret, br.authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), br.ecdh.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  return JSON.parse(plain.subarray(0, plain.length - 1).toString('utf8'));
}

const browsers = new Map<string, any>();
let counter = 0;

/** A fake push service. handler(url, call number) returns { status, headers? } or an Error (a network failure). */
function pushService(handler?: (url: string, n: number) => any) {
  const calls: any[] = [];
  const fetch = async (url: string, init: any) => {
    calls.push({ url, headers: init.headers, body: init.body });
    const r = handler ? await handler(url, calls.length) : { status: 201 };
    if (r instanceof Error) throw r;
    return { status: r.status, headers: new Headers(r.headers || {}), body: null };
  };
  return { calls, fetch };
}

/** D1-like object over node:sqlite. dbCalls counts what the Worker would count against the free plan (a batch is one call). */
function d1(db: any, o: { failWhen?: (sql: string) => boolean; failBatchNo?: number } = {}) {
  const state = { calls: 0, batches: 0 };
  const guard = (sql: string) => {
    if (o.failWhen && o.failWhen(sql)) throw new Error('db down');
  };
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async first() { state.calls++; guard(sql); return db.prepare(sql).get(...this.values) ?? null; },
    async all() {
      state.calls++;
      guard(sql);
      if (this.values.length > 100) throw new Error('too many values for D1');
      return { results: db.prepare(sql).all(...this.values) };
    },
    async run() { state.calls++; guard(sql); return this.raw(); },
    raw() { const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
  });
  return {
    state,
    prepare: mk,
    async batch(statements: any[]) {
      state.calls++;
      state.batches++;
      if (o.failBatchNo === state.batches) throw new Error('db down');
      db.exec('BEGIN');
      try { const out = statements.map((s) => s.raw()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

const freshDb = () => { const db = new Sqlite(':memory:'); db.exec(SCHEMA); return db; };
const one = (db: any, sql: string, ...v: any[]) => db.prepare(sql).get(...v);
const all = (db: any, sql: string, ...v: any[]) => db.prepare(sql).all(...v);
const count = (db: any, table: string) => one(db, `SELECT COUNT(*) AS n FROM ${table}`).n;

function addSub(db: any, o: any = {}) {
  const br = browser();
  counter += 1;
  const endpoint = `https://push.test/send/secret-${counter}`;
  browsers.set(endpoint, br);
  const c = (k: string, d: any) => (k in o ? o[k] : d);
  const r = db.prepare(
    `INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, tz, status, failures, paused_until, sent_today, sent_day, last_sent, created, last_seen)
     VALUES (?, ?, ?, ?, 't', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(endpoint, `h${counter}`, c('p256dh', br.p256dh), br.auth, c('tz', 'UTC'), c('status', 'active'), c('failures', 0), c('paused_until', null), c('sent_today', 0), c('sent_day', null), c('last_sent', null), NOW - 1000, NOW - 1000);
  return { id: Number(r.lastInsertRowid), endpoint, br };
}

function addPost(db: any, key: string, o: any = {}) {
  const flags = { breaking: false, push: 'auto', ...(o.flags || {}) };
  db.prepare('INSERT INTO push_posts (key, url, title, description, category, tags, focus, author, flags, image, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    key, `https://news.test/${key}/`, o.title ?? `Headline of ${key}`, o.description ?? 'A short description of the story.', o.category ?? 'tech', JSON.stringify(o.tags ?? []), o.focus ?? '', 'shivam-das', JSON.stringify(flags), o.image ?? null, NOW - 10 * MIN, NOW - 9 * MIN,
  );
}

function addQueue(db: any, subId: number, postKey: string, o: any = {}) {
  const r = db.prepare('INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, urgency, state, tries, created, next_try) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    subId, postKey, o.score ?? 60, o.thread ?? postKey, o.ttl ?? 21600, o.urgency ?? 'normal', o.state ?? 'queued', o.tries ?? 0, o.created ?? NOW - 5 * MIN, o.next_try ?? 0,
  );
  return Number(r.lastInsertRowid);
}

let keys: any;
beforeAll(async () => {
  const k = await V.generateVapidKeys();
  const loaded = await V.loadVapid(k.privateKey, k.publicKey);
  keys = { vapid: loaded.vapid, subject: 'mailto:owner@news.test' };
});
const opts = (svc: any, extra: any = {}) => ({ ...keys, fetch: svc.fetch, ...extra });

/** One reader, one post, one queued message. */
function simple(db: any, o: any = {}) {
  const sub = addSub(db, o.sub || {});
  addPost(db, o.key ?? 'story-one', o.post || {});
  const q = addQueue(db, sub.id, o.key ?? 'story-one', o.queue || {});
  return { sub, q };
}

// ---------------------------------------------------------------- pure parts

describe('judgeResult and topicOf', () => {
  const row = { tries: 0 };
  it('maps every answer of the push service to one action (LOGICS 19 step 5)', () => {
    expect(S.judgeResult(row, { ok: true, outcome: 'sent' }, NOW)).toEqual({ act: 'sent' });
    expect(S.judgeResult(row, { ok: false, outcome: 'gone' }, NOW)).toEqual({ act: 'delete' });
    expect(S.judgeResult(row, { ok: false, outcome: 'bad_sub' }, NOW)).toEqual({ act: 'delete' });
    expect(S.judgeResult(row, { ok: false, outcome: 'retry', reason: 'rate_limited', retryAfter: 120 }, NOW)).toEqual({ act: 'wait', until: NOW + 120000, stop: 'rate_limited' });
    expect(S.judgeResult(row, { ok: false, outcome: 'retry', reason: 'rate_limited', retryAfter: null }, NOW)).toEqual({ act: 'wait', until: NOW + 60000, stop: 'rate_limited' });
    expect(S.judgeResult(row, { ok: false, outcome: 'rejected', reason: 'auth', auth: true }, NOW)).toEqual({ act: 'wait', until: NOW + 600000, stop: 'auth' });
    expect(S.judgeResult(row, { ok: false, outcome: 'retry', reason: 'network' }, NOW)).toEqual({ act: 'retry', until: NOW + 60000 });
    expect(S.judgeResult({ tries: 1 }, { ok: false, outcome: 'retry', reason: 'server', status: 503 }, NOW)).toEqual({ act: 'retry', until: NOW + 300000 });
    expect(S.judgeResult({ tries: 2 }, { ok: false, outcome: 'retry', reason: 'server' }, NOW)).toEqual({ act: 'fail', countFailure: true });
    expect(S.judgeResult(row, { ok: false, outcome: 'rejected', reason: 'refused', status: 400 }, NOW)).toEqual({ act: 'fail', countFailure: true });
    expect(S.judgeResult(row, { ok: false, outcome: 'rejected', reason: 'too_big', status: 413 }, NOW)).toEqual({ act: 'fail', countFailure: true });
  });
  it('waits at least as long as the push service asked for a retry', () => {
    expect(S.judgeResult(row, { ok: false, outcome: 'retry', reason: 'server', retryAfter: 900 }, NOW)).toEqual({ act: 'retry', until: NOW + 900000 });
    expect(S.judgeResult(row, { ok: false, outcome: 'retry', reason: 'server', retryAfter: 5 }, NOW)).toEqual({ act: 'retry', until: NOW + 60000 });
  });
  it('makes a short fixed topic from the thread', async () => {
    const a = await S.topicOf('new-phone');
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await S.topicOf('new-phone')).toBe(a);
    expect(await S.topicOf('other-story')).not.toBe(a);
  });
});

describe('decideRow', () => {
  const known = () => ({ sent: new Map(), threads: new Map() });
  const row = (o: any = {}) => ({
    id: 1, sub_id: 7, post_key: 'p', thread: 't', ttl: 21600, created: NOW - MIN, tries: 0, urgency: 'normal',
    endpoint: 'https://push.test/x', p256dh: 'k', auth: 'a', sub_status: 'active', tz: 'UTC', failures: 0, paused_until: null,
    key: 'p', url: 'https://news.test/p/', title: 'A headline', description: 'Text', category: 'tech', tags: '[]', focus: '', author: 'a', flags: '{}', image: null, published_at: NOW - 5 * MIN,
    ...o,
  });
  it('expires a message for a missing, paused or failed reader and for an old message', () => {
    expect(S.decideRow(null, known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ endpoint: null }), known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ sub_status: 'paused' }), known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ sub_status: 'gone' }), known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ failures: MAX_FAILURES }), known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ paused_until: NOW + 1000 }), known(), NOW).kind).toBe('expire');
    expect(S.decideRow(row({ created: NOW - 7 * HOUR }), known(), NOW).kind).toBe('expire');
  });
  it('sends when a pause is over, with the time to live that is left', () => {
    const d = S.decideRow(row({ paused_until: NOW - 1, created: NOW - HOUR }), known(), NOW);
    expect(d.kind).toBe('send');
    expect(d.ttl).toBe(21600 - 3600);
    expect(d.update).toBe(false);
  });
  it('fails a message without a usable post and never sends it', () => {
    expect(S.decideRow(row({ key: null }), known(), NOW)).toEqual({ kind: 'fail', why: 'no_post' });
    expect(S.decideRow(row({ published_at: 'x' }), known(), NOW)).toEqual({ kind: 'fail', why: 'bad_post' });
    expect(S.decideRow(row({ title: 'Big news \u{1F525}' }), known(), NOW)).toEqual({ kind: 'fail', why: 'emoji' });
    expect(S.decideRow(row({ url: 'http://news.test/p/' }), known(), NOW)).toEqual({ kind: 'fail', why: 'bad_url' });
    expect(S.decideRow(row({ title: '' }), known(), NOW)).toEqual({ kind: 'fail', why: 'no_title' });
  });
  it('marks a message already sent as done, and a thread inside 12 hours as an update', () => {
    const k = known();
    k.sent.set('7|p', true);
    expect(S.decideRow(row(), k, NOW).kind).toBe('done');
    const t = known();
    t.threads.set('7|t', NOW - 11 * HOUR);
    expect(S.decideRow(row(), t, NOW).update).toBe(true);
    const old = known();
    old.threads.set('7|t', NOW - 13 * HOUR);
    expect(S.decideRow(row(), old, NOW).update).toBe(false);
    const other = known();
    other.threads.set('8|t', NOW - HOUR);
    expect(S.decideRow(row(), other, NOW).update).toBe(false);
  });
});

// ---------------------------------------------------------------- the batch

withDb('runSender: a normal send', () => {
  it('does nothing while paused and without keys', async () => {
    const db = freshDb();
    simple(db);
    const svc = pushService();
    expect(await S.runSender(d1(db), opts(svc, { paused: true }), NOW)).toEqual({ ok: true, skipped: 'paused' });
    expect(await S.runSender(d1(db), { fetch: svc.fetch, subject: keys.subject }, NOW)).toEqual({ ok: false, reason: 'no_keys' });
    expect(await S.runSender(d1(db), { fetch: svc.fetch, vapid: keys.vapid }, NOW)).toEqual({ ok: false, reason: 'no_keys' });
    expect(svc.calls.length).toBe(0);
    expect(one(db, 'SELECT state FROM push_queue').state).toBe('queued');
  });

  it('answers quickly when the queue is empty', async () => {
    const db = freshDb();
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r).toMatchObject({ ok: true, claimed: 0, sent: 0 });
    expect(svc.calls.length).toBe(0);
  });

  it('sends one message: encrypted text, right headers, and the result written', async () => {
    const db = freshDb();
    const { sub, q } = simple(db, { post: { flags: { breaking: false } }, queue: { thread: 'new-phone' } });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r).toMatchObject({ ok: true, claimed: 1, sent: 1, updates: 0, failed: 0, stopped: null });

    expect(svc.calls.length).toBe(1);
    const call = svc.calls[0];
    expect(call.url).toBe(sub.endpoint);
    expect(call.headers['Content-Encoding']).toBe('aes128gcm');
    expect(call.headers.TTL).toBe(String(21600 - 300)); // 5 minutes of the 6 hours are used
    expect(call.headers.Urgency).toBe('normal');
    expect(call.headers.Topic).toBe(await S.topicOf('new-phone'));
    expect(call.headers.Authorization).toMatch(/^vapid /);
    const payload = open(call.body, sub.br);
    expect(payload).toMatchObject({ v: 1, title: 'Headline of story-one', url: 'https://news.test/story-one/?pn=1', tag: 'new-phone', breaking: false, renotify: false });
    expect(payload.image).toBeUndefined();

    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('sent');
    expect(one(db, 'SELECT * FROM push_sent')).toMatchObject({ sub_id: sub.id, post_key: 'story-one', ts: NOW, thread: 'new-phone' });
    expect(one(db, 'SELECT sent_today, sent_day, last_sent, failures FROM push_subs WHERE id = ?', sub.id)).toEqual({ sent_today: 1, sent_day: '2026-11-16', last_sent: NOW, failures: 0 });
  });

  it('sends a breaking story with high urgency and renotify', async () => {
    const db = freshDb();
    const { sub } = simple(db, { post: { flags: { breaking: true } }, queue: { urgency: 'high', ttl: 7200 } });
    const svc = pushService();
    await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls[0].headers.Urgency).toBe('high');
    expect(svc.calls[0].headers.TTL).toBe(String(7200 - 300));
    expect(open(svc.calls[0].body, sub.br)).toMatchObject({ breaking: true, renotify: true });
  });

  it('adds the picture only when the post says it is wide enough', async () => {
    const db = freshDb();
    const wide = simple(db, { key: 'wide', post: { image: 'https://news.test/media/a.webp', flags: { imageWidth: 1400 } } });
    const narrow = simple(db, { key: 'narrow', post: { image: 'https://news.test/media/b.webp', flags: { imageWidth: 800 } } });
    const svc = pushService();
    await S.runSender(d1(db), opts(svc), NOW);
    const by = new Map(svc.calls.map((c) => [c.url, c]));
    expect(open(by.get(wide.sub.endpoint)!.body, wide.sub.br).image).toBe('https://news.test/media/a.webp');
    expect(open(by.get(narrow.sub.endpoint)!.body, narrow.sub.br).image).toBeUndefined();
  });

  it('uses the headline and text the editor chose for the push (pushTitle, pushBody)', async () => {
    const db = freshDb();
    const { sub } = simple(db, { post: { flags: { pushTitle: 'Short alert title', pushBody: 'Short alert body.' } } });
    const svc = pushService();
    await S.runSender(d1(db), opts(svc), NOW);
    expect(open(svc.calls[0].body, sub.br)).toMatchObject({ title: 'Short alert title', body: 'Short alert body.' });
  });

  it('counts the day in the reader\'s own zone, and starts again at the reader\'s midnight', async () => {
    const db = freshDb();
    const late = Date.parse('2026-11-16T19:00:00Z'); // 00:30 on 17 November in Kolkata
    const a = simple(db, { key: 'a', sub: { tz: 'Asia/Kolkata', sent_today: 3, sent_day: '2026-11-16' }, queue: { created: late - MIN } });
    const b = simple(db, { key: 'b', sub: { tz: 'Asia/Kolkata', sent_today: 3, sent_day: '2026-11-17' }, queue: { created: late - MIN } });
    const c = simple(db, { key: 'c', sub: { tz: 'Not/AZone', sent_today: 2, sent_day: '2026-11-16' }, queue: { created: late - MIN } });
    await S.runSender(d1(db), opts(pushService()), late);
    const get = (id: number) => one(db, 'SELECT sent_today, sent_day FROM push_subs WHERE id = ?', id);
    expect(get(a.sub.id)).toEqual({ sent_today: 1, sent_day: '2026-11-17' }); // a new local day: starts at 1
    expect(get(b.sub.id)).toEqual({ sent_today: 4, sent_day: '2026-11-17' }); // the same local day: adds one
    expect(get(c.sub.id)).toEqual({ sent_today: 3, sent_day: '2026-11-16' }); // a wrong zone name counts as UTC (19:00 on the 16th)
  });

  it('resets the failures of a reader after a good send', async () => {
    const db = freshDb();
    const { sub } = simple(db, { sub: { failures: 3 } });
    await S.runSender(d1(db), opts(pushService()), NOW);
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', sub.id).failures).toBe(0);
  });
});

withDb('runSender: story updates and the duplicate guard', () => {
  it('a story update uses no daily slot and no gap, and still replaces the old one', async () => {
    const db = freshDb();
    const sub = addSub(db, { sent_today: 2, sent_day: '2026-11-16', last_sent: NOW - 3 * HOUR, failures: 2 });
    addPost(db, 'phone-v1');
    addPost(db, 'phone-v2');
    db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(sub.id, 'phone-v1', NOW - 2 * HOUR, 'new-phone');
    addQueue(db, sub.id, 'phone-v2', { thread: 'new-phone' });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r).toMatchObject({ sent: 1, updates: 1 });
    expect(open(svc.calls[0].body, sub.br).tag).toBe('new-phone');
    expect(svc.calls[0].headers.Topic).toBe(await S.topicOf('new-phone'));
    expect(one(db, 'SELECT sent_today, last_sent, failures FROM push_subs WHERE id = ?', sub.id)).toEqual({ sent_today: 2, last_sent: NOW - 3 * HOUR, failures: 0 });
    expect(count(db, 'push_sent')).toBe(2);
  });

  it('the same thread 13 hours ago is a new story and uses a slot', async () => {
    const db = freshDb();
    const sub = addSub(db, { sent_today: 1, sent_day: '2026-11-16' });
    addPost(db, 'old');
    addPost(db, 'new');
    db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(sub.id, 'old', NOW - 13 * HOUR, 'story');
    addQueue(db, sub.id, 'new', { thread: 'story' });
    const r = await S.runSender(d1(db), opts(pushService()), NOW);
    expect(r).toMatchObject({ sent: 1, updates: 0 });
    expect(one(db, 'SELECT sent_today FROM push_subs WHERE id = ?', sub.id).sent_today).toBe(2);
  });

  it('a thread of another reader is not an update', async () => {
    const db = freshDb();
    const other = addSub(db);
    const { sub } = simple(db, { key: 'mine', queue: { thread: 'story' } });
    db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(other.id, 'x', NOW - HOUR, 'story');
    const r = await S.runSender(d1(db), opts(pushService()), NOW);
    expect(r.updates).toBe(0);
    expect(one(db, 'SELECT sent_today FROM push_subs WHERE id = ?', sub.id).sent_today).toBe(1);
  });

  it('never sends the same post to the same reader twice (duplicate guard)', async () => {
    const db = freshDb();
    const { sub, q } = simple(db);
    db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(sub.id, 'story-one', NOW - 20 * HOUR, 'story-one'); // even an old row counts
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls.length).toBe(0);
    expect(r.claimed).toBe(1);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('sent');
    expect(one(db, 'SELECT sent_today FROM push_subs WHERE id = ?', sub.id).sent_today).toBe(0);
  });
});

withDb('runSender: messages that are dropped without a send', () => {
  it('expires a message older than its time to live, before sending', async () => {
    const db = freshDb();
    const { q } = simple(db, { queue: { created: NOW - 7 * HOUR, ttl: 21600 } });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls.length).toBe(0);
    expect(r.claimed).toBe(0);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('expired');
  });

  it('a breaking message lives only 2 hours', async () => {
    const db = freshDb();
    const { q } = simple(db, { queue: { created: NOW - 3 * HOUR, ttl: 7200, urgency: 'high' } });
    await S.runSender(d1(db), opts(pushService()), NOW);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('expired');
  });

  it('sends the time that is left to the push service, never the full time to live', async () => {
    const db = freshDb();
    simple(db, { queue: { created: NOW - 5 * HOUR - 59 * MIN, ttl: 21600 } });
    const svc = pushService();
    await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls[0].headers.TTL).toBe(String(60));
  });

  it.each([
    ['paused for later', { paused_until: NOW + HOUR }],
    ['paused status', { status: 'paused' }],
    ['gone status', { status: 'gone' }],
    ['5 failures in a row', { failures: 5 }],
  ])('does not send to a reader who is %s', async (_n, sub) => {
    const db = freshDb();
    const { q } = simple(db, { sub });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls.length).toBe(0);
    expect(r.expired).toBe(1);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('expired');
  });

  it('sends again to a reader whose pause is over', async () => {
    const db = freshDb();
    simple(db, { sub: { paused_until: NOW - 1 } });
    const svc = pushService();
    expect((await S.runSender(d1(db), opts(svc), NOW)).sent).toBe(1);
  });

  it('expires a message whose reader was deleted', async () => {
    const db = freshDb();
    const { sub, q } = simple(db);
    db.prepare('DELETE FROM push_subs WHERE id = ?').run(sub.id);
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls.length).toBe(0);
    expect(r.expired).toBe(1);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('expired');
  });

  it('fails a message whose post is gone, and one whose text has an emoji, and sends neither', async () => {
    const db = freshDb();
    const a = simple(db, { key: 'gone-post' });
    db.prepare('DELETE FROM push_posts WHERE key = ?').run('gone-post');
    const b = simple(db, { key: 'emoji-post', post: { title: 'Big news \u{1F525}' } });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(svc.calls.length).toBe(0);
    expect(r.failed).toBe(2);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', a.q).state).toBe('failed');
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', b.q).state).toBe('failed');
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', a.sub.id).failures).toBe(0); // our fault, not the reader's
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', b.sub.id).failures).toBe(0);
  });
});

withDb('runSender: what the push service answers', () => {
  const seed = (db: any) => {
    const a = simple(db, { key: 'story-a' });
    const other = addSub(db);
    addPost(db, 'story-b');
    addQueue(db, other.id, 'story-b');
    db.prepare("INSERT INTO push_terms (sub_id, kind, term) VALUES (?, 'cat', 'tech')").run(a.sub.id);
    db.prepare("INSERT INTO push_terms (sub_id, kind, term) VALUES (?, 'cat', 'tech')").run(other.id);
    db.prepare('INSERT INTO push_held (sub_id, post_key, score, expires) VALUES (?, ?, 50, ?)').run(a.sub.id, 'x', NOW + HOUR);
    db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(a.sub.id, 'older', NOW - 30 * HOUR, 'older');
    return { a, other };
  };

  it.each([404, 410])('deletes the reader at once and everything of the reader on %i, and nobody else', async (status) => {
    const db = freshDb();
    const { a, other } = seed(db);
    const svc = pushService((url) => (url === a.sub.endpoint ? { status } : { status: 201 }));
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r).toMatchObject({ deleted: 1, sent: 1 });
    for (const t of ['push_subs', 'push_terms', 'push_queue', 'push_held', 'push_sent']) {
      const col = t === 'push_subs' ? 'id' : 'sub_id';
      expect(one(db, `SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, a.sub.id).n).toBe(0);
    }
    expect(one(db, 'SELECT COUNT(*) AS n FROM push_subs WHERE id = ?', other.id).n).toBe(1);
    expect(one(db, 'SELECT COUNT(*) AS n FROM push_terms WHERE sub_id = ?', other.id).n).toBe(1);
    expect(one(db, "SELECT state FROM push_queue WHERE sub_id = ?", other.id).state).toBe('sent');
  });

  it('deletes a reader whose stored keys cannot be used', async () => {
    const db = freshDb();
    const { sub } = simple(db, { sub: { p256dh: b64(randomBytes(65)) } }); // not a point on the curve
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r.deleted).toBe(1);
    expect(svc.calls.length).toBe(0);
    expect(one(db, 'SELECT COUNT(*) AS n FROM push_subs WHERE id = ?', sub.id).n).toBe(0);
  });

  it('on 429 stops the batch, keeps every message and waits for Retry-After', async () => {
    const db = freshDb();
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) ids.push(simple(db, { key: `s${i}` }).q);
    const svc = pushService(() => ({ status: 429, headers: { 'Retry-After': '120' } }));
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r.stopped).toBe('rate_limited');
    expect(svc.calls.length).toBeLessThanOrEqual(S.SEND_CONCURRENCY); // no new send starts after the first 429
    expect(r.sent).toBe(0);
    expect(r.released).toBe(10);
    for (const id of ids) {
      expect(one(db, 'SELECT state, tries, next_try FROM push_queue WHERE id = ?', id)).toEqual({ state: 'queued', tries: 0, next_try: NOW + 120000 });
    }
    expect(one(db, 'SELECT SUM(failures) AS f FROM push_subs').f).toBe(0);
    // not due before the wait is over, due after it
    expect((await S.runSender(d1(db), opts(svc), NOW + 119000)).claimed).toBe(0);
    expect((await S.runSender(d1(db), opts(pushService()), NOW + 120000)).sent).toBe(10);
  });

  it('on 429 without a wait time waits one minute', async () => {
    const db = freshDb();
    const { q } = simple(db);
    await S.runSender(d1(db), opts(pushService(() => ({ status: 429 }))), NOW);
    expect(one(db, 'SELECT next_try FROM push_queue WHERE id = ?', q).next_try).toBe(NOW + 60000);
  });

  it('retries a server error twice with a growing wait, then fails it and counts one failure', async () => {
    const db = freshDb();
    const { sub, q } = simple(db);
    const svc = pushService(() => ({ status: 503 }));
    const row = () => one(db, 'SELECT state, tries, next_try FROM push_queue WHERE id = ?', q);
    let t = NOW;

    expect(await S.runSender(d1(db), opts(svc), t)).toMatchObject({ retried: 1, failed: 0 });
    expect(row()).toEqual({ state: 'queued', tries: 1, next_try: t + 60000 });
    expect((await S.runSender(d1(db), opts(svc), t + 30000)).claimed).toBe(0); // too early

    t += 60000;
    expect(await S.runSender(d1(db), opts(svc), t)).toMatchObject({ retried: 1 });
    expect(row()).toEqual({ state: 'queued', tries: 2, next_try: t + 300000 });

    t += 300000;
    expect(await S.runSender(d1(db), opts(svc), t)).toMatchObject({ retried: 0, failed: 1 });
    expect(row().state).toBe('failed');
    expect(svc.calls.length).toBe(3);
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', sub.id).failures).toBe(1);
    expect(count(db, 'push_sent')).toBe(0);
  });

  it('a network error is retried like a server error', async () => {
    const db = freshDb();
    const { q } = simple(db);
    const svc = pushService(() => new TypeError('fetch failed'));
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r.retried).toBe(1);
    expect(one(db, 'SELECT state, tries FROM push_queue WHERE id = ?', q)).toEqual({ state: 'queued', tries: 1 });
  });

  it('a retry that works later sends once and counts nothing as a failure', async () => {
    const db = freshDb();
    const { sub, q } = simple(db);
    await S.runSender(d1(db), opts(pushService(() => ({ status: 502 }))), NOW);
    const r = await S.runSender(d1(db), opts(pushService()), NOW + 61000);
    expect(r.sent).toBe(1);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('sent');
    expect(one(db, 'SELECT failures, sent_today FROM push_subs WHERE id = ?', sub.id)).toEqual({ failures: 0, sent_today: 1 });
  });

  it.each([401, 403])('on %i (a key problem of ours) stops, keeps the message and blames nobody', async (status) => {
    const db = freshDb();
    const { sub, q } = simple(db);
    addPost(db, 'second');
    addQueue(db, addSub(db).id, 'second');
    const r = await S.runSender(d1(db), opts(pushService(() => ({ status }))), NOW);
    expect(r.stopped).toBe('auth');
    expect(r.failed).toBe(0);
    expect(one(db, 'SELECT state, tries, next_try FROM push_queue WHERE id = ?', q)).toEqual({ state: 'queued', tries: 0, next_try: NOW + 600000 });
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', sub.id).failures).toBe(0);
    expect(one(db, "SELECT COUNT(*) AS n FROM push_queue WHERE state = 'queued'").n).toBe(2);
  });

  it.each([400, 413])('on %i fails the message at once and counts one failure', async (status) => {
    const db = freshDb();
    const { sub, q } = simple(db, { sub: { failures: 4 } });
    const svc = pushService(() => ({ status }));
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r).toMatchObject({ failed: 1, retried: 0 });
    expect(svc.calls.length).toBe(1);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('failed');
    expect(one(db, 'SELECT failures FROM push_subs WHERE id = ?', sub.id).failures).toBe(5); // the fifth in a row: the audience search now skips this reader
  });

  it('a redirect is a refusal, not a retry', async () => {
    const db = freshDb();
    simple(db);
    const r = await S.runSender(d1(db), opts(pushService(() => ({ status: 302 }))), NOW);
    expect(r).toMatchObject({ failed: 1, retried: 0 });
  });
});

withDb('runSender: order, size, safety', () => {
  it('sends breaking first, then the higher score, then the older', async () => {
    const db = freshDb();
    const a = simple(db, { key: 'normal-old', queue: { score: 50, created: NOW - 10 * MIN } });
    const b = simple(db, { key: 'normal-high', queue: { score: 80, created: NOW - 5 * MIN } });
    const c = simple(db, { key: 'breaking', post: { flags: { breaking: true } }, queue: { score: 40, urgency: 'high', ttl: 7200, created: NOW - MIN } });
    const d = simple(db, { key: 'normal-old-tie', queue: { score: 50, created: NOW - 2 * MIN } });
    const order: string[] = [];
    const svc = pushService((url) => {
      order.push(url);
      return { status: 201 };
    });
    for (let i = 0; i < 4; i++) await S.runSender(d1(db), opts(svc, { batch: 1 }), NOW);
    expect(order).toEqual([c.sub.endpoint, b.sub.endpoint, a.sub.endpoint, d.sub.endpoint]);
  });

  it('takes at most SEND_BATCH messages, and the rest the next time', async () => {
    const db = freshDb();
    for (let i = 0; i < 50; i++) simple(db, { key: `s${i}` });
    const svc = pushService();
    const first = await S.runSender(d1(db), opts(svc), NOW);
    expect(first).toMatchObject({ claimed: 36, sent: 36 });
    expect(svc.calls.length).toBe(36);
    const second = await S.runSender(d1(db), opts(svc), NOW);
    expect(second).toMatchObject({ claimed: 14, sent: 14 });
    expect(count(db, 'push_sent')).toBe(50);
  });

  it('a bigger batch asked for is cut to SEND_BATCH', async () => {
    const db = freshDb();
    for (let i = 0; i < 40; i++) simple(db, { key: `s${i}` });
    const r = await S.runSender(d1(db), opts(pushService(), { batch: 500 }), NOW);
    expect(r.claimed).toBe(36);
  });

  it('stays under the 50 outgoing calls of the free plan: sends plus database calls, for a full batch', async () => {
    const db = freshDb();
    for (let i = 0; i < 36; i++) simple(db, { key: `s${i}` });
    const wrapped = d1(db);
    const svc = pushService();
    await S.runSender(wrapped, opts(svc), NOW);
    expect(svc.calls.length).toBe(36);
    expect(wrapped.state.calls).toBeLessThanOrEqual(12);
    expect(svc.calls.length + wrapped.state.calls).toBeLessThan(50);
  });

  it('two runs at the same time send every message exactly once', async () => {
    const db = freshDb();
    for (let i = 0; i < 20; i++) simple(db, { key: `s${i}` });
    const svc = pushService();
    const [a, b] = await Promise.all([S.runSender(d1(db), opts(svc), NOW), S.runSender(d1(db), opts(svc), NOW)]);
    expect(svc.calls.length).toBe(20);
    expect(a.sent + b.sent).toBe(20);
    expect(a.claimed + b.claimed).toBe(20);
    expect(new Set(svc.calls.map((c) => c.url)).size).toBe(20);
  });

  it('takes back a message that was claimed and never finished, and counts the try', async () => {
    const db = freshDb();
    const a = simple(db, { key: 'stuck', queue: { state: 'sending', next_try: NOW - 1 } });
    const b = simple(db, { key: 'busy', queue: { state: 'sending', next_try: NOW + 1000 } });
    const c = simple(db, { key: 'tired', queue: { state: 'sending', next_try: NOW - 1, tries: 2 } });
    const svc = pushService();
    const r = await S.runSender(d1(db), opts(svc), NOW);
    expect(r.recovered).toBe(2);
    expect(one(db, 'SELECT state, tries FROM push_queue WHERE id = ?', a.q)).toEqual({ state: 'sent', tries: 1 });
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', b.q).state).toBe('sending'); // still inside its claim
    expect(one(db, 'SELECT state, tries FROM push_queue WHERE id = ?', c.q)).toEqual({ state: 'failed', tries: 3 });
    expect(svc.calls.length).toBe(1);
  });

  it('a database error while reading sends nothing, and the claim runs out by itself', async () => {
    const db = freshDb();
    const { q } = simple(db);
    const svc = pushService();
    await expect(S.runSender(d1(db, { failWhen: (sql) => sql.includes('LEFT JOIN push_subs') }), opts(svc), NOW)).rejects.toThrow('db down');
    expect(svc.calls.length).toBe(0);
    expect(one(db, 'SELECT state, next_try FROM push_queue WHERE id = ?', q)).toEqual({ state: 'sending', next_try: NOW + S.LEASE_MS });
    expect((await S.runSender(d1(db), opts(svc), NOW + 1000)).claimed).toBe(0);
    const later = await S.runSender(d1(db), opts(svc), NOW + S.LEASE_MS);
    expect(later).toMatchObject({ recovered: 1, sent: 1 });
    expect(svc.calls.length).toBe(1);
  });

  it('a database error while writing the results goes up and marks nothing as sent', async () => {
    const db = freshDb();
    const { q } = simple(db);
    const svc = pushService();
    await expect(S.runSender(d1(db, { failBatchNo: 2 }), opts(svc), NOW)).rejects.toThrow('db down');
    expect(svc.calls.length).toBe(1);
    expect(count(db, 'push_sent')).toBe(0);
    expect(one(db, 'SELECT state FROM push_queue WHERE id = ?', q).state).toBe('sending');
    const later = await S.runSender(d1(db), opts(svc), NOW + S.LEASE_MS);
    expect(later.sent).toBe(1); // sent a second time; the tag of the notification makes the phone show one
    expect(svc.calls.length).toBe(2);
    expect(open(svc.calls[1].body, browsers.get(svc.calls[1].url)).tag).toBe('story-one');
  });

  it('never returns or logs a push address, a key or a text', async () => {
    const db = freshDb();
    simple(db, { key: 'a' });
    simple(db, { key: 'b', sub: { p256dh: b64(randomBytes(65)) } });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const r = await S.runSender(d1(db), opts(pushService(() => ({ status: 503 }))), NOW);
    const text = JSON.stringify(r);
    expect(text).not.toContain('push.test');
    expect(text).not.toContain('Headline');
    expect(text).not.toMatch(/secret-/);
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });

  it('finds its queue through the index and does not scan the whole table', () => {
    const db = freshDb();
    const plan = all(db, `EXPLAIN QUERY PLAN ${S.NEXT_SQL}`, NOW, 36).map((r: any) => r.detail).join(' | ');
    expect(plan).toContain('push_queue_next');
    expect(plan).not.toMatch(/SCAN push_queue(?! USING)/);
  });

  it('the SQL for a batch of 36 stays under the 100 values of D1', () => {
    expect(S.loadSql(36).split('?').length - 1).toBe(36);
    const known = S.knownSql(36, 36);
    expect(known.split('?').length - 1 + 0).toBe(73);
  });
});

describe('sender.js is plain text (PLAN 29.3)', () => {
  it('has no emoji and no console call', () => {
    const src = readFileSync(new URL('../../../workers/push/sender.js', import.meta.url), 'utf8');
    expect(/\p{Extended_Pictographic}/u.test(src)).toBe(false);
    expect(src).not.toMatch(/console\./);
  });
});
