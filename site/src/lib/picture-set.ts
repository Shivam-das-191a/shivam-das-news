/**
 * The srcset and sizes of a hosted picture on the public site (PLAN 34.5, LOGICS 22; Phase 3c Part 4c-5, v0.101.66).
 * Pure: no file reading here (the caller may pass `exists`). `config/media.json` keeps, for a picture that has smaller copies,
 * `"variants": [480, 800, 1200]` (up to 1600) and the true `"width"` of the main file (PLAN 34.6). The copies are named `name.480w.webp` next to the picture.
 * A picture with no `variants` note, no known width, or a copy that is not a file gets no srcset: the page is as before.
 * Facts are never invented: the main file is listed with its stored width, and a copy is listed only when its file exists.
 */
import { mediaKey } from './media-alt';

/** The widths a copy can have: the same as SRCSET_WIDTHS of the dashboard (a test keeps them equal). A copy is made only when it is narrower than the main file. */
export const COPY_WIDTHS = [480, 800, 1200, 1600] as const;

/** `sizes` for each place a picture is drawn (the widths follow site/src/styles/global.css; a slightly large guess only loads a slightly larger copy). */
export const SIZES = {
  /** The picture at the top of an article: the card of the article column (wrap 1200, card padding, borders). */
  article: '(min-width: 1200px) 1100px, (min-width: 768px) calc(100vw - 100px), calc(100vw - 60px)',
  /** The lead story on the home page: the wide image next to the text (1.3fr of 2.3fr), full width on a phone. */
  lead: '(min-width: 1200px) 630px, (min-width: 768px) 55vw, calc(100vw - 40px)',
  /** A picture inside the article text: the text column (70 characters wide, about 660 pixels) on a tablet and a desktop, the page width on a phone. */
  body: '(min-width: 768px) 660px, calc(100vw - 60px)',
  /** A story card in a grid: about four columns on a desktop, two on a tablet, one on a phone. */
  card: '(min-width: 1024px) 300px, (min-width: 768px) 50vw, calc(100vw - 40px)',
} as const;

export type PictureSet = { srcset: string; sizes: string };

const COPY_NAME = /\.\d+w\.webp$/;
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** The address of one copy of a main picture (`/media/a.webp` and 480 give `/media/a.480w.webp`). */
export const copyPath = (main: string, width: number): string => `${main.slice(0, -'.webp'.length)}.${width}w.webp`;

/**
 * The srcset and sizes for one picture, or null when the page must use the plain `src`.
 * map: config/media.json. src: the address written in the post. sizes: one of SIZES (or any `sizes` text).
 * exists: optional, true when a file of the site is there (the build passes it, so a srcset never names a missing copy).
 */
export function pictureSet(map: unknown, src: string | undefined, sizes: string, exists?: (path: string) => boolean): PictureSet | null {
  const key = mediaKey(src);
  if (!key || key !== src) return null; // not a hosted picture, or the address has a query or hash
  if (!key.endsWith('.webp') || COPY_NAME.test(key)) return null; // only a main .webp picture has copies
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  if (!Object.prototype.hasOwnProperty.call(map, key)) return null;
  const row = (map as Record<string, unknown>)[key];
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!Array.isArray(r.variants) || !whole(r.width)) return null;
  const width = r.width;
  const widths = COPY_WIDTHS.filter((w) => w < width && (r.variants as unknown[]).includes(w) && (!exists || exists(copyPath(key, w))));
  if (!widths.length) return null;
  const srcset = [...widths.map((w) => `${copyPath(key, w)} ${w}w`), `${key} ${width}w`].join(', ');
  return { srcset, sizes };
}

const IMG_TAG = /<img\b[^>]*>/gi;
const SRC_ATTR = /(\ssrc\s*=\s*)(["'])([^"']*)\2/i;

/**
 * v0.101.67 (Part 4c-6): the pictures INSIDE the article text. Every `<img>` of the html whose `src` is a hosted picture with copies
 * gets `srcset` and `sizes` right after its `src`. A tag that already has `srcset` or `sizes`, a picture with no copies and any other tag are left exactly as they are.
 * Text that is only shown as code is escaped (`&lt;img`), so it is never touched.
 */
export function withPictureSets(html: string, map: unknown, sizes: string, exists?: (path: string) => boolean): string {
  return String(html ?? '').replace(IMG_TAG, (tag) => {
    if (/\s(srcset|sizes)\s*=/i.test(tag)) return tag;
    const m = SRC_ATTR.exec(tag);
    if (!m) return tag;
    const set = pictureSet(map, m[3], sizes, exists);
    if (!set) return tag;
    return tag.replace(SRC_ATTR, `${m[0]} srcset="${set.srcset}" sizes="${set.sizes}"`);
  });
}
