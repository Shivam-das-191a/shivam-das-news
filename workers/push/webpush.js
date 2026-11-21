// Web Push encryption and sending (v0.53.0, Phase 9 part 3; PLAN 31.9, 31.11; BUGS P13, P25).
// encryptPayload  RFC 8291 message encryption with the RFC 8188 "aes128gcm" content coding, one record, WebCrypto only.
// sendPush        encrypts one message, signs it (vapid.js) and posts it to the push service of one browser.
// No outside library, no database, no clock of its own (the caller gives "now"), no console call anywhere:
// the push endpoint address is a secret (BUGS P13), so it is never logged and never returned.
// The result of sendPush tells the sender (part 7) what to do next:
//   sent     the push service accepted it (201, or any other 2xx)
//   gone     404 or 410: the browser is not subscribed any more, delete the reader
//   retry    429, 5xx, a network error or a time out: try again later (retryAfter seconds when the service said so)
//   rejected 400, 401, 403, 413, a redirect or anything else: do not try this message again (auth is true for 401 and 403, a key problem of ours)
//   bad_sub  the stored browser keys cannot be used: delete the reader

import { signedHeaders, b64uEncode, b64uDecode } from './vapid.js';

export const RECORD_SIZE = 4096; // "rs" of the content coding header; one record only (RFC 8291 section 4)
export const HEADER_BYTES = 86; // salt 16 + rs 4 + idlen 1 + as_public 65
export const TAG_BYTES = 16;
export const DELIMITER_BYTES = 1;
/** Bytes added to the plain text by the encryption: header 86 + delimiter 1 + tag 16. */
export const ENCRYPT_OVERHEAD = HEADER_BYTES + DELIMITER_BYTES + TAG_BYTES;
/** Largest plain text that fits one record of a push service that accepts 4096 octets of body (RFC 8291 section 4: 3993). */
export const MAX_PLAIN_BYTES = RECORD_SIZE - ENCRYPT_OVERHEAD;
export const SEND_TIMEOUT_MS = 10000;
export const MAX_RETRY_AFTER_SEC = 3600;
export const MAX_TTL_SEC = 2419200; // 28 days, the longest a push service has to keep a message
export const URGENCIES = ['very-low', 'low', 'normal', 'high'];

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();

export { b64uEncode, b64uDecode };

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

// ---------------------------------------------------------------- keys

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

/** A 65 byte uncompressed P-256 point as a public CryptoKey. WebCrypto refuses a point that is not on the curve. */
async function importPublic(raw) {
  return subtle().importKey('raw', raw, ECDH, true, []);
}

/** The sender's private key from a JWK built out of the 32 byte private value and the 65 byte public point. */
async function importPrivate(priv, pub) {
  const jwk = { kty: 'EC', crv: 'P-256', d: b64uEncode(priv), x: b64uEncode(pub.subarray(1, 33)), y: b64uEncode(pub.subarray(33, 65)), ext: true };
  return subtle().importKey('jwk', jwk, ECDH, false, ['deriveBits']);
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/**
 * Encrypts one push message for one browser (RFC 8291, aes128gcm, one record, no extra padding).
 *   plain     the text (string) or bytes to send
 *   sub       { p256dh, auth }  the browser keys as stored, URL-safe base64
 *   opts      { salt?, asKey? }  only for tests: a fixed 16 byte salt and { private, public } (URL-safe base64) of the sender's one-time key
 * Returns { ok: true, body } (the whole request body: header, ciphertext and tag)
 *      or { ok: false, reason: 'bad_key' | 'too_big' | 'bad_options' }.
 * A new one-time key and a new salt are made for every message, so two messages never share a key.
 */
export async function encryptPayload(plain, sub, opts = {}) {
  const data = typeof plain === 'string' ? enc.encode(plain) : plain;
  if (!(data instanceof Uint8Array)) return { ok: false, reason: 'bad_options' };
  if (data.length > MAX_PLAIN_BYTES) return { ok: false, reason: 'too_big' };

  const uaPublic = b64uDecode(sub?.p256dh);
  const authSecret = b64uDecode(sub?.auth);
  if (!uaPublic || uaPublic.length !== 65 || uaPublic[0] !== 0x04 || !authSecret || authSecret.length !== 16) return { ok: false, reason: 'bad_key' };

  try {
    const uaKey = await importPublic(uaPublic);

    let asPublic;
    let asPrivateKey;
    if (opts.asKey) {
      const priv = b64uDecode(opts.asKey.private);
      const pub = b64uDecode(opts.asKey.public);
      if (!priv || priv.length !== 32 || !pub || pub.length !== 65 || pub[0] !== 0x04) return { ok: false, reason: 'bad_options' };
      asPublic = pub;
      asPrivateKey = await importPrivate(priv, pub);
    } else {
      const pair = await subtle().generateKey(ECDH, true, ['deriveBits']);
      asPublic = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
      asPrivateKey = pair.privateKey;
    }

    let salt;
    if (opts.salt !== undefined) {
      salt = b64uDecode(opts.salt);
      if (!salt || salt.length !== 16) return { ok: false, reason: 'bad_options' };
    } else {
      salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    }

    const ecdhSecret = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: uaKey }, asPrivateKey, 256));
    // RFC 8291 section 3.3: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
    const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
    const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
    // RFC 8188 section 2.2 and 2.3: the content encryption key (16) and the nonce (12) from the salt
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

    const key = await subtle().importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const record = concat(data, new Uint8Array([0x02])); // 0x02 = the last record (padding delimiter)
    const cipher = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, record));

    const rs = new Uint8Array([(RECORD_SIZE >>> 24) & 255, (RECORD_SIZE >>> 16) & 255, (RECORD_SIZE >>> 8) & 255, RECORD_SIZE & 255]);
    const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
    return { ok: true, body: concat(header, cipher) };
  } catch {
    // an invalid point (not on the curve) or a failed WebCrypto call: the stored keys cannot be used
    return { ok: false, reason: 'bad_key' };
  }
}

// ---------------------------------------------------------------- sending

const TOPIC = /^[A-Za-z0-9_-]{1,32}$/;

function retryAfterSec(res) {
  const v = res.headers?.get?.('retry-after');
  if (v && /^\d{1,7}$/.test(v.trim())) return Math.min(parseInt(v, 10), MAX_RETRY_AFTER_SEC);
  return null;
}

/**
 * Sends one message to one browser.
 *   sub      { endpoint, p256dh, auth }  as stored
 *   json     the notification text (the string from buildPayload in lib.js)
 *   opts     { vapid, subject, ttl, urgency, topic?, now, fetch?, timeoutMs?, asKey?, salt? }
 *            vapid is what loadVapid() gave (vapid.js); now is the time in ms; fetch can be replaced (tests, a fake push service)
 * Returns { ok, outcome, status? , reason?, retryAfter?, auth? }. Never contains the endpoint, the keys or the text.
 */
export async function sendPush(sub, json, opts = {}) {
  const fail = (outcome, reason, extra = {}) => ({ ok: false, outcome, reason, ...extra });

  let url;
  try {
    url = new URL(sub?.endpoint);
  } catch {
    return fail('bad_sub', 'bad_endpoint');
  }
  if (url.protocol !== 'https:') return fail('bad_sub', 'bad_endpoint');

  const ttl = opts.ttl;
  if (!Number.isInteger(ttl) || ttl < 0 || ttl > MAX_TTL_SEC) return fail('rejected', 'bad_ttl');
  const urgency = opts.urgency ?? 'normal';
  if (!URGENCIES.includes(urgency)) return fail('rejected', 'bad_urgency');
  if (!opts.vapid) return fail('rejected', 'no_vapid', { auth: true });

  const sealed = await encryptPayload(json, sub, { asKey: opts.asKey, salt: opts.salt });
  if (!sealed.ok) return sealed.reason === 'bad_key' ? fail('bad_sub', 'bad_key') : fail('rejected', sealed.reason);

  const signed = await signedHeaders(sub.endpoint, opts.vapid, { subject: opts.subject, now: opts.now });
  if (!signed.ok) return fail('rejected', signed.reason, { auth: true });

  const headers = {
    Authorization: signed.authorization,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl),
    Urgency: urgency,
  };
  if (opts.topic !== undefined && opts.topic !== null && TOPIC.test(String(opts.topic))) headers.Topic = String(opts.topic);

  const doFetch = opts.fetch || globalThis.fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? SEND_TIMEOUT_MS);
  let res;
  try {
    // redirect "manual": a push service never redirects, and the signed header must not follow a redirect to another host
    res = await doFetch(sub.endpoint, { method: 'POST', headers, body: sealed.body, redirect: 'manual', signal: ctl.signal });
  } catch (e) {
    return fail('retry', e && e.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }

  if (!res || typeof res.status !== 'number') return fail('retry', 'network'); // not an answer at all
  try {
    res.body?.cancel?.(); // the answer text is never read
  } catch {
    /* nothing to cancel */
  }

  const status = res.status;
  if (status >= 200 && status < 300) return { ok: true, outcome: 'sent', status };
  if (status === 404 || status === 410) return fail('gone', 'gone', { status });
  if (status === 429) return fail('retry', 'rate_limited', { status, retryAfter: retryAfterSec(res) });
  if (status >= 500 && status < 600) return fail('retry', 'server', { status, retryAfter: retryAfterSec(res) });
  if (status === 401 || status === 403) return fail('rejected', 'auth', { status, auth: true });
  if (status === 413) return fail('rejected', 'too_big', { status });
  if (status >= 300 && status < 400) return fail('rejected', 'redirect', { status });
  return fail('rejected', 'refused', { status });
}
