// Browser-only image helpers: convert to WebP, cap the width, read the size. (Needs canvas.)
export const MAX_WIDTH = 2400;
export const QUALITY = 85; // percent, as in PLAN 34.3 step 5

/** The number for canvas.toBlob from a quality in percent: a whole number from 1 to 100 gives 0.01 to 1; anything else gives the default (0.85). Part 7h (v0.101.76). */
export function qualityFraction(percent) {
  const ok = Number.isInteger(percent) && percent >= 1 && percent <= 100;
  return (ok ? percent : QUALITY) / 100;
}

export async function prepareImage(file, maxWidth = MAX_WIDTH, quality = QUALITY) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif')
    return { bytes: new Uint8Array(await file.arrayBuffer()), ext: file.type === 'image/gif' ? 'gif' : 'svg', width: null, height: null };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bmp.width);
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bmp, 0, 0, width, height);
  const q = qualityFraction(quality);
  let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', q));
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q)); ext = 'jpg'; }
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext, width, height, blob };
}

export function sizeOf(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const mediaName = (name, taken) => {
  const base = name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';
  return base;
};
