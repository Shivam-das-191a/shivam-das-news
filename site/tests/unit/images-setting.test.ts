import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { imagesPathOf, qualityOf, qualityFromText, readImagesQuality, qualityDeps } from '../../public/admin/js/images-setting.js';
// @ts-ignore
import { hostingSetup } from '../../public/admin/js/hosting-setup.js';
// @ts-ignore
import { QUALITY } from '../../public/admin/js/image.js';

const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP, imageCopies: true };
const gh = (extra: any = {}) => ({ token: 'ghp_abcdefghijklmnop1234', commitFiles: vi.fn(), getText: vi.fn(), ...extra });
const setup = (extra: any = {}) => hostingSetup({ cfg: CFG, gh: gh(), postPath: 'site/content/blogs/a/a.md', serializePost: (p: any) => p.body, ...extra });
const PNG = new Uint8Array([1, 2, 3, 4]);

describe('imagesPathOf', () => {
  it('follows contentRoot and falls back to site', () => {
    expect(imagesPathOf({ contentRoot: 'site' })).toBe('site/config/images.json');
    expect(imagesPathOf({ contentRoot: '/site/' })).toBe('site/config/images.json');
    expect(imagesPathOf({ contentRoot: '' })).toBe('config/images.json');
    expect(imagesPathOf({})).toBe('site/config/images.json');
    expect(imagesPathOf(null as any)).toBe('site/config/images.json');
  });
});

describe('qualityOf and qualityFromText', () => {
  it('accepts a whole number from 1 to 100', () => {
    for (const q of [1, 50, 85, 100]) expect(qualityOf({ quality: q })).toBe(q);
  });
  it('gives undefined for everything else', () => {
    for (const q of [0, 101, -5, 85.5, '85', true, null, [], {}, NaN, undefined]) expect(qualityOf({ quality: q as any })).toBeUndefined();
    for (const s of [null, undefined, 5, 'x', [], {}]) expect(qualityOf(s as any)).toBeUndefined();
  });
  it('reads the number from the text of the file', () => {
    expect(qualityFromText('{ "quality": 70 }')).toBe(70);
    expect(qualityFromText('{ "quality": 0 }')).toBeUndefined();
    expect(qualityFromText('{ "hardBlock": false }')).toBeUndefined();
    for (const t of ['', '   ', 'not json', '[1]', 'null', '5', undefined, null, 7]) expect(qualityFromText(t as any)).toBeUndefined();
  });
  it('the shipped file gives 85, the same as QUALITY of image.js', () => {
    const text = readFileSync(new URL('../../config/images.json', import.meta.url), 'utf8');
    expect(qualityFromText(text)).toBe(85);
    expect(QUALITY).toBe(85);
  });
});

describe('readImagesQuality', () => {
  it('reads the file at the right path', async () => {
    const g = gh({ getText: vi.fn(async () => ({ text: '{"quality": 60}', sha: 'abc' })) });
    expect(await readImagesQuality(g, CFG)).toBe(60);
    expect(g.getText).toHaveBeenCalledWith('site/config/images.json');
  });
  it('never throws: a missing file, bad JSON, a bad number or no client give undefined', async () => {
    const e: any = new Error('x'); e.status = 404;
    expect(await readImagesQuality(gh({ getText: vi.fn(async () => { throw e; }) }), CFG)).toBeUndefined();
    expect(await readImagesQuality(gh({ getText: vi.fn(async () => ({ text: '{oops', sha: 'a' })) }), CFG)).toBeUndefined();
    expect(await readImagesQuality(gh({ getText: vi.fn(async () => ({ text: '{"quality": 500}', sha: 'a' })) }), CFG)).toBeUndefined();
    expect(await readImagesQuality(gh({ getText: vi.fn(async () => null) }), CFG)).toBeUndefined();
    for (const bad of [null, undefined, {}, { getText: 5 }, 'gh']) expect(await readImagesQuality(bad as any, CFG)).toBeUndefined();
  });
});

describe('qualityDeps', () => {
  it('adds a valid quality and never changes the given object', () => {
    const d = { maxWidth: 1600 };
    const out = qualityDeps(d, 70);
    expect(out).toEqual({ maxWidth: 1600, quality: 70 });
    expect(d).toEqual({ maxWidth: 1600 });
    expect(out).not.toBe(d);
  });
  it('keeps a quality that the caller already gave, and ignores a wrong number', () => {
    expect(qualityDeps({ quality: 40 }, 70)).toEqual({ quality: 40 });
    for (const q of [0, 101, 70.5, '70', null, undefined, NaN]) expect(qualityDeps({ a: 1 }, q as any)).toEqual({ a: 1 });
    for (const d of [null, undefined, 'x', [], 5]) expect(qualityDeps(d as any, 70)).toEqual({ quality: 70 });
  });
});

describe('hostingSetup with quality (Part 7j)', () => {
  it('passes the quality to the picture step and to the copies step', async () => {
    const prepare = vi.fn(async () => ({ bytes: new Uint8Array([9]), ext: 'webp', width: 800, height: 600 }));
    const resize = vi.fn(async () => new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]));
    const r = setup({ quality: 70, optimizeDeps: { prepare, makeBlob: (b: any) => b }, copyDeps: { resize } });
    expect(r.ok).toBe(true);
    await r.deps.optimize(PNG, 'png');
    expect(prepare.mock.calls[0][2]).toBe(70);
    const main = { path: '/media/a.webp', bytes: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]), width: 1600, height: 900 };
    const copies = await r.deps.makeVariants(main);
    expect(copies.length).toBeGreaterThan(0);
    expect(resize.mock.calls[0][3]).toBe(70);
  });
  it('with no quality, or a wrong one, the steps get exactly what they got before', async () => {
    for (const q of [undefined, 0, 101, '70', 70.5, null]) {
      const prepare = vi.fn(async () => ({ bytes: new Uint8Array([9]), ext: 'webp', width: 800, height: 600 }));
      const r = setup({ quality: q, optimizeDeps: { prepare, makeBlob: (b: any) => b } });
      await r.deps.optimize(PNG, 'png');
      expect(prepare.mock.calls[0].length).toBe(1);
    }
  });
  it('a quality in optimizeDeps wins over the file number', async () => {
    const prepare = vi.fn(async () => ({ bytes: new Uint8Array([9]), ext: 'webp', width: 800, height: 600 }));
    const r = setup({ quality: 70, optimizeDeps: { prepare, makeBlob: (b: any) => b, quality: 40 } });
    await r.deps.optimize(PNG, 'png');
    expect(prepare.mock.calls[0][2]).toBe(40);
  });
  it('does not change the other results of hostingSetup', () => {
    const a = setup();
    const b = setup({ quality: 70 });
    expect(Object.keys(b.deps).sort()).toEqual(Object.keys(a.deps).sort());
    expect(b.deps.mediaPath).toBe(a.deps.mediaPath);
    expect(b.deps.ownHosts).toEqual(a.deps.ownHosts);
  });
});
