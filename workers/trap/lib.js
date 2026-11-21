// v0.89.0 (BOT_PROTECTION Part 7a): the rules of the trap link, as plain functions. Nothing here reads a request, a clock, a secret or the network;
// it only answers questions and builds the text of two Cloudflare calls. No Worker, no route, no link on any page and no secret use it yet (that is 7b and 7c).
// v0.90.0 (Part 7b): `listRequest` and `parseListPage` added (the text of the call that reads the list, and one page of its answer) for the Worker in index.js.
// Plan: section 9 (a hidden link to /trap/, Disallow in robots.txt, a client that opens it is a scraper, its address goes to a Cloudflare IP list for 24 hours).

export const TRAP_PATH = '/trap/';
export const BLOCK_HOURS = 24;
export const MARK = 'sdn-trap';
/** Our own limit, so a flood of trap hits can never fill the account's IP list. Cloudflare has limits of its own. */
export const MAX_TRAP_ITEMS = 1000;
/** Our own limit for one call: one list call is one bulk operation, and Cloudflare allows only one pending bulk operation per account. */
export const MAX_PER_CALL = 100;
/** A client that says it is one of these is never blocked by this rule (the name can be faked, and a real bot may follow the link once): it is only recorded. */
export const GOOD_BOT_WORDS = ['googlebot', 'google-inspectiontool', 'adsbot-google', 'bingbot', 'duckduckbot', 'applebot', 'yandexbot', 'baiduspider', 'facebookexternalhit', 'twitterbot', 'linkedinbot', 'slackbot', 'whatsapp'];

/** True only for a GET or HEAD to exactly /trap/ (a slash at the end, small letters). Everything else is a normal request. */
export function isTrapRequest(method, pathname) {
  return (method === 'GET' || method === 'HEAD') && pathname === TRAP_PATH;
}

/** A clean address, or null. IPv4 with four plain numbers (no leading zero, so no octal trick); IPv6 in the form the browser engine writes it (small letters, shortest form). No port, no brackets, no zone, no range. */
export function normalizeIp(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t || t.length > 45) return null;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(t);
  if (v4) {
    const parts = v4.slice(1);
    for (const p of parts) if ((p.length > 1 && p[0] === '0') || Number(p) > 255) return null;
    return parts.map(Number).join('.');
  }
  if (!t.includes(':') || !/^[0-9a-fA-F:.]+$/.test(t)) return null;
  try {
    const host = new URL('http://[' + t + ']/').hostname; // '[' + address + ']'
    return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : null;
  } catch { return null; }
}

function v4Parts(ip) { return ip.split('.').map(Number); }

/** The eight 16-bit groups of a clean IPv6 address (the shortest form with "::" is opened up). */
function v6Groups(ip) {
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const fill = ip.includes('::') ? new Array(8 - h.length - t.length).fill('0') : [];
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16));
}

/** True for addresses that no real reader can have over the internet (private, loopback, link-local, shared, documentation, multicast, reserved). Those are never blocked. */
export function isReservedIp(ip) {
  const clean = normalizeIp(ip);
  if (!clean) return true;
  if (!clean.includes(':')) {
    const [a, b, c] = v4Parts(clean);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && (c === 0 || c === 2))
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113);
  }
  const g = v6Groups(clean);
  if (g.length !== 8 || g.some((x) => !Number.isInteger(x))) return true;
  if (g.slice(0, 7).every((x) => x === 0) && g[7] <= 1) return true; // :: and ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isReservedIp([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.')); // IPv4 inside IPv6
  return (g[0] & 0xfe00) === 0xfc00 // unique local fc00::/7
    || (g[0] & 0xffc0) === 0xfe80 // link local fe80::/10
    || (g[0] & 0xff00) === 0xff00 // multicast
    || (g[0] === 0x2001 && g[1] === 0x0db8); // documentation
}

/** True when the browser name says it is one of the well known bots. */
export function claimsGoodBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  return GOOD_BOT_WORDS.some((w) => ua.includes(w));
}

/**
 * What to do with one trap hit. `cfg.ownIps` is a list of the owner's own addresses (never blocked).
 * Answers { action, ip, reason }: 'block' (add to the list), 'record' (only write it down) or 'ignore'.
 */
export function decideTrapHit({ ip, userAgent } = {}, cfg = {}) {
  const clean = normalizeIp(ip);
  if (!clean) return { action: 'ignore', ip: null, reason: 'bad-address' };
  if (isReservedIp(clean)) return { action: 'ignore', ip: clean, reason: 'reserved-address' };
  const own = (Array.isArray(cfg.ownIps) ? cfg.ownIps : []).map(normalizeIp).filter(Boolean);
  if (own.includes(clean)) return { action: 'ignore', ip: clean, reason: 'own-address' };
  if (claimsGoodBot(userAgent)) return { action: 'record', ip: clean, reason: 'good-bot-name' };
  return { action: 'block', ip: clean, reason: 'trap' };
}

function stamp(ms) { return new Date(ms).toISOString(); }

/** One list item for Cloudflare: the address and a comment that says until when it is blocked. The comment starts with MARK, so the clean-up only ever touches our own items. */
export function blockItem(ip, nowMs, hours = BLOCK_HOURS) {
  const clean = normalizeIp(ip);
  if (!clean) throw new Error('trap: not a valid address');
  if (!Number.isFinite(nowMs)) throw new Error('trap: the time must be a number');
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error('trap: hours must be a whole number from 1 to 168');
  return { ip: clean, comment: `${MARK} until=${stamp(nowMs + hours * 3600 * 1000)} seen=${stamp(nowMs)}` };
}

/** The end time (milliseconds) written in one of our comments, or null for any other comment. */
export function untilOf(comment) {
  const m = /^sdn-trap until=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)(?: |$)/.exec(String(comment || ''));
  const ms = m ? Date.parse(m[1]) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/** The ids of our own items whose time is over. An item without our mark (the owner's own entries) or with a broken date is never returned, so it is never deleted. */
export function expiredItemIds(items, nowMs) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => it && typeof it.id === 'string' && it.id && (untilOf(it.comment) ?? Infinity) <= nowMs).map((it) => it.id);
}

/** How many of our own items are in the list (the owner's other entries are not counted). */
export function countOurs(items) {
  return Array.isArray(items) ? items.filter((it) => it && untilOf(it.comment) !== null).length : 0;
}

/** True when `adding` more of our items still fit under our own limit. */
export function hasRoom(ourCount, adding = 1, max = MAX_TRAP_ITEMS) {
  return Number.isInteger(ourCount) && ourCount >= 0 && ourCount + adding <= max;
}

const CF_ID = /^[0-9a-f]{32}$/;
function listUrl(accountId, listId) {
  if (!CF_ID.test(String(accountId))) throw new Error('trap: the account id must be 32 letters or numbers (a to f, 0 to 9)');
  if (!CF_ID.test(String(listId))) throw new Error('trap: the list id must be 32 letters or numbers (a to f, 0 to 9)');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/rules/lists/${listId}/items`;
}

/** The text of the call that adds items (POST appends, it does not remove anything). The caller adds the Authorization header and sends the calls one after the other, never together. */
export function addRequest(accountId, listId, items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_PER_CALL) throw new Error(`trap: one call takes 1 to ${MAX_PER_CALL} items`);
  const body = items.map((it) => {
    const ip = normalizeIp(it && it.ip);
    if (!ip || isReservedIp(ip)) throw new Error('trap: an item has an address that must not be blocked');
    if (untilOf(it.comment) === null) throw new Error('trap: an item has no trap comment');
    return { ip, comment: it.comment };
  });
  return { method: 'POST', url: listUrl(accountId, listId), body: JSON.stringify(body) };
}

/** The text of the call that deletes items by id. */
export function deleteRequest(accountId, listId, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_PER_CALL) throw new Error(`trap: one call takes 1 to ${MAX_PER_CALL} ids`);
  if (!ids.every((id) => typeof id === 'string' && /^[0-9A-Za-z_-]{8,64}$/.test(id))) throw new Error('trap: an item id looks wrong');
  return { method: 'DELETE', url: listUrl(accountId, listId), body: JSON.stringify({ items: ids.map((id) => ({ id })) }) };
}

/** The text of the call that reads one page of the list (GET, up to 500 items). `cursor` is the value the last page gave, or nothing for the first page. */
export function listRequest(accountId, listId, cursor) {
  const base = listUrl(accountId, listId) + '?per_page=500';
  if (cursor === undefined || cursor === null || cursor === '') return { method: 'GET', url: base };
  if (typeof cursor !== 'string' || !/^[0-9A-Za-z_=+/.-]{1,200}$/.test(cursor)) throw new Error('trap: the page cursor looks wrong');
  return { method: 'GET', url: base + '&cursor=' + encodeURIComponent(cursor) };
}

/** One page of the list answer: { items: [{ id, ip, comment }], next } where next is the cursor of the next page or null. A broken answer gives no items and no next page. */
export function parseListPage(json) {
  const result = json && Array.isArray(json.result) ? json.result : [];
  const items = result
    .filter((it) => it && typeof it.id === 'string' && it.id)
    .map((it) => ({ id: it.id, ip: typeof it.ip === 'string' ? it.ip : null, comment: typeof it.comment === 'string' ? it.comment : '' }));
  const after = json && json.result_info && json.result_info.cursors && json.result_info.cursors.after;
  return { items, next: typeof after === 'string' && after ? after : null };
}
