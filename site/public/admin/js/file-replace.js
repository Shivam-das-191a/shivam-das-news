// Replace a picture and remove its old smaller copies (PLAN 33.3 "Replace", PLAN 34.5; Phase 3c Part 4c-4d, v0.101.64).
// Pure: no screen, no network, no storage. It only builds the list of what goes into the commit; app.js saves it in ONE commit.
// The address of a replaced picture stays the same, so its smaller copies (name.480w.webp) would still show the OLD picture. They go in the same
// commit, and the `variants` note of the picture goes too (a note that names copies that do not exist would be a false fact). The copies can be made
// again when automatic copies are switched on (a later part). Nothing here makes a copy.
//   planReplace(path, bytes, { sitePaths, pub })   { copies, entries }   the copies of the picture that exist now, and the commit entries (the new bytes first, then each copy as a delete)
//   mapWithoutVariants(map, path)                   { map, changed }      the stored config/media.json object without the `variants` note of this picture
// Facts are never invented: a copy is only deleted when it is in the list of files that exist now (sitePaths).
import { isMediaPath } from './media-meta.js';
import { variantsOnList } from './hosting-srcset.js';

/**
 * path: the site address of the picture (/media/2026/11/a.webp). bytes: the new file. o.sitePaths: [path] every picture that exists now, as the site shows them.
 * o.pub: the repository prefix of /media/... (for example "site/public"). Throws a plain message for a path that is not a picture or is already gone.
 * Returns { copies: [site path], entries: [{ path, bytes } | { path, delete: true }] }. The input is not changed.
 */
export function planReplace(path, bytes, o = {}) {
  if (!isMediaPath(path)) throw new Error(`"${path}" is not a file under /media/.`);
  const sites = Array.isArray(o.sitePaths) ? o.sitePaths : [];
  if (!sites.includes(path)) throw new Error('That file is already gone. Refresh the page.');
  const pub = String(o.pub ?? '');
  const copies = variantsOnList(path, sites);
  return { copies, entries: [{ path: pub + path, bytes }, ...copies.map((c) => ({ path: pub + c, delete: true }))] };
}

/** The map without the `variants` note of `path`. An entry that held only that note goes too. { map, changed }. A new object; the input is not changed. */
export function mapWithoutVariants(map, path) {
  const src = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  const out = { ...src };
  const e = out[path];
  if (!e || typeof e !== 'object' || Array.isArray(e) || !Object.prototype.hasOwnProperty.call(e, 'variants')) return { map: out, changed: false };
  const { variants, ...rest } = e; // eslint-disable-line no-unused-vars
  if (Object.keys(rest).length) out[path] = rest; else delete out[path];
  return { map: out, changed: true };
}
