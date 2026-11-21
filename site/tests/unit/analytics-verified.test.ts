import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import { DATACENTER_ASNS, isDatacenterAsn, VERIFIED_SQL, VERIFIED_COUNT, isVerified, cleanBeacon, UPSERT_SQL, eventValues, HOURLY_SQL, DAILY_SQL, statsPlan, rollupWindow } from '../../../workers/analytics/lib.js';

// v0.77.0 (BOT_PROTECTION Part 4b-1): the datacenter list, the `dc` column and the verified human counters. Database tests run on real SQLite when this Node has it.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }
const run = Sqlite ? describe : describe.skip;

const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');
const migration = readFileSync('../workers/analytics/migrate-0.77.0.sql', 'utf8');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const msg = { sid: 'abcd1234efgh', pv: 'pv-0001-xyz', path: '/2026/11/13/blogs/world/a-story/', tz: 'Asia/Kolkata', ref: '', read: 20, scroll: 50 };
const ctx = { userAgent: CHROME, country: 'IN', siteHost: 'example.test', now: 1_700_000_123_000 };
const ev = (m: object, c: object = {}) => (cleanBeacon({ ...msg, ...m }, { ...ctx, ...c }) as any).event;

describe('the datacenter list (v0.77.0)', () => {
  it('knows the big cloud networks and says 1 for them', () => {
    for (const asn of [16509, 15169, 8075, 14061, 24940, 16276]) expect(isDatacenterAsn(asn)).toBe(1);
  });
  it('says 0 for a home or phone network, for a missing number and for anything that is not a whole number', () => {
    for (const bad of [9829, 55836, 0, -16509, 16509.5, undefined, null, '', 'abc', NaN, Infinity, true, {}, [], '16509x']) expect(isDatacenterAsn(bad as any)).toBe(0);
  });
  it('accepts the number as text (the edge may give text) but not text with other characters', () => {
    expect(isDatacenterAsn('16509')).toBe(1);
    expect(isDatacenterAsn(' 16509 ')).toBe(1);
    expect(isDatacenterAsn('16509 or 1')).toBe(0);
  });
  it('the list has only whole positive numbers and no duplicates', () => {
    for (const n of DATACENTER_ASNS) expect(Number.isInteger(n) && n > 0).toBe(true);
    expect(DATACENTER_ASNS.size).toBe(new Set([...DATACENTER_ASNS]).size);
  });
});

describe('cleanBeacon and the dc flag (v0.77.0)', () => {
  it('dc is 1 for a datacenter network, 0 for others and when the edge gives no number', () => {
    expect(ev({}, { asn: 16509 }).dc).toBe(1);
    expect(ev({}, { asn: 9829 }).dc).toBe(0);
    expect(ev({}).dc).toBe(0);
  });
  it('the browser cannot set dc: a field named dc in the message is ignored by cleanBeacon', () => {
    expect(ev({ dc: 1 }).dc).toBe(0);
    expect(ev({ dc: 0 }, { asn: 16509 }).dc).toBe(1);
  });
  it('a datacenter visit is kept (not dropped), so the owner can see how much there is', () => {
    expect((cleanBeacon(msg, { ...ctx, asn: 16509 }) as any).ok).toBe(true);
  });
  it('eventValues ends with acted, webdriver, dc', () => {
    expect(eventValues(ev({ acted: 1 }, { asn: 14061 })).slice(-3)).toEqual([1, 0, 1]);
    const old: any = { ...ev({}) };
    delete old.dc;
    expect(eventValues(old).slice(-1)).toEqual([0]);
  });
  it('the upsert only raises dc (MAX)', () => {
    expect(UPSERT_SQL).toContain('dc = MAX(dc, excluded.dc)');
  });
});

describe('verified human rule (v0.77.0)', () => {
  it('is acted 1, webdriver 0, dc 0 and nothing else', () => {
    const v = { acted: 1, webdriver: 0, dc: 0 };
    expect(isVerified(v)).toBe(true);
    expect(isVerified({ ...v, acted: 0 })).toBe(false);
    expect(isVerified({ ...v, webdriver: 1 })).toBe(false);
    expect(isVerified({ ...v, dc: 1 })).toBe(false);
    expect(isVerified(null)).toBe(false);
    expect(isVerified({})).toBe(false);
  });
  it('the SQL text is the same rule and every query uses it (one rule only)', () => {
    expect(VERIFIED_SQL).toBe('acted = 1 AND webdriver = 0 AND dc = 0');
    expect(VERIFIED_COUNT).toContain(VERIFIED_SQL);
    for (const sql of [HOURLY_SQL, DAILY_SQL, statsPlan('24h', 1_700_000_000)!.totals.sql, statsPlan('7d', 1_700_000_000)!.totals.sql]) expect(sql).toContain(VERIFIED_SQL);
  });
});

describe('database files (v0.77.0)', () => {
  it('schema.sql has dc and the verified_views columns, all numbers that default to 0', () => {
    expect(schema).toMatch(/\n\s+dc\s+INTEGER NOT NULL DEFAULT 0/);
    expect(schema.match(/\n\s+verified_views\s+INTEGER NOT NULL DEFAULT 0/g)).toHaveLength(2);
  });
  it('the migration has exactly three ALTER statements and says to run it once', () => {
    const stmts = migration.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim());
    expect(stmts).toEqual([
      'ALTER TABLE events ADD COLUMN dc INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE rollup_hourly ADD COLUMN verified_views INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE rollup_daily ADD COLUMN verified_views INTEGER NOT NULL DEFAULT 0;',
    ]);
    expect(migration).toMatch(/Run ONCE/);
    expect(migration).toMatch(/migrate-0\.76\.0\.sql FIRST/);
    expect(migration).toMatch(/Do NOT run it on a database made from the new schema\.sql/);
  });
  it('still stores no IP address, no user agent text and no ASN number', () => {
    expect(schema).not.toMatch(/\n\s+(ip|ip_address|user_agent|ua|cookie|asn)\s/i);
  });
});

run('verified counters on real SQLite (v0.77.0)', () => {
  const fresh = () => { const db = new Sqlite(':memory:'); db.exec(schema); return db; };
  const base = { ts: 1_700_000_000, url: '/a/', country: 'IN', tz: '', referrer_host: '', device: 'desktop', browser: 'Chrome', read_seconds: 10, scroll_pct: 20, acted: 0, webdriver: 0, dc: 0 };
  let n = 0;
  const put = (db: any, e: object) => { n += 1; db.prepare(UPSERT_SQL).run(...eventValues({ ...base, session_id: 'sess-' + String(n).padStart(6, '0'), pv_id: 'pv-' + String(n).padStart(8, '0'), ...e })); };
  const seed = (db: any, ts = base.ts) => {
    put(db, { ts, acted: 1 }); // verified
    put(db, { ts, acted: 1 }); // verified
    put(db, { ts, acted: 0 }); // no action
    put(db, { ts, acted: 1, webdriver: 1 }); // driven by a program
    put(db, { ts, acted: 1, dc: 1 }); // datacenter
  };
  const q = (db: any, p: { sql: string; values: any[] }) => db.prepare(p.sql).all(...p.values);

  it('a raw range gives views 5, verified 2 (so unverified is 3)', () => {
    const db = fresh();
    seed(db);
    const plan = statsPlan('24h', base.ts + 100)!;
    expect(q(db, plan.totals)[0]).toMatchObject({ views: 5, verified_views: 2 });
  });
  it('a range with no events gives verified 0, not an error', () => {
    const plan = statsPlan('5m', base.ts)!;
    expect(q(fresh(), plan.totals)[0]).toMatchObject({ views: 0, verified_views: 0 });
  });
  it('the other lists (pages, countries, sources, devices, browsers, timeline) still work with the new column', () => {
    const db = fresh();
    seed(db);
    const plan: any = statsPlan('24h', base.ts + 100);
    for (const k of ['pages', 'countries', 'sources', 'devices', 'browsers', 'timeline']) expect(() => q(db, plan[k])).not.toThrow();
    expect(q(db, plan.pages)[0]).toMatchObject({ k: '/a/', views: 5 });
  });
  it('the hourly and daily totals carry verified_views and running again gives the same rows', () => {
    const db = fresh();
    seed(db);
    const w = rollupWindow(base.ts + 7200);
    for (let i = 0; i < 2; i++) {
      db.prepare(HOURLY_SQL).run(w.hourFrom, w.hourTo);
      db.prepare(DAILY_SQL).run(w.dayFrom, w.dayTo + 86400);
    }
    expect(db.prepare('SELECT views, verified_views FROM rollup_hourly').all()).toEqual([{ views: 5, verified_views: 2 }]);
    expect(db.prepare('SELECT views, verified_views FROM rollup_daily').all()).toEqual([{ views: 5, verified_views: 2 }]);
  });
  it('lifetime = finished days (rollup) + today (raw): verified adds up the same way as views', () => {
    const db = fresh();
    const today = Math.floor((base.ts + 3 * 86400) / 86400) * 86400;
    db.prepare("INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) VALUES (?1, '/a/', 'IN', '', 10, 4, 100, 6)").run(today - 86400);
    seed(db, today + 60);
    const plan = statsPlan('life', today + 3600)!;
    expect(q(db, plan.totals)[0]).toMatchObject({ views: 15, verified_views: 8 });
  });
  it('old rollup rows (made before this version, verified_views 0) count as unverified in the lifetime number', () => {
    const db = fresh();
    const today = Math.floor((base.ts + 3 * 86400) / 86400) * 86400;
    db.prepare("INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum) VALUES (?1, '/a/', 'IN', '', 10, 4, 100)").run(today - 86400);
    expect(q(db, statsPlan('life', today + 3600)!.totals)[0]).toMatchObject({ views: 10, verified_views: 0 });
  });
  it('the migration brings an old database to the new shape and old rows get dc 0 and verified_views 0', () => {
    const db = new Sqlite(':memory:');
    const old = schema
      .split('\n')
      .filter((l: string) => !/^\s+(dc|verified_views)\s/.test(l))
      .join('\n')
      .replace(/(webdriver\s+INTEGER NOT NULL DEFAULT 0),/, '$1');
    db.exec(old);
    db.prepare("INSERT INTO events (ts, session_id, pv_id, url, device, browser) VALUES (1, 'old-session-1', 'old-pv-0001', '/o/', 'mobile', 'Safari')").run();
    db.prepare("INSERT INTO rollup_daily (day, url, views, visitors, read_seconds_sum) VALUES (0, '/o/', 3, 1, 9)").run();
    db.exec(migration);
    expect(db.prepare('SELECT dc FROM events').all()).toEqual([{ dc: 0 }]);
    expect(db.prepare('SELECT verified_views FROM rollup_daily').all()).toEqual([{ verified_views: 0 }]);
    expect(() => db.exec(migration)).toThrow(/duplicate column/i);
  });
  it('a second message of the same page view can raise dc but never lower it', () => {
    const db = fresh();
    db.prepare(UPSERT_SQL).run(...eventValues({ ...base, session_id: 'sess-aaaaaa', pv_id: 'pv-aaaaaaaa', dc: 1 }));
    db.prepare(UPSERT_SQL).run(...eventValues({ ...base, session_id: 'sess-aaaaaa', pv_id: 'pv-aaaaaaaa', dc: 0 }));
    expect(db.prepare('SELECT dc FROM events').all()).toEqual([{ dc: 1 }]);
  });
});

// ---- The Worker itself (v0.77.0): the edge's network number reaches the row, and /stats shows the two counters. ----
// @ts-ignore plain JS Worker
import worker from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { issueStamp } from '../../../workers/shared/guard.js';

const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-analytics-tests-0123456789';
const fakeDb = () => {
  const runs: { sql: string; values: any[] }[] = [];
  return { runs, prepare: (sql: string) => ({ bind: (...values: any[]) => ({ run: async () => { runs.push({ sql, values }); return { success: true }; } }) }) };
};
const sendFrom = async (asn: unknown, extra: object = {}) => {
  const env: any = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb() };
  const body = JSON.stringify({ ...msg, ...extra, stamp: await issueStamp(SECRET, Date.now(), 'analytics') });
  const request: any = new Request('https://an.test/collect', { method: 'POST', headers: { Origin: SITE, 'User-Agent': CHROME, 'Content-Type': 'text/plain', 'CF-IPCountry': 'IN' }, body });
  if (asn !== undefined) Object.defineProperty(request, 'cf', { value: { asn, country: 'IN' } });
  const res = await worker.fetch(request, env);
  return { res, env };
};

describe('analytics Worker: dc from the edge (v0.77.0)', () => {
  it('a visit from a datacenter network is stored with dc 1 and answered 204 like any visit', async () => {
    const { res, env } = await sendFrom(16509, { acted: 1 });
    expect(res.status).toBe(204);
    expect(env.DB.runs).toHaveLength(1);
    expect(env.DB.runs[0].values.slice(-3)).toEqual([1, 0, 1]);
  });
  it('a home network and a request without the edge number (local tests) are stored with dc 0', async () => {
    expect((await sendFrom(9829)).env.DB.runs[0].values.at(-1)).toBe(0);
    expect((await sendFrom(undefined)).env.DB.runs[0].values.at(-1)).toBe(0);
  });
  it('a dc field sent by the page is refused (exact fields) and nothing is stored', async () => {
    const { res, env } = await sendFrom(9829, { dc: 1 });
    expect(res.status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
});

run('GET /stats shows verifiedViews and unverifiedViews (v0.77.0)', () => {
  const NOW = Math.floor(Date.now() / 1000);
  const raw = new Sqlite(':memory:');
  raw.exec(schema);
  const db = { prepare: (sql: string) => ({ bind: (...v: any[]) => ({ all: async () => ({ results: raw.prepare(sql).all(...v) }) }) }) };
  const add = (i: number, f: object) => raw.prepare(UPSERT_SQL).run(...eventValues({ ts: NOW - 30, url: '/a/', country: 'IN', tz: '', referrer_host: '', device: 'mobile', browser: 'Chrome', read_seconds: 5, scroll_pct: 10, acted: 0, webdriver: 0, dc: 0, session_id: 'sess-00000' + i, pv_id: 'pv-0000000' + i, ...f }));
  add(1, { acted: 1 }); add(2, { acted: 1 }); add(3, {}); add(4, { acted: 1, dc: 1 });
  const gh = async () => ({ ok: true, json: async () => ({ login: 'shivam-das' }) });
  it('verified 2, unverified 2, and views stays 4 (the main number is not changed in this version)', async () => {
    const env = { SITE_ORIGIN: SITE, ALLOWED_USERS: 'shivam-das', DB: db };
    const res = await worker.fetch(new Request('https://an.test/stats?range=24h', { headers: { Origin: SITE, Authorization: 'Bearer ghp_testtoken12345' } }), env, {}, gh);
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j).toMatchObject({ views: 4, verifiedViews: 2, unverifiedViews: 2 });
    expect(j.verifiedViews + j.unverifiedViews).toBe(j.views);
  });
});
