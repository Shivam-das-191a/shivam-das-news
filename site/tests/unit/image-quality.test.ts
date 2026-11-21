import { describe, it, expect, vi, afterEach } from 'vitest';
import { QUALITY, MAX_WIDTH, qualityFraction, prepareImage } from '../../public/admin/js/image.js';
import { optimizePicture, makeVariants, resizeWebp } from '../../public/admin/js/hosting-optimize.js';

// Phase 3c Part 7h (PLAN 34.10, quality): the picture quality can be given to the browser steps. With no value given, everything is exactly as before (85 percent).

const WEBP = (() => { const b = new Uint8Array(32); b.set([0x52, 0x49, 0x46, 0x46], 0); b.set([0x57, 0x45, 0x42, 0x50], 8); return b; })();
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/** A fake browser: createImageBitmap, canvas and toBlob; `calls` records the type and the quality number of every toBlob. */
function fakeBrowser(sourceWidth = 3000, sourceHeight = 1500, webpWorks = true) {
  const calls: Array<[string, number]> = [];
  const canvas: any = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => {}, imageSmoothingQuality: '' }),
    toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => {
      calls.push([type, q]);
      cb(type === 'image/webp' && !webpWorks ? new Blob([new Uint8Array([1])], { type: 'image/png' }) : new Blob([WEBP], { type }));
    },
  };
  vi.stubGlobal('createImageBitmap', async () => ({ width: sourceWidth, height: sourceHeight, close: () => {} }));
  vi.stubGlobal('document', { createElement: () => canvas });
  return { calls, canvas };
}
afterEach(() => vi.unstubAllGlobals());

describe('qualityFraction', () => {
  it('turns a whole percent from 1 to 100 into a number from 0.01 to 1', () => {
    expect(qualityFraction(85)).toBe(0.85);
    expect(qualityFraction(1)).toBe(0.01);
    expect(qualityFraction(100)).toBe(1);
    expect(qualityFraction(60)).toBe(0.6);
  });
  it('anything else gives the default 0.85', () => {
    for (const v of [0, -5, 101, 85.5, '85', null, undefined, NaN, Infinity, true, [], {}]) expect(qualityFraction(v as any)).toBe(0.85);
    expect(QUALITY).toBe(85);
  });
});

describe('prepareImage with a quality', () => {
  const file = () => new File([JPG], 'a.jpg', { type: 'image/jpeg' });
  it('with no quality it uses 0.85 for WebP, exactly as before', async () => {
    const { calls } = fakeBrowser();
    const r = await prepareImage(file());
    expect(calls).toEqual([['image/webp', 0.85]]);
    expect(r.ext).toBe('webp');
    expect(r.width).toBe(MAX_WIDTH); // 3000 wide is capped at 2400
  });
  it('a given quality goes to the WebP step', async () => {
    const { calls } = fakeBrowser();
    await prepareImage(file(), MAX_WIDTH, 70);
    expect(calls).toEqual([['image/webp', 0.7]]);
  });
  it('a given quality also goes to the JPEG step when the browser cannot make WebP', async () => {
    const { calls } = fakeBrowser(1000, 500, false);
    const r = await prepareImage(file(), MAX_WIDTH, 60);
    expect(calls).toEqual([['image/webp', 0.6], ['image/jpeg', 0.6]]);
    expect(r.ext).toBe('jpg');
  });
  it('a bad quality falls back to 0.85 and never reaches the browser', async () => {
    const { calls } = fakeBrowser();
    await prepareImage(file(), MAX_WIDTH, 0);
    await prepareImage(file(), MAX_WIDTH, 150);
    expect(calls).toEqual([['image/webp', 0.85], ['image/webp', 0.85]]);
  });
});

describe('optimizePicture and makeVariants with a quality', () => {
  const ok = { bytes: Uint8Array.from([1]), ext: 'webp', width: 10, height: 10 };
  it('no quality: prepare is called as before (one argument, or two with maxWidth)', async () => {
    const prepare = vi.fn(async () => ok);
    await optimizePicture(JPG, 'jpg', { prepare });
    expect(prepare.mock.calls[0]).toHaveLength(1);
    await optimizePicture(JPG, 'jpg', { prepare, maxWidth: 1200 });
    expect(prepare.mock.calls[1]).toHaveLength(2);
    expect(prepare.mock.calls[1][1]).toBe(1200);
  });
  it('a quality is passed on with the default width when no maxWidth is given', async () => {
    const prepare = vi.fn(async () => ok);
    await optimizePicture(JPG, 'jpg', { prepare, quality: 70 });
    expect(prepare).toHaveBeenCalledWith(expect.any(Blob), MAX_WIDTH, 70);
    await optimizePicture(JPG, 'jpg', { prepare, quality: 70, maxWidth: 1600 });
    expect(prepare).toHaveBeenLastCalledWith(expect.any(Blob), 1600, 70);
  });
  it('makeVariants gives the quality to every copy, and nothing extra when none is set', async () => {
    const resize = vi.fn(async () => WEBP);
    const main = { path: '/media/2026/11/a.webp', bytes: WEBP, width: 1600, height: 900 };
    await makeVariants(main, { resize });
    for (const c of resize.mock.calls) expect(c).toHaveLength(3);
    const resize2 = vi.fn(async () => WEBP);
    await makeVariants(main, { resize: resize2, quality: 70 });
    expect(resize2.mock.calls.length).toBeGreaterThan(0);
    for (const c of resize2.mock.calls) expect(c[3]).toBe(70);
  });
  it('resizeWebp uses 0.85 by default and the given quality otherwise', async () => {
    const a = fakeBrowser();
    await resizeWebp(WEBP, 480, 270);
    expect(a.calls).toEqual([['image/webp', 0.85]]);
    vi.unstubAllGlobals();
    const b = fakeBrowser();
    await resizeWebp(WEBP, 480, 270, 60);
    expect(b.calls).toEqual([['image/webp', 0.6]]);
  });
});
