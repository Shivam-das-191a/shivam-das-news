// PLAN 29.3 (hard rule): no emojis anywhere on the site, icons are inline SVG only.
// Used by the build gate (scripts/validate-html.mjs) and by tests/unit/no-emoji.test.ts.
// Plain text symbols that are fine: the copyright, registered and trade mark signs, quotes, dashes, the middle dot, the rupee sign.
// Bengali and other scripts are fine too: the joiner characters (U+200C, U+200D) are only a problem next to a picture, and the picture itself is caught.

const ALLOWED = new Set(['\u00A9', '\u00AE', '\u2122']);
// Pictures, emoji-style symbols, the emoji selector (U+FE0F), the keycap mark (U+20E3) and country flags (regional indicators).
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}]/gu;
// Stricter, for our own templates and scripts: also arrows, shapes, technical and dingbat symbols (U+2190 to U+2BFF) used as icons.
const ICON_GLYPH = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}]|[\u2190-\u2BFF]/gu;

const NAMED = { hearts: '\u2665', spades: '\u2660', clubs: '\u2663', diams: '\u2666', larr: '\u2190', rarr: '\u2192', uarr: '\u2191', darr: '\u2193', harr: '\u2194', crarr: '\u21B5', check: '\u2713', cross: '\u2717', star: '\u2606', starf: '\u2605', phone: '\u260E' };

/** Turns numeric entities (&#9888; and &#x26A0;) and a few named symbol entities into the real characters, so they cannot hide a symbol. */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#(\d{1,7});/g, (m, d) => { const n = Number(d); return n <= 0x10ffff ? String.fromCodePoint(n) : m; })
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (m, h) => { const n = parseInt(h, 16); return n <= 0x10ffff ? String.fromCodePoint(n) : m; })
    .replace(/&([a-zA-Z]+);/g, (m, n) => (Object.prototype.hasOwnProperty.call(NAMED, n) ? NAMED[n] : m));
}

const found = (re, text) => [...new Set((decodeEntities(text).match(re) || []).filter((c) => !ALLOWED.has(c)))];

/** The emoji characters in a text (each once), or []. Used on every built page. */
export const findEmoji = (text) => found(EMOJI, text);

/** Emoji plus symbol characters used as icons (arrows, shapes, dingbats). Used on our own templates, scripts and the design preview. */
export const findIconGlyphs = (text) => found(ICON_GLYPH, text);

/** "U+26A0" style names for a message. */
export const codePoints = (chars) => chars.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(', ');
