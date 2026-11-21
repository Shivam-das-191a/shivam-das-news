import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker code
import * as L from '../../../workers/push/livecheck.js';
// @ts-ignore plain JS Worker code
import * as A from '../../../workers/push/announce.js';

const SITE = 'https://news.test';
const NOW = Date.parse('2026-11-16T10:00:00Z');
const URL1 = `${SITE}/2026/11/16/blogs/tech/phone-launch/`;

const page = (head = '', body = '<p>Hello</p>') => `<!doctype html><html><head><title>x</title>${head}</head><body>${body}</body></html>`;
const html = (text: string, init: ResponseInit = {}) => new Response(text, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, ...init });

describe('robotsBlocks', () => {
  it('noindex and none block, in any letter case', () => {
    for (const v of ['noindex', 'NOINDEX', 'none', 'None', 'noindex, nofollow', 'index, noindex', ' noindex ']) expect(L.robotsBlocks(v), v).toBe(true);
  });
  it('index, follow and other directives do not block', () => {
    for (const v of ['index, follow', 'nofollow', 'max-image-preview:large', 'max-snippet:-1, index', 'unavailable_after: 25 Jun 2030 15:00:00 PST', '', 'all']) expect(L.robotsBlocks(v), v).toBe(false);
  });
  it('a directive for googlebot blocks, one for another robot does not', () => {
    expect(L.robotsBlocks('googlebot: noindex')).toBe(true);
    expect(L.robotsBlocks('bingbot: noindex')).toBe(false);
    expect(L.robotsBlocks('otherbot: noindex, googlebot: index')).toBe(false);
  });
  it('anything that is not text is not a block', () => {
    for (const v of [undefined, null, 5, {}, []]) expect(L.robotsBlocks(v as any)).toBe(false);
  });
});

describe('metaRobots', () => {
  it('finds robots and googlebot tags with any attribute order and quote style', () => {
    const h = page('<meta name="robots" content="noindex"><META CONTENT=\'none\' NAME=\'googlebot\'><meta content=index name=robots>');
    expect(L.metaRobots(h)).toEqual(['noindex', 'none', 'index']);
  });
  it('ignores other meta tags', () => {
    expect(L.metaRobots(page('<meta name="description" content="noindex"><meta property="og:title" content="noindex">'))).toEqual([]);
  });
  it('reads only the head', () => {
    expect(L.metaRobots(page('', '<meta name="robots" content="noindex">'))).toEqual([]);
  });
  it('a page with no end of head is read as a whole, and a non-text input gives nothing', () => {
    expect(L.metaRobots('<meta name="robots" content="noindex">')).toEqual(['noindex']);
    expect(L.metaRobots(undefined as any)).toEqual([]);
  });
});

describe('judge', () => {
  const ok = { status: 200, contentType: 'text/html; charset=utf-8', xRobots: '', html: page() };
  it('a 200 HTML page with no block is live', () => {
    expect(L.judge(ok)).toEqual({ ok: true });
    expect(L.judge({ ...ok, contentType: 'application/xhtml+xml' })).toEqual({ ok: true });
  });
  it('every status other than 200 is not live', () => {
    for (const status of [201, 204, 301, 302, 304, 404, 410, 429, 500, 503]) expect(L.judge({ ...ok, status }), String(status)).toEqual({ ok: false, reason: 'not_live' });
  });
  it('a page that is not HTML is not live', () => {
    for (const contentType of ['application/json', 'text/plain', 'image/png', '']) expect(L.judge({ ...ok, contentType }), contentType).toEqual({ ok: false, reason: 'not_live' });
  });
  it('noindex in the header or in a meta tag is noindex', () => {
    expect(L.judge({ ...ok, xRobots: 'noindex' })).toEqual({ ok: false, reason: 'noindex' });
    expect(L.judge({ ...ok, html: page('<meta name="robots" content="noindex, follow">') })).toEqual({ ok: false, reason: 'noindex' });
    expect(L.judge({ ...ok, html: page('<meta name="googlebot" content="none">') })).toEqual({ ok: false, reason: 'noindex' });
  });
  it('an index tag stays live', () => {
    expect(L.judge({ ...ok, html: page('<meta name="robots" content="index, follow, max-image-preview:large">') })).toEqual({ ok: true });
  });
  it('a missing page object is not live', () => {
    expect(L.judge(null as any)).toEqual({ ok: false, reason: 'not_live' });
  });
  it('every reason is one the announce list knows', () => {
    for (const r of L.LIVE_REASONS) expect(A.REASONS).toContain(r);
  });
});

describe('liveCheck', () => {
  it('opens the address with GET, no redirect following, a plain agent name and a timeout signal', async () => {
    const calls: any[] = [];
    const f = async (url: string, init: any) => { calls.push({ url, init }); return html(page()); };
    expect(await L.liveCheck(URL1, f)).toEqual({ ok: true });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe(URL1);
    expect(calls[0].init).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect(calls[0].init.headers['User-Agent']).toBe(L.LIVE_AGENT);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
  it('404 and 410 are not live, and the body is stopped without reading it', async () => {
    for (const status of [404, 410, 500]) {
      let cancelled = false;
      const f = async () => ({ status, headers: new Headers({ 'Content-Type': 'text/html' }), body: { cancel: async () => { cancelled = true; } } });
      expect(await L.liveCheck(URL1, f), String(status)).toEqual({ ok: false, reason: 'not_live' });
      expect(cancelled).toBe(true);
    }
  });
  it('a redirect is not followed and is not live', async () => {
    let n = 0;
    const f = async () => { n++; return new Response(null, { status: 301, headers: { Location: `${SITE}/new/` } }); };
    expect(await L.liveCheck(URL1, f)).toEqual({ ok: false, reason: 'not_live' });
    expect(n).toBe(1);
  });
  it('noindex in the header is found without reading the page', async () => {
    let read = false;
    const f = async () => ({ status: 200, headers: new Headers({ 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex' }), body: { cancel: async () => {}, getReader() { read = true; throw new Error('must not read'); } } });
    expect(await L.liveCheck(URL1, f)).toEqual({ ok: false, reason: 'noindex' });
    expect(read).toBe(false);
  });
  it('noindex in a meta tag of the head is found', async () => {
    expect(await L.liveCheck(URL1, async () => html(page('<meta name="robots" content="noindex">')))).toEqual({ ok: false, reason: 'noindex' });
  });
  it('a noindex text in the body is not a block', async () => {
    expect(await L.liveCheck(URL1, async () => html(page('', '<meta name="robots" content="noindex">')))).toEqual({ ok: true });
  });
  it('stops reading at the end of the head and never reads a huge page', async () => {
    let chunks = 0;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      pull(c) {
        chunks++;
        c.enqueue(enc.encode(chunks === 1 ? '<html><head><title>x</title></head><body>' : 'x'.repeat(50000)));
        if (chunks > 100) c.close();
      },
    });
    const res = new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } });
    expect(await L.liveCheck(URL1, async () => res)).toEqual({ ok: true });
    expect(chunks).toBeLessThan(5);
  });
  it('a page with no end of head is read up to the byte limit only', async () => {
    let chunks = 0;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      pull(c) {
        chunks++;
        c.enqueue(enc.encode('y'.repeat(50000)));
        if (chunks > 1000) c.close();
      },
    });
    const res = new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } });
    expect(await L.liveCheck(URL1, async () => res)).toEqual({ ok: true });
    expect(chunks).toBeLessThanOrEqual(Math.ceil(L.LIVE_MAX_BYTES / 50000) + 2);
  });
  it('works with an answer that has no stream, only text()', async () => {
    const f = async () => ({ status: 200, headers: new Headers({ 'Content-Type': 'text/html' }), text: async () => page('<meta name="robots" content="noindex">') });
    expect(await L.liveCheck(URL1, f)).toEqual({ ok: false, reason: 'noindex' });
  });
  it('a network error is check_failed', async () => {
    expect(await L.liveCheck(URL1, async () => { throw new TypeError('network down'); })).toEqual({ ok: false, reason: 'check_failed' });
  });
  it('a page that does not answer in time is check_failed', async () => {
    const f = (_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    const t0 = Date.now();
    expect(await L.liveCheck(URL1, f as any, { timeoutMs: 30 })).toEqual({ ok: false, reason: 'check_failed' });
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it('a body that breaks while it is read is check_failed', async () => {
    const stream = new ReadableStream({ pull() { throw new Error('cut'); } });
    const res = new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } });
    expect(await L.liveCheck(URL1, async () => res)).toEqual({ ok: false, reason: 'check_failed' });
  });
  it('the default timeout is a few seconds', () => {
    expect(L.LIVE_TIMEOUT_MS).toBeGreaterThanOrEqual(2000);
    expect(L.LIVE_TIMEOUT_MS).toBeLessThanOrEqual(10000);
  });
});

describe('liveCheckAll', () => {
  const posts = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `p-${i}`, url: `${SITE}/p-${i}/` }));
  it('answers for every key, and one failure does not stop the others', async () => {
    const f = async (url: string) => {
      if (url.endsWith('/p-1/')) throw new Error('down');
      if (url.endsWith('/p-2/')) return new Response('', { status: 404, headers: { 'Content-Type': 'text/html' } });
      return html(page());
    };
    const m = await L.liveCheckAll(posts(4), f);
    expect([...m.keys()].sort()).toEqual(['p-0', 'p-1', 'p-2', 'p-3']);
    expect(m.get('p-0')).toEqual({ ok: true });
    expect(m.get('p-1')).toEqual({ ok: false, reason: 'check_failed' });
    expect(m.get('p-2')).toEqual({ ok: false, reason: 'not_live' });
    expect(m.get('p-3')).toEqual({ ok: true });
  });
  it('opens at most LIVE_CONCURRENCY pages at the same time', async () => {
    let active = 0;
    let peak = 0;
    const f = async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; return html(page()); };
    const m = await L.liveCheckAll(posts(14), f);
    expect(m.size).toBe(14);
    expect(peak).toBeLessThanOrEqual(L.LIVE_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });
  it('an empty list opens nothing', async () => {
    let n = 0;
    const m = await L.liveCheckAll([], async () => { n++; return html(page()); });
    expect(m.size).toBe(0);
    expect(n).toBe(0);
  });
});

describe('prepare and finish (the two halves of the decision)', () => {
  const raw = (key: string, o: any = {}) => ({ key, url: `${SITE}/${key}/`, title: `Story ${key}`, publishedAt: NOW - 60000, ...o });
  it('decide gives the same answer as prepare, an all-live check and finish', () => {
    const posts = [raw('aa'), raw('bb', { breaking: true }), raw('aa'), raw('cc', { push: 'off' })];
    const one = A.decide(posts, new Set(), NOW, SITE);
    const prep = A.prepare(posts, new Set(), NOW, SITE);
    const live = new Map(prep.passed.map((x: any) => [x.post.key, { ok: true }]));
    expect(A.finish(A.prepare(posts, new Set(), NOW, SITE), live)).toEqual(one);
  });
  it('prepare leaves the posts that passed for the live check and fills in the others', () => {
    const prep = A.prepare([raw('aa'), raw('bb', { sponsored: true }), raw('cc')], new Set(['cc']), NOW, SITE);
    expect(prep.passed.map((x: any) => x.post.key)).toEqual(['aa']);
    expect(prep.results[1]).toEqual({ key: 'bb', status: 'skipped', reason: 'sponsored' });
    expect(prep.results[2]).toEqual({ key: 'cc', status: 'skipped', reason: 'already_announced' });
    expect(prep.results[0]).toBeUndefined();
  });
  it('finish skips a post whose live check failed, with the reason from the check', () => {
    const prep = A.prepare([raw('aa'), raw('bb'), raw('cc'), raw('dd')], new Set(), NOW, SITE);
    const live = new Map<string, any>([['aa', { ok: true }], ['bb', { ok: false, reason: 'not_live' }], ['cc', { ok: false, reason: 'noindex' }], ['dd', { ok: false, reason: 'check_failed' }]]);
    const { results, record } = A.finish(prep, live);
    expect(results.map((r: any) => r.reason ?? r.status)).toEqual(['accepted', 'not_live', 'noindex', 'check_failed']);
    expect(record.map((p: any) => p.key)).toEqual(['aa']);
  });
  it('a missing answer or an unknown reason is a failed check, never a pass', () => {
    const prep = A.prepare([raw('aa'), raw('bb')], new Set(), NOW, SITE);
    const live = new Map<string, any>([['bb', { ok: false, reason: 'made-up' }]]);
    const { results, record } = A.finish(prep, live);
    expect(results.map((r: any) => r.reason)).toEqual(['check_failed', 'check_failed']);
    expect(record.length).toBe(0);
  });
  it('the import guard counts only the live posts, so a page that is not live cannot take a live one\'s place', () => {
    const posts = [raw('b1', { breaking: true }), raw('b2', { breaking: true }), raw('n1'), raw('n2')];
    const prep = A.prepare(posts, new Set(), NOW, SITE);
    const live = new Map<string, any>([['b1', { ok: false, reason: 'not_live' }], ['b2', { ok: false, reason: 'not_live' }], ['n1', { ok: true }], ['n2', { ok: true }]]);
    const { results } = A.finish(prep, live);
    expect(results.map((r: any) => r.reason ?? r.status)).toEqual(['not_live', 'not_live', 'accepted', 'accepted']); // 2 live posts: the guard stays off
  });
});

describe('the file livecheck.js', () => {
  const code = readFileSync(new URL('../../../workers/push/livecheck.js', import.meta.url), 'utf8');
  it('reads no clock, prints nothing, and uses only the fetch function it is given', () => {
    expect(code).not.toMatch(/\bfetch\s*\(|Date\.now|console\./);
    expect(code).toMatch(/doFetch\(/);
  });
  it('has no emoji', () => {
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
