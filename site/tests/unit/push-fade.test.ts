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


const addSub = (db: any, n: number, weights: string, status = 'active', engagement = 0) => {
  db.prepare(
    "INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, weights, engagement, status, created, last_seen) VALUES (?, ?, 'k', 'a', 't', ?, ?, ?, 1, 1)",
  ).run(`https://push.example/${n}`, `h${n}`, weights, engagement, status);
  return db.prepare('SELECT id FROM push_subs WHERE endpoint_hash = ?').get(`h${n}`).id;
};
const wOf = (db: any, id: number) => db.prepare('SELECT weights FROM push_subs WHERE id = ?').get(id).weights;
const freshDb = () => {
  const db = new Sqlite(':memory:');
  db.exec(SCHEMA);
  return db;
};
const d1db = (db: any) => ({
  prepare: (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async run() { const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
  }),
});

describe('the fade rules', () => {
  it('5 percent a week, in one run an hour', () => {
    expect(F.FADE_PER_WEEK).toBe(0.05);
    expect(F.FADE_RUNS_PER_WEEK).toBe(168);
    expect(F.FADE_FACTOR ** 168).toBeCloseTo(0.95, 10);
    expect(F.FADE_FACTOR).toBeLessThan(1);
    expect(F.FADE_FACTOR).toBeGreaterThan(0.999);
  });
  it('one run changes a weight a little and is not rounded away', () => {
    const w = F.fadeWeights({ sports: 0.1, world: -0.5 });
    expect(w.sports).toBeLessThan(0.1);
    expect(w.sports).toBeGreaterThan(0.0999);
    expect(w.world).toBeGreaterThan(-0.5);
  });
  it('after a week of runs a weight is 95 percent of what it was, and the sign stays', () => {
    let w: any = { a: 0.4, b: -0.8 };
    for (let i = 0; i < 168; i++) w = F.fadeWeights(w);
    expect(w.a).toBeCloseTo(0.38, 3);
    expect(w.b).toBeCloseTo(-0.76, 3);
  });
  it('a weight that is almost zero is removed, a broken value is dropped', () => {
    expect(F.fadeWeights({ tiny: 0.005001 })).toEqual({});
    expect(F.fadeWeights({ a: 'x', b: 0.5 })).toHaveProperty('b');
    expect(F.fadeWeights({ a: 'x' })).toEqual({});
    expect(F.fadeWeights('not json')).toEqual({});
  });
  it('a weight never grows and never changes sign', () => {
    for (const v of [0.9, 0.2, 0.0051, -0.9, -0.2]) {
      const out: any = F.fadeWeights({ a: v });
      if ('a' in out) {
        expect(Math.abs(out.a)).toBeLessThan(Math.abs(v));
        expect(Math.sign(out.a)).toBe(Math.sign(v));
      }
    }
  });
});

withDb('runFade on a real database', () => {
  it('fades every reader with one statement and keeps their other numbers', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"sports":0.4,"world":-0.8}', 'active', 7);
    const b = addSub(db, 2, '{"tech":0.2}');
    const r = await F.runFade(d1db(db));
    expect(r).toEqual({ ok: true, faded: 2 });
    expect(JSON.parse(wOf(db, a)).sports).toBeLessThan(0.4);
    expect(JSON.parse(wOf(db, a)).world).toBeGreaterThan(-0.8);
    expect(JSON.parse(wOf(db, b)).tech).toBeLessThan(0.2);
    expect(db.prepare('SELECT engagement FROM push_subs WHERE id = ?').get(a).engagement).toBe(7);
  });
  it('the SQL gives the same numbers as the plain code', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"sports":0.4,"world":-0.8,"tiny":0.005001}');
    await F.runFade(d1db(db));
    expect(JSON.parse(wOf(db, a))).toEqual(F.fadeWeights({ sports: 0.4, world: -0.8, tiny: 0.005001 }));
  });
  it('168 runs make 95 percent', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"sports":0.4}');
    for (let i = 0; i < 168; i++) await F.runFade(d1db(db));
    expect(JSON.parse(wOf(db, a)).sports).toBeCloseTo(0.38, 3);
  });
  it('a reader with no weights, a gone reader and broken text are not touched', async () => {
    const db = freshDb();
    const empty = addSub(db, 1, '{}');
    const gone = addSub(db, 2, '{"a":0.5}', 'gone');
    const broken = addSub(db, 3, 'not json');
    const r = await F.runFade(d1db(db));
    expect(r).toEqual({ ok: true, faded: 0 });
    expect(wOf(db, empty)).toBe('{}');
    expect(wOf(db, gone)).toBe('{"a":0.5}');
    expect(wOf(db, broken)).toBe('not json');
  });
  it('a paused reader fades too (the habits of a reader fade with time, not with sending)', async () => {
    const db = freshDb();
    const p = addSub(db, 1, '{"a":0.5}', 'paused');
    await F.runFade(d1db(db));
    expect(JSON.parse(wOf(db, p)).a).toBeLessThan(0.5);
  });
  it('the last small weight is removed and the text becomes {}', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"a":0.005001}');
    await F.runFade(d1db(db));
    expect(wOf(db, a)).toBe('{}');
  });
});

describe('runFade without a database', () => {
  it('says no_db and never throws', async () => {
    expect(await F.runFade(undefined)).toEqual({ ok: false, reason: 'no_db' });
    expect(await F.runFade({ prepare() { throw new Error('boom'); } })).toEqual({ ok: false, reason: 'error' });
  });
});

withDb('the hourly tick', () => {
  const NOW = Date.parse('2026-11-16T10:07:00Z');
  it('fades at the clean-up minute, with the paused switch on and no sender keys', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"a":0.5}');
    await worker.scheduled({ scheduledTime: NOW }, { DB: d1db(db), PUSH_PAUSED: 'true' }, undefined, async () => { throw new Error('no network'); });
    // the tiny stand-in database has run() only for the fade; the clean-up part fails by itself and must not stop the fade
    expect(JSON.parse(wOf(db, a)).a).toBeLessThan(0.5);
  });
  it('does nothing at another minute', async () => {
    const db = freshDb();
    const a = addSub(db, 1, '{"a":0.5}');
    await worker.scheduled({ scheduledTime: NOW + 60000 }, { DB: d1db(db) }, undefined, async () => { throw new Error('no network'); });
    expect(wOf(db, a)).toBe('{"a":0.5}');
  });
  it('the tick answer says how many readers faded', async () => {
    const db = freshDb();
    addSub(db, 1, '{"a":0.5}');
    const r = await C.runCleanupTick({ DB: d1db(db) }, NOW);
    expect(r.ran).toBe(true);
    expect(r.faded).toBe(1);
  });
});

describe('fade files', () => {
  it('the fade is called from the clean-up tick only', () => {
    const control = readFileSync(new URL('../../../workers/push/control.js', import.meta.url), 'utf8');
    expect(control).toMatch(/import \{ runFade[^}]*\} from '\.\/feedback\.js'/);
    expect(control).toContain('runFade(env.DB)');
  });
});
