import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { makeFetchPictures, imagesUrl, MAX_URLS } from '../../public/admin/js/hosting-client.js';
// @ts-ignore plain JS module
import { hostPost, explain, REASON_WORDS, WORKER_BATCH } from '../../public/admin/js/hosting-run.js';
// @ts-ignore plain JS Worker
import worker from '../../../workers/images/index.js';
// @ts-ignore plain JS Worker code
import { toBase64, MAX_PER_CALL } from '../../../workers/images/lib.js';

afterEach(() => { vi.restoreAllMocks(); });

const EP = 'https://news-images.name.workers.dev';
const TOKEN = 'ghp_abcdefghijklmnop1234';
const reply = (status: number, body: any = {}, headers: Record<string, string> = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const make = (f: any, extra: any = {}) => makeFetchPictures({ endpoint: EP, token: TOKEN, fetch: f, ...extra });

describe('imagesUrl: the exact address that is called', () => {
  it('accepts the Worker address with or without a slash or /fetch', () => {
    for (const e of [EP, EP + '/', EP + '/fetch', EP + '/fetch/', '  ' + EP + '  ', 'https://news-images.name.workers.dev:443']) expect(imagesUrl(e)).toBe(EP + '/fetch');
    expect(imagesUrl('https://images.example.com:8443/')).toBe('https://images.example.com:8443/fetch');
  });
  it('refuses http, user names, queries, other paths and text that is not an address', () => {
    for (const e of ['http://news-images.name.workers.dev', 'ftp://x.com', 'https://u:p@x.com', 'https://x.com?a=1', 'https://x.com/#h', 'https://x.com/other', 'https://x.com/fetch/more', 'not an address', '', undefined, null, 5])
      expect(() => imagesUrl(e as any), String(e)).toThrow(/picture service/);
    expect(() => imagesUrl('http://x.com')).toThrow('The picture service must use https.');
  });
});

describe('the request', () => {
  it('sends POST /fetch with the token, JSON, no cookies, no referrer, no cache', async () => {
    const f = vi.fn(async () => reply(200, { results: [] }));
    await make(f)(['https://other.com/a.jpg', 'https://other.com/b.png']);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe(EP + '/fetch');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ urls: ['https://other.com/a.jpg', 'https://other.com/b.png'] });
    expect(Object.keys(JSON.parse(init.body))).toEqual(['urls']);
    expect(init.credentials).toBe('omit');
    expect(init.cache).toBe('no-store');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('returns the results of a good answer as they are', async () => {
    const results = [{ url: 'u', ok: true, kind: 'jpg', size: 3, data: 'AAEC' }, { url: 'v', ok: false, reason: 'not_found' }];
    expect(await make(async () => reply(200, { results }))(['u', 'v'])).toEqual({ ok: true, results });
  });
  it('the limit of one call equals the limit of hostPost and of the Worker', () => {
    expect(MAX_URLS).toBe(WORKER_BATCH);
    expect(MAX_URLS).toBe(MAX_PER_CALL);
  });
});

describe('refusals before any request', () => {
  const never = () => vi.fn(async () => reply(200, { results: [] }));
  it('a bad list of addresses', async () => {
    const f = never();
    for (const u of [[], undefined, null, 'https://a.com/x.jpg', [''], [5], ['https://a.com/x.jpg', null], new Array(MAX_URLS + 1).fill('https://a.com/x.jpg')]) expect(await make(f)(u as any)).toEqual({ ok: false, reason: 'worker_failed', text: 'The picture service did not answer. Press Retry.' });
    expect(await make(f)(new Array(MAX_URLS).fill('https://a.com/x.jpg'))).toMatchObject({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('no token or a token of a shape the Worker would refuse: sign_in', async () => {
    const f = never();
    for (const t of [undefined, null, '', 'short', 'has space in it 123', 'x'.repeat(256), 'tok\nen_abcdefghij', 5])
      expect(await makeFetchPictures({ endpoint: EP, token: t as any, fetch: f })(['u'])).toEqual({ ok: false, reason: 'sign_in', text: 'Sign in to the dashboard again, then press Retry.' });
    expect(f).not.toHaveBeenCalled();
  });
  it('no or a bad Worker address: worker_off', async () => {
    const f = never();
    for (const e of [undefined, '', 'http://x.com', 'nonsense', 'https://u:p@x.com']) expect(await makeFetchPictures({ endpoint: e as any, token: TOKEN, fetch: f })(['u'])).toMatchObject({ ok: false, reason: 'worker_off' });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('every way of failing becomes a reason word and a plain sentence', () => {
  const status = async (s: number, headers: Record<string, string> = {}) => make(async () => reply(s, { error: 'x' }, headers))(['u']);
  it('401 sign_in, 403 not_allowed, 413 call_too_big, 503 worker_off', async () => {
    expect(await status(401)).toEqual({ ok: false, reason: 'sign_in', text: 'Sign in to the dashboard again, then press Retry.' });
    expect(await status(403)).toEqual({ ok: false, reason: 'not_allowed', text: 'This account may not use the picture service.' });
    expect(await status(413)).toEqual({ ok: false, reason: 'call_too_big', text: 'Too many large pictures at once. Press Retry.' });
    expect(await status(503)).toEqual({ ok: false, reason: 'worker_off', text: 'The picture service is switched off or not ready. Try again later.' });
  });
  it('429 rate_limited, with the wait of Retry-After when it is a number', async () => {
    expect(await status(429, { 'Retry-After': '17' })).toEqual({ ok: false, reason: 'rate_limited', text: 'Too many pictures in one minute. Wait 17 seconds, then press Retry.' });
    expect((await status(429, { 'Retry-After': '1' })).text).toBe('Too many pictures in one minute. Wait 1 second, then press Retry.');
    expect((await status(429, { 'Retry-After': '2.2' })).text).toContain('Wait 3 seconds');
    expect((await status(429, { 'Retry-After': '99999' })).text).toContain('Wait 600 seconds');
    for (const h of [{}, { 'Retry-After': 'soon' }, { 'Retry-After': '0' }, { 'Retry-After': '-4' }]) expect((await status(429, h)).text).toBe('Too many pictures in one minute. Wait a moment, then press Retry.');
  });
  it('400, 404, 405, 415, 500 and 502 are worker_failed', async () => {
    for (const s of [400, 404, 405, 415, 500, 502]) expect(await status(s), String(s)).toEqual({ ok: false, reason: 'worker_failed', text: 'The picture service did not answer. Press Retry.' });
  });
  it('a 200 that is not JSON, or has no list of results, is worker_failed', async () => {
    for (const body of ['<html>', '', '[]', '{}', '{"results":"x"}', '{"results":null}', 'null']) expect(await make(async () => reply(200, body))(['u']), body).toMatchObject({ ok: false, reason: 'worker_failed' });
  });
  it('a network error is worker_failed and its text (it could hold the token) is never passed on', async () => {
    const r = await make(async () => { throw new TypeError(`Failed to fetch ${EP}/fetch with ${TOKEN}`); })(['u']);
    expect(r).toEqual({ ok: false, reason: 'worker_failed', text: 'The picture service did not answer. Press Retry.' });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });
  it('a call that takes too long is stopped and is worker_failed; the timer is cleared', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const slow = (_u: string, init: any) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    expect(await make(slow, { timeoutMs: 20 })(['u'])).toMatchObject({ ok: false, reason: 'worker_failed' });
    expect(clear).toHaveBeenCalled();
  });
  it('the default time limit is 120 seconds, and timeoutMs changes it', async () => {
    const set = vi.spyOn(globalThis, 'setTimeout');
    await make(async () => reply(200, { results: [] }))(['u']);
    await make(async () => reply(200, { results: [] }), { timeoutMs: 5000 })(['u']);
    await make(async () => reply(200, { results: [] }), { timeoutMs: -1 })(['u']);
    const ms = set.mock.calls.map((c) => c[1]).filter((x) => x === 120000 || x === 5000 || x === -1);
    expect(ms).toEqual([120000, 5000, 120000]);
  });
  it('the token is in no answer, whatever the status', async () => {
    for (const s of [200, 401, 403, 413, 429, 500, 503]) expect(JSON.stringify(await make(async () => reply(s, { results: [], echo: 'x' }))(['u']))).not.toContain(TOKEN);
  });
  it('every reason word has a plain sentence in hosting-run.js, the same as the one given here', async () => {
    const same: Record<number, string> = { 401: 'sign_in', 403: 'not_allowed', 413: 'call_too_big', 503: 'worker_off', 500: 'worker_failed' };
    for (const [s, w] of Object.entries(same)) {
      expect(REASON_WORDS).toContain(w);
      expect((await status(Number(s))).text).toBe(explain(w));
    }
    expect(REASON_WORDS).toContain('rate_limited');
    expect(explain('rate_limited')).toBe('Too many pictures in one minute. Wait a moment, then press Retry.');
    expect((await status(429)).text).toBe(explain('rate_limited'));
  });
});

// ----- the real Worker behind a fake network -----
const SITE = 'https://shivam-das-news.pages.dev';
const enc = (s: string) => new TextEncoder().encode(s);
const JPG = (n: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(n)]);
let seq = 0;
function world(o: { logins?: Record<string, string>; pictures?: Record<string, Uint8Array> } = {}, env: any = {}) {
  const e = { SITE_ORIGIN: SITE, ALLOWED_USERS: 'Asha-Roy', CALLS_PER_MINUTE: '1000', ...env };
  const workerCalls: { auth: string | null; origin: string | null; body: any }[] = [];
  const internet = async (url: string, init: any = {}) => {
    if (url === 'https://api.github.com/user') { const t = /^Bearer (.+)$/.exec(init.headers?.Authorization || '')?.[1] || ''; const login = o.logins?.[t]; return login ? new Response(JSON.stringify({ login }), { status: 200 }) : new Response('{}', { status: 401 }); }
    if (url.startsWith('https://cloudflare-dns.com/dns-query')) { const want = new URL(url).searchParams.get('type') === 'AAAA'; return new Response(JSON.stringify({ Status: 0, Answer: want ? [] : [{ type: 1, data: '93.184.216.34' }] })); }
    const p = o.pictures?.[url];
    if (!p) return new Response('nope', { status: 404 });
    return new Response(p);
  };
  // the browser adds Origin itself; the client calls this like fetch
  const browserFetch = async (url: string, init: any) => {
    const headers = { ...init.headers, Origin: SITE };
    workerCalls.push({ auth: headers.Authorization, origin: headers.Origin, body: JSON.parse(init.body) });
    return worker.fetch(new Request(url, { method: init.method, headers, body: init.body }), e, {}, internet);
  };
  return { browserFetch, workerCalls };
}
const fresh = () => { seq++; return { token: `ghp_realworker_token_${seq}_abcdef`, login: `asha-roy` }; };
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' };
const NOW = new Date('2026-11-17T01:02:03.456Z');
const optimize = async (b: Uint8Array) => ({ bytes: b.slice(0, 20), ext: 'webp', width: 1600, height: 900 });

describe('with the real Worker code and hostPost', () => {
  it('a signed-in allowed user: the pictures come back, are hosted and the post is rewritten', async () => {
    const { token, login } = fresh();
    const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg';
    const w = world({ logins: { [token]: login }, pictures: { [A]: JPG(1), [B]: JPG(2) } });
    const r = await hostPost({ ...POST, body: `![First picture here](${A})\n\n![Second picture here](${B})` }, { fetchPictures: makeFetchPictures({ endpoint: EP, token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items.map((i: any) => i.status)).toEqual(['hosted', 'hosted']);
    expect(r.files).toHaveLength(2);
    expect(r.post.body).not.toContain('other.com');
    expect(w.workerCalls).toHaveLength(1);
    expect(w.workerCalls[0].auth).toBe(`Bearer ${token}`);
    expect(w.workerCalls[0].body).toEqual({ urls: [A, B] });
  });
  it('a login that is not on the list: every picture fails with not_allowed and the post does not change', async () => {
    const { token } = fresh();
    const A = 'https://other.com/a.jpg';
    const w = world({ logins: { [token]: 'someone-else' }, pictures: { [A]: JPG(1) } });
    const body = `![First picture here](${A})`;
    const r = await hostPost({ ...POST, body }, { fetchPictures: makeFetchPictures({ endpoint: EP, token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0]).toMatchObject({ status: 'failed', reason: 'not_allowed', text: 'This account may not use the picture service.' });
    expect(r.post.body).toBe(body);
    expect(r.changed).toBe(false);
    expect(r.summary.retry).toEqual([A]);
  });
  it('a token GitHub does not know: sign_in', async () => {
    const A = 'https://other.com/a.jpg';
    const w = world({ logins: {}, pictures: { [A]: JPG(1) } });
    const r = await hostPost({ ...POST, body: `![First picture here](${A})` }, { fetchPictures: makeFetchPictures({ endpoint: EP, token: fresh().token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0]).toMatchObject({ status: 'failed', reason: 'sign_in' });
  });
  it('the kill switch of the Worker: worker_off, and nothing is hosted', async () => {
    const { token, login } = fresh();
    const A = 'https://other.com/a.jpg';
    const w = world({ logins: { [token]: login }, pictures: { [A]: JPG(1) } }, { IMAGES_OFF: 'true' });
    const r = await hostPost({ ...POST, body: `![First picture here](${A})` }, { fetchPictures: makeFetchPictures({ endpoint: EP, token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0]).toMatchObject({ status: 'failed', reason: 'worker_off' });
    expect(r.files).toEqual([]);
  });
  it('the rate limit of the Worker: the second group is rate_limited and Retry lists it', async () => {
    const { token } = fresh();
    const login = `rate-${seq}`;
    const pics: Record<string, Uint8Array> = {};
    const urls = Array.from({ length: 31 }, (_, i) => { const u = `https://other.com/p${i}.jpg`; pics[u] = JPG(i); return u; });
    const w = world({ logins: { [token]: login }, pictures: pics }, { ALLOWED_USERS: login, CALLS_PER_MINUTE: '1' });
    const body = urls.map((u, i) => `![Picture number ${i}](${u})`).join('\n\n');
    const r = await hostPost({ ...POST, body }, { fetchPictures: makeFetchPictures({ endpoint: EP, token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(w.workerCalls.map((c) => c.body.urls.length)).toEqual([30, 1]);
    expect(r.items.filter((i: any) => i.status === 'hosted')).toHaveLength(30);
    expect(r.items[30]).toMatchObject({ status: 'failed', reason: 'rate_limited' });
    expect(r.summary.retry).toEqual([urls[30]]);
  });
  it('a picture that is gone stays in the post, the others are hosted', async () => {
    const { token, login } = fresh();
    const A = 'https://other.com/a.jpg', G = 'https://other.com/gone.jpg';
    const w = world({ logins: { [token]: login }, pictures: { [A]: JPG(1) } });
    const r = await hostPost({ ...POST, body: `![First picture here](${A})\n\n![A gone picture](${G})` }, { fetchPictures: makeFetchPictures({ endpoint: EP, token, fetch: w.browserFetch }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items.map((i: any) => [i.status, i.reason])).toEqual([['hosted', undefined], ['failed', 'not_found']]);
    expect(r.post.body).toContain(G);
  });
});
