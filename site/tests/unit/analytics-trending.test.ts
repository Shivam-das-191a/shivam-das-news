import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker
import worker from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { trendingScore, articleDay, trendingPlan, trendingLimit, trendingList, TRENDING_MIN_VIEWS, UPSERT_SQL, eventValues } from '../../../workers/analytics/lib.js';

let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }

const SITE = 'https://news.test';
const DAY = 86400;
const NOW = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000; // 2026-11-15 12:00 UTC

describe('trending score (LOGICS 6)', () => {
  it('follows the formula', () => {
    // (10 + 3*4) * (0.5 + 1) / (1 + 12/24) = 22
    expect(trendingScore({ views24h: 10, views1h: 4, avgReadSeconds: 60, ageHours: 12 })).toBeCloseTo(22, 10);
    // read factor is capped at 1: 600 s counts like 60 s
    expect(trendingScore({ views24h: 10, views1h: 4, avgReadSeconds: 600, ageHours: 12 })).toBeCloseTo(22, 10);
    // (20) * (0.5 + 0.5) / (1 + 132/24) = 20 / 6.5
    expect(trendingScore({ views24h: 20, views1h: 0, avgReadSeconds: 30, ageHours: 132 })).toBeCloseTo(20 / 6.5, 10);
  });
  it('an hour of views counts three times more than the day, a newer article beats an older one', () => {
    const a = trendingScore({ views24h: 10, views1h: 5, avgReadSeconds: 30, ageHours: 10 });
    const b = trendingScore({ views24h: 10, views1h: 0, avgReadSeconds: 30, ageHours: 10 });
    expect(a).toBeGreaterThan(b);
    expect(trendingScore({ views24h: 10, views1h: 0, avgReadSeconds: 30, ageHours: 5 })).toBeGreaterThan(trendingScore({ views24h: 10, views1h: 0, avgReadSeconds: 30, ageHours: 50 }));
  });
  it('bad numbers never give NaN; a future date counts as age 0', () => {
    for (const bad of [NaN, undefined, null, 'x', -5]) {
      const v = trendingScore({ views24h: bad as any, views1h: bad as any, avgReadSeconds: bad as any, ageHours: bad as any });
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(trendingScore({ views24h: 4, views1h: 0, avgReadSeconds: 0, ageHours: -30 })).toBe(trendingScore({ views24h: 4, views1h: 0, avgReadSeconds: 0, ageHours: 0 }));
  });
});

describe('article day', () => {
  it('reads the date of an article address', () => {
    expect(articleDay('/2026/11/15/blogs/world/a-story/')).toBe(Date.UTC(2026, 10, 15) / 1000);
  });
  it('is null for anything else and for dates that do not exist', () => {
    for (const u of ['/', '/category/world/', '/2026/11/15/pages/about/', '/2026/13/01/blogs/a/b/', '/2026/02/30/blogs/a/b/', '/2026/11/15/blog/a/b/', '', null, undefined]) expect(articleDay(u as any)).toBeNull();
  });
});

describe('trending list', () => {
  const rows = [
    { url: '/2026/11/15/blogs/world/a/', v24: 10, v1: 4, r: 600 },
    { url: '/2026/11/10/blogs/world/b/', v24: 20, v1: 0, r: 600 },
    { url: '/2026/11/15/blogs/world/c/', v24: TRENDING_MIN_VIEWS - 1, v1: 2, r: 100 },
    { url: '/category/world/', v24: 99, v1: 50, r: 9999 },
    { url: '/', v24: 99, v1: 50, r: 9999 },
  ];
  it('keeps only articles with enough views and ranks by score', () => {
    expect(trendingList(rows, NOW)).toEqual([
      { url: '/2026/11/15/blogs/world/a/', score: 22 },
      { url: '/2026/11/10/blogs/world/b/', score: 3.08 },
    ]);
  });
  it('respects the limit and breaks ties by address', () => {
    expect(trendingList(rows, NOW, 1)).toEqual([{ url: '/2026/11/15/blogs/world/a/', score: 22 }]);
    const tie = [
      { url: '/2026/11/15/blogs/x/b/', v24: 5, v1: 1, r: 0 },
      { url: '/2026/11/15/blogs/x/a/', v24: 5, v1: 1, r: 0 },
    ];
    expect(trendingList(tie, NOW).map((x: any) => x.url)).toEqual(['/2026/11/15/blogs/x/a/', '/2026/11/15/blogs/x/b/']);
  });
  it('bad input gives an empty list', () => {
    expect(trendingList(null as any, NOW)).toEqual([]);
    expect(trendingList([null, undefined, {}] as any, NOW)).toEqual([]);
  });
  it('limit: 5 by default, 1 to 10 otherwise', () => {
    expect(trendingLimit(null)).toBe(5);
    expect(trendingLimit('')).toBe(5);
    expect(trendingLimit('abc')).toBe(5);
    expect(trendingLimit('0')).toBe(1);
    expect(trendingLimit('3')).toBe(3);
    expect(trendingLimit('99')).toBe(10);
  });
  it('the SQL text is fixed and the values are numbers', () => {
    const p = trendingPlan(NOW);
    expect(p.values).toEqual([NOW - DAY, NOW - 3600]);
    expect(p.sql).not.toMatch(/\$\{|undefined/);
  });
});

describe.skipIf(!Sqlite)('GET /trending on a real SQLite database', () => {
  function mk() {
    const raw = new Sqlite(':memory:');
    raw.exec(readFileSync('../workers/analytics/schema.sql', 'utf8'));
    const db = { prepare: (sql: string) => ({ bind: (...v: any[]) => ({ run: async () => { raw.prepare(sql).run(...v); return { success: true }; }, all: async () => ({ results: raw.prepare(sql).all(...v) }) }) }) };
    let n = 0;
    const add = (ts: number, url: string, read: number) => {
      n++;
      raw.prepare(UPSERT_SQL).run(...eventValues({ ts, session_id: 'sess-' + String(n).padStart(4, '0'), pv_id: 'pv-' + String(n).padStart(5, '0'), url, country: 'US', tz: '', referrer_host: '', device: 'mobile', browser: 'Chrome', read_seconds: read, scroll_pct: 50 }));
    };
    return { db, add };
  }
  const today = new Date();
  const path = (d: Date, slug: string) => `/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/blogs/world/${slug}/`;
  const call = (env: any, query = '', init: any = {}) => worker.fetch(new Request('https://an.test/trending' + query, { headers: { Origin: SITE }, ...init }), env, {});

  it('ranks the last 24 hours, ignores old events and non-articles, and answers with a public cache and CORS for the site only', async () => {
    const x = mk();
    const now = Math.floor(Date.now() / 1000);
    const hot = path(today, 'hot');
    const old = path(new Date(Date.now() - 5 * DAY * 1000), 'old');
    for (let i = 0; i < 6; i++) x.add(now - 100 - i, hot, 60);
    for (let i = 0; i < 4; i++) x.add(now - 7200 - i, old, 30);
    for (let i = 0; i < 20; i++) x.add(now - 2 * DAY - i, path(today, 'too-old-events'), 60); // older than 24 h
    for (let i = 0; i < 9; i++) x.add(now - 50 - i, '/category/world/', 60);
    const env = { SITE_ORIGIN: SITE, DB: x.db };
    const res = await call(env, '?limit=5');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    const j: any = await res.json();
    expect(j.items.map((i: any) => i.url)).toEqual([hot, old]);
    expect(Object.keys(j.items[0]).sort()).toEqual(['score', 'url']);
    expect(j.items[0].score).toBeGreaterThan(j.items[1].score);
    const one: any = await (await call(env, '?limit=1')).json();
    expect(one.items).toHaveLength(1);
    const other = await call(env, '', { headers: { Origin: 'https://evil.test' } });
    expect(other.status).toBe(200);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('an empty database gives an empty list', async () => {
    const res = await call({ SITE_ORIGIN: SITE, DB: mk().db });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });
  it('no database: 503; other methods: 405; preflight: 204; a database error: 500 with no details', async () => {
    expect((await call({ SITE_ORIGIN: SITE })).status).toBe(503);
    const post = await call({ SITE_ORIGIN: SITE, DB: mk().db }, '', { method: 'POST', body: '{}' });
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, OPTIONS');
    expect((await call({ SITE_ORIGIN: SITE, DB: mk().db }, '', { method: 'OPTIONS' })).status).toBe(204);
    const broken = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('secret table detail'); } }) }) };
    const err = await call({ SITE_ORIGIN: SITE, DB: broken });
    expect(err.status).toBe(500);
    expect(await err.text()).not.toMatch(/secret/);
  });
});
