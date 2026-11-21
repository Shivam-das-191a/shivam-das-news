import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as P from '../../../workers/push/prefs.js';
// @ts-ignore plain JS Worker code
import { MAX_TERMS } from '../../../workers/push/lib.js';
// @ts-ignore plain JS Worker code
import { issueStamp } from '../../../workers/shared/guard.js';

const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-push-tests-0123456789';
/** A valid stamp for /subscribe (v0.73.0). The minimum age is 0 for the push Worker. */
const stampNow = () => issueStamp(SECRET, Date.now(), 'push-subscribe');
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');

// node:sqlite exists in Node 22.5 and newer. Where it is missing (Node 20) the database tests are skipped, the rule tests still run.
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const p256 = () => b64url(new Uint8Array([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256)]));
const auth = () => b64url(new Uint8Array(Array.from({ length: 16 }, (_, i) => (i * 11 + 5) % 256)));
const subscription = (n = 1) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/secret-endpoint-number-${n}`, keys: { p256dh: p256(), auth: auth() } });

/** A D1-shaped wrapper around a real in-memory SQLite database. failAt makes the Nth statement of a batch fail. */
function d1(db: any, o: { failAt?: number } = {}) {
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
        for (let i = 0; i < statements.length; i++) {
          if (o.failAt !== undefined && i === o.failAt) throw new Error('db down');
          out.push(await statements[i].run());
        }
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function freshDb() {
  const db = new Sqlite(':memory:');
  db.exec(SCHEMA);
  return db;
}

// v0.73.0: JSON only, and /subscribe needs a stamp (added here unless the test says `stamp: false` or sends its own).
const call = async (path: string, body: any, o: { origin?: string | null; method?: string; country?: string; headers?: Record<string, string>; stamp?: boolean } = {}, env: any = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(o.headers ?? {}) };
  if (o.origin !== null) headers.Origin = o.origin ?? SITE;
  if (o.country) headers['CF-IPCountry'] = o.country;
  const init: any = { method: o.method ?? 'POST', headers };
  if ((o.method ?? 'POST') === 'POST') {
    let b = body;
    if (path === '/subscribe' && o.stamp !== false && b && typeof b === 'object' && !Array.isArray(b) && b.stamp === undefined) b = { ...b, stamp: await stampNow() };
    init.body = typeof b === 'string' ? b : JSON.stringify(b);
  }
  return worker.fetch(new Request('https://push.test' + path, init), { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, ...env });
};

const subscribeBody = (n = 1, prefs: any = { categories: ['technology'], keywords: ['iPhone'], tz: 'Asia/Kolkata' }, extra: any = {}) => ({ subscription: subscription(n), prefs, ...extra });

describe('cleanSubscription', () => {
  it('accepts a normal browser subscription', () => {
    const s = subscription();
    expect(P.cleanSubscription(s)).toEqual({ ok: true, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth });
  });
  it('refuses an address that is not a plain https push address', () => {
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://intranet/x', 'javascript:alert(1)', 'not a url', 'https://fcm.googleapis.com/a b', '', 5, null]) {
      expect(P.cleanSubscription({ ...subscription(), endpoint }).ok, String(endpoint)).toBe(false);
    }
    expect(P.cleanSubscription({ ...subscription(), endpoint: 'https://fcm.googleapis.com/' + 'a'.repeat(800) }).ok).toBe(false);
  });
  it('refuses keys of the wrong size or form', () => {
    const s = subscription();
    expect(P.cleanSubscription({ ...s, keys: { ...s.keys, p256dh: 'AAAA' } }).ok).toBe(false);
    expect(P.cleanSubscription({ ...s, keys: { ...s.keys, auth: 'AAAA' } }).ok).toBe(false);
    expect(P.cleanSubscription({ ...s, keys: { ...s.keys, p256dh: 'A' + s.keys.p256dh.slice(1) } }).ok).toBe(false); // must start with the 0x04 byte
    expect(P.cleanSubscription({ ...s, keys: { ...s.keys, auth: 'not base64 !!' + 'a'.repeat(10) } }).ok).toBe(false);
    expect(P.cleanSubscription({ endpoint: s.endpoint }).ok).toBe(false);
    expect(P.cleanSubscription(null).ok).toBe(false);
    expect(P.cleanSubscription([]).ok).toBe(false);
  });
});

describe('hashes and token', () => {
  it('makes a stable 32 character id from the endpoint and never contains the endpoint', async () => {
    const a = await P.endpointHash('https://x.test/one');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await P.endpointHash('https://x.test/one')).toBe(a);
    expect(await P.endpointHash('https://x.test/two')).not.toBe(a);
    expect(P.isSubId(a)).toBe(true);
    expect(P.isSubId('short')).toBe(false);
  });
  it('makes a new random token of 43 characters each time and stores a 64 character hash', async () => {
    const t1 = P.newToken();
    const t2 = P.newToken();
    expect(t1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t1).not.toBe(t2);
    expect(P.isTokenForm(t1)).toBe(true);
    expect(P.isTokenForm('x'.repeat(42))).toBe(false);
    const h = await P.tokenHash(t1);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t1);
  });
  it('safeEqual compares texts of equal length only', () => {
    expect(P.safeEqual('abc', 'abc')).toBe(true);
    expect(P.safeEqual('abc', 'abd')).toBe(false);
    expect(P.safeEqual('abc', 'abcd')).toBe(false);
    expect(P.safeEqual('abc', undefined)).toBe(false);
  });
});

describe('country and the consent rule', () => {
  it('reads two letters only', () => {
    expect(P.countryOf('in')).toBe('IN');
    for (const v of ['', 'XX', 'T1', 'IND', '1', null, undefined]) expect(P.countryOf(v as any), String(v)).toBeNull();
  });
  it('asks for consent in the list and where the country is unknown', () => {
    const list = P.consentList('de, fr ,GB');
    expect(list).toEqual(['DE', 'FR', 'GB']);
    expect(P.needsConsent('DE', list)).toBe(true);
    expect(P.needsConsent('IN', list)).toBe(false);
    expect(P.needsConsent(null, list)).toBe(true);
  });
  it('"Learn from what I read" starts on outside the list and off inside it or when unknown (PLAN 31.1)', () => {
    const list = P.consentList('DE');
    expect(P.defaultPrefs('IN', list).learn).toBe(true);
    expect(P.defaultPrefs('DE', list).learn).toBe(false);
    expect(P.defaultPrefs(null, list).learn).toBe(false);
  });
});

describe('cleanPrefs', () => {
  const base = P.defaultPrefs('IN', []);
  const ok = (input: any, from: any = base) => {
    const r = P.cleanPrefs(input, from);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    return r.prefs;
  };
  const refused = (input: any, field: string, from: any = base) => {
    const r = P.cleanPrefs(input, from);
    expect(r.ok, JSON.stringify(input)).toBe(false);
    expect(r.field).toBe(field);
    expect(typeof r.error).toBe('string');
    return r;
  };

  it('starts from the plan defaults: balanced, 4 a day, breaking news on, quiet 22:00 to 07:00, digest off', () => {
    const p = ok(undefined);
    expect(p).toMatchObject({ level: 'balanced', dailyLimit: 4, breakingAll: true, breakingInQuiet: false, quiet: { start: 1320, end: 420 }, digest: { mode: 'off' }, tz: 'UTC', categories: [], keywords: [] });
  });
  it('the daily limit default follows the level, and a chosen limit is kept', () => {
    expect(ok({ level: 'important' }).dailyLimit).toBe(2);
    expect(ok({ level: 'everything' }).dailyLimit).toBe(8);
    expect(ok({ level: 'everything', dailyLimit: 1 }).dailyLimit).toBe(1);
    refused({ dailyLimit: 3 }, 'dailyLimit');
    refused({ dailyLimit: '4' }, 'dailyLimit');
    refused({ level: 'loud' }, 'level');
  });
  it('lower-cases category and author names and removes repeats', () => {
    const p = ok({ categories: ['Technology', 'technology', ' world-news '], authors: ['Shivam-Das'] });
    expect(p.categories).toEqual(['technology', 'world-news']);
    expect(p.authors).toEqual(['shivam-das']);
  });
  it('refuses a category or author that is not a plain name', () => {
    refused({ categories: ['Tech nology'] }, 'categories');
    refused({ categories: ['../etc'] }, 'categories');
    refused({ categories: ['<script>'] }, 'categories');
    refused({ categories: [5] }, 'categories');
    refused({ categories: 'technology' }, 'categories');
    refused({ authors: ['a'.repeat(61)] }, 'authors');
    refused({ categories: Array.from({ length: 61 }, (_, i) => 'c' + i) }, 'categories');
  });
  it('keeps keywords as written and treats iPhone and iPhones as one (BUGS P8)', () => {
    const p = ok({ keywords: ['  iPhone ', 'iPhones', 'World   Cup'] });
    expect(p.keywords).toEqual(['iPhone', 'World Cup']);
    expect(P.storedKeyword('iPhone')).toBe(P.storedKeyword('iPhones'));
  });
  it('refuses keyword abuse: script text, emoji, too long, too many words, too many terms, too common', () => {
    refused({ keywords: ['<script>alert(1)</script>'] }, 'keywords');
    refused({ keywords: ['launch \u{1F600}'] }, 'keywords');
    refused({ keywords: ['a'.repeat(41)] }, 'keywords');
    refused({ keywords: ['one two three four five'] }, 'keywords');
    refused({ keywords: ['news'] }, 'keywords');
    refused({ keywords: Array.from({ length: 11 }, (_, i) => 'topic' + String.fromCharCode(97 + i) + 'word') }, 'keywords');
    refused({ muted: ['<img src=x>'] }, 'muted');
    ok({ keywords: Array.from({ length: 10 }, (_, i) => 'topic' + String.fromCharCode(97 + i) + 'word') });
  });
  it('refuses to follow and mute the same keyword', () => {
    refused({ keywords: ['iPhone'], muted: ['iPhones'] }, 'muted');
    ok({ keywords: ['iPhone'], muted: ['Android'] });
  });
  it('checks quiet hours: HH:MM, not equal, null turns them off', () => {
    expect(ok({ quiet: { start: '23:30', end: '06:15' } }).quiet).toEqual({ start: 1410, end: 375 });
    expect(ok({ quiet: null }).quiet).toBeNull();
    refused({ quiet: { start: '22:00', end: '22:00' } }, 'quiet');
    refused({ quiet: { start: '24:00', end: '07:00' } }, 'quiet');
    refused({ quiet: { start: '7:00', end: '08:00' } }, 'quiet');
    refused({ quiet: { start: 1320, end: 420 } }, 'quiet');
    refused({ quiet: 'night' }, 'quiet');
    expect(P.parseClock('22:00')).toBe(1320);
    expect(P.formatClock(375)).toBe('06:15');
  });
  it('checks the digest and keeps its hours', () => {
    expect(ok({ digest: { mode: 'both', morning: 7, evening: 21 } }).digest).toEqual({ mode: 'both', morning: 7, evening: 21 });
    expect(P.digestHours({ mode: 'off', morning: 8, evening: 20 })).toEqual([]);
    expect(P.digestHours({ mode: 'morning', morning: 8, evening: 20 })).toEqual([8]);
    expect(P.digestHours({ mode: 'evening', morning: 8, evening: 20 })).toEqual([20]);
    expect(P.digestHours({ mode: 'both', morning: 8, evening: 20 })).toEqual([8, 20]);
    refused({ digest: { mode: 'often' } }, 'digest');
    refused({ digest: { mode: 'morning', morning: 13 } }, 'digest');
    refused({ digest: { mode: 'evening', evening: 9 } }, 'digest');
    refused({ digest: { mode: 'morning', morning: 8.5 } }, 'digest');
  });
  it('accepts only a zone NAME (BUGS P6)', () => {
    expect(ok({ tz: 'Asia/Kolkata' }).tz).toBe('Asia/Kolkata');
    refused({ tz: '+05:30' }, 'tz');
    refused({ tz: 'Mars/Base' }, 'tz');
    refused({ tz: 5 }, 'tz');
  });
  it('keeps the reading habit only while "Learn from what I read" is on, at most 3 names', () => {
    expect(ok({ learn: true, topCategories: ['sports', 'tech'] }).topCategories).toEqual(['sports', 'tech']);
    expect(ok({ learn: false, topCategories: ['sports'] }).topCategories).toEqual([]);
    refused({ learn: true, topCategories: ['a', 'b', 'c', 'd'] }, 'topCategories');
  });
  it('needs at least one category, one keyword or Breaking news (PLAN 31.1)', () => {
    refused({ breakingAll: false }, 'choice');
    ok({ breakingAll: false, categories: ['technology'] });
    ok({ breakingAll: false, keywords: ['iPhone'] });
    refused({ breakingAll: false, authors: ['shivam-das'] }, 'choice'); // an author alone is not enough in the plan
  });
  it('refuses wrong types and keeps fields that were not sent', () => {
    refused({ breakingAll: 'yes' }, 'breakingAll');
    refused({ learn: 1 }, 'learn');
    expect(P.cleanPrefs([], base).ok).toBe(false);
    expect(P.cleanPrefs('x', base).ok).toBe(false);
    const saved = ok({ categories: ['technology'], level: 'important' });
    expect(ok({ keywords: ['iPhone'] }, saved)).toMatchObject({ categories: ['technology'], level: 'important', dailyLimit: 2, keywords: ['iPhone'] });
  });
});

describe('term rows, pause and SQL pieces', () => {
  it('makes the rows the audience search and the preference page need', () => {
    const p = P.cleanPrefs({ categories: ['technology'], authors: ['shivam-das'], keywords: ['iPhone 17 launch'], muted: ['Android'] }, P.defaultPrefs('IN', [])).prefs;
    const rows = P.termRows(p);
    const has = (kind: string, term: string) => rows.some((r: string[]) => r[0] === kind && r[1] === term);
    expect(has('cat', 'technology')).toBe(true);
    expect(has('author', 'shivam-das')).toBe(true);
    expect(has('kwtext', 'iPhone 17 launch')).toBe(true);
    expect(has('kw', P.storedKeyword('iPhone 17 launch'))).toBe(true);
    for (const t of P.storedKeyword('iPhone 17 launch').split(' ')) expect(has('kwtok', t), t).toBe(true);
    expect(has('mutetext', 'Android')).toBe(true);
    expect(has('mute', P.storedKeyword('Android'))).toBe(true);
    expect(new Set(rows.map((r: string[]) => r.join('|'))).size).toBe(rows.length); // no repeated rows
  });
  it('splits many rows into INSERT statements that stay under 100 values', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ['cat', 'c' + i]);
    const stmts = P.insertTermStatements('a'.repeat(32), rows);
    expect(stmts.length).toBe(5);
    for (const s of stmts) expect(s.values.length).toBeLessThanOrEqual(100);
    expect(stmts.reduce((n: number, s: any) => n + (s.values.length - 1) / 2, 0)).toBe(200);
    expect(P.insertTermStatements('a'.repeat(32), [])).toEqual([]);
  });
  it('pause: none, one day, one week, until the reader turns it on', () => {
    expect(P.pauseState('none', 1000)).toEqual({ status: 'active', pausedUntil: null });
    expect(P.pauseState('day', 1000)).toEqual({ status: 'active', pausedUntil: 1000 + 86400000 });
    expect(P.pauseState('week', 1000)).toEqual({ status: 'active', pausedUntil: 1000 + 7 * 86400000 });
    expect(P.pauseState('until_on', 1000)).toEqual({ status: 'paused', pausedUntil: null });
    expect(P.pauseState('forever', 1000)).toBeNull();
  });
  it('parseBody accepts one JSON object only', () => {
    expect(P.parseBody('{"a":1}')).toEqual({ a: 1 });
    for (const t of ['', '[]', '5', 'null', 'not json', '{"a":"' + 'x'.repeat(P.MAX_BODY) + '"}']) expect(P.parseBody(t), t.slice(0, 20)).toBeNull();
  });
  it('the code has no logging, so an endpoint address cannot reach a log (BUGS P13)', () => {
    for (const f of ['index.js', 'prefs.js']) expect(readFileSync(new URL('../../../workers/push/' + f, import.meta.url), 'utf8')).not.toMatch(/console\./);
  });
});

describe('the HTTP rules (no database needed)', () => {
  it('answers 404 for another path and 405 for a wrong method', async () => {
    expect((await call('/other', {})).status).toBe(404);
    const r = await call('/subscribe', '', { method: 'GET' });
    expect(r.status).toBe(405);
    expect(r.headers.get('Allow')).toContain('POST');
  });
  it('answers the browser preflight for the site only', async () => {
    const ok = await call('/subscribe', '', { method: 'OPTIONS' });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const other = await call('/subscribe', '', { method: 'OPTIONS', origin: 'https://evil.test' });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('refuses a call from another site, from no site, and when SITE_ORIGIN is not set', async () => {
    expect((await call('/subscribe', subscribeBody(), { origin: 'https://evil.test' }, { DB: {} })).status).toBe(403);
    expect((await call('/subscribe', subscribeBody(), { origin: null }, { DB: {} })).status).toBe(403);
    expect((await call('/subscribe', subscribeBody(), {}, { DB: {}, SITE_ORIGIN: '' })).status).toBe(403);
    const r = await call('/subscribe', subscribeBody(), { origin: 'https://evil.test' }, { DB: {} });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('refuses with 503 when there is no database, and stores nothing', async () => {
    expect((await call('/subscribe', subscribeBody())).status).toBe(503);
  });
  it('answers 413 for a body that is too large and 400 for one that is not a JSON object', async () => {
    expect((await call('/subscribe', 'x'.repeat(P.MAX_BODY + 1), {}, { DB: {} })).status).toBe(413);
    expect((await call('/subscribe', 'not json', {}, { DB: {} })).status).toBe(400);
    expect((await call('/subscribe', '[]', {}, { DB: {} })).status).toBe(400);
  });
  it('gives a plain 400 with the field name for a bad subscription or bad choices, before any database call', async () => {
    const prepare = vi.fn();
    const env = { DB: { prepare } };
    const a = await call('/subscribe', { subscription: { endpoint: 'http://x.test/a', keys: {} }, prefs: {} }, {}, env);
    expect(a.status).toBe(400);
    expect((await a.json()).field).toBe('subscription');
    const b = await call('/subscribe', subscribeBody(1, { keywords: ['<b>'] }), {}, env);
    expect(b.status).toBe(400);
    expect((await b.json()).field).toBe('keywords');
    expect(prepare).not.toHaveBeenCalled();
  });
  it('a failing rate limiter blocks a busy visitor and does not block when it breaks', async () => {
    const busy = { limit: async () => ({ success: false }) };
    expect((await call('/subscribe', subscribeBody(), {}, { DB: {}, RATE_LIMITER: busy })).status).toBe(429);
    const broken = { limit: async () => { throw new Error('limiter down'); } };
    expect((await call('/subscribe', subscribeBody(), {}, { RATE_LIMITER: broken })).status).toBe(503); // passes the limiter, stops at the missing database
  });
});

withDb('subscribe, preferences and unsubscribe on a real SQLite database', () => {
  const rows = (db: any, sql: string, ...v: any[]) => db.prepare(sql).all(...v);
  const subRow = (db: any, n = 1) => db.prepare('SELECT * FROM push_subs WHERE endpoint = ?').get(subscription(n).endpoint);
  const termsOf = (db: any, kind: string) => rows(db, 'SELECT term FROM push_terms WHERE kind = ? ORDER BY term', kind).map((r: any) => r.term);
  const setup = () => {
    const db = freshDb();
    return { db, env: { DB: d1(db) } };
  };
  const subscribe = async (env: any, n = 1, prefs?: any, extra: any = {}, country = 'IN') => {
    const r = await call('/subscribe', subscribeBody(n, prefs, extra), { country }, env);
    return { r, json: await r.json() };
  };

  it('stores one subscriber with its choices and gives back a sub id and a token, never the endpoint or the keys', async () => {
    const { db, env } = setup();
    const { r, json } = await subscribe(env);
    expect(r.status).toBe(200);
    expect(json).toMatchObject({ ok: true, created: true });
    expect(json.sub).toMatch(/^[0-9a-f]{32}$/);
    expect(json.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const text = JSON.stringify(json);
    const s = subscription(1);
    for (const secret of [s.endpoint, s.keys.p256dh, s.keys.auth, 'secret-endpoint-number']) expect(text).not.toContain(secret);
    expect(json.prefs).toMatchObject({ categories: ['technology'], keywords: ['iPhone'], level: 'balanced', dailyLimit: 4, tz: 'Asia/Kolkata', quiet: { start: '22:00', end: '07:00' } });

    const row = subRow(db);
    expect(row).toMatchObject({ endpoint_hash: json.sub, level: 'balanced', daily_limit: 4, tz: 'Asia/Kolkata', quiet_start: 1320, quiet_end: 420, breaking_all: 1, status: 'active', country: 'IN', failures: 0 });
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(json.token);
    expect(termsOf(db, 'cat')).toEqual(['technology']);
    expect(termsOf(db, 'kwtext')).toEqual(['iPhone']);
    expect(termsOf(db, 'kw')).toEqual([P.storedKeyword('iPhone')]);
    expect(termsOf(db, 'kwtok')).toEqual([P.storedKeyword('iPhone')]);
  });

  it('stores no IP address, name, email or browser text: the table has no such column and only two country letters are kept', () => {
    const { db } = setup();
    const cols = rows(db, 'PRAGMA table_info(push_subs)').map((c: any) => c.name);
    for (const banned of ['ip', 'ip_address', 'name', 'email', 'user_agent', 'ua']) expect(cols).not.toContain(banned);
  });

  it('learn starts on outside the consent list, off inside it, off when the country is unknown', async () => {
    const a = setup();
    await subscribe(a.env, 1, undefined, {}, 'IN');
    expect(subRow(a.db, 1).learn_on).toBe(1);
    const b = setup();
    await subscribe(b.env, 1, undefined, {}, 'DE');
    expect(subRow(b.db, 1).learn_on).toBe(0);
    const c = setup();
    const r = await call('/subscribe', subscribeBody(1, undefined), {}, c.env);
    expect(r.status).toBe(200);
    expect(subRow(c.db, 1).learn_on).toBe(0);
    expect(subRow(c.db, 1).country).toBeNull();
  });

  it('subscribing twice with one endpoint gives one row (BUGS P18) and keeps the token of the browser that shows it', async () => {
    const { db, env } = setup();
    const first = (await subscribe(env)).json;
    const again = await subscribe(env, 1, { categories: ['sports'] }, { sub: first.sub, token: first.token });
    expect(again.r.status).toBe(200);
    expect(again.json.created).toBe(false);
    expect(again.json.token).toBeUndefined();
    expect(rows(db, 'SELECT id FROM push_subs').length).toBe(1);
    expect(termsOf(db, 'cat')).toEqual(['sports']); // replaced, not added
    expect(termsOf(db, 'kwtext')).toEqual([]);
    // the old token still works
    const read = await call('/preferences', { sub: first.sub, token: first.token }, {}, env);
    expect(read.status).toBe(200);
  });

  it('a browser that lost its token proves it owns the subscription with the endpoint and gets a new token; the old one stops working', async () => {
    const { env } = setup();
    const first = (await subscribe(env)).json;
    const again = (await subscribe(env)).json; // no sub and no token sent
    expect(again.created).toBe(false);
    expect(again.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(again.token).not.toBe(first.token);
    expect((await call('/preferences', { sub: first.sub, token: first.token }, {}, env)).status).toBe(403);
    expect((await call('/preferences', { sub: again.sub, token: again.token }, {}, env)).status).toBe(200);
  });

  it('a wrong token sent with a subscribe does not keep the old token either', async () => {
    const { env } = setup();
    const first = (await subscribe(env)).json;
    const again = (await subscribe(env, 1, undefined, { sub: first.sub, token: P.newToken() })).json;
    expect(again.token).toBeDefined();
    expect(again.token).not.toBe(first.token);
  });

  it('keeps the counters, learned weights and engagement when the same browser subscribes again', async () => {
    const { db, env } = setup();
    const first = (await subscribe(env)).json;
    db.prepare("UPDATE push_subs SET sent_today = 3, weights = '{\"technology\":0.5}', engagement = 7.5, failures = 4, last_sent = 12345").run();
    await subscribe(env, 1, undefined, { sub: first.sub, token: first.token });
    const row = subRow(db);
    expect(row).toMatchObject({ sent_today: 3, weights: '{"technology":0.5}', engagement: 7.5, last_sent: 12345, failures: 0, status: 'active' });
  });

  it('refuses a new subscriber when 200 joined in the last hour, but lets a known browser update', async () => {
    const { db, env } = setup();
    const known = (await subscribe(env, 1)).json;
    const ins = db.prepare("INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, created, last_seen) VALUES (?, ?, 'k', 'a', 't', ?, ?)");
    for (let i = 0; i < P.NEW_SUBS_PER_HOUR; i++) ins.run('https://x.test/' + i, 'h' + i, Date.now(), Date.now());
    const blocked = await subscribe(env, 2);
    expect(blocked.r.status).toBe(429);
    expect(subRow(db, 2)).toBeUndefined();
    const update = await subscribe(env, 1, { categories: ['world'] }, { sub: known.sub, token: known.token });
    expect(update.r.status).toBe(200);
    // an old row does not count: move all the rows to two hours ago
    db.prepare('UPDATE push_subs SET created = ?').run(Date.now() - 2 * 3600000);
    expect((await subscribe(env, 3)).r.status).toBe(200);
  });

  it('saves everything or nothing: a failure in the middle leaves the old choices as they were', async () => {
    const db = freshDb();
    const okEnv = { DB: d1(db) };
    const first = (await subscribe(okEnv, 1, { categories: ['technology'], keywords: ['iPhone'] })).json;
    const failing = { DB: d1(db, { failAt: 2 }) };
    const r = await call('/preferences', { sub: first.sub, token: first.token, prefs: { categories: ['sports', 'world'], keywords: ['Olympics', 'World Cup'], level: 'everything' } }, {}, failing);
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toMatch(/db down/);
    expect(termsOf(db, 'cat')).toEqual(['technology']);
    expect(termsOf(db, 'kwtext')).toEqual(['iPhone']);
    expect(subRow(db).level).toBe('balanced');
    // a failing first subscribe leaves no half subscriber
    const db2 = freshDb();
    const r2 = await call('/subscribe', subscribeBody(1), {}, { DB: d1(db2, { failAt: 2 }) });
    expect(r2.status).toBe(500);
    expect(rows(db2, 'SELECT id FROM push_subs').length).toBe(0);
    expect(rows(db2, 'SELECT * FROM push_terms').length).toBe(0);
  });

  it('refuses a subscribe whose choices are not allowed and writes nothing', async () => {
    const { db, env } = setup();
    const r = await call('/subscribe', subscribeBody(1, { breakingAll: false }), {}, env);
    expect(r.status).toBe(400);
    expect((await r.json()).field).toBe('choice');
    expect(rows(db, 'SELECT id FROM push_subs').length).toBe(0);
  });

  it('reads the saved choices back as the reader wrote them (not as stems) with quiet hours as text', async () => {
    const { env } = setup();
    const { json: s } = await subscribe(env, 1, { categories: ['technology', 'world'], keywords: ['iPhone launches'], muted: ['Android'], level: 'important', dailyLimit: 1, quiet: { start: '23:00', end: '06:30' }, digest: { mode: 'both', morning: 7, evening: 21 }, authors: ['shivam-das'], breakingInQuiet: true });
    const r = await call('/preferences', { sub: s.sub, token: s.token }, {}, env);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.prefs).toMatchObject({
      categories: ['technology', 'world'],
      authors: ['shivam-das'],
      keywords: ['iPhone launches'],
      muted: ['Android'],
      level: 'important',
      dailyLimit: 1,
      breakingAll: true,
      breakingInQuiet: true,
      quiet: { start: '23:00', end: '06:30' },
      digest: { mode: 'both', morning: 7, evening: 21 },
      pause: { mode: 'none', until: null },
    });
    const text = JSON.stringify(j);
    expect(text).not.toContain('secret-endpoint-number');
    expect(text).not.toContain('token_hash');
  });

  it('answers 401, 404 and 403 for no or bad sub, unknown sub and wrong token, and changes nothing', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env);
    expect((await call('/preferences', { sub: 'nope', token: s.token }, {}, env)).status).toBe(401);
    expect((await call('/preferences', { sub: s.sub }, {}, env)).status).toBe(401);
    expect((await call('/preferences', { sub: 'f'.repeat(32), token: s.token }, {}, env)).status).toBe(404);
    expect((await call('/preferences', { sub: s.sub, token: P.newToken(), prefs: { categories: ['x'] } }, {}, env)).status).toBe(403);
    expect(termsOf(db, 'cat')).toEqual(['technology']);
    db.prepare("UPDATE push_subs SET status = 'gone'").run();
    expect((await call('/preferences', { sub: s.sub, token: s.token }, {}, env)).status).toBe(404);
  });

  it('changes only what is sent and replaces the lists that are sent', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env, 1, { categories: ['technology', 'world'], keywords: ['iPhone', 'Pixel'], muted: ['Android'], level: 'important' });
    const r = await call('/preferences', { sub: s.sub, token: s.token, prefs: { categories: ['sports'], keywords: ['Olympics'] } }, {}, env);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.prefs).toMatchObject({ categories: ['sports'], keywords: ['Olympics'], muted: ['Android'], level: 'important', dailyLimit: 2 });
    expect(termsOf(db, 'cat')).toEqual(['sports']);
    expect(termsOf(db, 'kwtext')).toEqual(['Olympics']);
    expect(termsOf(db, 'mutetext')).toEqual(['Android']);
    expect(termsOf(db, 'kwtok')).toEqual(P.storedKeyword('Olympics').split(' ').sort());
    expect(subRow(db).level).toBe('important');
  });

  it('refuses a change that leaves no choice and keeps the old ones', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env);
    const r = await call('/preferences', { sub: s.sub, token: s.token, prefs: { categories: [], keywords: [], breakingAll: false } }, {}, env);
    expect(r.status).toBe(400);
    expect((await r.json()).field).toBe('choice');
    expect(termsOf(db, 'cat')).toEqual(['technology']);
  });

  it('weights and engagement are never changed by a preference save, and a choice stays until the reader removes it (BUGS P21)', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env, 1, { categories: ['technology', 'sports'] });
    db.prepare("UPDATE push_subs SET weights = '{\"sports\":-0.9}', engagement = 3").run();
    await call('/preferences', { sub: s.sub, token: s.token, prefs: { level: 'everything' } }, {}, env);
    expect(subRow(db)).toMatchObject({ weights: '{"sports":-0.9}', engagement: 3 });
    expect(termsOf(db, 'cat')).toEqual(['sports', 'technology']);
  });

  it('pause: one day, one week, until turned on, and back to none; a save without "pause" keeps it', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env);
    const pause = async (mode: any) => call('/preferences', { sub: s.sub, token: s.token, pause: mode }, {}, env);
    const before = Date.now();
    let j = await (await pause('day')).json();
    expect(j.prefs.pause.mode).toBe('timed');
    const row1 = subRow(db);
    expect(row1.status).toBe('active');
    expect(row1.paused_until).toBeGreaterThanOrEqual(before + 86400000);
    expect(row1.paused_until).toBeLessThanOrEqual(Date.now() + 86400000);
    await call('/preferences', { sub: s.sub, token: s.token, prefs: { level: 'important' } }, {}, env);
    expect(subRow(db).paused_until).toBe(row1.paused_until); // kept
    await pause('week');
    expect(subRow(db).paused_until).toBeGreaterThan(row1.paused_until + 5 * 86400000);
    j = await (await pause('until_on')).json();
    expect(j.prefs.pause).toEqual({ mode: 'until_on', until: null });
    expect(subRow(db)).toMatchObject({ status: 'paused', paused_until: null });
    j = await (await pause('none')).json();
    expect(j.prefs.pause.mode).toBe('none');
    expect(subRow(db)).toMatchObject({ status: 'active', paused_until: null });
    const bad = await pause('forever');
    expect(bad.status).toBe(400);
    expect((await bad.json()).field).toBe('pause');
  });

  it('a new subscribe from the same browser ends a pause (the reader pressed Subscribe)', async () => {
    const { db, env } = setup();
    const { json: s } = await subscribe(env);
    await call('/preferences', { sub: s.sub, token: s.token, pause: 'until_on' }, {}, env);
    await subscribe(env, 1, undefined, { sub: s.sub, token: s.token });
    expect(subRow(db)).toMatchObject({ status: 'active', paused_until: null });
  });

  it('unsubscribe removes the reader from every table and leaves other readers alone (BUGS P19)', async () => {
    const { db, env } = setup();
    const a = (await subscribe(env, 1, { categories: ['technology'], keywords: ['iPhone'], muted: ['Android'], authors: ['shivam-das'] })).json;
    const b = (await subscribe(env, 2, { categories: ['sports'] })).json;
    const idA = subRow(db, 1).id;
    const idB = subRow(db, 2).id;
    for (const id of [idA, idB]) {
      db.prepare("INSERT INTO push_queue (sub_id, post_key, score, thread, ttl, created) VALUES (?, 'p1', 50, 't', 60, 1)").run(id);
      db.prepare("INSERT INTO push_held (sub_id, post_key, score, expires) VALUES (?, 'p1', 50, 99)").run(id);
      db.prepare("INSERT INTO push_sent (sub_id, post_key, ts, thread) VALUES (?, 'p1', 1, 't')").run(id);
    }
    // a wrong token removes nothing
    expect((await call('/unsubscribe', { sub: a.sub, token: b.token }, {}, env)).status).toBe(403);
    expect(subRow(db, 1)).toBeDefined();

    const r = await call('/unsubscribe', { sub: a.sub, token: a.token }, {}, env);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    for (const t of ['push_subs', 'push_terms', 'push_queue', 'push_held', 'push_sent']) {
      const col = t === 'push_subs' ? 'id' : 'sub_id';
      expect(rows(db, `SELECT * FROM ${t} WHERE ${col} = ?`, idA).length, t).toBe(0);
      expect(rows(db, `SELECT * FROM ${t} WHERE ${col} = ?`, idB).length, t + ' of the other reader').toBeGreaterThan(0);
    }
    // once more: already gone is still fine, and the old token no longer opens anything
    expect((await call('/unsubscribe', { sub: a.sub, token: a.token }, {}, env)).status).toBe(200);
    expect((await call('/preferences', { sub: a.sub, token: a.token }, {}, env)).status).toBe(404);
  });

  it('unsubscribe asks for a well formed sub and token', async () => {
    const { env } = setup();
    expect((await call('/unsubscribe', {}, {}, env)).status).toBe(401);
    expect((await call('/unsubscribe', { sub: 'x', token: 'y' }, {}, env)).status).toBe(401);
  });

  it('writes nothing to the console during any call (BUGS P13)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const { env } = setup();
    const { json: s } = await subscribe(env);
    await call('/preferences', { sub: s.sub, token: s.token }, {}, env);
    await call('/preferences', { sub: s.sub, token: s.token, prefs: { categories: [] } }, {}, env);
    await call('/unsubscribe', { sub: s.sub, token: s.token }, {}, env);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((spy) => spy.mockRestore());
  });

  it('handles a reader with the largest allowed set of choices', async () => {
    const { db, env } = setup();
    const cats = Array.from({ length: P.MAX_CATEGORIES }, (_, i) => 'category-' + i);
    const auths = Array.from({ length: P.MAX_AUTHORS }, (_, i) => 'author-' + i);
    const kws = Array.from({ length: MAX_TERMS }, (_, i) => 'topic' + String.fromCharCode(97 + i) + 'word three four');
    const mutes = Array.from({ length: MAX_TERMS }, (_, i) => 'mute' + String.fromCharCode(97 + i) + 'word');
    const r = await call('/subscribe', subscribeBody(1, { categories: cats, authors: auths, keywords: kws, muted: mutes }), {}, env);
    expect(r.status).toBe(200);
    expect(termsOf(db, 'cat').length).toBe(P.MAX_CATEGORIES);
    expect(termsOf(db, 'author').length).toBe(P.MAX_AUTHORS);
    expect(termsOf(db, 'kwtext').length).toBe(MAX_TERMS);
    expect(termsOf(db, 'mutetext').length).toBe(MAX_TERMS);
  });
});

describe('the wrangler file and the schema notes', () => {
  it('push wrangler.toml has the database binding and an unset SITE_ORIGIN placeholder, no secrets', () => {
    const t = readFileSync(new URL('../fixtures/shipped/workers/push/wrangler.toml', import.meta.url), 'utf8');
    expect(t).toMatch(/name = "news-push"/);
    expect(t).toMatch(/binding = "DB"/);
    expect(t).toMatch(/SITE_ORIGIN = "https:\/\/YOUR-DOMAIN"/);
    expect(t).not.toMatch(/PRIVATE|SECRET\s*=/);
  });
  it('the consent list in the push wrangler file equals the one in the geo wrangler file', () => {
    const pick = (f: string) => /CONSENT_COUNTRIES = "([^"]+)"/.exec(readFileSync(new URL('../../../workers/' + f + '/wrangler.toml', import.meta.url), 'utf8'))?.[1];
    expect(pick('push')).toBeTruthy();
    expect(pick('push')).toBe(pick('geo'));
  });
});

// ---- v0.73.0 (BOT_PROTECTION Part 3b): the guard in front of the browser routes ----
describe('the guard on the push Worker (v0.73.0)', () => {
  const stampReq = (o: { origin?: string | null; method?: string } = {}, env: any = {}) =>
    worker.fetch(new Request('https://push.test/stamp', { method: o.method ?? 'GET', headers: o.origin === null ? {} : { Origin: o.origin ?? SITE } }), { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, ...env });

  it('GET /stamp gives a signed stamp to the site only, with no store and a CORS header for the site', async () => {
    const r = await stampReq();
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const j = await r.json();
    expect(j.stamp).toMatch(/^\d{13}\.[0-9a-f]{64}$/);
    expect(Object.keys(j)).toEqual(['stamp']);
  });
  it('GET /stamp refuses another site, no site, a wrong method; answers the preflight; says 503 with no secret or with the switch on', async () => {
    expect((await stampReq({ origin: 'https://evil.test' })).status).toBe(403);
    expect((await stampReq({ origin: null })).status).toBe(403);
    const post = await stampReq({ method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toContain('GET');
    const pre = await stampReq({ method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect((await stampReq({}, { STAMP_SECRET: undefined })).status).toBe(503);
    const off = await stampReq({}, { PUSH_SUBSCRIBE_OFF: 'true' });
    expect(off.status).toBe(503);
    expect(off.headers.get('Retry-After')).toBe('600');
  });
  it('/subscribe without a stamp, with a forged stamp, with the stamp of another form or with an old one asks the page to reload', async () => {
    const env = { DB: { prepare: vi.fn() } };
    const good = await stampNow();
    const forged = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    const other = await issueStamp(SECRET, Date.now(), 'contact');
    const old = await issueStamp(SECRET, Date.now() - 3 * 60 * 60 * 1000, 'push-subscribe');
    const cases: any[] = [undefined, '', 'garbage', forged, other, old];
    for (const stamp of cases) {
      const r = await call('/subscribe', { ...subscribeBody(), stamp }, { stamp: false }, env);
      expect(r.status, String(stamp)).toBe(400);
      expect(await r.json()).toMatchObject({ reload: true });
    }
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('/subscribe answers 503 when STAMP_SECRET is not set (it never takes a subscription it cannot check)', async () => {
    const r = await call('/subscribe', subscribeBody(), { stamp: false }, { DB: {}, STAMP_SECRET: undefined });
    expect(r.status).toBe(503);
  });
  it('JSON only, exact fields and a plain object body on every browser route', async () => {
    const env = { DB: { prepare: vi.fn() } };
    for (const path of ['/subscribe', '/preferences', '/unsubscribe', '/test']) {
      const text = await call(path, JSON.stringify({ sub: 'x' }), { headers: { 'Content-Type': 'text/plain' } }, env);
      expect(text.status, path).toBe(415);
      const extra = await call(path, { sub: 'x', token: 'y', evil: 1 }, {}, env);
      expect(extra.status, path).toBe(400);
      expect((await call(path, '[]', {}, env)).status, path).toBe(400);
    }
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('a stamp is an extra field on the routes that do not use it', async () => {
    const r = await call('/unsubscribe', { sub: 'a'.repeat(32), token: 'b'.repeat(43), stamp: await stampNow() }, {}, { DB: {} });
    expect(r.status).toBe(400);
  });
  it('the hidden trap field gets the same answer as a person and stores nothing', async () => {
    const prepare = vi.fn();
    const r = await call('/subscribe', { ...subscribeBody(), website: 'http://spam.test' }, {}, { DB: { prepare } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(prepare).not.toHaveBeenCalled();
  });
  it('objects must be objects: text or a list in place of subscription or prefs is a plain 400', async () => {
    const env = { DB: { prepare: vi.fn() } };
    expect((await call('/subscribe', { subscription: 'x', prefs: {} }, {}, env)).status).toBe(400);
    expect((await call('/subscribe', { subscription: {}, prefs: [] }, {}, env)).status).toBe(400);
    expect((await call('/preferences', { sub: 'a'.repeat(32), token: 'b'.repeat(43), prefs: 'x' }, {}, env)).status).toBe(400);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
});

withDb('the push switch PUSH_SUBSCRIBE_OFF on a real SQLite database (v0.73.0)', () => {
  it('stops new subscriptions (503, Retry-After) but never stops a reader from reading, changing or removing their data', async () => {
    const db = freshDb();
    const env: any = { DB: d1(db) };
    const first = await (await call('/subscribe', subscribeBody(1), {}, env)).json();
    expect(first.ok).toBe(true);
    const off = { ...env, PUSH_SUBSCRIBE_OFF: 'yes' };
    const blocked = await call('/subscribe', subscribeBody(2), {}, off);
    expect(blocked.status).toBe(503);
    expect(blocked.headers.get('Retry-After')).toBe('600');
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n).toBe(1);
    const read = await call('/preferences', { sub: first.sub, token: first.token }, {}, off);
    expect(read.status).toBe(200);
    const save = await call('/preferences', { sub: first.sub, token: first.token, prefs: { categories: ['world'] } }, {}, off);
    expect(save.status).toBe(200);
    const gone = await call('/unsubscribe', { sub: first.sub, token: first.token }, {}, off);
    expect(gone.status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n).toBe(0);
  });
  it('a subscribe with a good stamp still works as before and keeps one row for one browser', async () => {
    const db = freshDb();
    const env: any = { DB: d1(db) };
    const a = await (await call('/subscribe', subscribeBody(1), {}, env)).json();
    const b = await (await call('/subscribe', { ...subscribeBody(1), sub: a.sub, token: a.token }, {}, env)).json();
    expect(b.created).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n).toBe(1);
  });
});
