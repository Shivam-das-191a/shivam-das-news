// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import { statsPlan, groupUnverified, sourceName, UPSERT_SQL, eventValues, RAW_DAYS } from '../../../workers/analytics/lib.js';
import { itemAlert, itemAlerts, renderStats, ALERT_FACTOR, ALERT_MIN_VIEWS } from '../../public/admin/js/analytics.js';

// v0.80.0 (BOT_PROTECTION Part 4b-4): the red note for one page, one country or one source, against the period just before it.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }

function h(tag: string, attrs: Record<string, any> | null, ...kids: any[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  const add = (c: any) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

describe('the plan for the per-item numbers (v0.80.0)', () => {
  it('is there for 5m, 1h and 24h only (the period before must still be raw events)', () => {
    for (const r of ['5m', '1h', '24h']) expect(statsPlan(r, 1_700_000_000)!.itemUnverified).not.toBeNull();
    for (const r of ['7d', 'life']) expect(statsPlan(r, 1_700_000_000)!.itemUnverified).toBeNull();
    expect(RAW_DAYS).toBe(7);
  });
  it('has pages, countries and sources with numbers only in the values: this period start and the start of the period before', () => {
    const p: any = statsPlan('24h', 1_700_000_000);
    for (const k of ['pages', 'countries', 'sources']) {
      expect(p.itemUnverified[k].values).toEqual([p.from, p.from - 86400]);
      expect(p.itemUnverified[k].sql).not.toMatch(/\$\{|undefined/);
    }
    expect(p.itemUnverified.sources.sql).not.toMatch(/WHERE referrer_host != ''/); // direct visits are kept
    expect(p.itemUnverified.pages.sql).toMatch(/WHERE url != ''/);
  });
  it('uses the one verified rule (VERIFIED_SQL), not a second copy', () => {
    expect(statsPlan('1h', 1_700_000_000)!.itemUnverified.pages.sql).toContain('acted = 1 AND webdriver = 0 AND dc = 0');
  });
});

describe('groupUnverified', () => {
  it('adds keys with the same name, sorts by current then name and keeps the top 10', () => {
    const rows = [{ k: 'google.com', cur: 5, prev: 1 }, { k: 'www.google.com', cur: 4, prev: 2 }, { k: 'a.test', cur: 9, prev: 0 }];
    expect(groupUnverified(rows, sourceName)).toEqual([{ key: 'Google', current: 9, previous: 3 }, { key: 'a.test', current: 9, previous: 0 }].sort((a, b) => (a.key < b.key ? -1 : 1)));
    const many = Array.from({ length: 15 }, (_, i) => ({ k: 'k' + String(i).padStart(2, '0'), cur: i + 1, prev: 0 }));
    expect(groupUnverified(many)).toHaveLength(10);
    expect(groupUnverified(many)[0]).toEqual({ key: 'k14', current: 15, previous: 0 });
  });
  it('bad rows and bad numbers give 0 and never throw', () => {
    expect(groupUnverified(undefined as any)).toEqual([]);
    expect(groupUnverified([{ k: 'x', cur: 'a', prev: -3 }])).toEqual([{ key: 'x', current: 0, previous: 0 }]);
  });
});

describe('itemAlert and itemAlerts (the rule is in the dashboard, one place)', () => {
  it('uses the same limits as the whole-site note', () => {
    expect([ALERT_FACTOR, ALERT_MIN_VIEWS]).toEqual([3, 10]);
  });
  it('a note at 3 times the period before and at least 10 views', () => {
    expect(itemAlert(30, 10).alert).toBe(true);
    expect(itemAlert(29, 10).alert).toBe(false);
    expect(itemAlert(9, 0).alert).toBe(false);
    expect(itemAlert(10, 0)).toEqual({ alert: true, current: 10, normal: 1 });
  });
  it('a bad number counts as 0', () => {
    expect(itemAlert('x' as any, undefined as any)).toEqual({ alert: false, current: 0, normal: 1 });
  });
  it('lists only the items over the rule, with a label, in the order pages, countries, sources', () => {
    const r = itemAlerts({ pages: [{ key: '/a/', current: 40, previous: 2 }, { key: '/b/', current: 5, previous: 0 }], countries: [{ key: 'US', current: 12, previous: 12 }], sources: [{ key: 'Direct', current: 15, previous: 1 }] });
    expect(r).toEqual([{ label: 'Page', key: '/a/', current: 40, previous: 2 }, { label: 'Source', key: 'Direct', current: 15, previous: 1 }]);
  });
  it('null, missing and broken input give no items', () => {
    for (const bad of [null, undefined, 5, 'x', {}, { pages: 'x' }, { pages: [null] }]) expect(itemAlerts(bad as any)).toEqual([]);
  });
});

describe('the screen (v0.80.0)', () => {
  const base: any = { range: '24h', from: 0, to: 6 * 3600, step: 3600, views: 100, visitors: 40, avgRead: 60, verifiedViews: 70, unverifiedViews: 30, pages: [], countries: [], sources: [], devices: [], browsers: [], timeline: [{ t: 0, views: 100 }] };
  it('shows a red note (role alert) listing the items over the rule', () => {
    const el = renderStats(h, { ...base, itemUnverified: { pages: [{ key: '/2026/11/14/blogs/world/a-story/', current: 40, previous: 2 }], countries: [], sources: [{ key: 'Direct', current: 15, previous: 15 }] } }, 'UTC');
    const note = el.querySelector('[data-an=alert-items]')!;
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('Unverified traffic is high on:');
    expect(note.textContent).toContain('Page /2026/11/14/blogs/world/a-story/: 40 unverified views now, 2 in the period before.');
    expect(note.textContent).not.toContain('Direct');
  });
  it('no item note for 7 days, lifetime (null), an older Worker (missing) or when nothing is over the rule', () => {
    for (const v of [null, undefined, { pages: [{ key: '/a/', current: 3, previous: 0 }], countries: [], sources: [] }]) {
      expect(renderStats(h, { ...base, itemUnverified: v }, 'UTC').querySelector('[data-an=alert-items]')).toBeNull();
    }
  });
  it('the page text is put in as text, not as HTML', () => {
    const el = renderStats(h, { ...base, itemUnverified: { pages: [{ key: '<img src=x onerror=alert(1)>', current: 40, previous: 0 }], countries: [], sources: [] } }, 'UTC');
    expect(el.querySelector('[data-an=alert-items] img')).toBeNull();
    expect(el.querySelector('[data-an=alert-items]')!.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('the item note comes after the whole-site note and before the cards', () => {
    const bad = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: i * 3600, views: i === 6 ? 40 : 3 }));
    const el = renderStats(h, { ...base, unverifiedTimeline: bad, itemUnverified: { pages: [{ key: '/a/', current: 40, previous: 0 }], countries: [], sources: [] } }, 'UTC');
    expect([...el.children].slice(0, 3).map((c) => c.getAttribute('data-an') || c.className)).toEqual(['alert', 'alert-items', 'an-cards']);
  });
});

const run = Sqlite ? describe : describe.skip;
run('the per-item numbers on real SQLite (v0.80.0)', () => {
  const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');
  const fresh = () => { const db = new Sqlite(':memory:'); db.exec(schema); return db; };
  const NOW = 1_700_000_000;
  const base = { url: '/a/', country: 'IN', tz: '', referrer_host: '', device: 'desktop', browser: 'Chrome', read_seconds: 10, scroll_pct: 20, acted: 0, webdriver: 0, dc: 0 };
  let n = 0;
  const put = (db: any, e: object) => { n += 1; db.prepare(UPSERT_SQL).run(...eventValues({ ...base, session_id: 'sess-' + String(n).padStart(6, '0'), pv_id: 'pv-' + String(n).padStart(8, '0'), ...e })); };
  const q = (db: any, p: { sql: string; values: any[] }) => db.prepare(p.sql).all(...p.values.map((v) => BigInt(v)));

  it('counts unverified views now and in the period before, per page, and leaves verified views out', () => {
    const db = fresh();
    const p: any = statsPlan('1h', NOW);
    for (let i = 0; i < 4; i++) put(db, { ts: NOW - 100 - i, url: '/a/', acted: 0 });   // now, unverified
    put(db, { ts: NOW - 90, url: '/a/', acted: 1 });                                      // now, verified: not counted
    for (let i = 0; i < 2; i++) put(db, { ts: NOW - 3700 - i, url: '/a/', acted: 0 });  // before, unverified
    put(db, { ts: NOW - 50, url: '/b/', acted: 1, webdriver: 1 });                        // now, unverified (webdriver)
    put(db, { ts: NOW - 40, url: '/c/', acted: 1 });                                      // now, verified only: no row
    expect(q(db, p.itemUnverified.pages)).toEqual([{ k: '/a/', cur: 4, prev: 2 }, { k: '/b/', cur: 1, prev: 0 }]);
  });
  it('a key that was unverified only in the period before is not listed (nothing now)', () => {
    const db = fresh();
    put(db, { ts: NOW - 3700, url: '/old/', acted: 0 });
    expect(q(db, statsPlan('1h', NOW)!.itemUnverified.pages)).toEqual([]);
  });
  it('a views older than two periods are not read', () => {
    const db = fresh();
    put(db, { ts: NOW - 7300, url: '/a/', acted: 0 });
    put(db, { ts: NOW - 10, url: '/a/', acted: 0 });
    expect(q(db, statsPlan('1h', NOW)!.itemUnverified.pages)).toEqual([{ k: '/a/', cur: 1, prev: 0 }]);
  });
  it('countries skip an empty country; sources keep direct visits as an empty host', () => {
    const db = fresh();
    put(db, { ts: NOW - 10, country: '', referrer_host: '' });
    put(db, { ts: NOW - 11, country: 'US', referrer_host: 'google.com' });
    const p: any = statsPlan('5m', NOW);
    expect(q(db, p.itemUnverified.countries)).toEqual([{ k: 'US', cur: 1, prev: 0 }]);
    expect(q(db, p.itemUnverified.sources).map((x: any) => x.k).sort()).toEqual(['', 'google.com']);
  });
  it('the whole chain: rows to names to the dashboard rule gives the note for a flood from one source name', () => {
    const db = fresh();
    for (let i = 0; i < 12; i++) put(db, { ts: NOW - 20 - i, referrer_host: i % 2 ? 'www.google.com' : 'google.com' });
    put(db, { ts: NOW - 3700, referrer_host: 'google.com' });
    const p: any = statsPlan('1h', NOW);
    const src = groupUnverified(q(db, p.itemUnverified.sources), sourceName);
    expect(src).toEqual([{ key: 'Google', current: 12, previous: 1 }]);
    expect(itemAlerts({ pages: [], countries: [], sources: src })).toHaveLength(1);
  });
});
