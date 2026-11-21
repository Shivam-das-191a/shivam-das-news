import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import { UPSERT_SQL, eventValues, VISIT_WINDOW_SECONDS } from '../../../workers/analytics/lib.js';

// v0.78.0 (BOT_PROTECTION Part 4b-2): one visit per reader per page per 30 minutes, tested on real SQLite when this Node has it.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }
const run = Sqlite ? describe : describe.skip;
const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');

describe('the 30-minute rule: the statement (v0.78.0)', () => {
  it('is one statement with the same 14 places as before, and the window is 30 minutes', () => {
    expect(VISIT_WINDOW_SECONDS).toBe(1800);
    expect(UPSERT_SQL).toContain('ts > ?1 - ' + VISIT_WINDOW_SECONDS);
    expect(new Set(UPSERT_SQL.match(/\?\d+/g)).size).toBe(14);
    expect(UPSERT_SQL.trim().endsWith(';')).toBe(false);
    expect(UPSERT_SQL).toContain('ON CONFLICT (session_id, pv_id) DO UPDATE');
  });
  it('only the page view of the same session and the same address counts as a repeat (no IP, no fingerprint: the session id only)', () => {
    expect(UPSERT_SQL).toContain('session_id = ?2 AND url = ?4 AND pv_id != ?3');
    expect(UPSERT_SQL).not.toMatch(/\b(ip|user_agent|country)\s*=\s*\?/i);
  });
});

run('the 30-minute rule on real SQLite (v0.78.0)', () => {
  const T = 1_800_000_000;
  const MIN = 60;
  const fresh = () => { const db = new Sqlite(':memory:'); db.exec(schema); return db; };
  const put = (db: any, o: { sid?: string; pv: string; url?: string; ts: number; read?: number; acted?: number }) =>
    db.prepare(UPSERT_SQL).run(...eventValues({ ts: o.ts, session_id: o.sid ?? 'sess-0001', pv_id: o.pv, url: o.url ?? '/a/', country: 'IN', tz: '', referrer_host: '', device: 'mobile', browser: 'Chrome', read_seconds: o.read ?? 10, scroll_pct: 10, acted: o.acted ?? 0, webdriver: 0, dc: 0 }));
  const rows = (db: any) => db.prepare('SELECT pv_id, read_seconds, acted FROM events ORDER BY pv_id').all();

  it('a reload of the same page by the same session inside 30 minutes is not a second visit', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T });
    put(db, { pv: 'pv-000002', ts: T + 5 * MIN });
    expect(rows(db).map((r: any) => r.pv_id)).toEqual(['pv-000001']);
  });
  it('29 minutes 59 seconds later is still the same visit; 30 minutes later it is a new visit', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T });
    put(db, { pv: 'pv-000002', ts: T + 30 * MIN - 1 });
    expect(rows(db)).toHaveLength(1);
    put(db, { pv: 'pv-000003', ts: T + 30 * MIN });
    expect(rows(db).map((r: any) => r.pv_id)).toEqual(['pv-000001', 'pv-000003']);
  });
  it('another page, another session, and the same page in another session are each their own visit', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T });
    put(db, { pv: 'pv-000002', ts: T + MIN, url: '/b/' });
    put(db, { pv: 'pv-000003', ts: T + MIN, sid: 'sess-0002' });
    expect(rows(db)).toHaveLength(3);
  });
  it('the later messages of the counted page view still update its row (read time, flags)', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T, read: 5 });
    put(db, { pv: 'pv-000001', ts: T + 30, read: 35, acted: 1 });
    put(db, { pv: 'pv-000001', ts: T + 60, read: 20 }); // an older message never lowers it
    expect(rows(db)).toEqual([{ pv_id: 'pv-000001', read_seconds: 35, acted: 1 }]);
  });
  it('the messages of a page view that was skipped as a repeat are skipped too (no row appears later)', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T });
    put(db, { pv: 'pv-000002', ts: T + 2 * MIN, read: 5 });
    put(db, { pv: 'pv-000002', ts: T + 3 * MIN, read: 35, acted: 1 });
    expect(rows(db).map((r: any) => r.pv_id)).toEqual(['pv-000001']);
  });
  it('an old page view that is already stored is still updated even after 30 minutes (the leave message of a long read)', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T, read: 5 });
    put(db, { pv: 'pv-000001', ts: T + 40 * MIN, read: 2400 });
    expect(rows(db)).toEqual([{ pv_id: 'pv-000001', read_seconds: 2400, acted: 0 }]);
  });
  it('a repeat is not an error: the statement runs and changes nothing', () => {
    const db = fresh();
    put(db, { pv: 'pv-000001', ts: T });
    const r = db.prepare(UPSERT_SQL).run(...eventValues({ ts: T + MIN, session_id: 'sess-0001', pv_id: 'pv-000009', url: '/a/', country: '', tz: '', referrer_host: '', device: 'mobile', browser: 'Chrome', read_seconds: 1, scroll_pct: 1, acted: 0, webdriver: 0, dc: 0 }));
    expect(Number(r.changes)).toBe(0);
  });
});
