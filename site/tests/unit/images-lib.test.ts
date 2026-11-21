import { describe, it, expect, vi } from 'vitest';
// @ts-ignore plain JS Worker file
import { fetchPicture, fetchPictures, resolveViaDoh, allPublic, MAX_BYTES, MAX_PER_CALL, CONCURRENCY, KINDS } from '../../../workers/images/lib.js';
// @ts-ignore plain JS module of the dashboard
import { checkAddress, checkRedirects } from '../../public/admin/js/hotlink.js';
import { readFileSync } from 'node:fs';

const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...parts: (number[] | Uint8Array)[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
const JPG = cat([0xff, 0xd8, 0xff, 0xe0], enc('JFIF'), new Array(40).fill(1));
const PNG = cat([0x89], enc('PNG'), [0x0d, 0x0a, 0x1a, 0x0a], new Array(40).fill(2));
const WEBP = cat(enc('RIFF'), [1, 2, 3, 4], enc('WEBP'), new Array(40).fill(3));
const GIF = cat(enc('GIF89a'), new Array(40).fill(4));
const AVIF = cat([0, 0, 0, 24], enc('ftypavif'), new Array(40).fill(5));
const SVG = enc('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML = enc('<!doctype html><html><body>Not found</body></html>');
const TEXT = enc('this is a text file that is named like a picture');

type Handler = (url: string, init: any) => Response | Promise<Response>;
/** A fake internet: addresses map to a Response (or a function). Anything else is a network error. */
function site(map: Record<string, Response | Handler>) {
  const calls: { url: string; init: any }[] = [];
  const fn = async (url: string, init: any = {}) => {
    calls.push({ url, init });
    const h = map[url];
    if (!h) throw new Error('no route');
    return typeof h === 'function' ? h(url, init) : h.clone();
  };
  return { fn, calls };
}
const ok = (bytes: Uint8Array, type = 'image/jpeg') => new Response(bytes, { status: 200, headers: { 'content-type': type } });
const go = (to: string) => new Response(null, { status: 302, headers: { location: to } });
const A = 'https://other.com/a.jpg';

describe('fetchPicture: the picture itself', () => {
  it.each([['jpg', JPG], ['png', PNG], ['webp', WEBP], ['gif', GIF], ['avif', AVIF]])('accepts a real %s by its first bytes', async (kind, bytes) => {
    const s = site({ [A]: ok(bytes as Uint8Array, 'application/octet-stream') });
    const r = await fetchPicture(A, { fetch: s.fn });
    expect(r).toMatchObject({ ok: true, url: A, finalUrl: A, hops: 0, kind });
    expect(Array.from(r.bytes)).toEqual(Array.from(bytes as Uint8Array));
    expect(KINDS).toContain(kind);
  });
  it('refuses an SVG, a text file named .jpg, an HTML page and an empty body', async () => {
    const s = site({ [A]: ok(SVG, 'image/jpeg'), 'https://other.com/b.jpg': ok(TEXT, 'image/jpeg'), 'https://other.com/c.jpg': ok(HTML, 'text/html'), 'https://other.com/d.jpg': ok(new Uint8Array(0)) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason: 'svg_refused' });
    expect(await fetchPicture('https://other.com/b.jpg', { fetch: s.fn })).toMatchObject({ ok: false, reason: 'not_image' });
    expect(await fetchPicture('https://other.com/c.jpg', { fetch: s.fn })).toMatchObject({ ok: false, reason: 'not_image' });
    expect(await fetchPicture('https://other.com/d.jpg', { fetch: s.fn })).toMatchObject({ ok: false, reason: 'not_image' });
  });
  it('trusts the first bytes, not the header: a PNG sent as text/plain is accepted, a JPEG header on text is not', async () => {
    const s = site({ [A]: ok(PNG, 'text/plain'), 'https://other.com/t.jpg': ok(TEXT, 'image/jpeg') });
    expect((await fetchPicture(A, { fetch: s.fn })).kind).toBe('png');
    expect((await fetchPicture('https://other.com/t.jpg', { fetch: s.fn })).reason).toBe('not_image');
  });
  it('maps 404 and 410 to not_found, other codes to http_error with the status, a thrown error to network', async () => {
    const s = site({ [A]: new Response('x', { status: 404 }), 'https://other.com/g.jpg': new Response('x', { status: 410 }), 'https://other.com/e.jpg': new Response('x', { status: 500 }) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason: 'not_found', status: 404 });
    expect(await fetchPicture('https://other.com/g.jpg', { fetch: s.fn })).toMatchObject({ reason: 'not_found', status: 410 });
    expect(await fetchPicture('https://other.com/e.jpg', { fetch: s.fn })).toMatchObject({ reason: 'http_error', status: 500 });
    expect(await fetchPicture('https://other.com/unknown.jpg', { fetch: s.fn })).toMatchObject({ reason: 'network' });
  });
  it('asks for images only and never sends cookies or a fake agent', async () => {
    const s = site({ [A]: ok(JPG) });
    await fetchPicture(A, { fetch: s.fn });
    expect(s.calls[0].init.redirect).toBe('manual');
    expect(Object.keys(s.calls[0].init.headers)).toEqual(['accept']);
    expect(s.calls[0].init.headers.accept).toMatch(/image\//);
  });
});

describe('fetchPicture: size and time', () => {
  it('refuses a picture over the limit by its content-length, before reading it', async () => {
    const s = site({ [A]: new Response(JPG, { headers: { 'content-length': String(MAX_BYTES + 1) } }) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason: 'too_big' });
  });
  it('does not read the body at all when the content-length is already too big', async () => {
    let pulled = false;
    const body = new ReadableStream({ pull(c) { pulled = true; c.enqueue(JPG); c.close(); } }, { highWaterMark: 0 });
    const s = site({ [A]: () => new Response(body, { headers: { 'content-length': String(MAX_BYTES + 1) } }) });
    expect((await fetchPicture(A, { fetch: s.fn })).reason).toBe('too_big');
    expect(pulled).toBe(false);
  });
  it('stops reading when the body grows past the limit even without a content-length', async () => {
    const big = new ReadableStream({ start(c) { c.enqueue(JPG); c.enqueue(new Uint8Array(60)); c.enqueue(new Uint8Array(60)); c.close(); } });
    const s = site({ [A]: () => new Response(big) });
    expect(await fetchPicture(A, { fetch: s.fn, maxBytes: 100 })).toMatchObject({ ok: false, reason: 'too_big' });
  });
  it('accepts a body of exactly the limit and refuses one byte more', async () => {
    const exact = new Uint8Array(100); exact.set(JPG.slice(0, 4));
    const more = new Uint8Array(101); more.set(JPG.slice(0, 4));
    const s = site({ [A]: () => new Response(exact), 'https://other.com/m.jpg': () => new Response(more) });
    expect((await fetchPicture(A, { fetch: s.fn, maxBytes: 100 })).ok).toBe(true);
    expect((await fetchPicture('https://other.com/m.jpg', { fetch: s.fn, maxBytes: 100 })).reason).toBe('too_big');
  });
  it('gives up after the idle time with no data', async () => {
    const stuck = new ReadableStream({ start(c) { c.enqueue(JPG); } });
    const s = site({ [A]: () => new Response(stuck) });
    const t = Date.now();
    expect(await fetchPicture(A, { fetch: s.fn, idleMs: 40, totalMs: 5000 })).toMatchObject({ ok: false, reason: 'timeout' });
    expect(Date.now() - t).toBeLessThan(1500);
  });
  it('gives up after the total time even when data keeps arriving slowly', async () => {
    let timer: any;
    const drip = new ReadableStream({ start(c) { c.enqueue(JPG); timer = setInterval(() => { try { c.enqueue(new Uint8Array(1)); } catch { clearInterval(timer); } }, 15); }, cancel() { clearInterval(timer); } });
    const s = site({ [A]: () => new Response(drip) });
    expect(await fetchPicture(A, { fetch: s.fn, idleMs: 1000, totalMs: 80 })).toMatchObject({ ok: false, reason: 'timeout' });
    clearInterval(timer);
  });
  it('gives up when the server never answers', async () => {
    const hang = () => new Promise<Response>(() => {});
    expect(await fetchPicture(A, { fetch: hang as any, totalMs: 40 })).toMatchObject({ ok: false, reason: 'timeout' });
  });
  it('has the limits of the plan: 10 MB, 30 pictures, 4 at a time', () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_PER_CALL).toBe(30);
    expect(CONCURRENCY).toBe(4);
  });
});

describe('fetchPicture: addresses and redirects', () => {
  it('refuses a bad address before any request is made', async () => {
    for (const [u, reason] of [['http://other.com/a.jpg', 'not_https'], ['https://localhost/a.jpg', 'private_host'], ['https://u:p@other.com/a.jpg', 'credentials'], ['https://other.com:8443/a.jpg', 'bad_port'], ['https://169.254.169.254/latest', 'private_host'], ['nonsense', 'bad_url']]) {
      const s = site({});
      expect(await fetchPicture(u, { fetch: s.fn })).toMatchObject({ ok: false, reason });
      expect(s.calls).toHaveLength(0);
    }
  });
  it('refuses a blocked host', async () => {
    const s = site({ [A]: ok(JPG) });
    expect(await fetchPicture(A, { fetch: s.fn, blockHosts: ['other.com'] })).toMatchObject({ ok: false, reason: 'blocked_host' });
    expect(s.calls).toHaveLength(0);
  });
  it('follows a redirect (relative or absolute) and reports the final address and the hops', async () => {
    const s = site({ [A]: go('/b.jpg'), 'https://other.com/b.jpg': go('https://cdn.other.com/c.jpg'), 'https://cdn.other.com/c.jpg': ok(WEBP) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: true, finalUrl: 'https://cdn.other.com/c.jpg', hops: 2, kind: 'webp' });
  });
  it.each([301, 302, 303, 307, 308])('follows a %i redirect', async (code) => {
    const s = site({ [A]: new Response(null, { status: code, headers: { location: 'https://cdn.other.com/z.jpg' } }), 'https://cdn.other.com/z.jpg': ok(JPG) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: true, hops: 1 });
  });
  it('follows three redirects and refuses a fourth', async () => {
    const s = site({ [A]: go('https://b.com/1'), 'https://b.com/1': go('https://c.com/2'), 'https://c.com/2': go('https://d.com/3'), 'https://d.com/3': ok(JPG) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: true, hops: 3 });
    const s4 = site({ [A]: go('https://b.com/1'), 'https://b.com/1': go('https://c.com/2'), 'https://c.com/2': go('https://d.com/3'), 'https://d.com/3': go('https://e.com/4'), 'https://e.com/4': ok(JPG) });
    expect(await fetchPicture(A, { fetch: s4.fn })).toMatchObject({ ok: false, reason: 'too_many_redirects' });
    expect(s4.calls.map((c) => c.url)).not.toContain('https://e.com/4');
  });
  it('stops a redirect loop', async () => {
    const s = site({ [A]: go('https://other.com/b.jpg'), 'https://other.com/b.jpg': go(A) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason: 'too_many_redirects' });
  });
  it('checks every hop again: private address, http, another port, credentials; and never requests them', async () => {
    for (const [to, reason] of [['https://169.254.169.254/latest/meta-data', 'private_host'], ['http://other.com/x.jpg', 'not_https'], ['https://other.com:8443/x.jpg', 'bad_port'], ['https://u:p@other.com/x.jpg', 'credentials'], ['https://intranet/x.jpg', 'private_host']]) {
      const s = site({ [A]: go(to) });
      expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason });
      expect(s.calls.map((c) => c.url)).toEqual([A]);
    }
  });
  it('a redirect without a Location is an http_error', async () => {
    const s = site({ [A]: new Response(null, { status: 302 }) });
    expect(await fetchPicture(A, { fetch: s.fn })).toMatchObject({ ok: false, reason: 'http_error', status: 302 });
  });
});

describe('fetchPicture: the referrer', () => {
  const REF = 'https://shivam-das-news.pages.dev';
  it('sends our own origin first and tries once more without it after a 403', async () => {
    const s = site({ [A]: (_u, init) => (init.headers.referer ? new Response('no', { status: 403 }) : ok(JPG)) });
    const r = await fetchPicture(A, { fetch: s.fn, referrer: REF });
    expect(r.ok).toBe(true);
    expect(s.calls.map((c) => c.init.headers.referer)).toEqual([REF, undefined]);
  });
  it('does not retry a second time and does not retry when no referrer was sent', async () => {
    const always = site({ [A]: new Response('no', { status: 403 }) });
    expect(await fetchPicture(A, { fetch: always.fn, referrer: REF })).toMatchObject({ ok: false, reason: 'http_error', status: 403 });
    expect(always.calls).toHaveLength(2);
    const none = site({ [A]: new Response('no', { status: 403 }) });
    expect(await fetchPicture(A, { fetch: none.fn })).toMatchObject({ ok: false, reason: 'http_error', status: 403 });
    expect(none.calls).toHaveLength(1);
  });
  it('sends no referrer at all when none is given', async () => {
    const s = site({ [A]: ok(JPG) });
    await fetchPicture(A, { fetch: s.fn });
    expect('referer' in s.calls[0].init.headers).toBe(false);
  });
});

describe('fetchPicture: the host name lookup', () => {
  it('refuses a name that points to a private address, also when only one of the answers is private', async () => {
    for (const ips of [['10.0.0.5'], ['93.184.216.34', '127.0.0.1'], ['::1'], ['fd00::1'], ['169.254.169.254']]) {
      const s = site({ [A]: ok(JPG) });
      expect(await fetchPicture(A, { fetch: s.fn, resolveHost: async () => ips })).toMatchObject({ ok: false, reason: 'private_host' });
      expect(s.calls).toHaveLength(0);
    }
  });
  it('accepts public answers (IPv4 and IPv6)', async () => {
    const s = site({ [A]: ok(JPG) });
    expect((await fetchPicture(A, { fetch: s.fn, resolveHost: async () => ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'] })).ok).toBe(true);
  });
  it('an empty answer or a failed lookup is dns_failed and nothing is requested', async () => {
    const s = site({ [A]: ok(JPG) });
    expect(await fetchPicture(A, { fetch: s.fn, resolveHost: async () => [] })).toMatchObject({ ok: false, reason: 'dns_failed' });
    expect(await fetchPicture(A, { fetch: s.fn, resolveHost: async () => { throw new Error('boom'); } })).toMatchObject({ ok: false, reason: 'dns_failed' });
    expect(s.calls).toHaveLength(0);
  });
  it('looks every hop up again, so a public name that redirects to a private name is refused', async () => {
    const dns: Record<string, string[]> = { 'other.com': ['93.184.216.34'], 'evil.example.net': ['192.168.0.9'] };
    const asked: string[] = [];
    const s = site({ [A]: go('https://evil.example.net/x.jpg'), 'https://evil.example.net/x.jpg': ok(JPG) });
    const r = await fetchPicture(A, { fetch: s.fn, resolveHost: async (h: string) => { asked.push(h); return dns[h]; } });
    expect(r).toMatchObject({ ok: false, reason: 'private_host' });
    expect(asked).toEqual(['other.com', 'evil.example.net']);
    expect(s.calls.map((c) => c.url)).toEqual([A]);
  });
  it('does not look up an IP address written in the address', async () => {
    const s = site({ 'https://93.184.216.34/a.jpg': ok(JPG), 'https://[2606:4700:4700::1111]/a.jpg': ok(PNG) });
    const lookup = vi.fn(async () => []);
    expect((await fetchPicture('https://93.184.216.34/a.jpg', { fetch: s.fn, resolveHost: lookup })).ok).toBe(true);
    expect((await fetchPicture('https://[2606:4700:4700::1111]/a.jpg', { fetch: s.fn, resolveHost: lookup })).ok).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('resolveViaDoh and allPublic', () => {
  const doh = (answers: Record<string, any>) => async (url: string) => {
    const type = new URL(url).searchParams.get('type')!;
    const a = answers[type];
    if (a === 'fail') return new Response('x', { status: 500 });
    return new Response(JSON.stringify(a ?? { Status: 0 }), { headers: { 'content-type': 'application/dns-json' } });
  };
  it('collects the A and AAAA answers and ignores CNAME records', async () => {
    const f = doh({ A: { Answer: [{ type: 5, data: 'cdn.other.com.' }, { type: 1, data: '93.184.216.34' }] }, AAAA: { Answer: [{ type: 28, data: '2606:2800::1' }] } });
    expect(await resolveViaDoh('other.com', f as any)).toEqual(['93.184.216.34', '2606:2800::1']);
  });
  it('returns an empty list when there is no answer and throws when the lookup fails', async () => {
    expect(await resolveViaDoh('none.example', doh({}) as any)).toEqual([]);
    await expect(resolveViaDoh('other.com', doh({ A: 'fail' }) as any)).rejects.toThrow(/dns/);
  });
  it('asks for the host name encoded and for DNS JSON', async () => {
    const seen: any[] = [];
    await resolveViaDoh('a b.com', (async (u: string, i: any) => { seen.push([u, i]); return new Response('{}'); }) as any);
    expect(seen[0][0]).toContain('name=a%20b.com&type=A');
    expect(seen[0][1].headers.accept).toBe('application/dns-json');
  });
  it('allPublic: public yes; private, mixed, empty and junk no', () => {
    expect(allPublic(['93.184.216.34', '2606:2800::1'])).toBe(true);
    expect(allPublic(['93.184.216.34', '10.0.0.1'])).toBe(false);
    expect(allPublic([])).toBe(false);
    expect(allPublic(undefined as any)).toBe(false);
    expect(allPublic(['not an ip'])).toBe(false);
  });
});

describe('fetchPictures', () => {
  const U = (n: number) => `https://other.com/${n}.jpg`;
  it('answers in the order of the list and one failure does not stop the others', async () => {
    const s = site({ [U(1)]: ok(JPG), [U(2)]: new Response('x', { status: 404 }), [U(3)]: ok(PNG) });
    const r = await fetchPictures([U(1), U(2), U(3), 'http://other.com/4.jpg'], { fetch: s.fn });
    expect(r.ok).toBe(true);
    expect(r.results.map((x: any) => [x.url, x.ok, x.reason ?? x.kind])).toEqual([[U(1), true, 'jpg'], [U(2), false, 'not_found'], [U(3), true, 'png'], ['http://other.com/4.jpg', false, 'not_https']]);
  });
  it('fetches a repeated address once and answers it for each place', async () => {
    const s = site({ [U(1)]: ok(JPG) });
    const r = await fetchPictures([U(1), U(1), U(1)], { fetch: s.fn });
    expect(s.calls).toHaveLength(1);
    expect(r.results.map((x: any) => x.ok)).toEqual([true, true, true]);
  });
  it('accepts 30 and refuses 31, an empty list and a bad list, before any request', async () => {
    const s = site({});
    expect((await fetchPictures(Array.from({ length: 31 }, (_, i) => U(i)), { fetch: s.fn })).reason).toBe('too_many');
    expect((await fetchPictures([], { fetch: s.fn })).reason).toBe('empty');
    expect((await fetchPictures('x' as any, { fetch: s.fn })).reason).toBe('bad_list');
    expect((await fetchPictures([U(1), 5 as any], { fetch: s.fn })).reason).toBe('bad_list');
    expect(s.calls).toHaveLength(0);
    const map: Record<string, Response> = {};
    for (let i = 0; i < 30; i++) map[U(i)] = ok(JPG);
    const r = await fetchPictures(Array.from({ length: 30 }, (_, i) => U(i)), { fetch: site(map).fn });
    expect(r.ok && r.results).toHaveLength(30);
  });
  it('runs at most 4 downloads at the same time', async () => {
    let now = 0, peak = 0;
    const f = async () => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 15)); now--; return ok(JPG); };
    const r = await fetchPictures(Array.from({ length: 12 }, (_, i) => U(i)), { fetch: f as any });
    expect(r.results.every((x: any) => x.ok)).toBe(true);
    expect(peak).toBe(4);
  });
});

describe('one source of truth', () => {
  it('uses the address rules of the dashboard, not a copy', () => {
    const src = readFileSync(new URL('../../../workers/images/lib.js', import.meta.url), 'utf8');
    expect(src).toMatch(/from '\.\.\/\.\.\/site\/public\/admin\/js\/hotlink\.js'/);
    expect(src).toMatch(/from '\.\.\/\.\.\/site\/public\/admin\/js\/media-meta\.js'/);
    expect(checkAddress('https://localhost/a.jpg').ok).toBe(false);
    expect(checkRedirects(['https://a.com/x', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com']).ok).toBe(false);
  });
  it('reads no secret and no header of the caller', () => {
    const src = readFileSync(new URL('../../../workers/images/lib.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\benv\b|Authorization|request\.headers|console\./);
  });
});
