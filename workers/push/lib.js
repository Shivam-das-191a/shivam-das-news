// Push notification rules (v0.50.0, Phase 9 part 1; PLAN 31, LOGICS 19, BUGS group P).
// Pure functions only: no network, no database, no clock of its own (the caller gives "now").
// This file is the one place for every constant. Changing one follows VERSIONING.md.
// What is NOT here yet (later parts): endpoints (part 2), encryption and sending (part 3),
// announce checks and the audience search (part 6), the sender cron (part 7), learning (part 8), digest (part 9).

// ---------------------------------------------------------------- constants

export const MAX_AGE_MIN = 120; // a post older than this is never pushed, and freshness reaches 0 here
export const IMPORT_GUARD = 3; // more posts than this in one announce triggers the guard (part 6)
export const IMPORT_KEEP = 2;
export const LEVELS = ['breaking_only', 'important', 'balanced', 'everything'];
export const DEFAULT_LEVEL = 'balanced';
export const LEVEL_MIN = { important: 65, balanced: 48, everything: 30 }; // breaking_only has no number: the post must be breaking
export const LEVEL_CAP = { breaking_only: 2, important: 2, balanced: 4, everything: 8 }; // default daily limit (breaking_only is not in LOGICS; 2 chosen)
export const LIMIT_CHOICES = [1, 2, 4, 8];
export const MIN_GAP_MIN = 30; // between two notifications (breaking is exempt)
export const EXTRA_BREAKING = 2; // extra daily slots for breaking news
export const EXTRA_HIGH = 1; // extra daily slot for a score of HIGH_SCORE or more
export const HIGH_SCORE = 90;
export const TTL_SEC = { breaking: 7200, normal: 21600, digest: 43200 };
export const URGENCY = { breaking: 'high', normal: 'normal', digest: 'low' };
export const MAX_TERMS = 10; // follow keywords, and also muted keywords
export const MIN_FOLLOWERS_REPORT = 5;
export const MAX_KEYWORD_LENGTH = 40;
export const MAX_KEYWORD_WORDS = 4;
export const THREAD_HOURS = 12; // the same story inside this time replaces the old notification
export const HOLD_MAX = 5; // held items per reader
export const HOLD_HOURS = 6;
export const BODY_WORDS = 300; // first words of the text that count for a keyword match
export const MAX_FAILURES = 5;

export const TITLE_MAX = 70;
export const BODY_MAX = 120;
export const PAYLOAD_MAX_BYTES = 4000; // the encrypted payload must stay under this
export const ENCRYPT_OVERHEAD = 103; // what the encryption adds to the plain JSON: header 86 + delimiter 1 + tag 16 (webpush.js, RFC 8291); the plain JSON plus this must stay under PAYLOAD_MAX_BYTES (BUGS P25)
export const URL_MAX = 1000;
export const IMAGE_MIN_WIDTH = 1200;

// Score weights (LOGICS 19, step 3).
export const W = {
  explicit: 60,
  implicit: 8,
  affinity: 10,
  fresh: 7,
  cat: 0.6,
  kw: 0.8,
  auth: 0.4,
  kwExtraEach: 0.15,
  kwExtraMax: 0.3,
  kwOtherMin: 0.5,
  muteMin: 0.6,
  importance: { breaking: 25, force: 25, featured: 12, trending: 10 },
  implicitRank: [1.0, 0.6, 0.3],
  fatigueEach: 5,
  fatigueTimeMax: 20,
  fatigueWindowMin: 180,
  fatigueSameCategory: 10,
  fatigueSameCategoryWindowMin: 60,
};

// ---------------------------------------------------------------- words

const STOP = new Set(
  ('a an the of to in on for and or at by with from as is are was were be been being this that these those but not no so up out over into than then will ' +
    'has have had do does did can could would should may might after before about amid says said he she they we you his her its their our your my me i if who whom what which when where how why all any more most').split(' '),
);
// "it" and "us" are not stop words on purpose: IT and US are real keywords when written in capitals.

const COMMON = new Set(
  ('news today latest india world update updates breaking live new top headlines headline story stories report reports video videos photo photos big best here now ' +
    'daily online').split(' '),
);

const SIBILANT = /(s|x|z|ch|sh)$/;

function undouble(s) {
  return s.length >= 4 && s[s.length - 1] === s[s.length - 2] && !/[lsz]$/.test(s) ? s.slice(0, -1) : s;
}

/** Light English stemmer. Plural first, then -ing and -ed, then a final e. Never below 3 letters. Words with digits are left alone. */
export function stem(w) {
  if (!/^[a-z]+$/.test(w)) return w;
  let s = w;
  if (s.length > 4) {
    if (s.endsWith('es') && SIBILANT.test(s.slice(0, -2))) s = s.slice(0, -2);
    else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  }
  if (s.length > 4) {
    if (s.endsWith('ing') && s.length - 3 >= 3) s = undouble(s.slice(0, -3));
    else if (s.endsWith('ed') && s.length - 2 >= 3) s = undouble(s.slice(0, -2));
  }
  if (s.length > 3 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

/** English tokens: lower case, accents removed, apostrophes joined, split on anything else, stop words dropped, light stem. */
export function tokens(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

const isAcronym = (u) => /^[A-Z0-9]{2,5}$/.test(u) && /[A-Z]/.test(u);

/**
 * Checks and cleans one keyword (the page and the Worker use the same function).
 * Returns { ok: true, keyword: "iphon", tokens: ["iphon"] } or { ok: false, error: "plain message" }.
 * The stored form is tokens.join(" "); read it back with keywordTokens (never stem it twice).
 */
export function cleanKeyword(input) {
  if (typeof input !== 'string') return { ok: false, error: 'Please write a keyword.' };
  const raw = input.replace(/\s+/g, ' ').trim();
  if (!raw) return { ok: false, error: 'Please write a keyword.' };
  if (raw.length > MAX_KEYWORD_LENGTH) return { ok: false, error: `Please keep a keyword under ${MAX_KEYWORD_LENGTH} characters.` };
  if (!/^[A-Za-z0-9 '\u2019-]+$/.test(raw)) return { ok: false, error: 'Please use English letters, digits, spaces, hyphens and apostrophes only.' };
  const units = raw.split(' ');
  if (units.length > MAX_KEYWORD_WORDS) return { ok: false, error: `Please use at most ${MAX_KEYWORD_WORDS} words.` };

  const out = [];
  const plain = []; // lower-case words that are not stop words, for the "too common" check
  for (const u of units) {
    const stripped = u.replace(/['\u2019-]/g, '');
    if (!stripped) continue;
    if (isAcronym(u)) {
      out.push(u.toLowerCase());
      plain.push(u.toLowerCase());
      continue;
    }
    if (STOP.has(stripped.toLowerCase())) continue;
    if (/^[0-9]+$/.test(stripped)) {
      out.push(stripped); // a number is fine next to a word (iPhone 17); it is checked below that it does not stand alone
      plain.push(stripped);
      continue;
    }
    if (stripped.length < 3) return { ok: false, error: 'This word is too short. Write short forms such as UN or EU in capital letters.' };
    out.push(...tokens(u));
    plain.push(...u.toLowerCase().replace(/['\u2019]/g, '').split('-').filter(Boolean));
  }
  if (!out.length) return { ok: false, error: 'Please write a more specific keyword.' };
  if (out.every((t) => /^[0-9]+$/.test(t))) return { ok: false, error: 'Please add a word to the number.' };
  if (out.length > MAX_KEYWORD_WORDS) return { ok: false, error: `Please use at most ${MAX_KEYWORD_WORDS} words.` };
  if (plain.every((w) => COMMON.has(w))) return { ok: false, error: 'This word is too common to follow. Please try a more specific one.' };
  return { ok: true, keyword: out.join(' '), tokens: out };
}

/** The tokens of a stored (already cleaned) keyword. */
export const keywordTokens = (stored) => String(stored ?? '').split(' ').filter(Boolean);

/** One word per index row: the keyword index (push_terms, kind kwtok) holds these. */
export const keywordIndexTerms = (stored) => [...new Set(keywordTokens(stored))];

// ---------------------------------------------------------------- post fields and keyword match

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** A time as milliseconds: a number, a Date or an ISO text. NaN when it cannot be read. */
export function toMs(v) {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  return typeof v === 'string' ? Date.parse(v) : NaN;
}

/** The token lists a keyword is matched against. */
export function postFields(post) {
  const p = post || {};
  const body = String(p.bodyStart ?? p.body ?? '').split(/\s+/).filter(Boolean).slice(0, BODY_WORDS).join(' ');
  const tags = (Array.isArray(p.tags) ? p.tags : []).map((t) => tokens(t)).filter((t) => t.length);
  const title = tokens(p.title);
  const description = tokens(p.description);
  return {
    title,
    focus: tokens(p.focus),
    tags,
    description,
    bodyStart: tokens(body),
    category: norm(p.category),
    author: norm(p.author),
    union: new Set([...title, ...description, ...tags.flat()]),
  };
}

/** True when the phrase tokens appear next to each other, in that order, inside the list. */
export function phraseIn(phrase, list) {
  const n = phrase.length;
  if (!n || list.length < n) return false;
  for (let i = 0; i + n <= list.length; i++) {
    let j = 0;
    while (j < n && list[i + j] === phrase[j]) j++;
    if (j === n) return true;
  }
  return false;
}

/** Match strength 0 to 1 (PLAN 31.6). phrase is a token array; f comes from postFields. */
export function keywordHit(phrase, f) {
  if (!phrase.length) return 0;
  if (phraseIn(phrase, f.title)) return 1;
  if (phraseIn(phrase, f.focus) || f.tags.some((t) => phraseIn(phrase, t))) return 0.9;
  if (phraseIn(phrase, f.description)) return 0.6;
  if (phrase.length >= 2 && phrase.every((t) => f.union.has(t))) return 0.5;
  if (phraseIn(phrase, f.bodyStart)) return 0.35;
  return 0;
}

/** Match strength for a muted word: only the title, the focus keyword and the tags count (a hit is 0.9 or 1). */
export function muteHit(phrase, f) {
  if (!phrase.length) return 0;
  if (phraseIn(phrase, f.title)) return 1;
  if (phraseIn(phrase, f.focus) || f.tags.some((t) => phraseIn(phrase, t))) return 0.9;
  return 0;
}

/** Every word of the post that can find a reader in the keyword index (title, tags, focus keyword, description). */
export function postIndexTokens(post) {
  const f = postFields(post);
  return [...new Set([...f.title, ...f.focus, ...f.tags.flat(), ...f.description])];
}

// ---------------------------------------------------------------- importance and score

/** How important the story is: breaking 25, force 25, featured 12, trending 10, else 0 (the highest one counts). */
export function importance(post) {
  const p = post || {};
  const I = W.importance;
  return Math.max(p.breaking ? I.breaking : 0, p.push === 'force' ? I.force : 0, p.featured ? I.featured : 0, p.trending ? I.trending : 0);
}

export const normalizeLevel = (v) => (LEVELS.includes(v) ? v : DEFAULT_LEVEL);

/** The daily limit: one of 1, 2, 4, 8, or the default for the level. */
export function normalizeLimit(level, v) {
  const n = Number(v);
  return LIMIT_CHOICES.includes(n) ? n : LEVEL_CAP[normalizeLevel(level)];
}

/** Extra daily slots: 2 for breaking news and 1 for a score of 90 or more. */
export const dailyCap = (limit, breaking, score) => limit + (breaking ? EXTRA_BREAKING : 0) + (score >= HIGH_SCORE ? EXTRA_HIGH : 0);

/** Can this subscriber receive anything now? Active, not paused, fewer than 5 failures in a row. */
export function isEligible(sub, now) {
  if (!sub || sub.status !== 'active') return false;
  if ((sub.failures || 0) >= MAX_FAILURES) return false;
  if (sub.paused_until && Number(sub.paused_until) > now) return false;
  return true;
}

/**
 * Scores one post for one subscriber (LOGICS 19, step 3).
 * sub:  { status, failures, paused_until, level, learn_on, breaking_all, categories[], keywords[], muted[], authors[], topCategories[], weights{} }
 * post: { category, author, title, description, tags[], focus, breaking, featured, trending, push, publishedAt, bodyStart }
 * ctx:  { now (ms), recent: [{ ts (ms), category }] }   recent = what was sent to this reader lately (3 hours is enough)
 * Returns { send: false, reason } or { send: true, score, parts }.
 * reason is one of: not_eligible, bad_time, muted, no_match, level_breaking, below_level.
 * Delivery rules (limit, gap, quiet hours, threads) are in deliveryDecision, not here.
 */
export function scoreSubscriber(sub, post, ctx) {
  const now = ctx.now;
  if (!isEligible(sub, now)) return { send: false, reason: 'not_eligible' };
  const published = toMs(post.publishedAt);
  if (!Number.isFinite(now) || !Number.isFinite(published)) return { send: false, reason: 'bad_time' }; // when unsure, do not send
  const f = ctx.fields || postFields(post);

  // 3a hard block: a muted word in the title, the focus keyword or the tags
  for (const m of sub.muted || []) if (muteHit(keywordTokens(m), f) >= W.muteMin) return { send: false, reason: 'muted' };

  // 3b explicit choices
  const cat = (sub.categories || []).map(norm).includes(f.category) && f.category ? 1 : 0;
  const hits = (sub.keywords || []).map((k) => keywordHit(keywordTokens(k), f));
  const best = hits.length ? Math.max(...hits) : 0;
  const others = hits.filter((h, i) => h >= W.kwOtherMin && i !== hits.indexOf(best)).length;
  const kwScore = best > 0 ? Math.min(1, best + Math.min(W.kwExtraMax, W.kwExtraEach * others)) : 0;
  const auth = (sub.authors || []).map(norm).includes(f.author) && f.author ? 1 : 0;
  const explicit = Math.min(1, W.cat * cat + W.kw * kwScore + W.auth * auth);
  const breakingAny = !!post.breaking && !!sub.breaking_all;
  if (explicit === 0 && !breakingAny) return { send: false, reason: 'no_match' }; // the gate: no invented interests

  // 3c the other parts
  const rank = sub.learn_on ? (sub.topCategories || []).map(norm).indexOf(f.category) : -1;
  const implicit = rank >= 0 && rank < W.implicitRank.length ? W.implicitRank[rank] : 0;
  const affinity = Math.max(-1, Math.min(1, Number((sub.weights || {})[f.category]) || 0));
  const ageMin = Math.max(0, (now - published) / 60000);
  const fresh = Math.max(0, 1 - ageMin / MAX_AGE_MIN);
  const recent = ctx.recent || [];
  const last3h = recent.filter((r) => now - r.ts < W.fatigueWindowMin * 60000).length;
  const sameCat = recent.some((r) => norm(r.category) === f.category && f.category && now - r.ts < W.fatigueSameCategoryWindowMin * 60000);
  const fatigue = Math.min(W.fatigueTimeMax, W.fatigueEach * last3h) + (sameCat ? W.fatigueSameCategory : 0);
  const imp = importance(post);
  const raw = W.explicit * explicit + W.implicit * implicit + W.affinity * affinity + imp + W.fresh * fresh - fatigue;
  const score = Math.round(Math.max(0, Math.min(100, raw)) * 100) / 100;
  const parts = { explicit, implicit, affinity, importance: imp, fresh: Math.round(fresh * 1000) / 1000, fatigue, breakingAny };

  // 3d level. A breaking story for a reader who asked for "breaking news from any category" is not held back by a number:
  // its own score cannot reach the Balanced or Important line without a category match (see the changelog of 0.50.0).
  if (sub.level === 'breaking_only') return post.breaking ? { send: true, score, parts } : { send: false, reason: 'level_breaking' };
  if (breakingAny && explicit === 0) return { send: true, score, parts };
  const min = LEVEL_MIN[normalizeLevel(sub.level)];
  return score >= min ? { send: true, score, parts } : { send: false, reason: 'below_level', score, parts };
}

// ---------------------------------------------------------------- time zones and quiet hours (BUGS P6)

const fmtCache = new Map();
function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f;
}

/** A zone NAME like Asia/Kolkata (never an offset like +05:30, because an offset breaks at a clock change). */
export function isValidZone(name) {
  if (typeof name !== 'string' || name.length > 64) return false;
  if (name !== 'UTC' && !/^[A-Za-z]+(?:_[A-Za-z]+)*(?:\/[A-Za-z0-9]+(?:[_+-][A-Za-z0-9]+)*)+$/.test(name)) return false;
  try {
    formatter(name);
    return true;
  } catch {
    return false;
  }
}

function localParts(ms, tz) {
  const o = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { day: `${o.year}-${o.month}-${o.day}`, minutes: (Number(o.hour) % 24) * 60 + Number(o.minute) };
}

/** Minutes since local midnight (0 to 1439) in the reader's zone at that moment. */
export const localMinutes = (ms, tz) => localParts(ms, tz).minutes;

/** The local calendar day "YYYY-MM-DD" in the reader's zone (used to reset the daily counter). */
export const localDay = (ms, tz) => localParts(ms, tz).day;

/**
 * Is this moment inside the reader's quiet hours? start and end are minutes since midnight (0 to 1439), in the reader's own zone.
 * Works across midnight (22:00 to 07:00). null, a wrong number or start equal to end means no quiet hours.
 */
export function inQuietHours(ms, tz, start, end) {
  const ok = (n) => Number.isInteger(n) && n >= 0 && n <= 1439;
  if (!ok(start) || !ok(end) || start === end || !isValidZone(tz)) return false;
  const m = localMinutes(ms, tz);
  return start < end ? m >= start && m < end : m >= start || m < end;
}

// ---------------------------------------------------------------- story thread and delivery rules

/** One tag in the form used for thread keys and for the tagCounts given to threadKey. */
export const tagKey = (tag) => tokens(tag).join('-');

/**
 * The story key (LOGICS 19, step 4): the focus keyword, or the two most common tags.
 * tagCounts (optional) is how often each tag is used on the site, keyed by tagKey(tag); without it the first two tags in alphabetical order are used.
 * A post with neither gets its own key, so it never merges with another one.
 */
export function threadKey(post, tagCounts = {}) {
  const p = post || {};
  const focus = tokens(p.focus).join('-');
  if (focus) return focus.slice(0, 60);
  const tags = [...new Set((Array.isArray(p.tags) ? p.tags : []).map(tagKey).filter(Boolean))];
  if (tags.length >= 2) {
    tags.sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0) || (a < b ? -1 : a > b ? 1 : 0));
    return `${tags[0]}+${tags[1]}`.slice(0, 60);
  }
  return `post:${String(p.key || p.url || '').slice(0, 53)}`;
}

/**
 * What to do with a post that scored well for one reader (LOGICS 19, step 4, in this order).
 * sub:  { tz, quiet_start, quiet_end, breaking_in_quiet, daily_limit, level, sent_today, sent_day, last_sent (ms or null), digest_mode }
 * ctx:  { now (ms), recent: [{ ts (ms), thread }] }
 * Returns { action: 'queue', update, thread, ttl, urgency, renotify }
 *      or { action: 'hold', reason: 'quiet' | 'gap' | 'digest', max, hours }
 *      or { action: 'skip', reason: 'limit' }
 * A story update replaces the old notification and uses no daily slot.
 */
export function deliveryDecision(sub, post, score, ctx) {
  const now = ctx.now;
  const breaking = !!post.breaking;
  const thread = threadKey(post, ctx.tagCounts);
  const update = (ctx.recent || []).some((r) => r.thread === thread && now - r.ts < THREAD_HOURS * 3600000);
  const hold = (reason) => ({ action: 'hold', reason, max: HOLD_MAX, hours: HOLD_HOURS });

  if (inQuietHours(now, sub.tz, sub.quiet_start, sub.quiet_end) && !(breaking && sub.breaking_in_quiet)) return hold('quiet');

  if (!update) {
    const limit = normalizeLimit(sub.level, sub.daily_limit);
    const sentToday = isValidZone(sub.tz) && sub.sent_day === localDay(now, sub.tz) ? Number(sub.sent_today) || 0 : 0;
    if (sentToday >= dailyCap(limit, breaking, score)) return { action: 'skip', reason: 'limit' };
    if (!breaking && sub.last_sent != null && now - Number(sub.last_sent) < MIN_GAP_MIN * 60000) return hold('gap');
    if (!breaking && sub.digest_mode && sub.digest_mode !== 'off') return hold('digest');
  }
  const kind = breaking ? 'breaking' : 'normal';
  return { action: 'queue', update, thread, ttl: TTL_SEC[kind], urgency: URGENCY[kind], renotify: breaking };
}

// ---------------------------------------------------------------- the notification (PLAN 31.9)

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}]/gu;
const PLAIN_SIGNS = new Set(['\u00A9', '\u00AE', '\u2122']); // copyright, registered, trade mark: plain text, allowed (PLAN 29.3)

/** True when the text holds an emoji, a keycap, a flag or an emoji selector (PLAN 29.3). */
export const hasEmoji = (text) => (String(text ?? '').match(EMOJI) || []).some((c) => !PLAIN_SIGNS.has(c));

const tidy = (text) => String(text ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

/** Cuts a text to at most max characters at a word boundary, with an ellipsis inside the limit. */
export function cutText(text, max) {
  const chars = [...tidy(text)];
  if (chars.length <= max) return chars.join('');
  let cut = chars.slice(0, max - 1).join('');
  const sp = cut.lastIndexOf(' ');
  if (chars[max - 1] !== ' ' && sp >= max * 0.5) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:.\u2013\u2014-]+$/, '') + '\u2026';
}

const bytes = (s) => new TextEncoder().encode(s).length;

function withPn(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || url.length > URL_MAX) return null;
    u.searchParams.set('pn', '1');
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Builds the notification text for one post.
 * Returns { ok: true, payload, json, bytes } or { ok: false, reason: 'emoji' | 'no_title' | 'bad_url' | 'too_big' }.
 * payload: { v, title, body, url (with ?pn=1), tag, image?, breaking, renotify }.
 * pushTitle and pushBody (editor choices) replace the headline and the description. The text only ever comes from the post, never from a reader's keyword.
 */
export function buildPayload(post, opts = {}) {
  const p = post || {};
  const rawTitle = tidy(p.pushTitle) || tidy(p.title);
  const rawBody = tidy(p.pushBody) || tidy(p.description);
  if ([p.title, p.description, p.pushTitle, p.pushBody].some(hasEmoji)) return { ok: false, reason: 'emoji' };
  if (!rawTitle) return { ok: false, reason: 'no_title' };
  const url = withPn(p.url);
  if (!url) return { ok: false, reason: 'bad_url' };
  const image = p.image && Number(p.imageWidth) >= IMAGE_MIN_WIDTH ? withImage(p.image) : null;
  const breaking = !!p.breaking;
  const tag = opts.thread || threadKey(p, opts.tagCounts);

  let titleMax = TITLE_MAX;
  let bodyMax = BODY_MAX;
  for (;;) {
    const payload = { v: 1, title: cutText(rawTitle, titleMax), body: cutText(rawBody, bodyMax), url, tag, breaking, renotify: breaking };
    if (image) payload.image = image;
    const json = JSON.stringify(payload);
    const size = bytes(json);
    if (size + ENCRYPT_OVERHEAD < PAYLOAD_MAX_BYTES) return { ok: true, payload, json, bytes: size };
    // too big: shorten the body first, then the title; give up when nothing is left to shorten
    if (bodyMax > 20) bodyMax -= 10;
    else if (titleMax > 20) titleMax -= 10;
    else return { ok: false, reason: 'too_big' };
  }
}

function withImage(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && url.length <= URL_MAX ? u.toString() : null;
  } catch {
    return null;
  }
}
