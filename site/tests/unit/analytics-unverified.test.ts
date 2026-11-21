// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import { UNVERIFIED_COUNT, VERIFIED_SQL, UPSERT_SQL, eventValues, statsPlan, HOURLY_SQL, DAILY_SQL, rollupWindow } from '../../../workers/analytics/lib.js';
import { unverifiedShare, unverifiedAlert, renderStats, ALERT_FACTOR, ALERT_MIN_STEPS, ALERT_MIN_VIEWS } from '../../public/admin/js/analytics.js';

// v0.79.0 (BOT_PROTECTION Part 4b-3): the dashboard lines. The main numbers use verified human views, a line shows the unverified share,
// and a red note shows when the newest step has 3 times the normal level of unverified views. Database tests run on real SQLite when this Node has it.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }

// A tiny `h` like the one in the dashboard: h(tag, attributes, ...children). null children are skipped, arrays are flattened.
function h(tag: string, attrs: Record<string, any> | null, ...kids: any[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  const add = (c: any) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

describe('the one rule for unverified (v0.79.0)', () => {
  it('UNVERIFIED_COUNT is built from the same VERIFIED_SQL as the verified counter', () => {
    expect(UNVERIFIED_COUNT).toBe('SUM(CASE WHEN ' + VERIFIED_SQL + ' THEN 0 ELSE 1 END)');
  });
  it('statsPlan has an unverifiedTimeline for every range, with numbers only in the values and the same steps as the timeline', () => {
    for (const r of ['5m', '1h', '24h', '7d', 'life']) {
      const p: any = statsPlan(r, 1_700_000_000);
      expect(p.unverifiedTimeline.values.every((v: unknown) => typeof v === 'number')).toBe(true);
      expect(p.unverifiedTimeline.sql).not.toMatch(/\$\{|undefined/);
      expect(p.unverifiedTimeline.values).toEqual(p.timeline.values);
    }
  });
});

describe('unverifiedShare', () => {
  it('is a whole percent of all views', () => {
    expect(unverifiedShare(10, 7)).toBe(30);
    expect(unverifiedShare(3, 2)).toBe(33);
    expect(unverifiedShare(10, 10)).toBe(0);
    expect(unverifiedShare(10, 0)).toBe(100);
  });
  it('is 0 for no views, and verified above all views is treated as all verified', () => {
    expect(unverifiedShare(0, 0)).toBe(0);
    expect(unverifiedShare(5, 9)).toBe(0);
    expect(unverifiedShare(-4, 2)).toBe(0);
  });
  it('treats text and missing numbers as 0', () => {
    expect(unverifiedShare('x' as any, 1)).toBe(0);
    expect(unverifiedShare(4, undefined as any)).toBe(100);
  });
});

describe('unverifiedAlert (the red note rule)', () => {
  const quiet = [2, 3, 2, 4, 3, 2, 3];
  it('uses 3 times the normal level, at least 6 steps and at least 10 views', () => {
    expect(ALERT_FACTOR).toBe(3);
    expect(ALERT_MIN_STEPS).toBe(6);
    expect(ALERT_MIN_VIEWS).toBe(10);
  });
  it('no note for a normal step', () => {
    expect(unverifiedAlert([...quiet, 4]).alert).toBe(false);
  });
  it('a note when the newest step is at least 3 times the median of the earlier steps', () => {
    const r = unverifiedAlert([...quiet, 12]); // median of the earlier steps is 3, so 12 is 4 times
    expect(r).toEqual({ alert: true, current: 12, normal: 3 });
  });
  it('exactly 3 times (and at least 10 views) is a note, just under is not', () => {
    expect(unverifiedAlert([4, 4, 4, 4, 4, 4, 12]).alert).toBe(true);
    expect(unverifiedAlert([4, 4, 4, 4, 4, 4, 11]).alert).toBe(false);
  });
  it('a small count is never a note, even when the site is quiet', () => {
    expect(unverifiedAlert([0, 0, 0, 0, 0, 0, 9]).alert).toBe(false);
    expect(unverifiedAlert([0, 0, 0, 0, 0, 0, 10]).alert).toBe(true); // normal is floored at 1
  });
  it('too few steps: no note, because normal is not known yet', () => {
    expect(unverifiedAlert([1, 1, 1, 1, 50]).alert).toBe(false);
    expect(unverifiedAlert([]).alert).toBe(false);
    expect(unverifiedAlert(undefined as any)).toEqual({ alert: false, current: 0, normal: 0 });
  });
  it('one old spike does not raise the normal level (median, not average)', () => {
    expect(unverifiedAlert([1, 1, 500, 1, 1, 1, 15]).alert).toBe(true);
  });
  it('an even number of earlier steps uses the middle two', () => {
    expect(unverifiedAlert([2, 4, 2, 4, 2, 4, 30]).normal).toBe(3);
  });
  it('bad numbers count as 0', () => {
    expect(unverifiedAlert([NaN, 'a', null, undefined, -5, 1, 20] as any).alert).toBe(true);
  });
});

describe('renderStats with verified numbers (v0.79.0)', () => {
  const base: any = { range: '24h', from: 0, to: 6 * 3600, step: 3600, views: 100, visitors: 40, avgRead: 60, verifiedViews: 70, unverifiedViews: 30, pages: [], countries: [], sources: [], devices: [], browsers: [], timeline: [{ t: 0, views: 100 }] };
  const text = (d: any) => renderStats(h, d, 'UTC').textContent || '';
  it('the main page views are the verified ones, with the all-views total next to them', () => {
    const t = text(base);
    expect(t).toContain('Page views (verified human)');
    expect(t).toContain('70');
    expect(t).toContain('of 100 in all');
  });
  it('a line shows the unverified count and share', () => {
    const t = text(base);
    expect(t).toContain('Unverified views');
    expect(t).toContain('30% of all views');
  });
  it('an old Worker answer without the new numbers still draws the old card, with no unverified line', () => {
    const { verifiedViews, unverifiedViews, ...old } = base;
    const t = text(old);
    expect(t).toContain('Page views');
    expect(t).not.toContain('verified human');
    expect(t).not.toContain('Unverified views');
  });
  it('shows no red note without an unverifiedTimeline', () => {
    expect(renderStats(h, base, 'UTC').querySelector('[data-an=alert]')).toBeNull();
  });
  it('shows no red note for a normal step', () => {
    const bad = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: i * 3600, views: 3 }));
    expect(renderStats(h, { ...base, unverifiedTimeline: bad }, 'UTC').querySelector('[data-an=alert]')).toBeNull();
  });
  it('shows a red note (role alert) when the newest step is far above normal', () => {
    const bad = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: i * 3600, views: i === 6 ? 40 : 3 }));
    const el = renderStats(h, { ...base, unverifiedTimeline: bad }, 'UTC');
    const note = el.querySelector('[data-an=alert]')!;
    expect(note).not.toBeNull();
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('Unverified traffic is high');
    expect(note.textContent).toContain('40 unverified views');
    expect(note.textContent).toContain('13 times higher');
    expect(el.firstElementChild).toBe(note); // the note is the first thing on the screen
  });
  it('zero visits still shows the plain empty message and no note', () => {
    const el = renderStats(h, { ...base, views: 0, verifiedViews: 0, unverifiedViews: 0, timeline: [] }, 'UTC');
    expect(el.textContent).toContain('No visits recorded');
    expect(el.querySelector('[data-an=alert]')).toBeNull();
  });
  it('the dashboard file and its style have the red note', () => {
    const css = readFileSync('public/admin/admin.css', 'utf8');
    expect(css).toMatch(/\.an-alert\{[^}]*#b42318/);
  });
});

const run = Sqlite ? describe : describe.skip;
run('the unverified timeline on real SQLite (v0.79.0)', () => {
  const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');
  const fresh = () => { const db = new Sqlite(':memory:'); db.exec(schema); return db; };
  const DAY = 86400;
  const base = { ts: 1_700_000_000, url: '/a/', country: 'IN', tz: '', referrer_host: '', device: 'desktop', browser: 'Chrome', read_seconds: 10, scroll_pct: 20, acted: 0, webdriver: 0, dc: 0 };
  let n = 0;
  const put = (db: any, e: object) => { n += 1; db.prepare(UPSERT_SQL).run(...eventValues({ ...base, session_id: 'sess-' + String(n).padStart(6, '0'), pv_id: 'pv-' + String(n).padStart(8, '0'), ...e })); };
  // node:sqlite binds a JS number as a decimal number, so `ts / step` would not round down; whole numbers are bound as integers here (as the D1 database does).
  const q = (db: any, p: { sql: string; values: any[] }) => db.prepare(p.sql).all(...p.values.map((v) => BigInt(v)));

  it('counts the views that are not verified human, step by step, and the timeline still counts all views', () => {
    const db = fresh();
    const hour = Math.floor(base.ts / 3600) * 3600;
    put(db, { ts: hour + 10, acted: 1 });                 // verified
    put(db, { ts: hour + 20, acted: 0 });                 // unverified
    put(db, { ts: hour + 30, acted: 1, webdriver: 1 });   // unverified
    put(db, { ts: hour + 3600 + 5, acted: 1, dc: 1 });    // unverified, next hour
    put(db, { ts: hour + 3600 + 6, acted: 1 });           // verified
    const plan: any = statsPlan('24h', hour + 7200);
    expect(q(db, plan.unverifiedTimeline)).toEqual([{ t: hour, views: 2 }, { t: hour + 3600, views: 1 }]);
    expect(q(db, plan.timeline)).toEqual([{ t: hour, views: 3 }, { t: hour + 3600, views: 2 }]);
  });
  it('a step with only verified views gives 0, not a missing row', () => {
    const db = fresh();
    const hour = Math.floor(base.ts / 3600) * 3600;
    put(db, { ts: hour + 10, acted: 1 });
    const plan: any = statsPlan('24h', hour + 100);
    expect(q(db, plan.unverifiedTimeline)).toEqual([{ t: hour, views: 0 }]);
  });
  it('a range with no events gives no rows', () => {
    const plan: any = statsPlan('5m', base.ts);
    expect(q(fresh(), plan.unverifiedTimeline)).toEqual([]);
  });
  it('lifetime: finished days (views minus verified) plus the running day from raw events', () => {
    const db = fresh();
    const today = Math.floor(base.ts / DAY) * DAY;
    db.prepare('INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(today - 2 * DAY, '/a/', 'IN', '', 10, 5, 100, 6);
    db.prepare('INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(today - 2 * DAY, '/b/', 'US', '', 4, 2, 40, 4);
    put(db, { ts: today + 50, acted: 1 });
    put(db, { ts: today + 60, acted: 0 });
    const plan: any = statsPlan('life', today + 100);
    expect(q(db, plan.unverifiedTimeline)).toEqual([{ t: today - 2 * DAY, views: 4 }, { t: today, views: 1 }]);
  });
  it('a day made before the verified counters (verified_views 0) is all unverified, so the old days show as unverified (honest limit)', () => {
    const db = fresh();
    const today = Math.floor(base.ts / DAY) * DAY;
    db.prepare('INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').run(today - DAY, '/a/', 'IN', '', 8, 3, 80);
    const plan: any = statsPlan('life', today + 100);
    expect(q(db, plan.unverifiedTimeline)).toEqual([{ t: today - DAY, views: 8 }]);
  });
  it('totals, unverified timeline and the verified rollups agree: unverified = views - verified', () => {
    const db = fresh();
    const hour = Math.floor(base.ts / 3600) * 3600;
    for (let i = 0; i < 4; i++) put(db, { ts: hour + i, acted: 1 });
    for (let i = 0; i < 3; i++) put(db, { ts: hour + 10 + i, acted: 0 });
    const plan: any = statsPlan('24h', hour + 100);
    const tot = q(db, plan.totals)[0];
    const un = q(db, plan.unverifiedTimeline).reduce((s: number, r: any) => s + r.views, 0);
    expect(un).toBe(tot.views - tot.verified_views);
    const w = rollupWindow(hour + 7200);
    db.prepare(HOURLY_SQL).run(w.hourFrom, w.hourTo);
    db.prepare(DAILY_SQL).run(w.dayFrom, w.dayTo);
    expect(db.prepare('SELECT SUM(views - verified_views) AS u FROM rollup_hourly').get().u).toBe(3);
  });
});
