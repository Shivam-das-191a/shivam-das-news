import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { makeVariants, makeVariantMaker, resizeWebp, isWebpBytes, optimizePicture } from '../../public/admin/js/hosting-optimize.js';
// @ts-ignore plain JS module
import { srcsetValue, variantsFor } from '../../public/admin/js/hosting-srcset.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const enc = (s: string) => new TextEncoder().encode(s);
const webp = (...extra: number[]) => Uint8Array.from([...enc('RIFF'), 0, 0, 0, 0, ...enc('WEBP'), ...extra]);
const PATH = '/media/2026/11/city-hall-vote.webp';
const main = (width: number, height: number, path = PATH, bytes = webp(1, 2, 3)) => ({ path, bytes, width, height });
const okResize = () => vi.fn(async (_b: Uint8Array, w: number) => webp(w & 255, w >> 8));

afterEach(() => { vi.unstubAllGlobals(); });

describe('isWebpBytes', () => {
  it('is true for RIFF, four size bytes, WEBP', () => {
    expect(isWebpBytes(webp())).toBe(true);
    expect(isWebpBytes(webp(1, 2, 3, 4, 5))).toBe(true);
  });
  it('is false for anything else', () => {
    expect(isWebpBytes(enc('RIFF....WEBX'))).toBe(false);
    expect(isWebpBytes(enc('RIFX....WEBP'))).toBe(false);
    expect(isWebpBytes(enc('RIFF....WEB'))).toBe(false); // too short
    expect(isWebpBytes(new Uint8Array(0))).toBe(false);
    expect(isWebpBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe(false);
    for (const bad of [null, undefined, 'RIFF....WEBP', [82, 73, 70, 70], new ArrayBuffer(12)]) expect(isWebpBytes(bad as any)).toBe(false);
  });
});

describe('makeVariants: which copies', () => {
  it('a 2400 wide picture gets 480, 800, 1200 and 1600, narrowest first, with the height scaled', async () => {
    const resize = okResize();
    const r = await makeVariants(main(2400, 1200), { resize });
    expect(r.map((v: any) => [v.width, v.height, v.path])).toEqual([
      [480, 240, '/media/2026/11/city-hall-vote.480w.webp'],
      [800, 400, '/media/2026/11/city-hall-vote.800w.webp'],
      [1200, 600, '/media/2026/11/city-hall-vote.1200w.webp'],
      [1600, 800, '/media/2026/11/city-hall-vote.1600w.webp'],
    ]);
    expect(r.every((v: any) => isWebpBytes(v.bytes))).toBe(true);
    expect(Object.keys(r[0]).sort()).toEqual(['bytes', 'height', 'path', 'width']);
  });
  it('a 1000 wide picture gets 480 and 800 only', async () => {
    const r = await makeVariants(main(1000, 500), { resize: okResize() });
    expect(r.map((v: any) => v.width)).toEqual([480, 800]);
  });
  it('a copy only for a width STRICTLY narrower than the picture', async () => {
    expect((await makeVariants(main(1600, 900), { resize: okResize() })).map((v: any) => v.width)).toEqual([480, 800, 1200]);
    expect((await makeVariants(main(481, 300), { resize: okResize() })).map((v: any) => v.width)).toEqual([480]);
  });
  it('a picture of 480 or less gets no copy and the browser step is never called', async () => {
    const resize = okResize();
    for (const w of [480, 479, 100, 1]) expect(await makeVariants(main(w, 50), { resize })).toEqual([]);
    expect(resize).not.toHaveBeenCalled();
  });
  it('a GIF, JPEG, PNG or a path outside /media/ gets none and the browser step is never called', async () => {
    const resize = okResize();
    for (const p of ['/media/2026/11/spin.gif', '/media/2026/11/a.jpg', '/media/2026/11/a.png', '/other/a.webp', '/media/2026/11/a.480w.webp'])
      expect(await makeVariants(main(2400, 1200, p), { resize }), p).toEqual([]);
    expect(resize).not.toHaveBeenCalled();
  });
  it('the heights are rounded and at least 1', async () => {
    const r = await makeVariants(main(2000, 1), { resize: okResize() });
    expect(r.map((v: any) => v.height)).toEqual([1, 1, 1, 1]);
    const r2 = await makeVariants(main(1000, 333), { resize: okResize() });
    expect(r2.map((v: any) => v.height)).toEqual([160, 266]);
  });
  it('agrees with variantsFor and srcsetValue (the same paths in the same order)', async () => {
    const info = { width: 2400, height: 1350 };
    const r = await makeVariants(main(info.width, info.height), { resize: okResize() });
    expect(r.map((v: any) => ({ width: v.width, height: v.height, path: v.path }))).toEqual(variantsFor(PATH, info));
    expect(srcsetValue(PATH, info)).toBe([...r.map((v: any) => `${v.path} ${v.width}w`), `${PATH} 2400w`].join(', '));
  });
});

describe('makeVariants: the browser step', () => {
  it('is called once for each copy, in order, with the main bytes and the planned size', async () => {
    const resize = okResize();
    const bytes = webp(9, 9);
    await makeVariants(main(1600, 800, PATH, bytes), { resize });
    expect(resize.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([[bytes, 480, 240], [bytes, 800, 400], [bytes, 1200, 600]]);
  });
  it('the bytes of each copy are what the step answered', async () => {
    const r = await makeVariants(main(1000, 500), { resize: async (_b: Uint8Array, w: number) => webp(w === 480 ? 4 : 8) });
    expect(Array.from(r[0].bytes).slice(12)).toEqual([4]);
    expect(Array.from(r[1].bytes).slice(12)).toEqual([8]);
  });
  it('does not change the main bytes', async () => {
    const bytes = webp(1, 2, 3);
    const before = Array.from(bytes);
    await makeVariants(main(1000, 500, PATH, bytes), { resize: okResize() });
    expect(Array.from(bytes)).toEqual(before);
  });
});

describe('makeVariants: refusals, each with a plain sentence, all or nothing', () => {
  it('refuses a missing or wrong main', async () => {
    for (const bad of [null, undefined, 'x', 5]) await expect(makeVariants(bad as any, { resize: okResize() })).rejects.toThrow('There is no picture to make copies of.');
  });
  it('refuses an unknown width or height (a size is never guessed)', async () => {
    const resize = okResize();
    for (const [w, h] of [[0, 5], [null, 5], ['2400', 5], [2400.5, 5]]) await expect(makeVariants(main(w as any, h as any), { resize })).rejects.toThrow('The picture width is not known');
    await expect(makeVariants(main(2400, 0), { resize })).rejects.toThrow('The picture height is not known');
    await expect(makeVariants(main(2400, undefined as any), { resize })).rejects.toThrow('The picture height is not known');
    expect(resize).not.toHaveBeenCalled();
  });
  it('refuses bytes that are not WebP when copies are needed', async () => {
    const resize = okResize();
    for (const bad of [new Uint8Array(0), enc('not a picture at all'), null]) await expect(makeVariants(main(2400, 1200, PATH, bad as any), { resize })).rejects.toThrow('The picture is not a WebP file, so copies cannot be made.');
    await expect(makeVariants({ path: PATH, width: 2400, height: 1200 } as any, { resize })).rejects.toThrow('The picture is not a WebP file, so copies cannot be made.');
    expect(resize).not.toHaveBeenCalled();
  });
  it('bytes that are not WebP are not checked when no copy is needed', async () => {
    expect(await makeVariants(main(300, 200, PATH, enc('x') as any), { resize: okResize() })).toEqual([]);
  });
  it('one failed copy fails the whole call and names the width', async () => {
    const resize = vi.fn(async (_b: Uint8Array, w: number) => { if (w === 800) throw new Error('canvas gone'); return webp(1); });
    await expect(makeVariants(main(2400, 1200), { resize })).rejects.toThrow('The 800 pixel copy could not be made: canvas gone');
    expect(resize).toHaveBeenCalledTimes(2); // it stops at the first failure
  });
  it('an error without a message still gives a plain sentence', async () => {
    await expect(makeVariants(main(1000, 500), { resize: async () => { throw undefined; } })).rejects.toThrow('The 480 pixel copy could not be made: unknown error');
  });
  it('an answer that is not a WebP file fails the call', async () => {
    for (const bad of [new Uint8Array(0), enc('RIFF....WEBX'), null, undefined, [1, 2, 3]])
      await expect(makeVariants(main(1000, 500), { resize: async () => bad as any })).rejects.toThrow('The 480 pixel copy could not be made: the browser did not give a WebP file.');
  });
});

describe('makeVariantMaker', () => {
  it('gives the function that the commit part will call', async () => {
    const resize = okResize();
    const make = makeVariantMaker({ resize });
    expect((await make(main(1000, 500))).map((v: any) => v.width)).toEqual([480, 800]);
    expect(resize).toHaveBeenCalledTimes(2);
  });
  it('works without deps', () => {
    expect(typeof makeVariantMaker()).toBe('function');
  });
});

describe('resizeWebp with a fake canvas', () => {
  function fakeBrowser(o: { webp?: boolean; noClose?: boolean } = {}) {
    const draws: any[] = [];
    const asked: any[] = [];
    const canvases: any[] = [];
    let closed = 0;
    vi.stubGlobal('createImageBitmap', async () => (o.noClose ? { width: 2400, height: 1200 } : { width: 2400, height: 1200, close: () => { closed++; } }));
    vi.stubGlobal('document', { createElement: () => {
      const ctx: any = { imageSmoothingQuality: '', drawImage: (...a: any[]) => draws.push(a) };
      const c: any = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: any, type: string, q: number) => { asked.push([type, q]); cb(o.webp === false ? { type: 'image/png', arrayBuffer: async () => new ArrayBuffer(1) } : { type: 'image/webp', arrayBuffer: async () => webp(7).buffer }); } };
      canvases.push(c); canvases.push(ctx);
      return c;
    } });
    return { draws, asked, canvases, closed: () => closed };
  }
  it('draws at the asked size, encodes WebP at 0.85 and gives the bytes', async () => {
    const b = fakeBrowser();
    const out = await resizeWebp(webp(1), 800, 400);
    expect(isWebpBytes(out)).toBe(true);
    expect(b.draws[0].slice(1)).toEqual([0, 0, 800, 400]);
    expect(b.canvases[0]).toMatchObject({ width: 800, height: 400 });
    expect(b.canvases[1].imageSmoothingQuality).toBe('high');
    expect(b.asked).toEqual([['image/webp', 0.85]]);
    expect(b.closed()).toBe(1);
  });
  it('works when the bitmap has no close method', async () => {
    fakeBrowser({ noClose: true });
    expect(isWebpBytes(await resizeWebp(webp(1), 480, 240))).toBe(true);
  });
  it('a browser that cannot make WebP throws a plain sentence (no jpg copy: the name says webp)', async () => {
    const b = fakeBrowser({ webp: false });
    await expect(resizeWebp(webp(1), 480, 240)).rejects.toThrow('This browser cannot make WebP copies.');
    expect(b.asked).toEqual([['image/webp', 0.85]]);
  });
  it('a picture the browser cannot decode throws the error of the browser', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('decode failed'); });
    await expect(resizeWebp(webp(1), 480, 240)).rejects.toThrow('decode failed');
  });
  it('is the default step of makeVariants and its error is named by width', async () => {
    fakeBrowser({ webp: false });
    await expect(makeVariants(main(1000, 500))).rejects.toThrow('The 480 pixel copy could not be made: This browser cannot make WebP copies.');
  });
  it('with the real default step the copies are WebP files with their own sizes', async () => {
    const b = fakeBrowser();
    const r = await makeVariants(main(2400, 1200));
    expect(r.map((v: any) => v.width)).toEqual([480, 800, 1200, 1600]);
    expect(b.draws.map((d: any) => d.slice(3))).toEqual([[480, 240], [800, 400], [1200, 600], [1600, 800]]);
  });
});

describe('with optimizePicture before it', () => {
  it('the result of the picture step (bytes, width, height) and the planned path are what makeVariants needs', async () => {
    const prepare = async () => ({ bytes: webp(1, 2), ext: 'webp', width: 2400, height: 1600 });
    const picture = await optimizePicture(Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3]), 'jpg', { prepare });
    const r = await makeVariants({ path: PATH, ...picture }, { resize: okResize() });
    expect(r.map((v: any) => [v.width, v.height])).toEqual([[480, 320], [800, 533], [1200, 800], [1600, 1067]]);
  });
  it('a GIF from the picture step gets no copies', async () => {
    const gif = Uint8Array.from([...enc('GIF89a'), 44, 1, 200, 0, 9, 9, 9, 9]);
    const picture = await optimizePicture(gif, 'gif', { prepare: async () => ({ bytes: gif, ext: 'gif', width: null, height: null }) });
    expect(await makeVariants({ path: '/media/2026/11/spin.gif', ...picture }, { resize: okResize() })).toEqual([]);
  });
});

describe('hosting-optimize.js source (4c-2)', () => {
  const s = src('public/admin/js/hosting-optimize.js');
  it('imports only image.js and hosting-srcset.js', () => {
    expect([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort()).toEqual(['./hosting-srcset.js', './image.js']);
  });
  it('does not fetch, store, eval or write a page', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.', 'Date.now', 'Math.random', 'window.']) expect(s).not.toContain(w);
  });
  it('is no file that a page loads: only hosting-setup.js imports it, and only hosting-copies.js and hosting-pipeline.js (the optional dep) name the new functions; hosting-setup.js names the maker only behind the imageCopies switch (Part 4c-4e), which is off by default', () => {
    for (const f of readdirSync(new URL('../../public/admin/js/', import.meta.url))) {
      if (f === 'hosting-optimize.js' || f === 'hosting-copies.js' || f === 'hosting-pipeline.js' || f === 'hosting-setup.js') continue;
      const t = src('public/admin/js/' + f);
      expect(t, f).not.toContain('makeVariants');
      expect(t, f).not.toContain('makeVariantMaker');
      expect(t, f).not.toContain('resizeWebp');
    }
    for (const f of ['public/admin/index.html', 'public/admin/js/main.js']) expect(src(f)).not.toContain('hosting-optimize');
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(src('tests/unit/hosting-variants.test.ts')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
