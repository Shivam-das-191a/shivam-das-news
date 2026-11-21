// Phase 3c Part 7f (PLAN 34.10): read the pixel size of a picture from its first bytes.
// Pure function, no file access, no packages. Nothing calls it yet; a later part uses it for the width limit.
// Supports PNG, JPEG, GIF and WebP (lossy, lossless, extended). Anything else, or a cut file, gives null.

const u16be = (b, i) => (b[i] << 8) | b[i + 1];
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b, i) => ((b[i] * 2 ** 24) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]);
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

function png(b) {
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
  return { type: 'png', width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b) {
  if (b.length < 10) return null;
  return { type: 'gif', width: u16le(b, 6), height: u16le(b, 8) };
}

// A JPEG is a list of segments; the size sits in the first "start of frame" segment.
function jpeg(b) {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (i + 3 >= b.length) return null;
    const size = u16be(b, i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 8 >= b.length) return null;
      return { type: 'jpeg', width: u16be(b, i + 7), height: u16be(b, i + 5) };
    }
    if (size < 2) return null;
    i += 2 + size;
  }
  return null;
}

function webp(b) {
  if (b.length < 30 || ascii(b, 8, 4) !== 'WEBP') return null;
  const kind = ascii(b, 12, 4);
  if (kind === 'VP8X') return { type: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (kind === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] * 2 ** 24)) >>> 0;
    return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { type: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  return null;
}

/** { type, width, height } for a picture given as bytes (Buffer or Uint8Array), or null when it is not a known picture. */
export function imageSize(bytes) {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 10) return null;
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let r = null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') r = png(b);
  else if (b[0] === 0xff && b[1] === 0xd8) r = jpeg(b);
  else if (ascii(b, 0, 3) === 'GIF') r = gif(b);
  else if (ascii(b, 0, 4) === 'RIFF') r = webp(b);
  if (!r || !(r.width > 0) || !(r.height > 0)) return null;
  return r;
}
