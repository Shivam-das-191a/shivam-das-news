// Delete a picture together with its smaller copies (PLAN 33.3 "Delete", PLAN 34.5; Phase 3c Part 4c-4b, v0.101.62).
// Pure: no screen, no network, no storage. It only builds the list of what goes; app.js saves it in ONE commit, because a deleted picture
// whose copies stay behind would leave files that no page can reach (and that the Files screen hides), and a deleted copy with its picture
// kept would break a later srcset.
//   planDelete(path, { sitePaths, pub })   { copies, deletes }  the copies of the picture that exist, and the commit entries (the picture first, then each copy)
//   mapWithout(map, paths)                 { map, changed }     the stored config/media.json object without the entries of these paths
// Facts are never invented: a copy is only deleted when it is in the list of files that exist now (sitePaths).
import { isMediaPath } from './media-meta.js';
import { variantsOnList } from './hosting-srcset.js';

/**
 * path: the site address of the picture (/media/2026/11/a.webp). o.sitePaths: [path] every picture that exists now, as the site shows them.
 * o.pub: the repository prefix of /media/... (for example "site/public"). Throws a plain message for a path that is not a picture or is already gone.
 * Returns { copies: [site path], deletes: [{ path: repo path, delete: true }] }. The input is not changed.
 */
export function planDelete(path, o = {}) {
  if (!isMediaPath(path)) throw new Error(`"${path}" is not a file under /media/.`);
  const sites = Array.isArray(o.sitePaths) ? o.sitePaths : [];
  if (!sites.includes(path)) throw new Error('That file is already gone. Refresh the page.');
  const pub = String(o.pub ?? '');
  const copies = variantsOnList(path, sites);
  return { copies, deletes: [path, ...copies].map((p) => ({ path: pub + p, delete: true })) };
}

/** The map without the entries of `paths` (a copy never has an entry of its own, but a stray one goes too). { map, changed }. A new object; the input is not changed. */
export function mapWithout(map, paths = []) {
  const src = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  const out = { ...src };
  let changed = false;
  for (const p of Array.isArray(paths) ? paths : []) {
    if (Object.prototype.hasOwnProperty.call(out, p)) { delete out[p]; changed = true; }
  }
  return { map: out, changed };
}
