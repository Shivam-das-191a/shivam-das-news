import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker
import worker from '../../../workers/contact/index.js';
// @ts-ignore plain JS Worker code
import { issueStamp, checkStamp } from '../../../workers/shared/guard.js';
// @ts-ignore plain JS Worker code
import { cleanMessage, parseBody, verifyTurnstile, rateDecision, insertValues, INSERT_SQL, COUNT_EMAIL_SQL, COUNT_ALL_SQL, MAX_BODY, LIMITS, PER_EMAIL_HOUR, ALL_HOUR } from '../../../workers/contact/lib.js';

const SITE = 'https://news.test';
const good = { name: 'Asha Roy', email: 'Asha@Example.org', subject: 'A question', message: 'Hello, I have a question about your article.', token: 'turnstile-token-123456', website: '' };

function fakeDb(o: { byEmail?: number; all?: number; failInsert?: boolean; failCount?: boolean } = {}) {
  const runs: { sql: string; values: any[] }[] = [];
  const counts: { sql: string; values: any[] }[] = [];
  return {
    runs,
    counts,
    prepare: (sql: string) => ({
      bind: (...values: any[]) => ({
        first: async () => {
          if (o.failCount) throw new Error('db down');
          counts.push({ sql, values });
          return { n: sql === COUNT_EMAIL_SQL ? o.byEmail ?? 0 : o.all ?? 0 };
        },
        run: async () => {
          if (o.failInsert) throw new Error('db down');
          runs.push({ sql, values });
          return { success: true };
        },
      }),
    }),
  };
}

function fakeFetch(success = true, o: { status?: number; throws?: boolean } = {}) {
  const calls: { url: string; init: any }[] = [];
  const fn = async (url: string, init: any) => {
    calls.push({ url, init });
    if (o.throws) throw new Error('network');
    return { ok: (o.status ?? 200) < 400, status: o.status ?? 200, json: async () => ({ success }) };
  };
  return Object.assign(fn, { calls });
}

const STAMP_SECRET = 'stamp-secret-value';
const mkEnv = (extra: any = {}) => ({ SITE_ORIGIN: SITE, TURNSTILE_SECRET: 'secret-key', STAMP_SECRET, DB: fakeDb(), ...extra });
// Since v0.72.0 a message is JSON and carries a signed stamp that is 10 seconds old (like a form that a person filled). `stamp` in the body or `noStamp` changes that.
const post = async (body: any, o: { origin?: string | null; method?: string; path?: string; headers?: Record<string, string>; fetch?: any; noStamp?: boolean } = {}, env: any = mkEnv()) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(o.headers ?? {}) };
  if (o.origin !== null) headers.Origin = o.origin ?? SITE;
  const init: any = { method: o.method ?? 'POST', headers };
  let payload = body;
  if (body && typeof body === 'object' && !('stamp' in body) && !o.noStamp) payload = { ...body, stamp: await issueStamp(env.STAMP_SECRET || STAMP_SECRET, Date.now() - 10_000, 'contact') };
  if ((o.method ?? 'POST') === 'POST') init.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return worker.fetch(new Request('https://contact.test' + (o.path ?? '/contact'), init), env, undefined, o.fetch ?? fakeFetch(true));
};

describe('cleanMessage', () => {
  it('accepts a good message and tidies it (email lower case, name on one line)', () => {
    const r = cleanMessage({ ...good, name: '  Asha\n  Roy ' });
    expect(r.ok).toBe(true);
    expect(r.message).toEqual({ name: 'Asha Roy', email: 'asha@example.org', subject: 'A question', message: 'Hello, I have a question about your article.' });
    expect(r.token).toBe('turnstile-token-123456');
  });
  it('accepts Bengali and other scripts', () => {
    const r = cleanMessage({ ...good, name: 'শিবম দাস', message: 'আপনার খবরটি নিয়ে আমার একটি প্রশ্ন আছে।' });
    expect(r.ok).toBe(true);
    expect(r.message.name).toBe('শিবম দাস');
  });
  it('keeps line breaks in the message and removes control characters', () => {
    const r = cleanMessage({ ...good, message: 'Line one is here.\r\nLine two is here.\u0000\u0007' });
    expect(r.message.message).toBe('Line one is here.\nLine two is here.');
  });
  it('allows an empty subject', () => {
    expect(cleanMessage({ ...good, subject: undefined }).message.subject).toBe('');
  });
  it('treats a filled hidden field as a bot', () => {
    expect(cleanMessage({ ...good, website: 'http://spam.test' })).toEqual({ ok: false, reason: 'bot' });
  });
  it('refuses a body that is not a form message', () => {
    expect(cleanMessage(null).reason).toBe('bad');
    expect(cleanMessage({ ...good, name: 5 }).reason).toBe('bad');
    expect(cleanMessage({ ...good, message: ['a'] }).reason).toBe('bad');
  });
  it('gives a plain message and the field for each wrong value', () => {
    expect(cleanMessage({ ...good, name: '  ' })).toMatchObject({ ok: false, field: 'name' });
    expect(cleanMessage({ ...good, name: 'a'.repeat(LIMITS.name + 1) })).toMatchObject({ field: 'name' });
    expect(cleanMessage({ ...good, email: '' })).toMatchObject({ field: 'email' });
    expect(cleanMessage({ ...good, email: 'not-an-email' })).toMatchObject({ field: 'email' });
    expect(cleanMessage({ ...good, email: 'a b@c.org' })).toMatchObject({ field: 'email' });
    expect(cleanMessage({ ...good, subject: 'a'.repeat(LIMITS.subject + 1) })).toMatchObject({ field: 'subject' });
    expect(cleanMessage({ ...good, message: 'short' })).toMatchObject({ field: 'message' });
    expect(cleanMessage({ ...good, message: 'a'.repeat(LIMITS.message + 1) })).toMatchObject({ field: 'message' });
    expect(cleanMessage({ ...good, token: '' })).toMatchObject({ field: 'check' });
    expect(cleanMessage({ ...good, token: 'a'.repeat(LIMITS.token + 1) })).toMatchObject({ field: 'check' });
  });
  it('refuses a message with more than two links', () => {
    const three = 'See http://a.test and https://b.test and www.c.test for the proof.';
    expect(cleanMessage({ ...good, message: three })).toMatchObject({ ok: false, field: 'message' });
    const two = 'See http://a.test and https://b.test for the proof.';
    expect(cleanMessage({ ...good, message: two }).ok).toBe(true);
  });
});

describe('parseBody, rateDecision, insertValues', () => {
  it('parses only a JSON object', () => {
    expect(parseBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseBody('[1]')).toBeNull();
    expect(parseBody('nope')).toBeNull();
    expect(parseBody('null')).toBeNull();
  });
  it('stops the fourth message from one email in an hour and the flood in total', () => {
    expect(rateDecision(PER_EMAIL_HOUR - 1, 0)).toBeNull();
    expect(rateDecision(PER_EMAIL_HOUR, 0)).toBe('email');
    expect(rateDecision(0, ALL_HOUR - 1)).toBeNull();
    expect(rateDecision(0, ALL_HOUR)).toBe('all');
    expect(rateDecision(undefined, undefined)).toBeNull();
  });
  it('makes the row values with whole seconds and the status new', () => {
    expect(insertValues({ name: 'A', email: 'a@b.co', subject: '', message: 'Hello there' }, 1_700_000_123_456)).toEqual([1_700_000_123, 'A', 'a@b.co', '', 'Hello there', 'new']);
  });
});

describe('verifyTurnstile', () => {
  it('sends the secret and the token and nothing about the visitor', async () => {
    const f = fakeFetch(true);
    expect(await verifyTurnstile('tok-1234567890', 'sec', f)).toBe(true);
    expect(f.calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = f.calls[0].init.body as URLSearchParams;
    expect([...form.keys()].sort()).toEqual(['response', 'secret']);
    expect(form.get('secret')).toBe('sec');
    expect(form.get('response')).toBe('tok-1234567890');
  });
  it('is false when the check fails, the answer is not ok, or the network fails', async () => {
    expect(await verifyTurnstile('t', 's', fakeFetch(false))).toBe(false);
    expect(await verifyTurnstile('t', 's', fakeFetch(true, { status: 500 }))).toBe(false);
    expect(await verifyTurnstile('t', 's', fakeFetch(true, { throws: true }))).toBe(false);
  });
});

describe('contact Worker: a good message', () => {
  it('stores one checked row and answers 200 with ok', async () => {
    const env = mkEnv();
    const res = await post(good, {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(env.DB.runs).toHaveLength(1);
    expect(env.DB.runs[0].sql).toBe(INSERT_SQL);
    const v = env.DB.runs[0].values;
    expect(v.slice(1)).toEqual(['Asha Roy', 'asha@example.org', 'A question', 'Hello, I have a question about your article.', 'new']);
    expect(v[0]).toBeGreaterThan(1_700_000_000);
  });
  it('uses the Worker clock, not a time from the browser', async () => {
    const env = mkEnv();
    // Since v0.72.0 a time sent by the browser is an extra field and the whole message is refused (exact fields).
    expect((await post({ ...good, ts: 5, now: 5 }, {}, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
    await post(good, {}, env);
    expect(env.DB.runs[0].values[0]).toBeGreaterThan(1_700_000_000);
  });
  it('is never cached and gives the CORS header only to the site itself', async () => {
    const ok = await post(good);
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const other = await post(good, { origin: 'https://evil.test' });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('does not store an IP address', async () => {
    const env = mkEnv();
    await post(good, { headers: { 'CF-Connecting-IP': '203.0.113.9', 'X-Forwarded-For': '203.0.113.9' } }, env);
    expect(JSON.stringify(env.DB.runs)).not.toContain('203.0.113.9');
  });
  it('asks Turnstile once with the secret from the environment', async () => {
    const f = fakeFetch(true);
    await post(good, { fetch: f });
    expect(f.calls).toHaveLength(1);
    expect((f.calls[0].init.body as URLSearchParams).get('secret')).toBe('secret-key');
  });
  it('counts the last hour by email and in total before it saves', async () => {
    const env = mkEnv();
    await post(good, {}, env);
    expect(env.DB.counts.map((c: any) => c.sql)).toEqual([COUNT_EMAIL_SQL, COUNT_ALL_SQL]);
    expect(env.DB.counts[0].values[0]).toBe('asha@example.org');
    const since = env.DB.counts[1].values[0];
    expect(Math.floor(Date.now() / 1000) - since).toBeGreaterThanOrEqual(3599);
    expect(Math.floor(Date.now() / 1000) - since).toBeLessThanOrEqual(3601);
  });
});

describe('contact Worker: who may call and what it needs', () => {
  it('refuses another origin and a missing origin, and stores nothing', async () => {
    const env = mkEnv();
    expect((await post(good, { origin: 'https://evil.test' }, env)).status).toBe(403);
    expect((await post(good, { origin: null }, env)).status).toBe(403);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('answers the preflight for the site and says 405 for GET, 404 for another path', async () => {
    const pre = await post('', { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect((await post('', { method: 'GET' })).status).toBe(405);
    expect((await post(good, { path: '/other' })).status).toBe(404);
  });
  it('refuses with 503 when the secret or the database is missing (never accepts what it cannot check)', async () => {
    expect((await post(good, {}, mkEnv({ TURNSTILE_SECRET: '' }))).status).toBe(503);
    expect((await post(good, {}, mkEnv({ DB: undefined }))).status).toBe(503);
    expect((await post(good, {}, mkEnv({ STAMP_SECRET: '' }))).status).toBe(503);
    expect((await post(good, {}, { TURNSTILE_SECRET: 'x', DB: fakeDb() })).status).toBe(403);
  });
  it('refuses a body that is too large or not JSON', async () => {
    const env = mkEnv();
    expect((await post('x'.repeat(MAX_BODY + 1), {}, env)).status).toBe(413);
    expect((await post('not json', {}, env)).status).toBe(400);
    expect((await post('[1,2]', {}, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
});

describe('contact Worker: spam protection (BUGS N6)', () => {
  it('a filled hidden field gets the same answer as a person, but nothing is checked or stored', async () => {
    const env = mkEnv();
    const f = fakeFetch(true);
    const res = await post({ ...good, website: 'http://spam.test' }, { fetch: f }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(env.DB.runs).toHaveLength(0);
    expect(f.calls).toHaveLength(0);
  });
  it('a failed Turnstile check stores nothing and says so', async () => {
    const env = mkEnv();
    const res = await post(good, { fetch: fakeFetch(false) }, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ field: 'check' });
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a Turnstile network failure stores nothing', async () => {
    const env = mkEnv();
    const res = await post(good, { fetch: fakeFetch(true, { throws: true }) }, env);
    expect(res.status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a wrong field is answered with a plain message and the field name, and Turnstile is not asked', async () => {
    const env = mkEnv();
    const f = fakeFetch(true);
    const res = await post({ ...good, email: 'nope' }, { fetch: f }, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This email address does not look right.', field: 'email' });
    expect(f.calls).toHaveLength(0);
  });
  it('stops a fourth message from the same email in one hour (429)', async () => {
    const env = mkEnv({ DB: fakeDb({ byEmail: PER_EMAIL_HOUR }) });
    const res = await post(good, {}, env);
    expect(res.status).toBe(429);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('stops a flood from everybody (429)', async () => {
    const env = mkEnv({ DB: fakeDb({ all: ALL_HOUR }) });
    expect((await post(good, {}, env)).status).toBe(429);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('uses the optional limiter, keyed by the visitor address, and a limit hit gives 429', async () => {
    const keys: string[] = [];
    const env = mkEnv({ RATE_LIMITER: { limit: async ({ key }: any) => { keys.push(key); return { success: false }; } } });
    const res = await post(good, { headers: { 'CF-Connecting-IP': '203.0.113.9' } }, env);
    expect(res.status).toBe(429);
    expect(keys).toEqual(['203.0.113.9']);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a failing limiter does not stop a real message', async () => {
    const env = mkEnv({ RATE_LIMITER: { limit: async () => { throw new Error('down'); } } });
    expect((await post(good, {}, env)).status).toBe(200);
    expect(env.DB.runs).toHaveLength(1);
  });
});

describe('contact Worker: database errors', () => {
  it('a failed save answers 500 with a plain message and no message text', async () => {
    const env = mkEnv({ DB: fakeDb({ failInsert: true }) });
    const res = await post(good, {}, env);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toMatch(/write to us by email/);
    expect(text).not.toContain('Hello, I have a question');
  });
  it('a failed count answers 500 and stores nothing', async () => {
    const env = mkEnv({ DB: fakeDb({ failCount: true }) });
    expect((await post(good, {}, env)).status).toBe(500);
    expect(env.DB.runs).toHaveLength(0);
  });
});

describe('contact Worker files', () => {
  const read = (f: string) => readFileSync(new URL('../../../workers/contact/' + f, import.meta.url), 'utf8');
  it('the table has the columns the code writes, and no IP column', () => {
    const sql = read('schema.sql');
    for (const col of ['ts', 'name', 'email', 'subject', 'message', 'status']) expect(sql).toMatch(new RegExp(`\\b${col}\\b`));
    const code = sql.replace(/--.*$/gm, ''); // the comments may say that no IP is stored
    expect(code).not.toMatch(/\bip\b|ip_address|user_agent/i);
    expect(sql).toMatch(/IF NOT EXISTS/);
  });
  it('the code never reads or stores an IP address in the database', () => {
    const code = read('index.js') + read('lib.js');
    expect(code).not.toMatch(/INSERT[^;]*\bip\b/i);
    expect(code).not.toMatch(/remoteip/);
  });
  it('wrangler.toml names the secret and the database and keeps no secret value', () => {
    const t = readFileSync('tests/fixtures/shipped/workers/contact/wrangler.toml', 'utf8');
    expect(t).toMatch(/TURNSTILE_SECRET/);
    expect(t).toMatch(/binding = "DB"/);
    expect(t).toMatch(/SITE_ORIGIN = "https:\/\/YOUR-DOMAIN"/);
    expect(t).not.toMatch(/TURNSTILE_SECRET\s*=\s*"/);
  });
});

describe('contact Worker: the shared guard and the stamp (v0.72.0, BOT_PROTECTION Part 3a)', () => {
  it('GET /stamp gives a signed stamp for the contact form, with CORS for the site only', async () => {
    const res = await post('', { method: 'GET', path: '/stamp' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const { stamp } = await res.json();
    expect(stamp).toMatch(/^\d{13}\.[0-9a-f]{64}$/);
    expect(await checkStamp(STAMP_SECRET, stamp, Date.now() + 10_000, 'contact')).toEqual({ ok: true });
    expect((await checkStamp(STAMP_SECRET, stamp, Date.now() + 10_000, 'chat')).ok).toBe(false);
  });
  it('GET /stamp refuses another origin, no origin, other methods, a missing secret and the kill switch', async () => {
    expect((await post('', { method: 'GET', path: '/stamp', origin: 'https://evil.test' })).status).toBe(403);
    expect((await post('', { method: 'GET', path: '/stamp', origin: null })).status).toBe(403);
    expect((await post('', { method: 'POST', path: '/stamp' })).status).toBe(405);
    expect((await post('', { method: 'GET', path: '/stamp' }, mkEnv({ STAMP_SECRET: '' }))).status).toBe(503);
    const off = await post('', { method: 'GET', path: '/stamp' }, mkEnv({ CONTACT_OFF: 'true' }));
    expect(off.status).toBe(503);
    expect(off.headers.get('Retry-After')).toBe('600');
    const pre = await post('', { method: 'OPTIONS', path: '/stamp' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('GET');
  });
  it('a message without a stamp, with a forged stamp or with a stamp of another form gets 400 reload and stores nothing', async () => {
    const env = mkEnv();
    for (const stamp of [undefined, 'forged', await issueStamp(STAMP_SECRET, Date.now() - 10_000, 'chat')]) {
      const body: any = { ...good };
      if (stamp !== undefined) body.stamp = stamp;
      const res = await post(body, { noStamp: true }, env);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Please reload the page and try again.', reload: true });
    }
    expect(env.DB.runs).toHaveLength(0);
  });
  it('an old stamp (over 2 hours) says reload, so a person loses nothing', async () => {
    const env = mkEnv();
    const old = await issueStamp(STAMP_SECRET, Date.now() - 3 * 3600_000, 'contact');
    const res = await post({ ...good, stamp: old }, {}, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'This page is old. Please reload it and try again.', reload: true });
    expect(env.DB.runs).toHaveLength(0);
  });
  it('a form sent too fast gets the same answer as a person, but nothing is checked or stored', async () => {
    const env = mkEnv();
    const f = fakeFetch(true);
    const fast = await issueStamp(STAMP_SECRET, Date.now() - 200, 'contact');
    const res = await post({ ...good, stamp: fast }, { fetch: f }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(env.DB.runs).toHaveLength(0);
    expect(f.calls).toHaveLength(0);
  });
  it('plain text, an extra field and a field that is too long are refused before anything is stored', async () => {
    const env = mkEnv();
    expect((await post(good, { headers: { 'Content-Type': 'text/plain' } }, env)).status).toBe(415);
    expect((await post({ ...good, admin: true }, {}, env)).status).toBe(400);
    const long = await post({ ...good, message: 'x'.repeat(LIMITS.message + 1) }, {}, env);
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({ error: 'Please check the field: message', field: 'message' });
    expect(env.DB.runs).toHaveLength(0);
  });
  it('the kill switch CONTACT_OFF stops messages with 503 and Retry-After', async () => {
    const env = mkEnv({ CONTACT_OFF: 'on' });
    const res = await post(good, {}, env);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect(env.DB.runs).toHaveLength(0);
    expect((await post(good, {}, mkEnv({ CONTACT_OFF: 'false' }))).status).toBe(200);
  });
  it('a long message in Bengali is not refused as too large', async () => {
    const env = mkEnv();
    const res = await post({ ...good, message: 'আমি একটি প্রশ্ন করতে চাই। '.repeat(150) }, {}, env);
    expect(res.status).toBe(200);
    expect(env.DB.runs).toHaveLength(1);
  });
  it('the Worker file uses the shared guard and still has no console', () => {
    const src = readFileSync(new URL('../../../workers/contact/index.js', import.meta.url), 'utf8');
    expect(src).toMatch(/from '\.\.\/shared\/guard\.js'/);
    expect(src).not.toMatch(/console\./);
  });
});
