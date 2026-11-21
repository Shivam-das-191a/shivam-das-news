// VAPID signing (RFC 8292) for the push Worker (v0.53.0, Phase 9 part 3; PLAN 31.9, 31.13).
// The Worker proves to a push service that it is the same sender every time: each request carries a short-lived
// signed token (ES256, a JWT) and the public key. WebCrypto only, no outside library, no clock of its own.
// Keys: VAPID_PRIVATE_KEY is a secret (32 bytes, URL-safe base64); VAPID_PUBLIC_KEY is public (65 bytes, the same form the
// browser needs as "applicationServerKey" and that config/push.json calls vapidPublicKey); VAPID_SUBJECT is a mailto: or https: address.
// Make a pair once with:  npm run vapid   (from the site folder). Nothing is written to a file.

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const B64URL = /^[A-Za-z0-9_-]+$/;

export const TOKEN_LIFETIME_SEC = 43200; // 12 hours; RFC 8292 allows at most 24
export const MAX_TOKEN_SEC = 86400;

export function b64uEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes URL-safe base64 (no padding). Returns null for anything that is not clean base64url. */
export function b64uDecode(text) {
  if (typeof text !== 'string' || !text || !B64URL.test(text) || text.length % 4 === 1) return null;
  try {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

/** Makes a new key pair. Returns { privateKey, publicKey } as URL-safe base64. Used by `npm run vapid` only. */
export async function generateVapidKeys() {
  const pair = await subtle().generateKey(ECDSA, true, ['sign', 'verify']);
  const jwk = await subtle().exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  return { privateKey: jwk.d, publicKey: b64uEncode(raw) };
}

/** A contact address for the push service: mailto: with one address, or an https: address. Nothing else. */
export function cleanSubject(value) {
  const v = String(value ?? '').trim();
  if (/^mailto:[^\s@<>,;:]+@[^\s@<>,;:]+\.[^\s@<>,;:]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' && !u.username && !u.password && /^https:\/\/[^\s]+$/.test(v)) return v;
  } catch {
    /* not an address */
  }
  return null;
}

/**
 * Loads the key pair of the Worker.
 * Returns { ok: true, vapid: { key, publicKey (URL-safe base64) } } or { ok: false, reason: 'missing' | 'bad_private' | 'bad_public' | 'key_mismatch' }.
 * It signs a test message and checks it against the public key, so a private key that does not belong to the public key is found here and not by a push service.
 */
export async function loadVapid(privateKey, publicKey) {
  if (!privateKey || !publicKey) return { ok: false, reason: 'missing' };
  const d = b64uDecode(privateKey);
  if (!d || d.length !== 32) return { ok: false, reason: 'bad_private' };
  const pub = b64uDecode(publicKey);
  if (!pub || pub.length !== 65 || pub[0] !== 0x04) return { ok: false, reason: 'bad_public' };
  try {
    const x = b64uEncode(pub.subarray(1, 33));
    const y = b64uEncode(pub.subarray(33, 65));
    const verifyKey = await subtle().importKey('raw', pub, ECDSA, false, ['verify']); // refuses a point that is not on the curve
    let key;
    try {
      key = await subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', d: b64uEncode(d), x, y, ext: true }, ECDSA, false, ['sign']);
    } catch {
      return { ok: false, reason: 'key_mismatch' }; // some runtimes refuse a private value that does not belong to the point
    }
    const probe = enc.encode('vapid key check');
    const sig = await subtle().sign(SIGN, key, probe);
    if (!(await subtle().verify(SIGN, verifyKey, sig, probe))) return { ok: false, reason: 'key_mismatch' };
    return { ok: true, vapid: { key, publicKey: b64uEncode(pub) } };
  } catch {
    return { ok: false, reason: 'bad_public' };
  }
}

/** The "aud" of the token: the scheme, host and port of the push service, nothing else (RFC 8292 section 2). */
export function audienceOf(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

const b64uJson = (obj) => b64uEncode(enc.encode(JSON.stringify(obj)));

/**
 * One signed token. Header and claims are written in the order of the RFC 8292 example: aud, exp, sub.
 * now is the time in ms (given by the caller). Returns the JWT text.
 */
export async function signToken(vapid, { aud, sub, now, lifetimeSec = TOKEN_LIFETIME_SEC }) {
  const exp = Math.floor(now / 1000) + Math.min(lifetimeSec, MAX_TOKEN_SEC);
  const head = b64uJson({ typ: 'JWT', alg: 'ES256' });
  const claims = b64uJson({ aud, exp, sub });
  const data = enc.encode(`${head}.${claims}`);
  const sig = new Uint8Array(await subtle().sign(SIGN, vapid.key, data)); // WebCrypto gives r and s side by side (64 bytes), the form a JWT wants
  return `${head}.${claims}.${b64uEncode(sig)}`;
}

/**
 * The Authorization header for one push request: "vapid t=<token>, k=<public key>" (RFC 8292 section 3).
 * Returns { ok: true, authorization } or { ok: false, reason: 'bad_endpoint' | 'bad_subject' | 'bad_time' }.
 */
export async function signedHeaders(endpoint, vapid, { subject, now } = {}) {
  const aud = audienceOf(endpoint);
  if (!aud) return { ok: false, reason: 'bad_endpoint' };
  const sub = cleanSubject(subject);
  if (!sub) return { ok: false, reason: 'bad_subject' };
  if (!Number.isFinite(now) || now <= 0) return { ok: false, reason: 'bad_time' };
  const token = await signToken(vapid, { aud, sub, now });
  return { ok: true, authorization: `vapid t=${token}, k=${vapid.publicKey}` };
}
