import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generateKeyPairSync, createECDH, randomBytes } from 'node:crypto';
// @ts-ignore plain JS Worker
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as P from '../../../workers/push/prefs.js';
// @ts-ignore plain JS Worker code
import * as V from '../../../workers/push/vapid.js';
// @ts-ignore plain JS Worker code
import { issueStamp } from '../../../workers/shared/guard.js';
// @ts-ignore plain JS Worker code
// @ts-ignore plain JS Worker code
import * as F from '../../../workers/push/feedback.js';
// @ts-ignore plain JS Worker code
import * as C from '../../../workers/push/control.js';

// v0.98.0 (Phase 9 part 8c-1): the count of "Less like this" taps (table push_less) and the answer suggestRemove (PLAN 31.8).
const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-push-tests-0123456789';
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

const vapid = await V.generateVapidKeys();
const KEYS = { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:owner@news.test' };

// A real P-256 browser key, so the message can really be encrypted.
function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
}
const endpointOf = (n: number) => `https://fcm.googleapis.com/fcm/send/secret-test-endpoint-${n}`;
const subscription = (n = 1) => ({ endpoint: endpointOf(n), keys: browserKeys() });

function d1(db: any) {
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) {
      this.values = v;
      return this;
    },
    async first() {
      return db.prepare(sql).get(...this.values) ?? null;
    },
    async all() {
      return { results: db.prepare(sql).all(...this.values) };
    },
    async run() {
      const r = db.prepare(sql).run(...this.values);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
  });
  return {
    prepare: mk,
    async batch(statements: any[]) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** A fake push service: records every request and answers with the given status. */
function pushService(status: number | (() => number) = 201, headers: Record<string, string> = {}) {
  const seen: { url: string; init: any }[] = [];
  const fn = vi.fn(async (url: string, init: any) => {
    seen.push({ url, init });
    return new Response(null, { status: typeof status === 'function' ? status() : status, headers });
  });
  return { fn, seen };
}

async function setup(envExtra: any = KEYS) {
  const db = new Sqlite(':memory:');
  db.exec(SCHEMA);
  const env: any = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: d1(db), ...envExtra };
  const post = async (path: string, body: any, o: { origin?: string | null; method?: string; fetchFn?: any } = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (o.origin !== null) headers.Origin = o.origin ?? SITE;
    const init: any = { method: o.method ?? 'POST', headers };
    if ((o.method ?? 'POST') === 'POST') {
      const b = path === '/subscribe' && body && typeof body === 'object' && body.stamp === undefined ? { ...body, stamp: await issueStamp(SECRET, Date.now(), 'push-subscribe') } : body;
      init.body = typeof b === 'string' ? b : JSON.stringify(b);
    }
    return worker.fetch(new Request('https://push.test' + path, init), env, undefined, o.fetchFn);
  };
  const subscribe = async (n = 1) => {
    const res = await post('/subscribe', { subscription: subscription(n), prefs: { categories: ['technology'], tz: 'Asia/Kolkata' } });
    const j = await res.json();
    return { sub: j.sub as string, token: j.token as string, endpoint: endpointOf(n) };
  };
  return { db, env, post, subscribe };
}


const DAY = 86400000;
const subRow = (db: any, sub: string) => db.prepare('SELECT * FROM push_subs WHERE endpoint_hash = ?').get(sub);
const addSent = (db: any, subId: number, key: string, category: string, thread: string, ts = 1_800_000_000_000) => {
  db.prepare('INSERT INTO push_posts (key, url, title, category, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?)').run(key, `https://news.test/${key}`, 'A title', category, ts, ts);
  db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(subId, key, ts, thread);
};
const lessRows = (db: any, subId?: number) => db.prepare(subId === undefined ? 'SELECT * FROM push_less' : 'SELECT * FROM push_less WHERE sub_id = ?').all(...(subId === undefined ? [] : [subId]));
const less = (post: any, me: any, tag = 't1') => post('/feedback', { sub: me.sub, token: me.token, event: 'less', tag });
const read = async (post: any, me: any) => (await post('/preferences', { sub: me.sub, token: me.token })).json();

afterEach(() => vi.restoreAllMocks());

describe('the offer rules', () => {
  it('3 taps or more, and only for a category the reader still follows', () => {
    const rows = [{ category: 'sports', n: 3 }, { category: 'world', n: 5 }, { category: 'tech', n: 2 }];
    expect(F.suggestRemove(rows, ['Sports', 'tech'])).toEqual([{ category: 'sports', count: 3 }]);
    expect(F.suggestRemove(rows, [])).toEqual([]);
    expect(F.suggestRemove(null, ['sports'])).toEqual([]);
    expect(F.suggestRemove([{ category: '', n: 9 }, { category: 'a', n: 'x' }], ['a', ''])).toEqual([]);
  });
  it('the numbers are the ones of the plan', () => {
    expect(F.LESS_WINDOW_DAYS).toBe(30);
    expect(F.LESS_OFFER_AFTER).toBe(3);
    expect(F.LESS_MAX_ROWS).toBeGreaterThanOrEqual(F.LESS_OFFER_AFTER);
    expect(F.categoryKey(' Sports ')).toBe('sports');
    expect(F.lessWindowStart(100 * DAY)).toBe(70 * DAY);
  });
});

withDb('counting "Less like this" taps', () => {
  it('a tap is counted and also lowers the weight', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'Technology', 't1');
    const res = await less(post, me);
    expect(await res.json()).toEqual({ ok: true, applied: true });
    expect(lessRows(db, id)).toHaveLength(1);
    expect(lessRows(db, id)[0].category).toBe('technology');
    expect(JSON.parse(subRow(db, me.sub).weights)).toEqual({ technology: -0.25 });
  });
  it('open and close are not counted', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1' });
    await post('/feedback', { sub: me.sub, token: me.token, event: 'close', tag: 't1' });
    expect(lessRows(db)).toHaveLength(0);
  });
  it('2 taps give no offer, 3 taps give the offer, and the field is left out when empty', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    await less(post, me);
    await less(post, me);
    expect(await read(post, me)).not.toHaveProperty('suggestRemove');
    await less(post, me);
    const r = await read(post, me);
    expect(r.suggestRemove).toEqual([{ category: 'technology', count: 3 }]);
    // the reader's own choice is still there: the site never removes it
    expect(r.prefs.categories).toEqual(['technology']);
  });
  it('taps older than 30 days are not counted', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    const old = Date.now() - 31 * DAY;
    for (let i = 0; i < 5; i++) db.prepare('INSERT INTO push_less (sub_id, category, ts) VALUES (?, ?, ?)').run(id, 'technology', old);
    await less(post, me);
    expect(await read(post, me)).not.toHaveProperty('suggestRemove');
  });
  it('a category the reader does not follow gives no offer', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'sports', 't1');
    for (let i = 0; i < 4; i++) await less(post, me);
    expect(await read(post, me)).not.toHaveProperty('suggestRemove');
  });
  it('the taps of another reader do not count for me', async () => {
    const { db, post, subscribe } = await setup();
    const one = await subscribe(1);
    const two = await subscribe(2);
    addSent(db, subRow(db, one.sub).id, 'p1', 'technology', 't1');
    addSent(db, subRow(db, two.sub).id, 'p2', 'technology', 't2');
    for (let i = 0; i < 3; i++) await less(post, one, 't1');
    await less(post, two, 't2');
    expect(await read(post, two)).not.toHaveProperty('suggestRemove');
    expect((await read(post, one)).suggestRemove).toHaveLength(1);
  });
  it('a flood is capped for one reader and one category', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    for (let i = 0; i < F.LESS_MAX_ROWS + 5; i++) await less(post, me);
    expect(lessRows(db, id)).toHaveLength(F.LESS_MAX_ROWS);
  });
  it('the answers hold no category and no count outside the read answer', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    const text = await (await less(post, me)).text();
    expect(text).toBe('{"ok":true,"applied":true}');
  });
});

withDb('an old database without the table push_less', () => {
  const oldSetup = async () => {
    const s = await setup();
    s.db.exec('DROP TABLE push_less');
    return s;
  };
  it('the tap still moves the weight, the read still works, no offer', async () => {
    const { db, post, subscribe } = await oldSetup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    const res = await less(post, me);
    expect(res.status).toBe(200);
    expect((await res.json()).applied).toBe(true);
    expect(JSON.parse(subRow(db, me.sub).weights)).toEqual({ technology: -0.25 });
    const r = await read(post, me);
    expect(r.ok).toBe(true);
    expect(r).not.toHaveProperty('suggestRemove');
  });
  it('removing a reader still works', async () => {
    const { db, post, subscribe } = await oldSetup();
    const me = await subscribe();
    const res = await post('/unsubscribe', { sub: me.sub, token: me.token });
    expect(res.status).toBe(200);
    expect(subRow(db, me.sub)).toBeUndefined();
  });
  it('the migration file makes the table, twice, and changes nothing else', () => {
    const db = new Sqlite(':memory:');
    db.exec(SCHEMA);
    db.exec('DROP TABLE push_less');
    const mig = readFileSync(new URL('../../../workers/push/migrate-0.100.0.sql', import.meta.url), 'utf8');
    db.exec(mig);
    db.exec(mig);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'push_less'").all()).toHaveLength(1);
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS push_less/);
    expect(mig.replace(/--.*$/gm, '')).not.toMatch(/DROP|DELETE|ALTER/i);
  });
});

withDb('removing and cleaning', () => {
  it('"delete my data" removes the counted taps too', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    await less(post, me);
    expect(lessRows(db)).toHaveLength(1);
    expect((await post('/unsubscribe', { sub: me.sub, token: me.token })).status).toBe(200);
    expect(lessRows(db)).toHaveLength(0);
  });
  it('the clean-up deletes old taps and taps of readers that no longer exist, and keeps the rest', async () => {
    const db = new Sqlite(':memory:');
    db.exec(SCHEMA);
    const now = Date.parse('2026-11-16T10:07:00Z');
    db.prepare("INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, created, last_seen) VALUES ('e', 'h', 'k', 'a', 't', 1, 1)").run();
    const id = db.prepare('SELECT id FROM push_subs').get().id;
    const ins = db.prepare('INSERT INTO push_less (sub_id, category, ts) VALUES (?, ?, ?)');
    ins.run(id, 'a', now - 31 * DAY); // old
    ins.run(id, 'a', now - 1 * DAY); // keep
    ins.run(999, 'a', now - 1 * DAY); // reader does not exist
    const d1 = { prepare: (sql: string) => ({ v: [] as any[], bind(...x: any[]) { this.v = x; return this; }, async run() { const r = db.prepare(sql).run(...this.v); return { success: true, meta: { changes: Number(r.changes) } }; } }) };
    expect(await F.runLessCleanup(d1, now)).toEqual({ ok: true, deleted: 2 });
    expect(lessRows(db)).toHaveLength(1);
  });
  it('the clean-up says no_db and never throws', async () => {
    expect(await F.runLessCleanup(undefined, 1)).toEqual({ ok: false, reason: 'no_db' });
    expect(await F.runLessCleanup({ prepare() { throw new Error('x'); } }, 1)).toEqual({ ok: false, reason: 'error' });
    expect(await F.runLessCleanup({ prepare() { return {}; } }, 0)).toEqual({ ok: false, reason: 'bad_time' });
  });
  it('the hourly tick runs it and says how many rows it deleted', async () => {
    const db = new Sqlite(':memory:');
    db.exec(SCHEMA);
    const now = Date.parse('2026-11-16T10:07:00Z');
    db.prepare('INSERT INTO push_less (sub_id, category, ts) VALUES (?, ?, ?)').run(5, 'a', now);
    const d1 = {
      prepare: (sql: string) => ({
        v: [] as any[],
        bind(...x: any[]) { this.v = x; return this; },
        async run() { const r = db.prepare(sql).run(...this.v); return { success: true, meta: { changes: Number(r.changes) } }; },
        async all() { return { results: db.prepare(sql).all(...this.v) }; },
      }),
      async batch(list: any[]) { return Promise.all(list.map((s) => s.run())); },
    };
    const r = await C.runCleanupTick({ DB: d1 }, now);
    expect(r.ran).toBe(true);
    expect(r.lessDeleted).toBe(1);
  });
});

describe('less files', () => {
  it('the schema, the migration and the Worker agree on the table', () => {
    const schema = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
    const mig = readFileSync(new URL('../../../workers/push/migrate-0.100.0.sql', import.meta.url), 'utf8');
    for (const t of [schema, mig]) {
      expect(t).toMatch(/CREATE TABLE IF NOT EXISTS push_less/);
      expect(t).toMatch(/sub_id\s+INTEGER NOT NULL/);
      expect(t).toMatch(/category\s+TEXT\s+NOT NULL/);
    }
    const code = mig.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(title|url|name|email|endpoint)\b/i);
  });
});
