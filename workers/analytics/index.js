// Analytics endpoint (Cloudflare Worker, v0.33.0, PLAN 15; BUGS N1, N2, N3, N6).
// POST /collect takes one small JSON message from the beacon script of an article page and stores one checked row in D1.
// The rules for the message are in lib.js. This file only does the HTTP part: who may call, size, rate limit, the database write.
// v0.36.0: `GET /stats` gives the dashboard numbers (private: GitHub token and ALLOWED_USERS).
// v0.38.0: the sources in `/stats` are names (Google, Facebook, X, Direct ...), not raw hosts.
// v0.39.0: `GET /trending?limit=5` gives the best articles of the last 24 hours (public: addresses and scores only; CORS for SITE_ORIGIN only).
// v0.35.0: the `scheduled` handler (every hour) writes the hourly and daily totals and deletes raw events older than 7 days.
// v0.74.0 (BOT_PROTECTION Part 3c): POST /collect runs the checks of workers/shared/guard.js (kill switch COLLECT_OFF, exact fields, a signed stamp from GET /stamp, secret STAMP_SECRET).
// The body stays text/plain JSON (sendBeacon on page close needs a "simple" request), so the guard is told `allowPlain`. The stamp has no minimum age (the first message is sent after one
// reader second) and lives 12 hours. Without STAMP_SECRET /collect and /stamp answer 503 and nothing is counted. The stamp is a speed bump (BUGS W13), not a proof of a person.
// v0.76.0 (BOT_PROTECTION Part 4a): the message may carry `acted` and `webdriver` (numbers 0 or 1, both optional, so an older page script still works). They are stored per page view and only ever go up.
// Nothing counts them yet: Part 4b makes the two counters and the dashboard lines.
// v0.77.0 (BOT_PROTECTION Part 4b-1): the edge's network number (`request.cf.asn`) goes to cleanBeacon; a visit from a datacenter network is stored with dc = 1 (kept, not dropped).
// The hourly and daily totals and `GET /stats` now also count verified human views (acted 1, webdriver 0, dc 0). `/stats` adds `verifiedViews` and `unverifiedViews`; `views` and every other number are unchanged. v0.79.0 (Part 4b-3): `/stats` also gives `unverifiedTimeline` (unverified views per chart step) for the red note; the dashboard draws the lines. v0.80.0 (Part 4b-4): `/stats` also gives `itemUnverified` (per page, country and source: unverified views now and in the period before; null for 7d and life).
// v0.78.0 (BOT_PROTECTION Part 4b-2): one visit per reader per page per 30 minutes. The same one statement (UPSERT_SQL in lib.js) skips the insert when the same session already has another page view of the same address in the last 30 minutes; the answer is 204 as always. The page script (beacon-client.js) sends its first message only after 5 counted reader seconds.
// Vars and bindings: SITE_ORIGIN (required, the only website that may send), DB (the D1 database), RATE_LIMITER (optional rate limit binding), STAMP_SECRET (secret).
// No IP address is read or stored. The country comes from the edge. The answer never carries data about the visitor.

import { guardRequest, issueStamp, isKilled, originOk } from '../shared/guard.js';
import { MAX_BODY, MAX_PATH, cleanBeacon, UPSERT_SQL, eventValues, rollupWindow, HOURLY_SQL, DAILY_SQL, CLEANUP_SQL, statsPlan, groupSources, trendingPlan, trendingList, trendingLimit, groupUnverified, sourceName } from './lib.js';

const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };

/** The headers of an answer. Only the site itself (SITE_ORIGIN) gets a CORS header. */
const reply = (env, origin, extra = {}) => ({
  ...base,
  ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}),
  ...extra,
});

const answer = (status, env, origin, text = null, extra = {}) => new Response(text, { status, headers: reply(env, origin, { ...(text ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}), ...extra }) });

// v0.74.0: the exact fields of one beacon message (BOT_PROTECTION Part 3c). Only the shape and the lengths are checked here; cleanBeacon (lib.js) cleans the values as before.
// The limit is a little above MAX_BODY because the stamp is added to the message.
const STAMP_MAX_MS = 12 * 60 * 60 * 1000;
const RULES = {
  methods: ['POST'],
  route: 'analytics',
  killVar: 'COLLECT_OFF',
  secretVar: 'STAMP_SECRET',
  stampMinMs: 0,
  stampMaxMs: STAMP_MAX_MS,
  allowPlain: true,
  maxBody: MAX_BODY + 128,
  schema: { sid: { max: 64 }, pv: { max: 64 }, path: { max: MAX_PATH }, tz: { max: 64, optional: true }, ref: { max: 300, optional: true }, read: { number: true, optional: true }, scroll: { number: true, optional: true }, acted: { number: true, optional: true }, webdriver: { number: true, optional: true }, pn: { number: true, optional: true } },
};

/** GET /stamp: a signed stamp for /collect (BOT_PROTECTION 6.6). Only the site itself may ask. */
function stampRoute(request, env, origin) {
  if (request.method === 'OPTIONS') return answer(204, env, origin, null, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' });
  if (request.method !== 'GET') return answer(405, env, origin, 'Method not allowed', { Allow: 'GET, OPTIONS' });
  if (!originOk(origin, env.SITE_ORIGIN)) return answer(403, env, origin, 'Forbidden');
  if (isKilled(env.COLLECT_OFF)) return answer(503, env, origin, 'Switched off', { 'Retry-After': '600' });
  if (!env.STAMP_SECRET) return answer(503, env, origin, 'Not ready');
  return issueStamp(env.STAMP_SECRET, Date.now(), RULES.route).then(
    (stamp) => new Response(JSON.stringify({ stamp }), { status: 200, headers: reply(env, origin, { 'Content-Type': 'application/json; charset=utf-8' }) }),
    () => answer(503, env, origin, 'Not ready'),
  );
}

/** Host of SITE_ORIGIN, or '' when the variable is missing or not a web address. */
function siteHost(env) {
  try { return new URL(String(env.SITE_ORIGIN || '')).hostname; } catch { return ''; }
}

/**
 * v0.35.0: one rollup run (BUGS N5). Hourly totals, daily totals, then the deletion of old raw events.
 * The deletion runs only after both totals were written, so a failed run never loses data. Throws on a database error.
 * db is the D1 binding, nowMs the clock in milliseconds.
 */
export async function runRollup(db, nowMs) {
  const w = rollupWindow(Math.floor(nowMs / 1000));
  await db.prepare(HOURLY_SQL).bind(w.hourFrom, w.hourTo).run();
  await db.prepare(DAILY_SQL).bind(w.dayFrom, w.dayTo).run();
  await db.prepare(CLEANUP_SQL).bind(w.cutoff).run();
  return w;
}

// ---- v0.36.0: GET /stats?range=5m|1h|24h|7d|life for the dashboard. Private: needs a GitHub token of a user in ALLOWED_USERS. ----
const tokenCache = new Map(); // token -> { login, until }; a short memory so the dashboard does not ask GitHub on every refresh

/** The GitHub login behind a Bearer token, or '' (no token, GitHub says no, or GitHub cannot be reached). */
async function loginOf(request, getFetch) {
  const m = /^Bearer ([A-Za-z0-9_\-]{10,255})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return '';
  const hit = tokenCache.get(m[1]);
  if (hit && hit.until > Date.now()) return hit.login;
  try {
    const res = await getFetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${m[1]}`, 'User-Agent': 'news-analytics', Accept: 'application/vnd.github+json' } });
    if (!res.ok) return '';
    const login = String((await res.json()).login || '').toLowerCase();
    if (login) { tokenCache.set(m[1], { login, until: Date.now() + 60000 }); if (tokenCache.size > 50) tokenCache.clear(); }
    return login;
  } catch { return ''; }
}

const rows = (r) => (r && Array.isArray(r.results) ? r.results : []);

async function stats(request, env, origin, url, getFetch) {
  const cors = { ...base, 'Content-Type': 'application/json; charset=utf-8', ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}) };
  const no = (status, text) => new Response(JSON.stringify({ error: text }), { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Max-Age': '600' } });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, Allow: 'GET, OPTIONS' } });
  // The list of allowed GitHub users is required: with no list nobody can read the numbers.
  const allowed = String(env.ALLOWED_USERS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return no(503, 'ALLOWED_USERS is not set');
  if (!env.DB) return no(503, 'Not ready');
  const login = await loginOf(request, getFetch);
  if (!login) return no(401, 'Sign in again');
  if (!allowed.includes(login)) return no(403, 'Not allowed');
  const plan = statsPlan(url.searchParams.get('range') || '24h', Math.floor(Date.now() / 1000));
  if (!plan) return no(400, 'range must be 5m, 1h, 24h, 7d or life');
  const run = async (q) => rows(await env.DB.prepare(q.sql).bind(...q.values).all());
  try {
    const [t, pages, countries, sources, devices, browsers, timeline, unverifiedTimeline] = await Promise.all([run(plan.totals), run(plan.pages), run(plan.countries), run(plan.sources), run(plan.devices), run(plan.browsers), run(plan.timeline), run(plan.unverifiedTimeline)]);
    // v0.80.0: per page, country and source, this period against the one before it (5m, 1h and 24h only; null for 7d and life).
    let itemUnverified = null;
    if (plan.itemUnverified) { const [ip, ic, is] = await Promise.all([run(plan.itemUnverified.pages), run(plan.itemUnverified.countries), run(plan.itemUnverified.sources)]); itemUnverified = { pages: groupUnverified(ip), countries: groupUnverified(ic), sources: groupUnverified(is, sourceName) }; }
    const tot = t[0] || {};
    const views = Number(tot.views) || 0;
    const read = Number(tot.read_seconds) || 0;
    const verifiedViews = Math.min(Number(tot.verified_views) || 0, views); // v0.77.0: never more than all views
    const list = (a) => a.map((x) => ({ key: x.k, views: Number(x.views) || 0, avgRead: x.views ? Math.round((Number(x.read_seconds) || 0) / Number(x.views)) : 0 }));
    return new Response(JSON.stringify({ range: plan.range, from: plan.from, to: plan.to, step: plan.step, views, visitors: tot.visitors === null || tot.visitors === undefined ? null : Number(tot.visitors) || 0, avgRead: views ? Math.round(read / views) : 0, verifiedViews, unverifiedViews: Math.max(views - verifiedViews, 0), pages: list(pages), countries: list(countries), sources: groupSources(sources), devices: list(devices), browsers: list(browsers), timeline: timeline.map((x) => ({ t: Number(x.t), views: Number(x.views) || 0 })), itemUnverified, unverifiedTimeline: unverifiedTimeline.map((x) => ({ t: Number(x.t), views: Math.max(Number(x.views) || 0, 0) })) }), { headers: cors });
  } catch { return no(500, 'Could not read'); }
}

// ---- v0.39.0: GET /trending?limit=1..10 for the "Trending" block. Public, but it holds only article addresses and scores. ----
async function trending(request, env, origin, url) {
  const cors = { ...base, 'Content-Type': 'application/json; charset=utf-8', ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}) };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' } });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, Allow: 'GET, OPTIONS' } });
  if (!env.DB) return new Response(JSON.stringify({ error: 'Not ready' }), { status: 503, headers: cors });
  const now = Math.floor(Date.now() / 1000);
  const plan = trendingPlan(now);
  try {
    const res = await env.DB.prepare(plan.sql).bind(...plan.values).all();
    const items = trendingList(rows(res), now, trendingLimit(url.searchParams.get('limit')));
    // One minute of cache keeps the free D1 reads low (one call per article view is the plan).
    return new Response(JSON.stringify({ items }), { headers: { ...cors, 'Cache-Control': 'public, max-age=60' } });
  } catch { return new Response(JSON.stringify({ error: 'Could not read' }), { status: 500, headers: cors }); }
}

export default {
  // Cron Trigger (wrangler.toml, every hour): rollups and cleanup. A failure is logged and the next hour tries again.
  async scheduled(event, env) {
    if (!env.DB) return;
    try { await runRollup(env.DB, Date.now()); } catch (e) { console.error('rollup failed', String(e && e.message || e)); }
  },
  async fetch(request, env, ctx, getFetch = fetch) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname === '/stats') return stats(request, env, origin, url, getFetch);
    if (url.pathname === '/trending') return trending(request, env, origin, url);
    if (url.pathname === '/stamp') return stampRoute(request, env, origin);
    if (url.pathname !== '/collect') return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: reply(env, origin, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }) });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } });

    // Only the site itself may send (BUGS N6). A missing or different origin writes nothing.
    if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN) return answer(403, env, origin, 'Forbidden');
    if (!env.DB) return answer(503, env, origin, 'Not ready');

    // The front checks (BOT_PROTECTION Section 6): switch, size, exact fields, the stamp. A message without a good stamp is not counted.
    const front = await guardRequest(request, env, RULES);
    if (!front.ok && front.drop) return answer(204, env, origin); // the same quiet answer as for a visitor, nothing is stored
    if (!front.ok) return answer(front.status, env, origin, front.error, front.headers);
    const body = front.body;

    const result = cleanBeacon(body, {
      userAgent: request.headers.get('User-Agent') || '',
      country: (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || '',
      siteHost: siteHost(env),
      asn: request.cf && request.cf.asn, // v0.77.0: the network number from the edge (undefined outside Cloudflare, which counts as not a datacenter)
      now: Date.now(), // the Worker's clock, never the browser's (BUGS N3)
    });
    // A bot gets the same quiet answer as a visitor and nothing is stored (BUGS N2).
    if (!result.ok) return result.reason === 'bot' ? answer(204, env, origin) : answer(400, env, origin, 'Bad request');
    const e = result.event;

    // Optional rate limit per session id (not per IP: no IP is read). Without the binding there is no limit here.
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: e.session_id });
        if (!success) return answer(429, env, origin, 'Too many requests');
      } catch { /* a failing limiter must not stop counting */ }
    }

    try {
      await env.DB.prepare(UPSERT_SQL).bind(...eventValues(e)).run();
    } catch {
      return answer(500, env, origin, 'Could not save');
    }
    return answer(204, env, origin);
  },
};
