// Auto image hosting, the browser picture step (PLAN 34.3 step 5; Phase 3c Part 3c-1, v0.101.45).
// hostPost (hosting-run.js) asks for deps.optimize(bytes, kind). This file makes that function out of prepareImage (image.js), which wants a File and not bytes.
//   optimizePicture(bytes, kind, deps)  one picture: bytes + the kind word of the images Worker -> { bytes, ext: 'webp' | 'gif' | 'jpg', width, height }
//   makeOptimizer(deps)                 the function (bytes, kind) that goes into hostPost as deps.optimize
// It writes nothing and nothing calls it yet, so the live site and the dashboard do not change.
// Rules: an unknown kind or empty bytes is refused with a plain sentence; width and height are always whole numbers above 0 (media-meta needs them), a GIF keeps its bytes
// and its size is read from its first 10 bytes (prepareImage says null for a GIF); a browser that cannot make WebP answers `jpg` and hostPost then fails that picture alone.
// deps (all optional, for tests): prepare (default prepareImage), makeBlob (default new Blob), maxWidth (default MAX_WIDTH of image.js), quality (percent 1 to 100, default QUALITY 85 of image.js; Part 7h, v0.101.76: with no quality given, every call is exactly as before).
// Phase 3c Part 4c-2 (v0.101.59) adds the smaller copies for srcset (PLAN 34.5). The sizes come from hosting-srcset.js; this file only makes the bytes.
//   makeVariants(main, deps)            main = { path, bytes, width, height } of the optimized WebP -> [{ width, height, path, bytes }], narrowest first; [] when the picture cannot have copies
//   makeVariantMaker(deps)              the function (main) that the commit part (4c-3) will call
//   resizeWebp(bytes, width, height)    the default browser step: decode, draw smaller, encode WebP (throws when the browser cannot make WebP)
//   isWebpBytes(bytes)                  true when the bytes start with RIFF....WEBP
// All or nothing: if one copy fails, the whole call throws a plain sentence, so a srcset can never name a copy that does not exist. Nothing calls it yet.
// deps: resize (default resizeWebp).
import { prepareImage, MAX_WIDTH, QUALITY, qualityFraction } from './image.js';
import { variantsFor } from './hosting-srcset.js';

/** The kind words of workers/images/lib.js and the MIME type of each. SVG is not here on purpose: the Worker refuses it. */
export const KIND_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' };

const whole = (n) => Number.isInteger(n) && n > 0;

/** The width and height written in the first 10 bytes of a GIF (GIF87a or GIF89a, 16 bit little endian), or null when the bytes are not a GIF. */
export function gifSize(bytes) {
  if (!bytes || bytes.length < 10) return null;
  const head = String.fromCharCode(...bytes.slice(0, 6));
  if (head !== 'GIF87a' && head !== 'GIF89a') return null;
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return whole(width) && whole(height) ? { width, height } : null;
}

/** Makes one picture ready to host. Throws a plain message when it cannot (hostPost turns that into `optimize_failed`). */
export async function optimizePicture(bytes, kind, deps = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error('There is no picture to convert.');
  const type = KIND_TYPES[String(kind ?? '').toLowerCase()];
  if (!type) throw new Error('This kind of picture is not converted.');
  const prepare = deps.prepare || prepareImage;
  const makeBlob = deps.makeBlob || ((b, t) => new Blob([b], { type: t }));
  let out;
  if (deps.quality !== undefined) out = await prepare(makeBlob(bytes, type), deps.maxWidth === undefined ? MAX_WIDTH : deps.maxWidth, deps.quality);
  else out = deps.maxWidth === undefined ? await prepare(makeBlob(bytes, type)) : await prepare(makeBlob(bytes, type), deps.maxWidth);
  if (!out || !(out.bytes instanceof Uint8Array) || out.bytes.length === 0) throw new Error('The picture could not be converted.');
  let { width, height } = out;
  if (out.ext === 'gif' && !(whole(width) && whole(height))) {
    const size = gifSize(out.bytes);
    if (!size) throw new Error('The size of the GIF could not be read.');
    ({ width, height } = size);
  }
  if (!whole(width) || !whole(height)) throw new Error('The size of the picture could not be read.');
  return { bytes: out.bytes, ext: out.ext, width, height };
}

/** The function for hostPost: `hostPost(post, { optimize: makeOptimizer(), ... })`. */
export const makeOptimizer = (deps = {}) => (bytes, kind) => optimizePicture(bytes, kind, deps);

/** True when the bytes are a WebP file: `RIFF`, four size bytes, `WEBP`. */
export function isWebpBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return false;
  const at = (i, text) => [...text].every((c, k) => bytes[i + k] === c.charCodeAt(0));
  return at(0, 'RIFF') && at(8, 'WEBP');
}

/** The browser step of one copy: decode the main WebP, draw it at width x height, encode WebP. Never makes a picture bigger on its own (the sizes come from variantsFor). */
export async function resizeWebp(bytes, width, height, quality = QUALITY) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, width, height);
  if (typeof bmp.close === 'function') bmp.close();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', qualityFraction(quality)));
  if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot make WebP copies.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** The smaller copies of one hosted picture. main: { path, bytes, width, height } (the result of optimizePicture plus the planned path). A GIF, JPEG, PNG or a picture narrower than 480 gives []. */
export async function makeVariants(main, deps = {}) {
  if (!main || typeof main !== 'object') throw new Error('There is no picture to make copies of.');
  const { path, bytes, width, height } = main;
  const plan = variantsFor(path, { width, height }); // [] for a file that cannot have copies; throws a plain sentence for an unknown size
  if (!plan.length) return [];
  if (!isWebpBytes(bytes)) throw new Error('The picture is not a WebP file, so copies cannot be made.');
  const resize = deps.resize || resizeWebp;
  const out = [];
  for (const v of plan) {
    let copy;
    try { copy = deps.quality === undefined ? await resize(bytes, v.width, v.height) : await resize(bytes, v.width, v.height, deps.quality); } catch (e) { throw new Error(`The ${v.width} pixel copy could not be made: ${e && e.message ? e.message : 'unknown error'}`); }
    if (!isWebpBytes(copy)) throw new Error(`The ${v.width} pixel copy could not be made: the browser did not give a WebP file.`);
    out.push({ width: v.width, height: v.height, path: v.path, bytes: copy });
  }
  return out;
}

/** The function for the commit part: `makeVariantMaker()(main)`. */
export const makeVariantMaker = (deps = {}) => (main) => makeVariants(main, deps);
