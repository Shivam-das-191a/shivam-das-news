import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker
import worker, { rateWait, MAX_REQUEST_CHARS, DEFAULT_CALLS_PER_MINUTE } from '../../../workers/images/index.js';
// @ts-ignore plain JS Worker code
import { toBase64, fetchPictures, MAX_TOTAL_BYTES } from '../../../workers/images/lib.js';

const SITE = 'https://news.test';
const enc = (s: string) => new TextEncoder().encode(s);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(40).fill(7)]);
const PNG = Uint8Array.from([0x89, ...enc('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(30).fill(9)]);
let n = 0;
const fresh = () => `ghp_token_${++n}_abcdefghij`; // a new token and a new login for every test, so the 60 second memories never meet

/** A fake internet: GitHub (token -> login), DNS over HTTPS, and pictures. */
function net(o: { logins?: Record<string, string>; dns?: Record<string, string[]>; pictures?: Record<string, () => Response> } = {}) {
  const calls: { url: string; init: any }[] = [];
  const fn = async (url: string, init: any = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/user') {
      const tok = /^Bearer (.+)$/.exec(init.headers?.Authorization || '')?.[1] || '';
      const login = o.logins?.[tok];
      return login ? new Response(JSON.stringify({ login }), { status: 200 }) : new Response('{}', { status: 401 });
    }
    if (url.startsWith('https://cloudflare-dns.com/dns-query')) {
      const u = new URL(url);
      const ips = (o.dns ?? {})[u.searchParams.get('name')!] ?? ['93.184.216.34'];
      const want = u.searchParams.get('type') === 'AAAA';
      const Answer = ips.filter((ip) => ip.includes(':') === want).map((data) => ({ type: want ? 28 : 1, data }));
      return new Response(JSON.stringify({ Status: 0, Answer }));
    }
    const p = o.pictures?.[url];
    if (!p) throw new Error('no route');
    return p();
  };
  return { fn, calls, pics: () => calls.filter((c) => !c.url.startsWith('https://api.github.com') && !c.url.startsWith('https://cloudflare-dns.com')) };
}

const env = (extra: any = {}) => ({ SITE_ORIGIN: SITE, ALLOWED_USERS: 'Asha-Roy', CALLS_PER_MINUTE: '1000', ...extra });
function call(o: { body?: any; raw?: string; method?: string; path?: string; token?: string; origin?: string | null; secret?: string; ctype?: string | null; extra?: Record<string, string> } = {}) {
  const h: Record<string, string> = { ...(o.extra || {}) };
  if (o.ctype !== null) h['Content-Type'] = o.ctype ?? 'application/json';
  if (o.origin !== null) h.Origin = o.origin ?? SITE;
  if (o.token) h.Authorization = `Bearer ${o.token}`;
  if (o.secret !== undefined) h['X-Images-Secret'] = o.secret;
  const method = o.method ?? 'POST';
  return new Request('https://images.test' + (o.path ?? '/fetch'), { method, headers: h, body: method === 'POST' ? (o.raw ?? JSON.stringify(o.body ?? { urls: ['https://other.com/a.jpg'] })) : undefined });
}
const run = (req: Request, e: any, nf: any) => worker.fetch(req, e, {}, nf.fn);
const A = 'https://other.com/a.jpg';

describe('the answer to a good call', () => {
  it('returns the picture as base64 bytes with its kind, size and final address', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' }, pictures: { [A]: () => new Response(JPG), 'https://other.com/b.png': () => new Response(PNG) } });
    const res = await run(call({ token: tok, body: { urls: [A, 'https://other.com/b.png'] } }), env(), nf);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const body: any = await res.json();
    expect(body.results.map((r: any) => [r.url, r.ok, r.kind, r.size, r.hops])).toEqual([[A, true, 'jpg', JPG.length, 0], ['https://other.com/b.png', true, 'png', PNG.length, 0]]);
    expect(Array.from(Uint8Array.from(atob(body.results[0].data), (c) => c.charCodeAt(0)))).toEqual(Array.from(JPG));
    expect(body.results[0].finalUrl).toBe(A);
    expect(JSON.stringify(body)).not.toMatch(/"bytes"/);
  });
  it('answers a failed picture with a reason word and no data, and does not stop the others', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' }, pictures: { [A]: () => new Response(JPG), 'https://other.com/gone.jpg': () => new Response('x', { status: 404 }), 'https://other.com/t.jpg': () => new Response(enc('plain text, not a picture')) } });
    const res = await run(call({ token: tok, body: { urls: [A, 'https://other.com/gone.jpg', 'https://other.com/t.jpg', 'http://other.com/h.jpg', 'https://localhost/x.jpg'] } }), env(), nf);
    const body: any = await res.json();
    expect(body.results.map((r: any) => [r.ok, r.reason])).toEqual([[true, undefined], [false, 'not_found'], [false, 'not_image'], [false, 'not_https'], [false, 'private_host']]);
    expect(body.results[1]).toMatchObject({ status: 404 });
    expect(body.results.slice(1).every((r: any) => !('data' in r))).toBe(true);
  });
  it('sends our own origin as the only referrer and looks the host name up', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' }, pictures: { [A]: () => new Response(JPG) } });
    await run(call({ token: tok }), env(), nf);
    expect(nf.pics()).toHaveLength(1);
    expect(nf.pics()[0].init.headers.referer).toBe(SITE);
    expect(nf.calls.some((c) => c.url.includes('cloudflare-dns.com') && c.url.includes('name=other.com'))).toBe(true);
  });
  it('refuses a host name that points to a private address and never requests the picture', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' }, dns: { 'other.com': ['10.0.0.8'] }, pictures: { [A]: () => new Response(JPG) } });
    const body: any = await (await run(call({ token: tok }), env(), nf)).json();
    expect(body.results[0]).toMatchObject({ ok: false, reason: 'private_host' });
    expect(nf.pics()).toHaveLength(0);
  });
  it('refuses a host the owner blocked', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' }, pictures: { [A]: () => new Response(JPG) } });
    const body: any = await (await run(call({ token: tok }), env({ BLOCK_HOSTS: 'Other.com' }), nf)).json();
    expect(body.results[0]).toMatchObject({ ok: false, reason: 'blocked_host' });
    expect(nf.pics()).toHaveLength(0);
  });
});

describe('who may call', () => {
  it('a signed-in allowed user (any letter case) from the site itself', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'Asha-ROY' }, pictures: { [A]: () => new Response(JPG) } });
    expect((await run(call({ token: tok }), env({ ALLOWED_USERS: 'asha-roy, other-person' }), nf)).status).toBe(200);
  });
  it('401 without a token, with a bad token and with a token GitHub refuses', async () => {
    const nf = net({ logins: {} });
    expect((await run(call({}), env(), nf)).status).toBe(401);
    expect((await run(call({ token: 'bad token!' }), env(), nf)).status).toBe(401);
    expect((await run(call({ token: fresh() }), env(), nf)).status).toBe(401);
  });
  it('403 for a GitHub user who is not on the list', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'someone-else' } });
    expect((await run(call({ token: tok }), env(), nf)).status).toBe(403);
    expect(nf.pics()).toHaveLength(0);
  });
  it('403 from another website or with no Origin, before GitHub is asked', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' } });
    expect((await run(call({ token: tok, origin: 'https://evil.test' }), env(), nf)).status).toBe(403);
    expect((await run(call({ token: tok, origin: null }), env(), nf)).status).toBe(403);
    expect((await run(call({ token: tok }), env({ SITE_ORIGIN: '' }), nf)).status).toBe(403);
    expect(nf.calls).toHaveLength(0);
  });
  it('503 when no user is allowed and there is no secret', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' } });
    expect((await run(call({ token: tok }), env({ ALLOWED_USERS: '' }), nf)).status).toBe(503);
    expect((await run(call({ token: tok }), env({ ALLOWED_USERS: undefined }), nf)).status).toBe(503);
  });
  it('the Action: the right secret needs no Origin and no GitHub login; a wrong one is 401', async () => {
    const nf = net({ pictures: { [A]: () => new Response(JPG) } });
    const e = env({ IMAGES_SECRET: 'long-secret-value-for-the-action', ALLOWED_USERS: '' });
    const good = await run(call({ secret: 'long-secret-value-for-the-action', origin: null }), e, nf);
    expect(good.status).toBe(200);
    expect(nf.calls.some((c) => c.url.includes('api.github.com'))).toBe(false);
    expect((await run(call({ secret: 'long-secret-value-for-the-actioN', origin: null }), e, nf)).status).toBe(401);
    expect((await run(call({ secret: '', origin: null }), e, nf)).status).toBe(401);
    expect((await run(call({ secret: 'anything', origin: null }), env({ ALLOWED_USERS: 'asha-roy' }), nf)).status).toBe(401);
  });
  it('a secret header with a good login does not let a wrong secret through', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' } });
    expect((await run(call({ token: tok, secret: 'wrong' }), env({ IMAGES_SECRET: 'right-secret-right-secret' }), nf)).status).toBe(401);
  });
});

describe('the front of the Worker', () => {
  it('404 on any other path, 405 on GET with Allow', async () => {
    const nf = net();
    expect((await run(call({ path: '/other' }), env(), nf)).status).toBe(404);
    const g = await run(call({ method: 'GET' }), env(), nf);
    expect(g.status).toBe(405);
    expect(g.headers.get('Allow')).toBe('POST, OPTIONS');
  });
  it('answers the preflight for the site only', async () => {
    const nf = net();
    const ok = await run(call({ method: 'OPTIONS' }), env(), nf);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('POST');
    expect(ok.headers.get('Access-Control-Allow-Headers')).toMatch(/Authorization/);
    const bad = await run(call({ method: 'OPTIONS', origin: 'https://evil.test' }), env(), nf);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('the kill switch answers 503 with Retry-After before anything else', async () => {
    const nf = net();
    for (const v of ['true', '1', 'YES', 'on']) {
      const r = await run(call({}), env({ IMAGES_OFF: v }), nf);
      expect(r.status).toBe(503);
      expect(r.headers.get('Retry-After')).toBe('600');
    }
    expect(nf.calls).toHaveLength(0);
  });
  it('415 for a body that is not JSON, 413 for a long one, 400 for bad JSON and for the wrong fields', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' } });
    const e = env();
    expect((await run(call({ token: tok, ctype: 'text/plain' }), e, nf)).status).toBe(415);
    expect((await run(call({ token: tok, ctype: null }), e, nf)).status).toBe(415);
    expect((await run(call({ token: tok, raw: JSON.stringify({ urls: ['https://other.com/' + 'a'.repeat(MAX_REQUEST_CHARS)] }) }), e, nf)).status).toBe(413);
    expect((await run(call({ token: tok, raw: '{not json' }), e, nf)).status).toBe(400);
    expect((await run(call({ token: tok, raw: '[]' }), e, nf)).status).toBe(400);
    expect((await run(call({ token: tok, raw: 'null' }), e, nf)).status).toBe(400);
    expect((await run(call({ token: tok, body: {} }), e, nf)).status).toBe(400);
    expect((await run(call({ token: tok, body: { urls: [A], extra: 1 } }), e, nf)).status).toBe(400);
    expect((await run(call({ token: tok, body: { url: A } }), e, nf)).status).toBe(400);
  });
  it('the list: 400 for empty or not text, 413 for 31, nothing is requested', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: 'asha-roy' } });
    const e = env();
    const empty = await run(call({ token: tok, body: { urls: [] } }), e, nf);
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as any).reason).toBe('empty');
    expect(((await (await run(call({ token: tok, body: { urls: 'x' } }), e, nf)).json()) as any).reason).toBe('bad_list');
    expect((await run(call({ token: tok, body: { urls: [A, 5] } }), e, nf)).status).toBe(400);
    const many = await run(call({ token: tok, body: { urls: Array.from({ length: 31 }, (_, i) => `https://other.com/${i}.jpg`) } }), e, nf);
    expect(many.status).toBe(413);
    expect(((await many.json()) as any).reason).toBe('too_many');
    expect(nf.pics()).toHaveLength(0);
  });
});

describe('the rate limit', () => {
  it('rateWait lets the limit through, then says how long to wait, then lets go after a minute', () => {
    const who = `unit-${++n}`;
    expect(rateWait(who, 1000, 2)).toBe(0);
    expect(rateWait(who, 2000, 2)).toBe(0);
    expect(rateWait(who, 3000, 2)).toBe(58);
    expect(rateWait(who, 60999, 2)).toBe(1);
    expect(rateWait(who, 61001, 2)).toBe(0);
    expect(DEFAULT_CALLS_PER_MINUTE).toBe(20);
  });
  it('a person who goes over the limit gets 429 with Retry-After; another person is not slowed', async () => {
    const t1 = fresh(), t2 = fresh();
    const l1 = `limit-a-${n}`, l2 = `limit-b-${n}`; // the limiter keys on the login, so each test uses logins of its own
    const nf2 = net({ logins: { [t1]: l1, [t2]: l2 }, pictures: { [A]: () => new Response(JPG) } });
    const e2 = env({ CALLS_PER_MINUTE: '2', ALLOWED_USERS: `${l1},${l2}` });
    expect((await run(call({ token: t1 }), e2, nf2)).status).toBe(200);
    expect((await run(call({ token: t1 }), e2, nf2)).status).toBe(200);
    const third = await run(call({ token: t1 }), e2, nf2);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await run(call({ token: t2 }), e2, nf2)).status).toBe(200);
  });
  it('a bad CALLS_PER_MINUTE falls back to the default', async () => {
    const tok = fresh();
    const nf = net({ logins: { [tok]: `limit-c-${n}` }, pictures: { [A]: () => new Response(JPG) } });
    const e = env({ CALLS_PER_MINUTE: 'abc', ALLOWED_USERS: `limit-c-${n}` });
    for (let i = 0; i < DEFAULT_CALLS_PER_MINUTE; i++) expect((await run(call({ token: tok }), e, nf)).status).toBe(200);
    expect((await run(call({ token: tok }), e, nf)).status).toBe(429);
  });
  it('a refused caller does not use up the limit', async () => {
    const nf = net({ logins: {} });
    for (let i = 0; i < 30; i++) await run(call({}), env({ CALLS_PER_MINUTE: '1' }), nf);
    const tok = fresh();
    const nf2 = net({ logins: { [tok]: `limit-d-${n}` }, pictures: { [A]: () => new Response(JPG) } });
    expect((await run(call({ token: tok }), env({ CALLS_PER_MINUTE: '1', ALLOWED_USERS: `limit-d-${n}` }), nf2)).status).toBe(200);
  });
});

describe('the total size of one call and base64', () => {
  it('toBase64 matches btoa for small and large input', () => {
    expect(toBase64(enc('hello'))).toBe(btoa('hello'));
    expect(toBase64(new Uint8Array(0))).toBe('');
    const big = new Uint8Array(200000).map((_, i) => i % 251);
    const back = Uint8Array.from(atob(toBase64(big)), (c) => c.charCodeAt(0));
    expect(back.length).toBe(big.length);
    expect(back[199999]).toBe(big[199999]);
    expect(back[12345]).toBe(big[12345]);
  });
  it('a picture that does not fit in the total of the call answers call_too_big and its bytes are dropped', async () => {
    const f = async (url: string) => new Response(JPG);
    const r = await fetchPictures(['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg'], { fetch: f, maxTotalBytes: JPG.length * 2, concurrency: 1 });
    expect(r.results.map((x: any) => [x.ok, x.reason])).toEqual([[true, undefined], [true, undefined], [false, 'call_too_big']]);
    expect('bytes' in r.results[2]).toBe(false);
    expect(MAX_TOTAL_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('the files of the Worker', () => {
  const toml = readFileSync(new URL('../../../workers/images/wrangler.toml', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../../../workers/images/index.js', import.meta.url), 'utf8');
  it('wrangler.toml names the Worker, keeps the kill switch off and writes no secret', () => {
    expect(toml).toMatch(/^name = "news-images"$/m);
    expect(toml).toMatch(/^main = "index\.js"$/m);
    expect(toml).toMatch(/^IMAGES_OFF = "false"/m);
    expect(toml).toMatch(/^SITE_ORIGIN = "https:\/\/[^"\/]+"/m);
    expect(toml).not.toMatch(/^\s*IMAGES_SECRET\s*=/m);
    expect(toml).not.toMatch(/ghp_|github_pat_|BEGIN/);
    expect(toml).toMatch(/NOT DEPLOYED YET/);
  });
  it('index.js stores nothing, logs nothing and reads no database', () => {
    expect(src).not.toMatch(/console\.|env\.DB|\.put\(|KV|R2|waitUntil/);
    expect(src).toMatch(/from '\.\.\/shared\/guard\.js'/);
  });
});
