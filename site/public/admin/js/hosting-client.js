// Auto image hosting, the call to the images Worker (PLAN 34.8; Phase 3c Part 3c-3, v0.101.46).
// hostPost (hosting-run.js) asks for deps.fetchPictures(urls). This file makes that function: it sends POST <endpoint>/fetch with { "urls": [...] } and the
// GitHub token of the signed-in dashboard user as `Authorization: Bearer ...` (the Worker asks GitHub who the token belongs to; see workers/images/index.js).
//   makeFetchPictures({ endpoint, token, fetch?, timeoutMs? })  -> async (urls) => { ok: true, results } | { ok: false, reason, text }
//   imagesUrl(endpoint)                                          -> the exact address that is called, or throws a plain sentence
// Rules: https only; no cookies, no referrer, no cache; the token is never put into an answer, a sentence or an error; a bad token shape or a bad address is refused
// BEFORE any request; every way of failing becomes a reason word of hosting-run.js with a plain sentence (sign_in, not_allowed, rate_limited, worker_off, call_too_big,
// worker_failed), so the result list can say what happened and offer Retry. It writes nothing and nothing calls it yet, so the live site and the dashboard do not change.
export const MAX_URLS = 30; // equal to WORKER_BATCH of hosting-run.js and MAX_PER_CALL of workers/images/lib.js (a test keeps them equal)
const TOKEN = /^[A-Za-z0-9_-]{10,255}$/; // the shape the Worker accepts

/** The address of POST /fetch for a Worker address such as https://news-images.name.workers.dev (a trailing slash or a trailing /fetch is fine). Throws a plain sentence. */
export function imagesUrl(endpoint) {
  let u;
  try { u = new URL(String(endpoint ?? '').trim()); } catch { throw new Error('The address of the picture service is not valid.'); }
  if (u.protocol !== 'https:') throw new Error('The picture service must use https.');
  if (u.username || u.password || u.search || u.hash) throw new Error('The address of the picture service is not valid.');
  const path = u.pathname.replace(/\/+$/, '');
  if (path !== '' && path !== '/fetch') throw new Error('The address of the picture service is not valid.');
  return `${u.origin}/fetch`;
}

const no = (reason, text) => ({ ok: false, reason, text });

const SENTENCES = {
  sign_in: 'Sign in to the dashboard again, then press Retry.',
  not_allowed: 'This account may not use the picture service.',
  worker_off: 'The picture service is switched off or not ready. Try again later.',
  call_too_big: 'Too many large pictures at once. Press Retry.',
  worker_failed: 'The picture service did not answer. Press Retry.',
};

/** Retry-After in whole seconds (1 to 600), or 0 when it is missing or not a number. */
const waitOf = (res) => {
  const n = Number(res.headers && res.headers.get ? res.headers.get('Retry-After') : NaN);
  return Number.isFinite(n) && n >= 1 ? Math.min(600, Math.ceil(n)) : 0;
};

/** The function for hostPost: `hostPost(post, { fetchPictures: makeFetchPictures({ endpoint, token }), ... })`. */
export function makeFetchPictures(o = {}) {
  return async function fetchPictures(urls) {
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS || urls.some((u) => typeof u !== 'string' || u === '')) return no('worker_failed', SENTENCES.worker_failed);
    let url;
    try { url = imagesUrl(o.endpoint); } catch { return no('worker_off', SENTENCES.worker_off); }
    if (typeof o.token !== 'string' || !TOKEN.test(o.token)) return no('sign_in', SENTENCES.sign_in);
    const f = o.fetch || globalThis.fetch;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), Number.isFinite(o.timeoutMs) && o.timeoutMs > 0 ? o.timeoutMs : 120000) : null;
    try {
      const res = await f(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', ...(ctl ? { signal: ctl.signal } : {}),
      });
      if (res.status === 200) {
        let body;
        try { body = await res.json(); } catch { return no('worker_failed', SENTENCES.worker_failed); }
        if (!body || !Array.isArray(body.results)) return no('worker_failed', SENTENCES.worker_failed);
        return { ok: true, results: body.results };
      }
      if (res.status === 401) return no('sign_in', SENTENCES.sign_in);
      if (res.status === 403) return no('not_allowed', SENTENCES.not_allowed);
      if (res.status === 413) return no('call_too_big', SENTENCES.call_too_big);
      if (res.status === 503) return no('worker_off', SENTENCES.worker_off);
      if (res.status === 429) {
        const s = waitOf(res);
        return no('rate_limited', s ? `Too many pictures in one minute. Wait ${s} ${s === 1 ? 'second' : 'seconds'}, then press Retry.` : 'Too many pictures in one minute. Wait a moment, then press Retry.');
      }
      return no('worker_failed', SENTENCES.worker_failed);
    } catch {
      return no('worker_failed', SENTENCES.worker_failed); // no network, a timeout, or a blocked call: never the text of the error, it could hold the address
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
