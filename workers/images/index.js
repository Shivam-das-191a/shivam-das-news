// Images endpoint (Cloudflare Worker, v0.101.41, PLAN 34.8; Phase 3c Part 2b).
// POST /fetch takes { "urls": [ ... ] } (at most 30) and answers, for each address, the picture as base64 bytes or a short reason word.
// The download rules (address and redirect checks, host name lookup, size and time limits, byte check) are in lib.js. This file does the HTTP part:
// who may call, size of the request, the rate limit, the answer. It stores nothing, writes nothing to GitHub and logs no address.
// Vars: SITE_ORIGIN (required: the only website whose dashboard may call), ALLOWED_USERS (GitHub logins that may call from the dashboard, comma separated),
//       IMAGES_OFF (kill switch), BLOCK_HOSTS (hosts the owner blocked, comma separated), CALLS_PER_MINUTE (default 20).
// Secret (optional, for the GitHub Action of Phase 3c Part 6): IMAGES_SECRET. A call with the header X-Images-Secret equal to it needs no Origin and no GitHub login.
// With no allowed user and no secret the Worker answers 503: it never serves a caller it cannot identify.
// The rate limit lives in the memory of one Worker instance, so it is a brake and not a wall; it still stops a loop in the dashboard.

import { isKilled } from '../shared/guard.js';
import { fetchPictures, resolveViaDoh, toBase64, MAX_PER_CALL } from './lib.js';

/** The request is a short list of addresses: 30 addresses of up to 2000 characters, plus the JSON around them. */
export const MAX_REQUEST_CHARS = 70000;
export const DEFAULT_CALLS_PER_MINUTE = 20;
export const KEY_FIELD = 'urls';

const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
const headers = (env, origin, extra = {}) => ({ ...base, ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}), ...extra });
const json = (status, env, origin, obj, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: headers(env, origin, { 'Content-Type': 'application/json; charset=utf-8', ...extra }) });

const list = (text) => String(text || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Same-length comparison of two texts through their SHA-256, so the time does not show how many characters were right. */
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

const tokenCache = new Map(); // token -> { login, until }
/** The GitHub login behind a Bearer token, or '' (no token, GitHub says no, or GitHub cannot be reached). Same rule as the contact Worker. */
async function loginOf(request, getFetch) {
  const m = /^Bearer ([A-Za-z0-9_\-]{10,255})$/.exec(request.headers.get('Authorization') || '');
  if (!m) return '';
  const hit = tokenCache.get(m[1]);
  if (hit && hit.until > Date.now()) return hit.login;
  try {
    const res = await getFetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${m[1]}`, 'User-Agent': 'news-images', Accept: 'application/vnd.github+json' } });
    if (!res.ok) return '';
    const login = String((await res.json()).login || '').toLowerCase();
    if (login) { tokenCache.set(m[1], { login, until: Date.now() + 60000 }); if (tokenCache.size > 50) tokenCache.clear(); }
    return login;
  } catch { return ''; }
}

const calls = new Map(); // caller -> [time of each call in the last minute]
/** One more call of `who` at `now`. Returns 0 when it may go on, or the seconds to wait. */
export function rateWait(who, now, limit) {
  const recent = (calls.get(who) || []).filter((t) => now - t < 60000);
  if (recent.length >= limit) { calls.set(who, recent); return Math.max(1, Math.ceil((recent[0] + 60000 - now) / 1000)); }
  recent.push(now);
  calls.set(who, recent);
  if (calls.size > 200) for (const [k, v] of calls) if (!v.some((t) => now - t < 60000)) calls.delete(k);
  return 0;
}

/** The answer for one picture: the bytes go out as base64 text under `data`; the rest is short words and numbers. */
function answer(r) {
  if (!r.ok) return { url: r.url, ok: false, reason: r.reason, ...(r.status ? { status: r.status } : {}), ...(r.text ? { text: r.text } : {}) };
  return { url: r.url, ok: true, kind: r.kind, finalUrl: r.finalUrl, hops: r.hops, size: r.bytes.length, data: toBase64(r.bytes) };
}

export default {
  async fetch(request, env, ctx, getFetch = fetch) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname !== '/fetch') return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }) });
    }
    if (request.method !== 'POST') return json(405, env, origin, { error: 'Method not allowed' }, { Allow: 'POST, OPTIONS' });
    if (isKilled(env.IMAGES_OFF)) return json(503, env, origin, { error: 'This is switched off for a short time. Please try again later.' }, { 'Retry-After': '600' });

    // Who is calling: the GitHub Action (secret header) or a signed-in dashboard user (Bearer token, from the site itself).
    const allowed = list(env.ALLOWED_USERS);
    if (!allowed.length && !env.IMAGES_SECRET) return json(503, env, origin, { error: 'Not ready' });
    let who = '';
    const given = request.headers.get('X-Images-Secret');
    if (given !== null) {
      if (!env.IMAGES_SECRET || !(await sameText(given, env.IMAGES_SECRET))) return json(401, env, origin, { error: 'Sign in again' });
      who = 'action';
    } else {
      if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN) return json(403, env, origin, { error: 'Forbidden' });
      if (!allowed.length) return json(503, env, origin, { error: 'Not ready' });
      const login = await loginOf(request, getFetch);
      if (!login) return json(401, env, origin, { error: 'Sign in again' });
      if (!allowed.includes(login)) return json(403, env, origin, { error: 'Not allowed' });
      who = `user:${login}`;
    }

    if (!/^application\/json\s*(;\s*charset=utf-8\s*)?$/i.test(request.headers.get('Content-Type') || '')) return json(415, env, origin, { error: 'Send JSON' });
    const declared = request.headers.get('Content-Length');
    if (declared && Number(declared) > MAX_REQUEST_CHARS * 4) return json(413, env, origin, { error: 'Too large' });
    let text;
    try { text = await request.text(); } catch { return json(400, env, origin, { error: 'Bad request' }); }
    if (text.length > MAX_REQUEST_CHARS) return json(413, env, origin, { error: 'Too large' });
    let body;
    try { body = JSON.parse(text); } catch { return json(400, env, origin, { error: 'Bad request' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !(KEY_FIELD in body)) return json(400, env, origin, { error: `Send { "${KEY_FIELD}": [addresses] }` });

    const limit = Number.isFinite(Number(env.CALLS_PER_MINUTE)) && Number(env.CALLS_PER_MINUTE) > 0 ? Number(env.CALLS_PER_MINUTE) : DEFAULT_CALLS_PER_MINUTE;
    const wait = rateWait(who, Date.now(), limit);
    if (wait) return json(429, env, origin, { error: 'Too many calls. Try again in a moment.' }, { 'Retry-After': String(wait) });

    const out = await fetchPictures(body[KEY_FIELD], {
      fetch: getFetch,
      resolveHost: (host) => resolveViaDoh(host, getFetch),
      referrer: env.SITE_ORIGIN || undefined,
      blockHosts: list(env.BLOCK_HOSTS),
    });
    if (!out.ok) {
      const status = out.reason === 'too_many' ? 413 : 400;
      const text2 = out.reason === 'too_many' ? `At most ${MAX_PER_CALL} addresses in one call.` : out.reason === 'empty' ? 'Send at least one address.' : 'The list must be text addresses.';
      return json(status, env, origin, { error: text2, reason: out.reason });
    }
    return json(200, env, origin, { results: out.results.map(answer) });
  },
};
