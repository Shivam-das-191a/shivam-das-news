// v0.91.0 (BOT_PROTECTION Part 8a): the rules behind the Security screen, as plain functions. No page, no network, no clock, no storage, no fake numbers.
// It is NOT connected to the dashboard yet (that is 8b-2): nothing in app.js imports this file.
// What it does: (1) turns the views numbers that the analytics Worker already gives (views and verified views) into a calm level with a plain message,
// (2) holds the daily and weekly review lists from BOT_PROTECTION Section 13, (3) says when a list is due again.
// It cannot know about Cloudflare challenges or blocks: those numbers are not available to the dashboard (8b says how the owner sees them).

import { unverifiedShare } from './analytics.js';

/** Share of unverified views (whole percent) from which the level is "watch" and "high". */
export const SHARE_WATCH = 30;
export const SHARE_HIGH = 60;
/** Fewer views than this in the period are too few to say anything (a few visits can be 100 percent by chance). */
export const MIN_VIEWS = 50;

/**
 * { level, share, views, text } for one period. level: 'none' (no views), 'unknown' (the Worker sent no verified count),
 * 'few' (under MIN_VIEWS), 'ok', 'watch' or 'high'. The text is a plain sentence for the screen.
 */
export function shareLevel(views, verified) {
  const all = Math.max(0, Math.floor(Number(views) || 0));
  if (!all) return { level: 'none', share: 0, views: 0, text: 'No views in this period yet.' };
  if (verified === undefined || verified === null || !Number.isFinite(Number(verified))) {
    return { level: 'unknown', share: 0, views: all, text: 'The verified count is not available, so the share cannot be shown.' };
  }
  const share = unverifiedShare(all, verified);
  if (all < MIN_VIEWS) return { level: 'few', share, views: all, text: `Only ${all} views: too few to judge.` };
  if (share >= SHARE_HIGH) return { level: 'high', share, views: all, text: `${share}% of views are unverified. Open the Cloudflare Security Events and check the rules (BOT_PROTECTION Section 14).` };
  if (share >= SHARE_WATCH) return { level: 'watch', share, views: all, text: `${share}% of views are unverified. Keep watching; look at the sources and countries in Analytics.` };
  return { level: 'ok', share, views: all, text: `${share}% of views are unverified. This is normal.` };
}

const ORDER = ['none', 'unknown', 'few', 'ok', 'watch', 'high'];

/** The more serious of two levels (high is the most serious). */
export function worstLevel(a, b) {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/**
 * One summary for the screen from two analytics answers, the last 24 hours and the last 7 days (each { views, verifiedViews } or null).
 * Answers { h24, d7, worst }. A missing answer is level 'none'.
 */
export function securitySummary(h24, d7) {
  const a = shareLevel(h24 && h24.views, h24 ? h24.verifiedViews : undefined);
  const b = shareLevel(d7 && d7.views, d7 ? d7.verifiedViews : undefined);
  return { h24: a, d7: b, worst: worstLevel(a.level, b.level) };
}

/** Every day, about 2 minutes (BOT_PROTECTION Section 13). Plain text only: no icons, no links to other sites. */
export const DAILY_CHECKS = [
  { id: 'cf-events', text: 'Cloudflare Security Events: look at the top paths, top countries and top agents that were blocked or challenged.' },
  { id: 'cf-real-readers', text: 'Check that no rule fires on real readers (for example many challenges from phone networks in India).' },
];

/** Every week, about 10 minutes (BOT_PROTECTION Section 13). */
export const WEEKLY_CHECKS = [
  { id: 'analytics-share', text: 'Analytics: verified human views against unverified views.' },
  { id: 'ads-earnings', text: 'AdSense and Adsterra: click rate and earnings by page.' },
  { id: 'search-console', text: 'Search Console: crawl errors, "blocked by robots" and the crawl stats.' },
  { id: 'contact-spam', text: 'Contact inbox: the share of spam.' },
];

/**
 * True when a list is due: it was never done (null, undefined or not a number), the time is in the future (a wrong clock),
 * or at least `days` whole days have passed. Times are milliseconds.
 */
export function isDue(lastDoneMs, nowMs, days) {
  if (!Number.isFinite(nowMs) || !Number.isInteger(days) || days < 1) throw new Error('security: need a time and a whole number of days');
  if (typeof lastDoneMs !== 'number' || !Number.isFinite(lastDoneMs) || lastDoneMs > nowMs) return true;
  return nowMs - lastDoneMs >= days * 86400000;
}

// ---------- v0.92.0 (Part 8b-1): last done times and the drawing ----------

/** The one key the dashboard will use in the browser for the "last done" times (text of a small JSON object). */
export const LAST_DONE_KEY = 'adm.security.lastDone';
/** The one outside address on the screen: the start page of Cloudflare. A deeper address is not guessed (it changes). */
export const CLOUDFLARE_URL = 'https://dash.cloudflare.com/';

const CHECK_DAYS = new Map([...DAILY_CHECKS.map((c) => [c.id, 1]), ...WEEKLY_CHECKS.map((c) => [c.id, 7])]);

/** The saved text -> { id: milliseconds } for known list items only. Empty, broken or odd text gives {}. */
export function readLastDone(text) {
  let j;
  try { j = JSON.parse(String(text || '{}')); } catch { return {}; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
  const out = {};
  for (const id of CHECK_DAYS.keys()) if (typeof j[id] === 'number' && Number.isFinite(j[id]) && j[id] > 0) out[id] = j[id];
  return out;
}

/** A new map with `id` done at `nowMs`. An unknown id or a bad time changes nothing. The old map is never changed. */
export function markDone(map, id, nowMs) {
  const base = map && typeof map === 'object' ? { ...map } : {};
  if (!CHECK_DAYS.has(id) || !Number.isFinite(nowMs) || nowMs <= 0) return base;
  base[id] = nowMs;
  return base;
}

/** The text to save for a map (only known ids). */
export function writeLastDone(map) {
  const out = {};
  for (const id of CHECK_DAYS.keys()) if (map && typeof map[id] === 'number' && Number.isFinite(map[id]) && map[id] > 0) out[id] = map[id];
  return JSON.stringify(out);
}

/** Both lists with `due` and `lastDone` on every item: { daily, weekly }. Daily items are due after 1 day, weekly items after 7. */
export function reviewLists(map, nowMs) {
  const m = map && typeof map === 'object' ? map : {};
  const mk = (list, days) => list.map((c) => ({ id: c.id, text: c.text, lastDone: typeof m[c.id] === 'number' ? m[c.id] : null, due: isDue(m[c.id], nowMs, days) }));
  return { daily: mk(DAILY_CHECKS, 1), weekly: mk(WEEKLY_CHECKS, 7) };
}

const LEVEL_TITLE = { none: 'No data', unknown: 'No verified count', few: 'Too few views', ok: 'Normal', watch: 'Watch', high: 'High' };

/**
 * The screen. `h` is the dashboard helper (tag, attributes, ...children). `view`:
 *   summary  = securitySummary(...) or null when the numbers could not be read,
 *   notice   = a plain sentence shown instead of the numbers when summary is null (for example the text of statsError),
 *   lists    = reviewLists(...),
 *   onDone   = a function called with the item id when the owner presses "Mark done",
 *   when     = a function that writes a time (ms) as a plain text (the caller picks the time zone),
 * Nothing here shows a number that was not measured, and nothing is stored here.
 */
export function renderSecurity(h, view = {}) {
  const { summary = null, notice = '', lists = { daily: [], weekly: [] }, onDone = () => {}, when = (ms) => String(ms) } = view;
  const levelCard = (label, r) => h('div', { class: 'an-card sec-' + r.level, 'data-level': r.level, 'data-sec': label },
    h('div', { class: 'mute' }, label),
    h('strong', { class: 'an-big' }, LEVEL_TITLE[r.level] || r.level),
    h('div', { class: 'mute' }, r.text));
  const numbers = summary
    ? h('div', { class: 'an-cards', 'data-sec': 'levels' }, levelCard('Last 24 hours', summary.h24), levelCard('Last 7 days', summary.d7))
    : h('div', { class: 'card', 'data-sec': 'nonumbers' }, h('p', null, notice || 'The numbers could not be read.'));
  const alert = summary && (summary.worst === 'high' || summary.worst === 'watch')
    ? h('div', { class: 'card an-alert', role: 'alert', 'data-sec': 'alert' }, h('strong', null, summary.worst === 'high' ? 'Unverified traffic is high' : 'Unverified traffic needs watching'),
      h('p', null, 'Open Cloudflare, Security, Events, and look at the top paths, countries and agents. The steps are in BOT_PROTECTION Section 14.'))
    : null;
  const list = (title, items, kind) => h('div', { class: 'card', 'data-sec': kind },
    h('h2', null, title),
    h('ul', null, items.map((c) => h('li', { 'data-check': c.id, 'data-due': String(!!c.due) },
      h('span', null, c.text), ' ',
      h('span', { class: 'mute' }, c.lastDone ? `Last done ${when(c.lastDone)}.` : 'Never marked done.'), ' ',
      h('button', { type: 'button', 'data-done': c.id, onclick: () => onDone(c.id) }, 'Mark done')))));
  return h('div', { 'data-sec': 'screen' },
    numbers, alert,
    h('div', { class: 'card', 'data-sec': 'limits' },
      h('p', null, 'This screen shows only what the analytics Worker measured: verified human views against all views. Cloudflare challenges and blocks cannot be read here (that would need a Cloudflare token in the browser, which must never happen). See them in Cloudflare.'),
      h('p', null, h('a', { href: CLOUDFLARE_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Open Cloudflare'))),
    list('Every day (about 2 minutes)', lists.daily, 'daily'),
    list('Every week (about 10 minutes)', lists.weekly, 'weekly'));
}
