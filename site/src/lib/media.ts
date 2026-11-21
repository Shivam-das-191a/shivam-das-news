/** v0.2.2: a published post must not point to a local image that does not exist (BUGS S9 first step). */
import fs from 'node:fs';
import path from 'node:path';

/** Returns an error message, or null when the image is fine (remote URLs are not checked here). */
export function missingLocalImage(image: string | undefined, publicDir: string): string | null {
  if (!image || /^https?:\/\//i.test(image)) return null;
  const clean = image.split(/[?#]/)[0].replace(/^\/+/, '');
  if (!clean) return `image path "${image}" is empty`;
  return fs.existsSync(path.join(publicDir, clean)) ? null : `image "${image}" not found in public/${clean}`;
}

export const MIN_IMAGE_WIDTH = 1200;

/** v0.2.3: pixel width of a local image, or null when it is remote, missing or unreadable. */
export async function imageWidth(image: string | undefined, publicDir: string): Promise<number | null> {
  if (!image || /^https?:\/\//i.test(image)) return null;
  const file = path.join(publicDir, image.split(/[?#]/)[0].replace(/^\/+/, ''));
  if (!fs.existsSync(file)) return null;
  try {
    const sharp = (await import('sharp')).default;
    return (await sharp(file).metadata()).width ?? null;
  } catch {
    return null;
  }
}
