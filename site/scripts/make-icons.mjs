// Auto icon generator (PLAN section 14). Your real square logo lives at brand/source-icon.png (512x512 or bigger).
// Run: npm run icons   -> writes favicon.ico, favicon-16/32, apple-touch-icon, icon-192/512, icon-maskable-512 and badge-96.png (the notification badge, v0.54.0) into public/
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { makeBadge } from './badge-lib.mjs';

const src = 'brand/source-icon.png';
if (!existsSync(src)) {
  console.error('Missing brand/source-icon.png. Add your real square logo (512x512 or bigger) first. No placeholder icons are made.');
  process.exit(1);
}
mkdirSync('public', { recursive: true });
const png = (px) => sharp(src).resize(px, px, { fit: 'cover' }).png().toBuffer();

const sizes = { 'favicon-32.png': 32, 'favicon-16.png': 16, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
for (const [name, px] of Object.entries(sizes)) {
  writeFileSync(`public/${name}`, await png(px));
  console.log('made', name);
}

// favicon.ico (16, 32, 48 as PNG payloads inside an ICO container)
const list = await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await png(size) })));
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(list.length, 4);
let offset = 6 + 16 * list.length;
const dirs = list.map(({ size, buf }) => {
  const d = Buffer.alloc(16);
  d[0] = size; d[1] = size;
  d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
  d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12);
  offset += buf.length;
  return d;
});
writeFileSync('public/favicon.ico', Buffer.concat([head, ...dirs, ...list.map((l) => l.buf)]));
console.log('made favicon.ico');

// Maskable icon: logo at 86% on the logo's own background colour (safe zone for round and squircle masks).
const px = await sharp(src).removeAlpha().extract({ left: 0, top: 0, width: 120, height: 120 }).resize(1, 1).raw().toBuffer(); // average of the top-left corner
const bg = { r: px[0], g: px[1], b: px[2], alpha: 1 };
const inner = await sharp(src).resize(440, 440, { fit: 'cover' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } }).composite([{ input: inner, gravity: 'center' }]).png().toFile('public/icon-maskable-512.png');
console.log('made icon-maskable-512.png');

// Notification badge (PLAN 31.9): white mark on a clear background, read by the system from its transparency.
writeFileSync('public/badge-96.png', await makeBadge(src));
console.log('made badge-96.png');
