import { describe, it, expect, vi } from 'vitest';
import { createECDH, createPublicKey, createDecipheriv, hkdfSync, verify, randomBytes } from 'node:crypto';
// @ts-ignore plain JS Worker code
import * as W from '../../../workers/push/webpush.js';
// @ts-ignore plain JS Worker code
import * as V from '../../../workers/push/vapid.js';
// @ts-ignore plain JS Worker code
import { buildPayload, PAYLOAD_MAX_BYTES, ENCRYPT_OVERHEAD, TTL_SEC, URGENCY } from '../../../workers/push/lib.js';

// RFC 8291 section 5 and appendix A (the sender private key is the one printed in the RFC)
const RFC = {
  plain: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const b64 = (u: Uint8Array | Buffer) => Buffer.from(u).toString('base64url');
const raw = (s: string) => Buffer.from(s, 'base64url');

/** A browser, made with Node's own crypto, so the test does not use the code it checks. */
function browser(n = 1) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const authSecret = randomBytes(16);
  return {
    ecdh,
    authSecret,
    sub: { endpoint: `https://push.example.test/send/secret-endpoint-${n}`, p256dh: b64(ecdh.getPublicKey()), auth: b64(authSecret) },
  };
}

/** Opens a push message the way a browser does (RFC 8291 and RFC 8188), with Node's crypto only. */
function open(body: Uint8Array, ecdh: ReturnType<typeof createECDH>, authSecret: Buffer | Uint8Array) {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16);
  const rs = buf.readUInt32BE(16);
  const idlen = buf[20];
  const asPublic = buf.subarray(21, 21 + idlen);
  const cipher = buf.subarray(21 + idlen);
  const uaPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  expect(plain[plain.length - 1]).toBe(0x02);
  return { rs, idlen, text: plain.subarray(0, plain.length - 1).toString('utf8') };
}

/** Checks a VAPID token with Node's crypto and the public key only. */
function checkToken(token: string, publicKey: string) {
  const [h, c, s] = token.split('.');
  const pub = raw(publicKey);
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)) }, format: 'jwk' });
  const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, raw(s));
  return { ok, header: JSON.parse(raw(h).toString()), claims: JSON.parse(raw(c).toString()), sigBytes: raw(s).length };
}

const NOW = Date.UTC(2026, 10, 15, 10, 0, 0);
const SUBJECT = 'mailto:owner@news.test';
async function vapid() {
  const keys = await V.generateVapidKeys();
  const loaded = await V.loadVapid(keys.privateKey, keys.publicKey);
  expect(loaded.ok).toBe(true);
  return { keys, v: loaded.vapid };
}

describe('base64url helpers', () => {
  it('round trip and refuse bad text', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(W.b64uDecode(W.b64uEncode(bytes)))).toEqual(Array.from(bytes));
    for (const bad of ['', 'a', 'ab+c', 'ab/c', 'ab=c', 'a b c', null, undefined, 5, 'abcde']) expect(W.b64uDecode(bad as any)).toBeNull();
    expect(W.b64uEncode(new Uint8Array([]))).toBe('');
  });
});

describe('RFC 8291 encryption', () => {
  it('gives exactly the message of the RFC example (section 5 and appendix A)', async () => {
    const r = await W.encryptPayload(RFC.plain, { p256dh: RFC.uaPublic, auth: RFC.auth }, { salt: RFC.salt, asKey: { private: RFC.asPrivate, public: RFC.asPublic } });
    expect(r.ok).toBe(true);
    expect(W.b64uEncode(r.body)).toBe(RFC.body);
    expect(r.body.length).toBe(86 + RFC.plain.length + 1 + 16);
  });

  it('the RFC message opens with the receiver key of the RFC, with Node crypto only', () => {
    const ua = createECDH('prime256v1');
    ua.setPrivateKey(raw(RFC.uaPrivate));
    expect(b64(ua.getPublicKey())).toBe(RFC.uaPublic);
    const o = open(raw(RFC.body), ua, raw(RFC.auth));
    expect(o.text).toBe(RFC.plain);
    expect(o.rs).toBe(4096);
    expect(o.idlen).toBe(65);
  });

  it('a normal message opens with the browser key (random one-time key and salt)', async () => {
    const b = browser();
    const text = JSON.stringify({ v: 1, title: 'A headline with an accent: caf\u00e9', body: 'Body', url: 'https://news.test/x?pn=1' });
    const r = await W.encryptPayload(text, b.sub);
    expect(r.ok).toBe(true);
    expect(open(r.body, b.ecdh, b.authSecret).text).toBe(text);
  });

  it('two messages never share a salt or a one-time key', async () => {
    const b = browser();
    const a = await W.encryptPayload('same', b.sub);
    const c = await W.encryptPayload('same', b.sub);
    expect(Buffer.from(a.body.subarray(0, 16)).equals(Buffer.from(c.body.subarray(0, 16)))).toBe(false);
    expect(Buffer.from(a.body.subarray(21, 86)).equals(Buffer.from(c.body.subarray(21, 86)))).toBe(false);
    expect(Buffer.from(a.body).equals(Buffer.from(c.body))).toBe(false);
  });

  it('a different auth secret cannot open the message', async () => {
    const b = browser();
    const r = await W.encryptPayload('secret text', b.sub);
    expect(() => open(r.body, b.ecdh, randomBytes(16))).toThrow();
  });

  it('accepts bytes as well as a string; the empty text is allowed', async () => {
    const b = browser();
    const r = await W.encryptPayload(new TextEncoder().encode('bytes'), b.sub);
    expect(open(r.body, b.ecdh, b.authSecret).text).toBe('bytes');
    const e = await W.encryptPayload('', b.sub);
    expect(e.ok).toBe(true);
    expect(e.body.length).toBe(W.ENCRYPT_OVERHEAD);
    expect(open(e.body, b.ecdh, b.authSecret).text).toBe('');
  });

  it('size: 3993 bytes fit one record of 4096, 3994 are refused', async () => {
    const b = browser();
    expect(W.MAX_PLAIN_BYTES).toBe(3993);
    expect(W.ENCRYPT_OVERHEAD).toBe(103);
    const ok = await W.encryptPayload('x'.repeat(3993), b.sub);
    expect(ok.ok).toBe(true);
    expect(ok.body.length).toBe(4096);
    expect(open(ok.body, b.ecdh, b.authSecret).text.length).toBe(3993);
    expect(await W.encryptPayload('x'.repeat(3994), b.sub)).toEqual({ ok: false, reason: 'too_big' });
    // the limit counts bytes, not characters
    expect(await W.encryptPayload('\u00e9'.repeat(2000), b.sub)).toEqual({ ok: false, reason: 'too_big' });
  });

  it('refuses keys that cannot be used', async () => {
    const good = browser().sub;
    const bad = async (sub: any) => expect(await W.encryptPayload('x', sub)).toEqual({ ok: false, reason: 'bad_key' });
    await bad({ p256dh: good.p256dh, auth: b64(randomBytes(15)) }); // auth not 16 bytes
    await bad({ p256dh: good.p256dh, auth: b64(randomBytes(17)) });
    await bad({ p256dh: b64(randomBytes(64)), auth: good.auth }); // key not 65 bytes
    await bad({ p256dh: b64(Buffer.concat([Buffer.from([2]), randomBytes(64)])), auth: good.auth }); // compressed form marker
    await bad({ p256dh: b64(Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)])), auth: good.auth }); // 65 bytes, not a point on the curve
    await bad({ p256dh: 'not base64 !!', auth: good.auth });
    await bad({ auth: good.auth });
    await bad(null);
    await bad({});
  });

  it('refuses bad test options instead of ignoring them', async () => {
    const b = browser();
    expect((await W.encryptPayload('x', b.sub, { salt: 'short' })).reason).toBe('bad_options');
    expect((await W.encryptPayload('x', b.sub, { asKey: { private: 'abc', public: 'abc' } })).reason).toBe('bad_options');
    expect((await W.encryptPayload(5 as any, b.sub)).reason).toBe('bad_options');
  });
});

describe('payload size rule of lib.js (BUGS P25)', () => {
  const post = (extra = {}) => ({ title: 'A headline', description: 'A description', url: 'https://news.test/2026/11/15/blogs/world/a/', ...extra });

  it('the constant in lib.js is the same as in webpush.js', () => {
    expect(ENCRYPT_OVERHEAD).toBe(W.ENCRYPT_OVERHEAD);
    expect(PAYLOAD_MAX_BYTES).toBe(4000);
  });

  it('a payload that passes always encrypts to less than 4000 bytes and fits the 4096 record', async () => {
    const b = browser();
    const r = buildPayload(post({ breaking: true }));
    expect(r.ok).toBe(true);
    const e = await W.encryptPayload(r.json, b.sub);
    expect(e.ok).toBe(true);
    expect(e.body.length).toBe(r.bytes + ENCRYPT_OVERHEAD);
    expect(e.body.length).toBeLessThan(PAYLOAD_MAX_BYTES);
  });

  it('a thread key that makes the JSON too long is cut by the rule, and the result still fits', async () => {
    // 3880 bytes of tag + the fixed text is over 4000 once the 103 bytes of encryption are counted
    const r = buildPayload(post(), { thread: 'q'.repeat(3850) });
    if (r.ok) expect(r.bytes + ENCRYPT_OVERHEAD).toBeLessThan(PAYLOAD_MAX_BYTES);
    else expect(r.reason).toBe('too_big');
    const edge = buildPayload(post(), { thread: 'q'.repeat(3700) });
    if (edge.ok) {
      const e = await W.encryptPayload(edge.json, browser().sub);
      expect(e.ok).toBe(true);
      expect(e.body.length).toBeLessThan(PAYLOAD_MAX_BYTES);
    }
  });
});

describe('VAPID keys', () => {
  it('a new pair is 32 and 65 bytes and loads', async () => {
    const k = await V.generateVapidKeys();
    expect(raw(k.privateKey).length).toBe(32);
    expect(raw(k.publicKey).length).toBe(65);
    expect(raw(k.publicKey)[0]).toBe(4);
    const l = await V.loadVapid(k.privateKey, k.publicKey);
    expect(l.ok).toBe(true);
    expect(l.vapid.publicKey).toBe(k.publicKey);
  });

  it('two new pairs are different', async () => {
    const a = await V.generateVapidKeys();
    const b = await V.generateVapidKeys();
    expect(a.privateKey).not.toBe(b.privateKey);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  it('finds a private key that does not belong to the public key', async () => {
    const a = await V.generateVapidKeys();
    const b = await V.generateVapidKeys();
    expect(await V.loadVapid(a.privateKey, b.publicKey)).toEqual({ ok: false, reason: 'key_mismatch' });
  });

  it('refuses missing and malformed keys with a reason', async () => {
    const k = await V.generateVapidKeys();
    expect(await V.loadVapid('', k.publicKey)).toEqual({ ok: false, reason: 'missing' });
    expect(await V.loadVapid(k.privateKey, undefined as any)).toEqual({ ok: false, reason: 'missing' });
    expect((await V.loadVapid('abc', k.publicKey)).reason).toBe('bad_private');
    expect((await V.loadVapid(b64(randomBytes(33)), k.publicKey)).reason).toBe('bad_private');
    expect((await V.loadVapid(k.privateKey, 'abc')).reason).toBe('bad_public');
    expect((await V.loadVapid(k.privateKey, b64(Buffer.concat([Buffer.from([2]), randomBytes(64)])))).reason).toBe('bad_public');
    expect((await V.loadVapid(k.privateKey, b64(Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)])))).reason).toBe('bad_public'); // not on the curve
  });

  it('the subject is a mailto address or an https address, nothing else', () => {
    expect(V.cleanSubject('mailto:owner@news.test')).toBe('mailto:owner@news.test');
    expect(V.cleanSubject('  mailto:owner@news.test  ')).toBe('mailto:owner@news.test');
    expect(V.cleanSubject('https://news.test/contact/')).toBe('https://news.test/contact/');
    for (const bad of ['', null, undefined, 'owner@news.test', 'mailto:', 'mailto:a b@news.test', 'mailto:a@b', 'http://news.test', 'https://user:pw@news.test/', 'javascript:alert(1)', 'mailto:a@b.test,c@d.test', 'mailto:a@b.test\r\nX: y']) expect(V.cleanSubject(bad as any)).toBeNull();
  });

  it('the audience is the origin of the push service only', () => {
    expect(V.audienceOf('https://fcm.googleapis.com/fcm/send/abc')).toBe('https://fcm.googleapis.com');
    expect(V.audienceOf('https://updates.push.services.mozilla.com:443/wpush/v2/abc')).toBe('https://updates.push.services.mozilla.com');
    expect(V.audienceOf('https://push.example.test:8443/x?y=1#z')).toBe('https://push.example.test:8443');
    expect(V.audienceOf('http://push.example.test/x')).toBeNull();
    expect(V.audienceOf('not an address')).toBeNull();
    expect(V.audienceOf(undefined as any)).toBeNull();
  });
});

describe('VAPID token (RFC 8292)', () => {
  it('header and claims have the form of the RFC example, the signature is valid and 64 bytes', async () => {
    const { keys, v } = await vapid();
    const s = await V.signedHeaders('https://push.example.test/send/abc', v, { subject: SUBJECT, now: NOW });
    expect(s.ok).toBe(true);
    const m = /^vapid t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+), k=([A-Za-z0-9_-]+)$/.exec(s.authorization);
    expect(m).not.toBeNull();
    expect(m![2]).toBe(keys.publicKey);
    const t = checkToken(m![1], keys.publicKey);
    expect(t.ok).toBe(true);
    expect(t.sigBytes).toBe(64);
    expect(t.header).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(Object.keys(t.claims)).toEqual(['aud', 'exp', 'sub']);
    expect(t.claims.aud).toBe('https://push.example.test');
    expect(t.claims.sub).toBe(SUBJECT);
    expect(t.claims.exp).toBe(Math.floor(NOW / 1000) + V.TOKEN_LIFETIME_SEC);
  });

  it('the token lasts 12 hours, never more than 24', async () => {
    const { v } = await vapid();
    expect(V.TOKEN_LIFETIME_SEC).toBe(43200);
    expect(V.MAX_TOKEN_SEC).toBe(86400);
    const t = await V.signToken(v, { aud: 'https://p.test', sub: SUBJECT, now: NOW, lifetimeSec: 10 * 86400 });
    expect(JSON.parse(raw(t.split('.')[1]).toString()).exp).toBe(Math.floor(NOW / 1000) + 86400);
  });

  it('a signature made with another key does not verify', async () => {
    const { keys, v } = await vapid();
    const other = await V.generateVapidKeys();
    const s = await V.signedHeaders('https://p.test/x', v, { subject: SUBJECT, now: NOW });
    const token = /t=([^,]+),/.exec(s.authorization)![1];
    expect(checkToken(token, keys.publicKey).ok).toBe(true);
    expect(checkToken(token, other.publicKey).ok).toBe(false);
  });

  it('the private key is never in a header', async () => {
    const { keys, v } = await vapid();
    const s = await V.signedHeaders('https://p.test/x', v, { subject: SUBJECT, now: NOW });
    expect(s.authorization).not.toContain(keys.privateKey);
  });

  it('refuses a bad endpoint, subject or time with a reason', async () => {
    const { v } = await vapid();
    expect(await V.signedHeaders('http://p.test/x', v, { subject: SUBJECT, now: NOW })).toEqual({ ok: false, reason: 'bad_endpoint' });
    expect(await V.signedHeaders('https://p.test/x', v, { subject: 'nobody', now: NOW })).toEqual({ ok: false, reason: 'bad_subject' });
    expect(await V.signedHeaders('https://p.test/x', v, { subject: SUBJECT })).toEqual({ ok: false, reason: 'bad_time' });
    expect(await V.signedHeaders('https://p.test/x', v, { subject: SUBJECT, now: NaN })).toEqual({ ok: false, reason: 'bad_time' });
    expect(await V.signedHeaders('https://p.test/x', v, { subject: SUBJECT, now: 0 })).toEqual({ ok: false, reason: 'bad_time' });
  });
});

/** A fake push service: it checks the signature and opens the message like a real browser would, then answers with the status given. */
function pushService(b: ReturnType<typeof browser>, publicKey: string, answer: { status?: number; headers?: Record<string, string> } = {}) {
  const seen: any = { calls: 0 };
  const fetchFn = vi.fn(async (url: string, init: any) => {
    seen.calls++;
    seen.url = url;
    seen.init = init;
    const auth = String(init.headers.Authorization);
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth)!;
    seen.token = checkToken(m[1], m[2]);
    seen.keyHeader = m[2];
    seen.plain = open(init.body, b.ecdh, b.authSecret).text;
    return new Response(null, { status: answer.status ?? 201, headers: answer.headers });
  });
  return { fetchFn, seen };
}

describe('sendPush with a fake push service', () => {
  const json = JSON.stringify({ v: 1, title: 'Headline', body: 'Body', url: 'https://news.test/a/?pn=1' });

  it('201: signed, encrypted, with the right headers; the browser can open it', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const { fetchFn, seen } = pushService(b, keys.publicKey);
    const r = await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: TTL_SEC.normal, urgency: URGENCY.normal, now: NOW, fetch: fetchFn });
    expect(r).toEqual({ ok: true, outcome: 'sent', status: 201 });
    expect(seen.calls).toBe(1);
    expect(seen.url).toBe(b.sub.endpoint);
    expect(seen.init.method).toBe('POST');
    expect(seen.init.redirect).toBe('manual');
    expect(seen.init.headers['Content-Encoding']).toBe('aes128gcm');
    expect(seen.init.headers['Content-Type']).toBe('application/octet-stream');
    expect(seen.init.headers.TTL).toBe('21600');
    expect(seen.init.headers.Urgency).toBe('normal');
    expect(seen.init.headers.Topic).toBeUndefined();
    expect(seen.keyHeader).toBe(keys.publicKey);
    expect(seen.token.ok).toBe(true);
    expect(seen.token.claims.aud).toBe('https://push.example.test');
    expect(seen.plain).toBe(json);
  });

  it('breaking news: high urgency and a short time to live from lib.js', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const { fetchFn, seen } = pushService(b, keys.publicKey);
    await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: TTL_SEC.breaking, urgency: URGENCY.breaking, now: NOW, fetch: fetchFn });
    expect(seen.init.headers.Urgency).toBe('high');
    expect(seen.init.headers.TTL).toBe('7200');
  });

  it('Topic is sent only when it is a valid topic (up to 32 URL-safe characters)', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const run = async (topic: any) => {
      const { fetchFn, seen } = pushService(b, keys.publicKey);
      await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn, topic });
      return seen.init.headers.Topic;
    };
    expect(await run('story-12_ab')).toBe('story-12_ab');
    expect(await run('a'.repeat(32))).toBe('a'.repeat(32));
    expect(await run('a'.repeat(33))).toBeUndefined();
    expect(await run('has space')).toBeUndefined();
    expect(await run('line\nbreak')).toBeUndefined();
    expect(await run('')).toBeUndefined();
    expect(await run(null)).toBeUndefined();
  });

  it('2xx other than 201 is also sent', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const { fetchFn } = pushService(b, keys.publicKey, { status: 202 });
    expect((await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn })).outcome).toBe('sent');
  });

  it('404 and 410: gone (delete the reader)', async () => {
    const { keys, v } = await vapid();
    for (const status of [404, 410]) {
      const b = browser();
      const { fetchFn } = pushService(b, keys.publicKey, { status });
      const r = await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
      expect(r).toEqual({ ok: false, outcome: 'gone', reason: 'gone', status });
    }
  });

  it('429: retry, with Retry-After in seconds when given and capped at one hour', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const run = async (headers?: Record<string, string>) => {
      const { fetchFn } = pushService(b, keys.publicKey, { status: 429, headers });
      return W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
    };
    expect(await run({ 'Retry-After': '120' })).toEqual({ ok: false, outcome: 'retry', reason: 'rate_limited', status: 429, retryAfter: 120 });
    expect((await run({ 'Retry-After': '999999' })).retryAfter).toBe(3600);
    expect((await run({ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })).retryAfter).toBeNull();
    expect((await run({ 'Retry-After': '-5' })).retryAfter).toBeNull();
    expect((await run()).retryAfter).toBeNull();
    expect((await run()).outcome).toBe('retry');
  });

  it('5xx: retry', async () => {
    const { keys, v } = await vapid();
    for (const status of [500, 502, 503, 504]) {
      const b = browser();
      const { fetchFn } = pushService(b, keys.publicKey, { status, headers: status === 503 ? { 'Retry-After': '30' } : undefined });
      const r = await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
      expect(r.outcome).toBe('retry');
      expect(r.reason).toBe('server');
      if (status === 503) expect(r.retryAfter).toBe(30);
    }
  });

  it('a network error is a retry, a time out is a retry with its own reason', async () => {
    const { v } = await vapid();
    const b = browser();
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: down })).toEqual({ ok: false, outcome: 'retry', reason: 'network' });
    const slow = vi.fn((_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    expect(await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: slow as any, timeoutMs: 20 })).toEqual({ ok: false, outcome: 'retry', reason: 'timeout' });
  });

  it('400, 401, 403, 413, a redirect and an odd status: rejected; 401 and 403 are marked as our key problem', async () => {
    const { keys, v } = await vapid();
    const expectations: Record<number, any> = {
      400: { reason: 'refused' },
      401: { reason: 'auth', auth: true },
      403: { reason: 'auth', auth: true },
      413: { reason: 'too_big' },
      301: { reason: 'redirect' },
      307: { reason: 'redirect' },
      418: { reason: 'refused' },
    };
    for (const [status, want] of Object.entries(expectations)) {
      const b = browser();
      const { fetchFn } = pushService(b, keys.publicKey, { status: Number(status) });
      const r = await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
      expect(r).toEqual({ ok: false, outcome: 'rejected', status: Number(status), ...want });
    }
  });

  it('stored keys that cannot be used: bad_sub, and nothing is sent', async () => {
    const { v } = await vapid();
    const fetchFn = vi.fn();
    const sub = { endpoint: 'https://push.example.test/x', p256dh: b64(Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)])), auth: b64(randomBytes(16)) };
    expect(await W.sendPush(sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn })).toEqual({ ok: false, outcome: 'bad_sub', reason: 'bad_key' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses before any network call: bad endpoint, ttl, urgency, missing or bad VAPID, subject, time, too big', async () => {
    const { v } = await vapid();
    const b = browser();
    const fetchFn = vi.fn();
    const run = (sub: any, o: any, text = json) => W.sendPush(sub, text, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn, ...o });
    expect((await run({ ...b.sub, endpoint: 'http://push.example.test/x' }, {})).outcome).toBe('bad_sub');
    expect((await run({ ...b.sub, endpoint: 'nonsense' }, {})).reason).toBe('bad_endpoint');
    expect((await run({ ...b.sub, endpoint: undefined }, {})).reason).toBe('bad_endpoint');
    for (const ttl of [undefined, -1, 1.5, W.MAX_TTL_SEC + 1, '60', NaN]) expect((await run(b.sub, { ttl })).reason).toBe('bad_ttl');
    expect((await run(b.sub, { urgency: 'urgent' })).reason).toBe('bad_urgency');
    expect(await run(b.sub, { vapid: undefined })).toEqual({ ok: false, outcome: 'rejected', reason: 'no_vapid', auth: true });
    expect(await run(b.sub, { subject: 'nobody' })).toEqual({ ok: false, outcome: 'rejected', reason: 'bad_subject', auth: true });
    expect(await run(b.sub, { now: undefined })).toEqual({ ok: false, outcome: 'rejected', reason: 'bad_time', auth: true });
    expect(await run(b.sub, {}, 'x'.repeat(3994))).toEqual({ ok: false, outcome: 'rejected', reason: 'too_big' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('a time to live of 0 is allowed (deliver now or drop)', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const { fetchFn, seen } = pushService(b, keys.publicKey);
    expect((await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 0, now: NOW, fetch: fetchFn })).ok).toBe(true);
    expect(seen.init.headers.TTL).toBe('0');
  });

  it('a fetch that returns nothing useful is a retry, not a crash', async () => {
    const { v } = await vapid();
    const b = browser();
    for (const bad of [undefined, null, {}, { status: 'ok' }]) {
      const fetchFn = vi.fn(async () => bad as any);
      expect(await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn })).toEqual({ ok: false, outcome: 'retry', reason: 'network' });
    }
  });

  it('all four urgencies of RFC 8030 are allowed', async () => {
    const { keys, v } = await vapid();
    for (const urgency of ['very-low', 'low', 'normal', 'high']) {
      const b = browser();
      const { fetchFn, seen } = pushService(b, keys.publicKey);
      expect((await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, urgency, now: NOW, fetch: fetchFn })).ok).toBe(true);
      expect(seen.init.headers.Urgency).toBe(urgency);
    }
  });

  it('urgency defaults to normal', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const { fetchFn, seen } = pushService(b, keys.publicKey);
    await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
    expect(seen.init.headers.Urgency).toBe('normal');
  });

  it('privacy (BUGS P13): no result holds the endpoint, a key or the text; nothing is printed to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      const { keys, v } = await vapid();
      const b = browser(7);
      const results: any[] = [];
      for (const status of [201, 404, 410, 429, 500, 401, 400, 301]) {
        const { fetchFn } = pushService(b, keys.publicKey, { status });
        results.push(await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn }));
      }
      results.push(await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: vi.fn(async () => { throw new Error(b.sub.endpoint); }) }));
      results.push(await W.sendPush({ ...b.sub, p256dh: 'bad' }, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW }));
      const all = JSON.stringify(results);
      expect(all).not.toContain('secret-endpoint-7');
      expect(all).not.toContain(b.sub.p256dh);
      expect(all).not.toContain(b.sub.auth);
      expect(all).not.toContain('Headline');
      expect(all).not.toContain(keys.privateKey);
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('the response body is cancelled and never read', async () => {
    const { v } = await vapid();
    const b = browser();
    const cancel = vi.fn();
    const text = vi.fn();
    const fetchFn = vi.fn(async () => ({ status: 201, headers: new Headers(), body: { cancel }, text }) as any);
    await W.sendPush(b.sub, json, { vapid: v, subject: SUBJECT, ttl: 60, now: NOW, fetch: fetchFn });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();
  });

  it('a payload from buildPayload goes all the way: built, encrypted, signed, opened', async () => {
    const { keys, v } = await vapid();
    const b = browser();
    const built = buildPayload({ title: 'Parliament passes the bill', description: 'The vote ended late on Saturday.', url: 'https://news.test/2026/11/15/blogs/world/vote/', breaking: true });
    expect(built.ok).toBe(true);
    const { fetchFn, seen } = pushService(b, keys.publicKey);
    const r = await W.sendPush(b.sub, built.json, { vapid: v, subject: SUBJECT, ttl: TTL_SEC.breaking, urgency: URGENCY.breaking, topic: 'story-1', now: NOW, fetch: fetchFn });
    expect(r.ok).toBe(true);
    const got = JSON.parse(seen.plain);
    expect(got.title).toBe('Parliament passes the bill');
    expect(got.url).toContain('pn=1');
    expect(got.renotify).toBe(true);
  });
});

describe('make-vapid script', () => {
  it('prints a pair that loads, and writes no file', async () => {
    const { execFileSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const { readdirSync } = await import('node:fs');
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const before = readdirSync(root).sort().join();
    const out = execFileSync('node', ['scripts/make-vapid.mjs'], { cwd: root, encoding: 'utf8' });
    const keys = out.split('\n').filter((l) => /^[A-Za-z0-9_-]{43}$|^[A-Za-z0-9_-]{87}$/.test(l));
    expect(keys.length).toBe(2);
    const pub = keys.find((k) => k.length === 87)!;
    const priv = keys.find((k) => k.length === 43)!;
    expect((await V.loadVapid(priv, pub)).ok).toBe(true);
    expect(readdirSync(root).sort().join()).toBe(before);
  });
});
