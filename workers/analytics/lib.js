// Analytics, part 1 (v0.32.0): the pure rules of the beacon endpoint (PLAN 15, LOGICS 9; BUGS N1 to N4). No network, no database, no clock of its own.
// The Worker that uses these rules (and the beacon script, the rollups and the dashboard) come in the next parts.
// What is kept per visit: path, time, a random session id, country, time zone, referrer host, device, browser, read seconds, scroll depth.
// What is never kept: the IP address, the user agent text, the query string, the hash, any cookie.

// v0.82.0: the datacenter list is one shared file (see the note near the end of the file about Part 5b).
import { DATACENTER_ASNS, isDatacenterAsn } from '../shared/datacenter.js';
export { DATACENTER_ASNS, isDatacenterAsn };

export const MAX_BODY = 1024;
export const MAX_READ_SECONDS = 3600;
export const MAX_PATH = 300;

const ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A random id made in the browser: 8 to 64 letters, numbers, - and _. '' when it is not valid. */
export function cleanId(raw) {
  const t = String(raw ?? '');
  return ID.test(t) ? t : '';
}

/** Two letters or nothing. "XX" (unknown) and "T1" (Tor) are not real countries. Same rule as the geo Worker. */
export function cleanCountry(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : '';
}

/** BUGS N2: crawlers, tools and empty user agents are not visitors. */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|facebookexternalhit|python-requests|python-urllib|curl\/|wget|httpclient|okhttp|go-http|java\/|node-fetch|axios|scrapy|libwww|phantomjs|puppeteer|playwright|selenium/i;
export function isBot(userAgent) {
  const ua = String(userAgent ?? '').trim();
  return ua.length < 10 || BOT.test(ua);
}

/** mobile, tablet or desktop. */
export function deviceOf(userAgent) {
  const ua = String(userAgent ?? '');
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** One short name. The order matters: Edge, Opera and Samsung Internet also say "Chrome". */
export function browserOf(userAgent) {
  const ua = String(userAgent ?? '');
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/edg\/|edga\/|edgios\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/ucbrowser/i.test(ua)) return 'UC Browser';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

/** The path of the page: starts with /, no query, no hash, no spaces or unsafe characters, at most 300 characters. '' when it is not valid. */
export function cleanPath(raw) {
  let t = String(raw ?? '').trim();
  t = t.split('#')[0].split('?')[0];
  if (!t.startsWith('/') || t.startsWith('//')) return '';
  if (t.length > MAX_PATH || /[\s\u0000-\u001f\u007f"'<>\\]/.test(t)) return '';
  return t;
}

// v0.97.0 (push part 7e-3): a visit that comes from a push notification is stored with this one reserved source value. The brackets can never be part of a real host name
// (referrerHost keeps only text with a dot that comes out of the address parser), so no real site can ever be mixed up with it.
export const PUSH_SOURCE = '(push)';

/** Host of the referrer (lower case, no www.), or '' for direct visits, other schemes, bad text and the site itself. */
export function referrerHost(raw, siteHost = '') {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  let u;
  try { u = new URL(t); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const strip = (h) => String(h).toLowerCase().replace(/^www\./, '');
  const host = strip(u.hostname);
  if (!host.includes('.') || host.length > 100) return '';
  return host === strip(siteHost) ? '' : host;
}

/** A time zone name such as Asia/Kolkata or UTC. '' when it does not look like one. */
export function cleanTimeZone(raw) {
  const t = String(raw ?? '').trim();
  return t.length <= 40 && /^[A-Za-z][A-Za-z_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/.test(t) ? t : '';
}

/** A whole number clamped into min..max. Anything that is not a finite number gives min. */
export function cleanInt(raw, min, max) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/** Text from the request body to an object. null when it is too big, not JSON, or not a plain object. */
export function parseBody(text) {
  const t = String(text ?? '');
  if (!t || t.length > MAX_BODY) return null;
  let j;
  try { j = JSON.parse(t); } catch { return null; }
  return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
}

// ---- v0.77.0 (BOT_PROTECTION Part 4b-1, Rule 3): the datacenter network list. ----
// v0.82.0 (Part 5b): the list now lives in ONE file, `../shared/datacenter.js`, because the geo Worker needs the same list. It is re-exported here, so every older import of
// `DATACENTER_ASNS` and `isDatacenterAsn` from this file still works (the import and the re-export are at the top of this file). A visit from one of these networks is stored with dc = 1 and counts as "unverified" (not dropped).

/** The test of "verified human" as SQL text (Part 4b): a real action, no webdriver, not a datacenter. Used by the rollups and the dashboard numbers. */
export const VERIFIED_SQL = 'acted = 1 AND webdriver = 0 AND dc = 0';
/** The same test for one event object (the Worker side and the tests). */
/** The count of verified page views as SQL text, built from VERIFIED_SQL so there is one rule only. */
export const VERIFIED_COUNT = 'SUM(CASE WHEN ' + VERIFIED_SQL + ' THEN 1 ELSE 0 END)';
/** The count of unverified page views as SQL text (v0.79.0), built from the same one rule: everything that is not verified human. */
export const UNVERIFIED_COUNT = 'SUM(CASE WHEN ' + VERIFIED_SQL + ' THEN 0 ELSE 1 END)';
export const isVerified = (e) => !!e && e.acted === 1 && e.webdriver === 0 && e.dc === 0;

/**
 * One checked event from the browser's message and what the edge knows.
 * ctx: { userAgent, country, siteHost, now, asn? } where asn is the network number from the edge (v0.77.0) and now is milliseconds (the Worker's clock, never the browser's: BUGS N3).
 * The message: { sid, pv, path, tz, ref, read, scroll, acted?, webdriver?, pn? } (the flags are optional; `pn` is new in v0.97.0).
 * Returns { ok: true, event } or { ok: false, reason } with reason one of bot, bad-body, bad-id, bad-path.
 */
export function cleanBeacon(raw, ctx = {}) {
  if (isBot(ctx.userAgent)) return { ok: false, reason: 'bot' };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'bad-body' };
  const session_id = cleanId(raw.sid);
  const pv_id = cleanId(raw.pv);
  if (!session_id || !pv_id) return { ok: false, reason: 'bad-id' };
  const url = cleanPath(raw.path);
  if (!url) return { ok: false, reason: 'bad-path' };
  return {
    ok: true,
    event: {
      ts: Math.floor(Number(ctx.now) / 1000),
      session_id,
      pv_id,
      url,
      country: cleanCountry(ctx.country),
      tz: cleanTimeZone(raw.tz),
      referrer_host: raw.pn === 1 ? PUSH_SOURCE : referrerHost(raw.ref, ctx.siteHost), // v0.97.0: `pn` is 1 only when the page address had ?pn=1 (the mark of a push notification link); only the number 1 counts
      device: deviceOf(ctx.userAgent),
      browser: browserOf(ctx.userAgent),
      read_seconds: cleanInt(raw.read, 0, MAX_READ_SECONDS),
      scroll_pct: cleanInt(raw.scroll, 0, 100),
      // v0.76.0 (BOT_PROTECTION Part 4a): two flags from the page. Only the number 1 counts; anything else (missing, text, 2, true) is 0.
      acted: raw.acted === 1 ? 1 : 0, // a real touch, key press, click or scroll of at least 20 percent happened on this page view
      webdriver: raw.webdriver === 1 ? 1 : 0, // the browser says it is driven by a program (navigator.webdriver)
      dc: isDatacenterAsn(ctx.asn), // v0.77.0 (Part 4b-1): 1 when the visit comes from a datacenter network (the edge's number, never the browser's)
    },
  };
}

/** BUGS N1: the same page view sent twice (start and leave) is one row; the second send only raises read time and scroll depth. */
// v0.78.0 (BOT_PROTECTION Part 4b-2): one visit per reader per page per 30 minutes. A reader is the random session id of the tab (no fingerprint, no cookie).
// The insert is skipped (nothing stored, no error) when the same session already has a DIFFERENT page view of the same address in the last 30 minutes, so a reload or a quick return
// is one visit. A page view that already has its row (the second message: read time, scroll, flags) is always updated. One statement, so the Worker still makes one database call.
export const VISIT_WINDOW_SECONDS = 1800;
export const UPSERT_SQL = 'INSERT INTO events (ts, session_id, pv_id, url, country, tz, referrer_host, device, browser, read_seconds, scroll_pct, acted, webdriver, dc) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14 WHERE EXISTS (SELECT 1 FROM events WHERE session_id = ?2 AND pv_id = ?3) OR NOT EXISTS (SELECT 1 FROM events WHERE session_id = ?2 AND url = ?4 AND pv_id != ?3 AND ts > ?1 - 1800) ON CONFLICT (session_id, pv_id) DO UPDATE SET read_seconds = MAX(read_seconds, excluded.read_seconds), scroll_pct = MAX(scroll_pct, excluded.scroll_pct), acted = MAX(acted, excluded.acted), webdriver = MAX(webdriver, excluded.webdriver), dc = MAX(dc, excluded.dc)';

/** The values for UPSERT_SQL, in order. */
export function eventValues(e) {
  return [e.ts, e.session_id, e.pv_id, e.url, e.country, e.tz, e.referrer_host, e.device, e.browser, e.read_seconds, e.scroll_pct, e.acted ? 1 : 0, e.webdriver ? 1 : 0, e.dc ? 1 : 0];
}

// ---- Rollups and cleanup (v0.35.0 part 4; PLAN 15, LOGICS 10; BUGS N5). Pure: only text and numbers, no database call here. ----

/** Raw events are kept this many days, then deleted. The hourly and daily totals stay. */
export const RAW_DAYS = 7;
/** Each run recomputes the last 48 finished hours and the last 3 finished UTC days from the raw events (still there: RAW_DAYS is 7). */
export const HOURS_BACK = 48;
export const DAYS_BACK = 3;

/**
 * The time windows of one rollup run, in whole seconds (UTC). `now` is seconds.
 * Only finished hours and days are rolled up; the running hour and day are read from raw events by the dashboard.
 */
export function rollupWindow(now) {
  const n = Math.floor(Number(now));
  const hourTo = Math.floor(n / 3600) * 3600;
  const dayTo = Math.floor(n / 86400) * 86400;
  return { hourFrom: hourTo - HOURS_BACK * 3600, hourTo, dayFrom: dayTo - DAYS_BACK * 86400, dayTo, cutoff: n - RAW_DAYS * 86400 };
}

/** Totals per hour, page, country and referrer host from the raw events in [?1, ?2). Running it again gives the same rows (it replaces, it never adds). visitors = different session ids. */
export const HOURLY_SQL = 'INSERT INTO rollup_hourly (hour, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) SELECT (ts / 3600) * 3600, url, country, referrer_host, COUNT(*), COUNT(DISTINCT session_id), SUM(read_seconds), ' + VERIFIED_COUNT + ' FROM events WHERE ts >= ?1 AND ts < ?2 GROUP BY 1, 2, 3, 4 ON CONFLICT (hour, url, country, referrer_host) DO UPDATE SET views = excluded.views, visitors = excluded.visitors, read_seconds_sum = excluded.read_seconds_sum, verified_views = excluded.verified_views';

/** The same per UTC day. Made from raw events, not from the hourly rows, because a visitor in two hours must count once. */
export const DAILY_SQL = 'INSERT INTO rollup_daily (day, url, country, referrer_host, views, visitors, read_seconds_sum, verified_views) SELECT (ts / 86400) * 86400, url, country, referrer_host, COUNT(*), COUNT(DISTINCT session_id), SUM(read_seconds), ' + VERIFIED_COUNT + ' FROM events WHERE ts >= ?1 AND ts < ?2 GROUP BY 1, 2, 3, 4 ON CONFLICT (day, url, country, referrer_host) DO UPDATE SET views = excluded.views, visitors = excluded.visitors, read_seconds_sum = excluded.read_seconds_sum, verified_views = excluded.verified_views';

/** Deletes raw events older than ?1 (BUGS N5). */
export const CLEANUP_SQL = 'DELETE FROM events WHERE ts < ?1';

// ---- Numbers for the dashboard (v0.36.0, part 5; PLAN 15 dashboard views). Pure: builds the SQL texts and their values, runs nothing. ----

/** The five views of the plan. Seconds back from now (null = lifetime) and the size of one chart step in seconds. 5 min, 1 h, 24 h and 7 days read raw events (kept 7 days, so they are exact). */
export const RANGES = { '5m': { back: 300, step: 60 }, '1h': { back: 3600, step: 300 }, '24h': { back: 86400, step: 3600 }, '7d': { back: 7 * 86400, step: 86400 }, life: { back: null, step: 86400 } };

const SRC_RAW = 'SELECT url, country, referrer_host, device, browser, COUNT(*) AS v, SUM(read_seconds) AS r, ' + VERIFIED_COUNT + ' AS h FROM events WHERE ts >= ?1 GROUP BY 1, 2, 3, 4, 5';
// Lifetime = the finished days (rollup_daily) + the running UTC day from raw events. device and browser are not in the daily totals, so they are '' there.
const SRC_LIFE = "SELECT url, country, referrer_host, '' AS device, '' AS browser, views AS v, read_seconds_sum AS r, verified_views AS h FROM rollup_daily UNION ALL " + SRC_RAW;

/**
 * The statements for one range, or null when the range name is not one of RANGES.
 * Each item: { sql, values }. Run them in this order: totals (one row), then pages, countries, sources, devices, browsers, timeline, unverifiedTimeline, and itemUnverified (null for 7d and life; else its three lists pages, countries, sources).
 * Visitors (different session ids) are exact for 5m to 7d. For lifetime there is no exact number (a returning reader would count once per day), so it is left out.
 * Breakdowns count views only: a visitor could appear in several groups, so a visitor sum per group would be wrong.
 */
export function statsPlan(range, nowSec) {
  const r = Object.prototype.hasOwnProperty.call(RANGES, range) ? RANGES[range] : null;
  if (!r) return null;
  const now = Math.floor(Number(nowSec));
  const life = r.back === null;
  const from = life ? Math.floor(now / 86400) * 86400 : now - r.back;
  const src = life ? SRC_LIFE : SRC_RAW;
  const top = (col) => ({ sql: `SELECT ${col} AS k, SUM(v) AS views, SUM(r) AS read_seconds FROM (${src}) WHERE ${col} != '' GROUP BY ${col} ORDER BY views DESC, k ASC LIMIT 10`, values: [from] });
  const totals = life
    ? { sql: `SELECT SUM(v) AS views, NULL AS visitors, SUM(r) AS read_seconds, SUM(h) AS verified_views FROM (${src})`, values: [from] }
    : { sql: 'SELECT COUNT(*) AS views, COUNT(DISTINCT session_id) AS visitors, COALESCE(SUM(read_seconds), 0) AS read_seconds, COALESCE(' + VERIFIED_COUNT + ', 0) AS verified_views FROM events WHERE ts >= ?1', values: [from] };
  const timeline = life
    ? { sql: 'SELECT t, SUM(views) AS views FROM (SELECT day AS t, views FROM rollup_daily UNION ALL SELECT (ts / 86400) * 86400 AS t, COUNT(*) AS views FROM events WHERE ts >= ?1 GROUP BY 1) GROUP BY t ORDER BY t', values: [from] }
    : { sql: 'SELECT (ts / ?2) * ?2 AS t, COUNT(*) AS views FROM events WHERE ts >= ?1 GROUP BY 1 ORDER BY t', values: [from, r.step] };
  // v0.79.0: unverified views per chart step (the same steps as `timeline`), for the red note in the dashboard (BOT_PROTECTION Layer 6). Lifetime: the finished days (views minus verified_views) + the running day from raw events.
  const unverifiedTimeline = life
    ? { sql: 'SELECT t, SUM(views) AS views FROM (SELECT day AS t, views - verified_views AS views FROM rollup_daily UNION ALL SELECT (ts / 86400) * 86400 AS t, ' + UNVERIFIED_COUNT + ' AS views FROM events WHERE ts >= ?1 GROUP BY 1) GROUP BY t ORDER BY t', values: [from] }
    : { sql: 'SELECT (ts / ?2) * ?2 AS t, ' + UNVERIFIED_COUNT + ' AS views FROM events WHERE ts >= ?1 GROUP BY 1 ORDER BY t', values: [from, r.step] };
  // v0.80.0: unverified views per page, country and source in this period and in the period just before it (same length), for the per-item red note.
  // Only where the earlier period still exists as raw events (they are kept RAW_DAYS days): 5m, 1h and 24h. 7 days and lifetime give null (no per-item note).
  const itemRows = (col, limit) => ({ sql: `SELECT ${col} AS k, SUM(CASE WHEN ts >= ?1 THEN u ELSE 0 END) AS cur, SUM(CASE WHEN ts < ?1 THEN u ELSE 0 END) AS prev FROM (SELECT url, country, referrer_host, ts, CASE WHEN ${VERIFIED_SQL} THEN 0 ELSE 1 END AS u FROM events WHERE ts >= ?2) ${col === 'referrer_host' ? '' : `WHERE ${col} != ''`} GROUP BY ${col} HAVING SUM(CASE WHEN ts >= ?1 THEN u ELSE 0 END) > 0 ORDER BY cur DESC, k ASC LIMIT ${limit}`, values: [from, from - (r.back || 0)] });
  const itemUnverified = !life && r.back * 2 <= RAW_DAYS * 86400 ? { pages: itemRows('url', 20), countries: itemRows('country', 20), sources: itemRows('referrer_host', 200) } : null;
  // v0.38.0: sources keep the direct visits ('') and read up to 200 hosts; groupSources() turns them into names and keeps the top 10.
  const sources = { sql: `SELECT referrer_host AS k, SUM(v) AS views, SUM(r) AS read_seconds FROM (${src}) GROUP BY referrer_host ORDER BY views DESC, k ASC LIMIT 200`, values: [from] };
  return { range, from, to: now, step: r.step, totals, pages: top('url'), countries: top('country'), sources, devices: top('device'), browsers: top('browser'), timeline, unverifiedTimeline, itemUnverified };
}

// ---- Source names (v0.38.0, part 7; PLAN 15 "source"). Pure: a referrer host becomes one readable name. ----

/** True when host is the domain itself or any sub-domain of it. "notgoogle.com" is not google.com. */
const under = (host, domain) => host === domain || host.endsWith('.' + domain);
/** google.com, google.co.in, google.com.au, google.de ... and their sub-domains. Not google.com.evil.com. */
const GOOGLE = /^(?:[a-z0-9-]+\.)*google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/;

const SOURCES = [
  ['Facebook', ['facebook.com', 'fb.com', 'fb.me', 'fb.watch']],
  ['Instagram', ['instagram.com']],
  ['X', ['x.com', 't.co', 'twitter.com']],
  ['WhatsApp', ['whatsapp.com', 'wa.me']],
  ['Telegram', ['telegram.org', 'telegram.me', 't.me']],
  ['YouTube', ['youtube.com', 'youtu.be']],
  ['Reddit', ['reddit.com']],
  ['LinkedIn', ['linkedin.com', 'lnkd.in']],
  ['Pinterest', ['pinterest.com', 'pin.it']],
  ['Bing', ['bing.com']],
  ['DuckDuckGo', ['duckduckgo.com']],
  ['Yahoo', ['yahoo.com']],
  ['Yandex', ['yandex.com', 'yandex.ru']],
  ['Baidu', ['baidu.com']],
  ['Ecosia', ['ecosia.org']],
];

/**
 * One readable source name for a referrer host (as stored by referrerHost: lower case, no www.).
 * '' (no referrer) is "Direct". Google Search is "Google", news.google.com is "Google News".
 * Any other host is kept as it is. Google Discover cannot be told apart: the app sends no web referrer, so it counts as "Direct".
 */
export function sourceName(host) {
  const h = String(host ?? '').trim().toLowerCase();
  if (!h) return 'Direct';
  if (h === PUSH_SOURCE) return 'Push notification';
  if (h === 'news.google.com') return 'Google News';
  if (GOOGLE.test(h)) return 'Google';
  for (const [name, domains] of SOURCES) if (domains.some((d) => under(h, d))) return name;
  return h;
}

/**
 * Rows { k: host, views, read_seconds } from the sources query -> the top 10 { key: name, views, avgRead }.
 * Hosts with the same name are added together. Sorted by views, then by name, so the order never changes between runs.
 */
export function groupSources(rows) {
  const m = new Map();
  for (const x of Array.isArray(rows) ? rows : []) {
    const key = sourceName(x.k);
    const g = m.get(key) || { key, views: 0, read: 0 };
    g.views += Number(x.views) || 0;
    g.read += Number(x.read_seconds) || 0;
    m.set(key, g);
  }
  return [...m.values()]
    .sort((a, b) => b.views - a.views || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, 10)
    .map((g) => ({ key: g.key, views: g.views, avgRead: g.views ? Math.round(g.read / g.views) : 0 }));
}

/**
 * Rows { k, cur, prev } (unverified views in this period and in the period before it) -> the top 10 { key, current, previous }.
 * `nameFn` turns the raw key into the shown name (sourceName for sources); keys with the same name are added together.
 * Sorted by current, then by name, so the order never changes between runs. The red-note rule itself is in the dashboard (one place).
 */
export function groupUnverified(rows, nameFn = (k) => k) {
  const m = new Map();
  for (const x of Array.isArray(rows) ? rows : []) {
    const key = nameFn(x.k);
    const g = m.get(key) || { key, current: 0, previous: 0 };
    g.current += Math.max(Number(x.cur) || 0, 0);
    g.previous += Math.max(Number(x.prev) || 0, 0);
    m.set(key, g);
  }
  return [...m.values()].sort((a, b) => b.current - a.current || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, 10);
}

// ---- Trending (v0.39.0, part 8; LOGICS 6). Pure: builds the SQL text, scores the rows, runs nothing. ----

/** An article must have at least this many views in the last 24 hours to be called trending (one stray view is not a trend). */
export const TRENDING_MIN_VIEWS = 3;
export const TRENDING_DEFAULT = 5;
export const TRENDING_MAX = 10;

/** LOGICS 6: (views_24h + 3 * views_1h) * (0.5 + readTimeFactor) / (1 + ageHours / 24). readTimeFactor = min(average read seconds / 60, 1). */
export function trendingScore({ views24h, views1h, avgReadSeconds, ageHours }) {
  const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const readTimeFactor = Math.min(Math.max(num(avgReadSeconds), 0) / 60, 1);
  const age = Math.max(num(ageHours), 0);
  return ((Math.max(num(views24h), 0) + 3 * Math.max(num(views1h), 0)) * (0.5 + readTimeFactor)) / (1 + age / 24);
}

/**
 * The day in an article address (/YYYY/MM/DD/blogs/...) as seconds at 00:00 UTC of that day, or null when the address is not an article or the date is not real.
 * The date is in the site time zone, so the age made from it can be off by a few hours (India: 5.5). That is fine for ranking.
 */
export function articleDay(url) {
  const m = /^\/(\d{4})\/(\d{2})\/(\d{2})\/blogs\//.exec(String(url ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t / 1000 : null;
}

/** The one statement for Trending. Raw events are kept 7 days, so the last 24 hours are exact. Numbers only in the values: ?1 = start of 24 h, ?2 = start of the last hour. */
export function trendingPlan(nowSec) {
  const now = Math.floor(Number(nowSec));
  return {
    sql: "SELECT url, COUNT(*) AS v24, SUM(CASE WHEN ts >= ?2 THEN 1 ELSE 0 END) AS v1, COALESCE(SUM(read_seconds), 0) AS r FROM events WHERE ts >= ?1 AND url LIKE '/%/%/%/blogs/%' GROUP BY url ORDER BY v24 DESC, url ASC LIMIT 200",
    values: [now - 86400, now - 3600],
  };
}

/** How many to show: a whole number from 1 to 10, 5 when missing or not a number. */
export function trendingLimit(raw) {
  const n = Math.floor(Number(raw));
  return raw === null || raw === undefined || raw === '' || !Number.isFinite(n) ? TRENDING_DEFAULT : Math.min(TRENDING_MAX, Math.max(1, n));
}

/** Rows { url, v24, v1, r } -> the best `limit` articles as { url, score }, best first (ties by address). Only article addresses with at least TRENDING_MIN_VIEWS views. */
export function trendingList(rows, nowSec, limit = TRENDING_DEFAULT) {
  const now = Number(nowSec);
  const out = [];
  for (const x of Array.isArray(rows) ? rows : []) {
    const day = articleDay(x && x.url);
    const v24 = Number(x && x.v24) || 0;
    if (day === null || v24 < TRENDING_MIN_VIEWS) continue;
    const score = trendingScore({ views24h: v24, views1h: Number(x.v1) || 0, avgReadSeconds: (Number(x.r) || 0) / v24, ageHours: (now - day) / 3600 });
    out.push({ url: String(x.url), score: Math.round(score * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)).slice(0, trendingLimit(limit));
}
