import { describe, it, expect, vi } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { hostPost, sha256Hex, fromBase64, explain, REASON_WORDS, WORKER_BATCH, GIF_MAX_BYTES } from '../../public/admin/js/hosting-run.js';
// @ts-ignore plain JS Worker code
import { toBase64, MAX_PER_CALL, fetchPictures as realFetchPictures } from '../../../workers/images/lib.js';
// @ts-ignore plain JS module
import { findExternal } from '../../public/admin/js/hotlink.js';

const enc = (s: string) => new TextEncoder().encode(s);
const pic = (tag: number, kind: 'jpg' | 'png' = 'jpg') => (kind === 'jpg' ? Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(tag)]) : Uint8Array.from([0x89, ...enc('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(30).fill(tag)]));
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' as string, image: undefined as string | undefined, imageAlt: undefined as string | undefined };
const NOW = new Date('2026-11-17T01:02:03.456Z');

/** A fake picture service: address -> bytes (ok) or a reason word. Records every call. */
function service(table: Record<string, Uint8Array | string>, o: { kind?: string } = {}) {
  const calls: string[][] = [];
  const fn = vi.fn(async (urls: string[]) => {
    calls.push(urls);
    return { ok: true, results: urls.map((url) => { const v = table[url]; if (v === undefined) return { url, ok: false, reason: 'network' }; if (typeof v === 'string') return { url, ok: false, reason: v }; return { url, ok: true, kind: o.kind ?? (v[0] === 0x89 ? 'png' : 'jpg'), size: v.length, data: toBase64(v) }; }) };
  });
  return { fn, calls };
}
/** A fake optimizer: keeps the first 20 bytes and says 1600 x 900 WebP. */
const optimize = vi.fn(async (bytes: Uint8Array) => ({ bytes: bytes.slice(0, 20), ext: 'webp' as const, width: 1600, height: 900 }));
const run = (post: any, svc: any, extra: any = {}) => hostPost(post, { fetchPictures: svc.fn, optimize, ownHosts: OWN, now: NOW, ...extra });

describe('the whole run: plan, download, optimize, name, record, rewrite', () => {
  it('hosts the pictures of a post and returns the new post, the files and the new media map', async () => {
    const A = 'https://other.com/wp/IMG_1234.jpg', B = 'https://other.com/b.png', C = 'https://other.com/c.jpg';
    const post = { ...POST, image: C, imageAlt: 'Front picture of the launch', body: `![New phone launch event in Delhi](${A})\n\n## Crowd outside\n\n<img src="${B}">` };
    const svc = service({ [A]: pic(1), [B]: pic(2, 'png'), [C]: pic(3) });
    const r = await run(post, svc);
    expect(svc.calls).toEqual([[C, A, B]]);
    expect(r.items.map((i: any) => [i.url, i.status, i.src])).toEqual([
      [C, 'hosted', '/media/2026/11/front-picture-launch.webp'],
      [A, 'hosted', '/media/2026/11/new-phone-launch-event-delhi.webp'],
      [B, 'hosted', '/media/2026/11/crowd-outside-delhi-hosts-big-phone.webp'],
    ]);
    expect(r.post.image).toBe('/media/2026/11/front-picture-launch.webp');
    expect(r.post.body).toBe('![New phone launch event in Delhi](/media/2026/11/new-phone-launch-event-delhi.webp)\n\n## Crowd outside\n\n<img src="/media/2026/11/crowd-outside-delhi-hosts-big-phone.webp">');
    expect(r.files.map((f: any) => [f.src, f.path])).toEqual([
      ['/media/2026/11/front-picture-launch.webp', 'site/public/media/2026/11/front-picture-launch.webp'],
      ['/media/2026/11/new-phone-launch-event-delhi.webp', 'site/public/media/2026/11/new-phone-launch-event-delhi.webp'],
      ['/media/2026/11/crowd-outside-delhi-hosts-big-phone.webp', 'site/public/media/2026/11/crowd-outside-delhi-hosts-big-phone.webp'],
    ]);
    expect(r.files.every((f: any) => f.bytes.length === 20)).toBe(true);
    expect(r.summary.counts).toMatchObject({ total: 3, hosted: 3, failed: 0 });
    expect(r.changed).toBe(true);
    expect(findExternal(r.post, OWN)).toEqual([]);
  });
  it('writes the media row: source, hash of the DOWNLOADED file, size of the hosted file, time, alt marked auto only when it was made', async () => {
    const A = 'https://www.other.com/a.jpg?w=900#x';
    const bytes = pic(7);
    const svc = service({ 'https://www.other.com/a.jpg?w=900': bytes });
    const post = { ...POST, body: `## Vote count\n\n![](${A})` };
    const r = await run(post, svc);
    const row = r.map['/media/2026/11/vote-count-delhi-hosts-big-phone.webp'];
    expect(row).toEqual({ alt: 'Vote count', autoAlt: true, sourceUrl: 'https://www.other.com/a.jpg?w=900', sourceHost: 'other.com', sha256: await sha256Hex(bytes), width: 1600, height: 900, bytes: 20, hostedAt: '2026-11-17T01:02:03Z' });
    const own = await run({ ...POST, body: `![Writer alt text here](${A})` }, service({ 'https://www.other.com/a.jpg?w=900': bytes }));
    expect(Object.values(own.map)[0]).toMatchObject({ alt: 'Writer alt text here' });
    expect('autoAlt' in (Object.values(own.map)[0] as any)).toBe(false);
  });
  it('does not change its input and keeps old rows of the map', async () => {
    const A = 'https://other.com/a.jpg';
    const post = { ...POST, body: `![Crowd outside venue](${A})` };
    const map = { '/media/2026/10/old.webp': { alt: 'old' } };
    const snap = JSON.stringify([post, map]);
    const r = await run(post, service({ [A]: pic(1) }), { map });
    expect(JSON.stringify([post, map])).toBe(snap);
    expect(r.map['/media/2026/10/old.webp']).toEqual({ alt: 'old' });
    expect(r.map).not.toBe(map);
  });
  it('a post with nothing to host makes no call and reports no change', async () => {
    const svc = service({});
    const r = await run({ ...POST, date: undefined, body: '![x](/media/2026/11/a.webp) text' }, svc);
    expect(svc.fn).not.toHaveBeenCalled();
    expect(r).toMatchObject({ files: [], items: [], changed: false });
    expect(r.post.body).toBe('![x](/media/2026/11/a.webp) text');
  });
  it('throws a plain message before any download when the post has no valid date', async () => {
    const svc = service({ 'https://other.com/a.jpg': pic(1) });
    for (const date of [undefined, '', 'yesterday']) await expect(run({ ...POST, date, body: '![a](https://other.com/a.jpg)' }, svc)).rejects.toThrow(/valid date/);
    expect(svc.fn).not.toHaveBeenCalled();
  });
});

describe('reuse', () => {
  it('reuses a file we already have for the same address: no download, no new file', async () => {
    const A = 'https://other.com/a.jpg';
    const svc = service({});
    const map = { '/media/2026/10/have.webp': { sourceUrl: A, sha256: 'f'.repeat(64) } };
    const r = await run({ ...POST, body: `![x](${A})` }, svc, { map });
    expect(svc.fn).not.toHaveBeenCalled();
    expect(r.items[0]).toMatchObject({ status: 'reuse', src: '/media/2026/10/have.webp', by: 'url' });
    expect(r.post.body).toBe('![x](/media/2026/10/have.webp)');
    expect(r.files).toEqual([]);
    expect(r.changed).toBe(true);
  });
  it('reuses the file when another address gives the same bytes (the hash of the downloaded file), also inside one run', async () => {
    const bytes = pic(5);
    const have = { '/media/2026/10/have.webp': { sourceUrl: 'https://mirror.com/x.jpg', sha256: await sha256Hex(bytes) } };
    const A = 'https://other.com/a.jpg';
    const r = await run({ ...POST, body: `![x](${A})` }, service({ [A]: bytes }), { map: have });
    expect(r.items[0]).toMatchObject({ status: 'reuse', by: 'sha256', src: '/media/2026/10/have.webp' });
    expect(r.files).toEqual([]);
    expect(optimize).toBeDefined();
    const B1 = 'https://one.com/p.jpg', B2 = 'https://two.com/q.jpg';
    const r2 = await run({ ...POST, body: `![Crowd outside venue](${B1})\n![Crowd outside venue](${B2})` }, service({ [B1]: bytes, [B2]: bytes }));
    expect(r2.files).toHaveLength(1);
    expect(r2.items.map((i: any) => [i.status, i.by])).toEqual([['hosted', undefined], ['reuse', 'sha256']]);
    expect(r2.post.body).toBe('![Crowd outside venue](/media/2026/11/crowd-outside-venue.webp)\n![Crowd outside venue](/media/2026/11/crowd-outside-venue.webp)');
  });
  it('one address in two places (also with different #fragments) is downloaded once and makes one file', async () => {
    const A = 'https://other.com/a.jpg';
    const svc = service({ [A]: pic(1) });
    const r = await run({ ...POST, body: `![Crowd outside venue](${A}#one)\n![Crowd outside venue](${A}#two)\n![Crowd outside venue](${A})` }, svc);
    expect(svc.calls).toEqual([[A]]);
    expect(r.files).toHaveLength(1);
    expect(r.items.map((i: any) => [i.status, i.by])).toEqual([['hosted', undefined], ['reuse', 'url'], ['reuse', 'url']]);
    expect(findExternal(r.post, OWN)).toEqual([]);
  });
});

describe('names', () => {
  it('two different pictures with the same text get -2; a name that already exists in the repository is also avoided', async () => {
    const A = 'https://one.com/p.jpg', B = 'https://two.com/q.jpg';
    const body = `![Crowd outside venue](${A})\n![Crowd outside venue](${B})`;
    const r = await run({ ...POST, body }, service({ [A]: pic(1), [B]: pic(2) }), { existing: ['/media/2026/11/crowd-outside-venue.webp'] });
    expect(r.files.map((f: any) => f.src)).toEqual(['/media/2026/11/crowd-outside-venue-2.webp', '/media/2026/11/crowd-outside-venue-3.webp']);
  });
  it('a camera name and no text falls back to the title words; the folder comes from the post date', async () => {
    const A = 'https://other.com/IMG_20261113_0934.jpg';
    const r = await run({ ...POST, date: '2027-01-02', body: `![](${A})` }, service({ [A]: pic(1) }));
    expect(r.files[0].src).toBe('/media/2027/01/phone-launch-delhi-hosts-big.webp');
    expect(r.items[0].autoAlt).toBe(true);
  });
  it('with no text at all the name is the handle and the number of the picture in the post', async () => {
    const A = 'https://other.com/IMG_1.jpg', B = 'https://other.com/DSC_2.jpg';
    const r = await run({ date: '2026-11-16', handle: 'phone-launch', body: `![](${A})\n![](${B})` }, service({ [A]: pic(1), [B]: pic(2) }));
    expect(r.files.map((f: any) => f.src)).toEqual(['/media/2026/11/phone-launch-image-1.webp', '/media/2026/11/phone-launch-image-2.webp']);
    expect(r.map['/media/2026/11/phone-launch-image-1.webp']).not.toHaveProperty('alt');
  });
  it('a GIF stays a GIF', async () => {
    const A = 'https://other.com/spin.gif';
    const gif = Uint8Array.from([...enc('GIF89a'), ...new Array(30).fill(4)]);
    const keep = vi.fn(async (b: Uint8Array) => ({ bytes: b, ext: 'gif' as const, width: 300, height: 200 }));
    const r = await hostPost({ ...POST, body: `![Spinning logo animation](${A})` }, { fetchPictures: service({ [A]: gif }, { kind: 'gif' }).fn, optimize: keep, ownHosts: OWN, now: NOW });
    expect(r.files[0].src).toBe('/media/2026/11/spinning-logo-animation.gif');
    expect(keep).toHaveBeenCalledWith(expect.any(Uint8Array), 'gif');
  });
});

describe('what is not hosted stays as it was', () => {
  it('a missing picture, an agency picture and an unsafe address stay in the post; the others are hosted', async () => {
    const A = 'https://other.com/a.jpg', GONE = 'https://other.com/gone.jpg', G = 'https://media.gettyimages.com/id/1/p.jpg', H = 'http://other.com/h.jpg';
    const body = `![Crowd outside venue](${A})\n![b](${GONE})\n![c](${G})\n![d](${H})`;
    const svc = service({ [A]: pic(1), [GONE]: 'not_found' });
    const r = await run({ ...POST, body }, svc);
    expect(svc.calls).toEqual([[A, GONE]]);
    expect(r.items.map((i: any) => [i.status, i.reason])).toEqual([['hosted', undefined], ['failed', 'not_found'], ['needs_confirm', 'needs_confirm'], ['refused', 'not_https']]);
    expect(r.post.body).toBe(`![Crowd outside venue](/media/2026/11/crowd-outside-venue.webp)\n![b](${GONE})\n![c](${G})\n![d](${H})`);
    expect(r.summary.counts).toMatchObject({ total: 4, hosted: 1, failed: 1, needs_confirm: 1, refused: 1 });
    expect(r.summary.retry).toEqual([GONE]);
    expect(r.items[1].text).toBe(explain('not_found'));
    expect(r.items[2].text).toBe(explain('needs_confirm'));
  });
  it('a confirmed agency picture is hosted', async () => {
    const G = 'https://media.gettyimages.com/id/1/p.jpg';
    const r = await run({ ...POST, body: `![Crowd outside venue](${G})` }, service({ [G]: pic(1) }), { confirmed: [G] });
    expect(r.items[0].status).toBe('hosted');
  });
  it('a failed run changes nothing: same post, same map, no file, changed false', async () => {
    const A = 'https://other.com/a.jpg';
    const post = { ...POST, body: `![x](${A})` };
    const r = await run(post, service({ [A]: 'timeout' }), { map: { '/media/a.webp': { alt: 'k' } } });
    expect(r.post).toEqual(post);
    expect(r.map).toEqual({ '/media/a.webp': { alt: 'k' } });
    expect(r.files).toEqual([]);
    expect(r.changed).toBe(false);
  });
  it('Retry: the same call after the failure hosts the picture', async () => {
    const A = 'https://other.com/a.jpg';
    const post = { ...POST, body: `![Crowd outside venue](${A})` };
    const first = await run(post, service({ [A]: 'timeout' }));
    expect(first.summary.retry).toEqual([A]);
    const second = await run(first.post, service({ [A]: pic(1) }));
    expect(second.items[0].status).toBe('hosted');
    expect(second.changed).toBe(true);
  });
});

describe('failures of the service and of the browser step', () => {
  const A = 'https://other.com/a.jpg';
  const post = { ...POST, body: `![Crowd outside venue](${A})` };
  it('a service that throws, refuses or sends nothing for a picture gives a failed line with a plain sentence', async () => {
    const boom = { fn: vi.fn(async () => { throw new Error('boom'); }) };
    expect((await run(post, boom)).items[0]).toMatchObject({ status: 'failed', reason: 'worker_failed', text: explain('worker_failed') });
    const refuse = { fn: vi.fn(async () => ({ ok: false, reason: 'timeout', status: 429 })) };
    expect((await run(post, refuse)).items[0]).toMatchObject({ status: 'failed', reason: 'timeout' });
    const odd = { fn: vi.fn(async () => ({ ok: false, reason: 'some secret detail' })) };
    expect((await run(post, odd)).items[0].reason).toBe('worker_failed');
    const empty = { fn: vi.fn(async () => ({ ok: true, results: [] })) };
    expect((await run(post, empty)).items[0]).toMatchObject({ status: 'failed', reason: 'missing' });
    const junk = { fn: vi.fn(async () => ({ ok: true })) };
    expect((await run(post, junk)).items[0].reason).toBe('worker_failed');
  });
  it('damaged data: not base64, empty, or a size that does not match', async () => {
    const mk = (r: any) => ({ fn: vi.fn(async () => ({ ok: true, results: [{ url: A, ok: true, kind: 'jpg', ...r }] })) });
    expect((await run(post, mk({ data: '%%%not base64%%%', size: 3 }))).items[0].reason).toBe('bad_data');
    expect((await run(post, mk({ data: '', size: 0 }))).items[0].reason).toBe('bad_data');
    expect((await run(post, mk({ data: toBase64(pic(1)), size: 999 }))).items[0].reason).toBe('bad_data');
  });
  it('an optimizer that throws, returns nothing, returns a JPEG, or a GIF over 5 MB fails that picture only', async () => {
    const svc = () => service({ [A]: pic(1) });
    const wrong = (o: any) => hostPost(post, { fetchPictures: svc().fn, optimize: o, ownHosts: OWN, now: NOW });
    expect((await wrong(async () => { throw new Error('canvas'); })).items[0].reason).toBe('optimize_failed');
    expect((await wrong(async () => null)).items[0].reason).toBe('optimize_failed');
    expect((await wrong(async () => ({ bytes: new Uint8Array(0), ext: 'webp', width: 1, height: 1 }))).items[0].reason).toBe('optimize_failed');
    expect((await wrong(async (b: Uint8Array) => ({ bytes: b, ext: 'jpg', width: 10, height: 10 }))).items[0].reason).toBe('unsupported_format');
    expect((await wrong(async () => ({ bytes: new Uint8Array(GIF_MAX_BYTES + 1), ext: 'gif', width: 10, height: 10 }))).items[0].reason).toBe('gif_too_big');
    expect((await wrong(async () => ({ bytes: new Uint8Array(GIF_MAX_BYTES), ext: 'gif', width: 10, height: 10 }))).items[0].status).toBe('hosted');
  });
});

describe('groups of 30', () => {
  it('asks the service in groups of at most 30 addresses, in order, and hosts all', async () => {
    const urls = Array.from({ length: 65 }, (_, i) => `https://other.com/p${i}.jpg`);
    const table: Record<string, Uint8Array> = {};
    urls.forEach((u, i) => { table[u] = pic(i + 1); });
    const svc = service(table);
    const r = await run({ ...POST, body: urls.map((u, i) => `![Picture number ${i + 1} here](${u})`).join('\n') }, svc);
    expect(svc.calls.map((c) => c.length)).toEqual([30, 30, 5]);
    expect(svc.calls.flat()).toEqual(urls);
    expect(r.summary.counts.hosted).toBe(65);
    expect(new Set(r.files.map((f: any) => f.src)).size).toBe(65);
  });
  it('a group that got no answer fails only its own pictures', async () => {
    const urls = Array.from({ length: 31 }, (_, i) => `https://other.com/p${i}.jpg`);
    const table: Record<string, Uint8Array> = {};
    urls.forEach((u, i) => { table[u] = pic(i + 1); });
    let n = 0;
    const fn = vi.fn(async (group: string[]) => { n++; if (n === 2) throw new Error('down'); return { ok: true, results: group.map((url) => ({ url, ok: true, kind: 'jpg', size: table[url].length, data: toBase64(table[url]) })) }; });
    const r = await run({ ...POST, body: urls.map((u, i) => `![Picture number ${i + 1} here](${u})`).join('\n') }, { fn });
    expect(r.summary.counts).toMatchObject({ hosted: 30, failed: 1 });
    expect(r.summary.retry).toEqual([urls[30]]);
  });
  it('the batch size is the one of the Worker, and the fake service behaves like the real Worker code', async () => {
    expect(WORKER_BATCH).toBe(MAX_PER_CALL);
    const A = 'https://other.com/a.jpg';
    const realFake = async (urls: string[]) => {
      const out = await realFetchPictures(urls, { fetch: async () => new Response(pic(9)), resolveHost: async () => ['93.184.216.34'] });
      return { ok: out.ok, results: out.results.map((x: any) => (x.ok ? { url: x.url, ok: true, kind: x.kind, size: x.bytes.length, data: toBase64(x.bytes) } : x)) };
    };
    const r = await hostPost({ ...POST, body: `![Crowd outside venue](${A})` }, { fetchPictures: realFake, optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0].status).toBe('hosted');
  });
});

describe('helpers', () => {
  it('sha256Hex matches the known value for "abc" and for nothing', async () => {
    expect(await sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('fromBase64 is the opposite of toBase64 and throws on bad text', () => {
    const b = Uint8Array.from({ length: 70000 }, (_, i) => i % 251);
    expect(Array.from(fromBase64(toBase64(b))).slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(fromBase64(toBase64(b)).length).toBe(70000);
    expect(() => fromBase64('***')).toThrow();
    expect(fromBase64('')).toEqual(new Uint8Array(0));
  });
  it('every reason word of the Worker and of the run has a plain sentence; an unknown word gets a general one', () => {
    for (const w of ['bad_url', 'not_https', 'bad_port', 'credentials', 'private_host', 'blocked_host', 'too_many_redirects', 'dns_failed', 'not_found', 'http_error', 'too_big', 'timeout', 'network', 'not_image', 'svg_refused', 'call_too_big', 'worker_failed', 'optimize_failed', 'unsupported_format', 'gif_too_big', 'bad_data', 'missing', 'needs_confirm']) {
      expect(REASON_WORDS, w).toContain(w);
      expect(explain(w).length).toBeGreaterThan(10);
      expect(explain(w)).toMatch(/\.$/);
    }
    expect(explain('zzz')).toBe('The picture could not be hosted.');
    expect(explain(undefined as any)).toBe('The picture could not be hosted.');
  });
});
