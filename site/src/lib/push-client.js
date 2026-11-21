// Push client (v0.54.0, Phase 9 part 4; PLAN 31.1, 31.2, 31.3, 31.13; BUGS P13, P18, P23).
// What the page (part 5: the soft prompt and /notifications/) calls to subscribe, read and save choices, and unsubscribe.
// Plain functions, no framework, nothing runs when the file is loaded. Nothing here touches the page: the browser, fetch and the
// small store are passed in as `env` (the defaults are the real ones), so every rule is tested without a browser.
// Nothing is switched on: pushConfig() is off until config/push.json holds the Worker address and the public key.
//
// What is kept in this browser (IndexedDB "news-push" / "state" / "main", also read by public/push-sw.js):
//   { api, sub, token, prefs, at }  api = the Worker address, sub = the random id the Worker gave, token = the manage token,
//   prefs = the last choices the Worker confirmed (used only to restore them quietly, see reauthorize).
// The push endpoint address (a secret, BUGS P13) is never stored here, never logged and never shown: it goes to the Worker once, in /subscribe.
// Every function returns { ok: true, ... } or { ok: false, reason, error?, field? } and never throws.
// reasons: off, unsupported, insecure, denied, dismissed, invalid, busy, network, error, not_subscribed, resubscribe.
// v0.62.0 (part 5c-5): sendTest() asks the Worker to send one fixed test message to this browser.
// v0.73.0 (BOT_PROTECTION Part 3b): before every /subscribe call the client asks the Worker for a signed stamp (GET /stamp) and sends it back as `stamp`.
// If the Worker answers `reload: true` the client asks for a new stamp and repeats the call once. No cookie, nothing is kept in the browser for this.

export const DB_NAME = 'news-push';
export const STORE_NAME = 'state';
export const STATE_KEY = 'main';
export const WORKER_PATH = '/push-sw.js';
export const REQUEST_TIMEOUT_MS = 15000;

const B64URL = /^[A-Za-z0-9_-]+$/;

// ---------------------------------------------------------------- config

/** Reads config/push.json. { enabled: false } while it ships empty (the feature is off), or when a value is wrong. */
export function pushConfig(cfg) {
  const off = { enabled: false, api: '', key: '' };
  if (!cfg || typeof cfg !== 'object') return off;
  const api = typeof cfg.endpoint === 'string' ? cfg.endpoint.trim().replace(/\/+$/, '') : '';
  const key = typeof cfg.vapidPublicKey === 'string' ? cfg.vapidPublicKey.trim() : '';
  if (!api || !key) return off;
  let u;
  try {
    u = new URL(api);
  } catch {
    return off;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/' || api.length > 300 || /\s/.test(api)) return off;
  const bytes = urlBase64ToBytes(key);
  if (!bytes || bytes.length !== 65 || bytes[0] !== 4) return off;
  return { enabled: true, api: u.origin, key };
}

/** URL-safe base64 to bytes, or null. Used for the public key the browser needs (applicationServerKey). */
export function urlBase64ToBytes(text) {
  if (typeof text !== 'string' || !text || !B64URL.test(text) || text.length % 4 === 1) return null;
  try {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the small store (IndexedDB)

/** A store with get, set and del for the one saved state. idb is the browser's indexedDB (replaceable in tests). */
export function idbStore(idb) {
  const run = (mode, work) =>
    new Promise((resolve, reject) => {
      let open;
      try {
        open = (idb || globalThis.indexedDB).open(DB_NAME, 1);
      } catch (e) {
        reject(e);
        return;
      }
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME);
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const req = work(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        } catch (e) {
          db.close();
          reject(e);
        }
      };
    });
  return {
    get: async () => (await run('readonly', (s) => s.get(STATE_KEY))) || null,
    set: (value) => run('readwrite', (s) => s.put(value, STATE_KEY)).then(() => undefined),
    del: () => run('readwrite', (s) => s.delete(STATE_KEY)).then(() => undefined),
  };
}

function defaultEnv() {
  const g = globalThis;
  return {
    navigator: g.navigator,
    Notification: g.Notification,
    fetch: g.fetch ? g.fetch.bind(g) : undefined,
    store: idbStore(),
    now: () => Date.now(),
    secure: g.isSecureContext === true,
    tz: () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return undefined;
      }
    },
  };
}

// ---------------------------------------------------------------- support and permission

/** Can this browser do push at all? Returns { ok: true } or { ok: false, reason: 'insecure' | 'unsupported' }. */
export function support(env = defaultEnv()) {
  if (!env.secure) return { ok: false, reason: 'insecure' };
  const nav = env.navigator;
  if (!nav || !('serviceWorker' in nav) || !env.Notification || typeof env.Notification.requestPermission !== 'function') return { ok: false, reason: 'unsupported' };
  return { ok: true };
}

/** 'granted', 'denied', 'default' (not asked yet) or 'unsupported'. */
export function permission(env = defaultEnv()) {
  if (!support(env).ok) return 'unsupported';
  const p = env.Notification.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

export async function readState(env = defaultEnv()) {
  try {
    const s = await env.store.get();
    return s && typeof s === 'object' ? s : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- talking to the Worker

/** GET /stamp. Returns { status, data } like post(); data.stamp is the text to send back. */
async function getStamp(env, api) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await env.fetch(api + '/stamp', { method: 'GET', credentials: 'omit', cache: 'no-store', signal: ctl.signal });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data: data && typeof data === 'object' ? data : {} };
  } catch {
    return { status: 0, data: {} };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /subscribe with a fresh stamp. When the stamp cannot be had, the answer of the stamp call is returned (503 switched off or not ready, 403, or 0 for no network),
 * so the caller's failure mapping stays the same. When the Worker asks to `reload`, one new stamp is fetched and the call is repeated once.
 */
async function postSubscribe(env, api, body) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const g = await getStamp(env, api);
    if (!(g.status === 200 && typeof g.data.stamp === 'string' && g.data.stamp)) return g.status === 200 ? { status: 503, data: {} } : g;
    last = await post(env, api, '/subscribe', { ...body, stamp: g.data.stamp });
    if (!(last.status === 400 && last.data.reload === true)) return last;
  }
  return last;
}

async function post(env, api, path, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await env.fetch(api + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      signal: ctl.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data: data && typeof data === 'object' ? data : {} };
  } catch {
    return { status: 0, data: {} };
  } finally {
    clearTimeout(timer);
  }
}

/** The last confirmed choices in the form the Worker accepts back: the view without the pause (the pause has its own field). */
function savedPrefs(view) {
  if (!view || typeof view !== 'object') return undefined;
  const { pause, ...rest } = view;
  return rest;
}

function failure(r, fallback = 'error') {
  if (r.status === 0) return { ok: false, reason: 'network', error: 'Could not reach the server. Please check your connection and try again.' };
  if (r.status === 400) return { ok: false, reason: 'invalid', error: typeof r.data.error === 'string' ? r.data.error : 'Please check your choices.', field: typeof r.data.field === 'string' ? r.data.field : undefined };
  if (r.status === 429) return { ok: false, reason: 'busy', error: typeof r.data.error === 'string' ? r.data.error : 'Too many requests. Please try again later.' };
  return { ok: false, reason: fallback, error: 'Something went wrong. Please try again.' };
}

async function registration(env) {
  const nav = env.navigator;
  await nav.serviceWorker.register(WORKER_PATH, { scope: '/' });
  return nav.serviceWorker.ready;
}

const sameBytes = (buf, bytes) => {
  if (!buf) return true; // the browser does not say which key it used: assume it is the right one
  const a = new Uint8Array(buf);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
};

/** The browser's push subscription for our key. Returns { sub, fresh } (fresh: made just now). Never asks for permission. */
async function browserSubscription(reg, keyBytes, create) {
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameBytes(sub.options && sub.options.applicationServerKey, keyBytes)) {
    await sub.unsubscribe(); // made with another key (the owner changed the key pair): it cannot receive our messages
    sub = null;
  }
  if (sub || !create) return { sub, fresh: false };
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
  return { sub, fresh: true };
}

// ---------------------------------------------------------------- enable (subscribe)

/**
 * Subscribes this browser. Call it only from the reader's tap on the soft prompt's button, after at least one topic was chosen (PLAN 31.2):
 * the browser's permission box opens here and nowhere else.
 *   prefs  the reader's choices (the Worker checks and may refuse them: reason 'invalid' with the field). The time zone is added.
 * Returns { ok: true, created, prefs } (prefs = what the Worker really saved) or { ok: false, reason, ... }.
 */
export async function enable({ cfg, prefs, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  if (!conf.enabled) return { ok: false, reason: 'off' };
  const sup = support(env);
  if (!sup.ok) return sup;
  try {
    let perm = env.Notification.permission;
    if (perm === 'denied') return { ok: false, reason: 'denied' };
    if (perm !== 'granted') {
      perm = await env.Notification.requestPermission();
      if (perm === 'denied') return { ok: false, reason: 'denied' };
      if (perm !== 'granted') return { ok: false, reason: 'dismissed' };
    }
    const keyBytes = urlBase64ToBytes(conf.key);
    const reg = await registration(env);
    const { sub, fresh } = await browserSubscription(reg, keyBytes, true);
    const state = await readState(env);
    const mine = state && state.api === conf.api && state.sub && state.token ? { sub: state.sub, token: state.token } : {};
    const tz = env.tz ? env.tz() : undefined;
    const sent = { ...(prefs ?? savedPrefs(state && state.prefs) ?? {}) };
    if (tz && sent.tz === undefined) sent.tz = tz;
    const r = await postSubscribe(env, conf.api, { subscription: sub.toJSON(), prefs: sent, ...mine });
    if (r.status === 200 && r.data.ok === true && typeof r.data.sub === 'string') {
      const token = typeof r.data.token === 'string' ? r.data.token : mine.token;
      if (!token) throw new Error('no token');
      await env.store.set({ api: conf.api, sub: r.data.sub, token, prefs: savedPrefs(r.data.prefs), at: env.now() });
      return { ok: true, created: r.data.created === true, prefs: r.data.prefs };
    }
    if (fresh) await sub.unsubscribe().catch(() => {}); // no half state: a browser subscription the Worker does not know would only waste a permission
    return failure(r);
  } catch {
    return { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' };
  }
}

// ---------------------------------------------------------------- calls that need the token

/**
 * Sends the existing browser subscription to /subscribe again without a token. The Worker accepts it because only this browser knows the secret
 * address, and gives a new token (the old one stops working, BUGS P23). The last confirmed choices are sent back so nothing is lost.
 * Used when the Worker says "subscribe again" (401, 403, 404). Never opens the permission box and never makes a new browser subscription.
 */
async function reauthorize(env, conf) {
  if (permission(env) !== 'granted') return false;
  const reg = await env.navigator.serviceWorker.getRegistration(WORKER_PATH).catch(() => null);
  const { sub } = reg ? await browserSubscription(reg, urlBase64ToBytes(conf.key), false) : { sub: null };
  if (!sub) return false;
  const state = await readState(env);
  const r = await postSubscribe(env, conf.api, { subscription: sub.toJSON(), prefs: { ...(savedPrefs(state && state.prefs) ?? {}), ...(env.tz && env.tz() ? { tz: env.tz() } : {}) } });
  if (!(r.status === 200 && r.data.ok === true && typeof r.data.sub === 'string' && typeof r.data.token === 'string')) return false;
  await env.store.set({ api: conf.api, sub: r.data.sub, token: r.data.token, prefs: savedPrefs(r.data.prefs), at: env.now() });
  return true;
}

/**
 * One call with the saved id and token. On 401, 403 or 404 it first looks whether another tab already saved a newer token, then tries to
 * reauthorize once, then repeats the call. Returns { ok: true, r } or { ok: false, reason: 'not_subscribed' | 'resubscribe' | ... }.
 */
async function authed(env, conf, path, extra) {
  let state = await readState(env);
  if (!state || state.api !== conf.api || !state.sub || !state.token) return { ok: false, reason: 'not_subscribed' };
  let r = await post(env, conf.api, path, { sub: state.sub, token: state.token, ...extra });
  if (r.status === 401 || r.status === 403 || r.status === 404) {
    const now = await readState(env);
    if (now && now.token && now.token !== state.token) state = now; // another tab was quicker
    else if (await reauthorize(env, conf)) state = await readState(env);
    else return { ok: false, reason: 'resubscribe', error: 'Please turn notifications on again.' };
    r = await post(env, conf.api, path, { sub: state.sub, token: state.token, ...extra });
    if (r.status === 401 || r.status === 403 || r.status === 404) return { ok: false, reason: 'resubscribe', error: 'Please turn notifications on again.' };
  }
  return { ok: true, r };
}

/** Reads the saved choices from the Worker. Returns { ok: true, prefs } (with prefs.pause) or { ok: false, reason }. */
export async function getPrefs({ cfg, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  if (!conf.enabled) return { ok: false, reason: 'off' };
  try {
    const a = await authed(env, conf, '/preferences', {});
    if (!a.ok) return a;
    if (a.r.status === 200 && a.r.data.ok === true && a.r.data.prefs) {
      const state = await readState(env);
      if (state) await env.store.set({ ...state, prefs: savedPrefs(a.r.data.prefs) });
      // v0.101.0 (part 8c-2): the offer list of the Worker, [{ category, count }]. It is passed on only when it is a real list; the field is left out otherwise.
      const offer = cleanOffer(a.r.data.suggestRemove);
      return offer.length ? { ok: true, prefs: a.r.data.prefs, suggestRemove: offer } : { ok: true, prefs: a.r.data.prefs };
    }
    return failure(a.r);
  } catch {
    return { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' };
  }
}

/** The offer list from the Worker as a clean list: only { category: text, count: whole number from 1 }, at most 10. Anything else gives an empty list. */
export function cleanOffer(raw) {
  const out = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const category = r && typeof r.category === 'string' ? r.category.trim().toLowerCase() : '';
    const count = r ? Number(r.count) : NaN;
    if (category && category.length <= 60 && Number.isInteger(count) && count >= 1 && out.length < 10) out.push({ category, count });
  }
  return out;
}

/**
 * Saves changed choices and/or the pause ('none', 'day', 'week', 'until_on'). Fields that are not sent keep their value.
 * Returns { ok: true, prefs } (what was really saved) or { ok: false, reason: 'invalid', error, field } and so on. Nothing is repaired silently.
 */
export async function savePrefs({ cfg, prefs, pause, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  if (!conf.enabled) return { ok: false, reason: 'off' };
  const extra = {};
  if (prefs !== undefined) extra.prefs = prefs;
  if (pause !== undefined) extra.pause = pause;
  try {
    const a = await authed(env, conf, '/preferences', extra);
    if (!a.ok) return a;
    if (a.r.status === 200 && a.r.data.ok === true && a.r.data.prefs) {
      const state = await readState(env);
      if (state) await env.store.set({ ...state, prefs: savedPrefs(a.r.data.prefs) });
      return { ok: true, prefs: a.r.data.prefs };
    }
    return failure(a.r);
  } catch {
    return { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' };
  }
}

/**
 * "Send me a test notification" (v0.62.0). The Worker sends one fixed message to this browser only; it never uses the daily limit.
 * Returns { ok: true } or { ok: false, reason, error }:
 *   denied       the browser blocks notifications for this site, nothing is asked of the Worker
 *   busy         one test a minute (429); the Worker's own sentence is in error
 *   resubscribe  the Worker or the push service no longer knows this browser (401, 403, 404, 410)
 *   unavailable  sending is not switched on at the Worker (503) or the push service is busy (502); the Worker's sentence is in error
 */
export async function sendTest({ cfg, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  if (!conf.enabled) return { ok: false, reason: 'off' };
  if (permission(env) === 'denied') return { ok: false, reason: 'denied' };
  try {
    const a = await authed(env, conf, '/test', {});
    if (!a.ok) return a;
    const { status, data } = a.r;
    const said = typeof data.error === 'string' && data.error ? data.error : undefined;
    if (status === 200 && data.ok === true) return { ok: true };
    if (status === 410) return { ok: false, reason: 'resubscribe', error: 'Please turn notifications on again.' };
    if (status === 502 || status === 503) return { ok: false, reason: 'unavailable', error: said || 'Could not send the test. Please try again later.' };
    return failure(a.r);
  } catch {
    return { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' };
  }
}

/**
 * "Unsubscribe and delete my data". The Worker first (it removes the reader and everything that belongs to the reader), then this browser.
 * If the Worker cannot be reached nothing is cleared, so the reader can try again. If this browser can no longer prove who it is
 * (its subscription is gone), the local copy is cleared and serverRemoved is false: the Worker deletes a reader it cannot reach by itself (PLAN 31.3).
 * Returns { ok: true, serverRemoved } or { ok: false, reason }.
 */
export async function disable({ cfg, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  if (!conf.enabled) return { ok: false, reason: 'off' };
  try {
    let serverRemoved = false;
    const state = await readState(env);
    if (state && state.api === conf.api && state.sub && state.token) {
      const a = await authed(env, conf, '/unsubscribe', {});
      if (a.ok) {
        if (a.r.status !== 200 || a.r.data.ok !== true) return failure(a.r);
        serverRemoved = true;
      } else if (a.reason !== 'resubscribe' && a.reason !== 'not_subscribed') {
        return a;
      }
    }
    const reg = env.navigator && env.navigator.serviceWorker ? await env.navigator.serviceWorker.getRegistration(WORKER_PATH).catch(() => null) : null;
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await env.store.del();
    return { ok: true, serverRemoved };
  } catch {
    return { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' };
  }
}

/**
 * What the page needs to decide what to show:
 * { enabled, supported, permission, subscribed, hasState } (subscribed: the browser holds a push subscription; hasState: this browser knows its id and token).
 */
export async function status({ cfg, env = defaultEnv() } = {}) {
  const conf = pushConfig(cfg);
  const sup = support(env);
  const out = { enabled: conf.enabled, supported: sup.ok, permission: permission(env), subscribed: false, hasState: false };
  if (!conf.enabled || !sup.ok) return out;
  try {
    const reg = await env.navigator.serviceWorker.getRegistration(WORKER_PATH);
    out.subscribed = !!(reg && (await reg.pushManager.getSubscription()));
    const state = await readState(env);
    out.hasState = !!(state && state.api === conf.api && state.sub && state.token);
  } catch {
    /* the answers stay false: the page then offers to turn notifications on */
  }
  return out;
}
