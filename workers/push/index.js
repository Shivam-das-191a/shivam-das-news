// Push endpoint (Cloudflare Worker, v0.52.0, Phase 9 part 2; PLAN 31.1, 31.3, 31.11).
// POST /subscribe     a browser gives its push subscription and its choices. One row for one browser (BUGS P18).
// POST /preferences   { sub, token }                 reads the saved choices.
//                     { sub, token, prefs?, pause? } changes them. Fields that are not sent keep their value.
// POST /unsubscribe   { sub, token } removes the reader and everything that belongs to the reader (BUGS P19).
// POST /test          { sub, token } sends one fixed test message to the caller's own browser (v0.62.0, part 5c-5). One a minute for each reader; it never uses the daily limit.
//                     It needs the sender keys: VAPID_PUBLIC_KEY (variable), VAPID_PRIVATE_KEY and VAPID_SUBJECT (secrets). Without them it answers 503 and sends nothing.
// POST /feedback      (v0.98.0, part 8a) { sub, token, event: open | close | less, tag } the reader's tap on a notification moves one learned category weight (feedback.js, PLAN 31.8). Always answers 200 { ok, applied } for a known reader.
//                     v0.101.0 (part 8c-2): saving choices without a category also removes the counted "Less like this" taps of that category.
//                     v0.100.0 (part 8c-1): a "less" tap is also counted (table push_less); the read answer of /preferences gets `suggestRemove: [{ category, count }]` when a followed category has 3 or more taps in 30 days.
// POST /announce      (v0.64.0, part 6a) the deploy job gives the posts that went live. Header X-Announce-Secret, no browser, no CORS. Checks the posts (PLAN 31.5) and records the good ones.
//                     v0.65.0 (part 6b): before a post is recorded the Worker opens its address (status 200, HTML, no noindex; livecheck.js). It finds no readers and sends nothing yet (parts 6c and later). Needs the secret ANNOUNCE_SECRET (at least 32 characters); without it the route answers 503.
// v0.73.0 (BOT_PROTECTION Part 3b): the four browser routes use workers/shared/guard.js (JSON only, exact fields, the hidden trap). POST /subscribe also needs a signed stamp
// from GET /stamp (secret STAMP_SECRET; without it /subscribe answers 503). The kill switch PUSH_SUBSCRIBE_OFF pauses /subscribe and /stamp only: /unsubscribe, /preferences and /test
// always work, so a reader can always remove their data (PLAN 31.3). The stamp is a speed bump (BOT_PROTECTION Section 6), not a proof of a person.
// The rules and the SQL are in prefs.js (readers) and announce.js (posts); the scoring rules of part 1 are in lib.js. Sending: the cron (scheduled) and the plan after /announce are in control.js (v0.69.0, part 7b). The hourly clean-up of old rows is in cleanup.js (v0.83.0, part 7c).
// Vars and bindings: SITE_ORIGIN (required, the only website that may call), CONSENT_COUNTRIES (optional list),
// DB (the D1 database), RATE_LIMITER (optional rate limit binding).
// The push endpoint address is a secret (BUGS P13): it is stored, never logged, never returned. The browser keeps only the short `sub` id and the manage token.
// No IP address, name, email or user agent is read or stored. The country comes from the edge and only its two letters are kept.
// With no database the Worker refuses (503): it never accepts a subscription it cannot keep.

import { sendPush } from './webpush.js';
import { guardRequest, issueStamp, isKilled, originOk } from '../shared/guard.js';
import { loadVapid, cleanSubject } from './vapid.js';
import { buildPayload } from './lib.js';
import { ANNOUNCE_MAX_BODY, ANNOUNCE_MAX_POSTS, SECRET_HEADER, secretMatches, existingKeysSql, INSERT_POST_SQL, insertValues, prepare, finish } from './announce.js';
import { liveCheckAll } from './livecheck.js';
import { FEEDBACK_EVENTS, TAG_MAX, cleanTag, applyFeedback, TAG_CATEGORY_SQL, SAVE_FEEDBACK_SQL, DELETE_LESS_SQL, CLEAR_LESS_SQL, removedCategories, categoryKey, RECORD_LESS_SQL, LESS_COUNTS_SQL, LESS_MAX_ROWS, LESS_OFFER_AFTER, lessWindowStart, suggestRemove } from './feedback.js';
import { planAccepted, runCron, runCleanupTick } from './control.js';
import {
  MAX_BODY,
  TEST_GAP_MS,
  TEST_TTL_SEC,
  CLAIM_TEST_SQL,
  testPost,
  NEW_SUBS_PER_HOUR,
  HOUR_MS,
  PAUSE_MODES,
  parseBody,
  cleanSubscription,
  cleanPrefs,
  defaultPrefs,
  prefsFromRows,
  publicView,
  pauseState,
  termRows,
  countryOf,
  consentList,
  endpointHash,
  tokenHash,
  newToken,
  safeEqual,
  isSubId,
  isTokenForm,
  LOAD_SQL,
  LOAD_TERMS_SQL,
  COUNT_NEW_SQL,
  UPSERT_SQL,
  UPDATE_SQL,
  DELETE_TERMS_SQL,
  DELETE_ALL_SQL,
  upsertValues,
  updateValues,
  insertTermStatements,
} from './prefs.js';

// The same default list as the geo Worker (workers/geo/index.js, DEFAULT_CONSENT).
const DEFAULT_CONSENT = 'AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO,GB,CH';

const ROUTES = new Set(['/subscribe', '/preferences', '/unsubscribe', '/test', '/feedback']);

// v0.73.0: the exact fields of each browser route (BOT_PROTECTION Part 3b). Only the shape is checked here; what is inside `subscription` and `prefs` is checked by prefs.js as before.
const SUB = { max: 64, optional: true };
const TOKEN = { max: 100, optional: true };
const RULES = {
  '/subscribe': {
    methods: ['POST'], route: 'push-subscribe', killVar: 'PUSH_SUBSCRIBE_OFF', secretVar: 'STAMP_SECRET', stampMinMs: 0, maxBody: MAX_BODY,
    schema: { subscription: { object: true }, prefs: { object: true }, sub: SUB, token: TOKEN },
  },
  '/preferences': { methods: ['POST'], maxBody: MAX_BODY, schema: { sub: SUB, token: TOKEN, prefs: { object: true }, pause: { max: 20, optional: true } } },
  '/unsubscribe': { methods: ['POST'], maxBody: MAX_BODY, schema: { sub: SUB, token: TOKEN } },
  '/test': { methods: ['POST'], maxBody: MAX_BODY, schema: { sub: SUB, token: TOKEN } },
  '/feedback': { methods: ['POST'], maxBody: MAX_BODY, schema: { sub: SUB, token: TOKEN, event: { max: 10, optional: true }, tag: { max: TAG_MAX, optional: true } } },
};

const base = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };

/** Only the site itself (SITE_ORIGIN) gets a CORS header. */
const headers = (env, origin, extra = {}) => ({
  ...base,
  ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}),
  ...extra,
});

const json = (status, env, origin, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: headers(env, origin, { 'Content-Type': 'application/json; charset=utf-8', ...extra }) });

const rowsOf = (r) => (r && Array.isArray(r.results) ? r.results : []);

async function load(env, hash) {
  const row = await env.DB.prepare(LOAD_SQL).bind(hash).first();
  if (!row) return { row: null, terms: [] };
  const terms = rowsOf(await env.DB.prepare(LOAD_TERMS_SQL).bind(hash).all());
  return { row, terms };
}

/** One batch (all or nothing): the subscriber row, then the choice rows replaced. */
function saveStatements(env, hash, prefs, rowStatement) {
  return [
    rowStatement,
    env.DB.prepare(DELETE_TERMS_SQL).bind(hash),
    ...insertTermStatements(hash, termRows(prefs)).map((s) => env.DB.prepare(s.sql).bind(...s.values)),
  ];
}

/** GET /stamp: a signed time stamp for /subscribe (BOT_PROTECTION 6.6). Only the site itself may ask. */
async function stampRoute(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' }) });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } });
  if (!originOk(origin, env.SITE_ORIGIN)) return json(403, env, origin, { error: 'Forbidden' });
  if (isKilled(env.PUSH_SUBSCRIBE_OFF)) return json(503, env, origin, { error: 'Notifications are switched off for a short time. Please try again later.' }, { 'Retry-After': '600' });
  if (!env.STAMP_SECRET) return json(503, env, origin, { error: 'Notifications are not ready.' });
  try {
    return json(200, env, origin, { stamp: await issueStamp(env.STAMP_SECRET, Date.now(), RULES['/subscribe'].route) });
  } catch {
    return json(503, env, origin, { error: 'Notifications are not ready.' });
  }
}

async function subscribe(body, env, origin, request, now) {
  const sub = cleanSubscription(body.subscription);
  if (!sub.ok) return json(400, env, origin, { error: sub.error, field: sub.field });
  const country = countryOf(request.headers.get('CF-IPCountry') || (request.cf && request.cf.country));
  const consent = consentList(env.CONSENT_COUNTRIES === undefined ? DEFAULT_CONSENT : env.CONSENT_COUNTRIES);
  // A new subscriber always starts from the defaults; the browser sends the full set of its choices.
  const checked = cleanPrefs(body.prefs, defaultPrefs(country, consent));
  if (!checked.ok) return json(400, env, origin, { error: checked.error, field: checked.field });

  const hash = await endpointHash(sub.endpoint);
  let existing;
  try {
    existing = (await load(env, hash)).row;
    if (!existing) {
      const recent = await env.DB.prepare(COUNT_NEW_SQL).bind(now - HOUR_MS).first();
      if (recent && Number(recent.n) >= NEW_SUBS_PER_HOUR) return json(429, env, origin, { error: 'Too many new subscribers right now. Please try again later.' });
    }
  } catch {
    return json(500, env, origin, { error: 'Could not save your choices.' });
  }

  // The browser that shows the right token keeps it. A browser that lost it proves it owns the subscription by sending the secret endpoint,
  // and gets a new token (the old one stops working).
  let token = null;
  let th;
  const valid = existing && body.sub === hash && isTokenForm(body.token) && safeEqual(await tokenHash(body.token), existing.token_hash);
  if (valid) th = existing.token_hash;
  else {
    token = newToken();
    th = await tokenHash(token);
  }

  try {
    const stmt = env.DB.prepare(UPSERT_SQL).bind(...upsertValues(sub, hash, th, checked.prefs, country, now));
    await env.DB.batch(saveStatements(env, hash, checked.prefs, stmt));
  } catch {
    return json(500, env, origin, { error: 'Could not save your choices.' });
  }
  const view = publicView(checked.prefs, { status: 'active', paused_until: null }, now);
  return json(200, env, origin, { ok: true, sub: hash, created: !existing, ...(token ? { token } : {}), prefs: view });
}

/** Finds the reader and checks the token. Returns { row, terms } or a Response. */
async function authorize(body, env, origin) {
  if (!isSubId(body.sub) || !isTokenForm(body.token)) return json(401, env, origin, { error: 'Please subscribe again.' });
  let found;
  try {
    found = await load(env, body.sub);
  } catch {
    return json(500, env, origin, { error: 'Could not read your choices.' });
  }
  if (!found.row || found.row.status === 'gone') return json(404, env, origin, { error: 'Not found. Please subscribe again.' });
  if (!safeEqual(await tokenHash(body.token), found.row.token_hash)) return json(403, env, origin, { error: 'Please subscribe again.' });
  return found;
}

async function preferences(body, env, origin, now) {
  const auth = await authorize(body, env, origin);
  if (auth instanceof Response) return auth;
  const { row, terms } = auth;
  const current = prefsFromRows(row, terms);
  const changes = body.prefs !== undefined || body.pause !== undefined;
  if (!changes) {
    // v0.100.0 (part 8c-1): the categories that the reader tapped "Less like this" for 3 times in 30 days and still follows. The field is left out when there are none.
    const answer = { ok: true, sub: body.sub, prefs: publicView(current, row, now) };
    try {
      const counted = rowsOf(await env.DB.prepare(LESS_COUNTS_SQL).bind(row.id, lessWindowStart(now), LESS_OFFER_AFTER).all());
      const offer = suggestRemove(counted, current.categories);
      if (offer.length) answer.suggestRemove = offer;
    } catch {
      /* an old database without the table: no offer */
    }
    return json(200, env, origin, answer);
  }

  const checked = cleanPrefs(body.prefs, current);
  if (!checked.ok) return json(400, env, origin, { error: checked.error, field: checked.field });
  // No "pause" in the request keeps the pause state as it is.
  let pause = { status: row.status, pausedUntil: row.paused_until ?? null };
  if (body.pause !== undefined) {
    const p = PAUSE_MODES.includes(body.pause) ? pauseState(body.pause, now) : null;
    if (!p) return json(400, env, origin, { error: 'Please choose none, day, week or until_on for the pause.', field: 'pause' });
    pause = p;
  }
  try {
    const stmt = env.DB.prepare(UPDATE_SQL).bind(...updateValues(body.sub, checked.prefs, pause, now));
    await env.DB.batch(saveStatements(env, body.sub, checked.prefs, stmt));
  } catch {
    return json(500, env, origin, { error: 'Could not save your choices.' });
  }
  // v0.101.0 (part 8c-2): a category that the reader no longer follows loses its counted "Less like this" taps, so the offer does not come back. A failure here never hides the saved choices.
  const dropped = removedCategories(current.categories, checked.prefs.categories);
  if (dropped.length) {
    try {
      await env.DB.prepare(CLEAR_LESS_SQL).bind(body.sub, JSON.stringify(dropped)).run();
    } catch {
      /* an old database without the table: nothing to clear */
    }
  }
  const saved = { ...row, status: pause.status, paused_until: pause.pausedUntil };
  return json(200, env, origin, { ok: true, sub: body.sub, prefs: publicView(checked.prefs, saved, now) });
}

/**
 * POST /feedback: one tap of the reader (PLAN 31.8). The reader is checked first (sub and token). An unknown event, an empty tag, the test message or a story
 * that was never sent to this reader changes nothing and still answers 200 { ok: true, applied: false }: the service worker never needs an error.
 * The answer holds no category, no weight and no story text.
 */
async function feedback(body, env, origin, now) {
  const auth = await authorize(body, env, origin);
  if (auth instanceof Response) return auth;
  const { row } = auth;
  const event = typeof body.event === 'string' ? body.event : '';
  const tag = cleanTag(body.tag);
  if (!FEEDBACK_EVENTS.includes(event) || !tag || tag === 'test') return json(200, env, origin, { ok: true, applied: false });
  try {
    const found = await env.DB.prepare(TAG_CATEGORY_SQL).bind(row.id, tag).first();
    const done = applyFeedback(row.weights, row.engagement, found && found.category, event);
    if (!done.applied) return json(200, env, origin, { ok: true, applied: false });
    await env.DB.prepare(SAVE_FEEDBACK_SQL).bind(JSON.stringify(done.weights), done.engagement, row.id).run();
    // v0.100.0 (part 8c-1): count the "Less like this" tap. A failure here (an old database without the table push_less) never hides the saved weight.
    if (event === 'less') {
      try {
        const cat = categoryKey(found.category);
        await env.DB.prepare(RECORD_LESS_SQL).bind(row.id, cat, now, row.id, cat, lessWindowStart(now), LESS_MAX_ROWS).run();
      } catch {
        /* the offer is only a help */
      }
    }
    return json(200, env, origin, { ok: true, applied: true });
  } catch {
    return json(500, env, origin, { error: 'Could not save.' });
  }
}

/** Removes the counted "Less like this" taps of a reader (part 8c-1). It never stops the removal: an old database without the table simply has none. */
async function dropLess(env, hash) {
  try {
    await env.DB.prepare(DELETE_LESS_SQL).bind(hash).run();
  } catch {
    /* no table yet, nothing to remove */
  }
}

async function unsubscribe(body, env, origin) {
  if (!isSubId(body.sub) || !isTokenForm(body.token)) return json(401, env, origin, { error: 'Please subscribe again.' });
  let row;
  try {
    row = (await load(env, body.sub)).row;
  } catch {
    return json(500, env, origin, { error: 'Could not remove your data.' });
  }
  if (!row) return json(200, env, origin, { ok: true }); // already gone: nothing to remove
  if (!safeEqual(await tokenHash(body.token), row.token_hash)) return json(403, env, origin, { error: 'Please subscribe again.' });
  await dropLess(env, body.sub);
  try {
    await env.DB.batch(DELETE_ALL_SQL.map((sql) => env.DB.prepare(sql).bind(body.sub)));
  } catch {
    return json(500, env, origin, { error: 'Could not remove your data.' });
  }
  return json(200, env, origin, { ok: true });
}

/**
 * One fixed test message to the caller's own browser. Order: who is it, are the sender keys ready, take the one-a-minute slot, send.
 * The keys are checked before the slot is taken, so a Worker that is not set up does not burn the reader's minute.
 * Answers never contain the push address, the keys or the message text. A browser the push service has dropped (404 or 410) is removed here
 * like everywhere else (the reader has to turn notifications on again).
 */
async function sendTest(body, env, origin, now, getFetch) {
  const auth = await authorize(body, env, origin);
  if (auth instanceof Response) return auth;
  const { row } = auth;

  const keys = await loadVapid(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  const subject = cleanSubject(env.VAPID_SUBJECT);
  if (!keys.ok || !subject) return json(503, env, origin, { error: 'Sending is not switched on yet.' });

  let claimed;
  try {
    const r = await env.DB.prepare(CLAIM_TEST_SQL).bind(now, body.sub, now - TEST_GAP_MS).run();
    claimed = Number(r && r.meta && r.meta.changes) === 1;
  } catch {
    return json(500, env, origin, { error: 'Could not send the test.' });
  }
  if (!claimed) return json(429, env, origin, { error: 'Please wait a minute before you send another test.' });

  const built = buildPayload(testPost(env.SITE_ORIGIN), { thread: 'test' });
  if (!built.ok) return json(500, env, origin, { error: 'Could not send the test.' });

  const sent = await sendPush({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, built.json, {
    vapid: keys.vapid,
    subject,
    ttl: TEST_TTL_SEC,
    urgency: 'high',
    topic: 'test',
    now,
    fetch: getFetch,
  });
  if (sent.ok) return json(200, env, origin, { ok: true });
  if (sent.outcome === 'gone' || sent.outcome === 'bad_sub') {
    await dropLess(env, body.sub);
    try {
      await env.DB.batch(DELETE_ALL_SQL.map((sql) => env.DB.prepare(sql).bind(body.sub)));
    } catch {
      /* the reader is removed by the sender clean-up later (part 7) */
    }
    return json(410, env, origin, { error: 'This browser is no longer subscribed. Please turn notifications on again.', reason: 'gone' });
  }
  if (sent.outcome === 'retry') return json(502, env, origin, { error: 'The browser\'s push service is busy. Please try again in a minute.' });
  return json(503, env, origin, { error: 'Sending is not switched on yet.' }); // rejected: a key or setup problem of ours, not shown in detail
}

/**
 * POST /announce: the posts of one deploy. Order: method, set up (database and secret), the secret, size, shape, then the decisions of announce.js.
 * Never a browser: no CORS header is sent. The answer holds keys, a status and a short reason word, never a text of a post.
 */
async function announce(request, env, now, getFetch) {
  const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...base, 'Content-Type': 'application/json; charset=utf-8' } });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  if (!env.DB || !env.SITE_ORIGIN || typeof env.ANNOUNCE_SECRET !== 'string' || env.ANNOUNCE_SECRET.length < 32) return reply(503, { error: 'Announcing is not switched on yet.' });
  if (!(await secretMatches(request.headers.get(SECRET_HEADER), env.ANNOUNCE_SECRET))) return reply(401, { error: 'Not allowed.' });

  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > ANNOUNCE_MAX_BODY * 4) return reply(413, { error: 'Too large' });
  let text;
  try {
    text = await request.text();
  } catch {
    return reply(400, { error: 'Bad request' });
  }
  if (text.length > ANNOUNCE_MAX_BODY) return reply(413, { error: 'Too large' });
  let parsed = null;
  try {
    const v = JSON.parse(text);
    parsed = v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    parsed = null;
  }
  if (!parsed || !Array.isArray(parsed.posts) || parsed.posts.length === 0) return reply(400, { error: 'Send { "posts": [ ... ] } with at least one post.' });
  if (parsed.posts.length > ANNOUNCE_MAX_POSTS) return reply(413, { error: `At most ${ANNOUNCE_MAX_POSTS} posts in one call.` });

  // Which keys are already recorded (BUGS P-group: a post is announced once).
  const keys = parsed.posts.map((p) => (p && typeof p === 'object' && typeof p.key === 'string' ? p.key : null)).filter((k) => k && k.length <= 120);
  let known = new Set();
  try {
    if (keys.length) known = new Set(rowsOf(await env.DB.prepare(existingKeysSql(keys.length)).bind(...keys).all()).map((r) => r.key));
  } catch {
    return reply(500, { error: 'Could not check the posts.' });
  }

  // v0.65.0 (part 6b): the live check. The pages of the posts that passed the other checks are opened (status 200, HTML, no noindex); a failure skips the post
  // and is NOT recorded, so a later call (the deploy may still be spreading) can try again while the post is younger than MAX_AGE_MIN.
  const prep = prepare(parsed.posts, known, now, env.SITE_ORIGIN);
  const live = await liveCheckAll(prep.passed.map((x) => x.post), getFetch);
  const { results, record } = finish(prep, live);
  if (record.length) {
    try {
      const done = await env.DB.batch(record.map((p) => env.DB.prepare(INSERT_POST_SQL).bind(...insertValues(p, now))));
      // A row that was written by another call a moment earlier changes nothing: that post is a duplicate, not accepted.
      record.forEach((p, n) => {
        if (Number(done && done[n] && done[n].meta && done[n].meta.changes) !== 1) {
          const at = results.findIndex((r) => r.key === p.key && r.status === 'accepted');
          if (at >= 0) results[at] = { key: p.key, status: 'skipped', reason: 'already_announced' };
        }
      });
    } catch {
      return reply(500, { error: 'Could not record the posts.' });
    }
  }
  const accepted = results.filter((r) => r.status === 'accepted').length;
  const answer = { ok: true, accepted, skipped: results.length - accepted, results };
  // v0.69.0 (part 7b): plan the delivery of the accepted posts. It runs only when sending is ready (database, sender keys, no pause), so nothing
  // waits in the queue without a sender. A planning error never turns the announce into an error: the posts are recorded and the answer says how many failed.
  const planning = await planAccepted(env, results.filter((r) => r.status === 'accepted').map((r) => r.key), now);
  if (planning.ran) answer.planning = { planned: planning.planned, queued: planning.queued, held: planning.held, errors: planning.errors, left: planning.left };
  return reply(200, answer);
}

export default {
  // v0.69.0 (part 7b): the cron trigger (every minute, see wrangler.toml) sends one batch from the queue. It never throws.
  async scheduled(event, env, ctx, getFetch = fetch) {
    await runCron(env, Date.now(), getFetch);
    // v0.83.0 (part 7c): the hourly clean-up of old rows. It runs only when the event carries its own time (a real cron tick always does), so a call
    // without one (a test, a manual call) deletes nothing. Its time is the tick's time. It never throws.
    const tickTime = event && Number(event.scheduledTime);
    if (Number.isFinite(tickTime) && tickTime > 0) await runCleanupTick(env, tickTime);
  },
  async fetch(request, env, ctx, getFetch = fetch) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname === '/announce') return announce(request, env, Date.now(), getFetch);
    if (url.pathname === '/stamp') return stampRoute(request, env, origin);
    if (!ROUTES.has(url.pathname)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers(env, origin, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }) });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } });

    // Only the site itself may call (PLAN 31.11).
    if (!env.SITE_ORIGIN || origin !== env.SITE_ORIGIN) return json(403, env, origin, { error: 'Forbidden' });
    if (!env.DB) return json(503, env, origin, { error: 'Notifications are not ready.' });

    // The front checks (BOT_PROTECTION Section 6): switch, JSON only, size, exact fields, the hidden trap, the stamp (subscribe only).
    const front = await guardRequest(request, env, RULES[url.pathname]);
    // A script that filled the hidden field gets the same answer as a person and nothing is stored.
    if (!front.ok && front.drop) return json(200, env, origin, { ok: true });
    if (!front.ok) return json(front.status, env, origin, { error: front.error, ...(front.field ? { field: front.field } : {}), ...(front.reload ? { reload: true } : {}) }, front.headers);
    const body = front.body;

    // Optional limiter keyed by the visitor address (the binding keeps it, this code does not store it).
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
        if (!success) return json(429, env, origin, { error: 'Too many requests. Please try again later.' });
      } catch {
        /* a failing limiter must not stop a real reader */
      }
    }

    const now = Date.now(); // the Worker's clock, never the browser's
    if (url.pathname === '/subscribe') return subscribe(body, env, origin, request, now);
    if (url.pathname === '/preferences') return preferences(body, env, origin, now);
    if (url.pathname === '/test') return sendTest(body, env, origin, now, getFetch);
    if (url.pathname === '/feedback') return feedback(body, env, origin, now);
    return unsubscribe(body, env, origin);
  },
};
