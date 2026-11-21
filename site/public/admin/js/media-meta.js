// File editor rules (PLAN 33.3, LOGICS 21; Phase 3b Part 7a, v0.101.27). Pure: no screen, no network, no storage.
// Alt text, caption and credit of a picture are kept in config/media.json, one entry per file path:
//   { "/media/2026/11/photo.webp": { "alt": "...", "caption": "...", "credit": "..." } }
// A post still keeps its own imageAlt for the featured image, and the post value wins (PLAN 33.3).
import { MIN_IMAGE_WIDTH } from './validate.js';

export const ALT_WARN = 125; // PLAN 33.3: "recommended up to 125 characters"
export const ALT_STOP = 300; // proposed (INCOMPLETE decision 47)
export const CAPTION_STOP = 300; // proposed (decision 47)
export const CREDIT_STOP = 120; // proposed (decision 47)
export const SIZE_WARN_BYTES = 300 * 1024; // proposed speed budget for one picture (decision 47); a warning only
export const MEDIA_ROOT = '/media/';

// Same pattern as scripts/no-emoji-lib.mjs: the copyright, registered and trade mark signs are allowed.
const EMOJI = /(?![\u00A9\u00AE\u2122])(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}])/u;
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const len = (s) => [...clean(s)].length;

/** A file path the editor accepts as a key: starts with /media/, no "..", no query or hash, ends with a picture extension. */
export function isMediaPath(p) {
  const s = String(p ?? '');
  return s.startsWith(MEDIA_ROOT) && !s.includes('..') && !/[?#\s]/.test(s) && /\.(webp|jpe?g|png|gif|svg|avif)$/i.test(s);
}

/** Red errors of one entry { alt, caption, credit }. Empty fields are fine. */
export function mediaErrors(entry = {}) {
  const e = entry || {};
  const errors = [];
  if (len(e.alt) > ALT_STOP) errors.push(`The alt text is ${len(e.alt)} characters; the limit is ${ALT_STOP}.`);
  if (len(e.caption) > CAPTION_STOP) errors.push(`The caption is ${len(e.caption)} characters; the limit is ${CAPTION_STOP}.`);
  if (len(e.credit) > CREDIT_STOP) errors.push(`The credit is ${len(e.credit)} characters; the limit is ${CREDIT_STOP}.`);
  if (EMOJI.test(`${clean(e.alt)} ${clean(e.caption)} ${clean(e.credit)}`)) errors.push('The alt text, caption and credit must not contain emoji (icons are SVG only).');
  return errors;
}

/**
 * Set the fields of one file in the stored map and return a new map (the input is not changed).
 * An empty value removes that key; an entry left with no key is removed; keys this screen does not own are kept.
 */
export function mergeMedia(map, path, fields) {
  if (!isMediaPath(path)) throw new Error(`"${path}" is not a file under /media/.`);
  const out = { ...(map && typeof map === 'object' && !Array.isArray(map) ? map : {}) };
  const entry = { ...(out[path] && typeof out[path] === 'object' ? out[path] : {}) };
  for (const [k, v] of Object.entries(fields || {})) {
    const t = typeof v === 'string' ? clean(v) : v;
    if (t === '' || t == null) delete entry[k];
    else entry[k] = t;
  }
  if (Object.keys(entry).length) out[path] = entry;
  else delete out[path];
  return out;
}

/** The alt text of a file: the post's own imageAlt wins, then the stored one, then ''. */
export function altFor(map, path, postAlt = '') {
  return clean(postAlt) || clean(map && map[path] && map[path].alt);
}

/** False for camera and phone names (IMG_1234, DSC00012, PXL_2026...), screenshots, bare numbers and very short names. */
export function readableName(pathOrName) {
  const file = String(pathOrName ?? '').split('/').pop().replace(/\.[^.]+$/, '');
  const stem = file.toLowerCase().replace(/[_\s]+/g, '-');
  if (stem.length < 3) return false;
  if (/^\d+$/.test(stem)) return false;
  if (/^(img|dsc|dscn|dscf|pxl|mvimg|vid|photo|image|picture|pic|screenshot|screen-shot|untitled|scan|wp|download|unnamed)(-?\d+)?(-\d+)?$/.test(stem)) return false;
  if (/^(img|dsc|pxl|photo|image|screenshot)-?\d{4,}/.test(stem)) return false;
  if (/^\d{8}-\d{4,6}/.test(stem)) return false;
  return true;
}

/**
 * Image SEO checks of one file (PLAN 33.3). info: { path, width, bytes, alt, featured }.
 * Returns [{ code, text }]; all are warnings (the picture is never refused here). Unknown width or size skips that check.
 */
export function imageChecks(info = {}) {
  const w = [];
  if (!clean(info.alt)) w.push({ code: 'alt', text: 'No alt text. Describe the picture in a short sentence.' });
  else if (len(info.alt) > ALT_WARN) w.push({ code: 'alt-long', text: `The alt text is ${len(info.alt)} characters; up to ${ALT_WARN} is recommended.` });
  if (!readableName(info.path)) w.push({ code: 'name', text: 'The file name does not say what the picture shows (for example IMG_1234). Rename it.' });
  if (info.featured && Number.isFinite(info.width) && info.width < MIN_IMAGE_WIDTH) w.push({ code: 'width', text: `Only ${info.width} px wide; a featured image needs at least ${MIN_IMAGE_WIDTH} px.` });
  const ext = (String(info.path ?? '').match(/\.([a-z0-9]+)$/i) || [])[1];
  if (ext && !/^(webp|gif|svg)$/i.test(ext)) w.push({ code: 'format', text: 'Not a WebP file. WebP is smaller and loads faster.' });
  if (Number.isFinite(info.bytes) && info.bytes > SIZE_WARN_BYTES) w.push({ code: 'size', text: `${Math.round(info.bytes / 1024)} KB; keep a picture under ${Math.round(SIZE_WARN_BYTES / 1024)} KB.` });
  return w;
}

/**
 * The pattern that finds one picture address inside a text (Phase 3b Part 8d-2, v0.101.34; the same rule for "Used in", delete and rename).
 * A longer name that only starts the same does not count (a.webp.bak, a.webp-large), but a full stop that ends a sentence does (see a.webp.).
 */
export function pathPattern(path, flags = '') {
  const esc = String(path ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`, flags);
}

/** Which content files show this picture. items: [{ file, text }]. A longer file name that only starts the same does not count. */
export function usedIn(path, items = []) {
  const p = String(path ?? '');
  if (!isMediaPath(p)) return [];
  const re = pathPattern(p);
  return items.filter((i) => re.test(String(i.text ?? ''))).map((i) => i.file);
}

/** Which content files use this picture as their featured image (front matter line `image: <path>`). items: [{ file, text }]. */
export function featuredIn(path, items = []) {
  const p = String(path ?? '');
  if (!isMediaPath(p)) return [];
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^image:[ \\t]*["']?${esc}["']?[ \\t]*$`, 'm');
  return items.filter((i) => re.test(String(i.text ?? ''))).map((i) => i.file);
}

/** Paths of the files that have no alt text yet (for the bulk screen). files: [path]. */
export function missingAlt(files = [], map = {}) {
  return files.filter((f) => isMediaPath(f) && !clean(map && map[f] && map[f].alt));
}

/**
 * Bulk alt text (PLAN 33.3 "Bulk alt text"; Phase 3b Part 8a, v0.101.30). rows: [{ path, alt }].
 * A row with an empty alt is skipped: the bulk table is for files without alt text and never removes one.
 * A row whose alt equals the stored one is skipped; the first row of a path wins.
 * All or nothing: with any error the stored map comes back unchanged and `changed` is empty.
 * Returns { map, changed: [paths], errors: [{ path, message }] }. The input is not changed.
 */
export function mergeAltBulk(map, rows = []) {
  const base = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  const errors = [];
  const todo = [];
  const seen = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const path = r && r.path;
    const alt = clean(r && r.alt);
    if (!alt) continue;
    if (!isMediaPath(path)) { errors.push({ path: String(path), message: `"${path}" is not a file under ${MEDIA_ROOT}.` }); continue; }
    if (seen.has(path)) continue;
    seen.add(path);
    const bad = mediaErrors({ alt });
    if (bad.length) { errors.push({ path, message: bad[0] }); continue; }
    if (clean(base[path] && base[path].alt) === alt) continue;
    todo.push({ path, alt });
  }
  if (errors.length) return { map: base, changed: [], errors };
  let out = base;
  for (const t of todo) out = mergeMedia(out, t.path, { alt: t.alt });
  return { map: out, changed: todo.map((t) => t.path), errors: [] };
}

/**
 * May this picture be deleted? (PLAN 33.3 "Delete: refused while a post uses the file, with the list of posts"; Phase 3b Part 8b, v0.101.31.)
 * items: [{ file, text }] every content file that can name a picture (posts, pages, authors, config files).
 * Returns { ok, usedBy: [files], reason }. Not a file under /media/ is never ok. The input is not changed.
 */
export function deleteCheck(path, items = []) {
  if (!isMediaPath(path)) return { ok: false, usedBy: [], reason: `"${path}" is not a file under ${MEDIA_ROOT}.` };
  const usedBy = usedIn(path, items);
  if (usedBy.length) return { ok: false, usedBy, reason: `This file is used in ${usedBy.length} ${usedBy.length === 1 ? 'place' : 'places'}, so it cannot be deleted. Remove it there first.` };
  return { ok: true, usedBy: [], reason: '' };
}

/** The stored map without the entry of one file (its alt text, caption and credit go with the file). Returns a new map; the input is not changed. */
export function removeMedia(map, path) {
  const out = { ...(map && typeof map === 'object' && !Array.isArray(map) ? map : {}) };
  delete out[path];
  return out;
}

export const REPLACE_MAX_BYTES = 5 * 1024 * 1024; // proposed hard limit for a replacement picture (INCOMPLETE decision 50)

// Bytes as a Uint8Array, or null. ArrayBuffer.isView (not instanceof) so bytes made in another window or worker still count.
const asBytes = (b) => (ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null);

/** What the first bytes of a file say it is: webp, png, jpg, gif, avif, svg, or '' when unknown. bytes: Uint8Array. */
export function pictureKind(bytes) {
  const b = asBytes(bytes) || new Uint8Array(0);
  const at = (i, text) => text.split('').every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 12 && at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (b.length >= 8 && b[0] === 0x89 && at(1, 'PNG')) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 6 && (at(0, 'GIF87a') || at(0, 'GIF89a'))) return 'gif';
  if (b.length >= 12 && at(4, 'ftyp') && (at(8, 'avif') || at(8, 'avis'))) return 'avif';
  const head = new TextDecoder().decode(b.slice(0, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if ((head.startsWith('<?xml') || head.startsWith('<svg') || head.startsWith('<!--')) && head.includes('<svg')) return 'svg';
  return '';
}

const extOf = (p) => { const m = String(p ?? '').toLowerCase().match(/\.([a-z0-9]+)$/); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : ''; };

/**
 * May this file replace the picture at `path`? (PLAN 33.3 "Replace file: the address stays the same"; Phase 3b Part 8c, v0.101.32.)
 * file: { name, bytes: Uint8Array }. The address never changes, so the new file must really be the same kind as the old one
 * (looked at by its first bytes, not by its name). Returns { ok, errors: [text], warnings: [text] }. Nothing is changed.
 */
export function replaceCheck(path, file = {}) {
  const errors = [];
  const warnings = [];
  if (!isMediaPath(path)) return { ok: false, errors: [`"${path}" is not a file under ${MEDIA_ROOT}.`], warnings };
  const bytes = asBytes(file && file.bytes);
  if (!bytes || !bytes.length) return { ok: false, errors: ['The chosen file is empty.'], warnings };
  const want = extOf(path);
  const got = pictureKind(bytes);
  if (!got) errors.push('This does not look like a picture the site can show.');
  else if (got !== want) errors.push(`The address ends in .${want}, but the chosen file is a ${got.toUpperCase()} picture. Choose a ${want.toUpperCase()} file, so the address can stay the same.`);
  if (bytes.length > REPLACE_MAX_BYTES) errors.push(`The chosen file is ${Math.round(bytes.length / 1024)} KB; the limit is ${Math.round(REPLACE_MAX_BYTES / 1024)} KB.`);
  else if (bytes.length > SIZE_WARN_BYTES) warnings.push(`The chosen file is ${Math.round(bytes.length / 1024)} KB; more than ${Math.round(SIZE_WARN_BYTES / 1024)} KB can slow the page.`);
  return { ok: errors.length === 0, errors, warnings };
}
