import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isLive } from '../../src/lib/live';
import { missingLocalImage } from '../../src/lib/media';

const now = new Date('2026-11-13T12:00:00Z');

describe('scheduled posts (v0.2.2)', () => {
  it('past and present dates are live', () => {
    expect(isLive(new Date('2026-11-13T11:59:59Z'), now)).toBe(true);
    expect(isLive(now, now)).toBe(true);
  });
  it('future dates are not live yet', () => {
    expect(isLive(new Date('2026-11-13T12:00:01Z'), now)).toBe(false);
  });
});

describe('local image check (v0.2.2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  fs.mkdirSync(path.join(dir, 'media'));
  fs.writeFileSync(path.join(dir, 'media', 'a.webp'), 'x');
  it('accepts an image that exists', () => {
    expect(missingLocalImage('/media/a.webp', dir)).toBeNull();
  });
  it('reports an image that is missing', () => {
    expect(missingLocalImage('/media/nope.webp', dir)).toContain('not found');
  });
  it('does not check remote images or empty values', () => {
    expect(missingLocalImage('https://cdn.test/a.webp', dir)).toBeNull();
    expect(missingLocalImage(undefined, dir)).toBeNull();
  });
});

describe('image width (v0.2.3)', () => {
  it('reads the real pixel width of a local image and skips remote or missing ones', async () => {
    const sharp = (await import('sharp')).default;
    const { imageWidth } = await import('../../src/lib/media');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
    await sharp({ create: { width: 800, height: 450, channels: 3, background: '#888' } }).png().toFile(path.join(d, 'small.png'));
    expect(await imageWidth('/small.png', d)).toBe(800);
    expect(await imageWidth('/missing.png', d)).toBeNull();
    expect(await imageWidth('https://cdn.test/a.png', d)).toBeNull();
  });
});
