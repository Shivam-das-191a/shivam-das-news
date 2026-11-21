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
import { buildPayload, hasEmoji, TITLE_MAX, BODY_MAX } from '../../../workers/push/lib.js';

// v0.62.0 (Phase 9 part 5c-5): POST /test of the push Worker, "send me a test notification".
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

const row = (db: any, sub: string) => db.prepare('SELECT * FROM push_subs WHERE endpoint_hash = ?').get(sub);

afterEach(() => vi.restoreAllMocks());

describe('the test message', () => {
  it('is fixed text, has no emoji, fits the limits and points to the preference page', () => {
    const post = P.testPost(SITE);
    const built = buildPayload(post, { thread: 'test' });
    expect(built.ok).toBe(true);
    expect(built.payload.title).toBe(P.TEST_TITLE);
    expect(built.payload.body).toBe(P.TEST_BODY);
    expect(built.payload.url).toBe('https://news.test/notifications/?pn=1');
    expect(built.payload.tag).toBe('test');
    expect(built.payload.breaking).toBe(false);
    expect(built.payload.image).toBeUndefined();
    expect(hasEmoji(P.TEST_TITLE) || hasEmoji(P.TEST_BODY)).toBe(false);
    expect([...P.TEST_TITLE].length).toBeLessThanOrEqual(TITLE_MAX);
    expect([...P.TEST_BODY].length).toBeLessThanOrEqual(BODY_MAX);
  });
  it('a slash at the end of the site address does not make a double slash', () => {
    expect(P.testPost('https://news.test/').url).toBe('https://news.test/notifications/');
  });
  it('the gap is one minute and the time to live is short', () => {
    expect(P.TEST_GAP_MS).toBe(60000);
    expect(P.TEST_TTL_SEC).toBeLessThanOrEqual(300);
  });
});

withDb('POST /test', () => {
  it('sends one encrypted message to the reader\'s own browser', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(svc.seen).toHaveLength(1);
    const { url, init } = svc.seen[0];
    expect(url).toBe(me.endpoint);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(init.headers['Content-Encoding']).toBe('aes128gcm');
    expect(init.headers.TTL).toBe(String(P.TEST_TTL_SEC));
    expect(init.headers.Urgency).toBe('high');
    expect(init.headers.Topic).toBe('test');
    // the text is encrypted: the plain words are not in the body
    expect(Buffer.from(init.body).toString('latin1')).not.toContain('Test notification');
  });

  it('never returns the push address, the keys or the message text', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(201).fn });
    const text = await res.text();
    expect(text).not.toContain('secret-test-endpoint');
    expect(text).not.toContain(P.TEST_BODY);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });

  it('a second test inside a minute is refused and sends nothing', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    let now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    expect((await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn })).status).toBe(200);
    now += 30_000;
    const second = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn });
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/wait a minute/i);
    expect(svc.seen).toHaveLength(1);
    now += 31_000; // 61 seconds after the first
    expect((await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn })).status).toBe(200);
    expect(svc.seen).toHaveLength(2);
  });

  it('two taps at the same moment send only one message', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    const [a, b] = await Promise.all([post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn }), post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn })]);
    expect([a.status, b.status].sort()).toEqual([200, 429]);
    expect(svc.seen).toHaveLength(1);
  });

  it('each reader has their own minute', async () => {
    const { post, subscribe } = await setup();
    const one = await subscribe(1);
    const two = await subscribe(2);
    const svc = pushService(201);
    expect((await post('/test', { sub: one.sub, token: one.token }, { fetchFn: svc.fn })).status).toBe(200);
    expect((await post('/test', { sub: two.sub, token: two.token }, { fetchFn: svc.fn })).status).toBe(200);
    expect(svc.seen.map((s) => s.url)).toEqual([one.endpoint, two.endpoint]);
  });

  it('a test is not a real send: the daily counters and the duplicate guard stay as they were', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const before = row(db, me.sub);
    await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(201).fn });
    const after = row(db, me.sub);
    expect(after.sent_today).toBe(before.sent_today);
    expect(after.sent_day).toBe(before.sent_day);
    expect(after.last_sent).toBe(before.last_sent);
    expect(after.failures).toBe(before.failures);
    expect(after.last_test).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_sent').get().n).toBe(0);
  });

  it('a paused reader can still send a test', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const paused = await post('/preferences', { sub: me.sub, token: me.token, pause: 'until_on' });
    expect(paused.status).toBe(200);
    expect((await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(201).fn })).status).toBe(200);
  });

  it('without the sender keys it answers 503, sends nothing and does not use up the minute', async () => {
    const { post, subscribe, env, db } = await setup({});
    const me = await subscribe();
    const svc = pushService(201);
    const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not switched on/i);
    expect(svc.seen).toHaveLength(0);
    expect(row(db, me.sub).last_test).toBeNull();
    Object.assign(env, KEYS); // the owner sets the keys: the very next tap works
    expect((await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn })).status).toBe(200);
  });

  it('a wrong contact address or a key that does not match is the same 503', async () => {
    for (const bad of [{ ...KEYS, VAPID_SUBJECT: 'not an address' }, { ...KEYS, VAPID_PRIVATE_KEY: (await V.generateVapidKeys()).privateKey }, { ...KEYS, VAPID_PRIVATE_KEY: 'short' }]) {
      const { post, subscribe } = await setup(bad);
      const me = await subscribe();
      const svc = pushService(201);
      expect((await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn })).status).toBe(503);
      expect(svc.seen).toHaveLength(0);
    }
  });

  it('checks who is asking: no id, wrong token, unknown reader', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    expect((await post('/test', {}, { fetchFn: svc.fn })).status).toBe(401);
    expect((await post('/test', { sub: me.sub, token: P.newToken() }, { fetchFn: svc.fn })).status).toBe(403);
    expect((await post('/test', { sub: 'a'.repeat(32), token: me.token }, { fetchFn: svc.fn })).status).toBe(404);
    expect(svc.seen).toHaveLength(0);
  });

  it('only the site itself may call, and only with POST', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    expect((await post('/test', { sub: me.sub, token: me.token }, { origin: 'https://evil.test', fetchFn: svc.fn })).status).toBe(403);
    expect((await post('/test', { sub: me.sub, token: me.token }, { origin: null, fetchFn: svc.fn })).status).toBe(403);
    expect((await post('/test', null, { method: 'GET', fetchFn: svc.fn })).status).toBe(405);
    expect(svc.seen).toHaveLength(0);
  });

  it('the push service says the browser is gone (410 or 404): the reader is removed and told to turn notifications on again', async () => {
    for (const status of [410, 404]) {
      const { db, post, subscribe } = await setup();
      const me = await subscribe();
      const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(status).fn });
      expect(res.status).toBe(410);
      expect((await res.json()).reason).toBe('gone');
      expect(row(db, me.sub)).toBeUndefined();
      expect(db.prepare('SELECT COUNT(*) AS n FROM push_terms').get().n).toBe(0);
    }
  });

  it('browser keys that cannot be used remove the reader too', async () => {
    const { db, post } = await setup();
    const bad = { endpoint: endpointOf(9), keys: { p256dh: Buffer.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256)]).toString('base64url'), auth: randomBytes(16).toString('base64url') } };
    const j = await (await post('/subscribe', { subscription: bad, prefs: { categories: ['technology'] } })).json();
    const res = await post('/test', { sub: j.sub, token: j.token }, { fetchFn: pushService(201).fn });
    expect(res.status).toBe(410);
    expect(row(db, j.sub)).toBeUndefined();
  });

  it('a busy push service (429, 500) is a 502 and the reader stays', async () => {
    for (const status of [429, 500, 503]) {
      const { db, post, subscribe } = await setup();
      const me = await subscribe();
      const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(status).fn });
      expect(res.status).toBe(502);
      expect((await res.json()).error).toMatch(/busy/i);
      expect(row(db, me.sub)).toBeTruthy();
    }
  });

  it('a network error is a 502 and the reader stays', async () => {
    const { db, post, subscribe } = await setup();
    const me = await subscribe();
    const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: vi.fn(async () => { throw new Error('offline'); }) });
    expect(res.status).toBe(502);
    expect(row(db, me.sub)).toBeTruthy();
  });

  it('a push service that refuses our key (401, 403, 400) shows only a general sentence', async () => {
    for (const status of [401, 403, 400, 413]) {
      const { db, post, subscribe } = await setup();
      const me = await subscribe();
      const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: pushService(status).fn });
      expect(res.status).toBe(503);
      const text = await res.text();
      expect(text).not.toContain('secret-test-endpoint');
      expect(text).not.toMatch(/vapid|token|key/i);
      expect(row(db, me.sub)).toBeTruthy();
    }
  });

  it('a database that fails while taking the slot sends nothing', async () => {
    const { env, post, subscribe } = await setup();
    const me = await subscribe();
    const real = env.DB.prepare;
    env.DB.prepare = (sql: string) => {
      if (sql.startsWith('UPDATE push_subs SET last_test')) throw new Error('db down');
      return real(sql);
    };
    const svc = pushService(201);
    const res = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn });
    expect(res.status).toBe(500);
    expect(svc.seen).toHaveLength(0);
  });

  it('anything extra in the request (a title, a text, an address) is refused (v0.73.0) and nothing is sent', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    const svc = pushService(201);
    const res = await post('/test', { sub: me.sub, token: me.token, title: 'Free money', url: 'https://evil.test', endpoint: 'https://evil.test/x' }, { fetchFn: svc.fn });
    expect(res.status).toBe(400);
    expect(svc.seen).toHaveLength(0);
    const ok = await post('/test', { sub: me.sub, token: me.token }, { fetchFn: svc.fn });
    expect(ok.status).toBe(200);
    expect(svc.seen[0].url).toBe(me.endpoint);
  });

  it('the old routes still work', async () => {
    const { post, subscribe } = await setup();
    const me = await subscribe();
    expect((await post('/preferences', { sub: me.sub, token: me.token })).status).toBe(200);
    expect((await post('/unsubscribe', { sub: me.sub, token: me.token })).status).toBe(200);
  });
});

describe('the database file', () => {
  it('has the last_test column', () => {
    expect(SCHEMA).toMatch(/last_test\s+INTEGER/);
  });
  it('the slot statement changes only last_test', () => {
    expect(P.CLAIM_TEST_SQL).toMatch(/^UPDATE push_subs SET last_test = \? WHERE endpoint_hash = \?/);
    expect(P.CLAIM_TEST_SQL).not.toMatch(/last_sent|sent_today/);
  });
});
