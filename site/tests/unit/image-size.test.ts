import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
// @ts-ignore plain .mjs
import { imageSize } from '../../scripts/image-size-lib.mjs';

const make = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } });

describe('imageSize (Phase 3c Part 7f)', () => {
  it('reads a PNG', async () => {
    const b = await make(640, 360).png().toBuffer();
    expect(imageSize(b)).toEqual({ type: 'png', width: 640, height: 360 });
  });
  it('reads a JPEG', async () => {
    const b = await make(1200, 630).jpeg().toBuffer();
    expect(imageSize(b)).toEqual({ type: 'jpeg', width: 1200, height: 630 });
  });
  it('reads a lossy WebP', async () => {
    const b = await make(800, 450).webp({ quality: 70 }).toBuffer();
    expect(imageSize(b)).toEqual({ type: 'webp', width: 800, height: 450 });
  });
  it('reads a lossless WebP', async () => {
    const b = await make(321, 123).webp({ lossless: true }).toBuffer();
    expect(imageSize(b)).toEqual({ type: 'webp', width: 321, height: 123 });
  });
  it('reads an extended WebP (with a transparent layer)', async () => {
    const b = await sharp({ create: { width: 500, height: 250, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).webp().toBuffer();
    const r = imageSize(b);
    expect(r.type).toBe('webp');
    expect([r.width, r.height]).toEqual([500, 250]);
  });
  it('reads a GIF', async () => {
    const b = await make(90, 60).gif().toBuffer();
    expect(imageSize(b)).toEqual({ type: 'gif', width: 90, height: 60 });
  });
  it('a JPEG with extra segments before the frame (comment, app data) is still read', async () => {
    const plain = await make(256, 128).jpeg().toBuffer();
    const extra = Buffer.from([0xff, 0xfe, 0x00, 0x08, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x21]); // a comment segment
    const withExtra = Buffer.concat([plain.subarray(0, 2), extra, plain.subarray(2)]);
    expect(imageSize(withExtra)).toEqual({ type: 'jpeg', width: 256, height: 128 });
  });
  it('works with a plain Uint8Array and with a list of numbers', async () => {
    const b = await make(40, 30).png().toBuffer();
    expect(imageSize(new Uint8Array(b))).toEqual({ type: 'png', width: 40, height: 30 });
    expect(imageSize([...b])).toEqual({ type: 'png', width: 40, height: 30 });
  });
  it('gives null for text, an empty file, a missing value and a cut picture', async () => {
    expect(imageSize(Buffer.from('this is not a picture at all'))).toBeNull();
    expect(imageSize(Buffer.alloc(0))).toBeNull();
    expect(imageSize(null)).toBeNull();
    expect(imageSize(undefined)).toBeNull();
    const png = await make(64, 64).png().toBuffer();
    expect(imageSize(png.subarray(0, 12))).toBeNull();
    const webp = await make(64, 64).webp().toBuffer();
    expect(imageSize(webp.subarray(0, 20))).toBeNull();
    const jpg = await make(64, 64).jpeg().toBuffer();
    expect(imageSize(jpg.subarray(0, 6))).toBeNull();
  });
  it('gives null when the size would be zero', () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    Buffer.from('IHDR').copy(png, 12); // width and height stay 0
    expect(imageSize(png)).toBeNull();
  });
  it('an SVG is not a known picture (it has no pixel size)', () => {
    expect(imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))).toBeNull();
  });
});
