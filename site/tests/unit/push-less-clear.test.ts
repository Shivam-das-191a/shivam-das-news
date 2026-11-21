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
import * as K from '../../src/lib/push-client.js';
import { fakeIdb } from './helpers/fake-idb';

// v0.101.0 (Phase 9 part 8c-2): saving choices without a category clears its counted "Less like this" taps; the client passes suggestRemove on (PLAN 31.8).
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

const save = (post: any, me: any, prefs: any) => post('/preferences', { sub: me.sub, token: me.token, prefs });
const tapN = async (post: any, me: any, n: number, tag = 't1') => { for (let i = 0; i < n; i++) await less(post, me, tag); };

describe('the rule', () => {
  it('lists the categories that were followed and are not any more', () => {
    expect(F.removedCategories(['tech', 'Sports', 'world'], ['tech'])).toEqual(['sports', 'world']);
    expect(F.removedCategories(['tech'], ['TECH'])).toEqual([]);
    expect(F.removedCategories(['tech'], ['tech', 'world'])).toEqual([]);
    expect(F.removedCategories(['a', 'A', 'a'], [])).toEqual(['a']);
    expect(F.removedCategories(null, ['a'])).toEqual([]);
    expect(F.removedCategories(['a', '', 5 as any], null as any)).toEqual(['a', '5']);
  });
  it('the statement only names the reader and the list', () => {
    expect(F.CLEAR_LESS_SQL).toContain('DELETE FROM push_less');
    expect(F.CLEAR_LESS_SQL.match(/\?/g)).toHaveLength(2);
  });
});

describe('the client passes the offer on', () => {
  it('keeps only clean entries, at most 10', () => {
    expect(K.cleanOffer([{ category: ' Sports ', count: 3 }, { category: '', count: 3 }, { category: 'a', count: 1.5 }, { category: 'b', count: 0 }, { category: 7, count: 3 }, null, 'x'])).toEqual([{ category: 'sports', count: 3 }]);
    expect(K.cleanOffer(undefined)).toEqual([]);
    expect(K.cleanOffer({ category: 'a', count: 3 })).toEqual([]);
    expect(K.cleanOffer(Array.from({ length: 15 }, (_, i) => ({ category: 'c' + i, count: 3 })))).toHaveLength(10);
    expect(K.cleanOffer([{ category: 'x'.repeat(61), count: 3 }])).toEqual([]);
  });
});

withDb('clearing the counted taps', () => {
  it('removing the category clears its taps and the offer is gone', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    await tapN(post, me, 3);
    expect((await read(post, me)).suggestRemove).toHaveLength(1);
    const res = await save(post, me, { categories: [], breakingAll: true });
    expect(res.status).toBe(200);
    expect(lessRows(db, id)).toHaveLength(0);
    expect(await read(post, me)).not.toHaveProperty('suggestRemove');
  });
  it('only the removed category is cleared; the taps of another category stay', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    await save(post, me, { categories: ['technology', 'sports'] });
    addSent(db, id, 'p1', 'technology', 't1');
    addSent(db, id, 'p2', 'sports', 't2');
    await tapN(post, me, 3, 't1');
    await tapN(post, me, 3, 't2');
    await save(post, me, { categories: ['technology'] });
    const left = lessRows(db, id);
    expect(left).toHaveLength(3);
    expect(left.every((r: any) => r.category === 'technology')).toBe(true);
    expect((await read(post, me)).suggestRemove).toEqual([{ category: 'technology', count: 3 }]);
  });
  it('the taps of another reader are never touched', async () => {
    const { db, post, subscribe } = await setup();
    const one = await subscribe(1);
    const two = await subscribe(2);
    addSent(db, subRow(db, one.sub).id, 'p1', 'technology', 't1');
    addSent(db, subRow(db, two.sub).id, 'p2', 'technology', 't2');
    await tapN(post, one, 3, 't1');
    await tapN(post, two, 3, 't2');
    await save(post, one, { categories: [], breakingAll: true });
    expect(lessRows(db, subRow(db, one.sub).id)).toHaveLength(0);
    expect(lessRows(db, subRow(db, two.sub).id)).toHaveLength(3);
  });
  it('adding a category, or saving the same ones, clears nothing', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    await tapN(post, me, 3);
    await save(post, me, { categories: ['technology', 'sports'] });
    await save(post, me, { categories: ['Technology', 'sports'] });
    await save(post, me, { level: 'important' });
    await post('/preferences', { sub: me.sub, token: me.token, pause: 'day' });
    expect(lessRows(db, id)).toHaveLength(3);
  });
  it('a rejected save clears nothing', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    await tapN(post, me, 3);
    const res = await save(post, me, { categories: [], breakingAll: false });
    expect(res.status).toBe(400);
    expect(lessRows(db, id)).toHaveLength(3);
    expect((await read(post, me)).prefs.categories).toEqual(['technology']);
  });
  it('the weight and the reader\'s other choices are not changed by the clearing', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'p1', 'technology', 't1');
    await tapN(post, me, 3);
    const before = JSON.parse(subRow(db, me.sub).weights);
    await save(post, me, { categories: [], breakingAll: true });
    expect(JSON.parse(subRow(db, me.sub).weights)).toEqual(before);
    expect((await read(post, me)).prefs.breakingAll).toBe(true);
  });
  it('an old database without the table still saves the choices', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    db.exec('DROP TABLE push_less');
    const res = await save(post, me, { categories: [], breakingAll: true });
    expect(res.status).toBe(200);
    expect((await res.json()).prefs.categories).toEqual([]);
  });
});

withDb('the client reads the offer from the real Worker', () => {
  async function clientEnv(setupResult: any, me: any) {
    const store = K.idbStore(fakeIdb().idb);
    await store.set({ api: 'https://push.test', sub: me.sub, token: me.token, prefs: { categories: ['technology'] }, at: 1 });
    return {
      store,
      secure: true,
      now: () => Date.now(),
      tz: () => 'Asia/Kolkata',
      navigator: {},
      Notification: { permission: 'granted' },
      fetch: async (url: string, init: any) => setupResult.post(url.replace('https://push.test', ''), JSON.parse(init.body)),
    } as any;
  }
  const CFG2 = { endpoint: 'https://push.test', vapidPublicKey: vapid.publicKey };
  it('getPrefs gives suggestRemove with 3 taps, leaves the field out with 2, and one tap removes it for good', async () => {
    const t = await setup();
    const me = await t.subscribe();
    const id = subRow(t.db, me.sub).id;
    addSent(t.db, id, 'p1', 'technology', 't1');
    const env = await clientEnv(t, me);
    await tapN(t.post, me, 2);
    const two = await K.getPrefs({ cfg: CFG2, env });
    expect(two.ok).toBe(true);
    expect(two).not.toHaveProperty('suggestRemove');
    await tapN(t.post, me, 1);
    const three = await K.getPrefs({ cfg: CFG2, env });
    expect(three.suggestRemove).toEqual([{ category: 'technology', count: 3 }]);
    const saved = await K.savePrefs({ cfg: CFG2, prefs: { categories: [], breakingAll: true }, env });
    expect(saved.ok).toBe(true);
    const after = await K.getPrefs({ cfg: CFG2, env });
    expect(after.ok).toBe(true);
    expect(after).not.toHaveProperty('suggestRemove');
    expect(lessRows(t.db, id)).toHaveLength(0);
  });
});
