import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker
import worker, { runRollup } from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { statsPlan, RANGES, UPSERT_SQL, eventValues } from '../../../workers/analytics/lib.js';

let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }

const SITE = 'https://news.test';
const DAY = 86400;
const NOW = Math.floor(Date.now() / 1000);
const TODAY = Math.floor(NOW / DAY) * DAY;

describe('stats plan', () => {
  it('knows the five ranges and nothing else', () => {
    expect(Object.keys(RANGES)).toEqual(['5m', '1h', '24h', '7d', 'life']);
    for (const bad of ['', 'week', '__proto__', 'constructor', '5M', null, undefined]) expect(statsPlan(bad as any, NOW)).toBeNull();
    expect(statsPlan('5m', NOW)!.from).toBe(NOW - 300);
    expect(statsPlan('7d', NOW)!.from).toBe(NOW - 7 * DAY);
    expect(statsPlan('life', NOW)!.from).toBe(TODAY);
  });
  it('puts only numbers in the values and a fixed list of columns in the text (no text from the request)', () => {
    for (const r of Object.keys(RANGES)) {
      const p: any = statsPlan(r, NOW);
      for (const k of ['totals', 'pages', 'countries', 'sources', 'devices', 'browsers', 'timeline']) {
        expect(p[k].values.every((v: unknown) => typeof v === 'number')).toBe(true);
        expect(p[k].sql).not.toMatch(/\$\{|undefined/);
      }
    }
  });
});

describe.skipIf(!Sqlite)('stats on a real SQLite database', () => {
  function mk() {
    const raw = new Sqlite(':memory:');
    raw.exec(readFileSync('../workers/analytics/schema.sql', 'utf8'));
    const db = { prepare: (sql: string) => ({ bind: (...v: any[]) => ({ run: async () => { raw.prepare(sql).run(...v); return { success: true }; }, all: async () => ({ results: raw.prepare(sql).all(...v) }) }) }) };
    const add = (ts: number, sid: string, pv: string, url = '/a/', country = 'US', ref = 'google.com', read = 10, device = 'mobile', browser = 'Chrome') =>
      raw.prepare(UPSERT_SQL).run(...eventValues({ ts, session_id: sid, pv_id: pv, url, country, tz: '', referrer_host: ref, device, browser, read_seconds: read, scroll_pct: 50 }));
    return { raw, db, add };
  }
  const ghFetch = (login: string | null, calls: string[] = []) => async (u: string, init: any) => { calls.push(init.headers.Authorization); return login ? { ok: true, json: async () => ({ login }) } : { ok: false, json: async () => ({}) }; };
  const call = (env: any, range: string, o: { token?: string | null; origin?: string; method?: string; gh?: any } = {}) => {
    const headers: Record<string, string> = { Origin: o.origin ?? SITE };
    if (o.token !== null) headers.Authorization = `Bearer ${o.token ?? 'ghp_testtoken12345'}`;
    return worker.fetch(new Request(`https://an.test/stats?range=${range}`, { method: o.method ?? 'GET', headers }), env, {}, o.gh ?? ghFetch('shivam-das'));
  };

  it('gives exact numbers for the live ranges: views, visitors, read time, top lists, timeline', async () => {
    const x = mk();
    x.add(NOW - 100, 'sess-0001', 'pv-00001', '/a/', 'US', 'google.com', 30);
    x.add(NOW - 50, 'sess-0001', 'pv-00002', '/b/', 'US', 'google.com', 10);
    x.add(NOW - 40, 'sess-0002', 'pv-00003', '/a/', 'DE', '', 20, 'desktop', 'Firefox');
    x.add(NOW - 600, 'sess-0003', 'pv-00004', '/a/', 'IN', 'facebook.com', 60); // outside 5 minutes
    const env = { SITE_ORIGIN: SITE, ALLOWED_USERS: 'Shivam-Das', DB: x.db };
    const res = await call(env, '5m');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const j: any = await res.json();
    expect(j).toMatchObject({ range: '5m', step: 60, views: 3, visitors: 2, avgRead: 20 });
    expect(j.pages).toEqual([{ key: '/a/', views: 2, avgRead: 25 }, { key: '/b/', views: 1, avgRead: 10 }]);
    expect(j.countries.map((c: any) => c.key)).toEqual(['US', 'DE']);
    expect(j.sources).toEqual([{ key: 'Google', views: 2, avgRead: 20 }, { key: 'Direct', views: 1, avgRead: 20 }]); // v0.38.0: names, and direct visits are counted
    expect(j.devices.map((d: any) => d.key).sort()).toEqual(['desktop', 'mobile']);
    expect(j.timeline.reduce((n: number, t: any) => n + t.views, 0)).toBe(3);
    // v0.79.0: the unverified timeline is in the answer, and its total is views minus verified views (these test events have no real action, so all 3 are unverified)
    expect(j.unverifiedTimeline.reduce((n: number, t: any) => n + t.views, 0)).toBe(j.views - j.verifiedViews);
    expect(j.unverifiedTimeline.reduce((n: number, t: any) => n + t.views, 0)).toBe(3);
    // v0.80.0: per page, country and source unverified views (these test events have no real action, so every view is unverified). Only the current numbers are checked here: the period before depends on the clock second.
    expect(j.itemUnverified.pages.map((x: any) => [x.key, x.current])).toEqual([['/a/', 2], ['/b/', 1]]);
    expect(j.itemUnverified.countries.map((x: any) => [x.key, x.current])).toEqual([['US', 2], ['DE', 1]]);
    expect(j.itemUnverified.sources.map((x: any) => [x.key, x.current])).toEqual([['Google', 2], ['Direct', 1]]);
    expect((await (await call(env, '7d')).json() as any).itemUnverified).toBeNull();
    expect((await (await call(env, 'life')).json() as any).itemUnverified).toBeNull();
    const day: any = await (await call(env, '24h')).json();
    expect(day).toMatchObject({ views: 4, visitors: 3 });
  });

  it('lifetime = finished days from the daily totals + today from raw events; visitors are left out', async () => {
    const x = mk();
    x.add(TODAY - 2 * DAY + 3600, 'sess-0001', 'pv-00001', '/a/', 'US', 'google.com', 30);
    x.add(TODAY - 2 * DAY + 7200, 'sess-0002', 'pv-00002', '/a/', 'US', 'google.com', 10);
    await runRollup(x.db, (TODAY + 3600) * 1000); // days up to yesterday are rolled up
    x.raw.exec('DELETE FROM events'); // the raw events are gone, as after 7 days
    x.add(TODAY + 5, 'sess-0003', 'pv-00003', '/a/', 'US', 'google.com', 20);
    const j: any = await (await call({ SITE_ORIGIN: SITE, ALLOWED_USERS: 'shivam-das', DB: x.db }, 'life')).json();
    expect(j).toMatchObject({ views: 3, visitors: null, avgRead: 20 });
    expect(j.pages).toEqual([{ key: '/a/', views: 3, avgRead: 20 }]);
    expect(j.timeline).toEqual([{ t: TODAY - 2 * DAY, views: 2 }, { t: TODAY, views: 1 }]);
  });

  it('shows zeros, not fake numbers, for an empty database', async () => {
    const x = mk();
    for (const r of Object.keys(RANGES)) {
      const j: any = await (await call({ SITE_ORIGIN: SITE, ALLOWED_USERS: 'shivam-das', DB: x.db }, r)).json();
      expect(j).toMatchObject({ views: 0, avgRead: 0, pages: [], countries: [], sources: [], devices: [], browsers: [], timeline: [] });
    }
  });
});

describe('stats access', () => {
  const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
  const env = (o: any = {}) => ({ SITE_ORIGIN: SITE, ALLOWED_USERS: 'shivam-das', DB: db, ...o });
  const req = (o: { token?: string | null; origin?: string | null; method?: string; q?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (o.origin !== null) headers.Origin = o.origin ?? SITE;
    if (o.token !== null) headers.Authorization = `Bearer ${o.token ?? 'ghp_testtoken12345'}`;
    return new Request(`https://an.test/stats${o.q ?? '?range=24h'}`, { method: o.method ?? 'GET', headers });
  };
  const gh = (login: string | null) => async () => (login ? { ok: true, json: async () => ({ login }) } : { ok: false, json: async () => ({}) });

  it('refuses everything when ALLOWED_USERS is empty or missing', async () => {
    for (const e of [env({ ALLOWED_USERS: '' }), env({ ALLOWED_USERS: undefined }), env({ ALLOWED_USERS: ' , ' })]) expect((await worker.fetch(req(), e, {}, gh('shivam-das'))).status).toBe(503);
  });
  it('401 without a token or with a token GitHub refuses, 403 for a user not in the list', async () => {
    expect((await worker.fetch(req({ token: null }), env(), {}, gh('shivam-das'))).status).toBe(401);
    expect((await worker.fetch(req({ token: 'bad token!' }), env(), {}, gh('shivam-das'))).status).toBe(401);
    expect((await worker.fetch(req({ token: 'ghp_refusedtoken99' }), env(), {}, gh(null))).status).toBe(401);
    expect((await worker.fetch(req({ token: 'ghp_othertoken1234' }), env(), {}, gh('someone-else'))).status).toBe(403);
    const down = async () => { throw new Error('network'); };
    expect((await worker.fetch(req({ token: 'ghp_nonetwork1234' }), env(), {}, down)).status).toBe(401);
  });
  it('400 for a bad range, 405 for other methods, preflight for the site, no database 503', async () => {
    expect((await worker.fetch(req({ q: '?range=forever', token: 'ghp_rangetoken1234' }), env(), {}, gh('shivam-das'))).status).toBe(400);
    const post = await worker.fetch(req({ method: 'POST' }), env(), {}, gh('shivam-das'));
    expect(post.status).toBe(405);
    const pre = await worker.fetch(req({ method: 'OPTIONS', token: null }), env(), {}, gh(null));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(pre.headers.get('Access-Control-Allow-Headers')).toBe('Authorization');
    expect((await worker.fetch(req({ token: 'ghp_nodbtoken12345' }), env({ DB: undefined }), {}, gh('shivam-das'))).status).toBe(503);
  });
  it('gives no CORS header to another site, and a database error is a plain 500', async () => {
    const other = await worker.fetch(req({ origin: 'https://evil.test', token: 'ghp_corstoken12345' }), env(), {}, gh('shivam-das'));
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const bad = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('db down'); } }) }) };
    const res = await worker.fetch(req({ token: 'ghp_dberrtoken1234' }), env({ DB: bad }), {}, gh('shivam-das'));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/db down/);
  });
  it('asks GitHub once for the same token within a minute', async () => {
    let n = 0;
    const counting = async () => { n++; return { ok: true, json: async () => ({ login: 'shivam-das' }) }; };
    await worker.fetch(req({ token: 'ghp_cachetoken12345' }), env(), {}, counting);
    await worker.fetch(req({ token: 'ghp_cachetoken12345' }), env(), {}, counting);
    expect(n).toBe(1);
  });
  it('leaves /collect as it was: GET is still 405 there', async () => {
    const r = await worker.fetch(new Request('https://an.test/collect', { method: 'GET' }), env());
    expect(r.status).toBe(405);
  });
});
