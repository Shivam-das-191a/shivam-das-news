// Contact message rules (v0.47.0, Phase 7 part 5; BUGS N6: spam protection, size limit, rate limit).
// Pure functions: no network and no database here. The HTTP part is in index.js.
// A message is checked field by field. A spam trap (the hidden field) and too many links are refused.
// No IP address is read, kept or sent anywhere by this code.

export const MAX_BODY = 12000; // characters of the whole JSON text
export const LIMITS = { name: 100, email: 120, subject: 150, message: 4000, token: 2048 };
export const MIN_MESSAGE = 10;
export const MAX_LINKS = 2;
export const PER_EMAIL_HOUR = 3; // messages from one email address in one hour
export const ALL_HOUR = 40; // messages from everybody in one hour (a flood stop)

/** The JSON text as an object, or null. */
export function parseBody(text) {
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

// Control characters except tab (09) and line feed (0A).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

const fail = (field, error) => ({ ok: false, reason: 'invalid', field, error });

/** One line: control characters and line breaks become spaces, runs of spaces become one. */
function oneLine(v) {
  return v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks one message from the form.
 * Returns { ok: true, message: { name, email, subject, message }, token }
 *      or { ok: false, reason: 'bot' }                               (the hidden field was filled: store nothing, answer as if it worked)
 *      or { ok: false, reason: 'bad' }                               (not the shape of a form message)
 *      or { ok: false, reason: 'invalid', field, error }             (a plain message for the person)
 */
export function cleanMessage(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'bad' };
  // The hidden field "website" is invisible to people. Only a script fills it.
  if (body.website !== undefined && body.website !== null && String(body.website).trim() !== '') return { ok: false, reason: 'bot' };
  for (const k of ['name', 'email', 'subject', 'message', 'token']) {
    if (body[k] !== undefined && body[k] !== null && typeof body[k] !== 'string') return { ok: false, reason: 'bad' };
  }

  const name = oneLine(body.name || '');
  if (!name) return fail('name', 'Please write your name.');
  if (name.length > LIMITS.name) return fail('name', `Please keep your name under ${LIMITS.name} characters.`);

  const email = oneLine(body.email || '').toLowerCase();
  if (!email) return fail('email', 'Please write your email address.');
  if (email.length > LIMITS.email || !EMAIL.test(email)) return fail('email', 'This email address does not look right.');

  const subject = oneLine(body.subject || '');
  if (subject.length > LIMITS.subject) return fail('subject', `Please keep the subject under ${LIMITS.subject} characters.`);

  const message = String(body.message || '').replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();
  if (message.length < MIN_MESSAGE) return fail('message', `Please write at least ${MIN_MESSAGE} characters.`);
  if (message.length > LIMITS.message) return fail('message', `Please keep the message under ${LIMITS.message} characters.`);
  const links = (message.match(/https?:\/\/|www\./gi) || []).length;
  if (links > MAX_LINKS) return fail('message', `Please send at most ${MAX_LINKS} links.`);

  const token = String(body.token || '').trim();
  if (token.length < 10 || token.length > LIMITS.token) return { ok: false, reason: 'invalid', field: 'check', error: 'Please complete the check and send again.' };

  return { ok: true, message: { name, email, subject, message }, token };
}

/**
 * Asks Cloudflare Turnstile if the check was passed. Returns true or false (any error is false).
 * getFetch is the fetch function (a fake one in tests). The visitor address is not sent.
 */
export async function verifyTurnstile(token, secret, getFetch) {
  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    const res = await getFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    if (!res.ok) return false;
    const j = await res.json();
    return j && j.success === true;
  } catch {
    return false;
  }
}

export const INSERT_SQL = 'INSERT INTO contact_messages (ts, name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)';
export const COUNT_EMAIL_SQL = 'SELECT COUNT(*) AS n FROM contact_messages WHERE email = ? AND ts >= ?';
export const COUNT_ALL_SQL = 'SELECT COUNT(*) AS n FROM contact_messages WHERE ts >= ?';

/** The values for INSERT_SQL. ts is whole seconds from the Worker clock (never from the browser). */
export function insertValues(m, nowMs) {
  return [Math.floor(nowMs / 1000), m.name, m.email, m.subject, m.message, 'new'];
}

/** Which limit stops this message: 'email', 'all' or null. */
export function rateDecision(nEmail, nAll) {
  if (Number(nEmail) >= PER_EMAIL_HOUR) return 'email';
  if (Number(nAll) >= ALL_HOUR) return 'all';
  return null;
}

// ---- v0.49.0 (Phase 7 part 7): the private inbox side. Only the dashboard uses these. ----
export const STATUSES = ['new', 'read', 'done'];
export const INBOX_DEFAULT = 50;
export const INBOX_MAX = 100;

/** Reads the query of GET /messages. Gives { status, limit, before } or null when something is wrong.
 *  status: all, new, read or done (default all). limit: 1 to 100 (default 50). before: an id, to get the next older page (default 0 = from the newest). */
export function inboxPlan(params) {
  const get = (k) => (params && typeof params.get === 'function' ? params.get(k) : null);
  const status = get('status') === null ? 'all' : get('status');
  if (status !== 'all' && !STATUSES.includes(status)) return null;
  const rawLimit = get('limit');
  let limit = INBOX_DEFAULT;
  if (rawLimit !== null) {
    if (!/^\d{1,4}$/.test(rawLimit)) return null;
    limit = Number(rawLimit);
    if (limit < 1 || limit > INBOX_MAX) return null;
  }
  const rawBefore = get('before');
  let before = 0;
  if (rawBefore !== null) {
    if (!/^\d{1,12}$/.test(rawBefore)) return null;
    before = Number(rawBefore);
  }
  return { status, limit, before };
}

// One more row than asked is read, so the Worker can say whether an older page exists.
export const LIST_SQL = "SELECT id, ts, name, email, subject, message, status FROM contact_messages WHERE (? = 'all' OR status = ?) AND (? = 0 OR id < ?) ORDER BY id DESC LIMIT ?";
export const COUNTS_SQL = 'SELECT status, COUNT(*) AS n FROM contact_messages GROUP BY status';
export const UPDATE_SQL = 'UPDATE contact_messages SET status = ? WHERE id = ?';

/** The values for LIST_SQL. */
export const listValues = (p) => [p.status, p.status, p.before, p.before, p.limit + 1];

/** Cuts the rows to the page and says whether there is an older page. `next` is the id to send as `before`. */
export function inboxPage(rows, limit) {
  const list = Array.isArray(rows) ? rows : [];
  const more = list.length > limit;
  const page = (more ? list.slice(0, limit) : list).map((r) => ({ id: Number(r.id), ts: Number(r.ts), name: String(r.name), email: String(r.email), subject: String(r.subject || ''), message: String(r.message), status: STATUSES.includes(r.status) ? r.status : 'new' }));
  return { messages: page, next: more && page.length ? page[page.length - 1].id : null };
}

/** The counts for each status from COUNTS_SQL rows: always all three keys, whole numbers. */
export function inboxCounts(rows) {
  const out = { new: 0, read: 0, done: 0 };
  for (const r of Array.isArray(rows) ? rows : []) if (STATUSES.includes(r.status)) out[r.status] = Math.max(0, Math.floor(Number(r.n) || 0));
  return out;
}

/** The body of POST /messages/status: { id, status }. Gives { id, status } or null. */
export function statusChange(text) {
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (!Number.isInteger(o.id) || o.id < 1 || o.id > 9007199254740991) return null;
  if (!STATUSES.includes(o.status)) return null;
  return { id: o.id, status: o.status };
}

/** The allowed GitHub logins from the ALLOWED_USERS text (comma list, lower case). */
export const allowedUsers = (text) => String(text || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
