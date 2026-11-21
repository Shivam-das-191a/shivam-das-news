// Auto image hosting, the fetch rules of the Worker (PLAN 34.3 steps 2 to 4 and 34.8, LOGICS 22; Phase 3c Part 2a, v0.101.40).
// `fetch`, the clock and the host name lookup are passed in, so tests use fake sites. Nothing here reads a secret, a request or a header of the caller;
// there is no Worker entry (index.js), no route, no wrangler file and no sign-in yet (that is Part 2b), so nothing can call this code.
// One source of truth: the address rules are the ones of the dashboard (site/public/admin/js/hotlink.js) and the byte check is the one of the Files screen
// (site/public/admin/js/media-meta.js). Both are plain modules without a browser object, so wrangler can bundle them.
// Honest limits: a Worker cannot pin the address that fetch connects to, so the host name lookup (DNS over HTTPS) is a best-effort check and a rebinding
// race is not excluded here; the Cloudflare network does not connect a Worker to private addresses either. Nothing is stored and no address is logged.
import { checkAddress, checkRedirects } from '../../site/public/admin/js/hotlink.js';
import { pictureKind } from '../../site/public/admin/js/media-meta.js';

/** PLAN 34.3 step 3. */
export const MAX_BYTES = 10 * 1024 * 1024;
export const IDLE_MS = 5000;
export const TOTAL_MS = 15000;
export const MAX_PER_CALL = 30;
export const CONCURRENCY = 4;
/** The bytes of all pictures of one call together (a Worker has 128 MB of memory, and the answer carries the bytes as base64). */
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
/** What a hosted picture may be (PLAN 34.3 step 4). SVG is refused by default. */
export const KINDS = ['jpg', 'png', 'webp', 'avif', 'gif'];
export const DOH_URL = 'https://cloudflare-dns.com/dns-query';

const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });

/**
 * Looks a host name up with DNS over HTTPS (A and AAAA). Returns the list of addresses (may be empty). Throws when the lookup itself fails.
 * `f` is a fetch function. Only answers of type A (1) and AAAA (28) count; a CNAME is followed by the resolver.
 */
export async function resolveViaDoh(host, f = globalThis.fetch, url = DOH_URL) {
  const out = [];
  for (const type of ['A', 'AAAA']) {
    const res = await f(`${url}?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    if (!res.ok) throw new Error(`dns ${res.status}`);
    const body = await res.json();
    for (const a of Array.isArray(body && body.Answer) ? body.Answer : []) if ((a.type === 1 || a.type === 28) && typeof a.data === 'string') out.push(a.data);
  }
  return out;
}

/** True when every address is a public one (the same rule as checkAddress). An empty list is not public: a name that does not resolve is not fetched. */
export function allPublic(ips) {
  return Array.isArray(ips) && ips.length > 0 && ips.every((ip) => checkAddress(`https://${String(ip).includes(':') ? `[${ip}]` : ip}/`).ok);
}

/** Reads a body with a size cap and an idle time. Returns { bytes } or { reason: 'too_big' | 'timeout' | 'network' }. */
async function readBody(res, o) {
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > o.maxBytes) return { reason: 'too_big' };
  if (!res.body) return { bytes: new Uint8Array(0) };
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  const give = (reason) => { reader.cancel().catch(() => {}); return { reason }; };
  for (;;) {
    let idleTimer;
    const idle = new Promise((r) => { idleTimer = setTimeout(() => r('idle'), o.idleMs); });
    let step;
    try { step = await Promise.race([reader.read(), idle, o.deadline]); } catch { clearTimeout(idleTimer); return { reason: 'network' }; }
    clearTimeout(idleTimer);
    if (step === 'idle' || step === 'total') return give('timeout');
    if (step.done) break;
    size += step.value.byteLength;
    if (size > o.maxBytes) return give('too_big');
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
  return { bytes };
}

/**
 * Downloads one picture (PLAN 34.3 steps 2 to 4). o: { fetch, resolveHost(host) -> [ip], referrer, blockHosts, maxBytes, idleMs, totalMs }.
 * Every address, the first and each redirect, passes checkAddress; at most 3 redirects (checkRedirects); when `resolveHost` is given, a host name whose
 * answer holds one non-public address is refused. A 403 is tried once more without the referrer; the code never fakes one (only `o.referrer`, our own origin, is sent first).
 * Returns { ok: true, url, finalUrl, hops, bytes: Uint8Array, kind } or { ok: false, reason, ... }.
 * reason: bad_url | not_https | bad_port | credentials | private_host | blocked_host | too_many_redirects | dns_failed | not_found | http_error | too_big | timeout | network | not_image | svg_refused (fetchPictures adds call_too_big).
 */
export async function fetchPicture(url, o = {}) {
  const f = o.fetch || globalThis.fetch;
  const maxBytes = o.maxBytes ?? MAX_BYTES;
  const idleMs = o.idleMs ?? IDLE_MS;
  const totalMs = o.totalMs ?? TOTAL_MS;
  let totalTimer;
  const deadline = new Promise((r) => { totalTimer = setTimeout(() => r('total'), totalMs); });
  const chain = [url];
  let useReferrer = Boolean(o.referrer);
  let retried = false;
  try {
    for (;;) {
      const current = chain[chain.length - 1];
      const chk = checkRedirects(chain, { blockHosts: o.blockHosts });
      if (!chk.ok) return fail(chk.reason, { text: chk.text, at: chk.at });
      const host = checkAddress(current).host;
      if (o.resolveHost && !/^[\d.]+$/.test(host) && !host.startsWith('[')) {
        let ips;
        try { ips = await Promise.race([o.resolveHost(host), deadline.then(() => { throw new Error('total'); })]); } catch (e) { return fail(e && e.message === 'total' ? 'timeout' : 'dns_failed'); }
        if (!allPublic(ips)) return fail(ips && ips.length ? 'private_host' : 'dns_failed');
      }
      const headers = { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9' };
      if (useReferrer) headers.referer = o.referrer;
      let res;
      try { res = await Promise.race([f(current, { method: 'GET', redirect: 'manual', headers }), deadline.then(() => 'total')]); } catch { return fail('network'); }
      if (res === 'total') return fail('timeout');
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location');
        if (!loc) return fail('http_error', { status: res.status });
        try { chain.push(new URL(loc, current).href); } catch { return fail('bad_url'); }
        continue;
      }
      if (res.status === 403 && useReferrer && !retried) { retried = true; useReferrer = false; continue; }
      if (res.status === 404 || res.status === 410) return fail('not_found', { status: res.status });
      if (res.status < 200 || res.status > 299) return fail('http_error', { status: res.status });
      const body = await readBody(res, { maxBytes, idleMs, deadline });
      if (body.reason) return fail(body.reason);
      const kind = pictureKind(body.bytes);
      if (kind === 'svg') return fail('svg_refused');
      if (!KINDS.includes(kind)) return fail('not_image');
      return { ok: true, url, finalUrl: current, hops: chain.length - 1, bytes: body.bytes, kind };
    }
  } finally {
    clearTimeout(totalTimer);
  }
}

/** Bytes to base64 text, in pieces so a large picture does not overflow the call stack. */
export function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/**
 * Downloads a list (PLAN 34.8): at most MAX_PER_CALL addresses, CONCURRENCY at a time. A repeated address is fetched once and answered for each place.
 * Returns { ok: true, results: [{ url, ...fetchPicture result }] } in the order of the list, or { ok: false, reason: 'too_many' | 'empty' | 'bad_list' }.
 * A failure of one picture never stops the others. o.maxTotalBytes (default MAX_TOTAL_BYTES): when the pictures of the call together would be larger,
 * the one that does not fit answers `call_too_big` and its bytes are dropped at once (ask for it again in the next call).
 */
export async function fetchPictures(urls, o = {}) {
  if (!Array.isArray(urls) || urls.some((u) => typeof u !== 'string')) return { ok: false, reason: 'bad_list' };
  if (urls.length === 0) return { ok: false, reason: 'empty' };
  if (urls.length > MAX_PER_CALL) return { ok: false, reason: 'too_many' };
  const unique = [...new Set(urls)];
  const done = new Map();
  const cap = o.maxTotalBytes ?? MAX_TOTAL_BYTES;
  let total = 0;
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const u = unique[next++];
      let r;
      try { r = await fetchPicture(u, o); } catch { r = fail('network'); }
      if (r.ok) {
        if (total + r.bytes.length > cap) r = fail('call_too_big');
        else total += r.bytes.length;
      }
      done.set(u, r);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency ?? CONCURRENCY, unique.length) }, worker));
  return { ok: true, results: urls.map((u) => ({ url: u, ...done.get(u) })) };
}
