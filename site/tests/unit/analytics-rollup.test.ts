import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker
import worker, { runRollup } from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { rollupWindow, RAW_DAYS, UPSERT_SQL, eventValues } from '../../../workers/analytics/lib.js';

// Node's built-in SQLite (Node 22.5 or newer) stands in for D1. Without it the database tests are skipped.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }

const DAY = 86400;
const T0 = 1_800_000_000 - (1_800_000_000 % DAY); // a UTC midnight
const NOW = (T0 + 5 * DAY + 3 * 3600 + 300) * 1000; // day 5, 03:05 UTC

describe('rollup window', () => {
  it('takes finished hours and days only, and keeps raw events 7 days', () => {
    const w = rollupWindow(T0 + 5 * DAY + 3 * 3600 + 300);
    expect(w.hourTo).toBe(T0 + 5 * DAY + 3 * 3600);
    expect(w.hourFrom).toBe(w.hourTo - 48 * 3600);
    expect(w.dayTo).toBe(T0 + 5 * DAY);
    expect(w.dayFrom).toBe(w.dayTo - 3 * DAY);
    expect(w.cutoff).toBe(T0 + 5 * DAY + 3 * 3600 + 300 - RAW_DAYS * DAY);
    expect(w.dayFrom).toBeGreaterThan(w.cutoff); // the daily rollup never reaches events that were already deleted
    expect(w.hourFrom).toBeGreaterThan(w.cutoff);
  });
});

describe.skipIf(!Sqlite)('rollups and cleanup on a real SQLite database', () => {
  function mk() {
    const raw = new Sqlite(':memory:');
    raw.exec(readFileSync('../workers/analytics/schema.sql', 'utf8'));
    const db = { prepare: (sql: string) => ({ bind: (...v: any[]) => ({ run: async () => { raw.prepare(sql).run(...v); return { success: true }; } }) }) };
    const add = (ts: number, sid: string, pv: string, url = '/a/', country = 'US', ref = 'google.com', read = 10) =>
      raw.prepare(UPSERT_SQL).run(...eventValues({ ts, session_id: sid, pv_id: pv, url, country, tz: '', referrer_host: ref, device: 'mobile', browser: 'Chrome', read_seconds: read, scroll_pct: 50 }));
    const q = (sql: string) => raw.prepare(sql).all();
    return { raw, db, add, q };
  }
  const H = (day: number, hour: number, sec = 0) => T0 + day * DAY + hour * 3600 + sec;

  it('writes hourly and daily totals; visitors are different session ids', async () => {
    const x = mk();
    x.add(H(4, 10, 5), 'sess-0001', 'pv-00001', '/a/', 'US', 'google.com', 30);
    x.add(H(4, 10, 1950), 'sess-0001', 'pv-00002', '/a/', 'US', 'google.com', 20); // same visitor, second page view, 31 minutes later (v0.78.0: inside 30 minutes it would not be a new visit)
    x.add(H(4, 10, 99), 'sess-0002', 'pv-00003', '/a/', 'US', 'google.com', 10);
    x.add(H(4, 15, 1), 'sess-0001', 'pv-00004', '/a/', 'US', 'google.com', 5); // same visitor in another hour
    x.add(H(4, 10, 7), 'sess-0003', 'pv-00005', '/b/', 'DE', '', 1);
    await runRollup(x.db, NOW);
    const hours = x.q("SELECT * FROM rollup_hourly WHERE url='/a/' ORDER BY hour") as any[];
    expect(hours.map((r) => [r.hour, r.views, r.visitors, r.read_seconds_sum])).toEqual([[H(4, 10), 3, 2, 60], [H(4, 15), 1, 1, 5]]);
    const day = x.q("SELECT * FROM rollup_daily WHERE url='/a/'") as any[];
    expect(day.map((r) => [r.day, r.views, r.visitors, r.read_seconds_sum])).toEqual([[T0 + 4 * DAY, 4, 2, 65]]); // sess-0001 counts once for the day
    expect((x.q("SELECT * FROM rollup_daily WHERE url='/b/'") as any[])[0]).toMatchObject({ country: 'DE', referrer_host: '', views: 1, visitors: 1 });
  });

  it('leaves the running hour and the running day out', async () => {
    const x = mk();
    x.add(T0 + 5 * DAY + 3 * 3600 + 10, 'sess-0001', 'pv-00001'); // inside the running hour (03:00 to 04:00 of day 5)
    await runRollup(x.db, NOW);
    expect(x.q('SELECT * FROM rollup_hourly')).toEqual([]);
    expect(x.q('SELECT * FROM rollup_daily')).toEqual([]);
  });

  it('can run twice without changing the totals (no double counting)', async () => {
    const x = mk();
    x.add(H(4, 10, 5), 'sess-0001', 'pv-00001', '/a/', 'US', 'google.com', 30);
    x.add(H(4, 11, 5), 'sess-0002', 'pv-00002', '/a/', 'US', 'google.com', 12);
    await runRollup(x.db, NOW);
    const first = JSON.stringify([x.q('SELECT * FROM rollup_hourly ORDER BY hour'), x.q('SELECT * FROM rollup_daily')]);
    await runRollup(x.db, NOW + 3600 * 1000);
    expect(JSON.stringify([x.q('SELECT * FROM rollup_hourly ORDER BY hour'), x.q('SELECT * FROM rollup_daily')])).toBe(first);
  });

  it('keeps the totals when the raw events are deleted later (BUGS N5)', async () => {
    const x = mk();
    x.add(H(4, 10, 5), 'sess-0001', 'pv-00001', '/a/', 'US', 'google.com', 30);
    await runRollup(x.db, NOW);
    expect(x.q('SELECT * FROM events').length).toBe(1);
    await runRollup(x.db, NOW + 7 * DAY * 1000); // 7 days later: the event is now older than 7 days
    expect(x.q('SELECT * FROM events').length).toBe(0);
    expect((x.q('SELECT * FROM rollup_daily') as any[])[0]).toMatchObject({ views: 1, visitors: 1, read_seconds_sum: 30 });
    expect((x.q('SELECT * FROM rollup_hourly') as any[])[0]).toMatchObject({ views: 1, read_seconds_sum: 30 });
  });

  it('deletes only events older than 7 days, and nothing when a rollup step fails', async () => {
    const x = mk();
    const now = NOW / 1000;
    x.add(now - 8 * DAY, 'sess-0001', 'pv-00001');
    x.add(now - 6 * DAY, 'sess-0002', 'pv-00002');
    await runRollup(x.db, NOW);
    expect((x.q('SELECT pv_id FROM events') as any[]).map((r) => r.pv_id)).toEqual(['pv-00002']);
    const y = mk();
    y.add(now - 8 * DAY, 'sess-0001', 'pv-00001');
    const broken = { prepare: (sql: string) => ({ bind: (...v: any[]) => ({ run: async () => { if (sql.includes('rollup_daily')) throw new Error('db down'); return y.db.prepare(sql).bind(...v).run(); } }) }) };
    await expect(runRollup(broken, NOW)).rejects.toThrow('db down');
    expect(y.q('SELECT * FROM events').length).toBe(1); // not deleted: the totals were not complete
  });
});

describe('scheduled handler', () => {
  it('runs a rollup, does nothing without a database, and never throws', async () => {
    const calls: string[] = [];
    const db = { prepare: (sql: string) => ({ bind: () => ({ run: async () => { calls.push(sql.slice(0, 20)); return {}; } }) }) };
    await worker.scheduled({}, { DB: db });
    expect(calls).toEqual(['INSERT INTO rollup_h', 'INSERT INTO rollup_d', 'DELETE FROM events W']);
    await worker.scheduled({}, {});
    const bad = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('x'); } }) }) };
    await expect(worker.scheduled({}, { DB: bad })).resolves.toBeUndefined();
  });
});
