import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker
import worker from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { UPSERT_SQL, MAX_BODY } from '../../../workers/analytics/lib.js';
// @ts-ignore plain JS Worker code
import { issueStamp } from '../../../workers/shared/guard.js';

const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-analytics-tests-0123456789';
const stampNow = () => issueStamp(SECRET, Date.now(), 'analytics');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const msg = { sid: 'abcd1234efgh', pv: 'pv-0001-xyz', path: '/2026/11/13/blogs/world/a-story/', tz: 'Asia/Kolkata', ref: 'https://www.google.com/', read: 42, scroll: 80 };

function fakeDb(fail = false) {
  const runs: { sql: string; values: any[] }[] = [];
  return { runs, prepare: (sql: string) => ({ bind: (...values: any[]) => ({ run: async () => { if (fail) throw new Error('db down'); runs.push({ sql, values }); return { success: true }; } }) }) };
}
const mkEnv = (extra: any = {}) => ({ SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb(), ...extra });
// v0.74.0: /collect needs a stamp (added here unless the test says `stamp: false` or sends its own). The body stays text/plain JSON.
const post = async (body: any, o: { origin?: string | null; ua?: string; country?: string; headers?: Record<string, string>; method?: string; path?: string; stamp?: boolean } = {}, env: any = mkEnv()) => {
  const headers: Record<string, string> = { 'User-Agent': o.ua ?? CHROME, 'Content-Type': 'text/plain', 'CF-IPCountry': o.country ?? 'IN', ...(o.headers ?? {}) };
  if (o.origin !== null) headers.Origin = o.origin ?? SITE;
  const init: any = { method: o.method ?? 'POST', headers };
  if ((o.method ?? 'POST') === 'POST') {
    let b = body;
    if ((o.path ?? '/collect') === '/collect' && o.stamp !== false && b && typeof b === 'object' && !Array.isArray(b) && b.stamp === undefined) b = { ...b, stamp: await stampNow() };
    init.body = typeof b === 'string' ? b : JSON.stringify(b);
  }
  return worker.fetch(new Request('https://an.test' + (o.path ?? '/collect'), init), env);
};

describe('analytics Worker: a good visit', () => {
  it('stores one checked row and answers 204 with no body', async () => {
    const env = mkEnv();
    const res = await post(msg, {}, env);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(env.DB.runs).toHaveLength(1);
    const v = env.DB.runs[0].values;
    expect(env.DB.runs[0].sql).toBe(UPSERT_SQL);
    expect(v.slice(1)).toEqual(['abcd1234efgh', 'pv-0001-xyz', '/2026/11/13/blogs/world/a-story/', 'IN', 'Asia/Kolkata', 'google.com', 'desktop', 'Chrome', 42, 80, 0, 0, 0]);
    expect(v[0]).toBeGreaterThan(1_700_000_000);
  });
  it('uses the Worker clock, not a time from the browser (BUGS N3): a browser time is an extra field and is refused (v0.74.0)', async () => {
    const env = mkEnv();
    expect((await post({ ...msg, ts: 5, now: 5 }, {}, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
    await post(msg, {}, env);
    expect(env.DB.runs[0].values[0]).toBeGreaterThan(1_700_000_000);
  });
  it('is never cached and gives the CORS header only to the site itself', async () => {
    const ok = await post(msg);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const other = await post(msg, { origin: 'https://evil.test' });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('does not store an IP address or the user agent text', async () => {
    const env = mkEnv();
    await post(msg, { headers: { 'CF-Connecting-IP': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' } }, env);
    const stored = JSON.stringify(env.DB.runs);
    expect(stored).not.toContain('203.0.113.9');
    expect(stored).not.toContain('Mozilla');
  });
  it('sends the same page view twice through the upsert (BUGS N1)', async () => {
    const env = mkEnv();
    await post(msg, {}, env);
    await post({ ...msg, read: 90 }, {}, env);
    expect(env.DB.runs).toHaveLength(2);
    expect(env.DB.runs.every((r: any) => r.sql.includes('ON CONFLICT (session_id, pv_id) DO UPDATE'))).toBe(true);
  });
});

describe('analytics Worker: who may send', () => {
  it('refuses another website, a missing origin and a missing SITE_ORIGIN, and writes nothing', async () => {
    const env = mkEnv();
    expect((await post(msg, { origin: 'https://evil.test' }, env)).status).toBe(403);
    expect((await post(msg, { origin: null }, env)).status).toBe(403);
    expect((await post(msg, { origin: SITE + '/' }, env)).status).toBe(403);
    const none = mkEnv({ SITE_ORIGIN: undefined });
    expect((await post(msg, {}, none)).status).toBe(403);
    expect(env.DB.runs).toHaveLength(0);
    expect(none.DB.runs).toHaveLength(0);
  });
  it('answers 404 for other paths, 405 for other methods, and the preflight for the site', async () => {
    expect((await post(msg, { path: '/other' })).status).toBe(404);
    const get = await post(null, { method: 'GET' });
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST, OPTIONS');
    const pre = await post(null, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });
});

describe('analytics Worker: what is refused or ignored', () => {
  it('ignores bots quietly: the same 204, nothing stored (BUGS N2)', async () => {
    const env = mkEnv();
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'curl/8.4.0', '']) {
      const res = await post(msg, { ua }, env);
      expect(res.status).toBe(204);
    }
    expect(env.DB.runs).toHaveLength(0);
  });
  it('answers 400 for text that is not a JSON object, bad ids and a bad path', async () => {
    const env = mkEnv();
    for (const b of ['nope', '[1]', '', { ...msg, sid: 'x' }, { ...msg, pv: '' }, { ...msg, path: 'https://x.test/' }]) expect((await post(b, {}, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('answers 413 for a body that is too big', async () => {
    const env = mkEnv();
    expect((await post('{"a":"' + 'x'.repeat(MAX_BODY + 200) + '"}', {}, env)).status).toBe(413);
    expect(env.DB.runs).toHaveLength(0);
  });
});

describe('analytics Worker: rate limit and database', () => {
  it('answers 429 and writes nothing when the limiter says no, keyed by the session id', async () => {
    const keys: string[] = [];
    const env = mkEnv({ RATE_LIMITER: { limit: async ({ key }: any) => { keys.push(key); return { success: false }; } } });
    expect((await post(msg, {}, env)).status).toBe(429);
    expect(keys).toEqual(['abcd1234efgh']);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('still counts when the limiter says yes, fails, or does not exist', async () => {
    const yes = mkEnv({ RATE_LIMITER: { limit: async () => ({ success: true }) } });
    const broken = mkEnv({ RATE_LIMITER: { limit: async () => { throw new Error('down'); } } });
    const none = mkEnv();
    for (const env of [yes, broken, none]) {
      expect((await post(msg, {}, env)).status).toBe(204);
      expect(env.DB.runs).toHaveLength(1);
    }
  });
  it('answers 500 when the database fails and 503 when there is no database', async () => {
    expect((await post(msg, {}, mkEnv({ DB: fakeDb(true) }))).status).toBe(500);
    expect((await post(msg, {}, mkEnv({ DB: undefined }))).status).toBe(503);
  });
});

describe('analytics Worker: files', () => {
  it('wrangler.toml names the database binding DB and keeps the placeholders the owner must fill', () => {
    const t = readFileSync('tests/fixtures/shipped/workers/analytics/wrangler.toml', 'utf8');
    expect(t).toContain('binding = "DB"');
    expect(t).toContain('main = "index.js"');
    expect(t).toContain('SITE_ORIGIN = "https://YOUR-DOMAIN"');
  });
});

// ---- v0.74.0 (BOT_PROTECTION Part 3c): the guard in front of /collect ----
describe('analytics Worker: the guard and the stamp (v0.74.0)', () => {
  const stampReq = (o: { origin?: string | null; method?: string } = {}, env: any = mkEnv()) =>
    worker.fetch(new Request('https://an.test/stamp', { method: o.method ?? 'GET', headers: o.origin === null ? {} : { Origin: o.origin ?? SITE } }), env);

  it('GET /stamp gives a signed stamp to the site only', async () => {
    const r = await stampReq();
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect((await r.json()).stamp).toMatch(/^\d{13}\.[0-9a-f]{64}$/);
    expect((await stampReq({ origin: 'https://evil.test' })).status).toBe(403);
    expect((await stampReq({ origin: null })).status).toBe(403);
    const post405 = await stampReq({ method: 'POST' });
    expect(post405.status).toBe(405);
    expect(post405.headers.get('Allow')).toContain('GET');
    const pre = await stampReq({ method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
  });
  it('GET /stamp answers 503 with no secret or with the switch on (Retry-After)', async () => {
    expect((await stampReq({}, mkEnv({ STAMP_SECRET: undefined }))).status).toBe(503);
    const off = await stampReq({}, mkEnv({ COLLECT_OFF: 'true' }));
    expect(off.status).toBe(503);
    expect(off.headers.get('Retry-After')).toBe('600');
  });
  it('a message without a stamp, with a forged stamp, with the stamp of another form or with an old one is not counted', async () => {
    const env = mkEnv();
    const good = await stampNow();
    const forged = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    const other = await issueStamp(SECRET, Date.now(), 'push-subscribe');
    const old = await issueStamp(SECRET, Date.now() - 13 * 60 * 60 * 1000, 'analytics');
    for (const stamp of [undefined, '', 'garbage', forged, other, old]) {
      const r = await post({ ...msg, stamp }, { stamp: false }, env);
      expect(r.status, String(stamp)).toBe(400);
    }
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a stamp of a few seconds is enough (no minimum age) and one of 11 hours still works', async () => {
    const env = mkEnv();
    expect((await post(msg, {}, env)).status).toBe(204);
    const eleven = await issueStamp(SECRET, Date.now() - 11 * 60 * 60 * 1000, 'analytics');
    expect((await post({ ...msg, stamp: eleven }, { stamp: false }, env)).status).toBe(204);
    expect(env.DB.runs).toHaveLength(2);
  });
  it('without STAMP_SECRET /collect answers 503 and counts nothing', async () => {
    const env = mkEnv({ STAMP_SECRET: undefined });
    expect((await post(msg, { stamp: false }, env)).status).toBe(503);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('the kill switch COLLECT_OFF stops counting at once', async () => {
    const env = mkEnv({ COLLECT_OFF: 'on' });
    const r = await post(msg, {}, env);
    expect(r.status).toBe(503);
    expect(r.headers.get('Retry-After')).toBe('600');
    expect(env.DB.runs).toHaveLength(0);
  });
  it('takes text/plain (sendBeacon) and application/json, and nothing else', async () => {
    const env = mkEnv();
    expect((await post(msg, { headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }, env)).status).toBe(204);
    expect((await post(msg, { headers: { 'Content-Type': 'application/json' } }, env)).status).toBe(204);
    for (const type of ['text/html', 'application/x-www-form-urlencoded', 'multipart/form-data', '']) {
      expect((await post(msg, { headers: { 'Content-Type': type } }, env)).status, type).toBe(415);
    }
    expect(env.DB.runs).toHaveLength(2);
  });
  it('exact fields: an extra field, numbers sent as text and objects in place of text are refused', async () => {
    const env = mkEnv();
    expect((await post({ ...msg, evil: 1 }, {}, env)).status).toBe(400);
    expect((await post({ ...msg, read: '42' }, {}, env)).status).toBe(400);
    expect((await post({ ...msg, scroll: [1] }, {}, env)).status).toBe(400);
    expect((await post({ ...msg, path: { a: 1 } }, {}, env)).status).toBe(400);
    expect((await post({ ...msg, ref: 'https://x.test/' + 'a'.repeat(400) }, {}, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a message with only the needed fields still counts (time zone, referrer, read and scroll are optional)', async () => {
    const env = mkEnv();
    expect((await post({ sid: msg.sid, pv: msg.pv, path: msg.path }, {}, env)).status).toBe(204);
    expect(env.DB.runs[0].values.slice(-5)).toEqual([0, 0, 0, 0, 0]);
  });
  it('a bot with a good stamp still gets the quiet 204 and nothing is stored (BUGS N2)', async () => {
    const env = mkEnv();
    expect((await post(msg, { ua: 'Googlebot/2.1' }, env)).status).toBe(204);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('the message the page sends (with the stamp and a cut referrer) is the longest the Worker takes in the size limit', async () => {
    const env = mkEnv();
    const longest = { sid: 'a'.repeat(24), pv: 'b'.repeat(24), path: '/' + 'p'.repeat(299), tz: 'America/Argentina/ComodRivadavia', ref: 'https://www.example.test/' + 'r'.repeat(275), read: 3600, scroll: 100 };
    const r = await post(longest, {}, env);
    expect(r.status).toBe(204);
    expect(env.DB.runs).toHaveLength(1);
  });
});


// ---- v0.76.0 (BOT_PROTECTION Part 4a): the two flags `acted` and `webdriver` ----
describe('analytics Worker: the acted and webdriver flags (v0.76.0)', () => {
  it('stores acted and webdriver as the two values before dc', async () => {
    const env = mkEnv();
    expect((await post({ ...msg, acted: 1, webdriver: 0 }, {}, env)).status).toBe(204);
    expect(env.DB.runs[0].values.slice(-3, -1)).toEqual([1, 0]);
    const env2 = mkEnv();
    expect((await post({ ...msg, acted: 0, webdriver: 1 }, {}, env2)).status).toBe(204);
    expect(env2.DB.runs[0].values.slice(-3, -1)).toEqual([0, 1]);
  });
  it('an older page script that sends neither flag still counts, as 0 and 0', async () => {
    const env = mkEnv();
    expect((await post(msg, {}, env)).status).toBe(204);
    expect(env.DB.runs[0].values.slice(-3, -1)).toEqual([0, 0]);
  });
  it('a flag sent as text, as a list or as an object is refused with 400 and nothing is stored', async () => {
    const env = mkEnv();
    for (const bad of ['1', [1], { a: 1 }, true]) {
      expect((await post({ ...msg, acted: bad }, {}, env)).status).toBe(400);
      expect((await post({ ...msg, webdriver: bad }, {}, env)).status).toBe(400);
    }
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a number other than 1 (0, 2, -1, 0.5) is stored as 0: a script cannot claim more than "yes"', async () => {
    for (const n of [0, 2, -1, 0.5, 1000]) {
      const env = mkEnv();
      expect((await post({ ...msg, acted: n, webdriver: n }, {}, env)).status).toBe(204);
      expect(env.DB.runs[0].values.slice(-3, -1)).toEqual([0, 0]);
    }
  });
  it('the longest message with both flags still fits the size limit', async () => {
    const env = mkEnv();
    const longest = { sid: 'a'.repeat(24), pv: 'b'.repeat(24), path: '/' + 'p'.repeat(299), tz: 'America/Argentina/ComodRivadavia', ref: 'https://www.example.test/' + 'r'.repeat(275), read: 3600, scroll: 100, acted: 1, webdriver: 1 };
    expect((await post(longest, {}, env)).status).toBe(204);
    expect(env.DB.runs).toHaveLength(1);
  });
  it('a bot agent is still dropped whatever the flags say (acted: 1 does not make a bot a person)', async () => {
    const env = mkEnv();
    expect((await post({ ...msg, acted: 1, webdriver: 0 }, { ua: 'Googlebot/2.1' }, env)).status).toBe(204);
    expect(env.DB.runs).toHaveLength(0);
  });
});
