// Makes the notification badge (v0.54.0, PLAN 31.9): a small one-colour image that Android shows in its status bar.
// The system looks only at the transparency, so the picture is white where the logo's mark is and clear everywhere else.
// The mark is found by comparing every pixel with the logo's own background colour (the average of the four corners,
// the same idea as the maskable icon in make-icons.mjs). A logo that has no plain background gives a poor badge:
// then put your own one-colour 96x96 PNG at public/badge-96.png and do not run this step again.
import sharp from 'sharp';

export const BADGE_SIZE = 96;
const CORNER = 8; // pixels on each side of the corner samples
const FLOOR = 30; // colour distance below this counts as background
const FULL = 70;  // colour distance from this up is fully solid

/** Returns the PNG bytes (BADGE_SIZE square, RGBA, white with the mark as transparency). */
export async function makeBadge(src, size = BADGE_SIZE) {
  const { data, info } = await sharp(src).removeAlpha().resize(size, size, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const at = (x, y) => (y * w + x) * 3;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [x0, y0] of [[0, 0], [w - CORNER, 0], [0, h - CORNER], [w - CORNER, h - CORNER]]) {
    for (let y = y0; y < y0 + CORNER; y++) {
      for (let x = x0; x < x0 + CORNER; x++) {
        const i = at(x, y);
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  r /= n;
  g /= n;
  b /= n;
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 3;
    const d = Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b);
    const a = Math.round(Math.min(1, Math.max(0, (d - FLOOR) / (FULL - FLOOR))) * 255);
    out[p * 4] = 255;
    out[p * 4 + 1] = 255;
    out[p * 4 + 2] = 255;
    out[p * 4 + 3] = a;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
