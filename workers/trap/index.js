// v0.90.0 (BOT_PROTECTION Part 7b): the trap Worker. It answers ONLY the route /trap/ and does one job: when an ordinary client opens it, the client's address goes to a Cloudflare IP list for 24 hours.
// A WAF rule on the owner's account (owner click list, BOT_PROTECTION Section 3) blocks that list. Nothing here is connected until the owner deploys it, adds the route and writes TRAP_ENABLED = "true".
// Rules live in ./lib.js (plain functions, 7a). This file only reads the request, sends the Cloudflare calls one after the other and never shows the outcome to the client.
// Vars (wrangler.toml): TRAP_ENABLED (the kill switch: ON only for exactly "true"; the default is OFF), CF_ACCOUNT_ID, CF_LIST_ID (32 letters or numbers each), OWN_IPS (comma list, never blocked), BLOCK_HOURS (1 to 168, default 24).
// Secret: CF_API_TOKEN (Account Filter Lists Edit permission only). The token is never logged and never sent anywhere but api.cloudflare.com.
// Every answer to the client is the same plain 404 with noindex, so nobody can tell from the answer whether the trap is on, whether an address was blocked or why not.
// Logs: only a short reason word (no address, no user agent, no token).

import {
  isTrapRequest, decideTrapHit, blockItem, expiredItemIds, countOurs, hasRoom,
  addRequest, deleteRequest, listRequest, parseListPage, normalizeIp, BLOCK_HOURS, MAX_PER_CALL,
} from './lib.js';

/** Our own spacing: at most one add call every 5 seconds per Worker instance (Cloudflare allows one pending bulk operation per account, BUGS W75). */
export const MIN_ADD_GAP_MS = 5000;
/** The same address is not sent twice within 10 minutes by one Worker instance. */
export const SEEN_WINDOW_MS = 10 * 60 * 1000;
const MAX_SEEN = 500;
/** At most 5 pages of 500 items are read in one run, so one run can never loop for long. */
const MAX_PAGES = 5;
/** At most 5 delete calls (500 items) in one clean-up run. */
const MAX_DELETE_CALLS = 5;

const CF_ID = /^[0-9a-f]{32}$/;
const seen = new Map();
let lastAddMs = 0;

/** For tests only: forget the small memory of this Worker instance. */
export function resetState() { seen.clear(); lastAddMs = 0; }

/** The kill switch. ON only for exactly "true" (any case, spaces allowed). Missing, empty or any other text keeps the trap OFF: the safe side for a rule that blocks people. */
export function trapEnabled(env = {}) {
  return String(env.TRAP_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function ownIps(env = {}) {
  return String(env.OWN_IPS ?? '').split(',').map((s) => normalizeIp(s)).filter(Boolean);
}

export function blockHours(env = {}) {
  const n = Number(String(env.BLOCK_HOURS ?? '').trim());
  return Number.isInteger(n) && n >= 1 && n <= 168 ? n : BLOCK_HOURS;
}

/** True when both ids and the token are there in a usable form. */
export function configured(env = {}) {
  return CF_ID.test(String(env.CF_ACCOUNT_ID ?? '')) && CF_ID.test(String(env.CF_LIST_ID ?? '')) && typeof env.CF_API_TOKEN === 'string' && env.CF_API_TOKEN.length >= 8;
}

function notFound(method) {
  return new Response(method === 'HEAD' ? null : 'Not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** One Cloudflare call. Never throws: { ok, json }. */
async function cf(req, env, fetchFn) {
  try {
    const init = { method: req.method, headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' } };
    if (req.body !== undefined) init.body = req.body;
    const res = await fetchFn(req.url, init);
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { ok: !!res.ok && !(json && json.success === false), json };
  } catch {
    return { ok: false, json: null };
  }
}

/** Every item of the list (up to MAX_PAGES pages). { ok, items }. */
async function listAll(env, fetchFn) {
  const items = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await cf(listRequest(env.CF_ACCOUNT_ID, env.CF_LIST_ID, cursor), env, fetchFn);
    if (!r.ok) return { ok: false, items };
    const p = parseListPage(r.json);
    items.push(...p.items);
    if (!p.next) return { ok: true, items };
    cursor = p.next;
  }
  return { ok: false, items }; // more pages than we read: do not act on a part of the list
}

/**
 * One trap hit. Never throws. Answers { action, reason } for the tests and the log: action is block, record, ignore or skip.
 * deps: { fetch, now } (both optional; tests give their own).
 */
export async function processHit(info, env = {}, deps = {}) {
  try {
    const fetchFn = deps.fetch || globalThis.fetch;
    const now = typeof deps.now === 'number' ? deps.now : Date.now();
    const d = decideTrapHit(info, { ownIps: ownIps(env) });
    if (d.action !== 'block') return { action: d.action, reason: d.reason };
    if (!configured(env)) return { action: 'skip', reason: 'not-configured' };
    const last = seen.get(d.ip);
    if (last !== undefined && now - last < SEEN_WINDOW_MS) return { action: 'skip', reason: 'seen-recently' };
    if (now - lastAddMs < MIN_ADD_GAP_MS) return { action: 'skip', reason: 'throttled' };
    lastAddMs = now; // taken before the first call, so a second hit at the same moment waits
    if (seen.size >= MAX_SEEN) seen.delete(seen.keys().next().value);
    seen.set(d.ip, now);

    const listed = await listAll(env, fetchFn);
    if (!listed.ok) return { action: 'skip', reason: 'list-failed' };
    if (listed.items.some((it) => it.ip === d.ip)) return { action: 'skip', reason: 'already-listed' };
    if (!hasRoom(countOurs(listed.items), 1)) return { action: 'skip', reason: 'list-full' };

    const added = await cf(addRequest(env.CF_ACCOUNT_ID, env.CF_LIST_ID, [blockItem(d.ip, now, blockHours(env))]), env, fetchFn);
    return added.ok ? { action: 'block', reason: 'blocked' } : { action: 'skip', reason: 'add-failed' };
  } catch {
    return { action: 'skip', reason: 'error' };
  }
}

/**
 * The clean-up: deletes only OUR items whose time is over (never the owner's entries). It runs even when the trap is switched off,
 * so turning the kill switch off never leaves an address blocked for ever. Never throws. { deleted, reason }.
 */
export async function cleanup(env = {}, deps = {}) {
  try {
    const fetchFn = deps.fetch || globalThis.fetch;
    const now = typeof deps.now === 'number' ? deps.now : Date.now();
    if (!configured(env)) return { deleted: 0, reason: 'not-configured' };
    const listed = await listAll(env, fetchFn);
    if (!listed.ok) return { deleted: 0, reason: 'list-failed' };
    const ids = expiredItemIds(listed.items, now);
    let deleted = 0;
    for (let i = 0, calls = 0; i < ids.length && calls < MAX_DELETE_CALLS; i += MAX_PER_CALL, calls++) {
      const chunk = ids.slice(i, i + MAX_PER_CALL);
      const r = await cf(deleteRequest(env.CF_ACCOUNT_ID, env.CF_LIST_ID, chunk), env, fetchFn); // one after the other, never together
      if (!r.ok) return { deleted, reason: 'delete-failed' };
      deleted += chunk.length;
    }
    return { deleted, reason: 'done' };
  } catch {
    return { deleted: 0, reason: 'error' };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isTrapRequest(request.method, url.pathname) && trapEnabled(env)) {
      const info = { ip: request.headers.get('CF-Connecting-IP'), userAgent: request.headers.get('User-Agent') };
      const work = processHit(info, env).then((r) => console.log('trap: ' + r.action + ' ' + r.reason));
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work); else await work;
    }
    return notFound(request.method);
  },

  async scheduled(_event, env, ctx) {
    const work = cleanup(env).then((r) => console.log('trap cleanup: ' + r.reason + ' ' + r.deleted));
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work); else await work;
  },
};
