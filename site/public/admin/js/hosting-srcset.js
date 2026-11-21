// Auto image hosting, the picture sizes for srcset (PLAN 34.5, LOGICS 22; Phase 3c Part 4c-1, v0.101.58).
// Pure: no network, no screen, no storage, no clock. Nothing calls it yet, so no file is made and no page changes.
// One hosted picture /media/2026/11/city-hall-vote.webp may get smaller copies next to it, named with a DOT and the width:
//   /media/2026/11/city-hall-vote.480w.webp   (a main name never holds a dot: seoName makes only a-z, 0-9 and hyphens, and the rename check refuses a dot)
//   parseVariant(path)               { base, width } when the name is a copy of a picture, else null
//   canHaveVariants(path)            true for a .webp under /media/ that is not itself a copy (a GIF, JPEG or PNG gets none)
//   variantPath(path, width)         the address of one copy; throws a plain message for a width not in SRCSET_WIDTHS or a file that cannot have copies
//   variantWidths(info)              the widths that need a copy: the widths of SRCSET_WIDTHS that are STRICTLY narrower than the picture (the main file is its own largest size)
//   variantsFor(path, info)          [{ width, height, path }] the copies to make, narrowest first, height scaled and rounded (at least 1)
//   srcsetValue(path, info)          the text of the srcset attribute: the copies and then the main file with its true width; '' when there is no copy
//   variantsOnList(path, allPaths)   the copies of this picture that exist in a list of paths (for a later delete or rename of the picture)
//   isVariantOf(path, allPaths)      true when the path is a copy AND its main picture is in the list (a copy without a main file stays visible, so it is never hidden by mistake)
//   withoutVariants(allPaths)        the list without the copies (for the Files screen, so a copy does not show as its own picture)
// Facts are never invented: a picture whose size is not known gets no copies and no srcset (a plain message is thrown instead).
import { SRCSET_WIDTHS } from './hosted-meta.js';
import { isMediaPath } from './media-meta.js';

const whole = (n) => Number.isInteger(n) && n > 0;
const COPY = /^(.+)\.(\d+)w\.webp$/;

/** { base, width } when the path is a copy of a picture (the name ends in .<width>w.webp with a width of SRCSET_WIDTHS), else null. */
export function parseVariant(path) {
  const m = COPY.exec(String(path ?? ''));
  if (!m) return null;
  const width = Number(m[2]);
  if (!SRCSET_WIDTHS.includes(width) || String(width) !== m[2]) return null; // "0480" is not 480: a copy name is exactly what variantPath makes
  const base = `${m[1]}.webp`;
  return isMediaPath(base) ? { base, width } : null;
}

/** True for a .webp file under /media/ that is not a copy itself. */
export function canHaveVariants(path) {
  const p = String(path ?? '');
  return isMediaPath(p) && p.endsWith('.webp') && parseVariant(p) === null;
}

/** The address of the copy of `path` at `width`. Throws a plain message for a width that is not in SRCSET_WIDTHS and for a file that cannot have copies. */
export function variantPath(path, width) {
  if (!canHaveVariants(path)) throw new Error('Only a .webp picture in /media/ can have smaller copies.');
  if (!SRCSET_WIDTHS.includes(width)) throw new Error(`A smaller copy can only be ${SRCSET_WIDTHS.join(', ')} pixels wide.`);
  return `${path.slice(0, -'.webp'.length)}.${width}w.webp`;
}

/** Widths that need a copy: those of SRCSET_WIDTHS narrower than the picture. Throws a plain message when the width is not known. */
export function variantWidths(info = {}) {
  if (!whole(info.width)) throw new Error('The picture width is not known, so smaller copies cannot be planned.');
  return SRCSET_WIDTHS.filter((w) => w < info.width);
}

/** The copies to make for one picture: [{ width, height, path }], narrowest first. info: { width, height }. A file that cannot have copies gives []. */
export function variantsFor(path, info = {}) {
  if (!canHaveVariants(path)) return [];
  const widths = variantWidths(info);
  if (!whole(info.height)) throw new Error('The picture height is not known, so smaller copies cannot be planned.');
  return widths.map((width) => ({ width, height: Math.max(1, Math.round((info.height * width) / info.width)), path: variantPath(path, width) }));
}

/** The text of the srcset attribute: the copies and then the main file with its true width. '' when there is no copy to offer. */
export function srcsetValue(path, info = {}) {
  const list = variantsFor(path, info);
  if (!list.length) return '';
  return [...list.map((v) => `${v.path} ${v.width}w`), `${path} ${info.width}w`].join(', ');
}

/** The copies of `path` that exist in a list of paths, narrowest first. A file that cannot have copies gives []. */
export function variantsOnList(path, allPaths = []) {
  if (!canHaveVariants(path)) return [];
  const have = new Set(Array.isArray(allPaths) ? allPaths : []);
  return SRCSET_WIDTHS.map((w) => variantPath(path, w)).filter((p) => have.has(p));
}

/** True when `path` is a copy and its main picture is in the list. */
export function isVariantOf(path, allPaths = []) {
  const v = parseVariant(path);
  return v !== null && new Set(Array.isArray(allPaths) ? allPaths : []).has(v.base);
}

/** The list without the copies (a new list; the order stays; a copy whose main picture is missing stays, so nothing disappears by mistake). */
export function withoutVariants(allPaths = []) {
  const list = Array.isArray(allPaths) ? allPaths : [];
  const have = new Set(list);
  return list.filter((p) => { const v = parseVariant(p); return !(v !== null && have.has(v.base)); });
}
