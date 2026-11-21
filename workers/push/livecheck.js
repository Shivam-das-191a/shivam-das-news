// Live check (v0.65.0, Phase 9 part 6b; PLAN 31.5 first rule, LOGICS 19 step 1, BUGS P3).
// Before a post is recorded for push, the Worker opens its address and asks: is this page really live and open to search?
// Live = status 200, an HTML page, and no "noindex" (or "none") in the X-Robots-Tag header or in a robots meta tag of the head.
// "When unsure, do not send" (PLAN 31.10): a timeout, a network error or an unreadable page is a failed check, never a pass.
// The address is already known to be https and on this site (checkPost in announce.js). Redirects are NOT followed:
// a 301 means the address is not the live one (for example the slug changed), so the post is not live at this address.
// It reads no clock and prints nothing. The only network call goes through the `doFetch` function the caller gives (the Worker gives the real one, tests give a fake).

export const LIVE_TIMEOUT_MS = 5000; // one page, from the start of the request to the end of the head
export const LIVE_MAX_BYTES = 200000; // a robots tag is in the head; the rest of a long page is never read
export const LIVE_CONCURRENCY = 5; // pages opened at the same time (one call has 25 posts at most)
export const LIVE_AGENT = 'ShivamDasNewsPushCheck/1.0'; // a plain name so the owner can find the visit in the logs

/** Every reason this part adds to the answer (announce.js lists them in REASONS). */
export const LIVE_REASONS = ['not_live', 'noindex', 'check_failed'];

const BLOCKING = new Set(['noindex', 'none']);

/**
 * True when one robots value blocks search (a header value or a meta content).
 * "noindex" and "none" block. A directive for another robot ("bingbot: noindex") is not about Google and does not block here;
 * "googlebot: noindex" and a plain "noindex" do. Case does not matter. "unavailable_after" and the like are not blocks.
 */
export function robotsBlocks(value) {
  if (typeof value !== 'string' || !value) return false;
  for (const part of value.split(',')) {
    const m = /^\s*(?:([a-z0-9-]+)\s*:\s*)?([a-z_-]+)\s*$/i.exec(part);
    if (!m) continue;
    const bot = m[1] ? m[1].toLowerCase() : '';
    if (bot && bot !== 'googlebot') continue;
    if (BLOCKING.has(m[2].toLowerCase())) return true;
  }
  return false;
}

/** The part of the page before </head> (or all of it when there is no end of head). */
const headOf = (html) => {
  const at = html.search(/<\/head\s*>/i);
  return at >= 0 ? html.slice(0, at) : html;
};

const ATTR = /([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/** The content values of every <meta name="robots"> and <meta name="googlebot"> in the head. */
export function metaRobots(html) {
  const out = [];
  if (typeof html !== 'string') return out;
  for (const tag of headOf(html).match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(ATTR)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    const name = (attrs.name || '').toLowerCase();
    if ((name === 'robots' || name === 'googlebot') && typeof attrs.content === 'string') out.push(attrs.content);
  }
  return out;
}

/**
 * The decision on one answer. `page` = { status, location, contentType, xRobots, html }.
 * Returns { ok: true } or { ok: false, reason } with a reason from LIVE_REASONS.
 * Order: status first (a 404, a 410, a 301 or a 500 is not live), then the kind of page, then robots (header, then meta).
 */
export function judge(page) {
  if (!page || page.status !== 200) return { ok: false, reason: 'not_live' };
  if (!/^\s*(?:text\/html|application\/xhtml\+xml)\b/i.test(page.contentType || '')) return { ok: false, reason: 'not_live' };
  if (robotsBlocks(page.xRobots)) return { ok: false, reason: 'noindex' };
  if (metaRobots(page.html).some(robotsBlocks)) return { ok: false, reason: 'noindex' };
  return { ok: true };
}

/** Reads at most `max` bytes of the body as text and stops the download. Returns '' when there is no body. */
async function readLimited(res, max) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    return text.length > max ? text.slice(0, max) : text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (bytes >= max || /<\/head\s*>/i.test(text)) break; // the head is all that is needed
    }
  } finally {
    // Stopping the download is not awaited: a stream that is slow to stop must never hold the check (the timeout does not cover this step).
    Promise.resolve(reader.cancel()).catch(() => {});
  }
  return text;
}

/**
 * Opens one address and returns { ok: true } or { ok: false, reason }.
 * `opts.timeoutMs` is for tests. Any error (network, timeout, a body that cannot be read) is { ok: false, reason: 'check_failed' }.
 */
export async function liveCheck(url, doFetch, opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : LIVE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': LIVE_AGENT, Accept: 'text/html' },
      signal: controller.signal,
      cf: { cacheTtl: 0 },
    });
    const head = {
      status: res.status,
      contentType: res.headers.get('Content-Type') || '',
      xRobots: res.headers.get('X-Robots-Tag') || '',
    };
    // No need to read a page that is already known to be not live or blocked by its header.
    const early = judge({ ...head, html: '' });
    if (!early.ok) {
      try {
        if (res.body && typeof res.body.cancel === 'function') Promise.resolve(res.body.cancel()).catch(() => {}); // not awaited, same reason as in readLimited
      } catch {
        /* nothing left to stop */
      }
      return early;
    }
    const html = await readLimited(res, LIVE_MAX_BYTES);
    return judge({ ...head, html });
  } catch {
    return { ok: false, reason: 'check_failed' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks many posts, a few at a time. Takes the clean posts of announce.js; returns a Map from key to { ok, reason? }.
 * One post failing never stops the others.
 */
export async function liveCheckAll(posts, doFetch, opts = {}) {
  const out = new Map();
  const queue = posts.slice();
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) out.set(p.key, await liveCheck(p.url, doFetch, opts));
  };
  const n = Math.min(LIVE_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}
