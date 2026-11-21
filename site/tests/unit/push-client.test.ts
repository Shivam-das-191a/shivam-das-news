import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fakeIdb } from './helpers/fake-idb';
import * as C from '../../src/lib/push-client.js';
// @ts-ignore plain JS Worker
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as V from '../../../workers/push/vapid.js';

const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-push-tests-0123456789';
const API = 'https://push.test';
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

const b64 = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');
const vapid = await V.generateVapidKeys();
const CFG = { endpoint: API, vapidPublicKey: vapid.publicKey };
const KEY_BYTES = new Uint8Array(Buffer.from(vapid.publicKey, 'base64url'));

/** A D1-shaped wrapper around a real in-memory SQLite database (the same idea as in push-endpoints.test.ts). */
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

/** A made-up browser with a push manager, plus the real push Worker behind fetch. */
function setup(o: { permission?: 'default' | 'granted' | 'denied'; ask?: 'granted' | 'denied' | 'default'; noDb?: boolean; fetchImpl?: (url: string, init: any, real: any) => Promise<Response>; stampImpl?: (url: string, init: any, real: any) => Promise<Response> } = {}) {
  const sqlite = Sqlite ? new Sqlite(':memory:') : null;
  if (sqlite) sqlite.exec(SCHEMA);
  const env0: any = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, ...(o.noDb || !sqlite ? {} : { DB: d1(sqlite) }) };
  let n = 0;
  let current: any = null;
  const makeSub = () => {
    n++;
    const sub: any = {
      endpoint: `https://fcm.googleapis.com/fcm/send/secret-endpoint-number-${n}`,
      options: { applicationServerKey: KEY_BYTES.buffer.slice(KEY_BYTES.byteOffset, KEY_BYTES.byteOffset + KEY_BYTES.length) },
      toJSON: () => ({ endpoint: sub.endpoint, keys: { p256dh: b64(new Uint8Array([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + n) % 256)])), auth: b64(new Uint8Array(Array.from({ length: 16 }, (_, i) => (i * 11 + n) % 256))) } }),
      unsubscribe: vi.fn(async () => {
        if (current === sub) current = null;
        return true;
      }),
    };
    return sub;
  };
  const reg: any = {
    pushManager: {
      getSubscription: vi.fn(async () => current),
      subscribe: vi.fn(async (opts: any) => {
        current = makeSub();
        current.options.applicationServerKey = opts.applicationServerKey.buffer.slice(opts.applicationServerKey.byteOffset, opts.applicationServerKey.byteOffset + opts.applicationServerKey.length);
        return current;
      }),
    },
  };
  const notification: any = {
    permission: o.permission ?? 'default',
    requestPermission: vi.fn(async () => {
      notification.permission = o.ask ?? 'granted';
      return o.ask ?? 'granted';
    }),
  };
  const sw = { register: vi.fn(async () => reg), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => (reg.registered === false ? undefined : reg)) };
  const idb = fakeIdb();
  const calls: { path: string; body: any; status?: number }[] = [];
  const stampCalls: { init: any; status?: number }[] = []; // v0.73.0: the GET /stamp calls are kept apart so `calls` holds only the messages
  const realFetch = async (url: string, init: any) => {
    return worker.fetch(new Request(url, { ...init, headers: { ...init.headers, Origin: SITE } }), env0);
  };
  const env: any = {
    navigator: { serviceWorker: sw },
    Notification: notification,
    secure: true,
    store: C.idbStore(idb.idb),
    now: () => 1_700_000_000_000,
    tz: () => 'Asia/Kolkata',
    fetch: vi.fn(async (url: string, init: any) => {
      const path = url.replace(API, '');
      if (path === '/stamp') {
        const stampEntry: any = { init };
        stampCalls.push(stampEntry);
        const r = o.stampImpl ? await o.stampImpl(url, init, realFetch) : await realFetch(url, init);
        stampEntry.status = r.status;
        return r;
      }
      const entry: any = { path, body: JSON.parse(init.body) };
      calls.push(entry);
      const res = o.fetchImpl ? await o.fetchImpl(url, init, realFetch) : await realFetch(url, init);
      entry.status = res.status;
      return res;
    }),
  };
  return { env, reg, sw, notification, idb, sqlite, calls, stampCalls, setCurrent: (s: any) => (current = s), current: () => current, makeSub: () => (current = makeSub()), rows: () => (sqlite ? sqlite.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n : 0) };
}

describe('pushConfig (the feature is off until config/push.json is filled)', () => {
  it('the shipped file is empty, so the feature is off', () => {
    const shipped = JSON.parse(readFileSync(new URL('../fixtures/shipped/config/push.json', import.meta.url), 'utf8'));
    expect(shipped).toEqual({ endpoint: '', vapidPublicKey: '' });
    expect(C.pushConfig(shipped)).toEqual({ enabled: false, api: '', key: '' });
  });

  it('is on with an https Worker address and a real public key; a slash at the end is removed', () => {
    expect(C.pushConfig(CFG)).toEqual({ enabled: true, api: API, key: vapid.publicKey });
    expect(C.pushConfig({ endpoint: `${API}/`, vapidPublicKey: vapid.publicKey }).api).toBe(API);
    expect(C.pushConfig({ endpoint: 'https://news-push.example.workers.dev', vapidPublicKey: ` ${vapid.publicKey} ` }).enabled).toBe(true);
  });

  it('stays off for every wrong value', () => {
    const k = vapid.publicKey;
    const bad: any[] = [
      null, undefined, 'x', [], {}, { endpoint: API }, { vapidPublicKey: k },
      { endpoint: 'http://push.test', vapidPublicKey: k },
      { endpoint: 'https://push.test/path', vapidPublicKey: k },
      { endpoint: 'https://push.test/?a=1', vapidPublicKey: k },
      { endpoint: 'https://push.test/#x', vapidPublicKey: k },
      { endpoint: 'https://user:pw@push.test', vapidPublicKey: k },
      { endpoint: 'https://push test', vapidPublicKey: k },
      { endpoint: 'push.test', vapidPublicKey: k },
      { endpoint: 5, vapidPublicKey: k },
      { endpoint: API, vapidPublicKey: 5 },
      { endpoint: API, vapidPublicKey: k.slice(0, 80) },
      { endpoint: API, vapidPublicKey: k + 'AA' },
      { endpoint: API, vapidPublicKey: 'not base64 !!' },
      { endpoint: API, vapidPublicKey: b64(Buffer.concat([Buffer.from([2]), Buffer.alloc(64, 1)])) }, // not the 0x04 form
    ];
    for (const cfg of bad) expect(C.pushConfig(cfg).enabled, JSON.stringify(cfg)).toBe(false);
  });

  it('turns the public key into the bytes the browser needs', () => {
    expect(Array.from(C.urlBase64ToBytes(vapid.publicKey)!)).toEqual(Array.from(KEY_BYTES));
    for (const bad of ['', 'a', 'ab+c', 'ab=c', null, undefined, 5]) expect(C.urlBase64ToBytes(bad as any)).toBeNull();
  });
});

describe('support and permission', () => {
  const full = () => ({ navigator: { serviceWorker: {} }, Notification: { permission: 'default', requestPermission: () => {} }, secure: true });
  it('needs a secure page, a service worker and notifications', () => {
    expect(C.support(full() as any)).toEqual({ ok: true });
    expect(C.support({ ...full(), secure: false } as any)).toEqual({ ok: false, reason: 'insecure' });
    expect(C.support({ ...full(), navigator: {} } as any)).toEqual({ ok: false, reason: 'unsupported' });
    expect(C.support({ ...full(), navigator: undefined } as any)).toEqual({ ok: false, reason: 'unsupported' });
    expect(C.support({ ...full(), Notification: undefined } as any)).toEqual({ ok: false, reason: 'unsupported' });
    expect(C.support({ ...full(), Notification: { permission: 'default' } } as any)).toEqual({ ok: false, reason: 'unsupported' });
  });
  it('reports the permission', () => {
    for (const p of ['granted', 'denied', 'default']) expect(C.permission({ ...full(), Notification: { permission: p, requestPermission: () => {} } } as any)).toBe(p);
    expect(C.permission({ ...full(), Notification: { permission: 'weird', requestPermission: () => {} } } as any)).toBe('default');
    expect(C.permission({ ...full(), secure: false } as any)).toBe('unsupported');
  });
});

describe('the small store', () => {
  it('saves, reads a copy, removes, and closes every connection', async () => {
    const f = fakeIdb();
    const s = C.idbStore(f.idb as any);
    expect(await s.get()).toBeNull();
    const value = { api: API, sub: 'x', nested: { a: 1 } };
    await s.set(value);
    const back = await s.get();
    expect(back).toEqual(value);
    expect(back).not.toBe(value);
    await s.del();
    expect(await s.get()).toBeNull();
    expect(f.stats.opened).toBe(f.stats.closed);
    expect(f.stats.opened).toBe(5);
  });
  it('readState gives null when the database is blocked or holds something odd', async () => {
    expect(await C.readState({ store: C.idbStore(fakeIdb({ failOpen: true }).idb as any) } as any)).toBeNull();
    expect(await C.readState({ store: { get: async () => 'text' } } as any)).toBeNull();
    expect(await C.readState({ store: { get: async () => null } } as any)).toBeNull();
  });
});

describe('enable before any request', () => {
  it('does nothing while the feature is off', async () => {
    const t = setup();
    for (const cfg of [{ endpoint: '', vapidPublicKey: '' }, undefined, {}]) expect(await C.enable({ cfg, env: t.env })).toEqual({ ok: false, reason: 'off' });
    expect(t.notification.requestPermission).not.toHaveBeenCalled();
    expect(t.sw.register).not.toHaveBeenCalled();
    expect(t.env.fetch).not.toHaveBeenCalled();
  });

  it('does nothing in a browser that cannot do push', async () => {
    const t = setup();
    t.env.secure = false;
    expect(await C.enable({ cfg: CFG, env: t.env })).toEqual({ ok: false, reason: 'insecure' });
    t.env.secure = true;
    t.env.navigator = {};
    expect(await C.enable({ cfg: CFG, env: t.env })).toEqual({ ok: false, reason: 'unsupported' });
    expect(t.notification.requestPermission).not.toHaveBeenCalled();
  });

  it('a denied permission is never asked again', async () => {
    const t = setup({ permission: 'denied' });
    expect(await C.enable({ cfg: CFG, env: t.env })).toEqual({ ok: false, reason: 'denied' });
    expect(t.notification.requestPermission).not.toHaveBeenCalled();
    expect(t.sw.register).not.toHaveBeenCalled();
  });

  it('the permission box answered "not now" or "block" stops everything: no worker, no subscription, no request', async () => {
    const closed = setup({ ask: 'default' });
    expect(await C.enable({ cfg: CFG, env: closed.env })).toEqual({ ok: false, reason: 'dismissed' });
    const blocked = setup({ ask: 'denied' });
    expect(await C.enable({ cfg: CFG, env: blocked.env })).toEqual({ ok: false, reason: 'denied' });
    for (const t of [closed, blocked]) {
      expect(t.sw.register).not.toHaveBeenCalled();
      expect(t.reg.pushManager.subscribe).not.toHaveBeenCalled();
      expect(t.env.fetch).not.toHaveBeenCalled();
    }
  });

  it('a browser that refuses to subscribe gives a plain error and never throws', async () => {
    const t = setup({ permission: 'granted' });
    t.reg.pushManager.subscribe.mockRejectedValue(new Error('push service not available'));
    const r = await C.enable({ cfg: CFG, env: t.env });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('error');
    expect(t.env.fetch).not.toHaveBeenCalled();
  });
});

withDb('enable, read, save and remove against the real push Worker', () => {
  it('subscribes: asks once, registers the worker file, uses the public key, saves only the id, the token and the choices', async () => {
    const t = setup();
    const r = await C.enable({ cfg: CFG, prefs: { categories: ['technology'], keywords: ['iPhone'] }, env: t.env });
    expect(r.ok).toBe(true);
    expect(r.created).toBe(true);
    expect(r.prefs.categories).toEqual(['technology']);
    expect(r.prefs.tz).toBe('Asia/Kolkata');
    expect(t.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(t.sw.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/' });
    const opts = t.reg.pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(Array.from(opts.applicationServerKey)).toEqual(Array.from(KEY_BYTES));
    expect(t.rows()).toBe(1);

    const state = await t.env.store.get();
    expect(Object.keys(state).sort()).toEqual(['api', 'at', 'prefs', 'sub', 'token']);
    expect(state.api).toBe(API);
    expect(state.sub).toMatch(/^[0-9a-f]{32}$/);
    expect(typeof state.token).toBe('string');
    expect(state.prefs.pause).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('secret-endpoint'); // the endpoint address stays a secret (BUGS P13)
    expect(JSON.stringify(state)).not.toContain('p256dh');
  });

  it('only the first request holds the endpoint address; nothing else ever does', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    await C.getPrefs({ cfg: CFG, env: t.env });
    await C.savePrefs({ cfg: CFG, prefs: { level: 'important' }, env: t.env });
    await C.disable({ cfg: CFG, env: t.env });
    const withEndpoint = t.calls.filter((c) => JSON.stringify(c.body).includes('secret-endpoint')).map((c) => c.path);
    expect(withEndpoint).toEqual(['/subscribe']);
    for (const c of t.calls) expect(Object.keys(c.body).sort()).not.toContain('endpoint');
  });

  it('enabling twice keeps the token and the single row (BUGS P18)', async () => {
    const t = setup({ permission: 'granted' });
    const a = await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const first = await t.env.store.get();
    const b = await C.enable({ cfg: CFG, env: t.env }); // no choices given: the saved ones are kept
    const second = await t.env.store.get();
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.prefs.categories).toEqual(['technology']);
    expect(second.token).toBe(first.token);
    expect(second.sub).toBe(first.sub);
    expect(t.rows()).toBe(1);
    expect(t.reg.pushManager.subscribe).toHaveBeenCalledTimes(1); // the browser subscription was reused
  });

  it('a refused choice gives the plain message and the field, saves nothing and removes the new browser subscription', async () => {
    const t = setup({ permission: 'granted' });
    const r = await C.enable({ cfg: CFG, prefs: { keywords: ['the'] }, env: t.env });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid');
    expect(r.field).toBe('keywords');
    expect(typeof r.error).toBe('string');
    expect(t.current()).toBeNull(); // no half state
    expect(await t.env.store.get()).toBeNull();
    expect(t.rows()).toBe(0);
  });

  it('a refused choice does not remove a browser subscription that was already there', async () => {
    const t = setup({ permission: 'granted' });
    const existing = t.makeSub();
    const r = await C.enable({ cfg: CFG, prefs: { level: 'nonsense' }, env: t.env });
    expect(r.reason).toBe('invalid');
    expect(r.field).toBe('level');
    expect(existing.unsubscribe).not.toHaveBeenCalled();
    expect(t.current()).toBe(existing);
  });

  it('a browser subscription made with another key is replaced (the owner changed the key pair)', async () => {
    const t = setup({ permission: 'granted' });
    const old = t.makeSub();
    old.options.applicationServerKey = new Uint8Array(65).fill(9).buffer;
    const r = await C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: t.env });
    expect(r.ok).toBe(true);
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(t.reg.pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(t.current()).not.toBe(old);
  });

  it('network down, too many new readers and a Worker without a database each give their own reason', async () => {
    const down = setup({ permission: 'granted', fetchImpl: async () => { throw new TypeError('offline'); } });
    const a = await C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: down.env });
    expect(a.reason).toBe('network');
    expect(down.current()).toBeNull();
    expect(await down.env.store.get()).toBeNull();

    const busy = setup({ permission: 'granted', fetchImpl: async () => new Response(JSON.stringify({ error: 'Too many new subscribers right now. Please try again later.' }), { status: 429 }) });
    const b = await C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: busy.env });
    expect(b).toMatchObject({ ok: false, reason: 'busy', error: 'Too many new subscribers right now. Please try again later.' });

    const noDb = setup({ permission: 'granted', noDb: true });
    const c = await C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: noDb.env });
    expect(c).toMatchObject({ ok: false, reason: 'error' });
    expect(noDb.current()).toBeNull();
  });

  it('reads the choices, saves changes and a pause, and keeps what the Worker confirmed', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'], keywords: ['iPhone launch'], level: 'balanced' }, env: t.env });
    const read = await C.getPrefs({ cfg: CFG, env: t.env });
    expect(read.ok).toBe(true);
    expect(read.prefs.keywords).toEqual(['iPhone launch']);
    expect(read.prefs.pause).toEqual({ mode: 'none', until: null });

    const saved = await C.savePrefs({ cfg: CFG, prefs: { level: 'important', muted: ['cricket'] }, env: t.env });
    expect(saved.ok).toBe(true);
    expect(saved.prefs.level).toBe('important');
    expect(saved.prefs.muted).toEqual(['cricket']);
    expect(saved.prefs.categories).toEqual(['technology']); // fields that were not sent keep their value

    const paused = await C.savePrefs({ cfg: CFG, pause: 'day', env: t.env });
    expect(paused.ok).toBe(true);
    expect(paused.prefs.pause.mode).toBe('timed');
    const state = await t.env.store.get();
    expect(state.prefs.level).toBe('important');
    expect(state.prefs.pause).toBeUndefined(); // the pause has its own field and is not kept as a choice

    const unpaused = await C.savePrefs({ cfg: CFG, pause: 'none', env: t.env });
    expect(unpaused.prefs.pause.mode).toBe('none');
  });

  it('a refused change gives the field and keeps the old choices', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const bad = await C.savePrefs({ cfg: CFG, prefs: { level: 'loud' }, env: t.env });
    expect(bad).toMatchObject({ ok: false, reason: 'invalid', field: 'level' });
    const badPause = await C.savePrefs({ cfg: CFG, pause: 'forever', env: t.env });
    expect(badPause).toMatchObject({ ok: false, reason: 'invalid', field: 'pause' });
    expect((await C.getPrefs({ cfg: CFG, env: t.env })).prefs.level).toBe('balanced');
  });

  it('a browser that never subscribed makes no request', async () => {
    const t = setup();
    expect(await C.getPrefs({ cfg: CFG, env: t.env })).toEqual({ ok: false, reason: 'not_subscribed' });
    expect(await C.savePrefs({ cfg: CFG, prefs: { level: 'important' }, env: t.env })).toEqual({ ok: false, reason: 'not_subscribed' });
    expect(t.env.fetch).not.toHaveBeenCalled();
    for (const fn of [C.getPrefs, C.savePrefs, C.disable]) expect(await (fn as any)({ cfg: { endpoint: '', vapidPublicKey: '' }, env: t.env })).toEqual({ ok: false, reason: 'off' });
  });

  it('a lost or old token is fixed quietly: the same browser subscription gets a new token and keeps its choices (BUGS P23)', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'], keywords: ['iPhone launch'], level: 'important' }, env: t.env });
    const before = await t.env.store.get();
    await t.env.store.set({ ...before, token: 'X'.repeat(43) }); // a token the Worker does not know
    const r = await C.savePrefs({ cfg: CFG, prefs: { dailyLimit: 1 }, env: t.env });
    expect(r.ok).toBe(true);
    expect(r.prefs.dailyLimit).toBe(1);
    expect(r.prefs.level).toBe('important'); // the choices came back with the new token
    expect(r.prefs.keywords).toEqual(['iPhone launch']);
    const after = await t.env.store.get();
    expect(after.token).not.toBe(before.token);
    expect(after.token).not.toBe('X'.repeat(43));
    expect(after.sub).toBe(before.sub);
    expect(t.rows()).toBe(1);
    expect(t.notification.requestPermission).toHaveBeenCalledTimes(1); // no second permission box
    expect(t.reg.pushManager.subscribe).toHaveBeenCalledTimes(1); // no second browser subscription
  });

  it('another tab that was quicker: its newer token is used and no new subscription is made', async () => {
    let swapped = false;
    const holder: { t?: ReturnType<typeof setup>; goodToken?: string } = {};
    const t = setup({
      fetchImpl: async (url, init, real) => {
        const res = await real(url, init);
        if (!swapped && url.endsWith('/preferences') && res.status === 403) {
          swapped = true;
          const s = await holder.t!.env.store.get();
          await holder.t!.env.store.set({ ...s, token: holder.goodToken }); // the other tab saved its token while this call was running
        }
        return res;
      },
    });
    holder.t = t;
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const s = await t.env.store.get();
    holder.goodToken = s.token;
    await t.env.store.set({ ...s, token: 'Y'.repeat(43) }); // this tab holds an old token
    const r = await C.getPrefs({ cfg: CFG, env: t.env });
    expect(r.ok).toBe(true);
    expect(t.calls.filter((c) => c.path === '/subscribe')).toHaveLength(1);
    expect(t.calls.filter((c) => c.path === '/preferences').map((c) => c.status)).toEqual([403, 200]);
  });

  it('a reader the Worker no longer has (404) is restored from the last confirmed choices', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'], level: 'everything' }, env: t.env });
    t.sqlite.exec('DELETE FROM push_terms; DELETE FROM push_subs;');
    expect(t.rows()).toBe(0);
    const r = await C.getPrefs({ cfg: CFG, env: t.env });
    expect(r.ok).toBe(true);
    expect(r.prefs.categories).toEqual(['technology']);
    expect(r.prefs.level).toBe('everything');
    expect(t.rows()).toBe(1);
  });

  it('without a browser subscription, a bad token asks the page to turn notifications on again, and never opens the permission box', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const s = await t.env.store.get();
    await t.env.store.set({ ...s, token: 'Z'.repeat(43) });
    t.setCurrent(null); // the browser dropped the push subscription
    const r = await C.getPrefs({ cfg: CFG, env: t.env });
    expect(r).toMatchObject({ ok: false, reason: 'resubscribe' });
    expect(t.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(t.reg.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it('a permission that was taken back stops the quiet fix too', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const s = await t.env.store.get();
    await t.env.store.set({ ...s, token: 'Z'.repeat(43) });
    t.notification.permission = 'denied';
    expect(await C.getPrefs({ cfg: CFG, env: t.env })).toMatchObject({ ok: false, reason: 'resubscribe' });
  });

  it('"Unsubscribe and delete my data": the Worker first, then this browser; every table is empty and the state is gone', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'], keywords: ['iPhone launch'] }, env: t.env });
    const sub = t.current();
    const r = await C.disable({ cfg: CFG, env: t.env });
    expect(r).toEqual({ ok: true, serverRemoved: true });
    expect(t.rows()).toBe(0);
    expect(t.sqlite.prepare('SELECT COUNT(*) AS n FROM push_terms').get().n).toBe(0);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(t.current()).toBeNull();
    expect(await t.env.store.get()).toBeNull();
    expect(await C.status({ cfg: CFG, env: t.env })).toMatchObject({ subscribed: false, hasState: false });
  });

  it('if the Worker cannot be reached nothing is removed, so the reader can try again', async () => {
    let down = false;
    const t = setup({ fetchImpl: async (url, init, real) => { if (down) throw new TypeError('offline'); return real(url, init); } });
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    down = true;
    const r = await C.disable({ cfg: CFG, env: t.env });
    expect(r).toMatchObject({ ok: false, reason: 'network' });
    expect(t.current()).not.toBeNull();
    expect(await t.env.store.get()).not.toBeNull();
    expect(t.rows()).toBe(1);
    down = false;
    expect(await C.disable({ cfg: CFG, env: t.env })).toEqual({ ok: true, serverRemoved: true });
    expect(t.rows()).toBe(0);
  });

  it('a reader whose token is lost and who can still prove the subscription is removed on the Worker too', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const s = await t.env.store.get();
    await t.env.store.set({ ...s, token: 'Q'.repeat(43) });
    expect(await C.disable({ cfg: CFG, env: t.env })).toEqual({ ok: true, serverRemoved: true });
    expect(t.rows()).toBe(0);
  });

  it('a reader who cannot prove who they are is cleared in this browser and told the server copy is left to expire', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const s = await t.env.store.get();
    await t.env.store.set({ ...s, token: 'Q'.repeat(43) });
    t.setCurrent(null);
    expect(await C.disable({ cfg: CFG, env: t.env })).toEqual({ ok: true, serverRemoved: false });
    expect(await t.env.store.get()).toBeNull();
    expect(t.rows()).toBe(1); // the Worker deletes it by itself when the push service says it is gone
  });

  it('with nothing saved, disable still removes a browser subscription of this site', async () => {
    const t = setup({ permission: 'granted' });
    const sub = t.makeSub();
    expect(await C.disable({ cfg: CFG, env: t.env })).toEqual({ ok: true, serverRemoved: false });
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(t.env.fetch).not.toHaveBeenCalled();
  });

  it('status tells the page what to show', async () => {
    const t = setup();
    expect(await C.status({ cfg: CFG, env: t.env })).toEqual({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false });
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    expect(await C.status({ cfg: CFG, env: t.env })).toEqual({ enabled: true, supported: true, permission: 'granted', subscribed: true, hasState: true });
    expect(await C.status({ cfg: { endpoint: '', vapidPublicKey: '' }, env: t.env })).toEqual({ enabled: false, supported: true, permission: 'granted', subscribed: false, hasState: false });
  });

  it('nothing is printed to the console and nothing throws, even when everything fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      const t = setup({ permission: 'granted', fetchImpl: async () => { throw new Error('https://fcm.googleapis.com/fcm/send/secret-endpoint-number-1'); } });
      await C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: t.env });
      await C.getPrefs({ cfg: CFG, env: t.env });
      await C.savePrefs({ cfg: CFG, prefs: { level: 'important' }, env: t.env });
      await C.disable({ cfg: CFG, env: t.env });
      await C.status({ cfg: CFG, env: t.env });
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

describe('requests', () => {
  it('give up after 15 seconds and send no cookies', async () => {
    vi.useFakeTimers();
    try {
      let init: any;
      const t = setup({ permission: 'granted', fetchImpl: (_u, i) => { init = i; return new Promise((_r, rej) => i.signal.addEventListener('abort', () => rej(new Error('aborted')))); } });
      t.makeSub();
      let result: any;
      C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: t.env }).then((r: any) => (result = r));
      await vi.waitFor(() => expect(init).toBeDefined()); // the stamp comes first (v0.73.0), then the /subscribe call that hangs
      await vi.advanceTimersByTimeAsync(14900);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(200);
      expect(result).toMatchObject({ ok: false, reason: 'network' });
      expect(init.credentials).toBe('omit');
      expect(init.cache).toBe('no-store');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.method).toBe('POST');
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---- v0.73.0 (BOT_PROTECTION Part 3b): the stamp before /subscribe ----
withDb('the stamp before /subscribe (v0.73.0)', () => {
  it('asks for a stamp with a plain GET right before subscribing and sends it back as `stamp`', async () => {
    const t = setup();
    const r = await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    expect(r.ok).toBe(true);
    expect(t.stampCalls).toHaveLength(1);
    const g = t.stampCalls[0].init;
    expect(g.method).toBe('GET');
    expect(g.credentials).toBe('omit');
    expect(g.cache).toBe('no-store');
    expect(g.body).toBeUndefined();
    expect(t.calls[0].path).toBe('/subscribe');
    expect(t.calls[0].body.stamp).toMatch(/^\d{13}\.[0-9a-f]{64}$/);
    expect(Object.keys(t.calls[0].body).sort()).toEqual(['prefs', 'stamp', 'subscription']);
  });
  it('enabling twice asks for a new stamp each time; other calls ask for none', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    expect(t.stampCalls).toHaveLength(2);
    await C.getPrefs({ cfg: CFG, env: t.env });
    await C.savePrefs({ cfg: CFG, prefs: { dailyLimit: 2 }, env: t.env });
    expect(t.stampCalls).toHaveLength(2);
    expect(t.calls.filter((c) => c.path !== '/subscribe').every((c) => !('stamp' in c.body))).toBe(true);
  });
  it('the quiet fix of a lost token also asks for a stamp', async () => {
    const t = setup();
    await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    const before = await t.env.store.get();
    await t.env.store.set({ ...before, token: 'X'.repeat(43) });
    expect((await C.savePrefs({ cfg: CFG, prefs: { dailyLimit: 1 }, env: t.env })).ok).toBe(true);
    expect(t.stampCalls).toHaveLength(2);
    expect(t.calls.filter((c) => c.path === '/subscribe').every((c) => typeof c.body.stamp === 'string')).toBe(true);
  });
  it('when the Worker says `reload` it asks for a new stamp and repeats the call once', async () => {
    let first = true;
    const t = setup({
      fetchImpl: async (url, init, real) => {
        if (first) {
          first = false;
          return new Response(JSON.stringify({ error: 'This page is old. Please reload it and try again.', reload: true }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return real(url, init);
      },
    });
    const r = await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    expect(r.ok).toBe(true);
    expect(t.stampCalls).toHaveLength(2);
    expect(t.calls.filter((c) => c.path === '/subscribe')).toHaveLength(2);
  });
  it('a Worker that keeps saying `reload` is tried only twice, then the reader gets a plain message and no half state', async () => {
    const t = setup({
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Please reload the page and try again.', reload: true }), { status: 400, headers: { 'Content-Type': 'application/json' } }),
    });
    const r = await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env });
    expect(r).toMatchObject({ ok: false, reason: 'invalid' });
    expect(t.stampCalls).toHaveLength(2);
    expect(t.rows()).toBe(0);
    expect(await t.env.store.get()).toBeNull();
  });
  it('no stamp: switched off or not ready (503) is a plain error; no network is the network reason; nothing is saved and the new browser subscription is removed', async () => {
    const off = setup({ stampImpl: async () => new Response(JSON.stringify({ error: 'off' }), { status: 503, headers: { 'Content-Type': 'application/json' } }) });
    const a = await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: off.env });
    expect(a).toMatchObject({ ok: false, reason: 'error' });
    expect(off.calls).toHaveLength(0); // /subscribe was never called
    expect(off.rows()).toBe(0);
    expect(off.current()).toBeNull(); // the fresh browser subscription was removed again

    const down = setup({ stampImpl: async () => { throw new Error('offline'); } });
    expect(await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: down.env })).toMatchObject({ ok: false, reason: 'network' });
    expect(down.calls).toHaveLength(0);
  });
  it('a stamp answer without a stamp is treated as not ready', async () => {
    const t = setup({ stampImpl: async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(await C.enable({ cfg: CFG, prefs: { categories: ['technology'] }, env: t.env })).toMatchObject({ ok: false, reason: 'error' });
    expect(t.calls).toHaveLength(0);
  });
  it('the stamp request gives up after 15 seconds and sends no cookies', async () => {
    vi.useFakeTimers();
    try {
      let init: any;
      const t = setup({ permission: 'granted', stampImpl: (_u, i) => { init = i; return new Promise((_r, rej) => i.signal.addEventListener('abort', () => rej(new Error('aborted')))); } });
      t.makeSub();
      let result: any;
      C.enable({ cfg: CFG, prefs: { categories: ['world'] }, env: t.env }).then((r: any) => (result = r));
      await vi.advanceTimersByTimeAsync(15100);
      expect(result).toMatchObject({ ok: false, reason: 'network' });
      expect(init.credentials).toBe('omit');
      expect(init.method).toBe('GET');
    } finally {
      vi.useRealTimers();
    }
  });
});
