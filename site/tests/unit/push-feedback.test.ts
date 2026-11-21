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

// v0.98.0 (Phase 9 part 8a): POST /feedback of the push Worker and the rules in workers/push/feedback.js (PLAN 31.8).
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


const subRow = (db: any, sub: string) => db.prepare('SELECT * FROM push_subs WHERE endpoint_hash = ?').get(sub);
const addSent = (db: any, subId: number, key: string, category: string, thread: string, ts = 1_800_000_000_000) => {
  db.prepare('INSERT INTO push_posts (key, url, title, category, published_at, announced_at) VALUES (?, ?, ?, ?, ?, ?)').run(key, `https://news.test/${key}`, 'A title', category, ts, ts);
  db.prepare('INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, ?, ?, ?)').run(subId, key, ts, thread);
};
const weightsOf = (db: any, sub: string) => JSON.parse(subRow(db, sub).weights);

afterEach(() => vi.restoreAllMocks());

describe('the feedback rules', () => {
  it('open moves the weight 10 percent of the way to 1, and engagement goes up', () => {
    const a = F.applyFeedback({}, 0, 'Sports', 'open');
    expect(a).toEqual({ applied: true, weights: { sports: 0.1 }, engagement: 1 });
    const b = F.applyFeedback({ sports: 0.5 }, 1, 'sports', 'open');
    expect(b.weights.sports).toBe(0.55);
    expect(b.engagement).toBe(2);
  });
  it('close lowers by 0.04 and "less" by 0.25, engagement stays', () => {
    expect(F.applyFeedback({ sports: 0.1 }, 3, 'sports', 'close')).toEqual({ applied: true, weights: { sports: 0.06 }, engagement: 3 });
    expect(F.applyFeedback({ sports: 0.1 }, 3, 'sports', 'less')).toEqual({ applied: true, weights: { sports: -0.15 }, engagement: 3 });
  });
  it('the weight never leaves -1 and 1', () => {
    expect(F.applyFeedback({ a: -0.9 }, 0, 'a', 'less').weights.a).toBe(-1);
    let w: any = { a: 0.99 };
    for (let i = 0; i < 50; i++) w = F.applyFeedback(w, 0, 'a', 'open').weights;
    expect(w.a).toBeLessThanOrEqual(1);
  });
  it('an unknown event or an empty category changes nothing', () => {
    expect(F.applyFeedback({ a: 0.2 }, 1, 'a', 'shown').applied).toBe(false);
    expect(F.applyFeedback({ a: 0.2 }, 1, '', 'open').applied).toBe(false);
    expect(F.applyFeedback({ a: 0.2 }, 1, 'a', '__proto__').weights).toEqual({ a: 0.2 });
  });
  it('broken stored weights become a clean object', () => {
    expect(F.cleanWeights('not json')).toEqual({});
    expect(F.cleanWeights('[1,2]')).toEqual({});
    expect(F.cleanWeights('{"a": 5, "b": "x", "C": -3}')).toEqual({ a: 1, c: -1 });
  });
  it('the weights field has a size limit', () => {
    const w: any = {};
    for (let i = 0; i < F.MAX_WEIGHT_CATEGORIES; i++) w['c' + i] = 0.1;
    expect(F.applyFeedback(w, 0, 'new-one', 'open').applied).toBe(false);
    expect(F.applyFeedback(w, 0, 'c1', 'open').applied).toBe(true);
  });
  it('cleanTag keeps text only and cuts it', () => {
    expect(F.cleanTag(' abc ')).toBe('abc');
    expect(F.cleanTag(5)).toBe('');
    expect(F.cleanTag('x'.repeat(200)).length).toBe(F.TAG_MAX);
  });
});

withDb('POST /feedback', () => {
  it('open raises the weight of the category that was sent under the tag', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'Technology', 'phone-launch');
    const res = await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 'phone-launch' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: true });
    expect(weightsOf(db, me.sub)).toEqual({ technology: 0.1 });
    expect(subRow(db, me.sub).engagement).toBe(1);
  });
  it('close and "less" lower it; the reader choices stay', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    await post('/feedback', { sub: me.sub, token: me.token, event: 'close', tag: 't1' });
    await post('/feedback', { sub: me.sub, token: me.token, event: 'less', tag: 't1' });
    expect(weightsOf(db, me.sub)).toEqual({ technology: -0.29 });
    const terms = db.prepare("SELECT term FROM push_terms WHERE sub_id = ? AND kind = 'cat'").all(subRow(db, me.sub).id);
    expect(terms.map((t: any) => t.term)).toEqual(['technology']);
  });
  it('a tag that was never sent to this reader, the test tag and an empty tag change nothing', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    for (const tag of ['never-sent', 'test', '']) {
      const res = await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, applied: false });
    }
    expect(weightsOf(db, me.sub)).toEqual({});
  });
  it('an unknown event changes nothing and is not an error', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    const res = await post('/feedback', { sub: me.sub, token: me.token, event: 'shown', tag: 't1' });
    expect(res.status).toBe(200);
    expect((await res.json()).applied).toBe(false);
    expect(weightsOf(db, me.sub)).toEqual({});
  });
  it('a tag sent to another reader does not move my weight', async () => {
    const { db, post, subscribe } = await setup();
    const one = await subscribe(1);
    const two = await subscribe(2);
    addSent(db, subRow(db, one.sub).id, 'p1', 'technology', 't1');
    const res = await post('/feedback', { sub: two.sub, token: two.token, event: 'open', tag: 't1' });
    expect((await res.json()).applied).toBe(false);
    expect(weightsOf(db, two.sub)).toEqual({});
    expect(weightsOf(db, one.sub)).toEqual({});
  });
  it('the newest story under a tag decides the category', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const id = subRow(db, me.sub).id;
    addSent(db, id, 'old', 'sports', 't1', 1_800_000_000_000);
    addSent(db, id, 'new', 'world', 't1', 1_800_000_100_000);
    await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1' });
    expect(weightsOf(db, me.sub)).toEqual({ world: 0.1 });
  });
  it('a wrong token, a wrong sub and a wrong origin are refused and change nothing', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    expect((await post('/feedback', { sub: me.sub, token: 'A'.repeat(43), event: 'open', tag: 't1' })).status).toBe(403);
    expect((await post('/feedback', { sub: 'f'.repeat(32), token: me.token, event: 'open', tag: 't1' })).status).toBe(404);
    expect((await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1' }, { origin: 'https://evil.test' })).status).toBe(403);
    expect((await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1' }, { method: 'GET' })).status).toBe(405);
    expect(weightsOf(db, me.sub)).toEqual({});
  });
  it('an extra field is refused (exact fields)', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const res = await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1', title: 'text of a story' });
    expect(res.status).toBe(400);
  });
  it('the answer holds no category, weight or story text and is not cached', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    addSent(db, subRow(db, me.sub).id, 'p1', 'technology', 't1');
    const res = await post('/feedback', { sub: me.sub, token: me.token, event: 'open', tag: 't1' });
    const text = await res.text();
    expect(text).not.toContain('technology');
    expect(text).not.toContain('weight');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });
  it('the browser preflight is answered for the site', async () => {
    const { post } = await setup();
    const res = await post('/feedback', null, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });
});

describe('files', () => {
  it('the service worker and the Worker use the same names', () => {
    const sw = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8');
    expect(sw).toContain("'/feedback'");
    for (const e of F.FEEDBACK_EVENTS) expect(sw).toContain(`'${e}'`);
    expect(F.FEEDBACK_EVENTS).toEqual(['open', 'close', 'less']);
  });
});
