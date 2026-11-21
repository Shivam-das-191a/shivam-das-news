// Contact endpoint (Cloudflare Worker, v0.47.0, PLAN 16; BUGS N6).
// POST /contact takes one JSON message from the contact form and stores one checked row in D1 (table contact_messages).
// The rules for the message are in lib.js. This file does the HTTP part: who may call, size, Turnstile, rate limit, the database write.
// Vars and bindings: SITE_ORIGIN (required, the only website that may send), TURNSTILE_SECRET (required secret),
// DB (the D1 database), RATE_LIMITER (optional rate limit binding).
// No IP address is stored or sent to the database. The optional limiter gets the address only as its own key.
// With a missing secret or database the endpoint refuses (503): it never accepts a message it cannot check.
// v0.72.0 (BOT_PROTECTION Part 3a): the front checks come from workers/shared/guard.js (kill switch CONTACT_OFF, JSON only, exact fields, the trap field,
// a signed fill-time stamp from GET /stamp, secret STAMP_SECRET). A missing STAMP_SECRET answers 503 like a missing TURNSTILE_SECRET.
// v0.49.0: two private endpoints for the dashboard inbox. GET /messages?status=&limit=&before= lists messages, POST /messages/status sets one message to new, read or done.
// Both need a GitHub token of a user listed in ALLOWED_USERS (same rule as the analytics Worker). With no list nobody can read (503). Messages are never deleted here.

import { guardRequest, issueStamp, isKilled, originOk } from '../shared/guard.js';
import { MAX_BODY, LIMITS, cleanMessage, verifyTurnstile, INSERT_SQL, COUNT_EMAIL_SQL, COUNT_ALL_SQL, insertValues, rateDecision, inboxPlan, LIST_SQL, COUNTS_SQL, UPDATE_SQL, listValues, inboxPage, inboxCounts, statusChange, allowedUsers } from './lib.js';

const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };

/** The headers of an answer. Only the site itself (SITE_ORIGIN) gets a CORS header. */
const headers = (env, origin, extra = {}) => ({
  ...base,
  ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}),
  ...extra,
});

const json = (status, env, origin, obj, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: headers(env, origin, { 'Content-Type': 'application/json; charset=utf-8', ...extra }) });

// v0.72.0: the exact fields of a message. Only the lengths are checked here (all text); the field by field messages for a person stay in lib.js (cleanMessage).
const RULES = {
  methods: ['POST'],
  route: 'contact',
  killVar: 'CONTACT_OFF',
  secretVar: 'STAMP_SECRET',
  maxBody: MAX_BODY,
  schema: { name: { max: LIMITS.name }, email: { max: LIMITS.email }, subject: { max: LIMITS.subject }, message: { max: LIMITS.message }, token: { max: LIMITS.token } },
};

/** GET /stamp: a signed time stamp for the form on the page (BOT_PROTECTION 6.6). Only the site itself may ask. */
async function stampRoute(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' }) });
  }
  if (request.method !== 'GET') return json(405, env, origin, { error: 'Method not allowed' }, { Allow: 'GET, OPTIONS' });
  if (!originOk(origin, env.SITE_ORIGIN)) return json(403, env, origin, { error: 'Forbidden' });
  if (isKilled(env.CONTACT_OFF)) return json(503, env, origin, { error: 'This is switched off for a short time. Please try again later.' }, { 'Retry-After': '600' });
  if (!env.STAMP_SECRET) return json(503, env, origin, { error: 'Not ready' });
  try {
    return json(200, env, origin, { stamp: await issueStamp(env.STAMP_SECRET, Date.now(), RULES.route) });
  } catch { return json(503, env, origin, { error: 'Not ready' }); }
}

const hourAgo = (nowMs) => Math.floor(nowMs / 1000) - 3600;

// ---- v0.49.0: the private inbox endpoints ----
const tokenCache = new Map(); // token -> { login, until }; a short memory so the inbox does not ask GitHub on every refresh

/** The GitHub login behind a Bearer token, or '' (no token, GitHub says no, or GitHub cannot be reached). */
async function loginOf(request, getFetch) {
  const m = /^Bearer ([A-Za-z0-9_\-]{10,255})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return '';
  const hit = tokenCache.get(m[1]);
  if (hit && hit.until > Date.now()) return hit.login;
  try {
    const res = await getFetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${m[1]}`, 'User-Agent': 'news-contact', Accept: 'application/vnd.github+json' } });
    if (!res.ok) return '';
    const login = String((await res.json()).login || '').toLowerCase();
    if (login) { tokenCache.set(m[1], { login, until: Date.now() + 60000 }); if (tokenCache.size > 50) tokenCache.clear(); }
    return login;
  } catch { return ''; }
}

const rowsOf = (r) => (r && Array.isArray(r.results) ? r.results : []);

async function inbox(request, env, origin, url, getFetch) {
  const isList = url.pathname === '/messages';
  const methods = isList ? 'GET' : 'POST';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': methods, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }) });
  }
  if (request.method !== methods) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: headers(env, origin, { Allow: methods + ', OPTIONS', 'Content-Type': 'application/json; charset=utf-8' }) });
  // The list of allowed GitHub users is required: with no list nobody can read the messages.
  const allowed = allowedUsers(env.ALLOWED_USERS);
  if (!allowed.length) return json(503, env, origin, { error: 'ALLOWED_USERS is not set' });
  if (!env.DB) return json(503, env, origin, { error: 'Not ready' });
  const login = await loginOf(request, getFetch);
  if (!login) return json(401, env, origin, { error: 'Sign in again' });
  if (!allowed.includes(login)) return json(403, env, origin, { error: 'Not allowed' });

  if (isList) {
    const plan = inboxPlan(url.searchParams);
    if (!plan) return json(400, env, origin, { error: 'status must be all, new, read or done; limit 1 to 100; before a number' });
    try {
      const list = await env.DB.prepare(LIST_SQL).bind(...listValues(plan)).all();
      const counts = await env.DB.prepare(COUNTS_SQL).all();
      return json(200, env, origin, { ...inboxPage(rowsOf(list), plan.limit), counts: inboxCounts(rowsOf(counts)) });
    } catch { return json(500, env, origin, { error: 'Could not read the messages' }); }
  }

  let text;
  try { text = await request.text(); } catch { return json(400, env, origin, { error: 'Bad request' }); }
  if (text.length > 200) return json(413, env, origin, { error: 'Too large' });
  const change = statusChange(text);
  if (!change) return json(400, env, origin, { error: 'Send { "id": number, "status": "new", "read" or "done" }' });
  try {
    const res = await env.DB.prepare(UPDATE_SQL).bind(change.status, change.id).run();
    const changed = res && res.meta && typeof res.meta.changes === 'number' ? res.meta.changes : 1;
    if (!changed) return json(404, env, origin, { error: 'No such message' });
  } catch { return json(500, env, origin, { error: 'Could not save the change' }); }
  return json(200, env, origin, { ok: true, id: change.id, status: change.status });
}

export default {
  async fetch(request, env, ctx, getFetch = fetch) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname === '/messages' || url.pathname === '/messages/status') return inbox(request, env, origin, url, getFetch);
    if (url.pathname === '/stamp') return stampRoute(request, env, origin);
    if (url.pathname !== '/contact') return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }) });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } });

    // Only the site itself may send (BUGS N6).
    if (!originOk(origin, env.SITE_ORIGIN)) return json(403, env, origin, { error: 'Forbidden' });
    if (!env.DB || !env.TURNSTILE_SECRET || !env.STAMP_SECRET) return json(503, env, origin, { error: 'The form is not ready. Please write to us by email.' });

    // The front checks (BOT_PROTECTION Section 6): switch, JSON only, size, exact fields, the hidden trap, the fill-time stamp.
    const front = await guardRequest(request, env, RULES);
    // A script that filled the hidden field, or sent the form too fast, gets the same answer as a person and nothing is stored or checked.
    if (!front.ok && front.drop) return json(200, env, origin, { ok: true });
    if (!front.ok) return json(front.status, env, origin, { error: front.error, ...(front.field ? { field: front.field } : {}), ...(front.reload ? { reload: true } : {}) }, front.headers);
    const body = front.body;

    const result = cleanMessage(body);
    // A script that filled the hidden field gets the same answer as a person and nothing is stored or checked.
    if (!result.ok && result.reason === 'bot') return json(200, env, origin, { ok: true });
    if (!result.ok && result.reason === 'bad') return json(400, env, origin, { error: 'Bad request' });
    if (!result.ok) return json(400, env, origin, { error: result.error, field: result.field });

    if (!(await verifyTurnstile(result.token, env.TURNSTILE_SECRET, getFetch))) {
      return json(400, env, origin, { error: 'The check failed. Please try again.', field: 'check' });
    }

    // Optional limiter keyed by the visitor address (the binding keeps it, this code does not).
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || result.message.email });
        if (!success) return json(429, env, origin, { error: 'Too many messages. Please try again later.' });
      } catch { /* a failing limiter must not stop a real message */ }
    }

    const nowMs = Date.now(); // the Worker's clock, never the browser's
    try {
      const since = hourAgo(nowMs);
      const byEmail = await env.DB.prepare(COUNT_EMAIL_SQL).bind(result.message.email, since).first();
      const all = await env.DB.prepare(COUNT_ALL_SQL).bind(since).first();
      if (rateDecision(byEmail && byEmail.n, all && all.n)) return json(429, env, origin, { error: 'Too many messages. Please try again later.' });
      await env.DB.prepare(INSERT_SQL).bind(...insertValues(result.message, nowMs)).run();
    } catch {
      return json(500, env, origin, { error: 'Could not save the message. Please write to us by email.' });
    }
    return json(200, env, origin, { ok: true });
  },
};
