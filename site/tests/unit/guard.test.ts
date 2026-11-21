import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker code
import * as g from '../../../workers/shared/guard.js';

const SITE = 'https://news.test';
const SECRET = 'test-secret-value';
const NOW = 1_800_000_000_000;
const spec = { name: { max: 20, required: true, oneLine: true }, message: { max: 50, min: 5, required: true } };
const rules = { methods: ['POST'], schema: spec, route: 'contact', killVar: 'CONTACT_OFF', secretVar: 'STAMP_SECRET' };
const env = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET };

function req(body: any, o: { method?: string; origin?: string | null; type?: string | null; length?: string } = {}) {
  const headers: Record<string, string> = {};
  if (o.origin !== null) headers['Origin'] = o.origin ?? SITE;
  if (o.type !== null) headers['Content-Type'] = o.type ?? 'application/json';
  if (o.length) headers['Content-Length'] = o.length;
  const method = o.method ?? 'POST';
  return new Request('https://worker.test/contact', { method, headers, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}

async function goodBody(extra: Record<string, any> = {}) {
  return { name: 'Asha', message: 'Hello there', website: '', stamp: await g.issueStamp(SECRET, NOW - 10_000, 'contact'), ...extra };
}

describe('kill switch, method, origin, type, size', () => {
  it('isKilled knows the words and nothing else', () => {
    for (const w of ['true', '1', 'yes', 'on', ' ON ', 'True']) expect(g.isKilled(w)).toBe(true);
    for (const w of ['false', '0', '', 'no', undefined, null, 'maybe']) expect(g.isKilled(w)).toBe(false);
  });
  it('originOk is an exact match and never matches an empty site origin', () => {
    expect(g.originOk(SITE, SITE)).toBe(true);
    expect(g.originOk(SITE + '/', SITE)).toBe(false);
    expect(g.originOk('https://news.test.evil.com', SITE)).toBe(false);
    expect(g.originOk('', '')).toBe(false);
    expect(g.originOk(null as any, SITE)).toBe(false);
    expect(g.originOk(SITE, undefined as any)).toBe(false);
    expect(g.originOk('*', '*')).toBe(false);
    expect(g.originOk('https://*.news.test', 'https://*.news.test')).toBe(false);
    expect(g.originOk('news.test', 'news.test')).toBe(false);
  });
  it('methodCheck lists Allow with OPTIONS', () => {
    expect(g.methodCheck('post', ['POST'])).toEqual({ ok: true, allow: 'POST, OPTIONS' });
    expect(g.methodCheck('GET', ['POST']).ok).toBe(false);
    expect(g.methodCheck('GET', undefined as any).ok).toBe(false);
  });
  it('contentTypeOk accepts JSON only', () => {
    expect(g.contentTypeOk('application/json')).toBe(true);
    expect(g.contentTypeOk('application/json; charset=utf-8')).toBe(true);
    expect(g.contentTypeOk('Application/JSON')).toBe(true);
    for (const t of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', '', null, 'application/jsonx']) expect(g.contentTypeOk(t)).toBe(false);
  });
  it('sizeOk checks the declared length and the real text', () => {
    expect(g.sizeOk('10', 'x'.repeat(10), 100)).toBe(true);
    expect(g.sizeOk('400', 'x', 100)).toBe(true); // up to 4 bytes for one character (Bengali is 3)
    expect(g.sizeOk('401', 'x', 100)).toBe(false);
    expect(g.sizeOk(null, 'x'.repeat(101), 100)).toBe(false);
    expect(g.sizeOk('abc', 'x', 100)).toBe(true);
    expect(g.sizeOk(undefined, 5 as any, 100)).toBe(false);
  });
  it('parseJson gives only plain objects', () => {
    expect(g.parseJson('{"a":1}')).toEqual({ a: 1 });
    for (const t of ['[1]', '5', 'null', '"x"', '{bad', '']) expect(g.parseJson(t)).toBeNull();
  });
});

describe('checkSchema and the trap field', () => {
  it('cleans text and keeps only the schema fields', () => {
    const r = g.checkSchema({ name: '  Asha\u0000 \n Roy ', message: 'Hello\u0007 there\nline two', website: '' }, spec, ['website']);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: 'Asha Roy', message: 'Hello there\nline two' });
  });
  it('refuses extra fields, wrong types and a non-object', () => {
    expect(g.checkSchema({ name: 'A', message: 'Hello', extra: 'x' }, spec).reason).toBe('bad');
    expect(g.checkSchema({ name: 5, message: 'Hello' }, spec).reason).toBe('bad');
    expect(g.checkSchema({ name: { a: 1 }, message: 'Hello' }, spec).reason).toBe('bad');
    expect(g.checkSchema([], spec).reason).toBe('bad');
    expect(g.checkSchema(null, spec).reason).toBe('bad');
  });
  it('names the field for required, minimum and maximum errors', () => {
    expect(g.checkSchema({ message: 'Hello' }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'name' });
    expect(g.checkSchema({ name: 'A', message: 'Hi' }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'message' });
    expect(g.checkSchema({ name: 'A'.repeat(21), message: 'Hello' }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'name' });
  });
  it('an optional empty field is fine and the minimum applies only to text that is there', () => {
    const s = { a: { max: 5 }, b: { max: 5, min: 3 } };
    expect(g.checkSchema({ a: 'x' }, s)).toEqual({ ok: true, value: { a: 'x', b: '' } });
  });
  it('honeypotFilled', () => {
    expect(g.honeypotFilled({ website: '' })).toBe(false);
    expect(g.honeypotFilled({ website: '   ' })).toBe(false);
    expect(g.honeypotFilled({})).toBe(false);
    expect(g.honeypotFilled({ website: 'http://x' })).toBe(true);
    expect(g.honeypotFilled({ website: 0 })).toBe(true);
    expect(g.honeypotFilled({ url: 'x' }, 'url')).toBe(true);
    expect(g.honeypotFilled(null)).toBe(false);
  });
});

describe('the fill-time stamp', () => {
  it('a good stamp passes after 3 seconds and before 2 hours', async () => {
    const s = await g.issueStamp(SECRET, NOW - 5000, 'contact');
    expect(s).toMatch(/^\d{13}\.[0-9a-f]{64}$/);
    expect(await g.checkStamp(SECRET, s, NOW, 'contact')).toEqual({ ok: true });
  });
  it('too fast, too old, from the future', async () => {
    const fast = await g.issueStamp(SECRET, NOW - 1000, 'contact');
    expect((await g.checkStamp(SECRET, fast, NOW, 'contact')).reason).toBe('too_fast');
    const old = await g.issueStamp(SECRET, NOW - 3 * 3600_000, 'contact');
    expect((await g.checkStamp(SECRET, old, NOW, 'contact')).reason).toBe('too_old');
    const fut = await g.issueStamp(SECRET, NOW + 60_000, 'contact');
    expect((await g.checkStamp(SECRET, fut, NOW, 'contact')).reason).toBe('future');
  });
  it('the limits sit exactly on the edge', async () => {
    const edgeFast = await g.issueStamp(SECRET, NOW - g.STAMP_MIN_MS, 'r');
    expect((await g.checkStamp(SECRET, edgeFast, NOW, 'r')).ok).toBe(true);
    const edgeOld = await g.issueStamp(SECRET, NOW - g.STAMP_MAX_MS, 'r');
    expect((await g.checkStamp(SECRET, edgeOld, NOW, 'r')).ok).toBe(true);
    const over = await g.issueStamp(SECRET, NOW - g.STAMP_MAX_MS - 1, 'r');
    expect((await g.checkStamp(SECRET, over, NOW, 'r')).reason).toBe('too_old');
  });
  it('a changed time, a wrong secret, another route, junk and nothing are all refused', async () => {
    const s = await g.issueStamp(SECRET, NOW - 10_000, 'contact');
    const [t, sig] = s.split('.');
    expect((await g.checkStamp(SECRET, `${Number(t) - 5000}.${sig}`, NOW, 'contact')).reason).toBe('bad');
    expect((await g.checkStamp('other-secret', s, NOW, 'contact')).reason).toBe('bad');
    expect((await g.checkStamp(SECRET, s, NOW, 'chat')).reason).toBe('bad');
    expect((await g.checkStamp(SECRET, 'junk', NOW, 'contact')).reason).toBe('bad');
    expect((await g.checkStamp(SECRET, `${t}.${'0'.repeat(64)}`, NOW, 'contact')).reason).toBe('bad');
    expect((await g.checkStamp(SECRET, '', NOW, 'contact')).reason).toBe('missing');
    expect((await g.checkStamp(SECRET, undefined as any, NOW, 'contact')).reason).toBe('missing');
    expect((await g.checkStamp(SECRET, 12345 as any, NOW, 'contact')).reason).toBe('missing');
    expect((await g.checkStamp('', s, NOW, 'contact')).reason).toBe('bad');
  });
  it('issueStamp refuses an empty secret', async () => {
    await expect(g.issueStamp('', NOW)).rejects.toThrow();
  });
});

describe('rate and duplicate helpers', () => {
  it('hashKey is stable, salted and does not show the input', async () => {
    const a = await g.hashKey('salt', 'contact', '203.0.113.9');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(await g.hashKey('salt', 'contact', '203.0.113.9'));
    expect(a).not.toBe(await g.hashKey('salt2', 'contact', '203.0.113.9'));
    expect(a).not.toBe(await g.hashKey('salt', 'chat', '203.0.113.9'));
    expect(a).not.toContain('203');
  });
  it('rateCheck allows below the limit and says when to retry', () => {
    const now = 600_000 * 1000 + 30_000; // 30 s into a 60 s window
    expect(g.rateCheck(2, 3, now, 60)).toEqual({ allowed: true, retryAfter: 30 });
    expect(g.rateCheck(3, 3, now, 60).allowed).toBe(false);
    expect(g.rateCheck(99, 3, now, 60).allowed).toBe(false);
    expect(g.rateCheck(0, 1, now, 60).allowed).toBe(true);
    expect(g.rateCheck(0, 3, 60_000, 60).retryAfter).toBe(60);
  });
  it('windowId changes at the edge of a window', () => {
    expect(g.windowId(59_999, 60)).toBe(0);
    expect(g.windowId(60_000, 60)).toBe(1);
  });
  it('dedupeKey ignores field order and changes with the text, route and sender', async () => {
    const a = await g.dedupeKey('s', 'contact', 'u1', { name: 'A', message: 'Hello' });
    expect(a).toBe(await g.dedupeKey('s', 'contact', 'u1', { message: 'Hello', name: 'A' }));
    expect(a).not.toBe(await g.dedupeKey('s', 'contact', 'u1', { name: 'A', message: 'Hello!' }));
    expect(a).not.toBe(await g.dedupeKey('s', 'chat', 'u1', { name: 'A', message: 'Hello' }));
    expect(a).not.toBe(await g.dedupeKey('s', 'contact', 'u2', { name: 'A', message: 'Hello' }));
  });
});

describe('link checks', () => {
  it('counts links and flags too many or only links', () => {
    expect(g.countLinks('see https://a.com and www.b.org now')).toBe(2);
    expect(g.countLinks('no links here')).toBe(0);
    expect(g.spamLinks('hi https://a.com', 2)).toBe(false);
    expect(g.spamLinks('a https://a.com b https://b.com c https://c.com', 2)).toBe(true);
    expect(g.spamLinks('https://a.com', 2)).toBe(true);
    expect(g.spamLinks('https://a.com, https://b.com | www.c.com', 5)).toBe(true);
    expect(g.spamLinks('', 2)).toBe(false);
    expect(g.spamLinks(undefined as any, 2)).toBe(false);
    expect(g.spamLinks('HTTP://A.COM x', 2)).toBe(false);
  });
});

describe('guardRequest: the whole front part', () => {
  it('passes a good message and returns only the cleaned fields', async () => {
    const r = await g.guardRequest(req(await goodBody()), env, rules, NOW);
    expect(r).toEqual({ ok: true, body: { name: 'Asha', message: 'Hello there' } });
  });
  it('the kill switch comes first, with Retry-After', async () => {
    const r = await g.guardRequest(req(await goodBody(), { method: 'GET' }), { ...env, CONTACT_OFF: 'on' }, rules, NOW);
    expect(r.status).toBe(503);
    expect(r.headers['Retry-After']).toBe('600');
  });
  it('wrong method gives 405 with Allow', async () => {
    const r = await g.guardRequest(req('', { method: 'GET' }), env, rules, NOW);
    expect(r.status).toBe(405);
    expect(r.headers.Allow).toBe('POST, OPTIONS');
  });
  it('wrong, missing or empty origin gives 403', async () => {
    const body = await goodBody();
    expect((await g.guardRequest(req(body, { origin: 'https://evil.test' }), env, rules, NOW)).status).toBe(403);
    expect((await g.guardRequest(req(body, { origin: null }), env, rules, NOW)).status).toBe(403);
    expect((await g.guardRequest(req(body), { ...env, SITE_ORIGIN: '' }, rules, NOW)).status).toBe(403);
    expect((await g.guardRequest(req(body), {}, rules, NOW)).status).toBe(403);
  });
  it('not JSON gives 415', async () => {
    const r = await g.guardRequest(req(await goodBody(), { type: 'text/plain' }), env, rules, NOW);
    expect(r.status).toBe(415);
    expect((await g.guardRequest(req(await goodBody(), { type: null }), env, rules, NOW)).status).toBe(415);
  });
  it('too big gives 413, declared or real', async () => {
    const big = await g.guardRequest(req(await goodBody({ message: 'x'.repeat(5000) })), env, { ...rules, maxBody: 1000 }, NOW);
    expect(big.status).toBe(413);
    const declared = await g.guardRequest(req(await goodBody(), { length: '999999' }), env, rules, NOW);
    expect(declared.status).toBe(413);
    // Bengali text: 3 bytes a character, so the header may be larger than the character limit and still pass
    const bn = await g.guardRequest(req(await goodBody(), { length: '2500' }), env, { ...rules, maxBody: 1000 }, NOW);
    expect(bn.ok).toBe(true);
  });
  it('broken JSON, an array and a number give 400', async () => {
    for (const text of ['{bad', '[1,2]', '5', '']) expect((await g.guardRequest(req(text), env, rules, NOW)).status).toBe(400);
  });
  it('a wrong shape gives a plain 400 and a bad value names the field only', async () => {
    const extra = await g.guardRequest(req(await goodBody({ admin: true })), env, rules, NOW);
    expect(extra).toMatchObject({ ok: false, status: 400, error: 'Bad request' });
    const short = await g.guardRequest(req(await goodBody({ message: 'Hi' })), env, rules, NOW);
    expect(short.status).toBe(400);
    expect(short.error).toBe('Please check the field: message');
    expect(short.field).toBe('message');
  });
  it('the trap field is dropped silently', async () => {
    expect(await g.guardRequest(req(await goodBody({ website: 'http://spam.test' })), env, rules, NOW)).toEqual({ ok: false, drop: true });
  });
  it('a too-fast form is dropped, an old one is told to reload', async () => {
    const fast = await g.issueStamp(SECRET, NOW - 500, 'contact');
    expect(await g.guardRequest(req(await goodBody({ stamp: fast })), env, rules, NOW)).toEqual({ ok: false, drop: true });
    const old = await g.issueStamp(SECRET, NOW - 5 * 3600_000, 'contact');
    const r = await g.guardRequest(req(await goodBody({ stamp: old })), env, rules, NOW);
    expect(r).toMatchObject({ ok: false, status: 400, error: 'This page is old. Please reload it and try again.', reload: true });
  });
  it('a missing, wrong-route or forged stamp gives 400 without detail', async () => {
    const body = await goodBody();
    delete (body as any).stamp;
    expect((await g.guardRequest(req(body), env, rules, NOW)).status).toBe(400);
    const other = await g.issueStamp(SECRET, NOW - 10_000, 'chat');
    expect((await g.guardRequest(req(await goodBody({ stamp: other })), env, rules, NOW)).error).toBe('Please reload the page and try again.');
    expect((await g.guardRequest(req(await goodBody({ stamp: 'forged' })), env, rules, NOW)).status).toBe(400);
  });
  it('a missing stamp secret in the Worker is a 503, never a pass', async () => {
    const r = await g.guardRequest(req(await goodBody()), { SITE_ORIGIN: SITE }, rules, NOW);
    expect(r.status).toBe(503);
  });
  it('without stamps the stamp field is an extra field and is refused', async () => {
    const plain = { methods: ['POST'], schema: spec, route: 'contact' };
    expect((await g.guardRequest(req({ name: 'Asha', message: 'Hello there', website: '' }), env, plain, NOW)).ok).toBe(true);
    expect((await g.guardRequest(req(await goodBody()), env, plain, NOW)).status).toBe(400);
  });
  it('a stamp is checked after the trap and the schema, so a bot never learns which check failed', async () => {
    const r = await g.guardRequest(req({ name: 'A', message: 'Hello', website: 'x', stamp: 'junk' }), env, rules, NOW);
    expect(r).toEqual({ ok: false, drop: true });
  });
  it('a request whose body cannot be read gives 400', async () => {
    const broken = { method: 'POST', headers: { get: (k: string) => ({ Origin: SITE, 'Content-Type': 'application/json' } as any)[k] ?? null }, text: async () => { throw new Error('stream'); } };
    expect((await g.guardRequest(broken as any, env, rules, NOW)).status).toBe(400);
  });
});

describe('object and optional fields, and the stamp window (v0.73.0)', () => {
  const NOW = 1_800_000_000_000;
  const SECRET = 'a-long-secret-for-the-guard-tests-0123456789';
  const spec = { sub: { max: 64, optional: true }, prefs: { object: true }, must: { object: true, required: true } };
  it('an object field is handed on unchanged, a missing one is left out', () => {
    const r: any = g.checkSchema({ must: { a: [1, { b: 2 }] } }, spec);
    expect(r).toEqual({ ok: true, value: { must: { a: [1, { b: 2 }] } } });
    expect('prefs' in r.value).toBe(false);
    expect('sub' in r.value).toBe(false);
  });
  it('an object field refuses text, numbers and arrays (bad), and a required one refuses a missing value (invalid)', () => {
    for (const bad of ['x', 5, true, [1]]) expect(g.checkSchema({ must: {}, prefs: bad }, spec)).toEqual({ ok: false, reason: 'bad' });
    expect(g.checkSchema({ prefs: {} }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'must' });
    expect(g.checkSchema({ must: null }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'must' });
  });
  it('an optional text field is still checked when it is there; without the flag a missing text field is an empty text', () => {
    expect(g.checkSchema({ must: {}, sub: 'abc' }, spec)).toMatchObject({ ok: true, value: { sub: 'abc' } });
    expect(g.checkSchema({ must: {}, sub: 'x'.repeat(65) }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'sub' });
    expect(g.checkSchema({ must: {}, sub: 5 }, spec)).toEqual({ ok: false, reason: 'bad' });
    expect(g.checkSchema({}, { a: { max: 5 } })).toEqual({ ok: true, value: { a: '' } });
  });
  const req = (body: any) => ({ method: 'POST', headers: { get: (k: string) => ({ Origin: 'https://news.test', 'Content-Type': 'application/json' } as any)[k] ?? null }, text: async () => JSON.stringify(body) });
  const env = { SITE_ORIGIN: 'https://news.test', STAMP_SECRET: SECRET };
  it('stampMinMs 0 lets a stamp that was made a moment ago pass; the default still drops it', async () => {
    const stamp = await g.issueStamp(SECRET, NOW, 'r');
    const base = { methods: ['POST'], route: 'r', secretVar: 'STAMP_SECRET', schema: { a: { max: 5, optional: true } } };
    expect((await g.guardRequest(req({ a: 'x', stamp }), env, { ...base, stampMinMs: 0 }, NOW)).ok).toBe(true);
    expect(await g.guardRequest(req({ a: 'x', stamp }), env, base, NOW)).toEqual({ ok: false, drop: true });
  });
  it('stampMaxMs shortens the time a stamp lives', async () => {
    const stamp = await g.issueStamp(SECRET, NOW, 'r');
    const rules = { methods: ['POST'], route: 'r', secretVar: 'STAMP_SECRET', stampMinMs: 0, stampMaxMs: 60_000, schema: { a: { max: 5, optional: true } } };
    expect((await g.guardRequest(req({ stamp }), env, rules, NOW + 59_000)).ok).toBe(true);
    const old: any = await g.guardRequest(req({ stamp }), env, rules, NOW + 61_000);
    expect(old).toMatchObject({ ok: false, status: 400, reload: true });
  });
});

describe('number fields and text/plain (v0.74.0)', () => {
  it('a number field takes a finite number and hands it on; a missing one is left out', () => {
    const spec = { read: { number: true, optional: true }, need: { number: true, required: true } };
    expect(g.checkSchema({ need: 5, read: 0 }, spec)).toEqual({ ok: true, value: { need: 5, read: 0 } });
    expect(g.checkSchema({ need: 5 }, spec)).toEqual({ ok: true, value: { need: 5 } });
    expect(g.checkSchema({ read: 1 }, spec)).toEqual({ ok: false, reason: 'invalid', field: 'need' });
  });
  it('a number field refuses text, booleans, objects, NaN-like values and infinities', () => {
    const spec = { n: { number: true } };
    for (const bad of ['5', true, {}, [], 'NaN']) expect(g.checkSchema({ n: bad }, spec)).toEqual({ ok: false, reason: 'bad' });
    expect(g.checkSchema({ n: JSON.parse('1e999') }, spec)).toEqual({ ok: false, reason: 'bad' }); // Infinity
  });
  it('plainTextOk takes text/plain with an optional utf-8 charset only', () => {
    for (const ok of ['text/plain', 'text/plain;charset=UTF-8', 'text/plain; charset=utf-8', ' TEXT/PLAIN ']) expect(g.plainTextOk(ok), ok).toBe(true);
    for (const bad of ['', null, undefined, 'text/html', 'text/plain; charset=latin1', 'text/plainx', 'application/json']) expect(g.plainTextOk(bad as any), String(bad)).toBe(false);
  });
  const SITE = 'https://news.test';
  const req = (type: string, body: any) => ({ method: 'POST', headers: { get: (k: string) => ({ Origin: SITE, 'Content-Type': type } as any)[k] ?? null }, text: async () => JSON.stringify(body) });
  it('guardRequest refuses text/plain unless the rules say allowPlain', async () => {
    const rules: any = { methods: ['POST'], schema: { a: { max: 5 } } };
    const e = { SITE_ORIGIN: SITE };
    expect((await g.guardRequest(req('text/plain', { a: 'x' }), e, rules)).status).toBe(415);
    expect((await g.guardRequest(req('text/plain;charset=UTF-8', { a: 'x' }), e, { ...rules, allowPlain: true })).ok).toBe(true);
    expect((await g.guardRequest(req('text/html', { a: 'x' }), e, { ...rules, allowPlain: true })).status).toBe(415);
  });
});

describe('the file itself', () => {
  const src = readFileSync(new URL('../../../workers/shared/guard.js', import.meta.url), 'utf8');
  it('has no console, no network call, no secret and no address reading', () => {
    expect(src).not.toMatch(/console\./);
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/CF-Connecting-IP|X-Forwarded-For/i);
    expect(src).not.toMatch(/[A-Za-z0-9]{32,}/);
  });
  it('is not used by the other Workers yet (contact since v0.72.0, push since v0.73.0, analytics since v0.74.0)', () => {
    for (const f of ['auth', 'geo']) {
      expect(readFileSync(new URL(`../../../workers/${f}/index.js`, import.meta.url), 'utf8')).not.toMatch(/shared\/guard/);
    }
  });
});
