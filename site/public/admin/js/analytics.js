// v0.37.0 (Phase 6 part 6): helpers and the drawing of the Analytics screen (PLAN 15 dashboard views).
// Pure functions plus one drawing function that gets the `h` helper. No fake numbers: an empty period shows a plain empty message.
// v0.80.0 (Part 4b-4): the same 3 times rule for one page, one country or one source, against the period just before.
// v0.79.0 (BOT_PROTECTION Part 4b-3): the main numbers use verified human views, a line shows the unverified share, and a red note shows when unverified views jump to 3 times the normal level.

export const RANGES = [['5m', 'Live (5 min)'], ['1h', '1 hour'], ['24h', '24 hours'], ['7d', '7 days'], ['life', 'Lifetime']];

/** The Worker's /stats address from the saved /collect address. '' when the file has no usable address. */
export function statsUrl(endpoint) {
  try {
    const u = new URL(String(endpoint || '').trim());
    return u.protocol === 'https:' && u.pathname === '/collect' ? `${u.origin}/stats` : '';
  } catch { return ''; }
}

/** The endpoint inside the text of config/analytics.json. '' for an empty, missing or broken file. */
export function readEndpoint(text) {
  try { const j = JSON.parse(text || '{}'); return j && typeof j.endpoint === 'string' ? j.endpoint.trim() : ''; } catch { return ''; }
}

export const fmtCount = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0);

/** 0s, 45s, 3m 05s, 1h 02m. */
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

const zoneOk = (z) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: z }); return true; } catch { return false; } };

/** The label of one chart step in the chosen time zone (UTC when the name is not valid). */
export function bucketLabel(t, step, zone) {
  const timeZone = zoneOk(zone) ? zone : 'UTC';
  const o = step >= 86400 ? { day: 'numeric', month: 'short' } : step >= 3600 ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false };
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...o }).format(new Date(t * 1000));
}

/** Zero-filled chart series so quiet minutes, hours and days show as empty bars. Lifetime starts at the first day that has data. */
export function fillTimeline(timeline, from, to, step, life) {
  const map = new Map((timeline || []).map((x) => [x.t, x.views]));
  if (!map.size && life) return [];
  const first = life ? Math.min(...map.keys()) : Math.floor(from / step) * step;
  const last = Math.floor(to / step) * step;
  const out = [];
  for (let t = first; t <= last && out.length < 400; t += step) out.push({ t, views: map.get(t) || 0 });
  return out;
}

/** A plain sentence for each failure of the Worker. */
export function statsError(status) {
  if (status === 401) return 'The Worker did not accept your sign-in. Sign out and sign in again.';
  if (status === 403) return 'Your GitHub login is not in ALLOWED_USERS of the analytics Worker.';
  if (status === 503) return 'The analytics Worker is not ready: set ALLOWED_USERS and the D1 database in workers/analytics/wrangler.toml, then deploy it.';
  if (status === 400) return 'The Worker did not understand the period.';
  return 'Could not read the numbers (the Worker answered ' + status + '). Try again in a minute.';
}

/** Zone names for the selector: the site zone and UTC first, then every zone the browser knows. */
export function zoneList(siteZone) {
  let all = [];
  try { all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []; } catch { all = []; }
  return [...new Set([siteZone, 'UTC', ...all].filter((z) => z && zoneOk(z)))];
}

/** The share of unverified views as a whole percent (0 to 100). 0 when there are no views. */
export function unverifiedShare(views, verified) {
  const all = Math.max(0, Number(views) || 0);
  if (!all) return 0;
  const bad = Math.max(all - Math.min(Math.max(0, Number(verified) || 0), all), 0);
  return Math.round((bad / all) * 100);
}

export const ALERT_FACTOR = 3;      // red note when the newest step is at least 3 times the normal level
export const ALERT_MIN_STEPS = 6;   // fewer steps are too little to know what normal is
export const ALERT_MIN_VIEWS = 10;  // a small count is noise, never a note

/**
 * The red note rule. `counts` = unverified views per chart step, oldest first, zero-filled.
 * Normal = the median of every step except the newest (at least 1, so a quiet site is not alarmed by one visit).
 * The newest step may still be running; a running step only counts less, so a note is still real.
 * Returns { alert, current, normal }; alert is false when there are too few steps or too few views.
 */
export function unverifiedAlert(counts) {
  const a = (counts || []).map((n) => Math.max(0, Number(n) || 0));
  if (a.length < ALERT_MIN_STEPS) return { alert: false, current: a.length ? a[a.length - 1] : 0, normal: 0 };
  const current = a[a.length - 1];
  const before = a.slice(0, -1).sort((x, y) => x - y);
  const mid = Math.floor(before.length / 2);
  const median = before.length % 2 ? before[mid] : (before[mid - 1] + before[mid]) / 2;
  const normal = Math.max(median, 1);
  return { alert: current >= ALERT_MIN_VIEWS && current >= ALERT_FACTOR * normal, current, normal };
}

/**
 * The red note rule for one item (a page, a country or a source): `current` unverified views now, `previous` in the period just before.
 * The same limits as the whole-site rule: at least 10 views and at least 3 times the normal level (normal = the earlier period, at least 1).
 */
export function itemAlert(current, previous) {
  const cur = Math.max(0, Number(current) || 0);
  const normal = Math.max(Number(previous) || 0, 1);
  return { alert: cur >= ALERT_MIN_VIEWS && cur >= ALERT_FACTOR * normal, current: cur, normal };
}

/** The items that need a note, from the Worker's `itemUnverified` (null or missing for 7 days, lifetime and an older Worker: no items). */
export function itemAlerts(itemUnverified) {
  const out = [];
  if (!itemUnverified || typeof itemUnverified !== 'object') return out;
  for (const [field, label] of [['pages', 'Page'], ['countries', 'Country'], ['sources', 'Source']]) {
    for (const x of Array.isArray(itemUnverified[field]) ? itemUnverified[field] : []) {
      const r = itemAlert(x && x.current, x && x.previous);
      if (r.alert) out.push({ label, key: String(x.key), current: r.current, previous: Math.max(Number(x.previous) || 0, 0) });
    }
  }
  return out;
}

/** The numbers, the chart and the top lists. `data` is the answer of GET /stats. */
export function renderStats(h, data, zone) {
  const life = data.range === 'life';
  if (!data.views) return h('div', { class: 'card', 'data-an': 'empty' }, h('p', null, 'No visits recorded in this period yet.'));
  const card = (label, value, hint) => h('div', { class: 'an-card' }, h('div', { class: 'mute' }, label), h('strong', { class: 'an-big' }, value), hint ? h('div', { class: 'mute' }, hint) : null);
  const hasVerified = Number.isFinite(data.verifiedViews);
  const share = hasVerified ? unverifiedShare(data.views, data.verifiedViews) : 0;
  const cards = h('div', { class: 'an-cards' },
    hasVerified ? card('Page views (verified human)', fmtCount(data.verifiedViews), `of ${fmtCount(data.views)} in all`) : card('Page views', fmtCount(data.views)),
    hasVerified ? card('Unverified views', fmtCount(data.unverifiedViews ?? Math.max(data.views - data.verifiedViews, 0)), `${share}% of all views`) : null,
    data.visitors === null || data.visitors === undefined ? card('Visitors', 'n/a', 'not counted for lifetime') : card('Visitors', fmtCount(data.visitors), 'different browser sessions'),
    card('Average read time', fmtDuration(data.avgRead), 'active time per page view'));
  const series = fillTimeline(data.timeline, data.from, data.to, data.step, life);
  const bad = Array.isArray(data.unverifiedTimeline) ? fillTimeline(data.unverifiedTimeline, data.from, data.to, data.step, life) : null;
  const alertInfo = bad ? unverifiedAlert(bad.map((x) => x.views)) : { alert: false, current: 0, normal: 0 };
  const note = alertInfo.alert ? h('div', { class: 'card an-alert', role: 'alert', 'data-an': 'alert' }, h('strong', null, 'Unverified traffic is high'), h('p', null, `The newest step has ${fmtCount(alertInfo.current)} unverified views. The normal level in this period is about ${fmtCount(Math.round(alertInfo.normal))}, so this is ${Math.round(alertInfo.current / alertInfo.normal)} times higher. Look at the pages, countries and sources below. See BOT_PROTECTION.md, section 14.`)) : null;
  const max = Math.max(1, ...series.map((x) => x.views));
  const chart = series.length ? h('div', { class: 'card' }, h('h2', null, 'Page views over time'),
    h('div', { class: 'an-chart', role: 'img', 'aria-label': 'Bar chart of page views over time' },
      series.map((x) => h('span', { class: 'an-bar', style: `height:${Math.max(2, Math.round((x.views / max) * 100))}%`, title: `${bucketLabel(x.t, data.step, zone)}: ${fmtCount(x.views)}` }))),
    h('div', { class: 'row mute', style: 'justify-content:space-between' }, h('span', null, bucketLabel(series[0].t, data.step, zone)), h('span', null, bucketLabel(series[series.length - 1].t, data.step, zone)))) : null;
  const list = (title, items) => items.length ? h('div', { class: 'card' }, h('h2', null, title),
    h('table', { class: 'an-table' }, h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Views'), h('th', null, 'Avg read'))),
      h('tbody', null, items.map((x) => h('tr', null, h('td', null, x.key), h('td', null, fmtCount(x.views)), h('td', null, fmtDuration(x.avgRead))))))) : null;
  const items = itemAlerts(data.itemUnverified);
  const itemNote = items.length ? h('div', { class: 'card an-alert', role: 'alert', 'data-an': 'alert-items' }, h('strong', null, 'Unverified traffic is high on:'),
    h('ul', null, items.map((x) => h('li', null, `${x.label} ${x.key}: ${fmtCount(x.current)} unverified views now, ${fmtCount(x.previous)} in the period before.`)))) : null;
  return h('div', { 'data-an': 'stats' }, note, itemNote, cards, chart,
    h('div', { class: 'grid cols2' }, list('Top pages', data.pages), list('Countries', data.countries), list('Traffic sources', data.sources), list('Devices', data.devices), list('Browsers', data.browsers)));
}
