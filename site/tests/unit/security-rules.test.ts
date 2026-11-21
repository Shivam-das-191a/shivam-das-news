import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS dashboard file
import { shareLevel, worstLevel, securitySummary, isDue, DAILY_CHECKS, WEEKLY_CHECKS, SHARE_WATCH, SHARE_HIGH, MIN_VIEWS, LAST_DONE_KEY, CLOUDFLARE_URL, readLastDone, markDone, writeLastDone, reviewLists, renderSecurity } from '../../public/admin/js/security.js';

// v0.91.0 (BOT_PROTECTION Part 8a): the rules of the Security screen. Plain functions: no page, no network, no clock.
const DAY = 86400000;
const NOW = Date.parse('2026-11-16T10:00:00.000Z');

describe('the level of one period', () => {
  it('says none, unknown and few before it says anything about the share', () => {
    expect(shareLevel(0, 0).level).toBe('none');
    expect(shareLevel(undefined as any, undefined as any).level).toBe('none');
    expect(shareLevel(500, undefined as any).level).toBe('unknown');
    expect(shareLevel(500, null as any).level).toBe('unknown');
    expect(shareLevel(500, 'x' as any).level).toBe('unknown');
    const few = shareLevel(MIN_VIEWS - 1, 0);
    expect(few.level).toBe('few');
    expect(few.share).toBe(100);
  });

  it('uses the limits 30 and 60 percent from 50 views on', () => {
    expect([SHARE_WATCH, SHARE_HIGH, MIN_VIEWS]).toEqual([30, 60, 50]);
    expect(shareLevel(100, 100).level).toBe('ok');
    expect(shareLevel(100, 71).level).toBe('ok');   // 29
    expect(shareLevel(100, 70).level).toBe('watch'); // 30
    expect(shareLevel(100, 41).level).toBe('watch'); // 59
    expect(shareLevel(100, 40).level).toBe('high');  // 60
    expect(shareLevel(100, 0).level).toBe('high');
    expect(shareLevel(MIN_VIEWS, 0).level).toBe('high');
  });

  it('gives a plain sentence with the real numbers and never a made-up one', () => {
    const r = shareLevel(200, 100);
    expect(r.level).toBe('watch');
    expect(r.share).toBe(50);
    expect(r.views).toBe(200);
    expect(r.text).toContain('50%');
    expect(shareLevel(0, 0).text).toBe('No views in this period yet.');
    expect(shareLevel(10, 5).text).toContain('10 views');
  });

  it('copes with verified above views, negative and odd numbers', () => {
    expect(shareLevel(100, 500).share).toBe(0);
    expect(shareLevel(100, -5).share).toBe(100);
    expect(shareLevel(-5, 3).level).toBe('none');
    expect(shareLevel(120.9, 120).views).toBe(120);
  });
});

describe('the summary of two periods', () => {
  it('orders the levels and picks the more serious one', () => {
    expect(worstLevel('ok', 'high')).toBe('high');
    expect(worstLevel('high', 'ok')).toBe('high');
    expect(worstLevel('watch', 'ok')).toBe('watch');
    expect(worstLevel('none', 'few')).toBe('few');
    expect(worstLevel('ok', 'ok')).toBe('ok');
  });
  it('treats a missing answer as none', () => {
    expect(securitySummary(null, null)).toEqual({ h24: shareLevel(0, 0), d7: shareLevel(0, 0), worst: 'none' });
    const s = securitySummary({ views: 100, verifiedViews: 95 }, { views: 1000, verifiedViews: 300 });
    expect(s.h24.level).toBe('ok');
    expect(s.d7.level).toBe('high');
    expect(s.worst).toBe('high');
    expect(securitySummary({ views: 100, verifiedViews: 95 }, null).worst).toBe('ok');
  });
});

describe('the review lists', () => {
  it('hold the items of BOT_PROTECTION Section 13, with unique ids and plain text', () => {
    expect(DAILY_CHECKS).toHaveLength(2);
    expect(WEEKLY_CHECKS).toHaveLength(4);
    const all = [...DAILY_CHECKS, ...WEEKLY_CHECKS];
    expect(new Set(all.map((x: any) => x.id)).size).toBe(all.length);
    for (const x of all) { expect(x.id).toMatch(/^[a-z-]+$/); expect(x.text.length).toBeGreaterThan(20); expect(x.text).not.toMatch(/https?:/); }
  });
  it('say when a list is due', () => {
    expect(isDue(null as any, NOW, 7)).toBe(true);
    expect(isDue(undefined as any, NOW, 7)).toBe(true);
    expect(isDue('x' as any, NOW, 7)).toBe(true);
    expect(isDue(NOW - 6 * DAY, NOW, 7)).toBe(false);
    expect(isDue(NOW - 7 * DAY, NOW, 7)).toBe(true);
    expect(isDue(NOW - DAY + 1, NOW, 1)).toBe(false);
    expect(isDue(NOW - DAY, NOW, 1)).toBe(true);
    expect(isDue(NOW + DAY, NOW, 7)).toBe(true); // a clock that is wrong: ask again
    expect(() => isDue(NOW, NaN, 7)).toThrow();
    expect(() => isDue(NOW, NOW, 0)).toThrow();
    expect(() => isDue(NOW, NOW, 1.5)).toThrow();
  });
});

describe('the file', () => {
  const code = readFileSync(new URL('../../public/admin/js/security.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../public/admin/js/app.js', import.meta.url), 'utf8');
  it('uses no network, no clock, no storage and no page', () => {
    for (const bad of ['fetch(', 'Date.now', 'new Date', 'localStorage', 'sessionStorage', 'document.', 'window.', 'XMLHttpRequest']) expect(code, bad).not.toContain(bad);
  });
  it('is imported by the dashboard (8b-2), once, and only the functions that exist', () => {
    expect(app.split("from './security.js'").length - 1).toBe(1);
    const names = /import \{([^}]*)\} from '\.\/security\.js'/.exec(app)![1].split(',').map((x: string) => x.trim());
    const mod: any = { LAST_DONE_KEY, securitySummary, reviewLists, readLastDone, markDone, writeLastDone, renderSecurity };
    for (const n of names) expect(typeof mod[n] !== 'undefined', n).toBe(true);
  });
  it('has no emoji and no inline handler text', () => {
    expect(/\p{Extended_Pictographic}/u.test(code)).toBe(false);
    expect(code).not.toContain('innerHTML');
    expect(code).not.toContain('eval(');
  });
});

// ---------- v0.92.0 (Part 8b-1): last done times and the drawing ----------
const D = DAY;
type Node = { tag: string; attrs: any; kids: any[] };
// A tiny stand-in for the dashboard helper `h`: it only records what was asked for.
const fh = (tag: string, attrs: any, ...kids: any[]): Node => ({ tag, attrs: attrs || {}, kids: kids.flat().filter((k) => k !== null && k !== undefined && k !== false) });
const text = (n: any): string => (n && typeof n === 'object' ? n.kids.map(text).join('') : String(n ?? ''));
const find = (n: any, pred: (x: Node) => boolean, out: Node[] = []): Node[] => { if (n && typeof n === 'object') { if (pred(n)) out.push(n); n.kids.forEach((k: any) => find(k, pred, out)); } return out; };

describe('last done times', () => {
  it('reads only known ids and good times', () => {
    expect(LAST_DONE_KEY).toBe('adm.security.lastDone');
    expect(readLastDone('{"cf-events":1700000000000,"analytics-share":5,"nope":1,"ads-earnings":"x","contact-spam":-3,"search-console":null}')).toEqual({ 'cf-events': 1700000000000, 'analytics-share': 5 });
    for (const bad of ['', 'not json', '[]', '"x"', 'null', '42', null, undefined]) expect(readLastDone(bad as any), String(bad)).toEqual({});
  });
  it('marks one item done without changing the old map, and ignores a bad id or time', () => {
    const old = { 'cf-events': 1 };
    const next = markDone(old, 'analytics-share', NOW);
    expect(next).toEqual({ 'cf-events': 1, 'analytics-share': NOW });
    expect(old).toEqual({ 'cf-events': 1 });
    expect(markDone(old, 'unknown', NOW)).toEqual(old);
    expect(markDone(old, 'cf-events', NaN)).toEqual(old);
    expect(markDone(old, 'cf-events', 0)).toEqual(old);
    expect(markDone(null as any, 'cf-events', NOW)).toEqual({ 'cf-events': NOW });
  });
  it('writes only known ids and reads its own text back', () => {
    const text = writeLastDone({ 'cf-events': NOW, nope: 3, 'ads-earnings': 'x' } as any);
    expect(JSON.parse(text)).toEqual({ 'cf-events': NOW });
    expect(readLastDone(text)).toEqual({ 'cf-events': NOW });
    expect(writeLastDone(null as any)).toBe('{}');
  });
  it('marks daily items due after 1 day and weekly items after 7, and everything due when nothing was done', () => {
    const none = reviewLists({}, NOW);
    expect(none.daily).toHaveLength(2);
    expect(none.weekly).toHaveLength(4);
    expect([...none.daily, ...none.weekly].every((x: any) => x.due && x.lastDone === null)).toBe(true);
    const m = { 'cf-events': NOW - D / 2, 'cf-real-readers': NOW - D, 'analytics-share': NOW - 6 * D, 'ads-earnings': NOW - 7 * D };
    const l = reviewLists(m, NOW);
    expect(l.daily.map((x: any) => x.due)).toEqual([false, true]);
    expect(l.weekly.map((x: any) => x.due)).toEqual([false, true, true, true]);
    expect(l.daily[0].lastDone).toBe(NOW - D / 2);
    expect(reviewLists(null as any, NOW).daily[0].due).toBe(true);
  });
});

describe('the drawing of the screen', () => {
  const sum = securitySummary({ views: 100, verifiedViews: 95 }, { views: 1000, verifiedViews: 300 });
  const lists = reviewLists({ 'cf-events': NOW - 100 }, NOW);
  const draw = (over: any = {}) => renderSecurity(fh as any, { summary: sum, lists, onDone: () => {}, when: (ms: number) => 'T' + ms, ...over }) as any;

  it('shows both levels with the real sentence, and an alert when the level is high', () => {
    const n = draw();
    const cards = find(n, (x) => x.attrs['data-level'] !== undefined);
    expect(cards.map((c) => c.attrs['data-level'])).toEqual(['ok', 'high']);
    expect(text(cards[1])).toContain('70%');
    expect(find(n, (x) => x.attrs['data-sec'] === 'alert')).toHaveLength(1);
    expect(text(n)).toContain('Unverified traffic is high');
  });
  it('shows no alert for a normal period, and a softer one for watch', () => {
    const ok = draw({ summary: securitySummary({ views: 100, verifiedViews: 95 }, { views: 100, verifiedViews: 90 }) });
    expect(find(ok, (x) => x.attrs['data-sec'] === 'alert')).toHaveLength(0);
    const watch = draw({ summary: securitySummary({ views: 100, verifiedViews: 60 }, null) });
    expect(text(watch)).toContain('needs watching');
  });
  it('shows the notice, and no numbers, when the numbers could not be read', () => {
    const n = draw({ summary: null, notice: 'The Worker did not accept your sign-in.' });
    expect(find(n, (x) => x.attrs['data-level'] !== undefined)).toHaveLength(0);
    expect(text(find(n, (x) => x.attrs['data-sec'] === 'nonumbers')[0])).toBe('The Worker did not accept your sign-in.');
    expect(text(draw({ summary: null }))).toContain('The numbers could not be read.');
  });
  it('lists every item with its last done text, and a button that calls onDone with the id', () => {
    const done: string[] = [];
    const n = draw({ onDone: (id: string) => done.push(id) });
    const items = find(n, (x) => x.attrs['data-check'] !== undefined);
    expect(items).toHaveLength(6);
    expect(items[0].attrs['data-due']).toBe('false');
    expect(text(items[0])).toContain('Last done T' + (NOW - 100));
    expect(text(items[1])).toContain('Never marked done.');
    const buttons = find(n, (x) => x.tag === 'button');
    expect(buttons.map((b) => b.attrs['data-done'])).toEqual([...DAILY_CHECKS, ...WEEKLY_CHECKS].map((c: any) => c.id));
    buttons[2].attrs.onclick();
    expect(done).toEqual([WEEKLY_CHECKS[0].id]);
  });
  it('has one outside link only, to Cloudflare, that opens safely, and says what it cannot show', () => {
    const n = draw();
    const links = find(n, (x) => x.tag === 'a');
    expect(links).toHaveLength(1);
    expect(links[0].attrs).toEqual({ href: CLOUDFLARE_URL, target: '_blank', rel: 'noopener noreferrer' });
    expect(CLOUDFLARE_URL).toBe('https://dash.cloudflare.com/');
    expect(text(n)).toContain('Cloudflare challenges and blocks cannot be read here');
  });
  it('works with no view at all', () => {
    const n = renderSecurity(fh as any) as any;
    expect(text(n)).toContain('The numbers could not be read.');
    expect(find(n, (x) => x.tag === 'li')).toHaveLength(0);
  });
});
