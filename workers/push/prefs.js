// Push subscribe, preferences and unsubscribe rules (v0.52.0, Phase 9 part 2; PLAN 31.1, 31.3, 31.11; BUGS P8, P13, P18, P19, P21).
// Pure functions and SQL text only: no network, no database object, no clock of its own (the caller gives "now").
// index.js does the HTTP part and runs this SQL. The scoring rules stay in lib.js (part 1) and are only imported here.
//
// Two names are used for one browser:
//   endpoint  the push address the browser gives. A SECRET. Stored (needed to send), never logged, never returned.
//   sub       the short id the reader's browser keeps: the first 32 hex characters of a hash of the endpoint.
// The manage token is made by the Worker, shown to the browser once, and only its hash is stored.

import { LEVELS, DEFAULT_LEVEL, LIMIT_CHOICES, MAX_TERMS, normalizeLimit, cleanKeyword, keywordIndexTerms, isValidZone } from './lib.js';

// ---------------------------------------------------------------- limits

export const MAX_BODY = 8000; // bytes of JSON accepted by any call
export const ENDPOINT_MAX = 700;
export const MAX_CATEGORIES = 60;
export const MAX_AUTHORS = 60;
export const MAX_TOP_CATEGORIES = 3;
export const NEW_SUBS_PER_HOUR = 200; // in total, for the whole site (PLAN 31.11, "limited per browser and in total")
export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;
export const TERM_CHUNK = 40; // rows per INSERT: 2 values per row plus 1 is 81, under the 100 value limit of D1
export const MORNING_RANGE = [4, 11];
export const EVENING_RANGE = [16, 23];
export const DEFAULT_QUIET = { start: 1320, end: 420 }; // 22:00 to 07:00
export const DIGEST_MODES = ['off', 'morning', 'evening', 'both'];
export const PAUSE_MODES = ['none', 'day', 'week', 'until_on'];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const HEX32 = /^[0-9a-f]{32}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const bad = (error, field) => ({ ok: false, error, field });

// ---------------------------------------------------------------- hashes and token (WebCrypto, same in a Worker and in Node)

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text))));
}

/** The short id of a browser subscription: 32 hex characters. The endpoint cannot be read back from it (BUGS P13). */
export async function endpointHash(endpoint) {
  return (await sha256Hex('endpoint:' + endpoint)).slice(0, 32);
}

/** The stored form of a manage token: the full hash. */
export async function tokenHash(token) {
  return sha256Hex('token:' + token);
}

/** A new manage token: 32 random bytes as 43 URL-safe characters. */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const isSubId = (v) => typeof v === 'string' && HEX32.test(v);
export const isTokenForm = (v) => typeof v === 'string' && TOKEN.test(v);

/** Compares two texts without stopping at the first difference. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------------------------------------------------------------- the browser's subscription

const b64Bytes = (s) => Math.floor((s.length * 6) / 8);

/**
 * Checks the subscription object the browser gives: { endpoint, keys: { p256dh, auth } }.
 * The endpoint must be a plain https address of a push service (no login part, no address in numbers, no localhost).
 * p256dh is a 65 byte public key (starts with 0x04), auth is 16 bytes, both URL-safe base64.
 */
export function cleanSubscription(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return bad('This browser did not give a push subscription.', 'subscription');
  const { endpoint } = s;
  const keys = s.keys && typeof s.keys === 'object' ? s.keys : {};
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > ENDPOINT_MAX || /\s/.test(endpoint)) return bad('The push address is not valid.', 'subscription');
  let u;
  try {
    u = new URL(endpoint);
  } catch {
    return bad('The push address is not valid.', 'subscription');
  }
  const host = u.hostname;
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return bad('The push address is not valid.', 'subscription');
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.startsWith('[') || /^[0-9.]+$/.test(host)) return bad('The push address is not valid.', 'subscription');
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.replace(/=+$/, '') : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.replace(/=+$/, '') : '';
  if (!B64URL.test(p256dh) || b64Bytes(p256dh) !== 65 || p256dh[0] !== 'B') return bad('The browser key is not valid.', 'subscription');
  if (!B64URL.test(auth) || b64Bytes(auth) !== 16) return bad('The browser key is not valid.', 'subscription');
  return { ok: true, endpoint, p256dh, auth };
}

// ---------------------------------------------------------------- country and the consent rule

/** The two-letter country the edge gives, or null. */
export function countryOf(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
}

export const consentList = (text) => String(text ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);

/** Must this reader opt in to "Learn from what I read"? An unknown country counts as yes (the safe side). */
export const needsConsent = (country, list) => !country || list.includes(country);

// ---------------------------------------------------------------- preferences

/** The default choices of a new subscriber (PLAN 31.1). dailyLimit null means "the default of the level". */
export function defaultPrefs(country, list) {
  return {
    categories: [],
    authors: [],
    keywords: [],
    muted: [],
    level: DEFAULT_LEVEL,
    dailyLimit: null,
    breakingAll: true,
    breakingInQuiet: false,
    quiet: { ...DEFAULT_QUIET },
    digest: { mode: 'off', morning: 8, evening: 20 },
    learn: !needsConsent(country, list),
    topCategories: [],
    tz: 'UTC',
  };
}

const isBool = (v) => typeof v === 'boolean';
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/** "22:00" to 1320, or null. */
export function parseClock(v) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof v === 'string' ? v : '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 1320 to "22:00". */
export const formatClock = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function slugList(value, max, label, field) {
  if (!Array.isArray(value)) return bad(`Please send ${label} as a list.`, field);
  const out = [];
  for (const v of value) {
    const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
    if (!s || s.length > 60 || !SLUG.test(s)) return bad(`One of the ${label} is not valid.`, field);
    if (!out.includes(s)) out.push(s);
  }
  if (out.length > max) return bad(`You can choose up to ${max} ${label}.`, field);
  return { ok: true, list: out };
}

const displayOf = (raw) => raw.replace(/\s+/g, ' ').trim();

function keywordList(value, label, field) {
  if (!Array.isArray(value)) return bad(`Please send ${label} as a list.`, field);
  const seen = new Set();
  const out = [];
  for (const v of value) {
    const c = cleanKeyword(v);
    if (!c.ok) return bad(c.error, field);
    if (seen.has(c.keyword)) continue; // the same keyword written twice, or "iPhone" and "iPhones"
    seen.add(c.keyword);
    out.push(displayOf(v));
  }
  if (out.length > MAX_TERMS) return bad(`You can use up to ${MAX_TERMS} ${label}.`, field);
  return { ok: true, list: out };
}

/** The stored form of a keyword written by a reader. */
export const storedKeyword = (display) => {
  const c = cleanKeyword(display);
  return c.ok ? c.keyword : '';
};

export const hasChoice = (p) => p.categories.length > 0 || p.keywords.length > 0 || p.breakingAll === true;

/**
 * Applies what the browser sent (input) on top of base (the defaults, or the choices saved before) and checks everything.
 * Fields that are not in the input keep their value from base. A wrong value is refused with a plain message and the field name;
 * nothing is repaired silently. The caller gives the result back to the browser so the page shows what was really saved.
 * Returns { ok: true, prefs } or { ok: false, error, field }.
 */
export function cleanPrefs(input, base) {
  const src = input === undefined || input === null ? {} : input;
  if (typeof src !== 'object' || Array.isArray(src)) return bad('Bad request', 'prefs');
  const p = { ...base, quiet: base.quiet ? { ...base.quiet } : null, digest: { ...base.digest } };

  if (src.categories !== undefined) {
    const r = slugList(src.categories, MAX_CATEGORIES, 'categories', 'categories');
    if (!r.ok) return r;
    p.categories = r.list;
  }
  if (src.authors !== undefined) {
    const r = slugList(src.authors, MAX_AUTHORS, 'authors', 'authors');
    if (!r.ok) return r;
    p.authors = r.list;
  }
  if (src.keywords !== undefined) {
    const r = keywordList(src.keywords, 'keywords to follow', 'keywords');
    if (!r.ok) return r;
    p.keywords = r.list;
  }
  if (src.muted !== undefined) {
    const r = keywordList(src.muted, 'keywords to mute', 'muted');
    if (!r.ok) return r;
    p.muted = r.list;
  }
  const follow = new Set(p.keywords.map(storedKeyword));
  if (p.muted.some((m) => follow.has(storedKeyword(m)))) return bad('You cannot follow and mute the same keyword.', 'muted');

  if (src.level !== undefined) {
    if (!LEVELS.includes(src.level)) return bad('Please choose one of the alert levels.', 'level');
    p.level = src.level;
  }
  if (src.dailyLimit !== undefined) {
    if (src.dailyLimit === null) p.dailyLimit = null;
    else if (!LIMIT_CHOICES.includes(src.dailyLimit)) return bad('The daily limit must be 1, 2, 4 or 8.', 'dailyLimit');
    else p.dailyLimit = src.dailyLimit;
  }
  for (const k of ['breakingAll', 'breakingInQuiet', 'learn']) {
    if (src[k] !== undefined) {
      if (!isBool(src[k])) return bad('Bad request', k);
      p[k] = src[k];
    }
  }
  if (src.quiet !== undefined) {
    if (src.quiet === null) p.quiet = null;
    else {
      const start = src.quiet && typeof src.quiet === 'object' ? parseClock(src.quiet.start) : null;
      const end = src.quiet && typeof src.quiet === 'object' ? parseClock(src.quiet.end) : null;
      if (start === null || end === null) return bad('Please write quiet hours as HH:MM, for example 22:00.', 'quiet');
      if (start === end) return bad('Quiet hours cannot start and end at the same time. Turn them off instead.', 'quiet');
      p.quiet = { start, end };
    }
  }
  if (src.digest !== undefined) {
    const d = src.digest;
    if (!d || typeof d !== 'object' || !DIGEST_MODES.includes(d.mode)) return bad('Please choose off, morning, evening or both for the digest.', 'digest');
    const morning = d.morning === undefined ? p.digest.morning : d.morning;
    const evening = d.evening === undefined ? p.digest.evening : d.evening;
    if (!isInt(morning) || morning < MORNING_RANGE[0] || morning > MORNING_RANGE[1]) return bad(`The morning digest hour must be ${MORNING_RANGE[0]} to ${MORNING_RANGE[1]}.`, 'digest');
    if (!isInt(evening) || evening < EVENING_RANGE[0] || evening > EVENING_RANGE[1]) return bad(`The evening digest hour must be ${EVENING_RANGE[0]} to ${EVENING_RANGE[1]}.`, 'digest');
    p.digest = { mode: d.mode, morning, evening };
  }
  if (src.tz !== undefined) {
    if (!isValidZone(src.tz)) return bad('The time zone must be a name such as Asia/Kolkata.', 'tz');
    p.tz = src.tz;
  }
  if (src.topCategories !== undefined) {
    const r = slugList(src.topCategories, MAX_TOP_CATEGORIES, 'top categories', 'topCategories');
    if (!r.ok) return r;
    p.topCategories = r.list;
  }
  // Reading habit is kept only while the switch is on (PLAN 31.8).
  if (!p.learn) p.topCategories = [];
  p.dailyLimit = normalizeLimit(p.level, p.dailyLimit);

  if (!hasChoice(p)) return bad('Please choose at least one category, one keyword or Breaking news.', 'choice');
  return { ok: true, prefs: p };
}

/** The digest hours that are stored: a list of local hours. */
export function digestHours(d) {
  if (d.mode === 'morning') return [d.morning];
  if (d.mode === 'evening') return [d.evening];
  if (d.mode === 'both') return [d.morning, d.evening];
  return [];
}

/** How long a pause lasts: 'none', 'day', 'week' or 'until_on'. Returns { status, pausedUntil } or null for a wrong word. */
export function pauseState(mode, now) {
  if (mode === 'none') return { status: 'active', pausedUntil: null };
  if (mode === 'day') return { status: 'active', pausedUntil: now + DAY_MS };
  if (mode === 'week') return { status: 'active', pausedUntil: now + 7 * DAY_MS };
  if (mode === 'until_on') return { status: 'paused', pausedUntil: null };
  return null;
}

// ---------------------------------------------------------------- rows of push_terms

/**
 * The rows [kind, term] that describe the choices (schema.sql, push_terms):
 * cat and author (slugs), kw and mute (the cleaned form used for matching), kwtok (one row per word of each followed keyword: the audience index),
 * kwtext and mutetext (the words as the reader wrote them, so the page can show them again).
 */
export function termRows(p) {
  const rows = [];
  const seen = new Set();
  const add = (kind, term) => {
    const k = kind + '\u0000' + term;
    if (term && !seen.has(k)) {
      seen.add(k);
      rows.push([kind, term]);
    }
  };
  for (const c of p.categories) add('cat', c);
  for (const a of p.authors) add('author', a);
  for (const text of p.keywords) {
    const s = storedKeyword(text);
    add('kw', s);
    for (const t of keywordIndexTerms(s)) add('kwtok', t);
    add('kwtext', text);
  }
  for (const text of p.muted) {
    add('mute', storedKeyword(text));
    add('mutetext', text);
  }
  return rows;
}

/** The choices again, from a push_subs row and its push_terms rows (kind and term). */
export function prefsFromRows(row, terms) {
  const of = (kind) => terms.filter((t) => t.kind === kind).map((t) => t.term).sort();
  const hours = safeJson(row.digest_hours, []);
  const mode = DIGEST_MODES.includes(row.digest_mode) ? row.digest_mode : 'off';
  const morning = mode === 'morning' || mode === 'both' ? hours[0] : 8;
  const evening = mode === 'evening' ? hours[0] : mode === 'both' ? hours[1] : 20;
  return {
    categories: of('cat'),
    authors: of('author'),
    keywords: of('kwtext'),
    muted: of('mutetext'),
    level: LEVELS.includes(row.level) ? row.level : DEFAULT_LEVEL,
    dailyLimit: row.daily_limit,
    breakingAll: !!row.breaking_all,
    breakingInQuiet: !!row.breaking_in_quiet,
    quiet: Number.isInteger(row.quiet_start) && Number.isInteger(row.quiet_end) ? { start: row.quiet_start, end: row.quiet_end } : null,
    digest: { mode, morning: isInt(morning) ? morning : 8, evening: isInt(evening) ? evening : 20 },
    learn: !!row.learn_on,
    topCategories: safeJson(row.top_categories, []),
    tz: row.tz || 'UTC',
  };
}

function safeJson(text, fallback) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(fallback) ? (Array.isArray(v) ? v : fallback) : v;
  } catch {
    return fallback;
  }
}

/** What the browser gets back: the choices with quiet hours as text, plus the pause state. Never the endpoint, the keys or the token hash. */
export function publicView(prefs, row, now) {
  const paused = row.status === 'paused';
  const timed = !paused && row.paused_until && Number(row.paused_until) > now;
  return {
    ...prefs,
    quiet: prefs.quiet ? { start: formatClock(prefs.quiet.start), end: formatClock(prefs.quiet.end) } : null,
    pause: { mode: paused ? 'until_on' : timed ? 'timed' : 'none', until: timed ? Number(row.paused_until) : null },
  };
}

// ---------------------------------------------------------------- SQL (checked against schema.sql in the tests)

export const LOAD_SQL = 'SELECT * FROM push_subs WHERE endpoint_hash = ?';
export const LOAD_TERMS_SQL = "SELECT kind, term FROM push_terms WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?) AND kind IN ('cat','author','kwtext','mutetext')";
export const COUNT_NEW_SQL = 'SELECT COUNT(*) AS n FROM push_subs WHERE created >= ?';

/** Adds a subscriber, or updates the one with the same endpoint (BUGS P18: one row for one browser). Counters, learned weights and engagement are kept. */
export const UPSERT_SQL =
  'INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, level, daily_limit, tz, quiet_start, quiet_end, breaking_all, breaking_in_quiet, learn_on, digest_mode, digest_hours, top_categories, country, status, paused_until, failures, created, last_seen) ' +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, 0, ?, ?) " +
  'ON CONFLICT(endpoint_hash) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, token_hash = excluded.token_hash, ' +
  'level = excluded.level, daily_limit = excluded.daily_limit, tz = excluded.tz, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, ' +
  'breaking_all = excluded.breaking_all, breaking_in_quiet = excluded.breaking_in_quiet, learn_on = excluded.learn_on, digest_mode = excluded.digest_mode, ' +
  "digest_hours = excluded.digest_hours, top_categories = excluded.top_categories, country = excluded.country, status = 'active', paused_until = NULL, failures = 0, last_seen = excluded.last_seen";

export function upsertValues(sub, hash, tokenHashValue, p, country, now) {
  return [
    sub.endpoint,
    hash,
    sub.p256dh,
    sub.auth,
    tokenHashValue,
    p.level,
    p.dailyLimit,
    p.tz,
    p.quiet ? p.quiet.start : null,
    p.quiet ? p.quiet.end : null,
    p.breakingAll ? 1 : 0,
    p.breakingInQuiet ? 1 : 0,
    p.learn ? 1 : 0,
    p.digest.mode,
    JSON.stringify(digestHours(p.digest)),
    JSON.stringify(p.topCategories),
    country,
    now,
    now,
  ];
}

/** Saves new choices of a known subscriber. The row keeps its endpoint, keys, token, counters and weights. */
export const UPDATE_SQL =
  'UPDATE push_subs SET level = ?, daily_limit = ?, tz = ?, quiet_start = ?, quiet_end = ?, breaking_all = ?, breaking_in_quiet = ?, learn_on = ?, ' +
  'digest_mode = ?, digest_hours = ?, top_categories = ?, status = ?, paused_until = ?, last_seen = ? WHERE endpoint_hash = ?';

export function updateValues(hash, p, pause, now) {
  return [
    p.level,
    p.dailyLimit,
    p.tz,
    p.quiet ? p.quiet.start : null,
    p.quiet ? p.quiet.end : null,
    p.breakingAll ? 1 : 0,
    p.breakingInQuiet ? 1 : 0,
    p.learn ? 1 : 0,
    p.digest.mode,
    JSON.stringify(digestHours(p.digest)),
    JSON.stringify(p.topCategories),
    pause.status,
    pause.pausedUntil,
    now,
    hash,
  ];
}

export const TOUCH_SQL = 'UPDATE push_subs SET last_seen = ? WHERE endpoint_hash = ?';

export const DELETE_TERMS_SQL = 'DELETE FROM push_terms WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)';

/** INSERT statements for the term rows, TERM_CHUNK rows at a time. Each finds the subscriber by its hash, so the whole save can be one batch. */
export function insertTermStatements(hash, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += TERM_CHUNK) {
    const part = rows.slice(i, i + TERM_CHUNK);
    const sql =
      'INSERT OR IGNORE INTO push_terms (sub_id, kind, term) SELECT s.id, v.kind, v.term FROM push_subs s, (' +
      part.map(() => 'SELECT ? AS kind, ? AS term').join(' UNION ALL ') +
      ') v WHERE s.endpoint_hash = ?';
    out.push({ sql, values: [...part.flat(), hash] });
  }
  return out;
}

/**
 * Everything that belongs to one reader, removed together (BUGS P19). The children go first because they find the reader through push_subs;
 * the reader row goes last. push_audit has no reader column, so there is nothing to remove there.
 */
// ---------------------------------------------------------------- the test notification (v0.62.0, Phase 9 part 5c-5)

export const TEST_GAP_MS = 60000; // one test a minute for each reader
export const TEST_TTL_SEC = 120; // a test that is not delivered within two minutes is useless: the push service drops it
export const TEST_TITLE = 'Test notification';
export const TEST_BODY = 'Notifications work in this browser. You can close this message.';

/**
 * Takes the "one test a minute" slot of a reader in one statement, so two taps at the same moment cannot both pass.
 * Values: now, endpoint hash, the oldest allowed last_test (now minus TEST_GAP_MS). One changed row means the slot is taken.
 * It writes last_test only: last_sent, sent_today and the duplicate guard are not touched, a test never uses up the daily limit.
 */
export const CLAIM_TEST_SQL = 'UPDATE push_subs SET last_test = ? WHERE endpoint_hash = ? AND (last_test IS NULL OR last_test <= ?)';

/** The fixed post of the test message: a fixed title, a fixed text, the preference page of this site. Nothing from the reader or the request goes in. */
export const testPost = (siteOrigin) => ({ title: TEST_TITLE, description: TEST_BODY, url: String(siteOrigin).replace(/\/+$/, '') + '/notifications/', breaking: false });

export const DELETE_ALL_SQL = [
  'DELETE FROM push_terms WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)',
  'DELETE FROM push_queue WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)',
  'DELETE FROM push_held WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)',
  'DELETE FROM push_sent WHERE sub_id = (SELECT id FROM push_subs WHERE endpoint_hash = ?)',
  'DELETE FROM push_subs WHERE endpoint_hash = ?',
];

// ---------------------------------------------------------------- request body

/** The JSON object in the body, or null. */
export function parseBody(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
