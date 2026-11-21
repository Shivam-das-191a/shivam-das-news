import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { optimizePicture, makeOptimizer, gifSize, KIND_TYPES } from '../../public/admin/js/hosting-optimize.js';
// @ts-ignore plain JS module
import { hostPost } from '../../public/admin/js/hosting-run.js';
// @ts-ignore plain JS Worker code
import { toBase64 } from '../../../workers/images/lib.js';

const enc = (s: string) => new TextEncoder().encode(s);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(1)]);
const gifBytes = (w: number, h: number) => Uint8Array.from([...enc('GIF89a'), w & 255, w >> 8, h & 255, h >> 8, ...new Array(20).fill(9)]);

afterEach(() => { vi.unstubAllGlobals(); });

describe('gifSize: the size is in the first 10 bytes', () => {
  it('reads GIF89a and GIF87a, 16 bit little endian', () => {
    expect(gifSize(gifBytes(300, 200))).toEqual({ width: 300, height: 200 });
    expect(gifSize(gifBytes(1, 1))).toEqual({ width: 1, height: 1 });
    expect(gifSize(Uint8Array.from([...enc('GIF87a'), 0x2c, 0x01, 0xc8, 0x00]))).toEqual({ width: 300, height: 200 });
    expect(gifSize(gifBytes(65535, 65535))).toEqual({ width: 65535, height: 65535 });
  });
  it('says null for anything else', () => {
    expect(gifSize(JPG)).toBeNull();
    expect(gifSize(new Uint8Array(0))).toBeNull();
    expect(gifSize(undefined as any)).toBeNull();
    expect(gifSize(enc('GIF89a'))).toBeNull(); // too short
    expect(gifSize(gifBytes(0, 10))).toBeNull(); // width 0
    expect(gifSize(gifBytes(10, 0))).toBeNull(); // height 0
    expect(gifSize(enc('GIF90a....'))).toBeNull();
  });
});

describe('optimizePicture: bytes in, the result of prepareImage out', () => {
  it('turns the bytes into a Blob of the right type and returns bytes, ext, width, height', async () => {
    const seen: any[] = [];
    const prepare = vi.fn(async (blob: Blob, ...rest: any[]) => { seen.push([blob.type, blob.size, new Uint8Array(await blob.arrayBuffer()), rest]); return { bytes: Uint8Array.from([1, 2, 3]), ext: 'webp', width: 1600, height: 900, blob: 'ignored' }; });
    const r = await optimizePicture(JPG, 'jpg', { prepare });
    expect(r).toEqual({ bytes: Uint8Array.from([1, 2, 3]), ext: 'webp', width: 1600, height: 900 });
    expect(Object.keys(r).sort()).toEqual(['bytes', 'ext', 'height', 'width']);
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBe('image/jpeg');
    expect(seen[0][1]).toBe(JPG.length);
    expect(Array.from(seen[0][2])).toEqual(Array.from(JPG));
    expect(seen[0][3]).toEqual([]); // the default width limit is left to image.js
  });
  it('every kind word of the Worker has its own type', () => {
    expect(KIND_TYPES).toEqual({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' });
    expect(Object.keys(KIND_TYPES)).not.toContain('svg');
  });
  it('sends the right type for each kind and accepts upper case', async () => {
    const types: string[] = [];
    const prepare = async (b: Blob) => { types.push(b.type); return { bytes: Uint8Array.from([1]), ext: 'webp', width: 2, height: 2 }; };
    for (const k of ['jpg', 'jpeg', 'png', 'webp', 'avif', 'GIF']) await optimizePicture(JPG, k, { prepare });
    expect(types).toEqual(['image/jpeg', 'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
  });
  it('passes a width limit when one is given', async () => {
    const prepare = vi.fn(async () => ({ bytes: Uint8Array.from([1]), ext: 'webp', width: 2, height: 2 }));
    await optimizePicture(JPG, 'png', { prepare, maxWidth: 1200 });
    expect(prepare).toHaveBeenCalledWith(expect.any(Blob), 1200);
  });
  it('a GIF keeps its bytes and the size comes from its header (prepareImage says null)', async () => {
    const gif = gifBytes(300, 200);
    const prepare = async () => ({ bytes: gif, ext: 'gif', width: null, height: null });
    expect(await optimizePicture(gif, 'gif', { prepare })).toEqual({ bytes: gif, ext: 'gif', width: 300, height: 200 });
  });
  it('a GIF size that prepareImage gave is kept, not read again', async () => {
    const gif = gifBytes(300, 200);
    const prepare = async () => ({ bytes: gif, ext: 'gif', width: 640, height: 480 });
    expect(await optimizePicture(gif, 'gif', { prepare })).toMatchObject({ width: 640, height: 480 });
  });
  it('a jpg answer is passed on as jpg (hostPost fails that picture with a plain sentence)', async () => {
    const prepare = async () => ({ bytes: Uint8Array.from([1, 2]), ext: 'jpg', width: 10, height: 10 });
    expect((await optimizePicture(JPG, 'png', { prepare })).ext).toBe('jpg');
  });
});

describe('optimizePicture: refusals, each with a plain sentence', () => {
  const ok = async () => ({ bytes: Uint8Array.from([1]), ext: 'webp', width: 2, height: 2 });
  it('refuses empty bytes and things that are not bytes', async () => {
    for (const bad of [new Uint8Array(0), null, undefined, 'abc', [1, 2, 3], new ArrayBuffer(4)]) await expect(optimizePicture(bad as any, 'jpg', { prepare: ok })).rejects.toThrow('There is no picture to convert.');
  });
  it('refuses an unknown kind, svg and a missing kind, and never calls prepare', async () => {
    const prepare = vi.fn(ok);
    for (const k of ['svg', 'bmp', '', undefined, null, 'tiff']) await expect(optimizePicture(JPG, k as any, { prepare })).rejects.toThrow('This kind of picture is not converted.');
    expect(prepare).not.toHaveBeenCalled();
  });
  it('lets the error of prepareImage go up (hostPost says optimize_failed)', async () => {
    await expect(optimizePicture(JPG, 'jpg', { prepare: async () => { throw new Error('boom'); } })).rejects.toThrow('boom');
  });
  it('refuses an answer without bytes', async () => {
    for (const bad of [null, undefined, {}, { ext: 'webp', width: 2, height: 2 }, { bytes: new Uint8Array(0), ext: 'webp', width: 2, height: 2 }, { bytes: [1, 2], ext: 'webp', width: 2, height: 2 }])
      await expect(optimizePicture(JPG, 'jpg', { prepare: async () => bad as any })).rejects.toThrow('The picture could not be converted.');
  });
  it('refuses a width or height that is not a whole number above 0 (the media row needs both)', async () => {
    for (const [w, h] of [[0, 5], [5, 0], [-1, 5], [5.5, 5], [null, 5], [5, undefined], ['5', 5], [NaN, 5]])
      await expect(optimizePicture(JPG, 'jpg', { prepare: async () => ({ bytes: Uint8Array.from([1]), ext: 'webp', width: w as any, height: h as any }) })).rejects.toThrow('The size of the picture could not be read.');
  });
  it('refuses a GIF whose header cannot be read', async () => {
    const bad = Uint8Array.from([...enc('NOTGIF'), 1, 2, 3, 4, 5]);
    await expect(optimizePicture(bad, 'gif', { prepare: async () => ({ bytes: bad, ext: 'gif', width: null, height: null }) })).rejects.toThrow('The size of the GIF could not be read.');
  });
});

describe('with the real prepareImage and a fake canvas', () => {
  function fakeBrowser(o: { w?: number; h?: number; webp?: boolean } = {}) {
    const draws: any[] = [];
    const asked: string[] = [];
    vi.stubGlobal('createImageBitmap', async () => ({ width: o.w ?? 4000, height: o.h ?? 2000 }));
    vi.stubGlobal('document', { createElement: () => { const c: any = { width: 0, height: 0, getContext: () => ({ drawImage: (...a: any[]) => draws.push(a) }), toBlob: (cb: any, type: string) => { asked.push(type); cb(new Blob([new Uint8Array(7).fill(5)], { type: type === 'image/webp' && o.webp === false ? 'image/png' : type })); } }; return c; } });
    return { draws, asked };
  }
  it('a wide picture is made 2400 wide and becomes WebP', async () => {
    const b = fakeBrowser();
    const r = await optimizePicture(JPG, 'jpg');
    expect(r).toMatchObject({ ext: 'webp', width: 2400, height: 1200 });
    expect(Array.from(r.bytes)).toEqual(new Array(7).fill(5));
    expect(b.asked).toEqual(['image/webp']);
    expect(b.draws[0].slice(1)).toEqual([0, 0, 2400, 1200]);
  });
  it('a small picture is not made bigger', async () => {
    fakeBrowser({ w: 800, h: 600 });
    expect(await optimizePicture(JPG, 'png')).toMatchObject({ width: 800, height: 600 });
  });
  it('maxWidth is used', async () => {
    fakeBrowser();
    expect(await makeOptimizer({ maxWidth: 1000 })(JPG, 'jpg')).toMatchObject({ width: 1000, height: 500 });
  });
  it('a browser that cannot make WebP gives jpg', async () => {
    const b = fakeBrowser({ webp: false });
    expect((await optimizePicture(JPG, 'jpg')).ext).toBe('jpg');
    expect(b.asked).toEqual(['image/webp', 'image/jpeg']);
  });
  it('a GIF goes through unchanged with the size of its header', async () => {
    fakeBrowser();
    const gif = gifBytes(120, 90);
    const r = await optimizePicture(gif, 'gif');
    expect(r).toMatchObject({ ext: 'gif', width: 120, height: 90 });
    expect(Array.from(r.bytes)).toEqual(Array.from(gif));
  });
  it('a picture the browser cannot decode fails with the error of the browser', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('decode failed'); });
    await expect(optimizePicture(JPG, 'jpg')).rejects.toThrow('decode failed');
  });
});

describe('inside hostPost', () => {
  const OWN = ['shivam-das-news.pages.dev'];
  const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' };
  const NOW = new Date('2026-11-17T01:02:03.456Z');
  const svc = (table: Record<string, { bytes: Uint8Array; kind: string }>) => async (urls: string[]) => ({ ok: true, results: urls.map((url) => ({ url, ok: true, kind: table[url].kind, size: table[url].bytes.length, data: toBase64(table[url].bytes) })) });

  it('a GIF is hosted with its real size (before this part a null size would have stopped the media row)', async () => {
    const A = 'https://other.com/spin.gif';
    const gif = gifBytes(300, 200);
    const optimize = makeOptimizer({ prepare: async () => ({ bytes: gif, ext: 'gif', width: null, height: null }) });
    const r = await hostPost({ ...POST, body: `![Spinning logo animation](${A})` }, { fetchPictures: svc({ [A]: { bytes: gif, kind: 'gif' } }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0].status).toBe('hosted');
    expect(r.map['/media/2026/11/spinning-logo-animation.gif']).toMatchObject({ width: 300, height: 200, bytes: gif.length });
  });
  it('a JPEG answer fails only that picture', async () => {
    const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg';
    let n = 0;
    const optimize = makeOptimizer({ prepare: async () => (++n === 1 ? { bytes: Uint8Array.from([1, 2]), ext: 'jpg', width: 10, height: 10 } : { bytes: Uint8Array.from([1, 2]), ext: 'webp', width: 10, height: 10 }) });
    const r = await hostPost({ ...POST, body: `![First picture](${A})\n\n![Second picture](${B})` }, { fetchPictures: svc({ [A]: { bytes: JPG, kind: 'jpg' }, [B]: { bytes: Uint8Array.from([...JPG, 7]), kind: 'jpg' } }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items.map((i: any) => [i.status, i.reason])).toEqual([['failed', 'unsupported_format'], ['hosted', undefined]]);
  });
  it('an error of the optimizer becomes optimize_failed', async () => {
    const A = 'https://other.com/a.jpg';
    const optimize = makeOptimizer({ prepare: async () => { throw new Error('decode failed'); } });
    const r = await hostPost({ ...POST, body: `![First picture](${A})` }, { fetchPictures: svc({ [A]: { bytes: JPG, kind: 'jpg' } }), optimize, ownHosts: OWN, now: NOW });
    expect(r.items[0]).toMatchObject({ status: 'failed', reason: 'optimize_failed' });
    expect(r.changed).toBe(false);
  });
});
