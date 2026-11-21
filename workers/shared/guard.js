// Shared Worker guard (v0.71.0, BOT_PROTECTION.md Section 6 and Part 2; BUGS group W).
// The common checks every Worker runs before it touches data, in the order of Section 6:
//   kill switch, method, origin, content type, size, JSON, exact fields, hidden trap field, fill time.
// Rate limits, Turnstile and the content checks are separate helpers below: the Worker calls them after `guardRequest`.
// Pure code: no network and no database here, and nothing reads or keeps an IP address. Only Web Crypto is used.
// The contact Worker (v0.72.0, Part 3a), the push Worker (v0.73.0, Part 3b) and the analytics Worker (v0.74.0, Part 3c) use it. The other Workers are connected one small part at a time.
// A refusal never gives internal details. A trap or a too-fast form gets `drop: true`: the Worker answers "ok" and stores nothing.

export const KILL_WORDS = ['true', '1', 'yes', 'on'];
export const STAMP_MIN_MS = 3000; // a form sent faster than this was filled by a script
export const STAMP_MAX_MS = 2 * 60 * 60 * 1000; // a form older than this must be reloaded
export const DEFAULT_MAX_BODY = 4096; // characters (BOT_PROTECTION 6.3)
export const DEFAULT_HONEYPOT = 'website';
export const DEFAULT_STAMP_FIELD = 'stamp';

/** Is the Worker switched off? `value` is the variable of the Worker (for example env.CONTACT_OFF). */
export const isKilled = (value) => KILL_WORDS.includes(String(value ?? '').trim().toLowerCase());

/** Exact match only (no `*`, no part of an address, no trailing slash). A site origin that is empty, has a `*` or is not an http(s) address never matches. */
export const originOk = (origin, siteOrigin) => typeof siteOrigin === 'string' && /^https?:\/\/[^*\s]+$/.test(siteOrigin) && typeof origin === 'string' && origin === siteOrigin;

/** `methods` is a list like ['POST']. OPTIONS is always answered by the Worker itself. Returns { ok, allow }. */
export function methodCheck(method, methods) {
  const list = (Array.isArray(methods) ? methods : []).map((m) => String(m).toUpperCase());
  const allow = [...new Set([...list, 'OPTIONS'])].join(', ');
  return { ok: list.includes(String(method || '').toUpperCase()), allow };
}

/** JSON only: `application/json` with an optional charset. Anything else is refused. */
export const contentTypeOk = (header) => /^application\/json\s*(;\s*charset=utf-8\s*)?$/i.test(String(header || '').trim());

/**
 * v0.74.0: for a message that must stay a "simple" browser request (the analytics beacon is sent with sendBeacon when the page closes, and a JSON type would
 * need a preflight there). `text/plain` with an optional charset, and the body is still JSON text.
 */
export const plainTextOk = (header) => /^text\/plain\s*(;\s*charset=utf-8\s*)?$/i.test(String(header || '').trim());

/**
 * The declared length (bytes, from the header) and the real text (characters) must both fit.
 * `max` counts characters. One character can be up to 4 bytes (Bengali is 3), so the declared length may be up to 4 times `max`.
 * An unreadable declared length is ignored; the real text still counts.
 */
export function sizeOk(declared, text, max = DEFAULT_MAX_BODY) {
  const d = Number(declared);
  if (declared !== null && declared !== undefined && declared !== '' && Number.isFinite(d) && d > max * 4) return false;
  return typeof text === 'string' && text.length <= max;
}

/** The JSON text as a plain object, or null (arrays, numbers and broken text give null). */
export function parseJson(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

// Control characters except tab (09) and line feed (0A).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * The exact fields of a message. spec = { name: { max: 100, min?: 1, required?: true, oneLine?: true, optional?: true } , ... } (text fields),
 * or { name: { object: true, required?: true } } for a field that holds a plain object (v0.73.0), or { name: { number: true, required?: true } } for a finite number (v0.74.0).
 * Extra fields are refused, except the names in `allow` (the trap field and the stamp field).
 * Text is stripped of control characters and trimmed; `oneLine` also turns line breaks into spaces.
 * Returns { ok: true, value } or { ok: false, reason: 'bad' } (wrong shape) or { ok: false, reason: 'invalid', field }.
 */
export function checkSchema(body, spec, allow = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'bad' };
  const known = new Set([...Object.keys(spec), ...allow]);
  for (const k of Object.keys(body)) if (!known.has(k)) return { ok: false, reason: 'bad' };
  const value = {};
  for (const [field, rule] of Object.entries(spec)) {
    const raw = body[field];
    // v0.73.0: `object: true` takes a plain object (not an array) and hands it on unchanged; the Worker's own code checks what is inside.
    // `optional: true` leaves a missing field out of the result (without it a missing text field becomes an empty text).
    if (rule.object) {
      if (raw === undefined || raw === null) {
        if (rule.required) return { ok: false, reason: 'invalid', field };
        continue;
      }
      if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'bad' };
      value[field] = raw;
      continue;
    }
    // v0.74.0: `number: true` takes a finite number (not text) and hands it on unchanged; the Worker's own code clamps it.
    if (rule.number) {
      if (raw === undefined || raw === null) {
        if (rule.required) return { ok: false, reason: 'invalid', field };
        continue;
      }
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false, reason: 'bad' };
      value[field] = raw;
      continue;
    }
    if (rule.optional && (raw === undefined || raw === null)) continue;
    if (raw !== undefined && raw !== null && typeof raw !== 'string') return { ok: false, reason: 'bad' };
    let text = String(raw ?? '');
    text = rule.oneLine ? text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim() : text.replace(CONTROL, '').trim();
    if (rule.required && text === '') return { ok: false, reason: 'invalid', field };
    if (text !== '' && rule.min && text.length < rule.min) return { ok: false, reason: 'invalid', field };
    if (text.length > rule.max) return { ok: false, reason: 'invalid', field };
    value[field] = text;
  }
  return { ok: true, value };
}

/** The hidden field is invisible to people. Any text in it means a script filled the form. */
export const honeypotFilled = (body, field = DEFAULT_HONEYPOT) => !!body && body[field] !== undefined && body[field] !== null && String(body[field]).trim() !== '';

// ---- the fill-time stamp: "<time in ms>.<signature>" ----
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(secret, text) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(text)));
}

/** A stamp for a form that is shown now. The Worker gives it out from a small GET route; the page sends it back with the message. */
export async function issueStamp(secret, nowMs, route = '') {
  if (!secret) throw new Error('A stamp needs a secret.');
  const t = String(Math.floor(nowMs));
  return `${t}.${await sign(secret, `${route}|${t}`)}`;
}

/**
 * Checks a stamp that came back with a message.
 * { ok: true } or { ok: false, reason: 'missing' | 'bad' | 'future' | 'too_fast' | 'too_old' }.
 * `route` ties the stamp to one form: a stamp of the contact form is no good for the chat.
 */
export async function checkStamp(secret, stamp, nowMs, route = '', { minMs = STAMP_MIN_MS, maxMs = STAMP_MAX_MS } = {}) {
  if (!secret) return { ok: false, reason: 'bad' };
  if (typeof stamp !== 'string' || stamp === '') return { ok: false, reason: 'missing' };
  const m = /^(\d{10,15})\.([0-9a-f]{64})$/.exec(stamp);
  if (!m) return { ok: false, reason: 'bad' };
  const expected = await sign(secret, `${route}|${m[1]}`);
  // Same length (64) on both sides; the comparison does not stop at the first different character.
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ m[2].charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: 'bad' };
  const age = nowMs - Number(m[1]);
  if (age < 0) return { ok: false, reason: 'future' };
  if (age < minMs) return { ok: false, reason: 'too_fast' };
  if (age > maxMs) return { ok: false, reason: 'too_old' };
  return { ok: true };
}

// ---- rate limit helpers (the counter itself lives in D1 or in the Workers rate limit binding, set up by each Worker) ----

/** A salted hash for a counter key or a duplicate key. The raw address or text is never stored. */
export async function hashKey(salt, ...parts) {
  const data = enc.encode([salt, ...parts].map(String).join('|'));
  return hex(await crypto.subtle.digest('SHA-256', data)).slice(0, 32);
}

/** The number of the time window that `nowMs` is in. */
export const windowId = (nowMs, windowSec) => Math.floor(nowMs / 1000 / windowSec);

/** Count of requests already seen in this window (before this one) against the limit. Answer 429 with Retry-After when not allowed. */
export function rateCheck(countBefore, limit, nowMs, windowSec) {
  const allowed = Number(countBefore) < limit;
  const retryAfter = Math.max(1, (windowId(nowMs, windowSec) + 1) * windowSec - Math.floor(nowMs / 1000));
  return { allowed, retryAfter };
}

/** The same message twice from the same sender is stored once: a key from the route, the sender key and the sorted fields. */
export async function dedupeKey(salt, route, senderKey, value) {
  const sorted = Object.keys(value).sort().map((k) => [k, value[k]]);
  return hashKey(salt, route, senderKey, JSON.stringify(sorted));
}

// ---- content checks for contact and chat text (BOT_PROTECTION 6.9) ----
const LINK = /(https?:\/\/|www\.)\S+/gi;

export const countLinks = (text) => (String(text || '').match(LINK) || []).length;

/** True when the text has more links than allowed, or when it is nothing but links. */
export function spamLinks(text, max = 2) {
  const t = String(text || '');
  const n = countLinks(t);
  if (n > max) return true;
  return n > 0 && t.replace(LINK, '').replace(/[\s,;.|\-]/g, '') === '';
}

// ---- the whole front part ----

const refuse = (status, error, headers = {}, more = {}) => ({ ok: false, status, error, headers, ...more });

/**
 * Runs the checks in the order of BOT_PROTECTION Section 6 for one request.
 *   request: a Request (or an object with method, headers.get and text()).
 *   env:     SITE_ORIGIN (required), the stamp secret under env[rules.secretVar] when stamps are used, and the kill variable env[rules.killVar].
 *   rules:   { methods: ['POST'], schema, route, maxBody?, killVar?, honeypot?, stampField?, secretVar?, useStamp? (default true when secretVar is given), stampMinMs?, stampMaxMs?, allowPlain? (also accept text/plain) }
 * Returns
 *   { ok: true, body }                       all checks passed; `body` holds only the cleaned fields of the schema
 *   { ok: false, drop: true }                a trap or a too-fast form: answer "ok", store nothing
 *   { ok: false, status, error, headers, field?, reload? }  a refusal: 503 off, 405, 403, 415, 413, 400 (plain message, no details; `field` names a bad field, `reload` asks the page for a new stamp)
 * An OPTIONS request is not handled here.
 */
export async function guardRequest(request, env, rules, nowMs = Date.now()) {
  const e = env || {};
  if (rules.killVar && isKilled(e[rules.killVar])) return refuse(503, 'This is switched off for a short time. Please try again later.', { 'Retry-After': '600' });

  const m = methodCheck(request.method, rules.methods);
  if (!m.ok) return refuse(405, 'Method not allowed', { Allow: m.allow });

  if (!originOk(request.headers.get('Origin'), e.SITE_ORIGIN)) return refuse(403, 'Forbidden');
  const ctype = request.headers.get('Content-Type');
  if (!(contentTypeOk(ctype) || (rules.allowPlain === true && plainTextOk(ctype)))) return refuse(415, 'Send JSON');

  const max = rules.maxBody || DEFAULT_MAX_BODY;
  const declared = request.headers.get('Content-Length');
  if (declared !== null && declared !== '' && Number(declared) > max * 4) return refuse(413, 'Too large');
  let text;
  try {
    text = await request.text();
  } catch {
    return refuse(400, 'Bad request');
  }
  if (!sizeOk(declared, text, max)) return refuse(413, 'Too large');

  const raw = parseJson(text);
  if (!raw) return refuse(400, 'Bad request');

  const trap = rules.honeypot || DEFAULT_HONEYPOT;
  const stampField = rules.stampField || DEFAULT_STAMP_FIELD;
  const useStamp = rules.useStamp !== undefined ? !!rules.useStamp : !!rules.secretVar;

  const allow = [trap, ...(useStamp ? [stampField] : [])];
  const schema = checkSchema(raw, rules.schema, allow);
  if (!schema.ok) return schema.reason === 'invalid' ? refuse(400, `Please check the field: ${schema.field}`, {}, { field: schema.field }) : refuse(400, 'Bad request');

  if (honeypotFilled(raw, trap)) return { ok: false, drop: true };

  if (useStamp) {
    const secret = e[rules.secretVar];
    if (!secret) return refuse(503, 'Not ready');
    // `stampMinMs` and `stampMaxMs` let a form change the fill-time window (the push Worker uses 0 for the minimum: its stamp is asked for right before the call).
    const opts = {};
    if (Number.isFinite(rules.stampMinMs)) opts.minMs = rules.stampMinMs;
    if (Number.isFinite(rules.stampMaxMs)) opts.maxMs = rules.stampMaxMs;
    const s = await checkStamp(secret, raw[stampField], nowMs, rules.route || '', opts);
    if (!s.ok) {
      if (s.reason === 'too_fast') return { ok: false, drop: true };
      // `reload: true` tells the page to ask for a fresh stamp (the text of the person stays in the form).
      if (s.reason === 'too_old') return refuse(400, 'This page is old. Please reload it and try again.', {}, { reload: true });
      return refuse(400, 'Please reload the page and try again.', {}, { reload: true });
    }
  }
  return { ok: true, body: schema.value };
}
