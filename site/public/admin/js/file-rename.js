// Rename a picture file: the rules (PLAN 33.3 "Rename", LOGICS 21; Phase 3b Part 8d-2, v0.101.34).
// Pure: no screen, no network, no storage. It only builds the list of changes; Part 8d-3 shows the screen and saves them in ONE commit,
// because a half-finished rename would leave a post that shows a picture which no longer exists.
// Part 4c-4c (v0.101.63): the smaller copies of the picture (name.480w.webp) move with it to the new name, each with its own 301, so a copy is never left behind.
// The old address keeps working: config/redirects.json gets a 301 from the old address to the new one (src/lib/media-live.ts, v0.101.33,
// makes a picture a valid target). The posts, pages, authors and config files that name the picture are updated in the same plan.
import { isMediaPath, readableName, usedIn, pathPattern, MEDIA_ROOT } from './media-meta.js';
import { SLUG_RE } from './slug.js';
import { MAX_REDIRECTS } from './import-save.js';
import { variantsOnList, variantPath, parseVariant } from './hosting-srcset.js';

/** Longest new name, without the ending. */
export const MAX_NAME = 100;
/** One commit holds the whole rename. More places than this is refused with a plain message. */
export const MAX_RENAME_PLACES = 1000;

const extOf = (p) => { const m = String(p ?? '').match(/(\.[A-Za-z0-9]+)$/); return m ? m[1] : ''; };

/**
 * Is this a good new name for the picture at `path`? newName is the name without the folder; the ending (.webp) stays and may be left out.
 * taken: [path] every picture that exists now (the old one included). Returns { ok, errors, warnings, newPath }. Nothing is changed.
 */
export function checkNewName(path, newName, taken) {
  const errors = [];
  const warnings = [];
  if (!isMediaPath(path)) return { ok: false, errors: [`"${path}" is not a file under ${MEDIA_ROOT}.`], warnings, newPath: '' };
  if (/[*:]/.test(path)) return { ok: false, errors: ['The old address has a character (":" or "*") that a redirect cannot use. Rename this file by hand.'], warnings, newPath: '' };
  const ext = extOf(path);
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const oldStem = path.slice(dir.length, path.length - ext.length);
  let stem = String(newName ?? '').trim();
  if (stem.toLowerCase().endsWith(ext.toLowerCase())) stem = stem.slice(0, stem.length - ext.length);
  if (!stem) return { ok: false, errors: ['Type the new name.'], warnings, newPath: '' };
  if (/[/\\]/.test(stem)) return { ok: false, errors: ['The new name is only a name. The folder stays the same.'], warnings, newPath: '' };
  if (/\.[A-Za-z0-9]+$/.test(stem)) errors.push(`The ending stays ${ext}. Leave it out or type it as ${ext}.`);
  else if (!SLUG_RE.test(stem)) errors.push('The new name may only hold lowercase letters, numbers and hyphens, for example city-hall-vote.');
  if ([...stem].length > MAX_NAME) errors.push(`The new name is ${[...stem].length} characters; the limit is ${MAX_NAME}.`);
  const newPath = `${dir}${stem}${ext}`;
  if (stem === oldStem) errors.push('The new name is the same as the old one.');
  else if (Array.isArray(taken) && taken.some((t) => String(t).toLowerCase() === newPath.toLowerCase())) errors.push(`${newPath} already exists. Pick another name.`);
  if (!errors.length && !readableName(newPath)) warnings.push('The new name does not say what the picture shows (for example IMG_1234).');
  return { ok: errors.length === 0, errors, warnings, newPath: errors.length ? '' : newPath };
}

/**
 * The whole rename as a list of changes (PLAN 33.3: "the old address is kept working and the posts that use it are updated in the same commit").
 * o = {
 *   items:    [{ file, text }]  posts, pages, authors and config files that can name the picture (config/media.json and config/redirects.json may be in it; they are handled on their own),
 *   map:      the stored config/media.json object,
 *   redirects: the stored config/redirects.json array,
 *   existingRedirects: how many redirects the build has in all (default: the length of `redirects`),
 *   taken:    [path] every picture that exists now,
 *   paths:    { pub, mediaMeta, redirects } repository paths (pub is the prefix of /media/..., for example "site/public"),
 * }
 * Returns { oldPath, newPath, moves: [{ from, to }], copies: [{ from, to }], files: [{ path, text }], warnings, counts: { places, redirect, mediaEntry, loopRemoved, copies } }.
 * `moves` is the picture itself first (its bytes are moved by the commit), then each smaller copy that exists in `taken`; `files` are the text files to write. Throws an Error with a plain message. The input is not changed.
 */
export function planFileRename(path, newName, o = {}) {
  const paths = { pub: '', mediaMeta: 'config/media.json', redirects: 'config/redirects.json', ...(o.paths || {}) };
  const chk = checkNewName(path, newName, o.taken);
  if (!chk.ok) throw new Error(chk.errors[0]);
  if (Array.isArray(o.taken) && !o.taken.includes(path)) throw new Error('That file is already gone. Refresh the page.');
  const newPath = chk.newPath;

  // 0. The smaller copies that exist now (name.480w.webp) move with the picture: same width, new name. A copy is only moved when it is in `taken` (facts are never invented).
  const taken = Array.isArray(o.taken) ? o.taken : [];
  const copyPairs = variantsOnList(path, taken).map((from) => {
    const to = variantPath(newPath, parseVariant(from).width);
    if (taken.some((t) => String(t).toLowerCase() === to.toLowerCase())) throw new Error(`${to} already exists, so the smaller copies cannot move there. Pick another name.`);
    return { from, to };
  });
  const pairs = [{ from: path, to: newPath }, ...copyPairs];

  // 1. Every text file that names the old address (or a copy) gets the new one. A longer name that only starts the same is left alone (same rule as usedIn).
  const own = new Set([paths.mediaMeta, paths.redirects]);
  const files = [];
  for (const it of Array.isArray(o.items) ? o.items : []) {
    if (!it || own.has(it.file)) continue;
    let text = String(it.text);
    let changed = false;
    for (const { from, to } of pairs) {
      if (!usedIn(from, [{ ...it, text }]).length) continue;
      text = text.replace(pathPattern(from, 'g'), () => to);
      changed = true;
    }
    if (changed) files.push({ path: it.file, text });
  }
  const places = files.length;
  if (places > MAX_RENAME_PLACES) throw new Error(`${places} files name this picture, which is more than one safe save can hold (${MAX_RENAME_PLACES}).`);

  // 2. The 301 from each old address (the picture and every copy). A redirect that starts at a new address must go (the new file is live: loop guard, BUGS U4);
  //    a redirect that ends at an old address now ends at the new one (no chain, BUGS U3).
  const stored = Array.isArray(o.redirects) ? o.redirects : [];
  let list = stored.filter((e) => e && typeof e === 'object').map((e) => ({ ...e }));
  let loopRemoved = 0;
  let added = 0;
  let redirect;
  for (const { from, to } of pairs) {
    const before = list.length;
    list = list.filter((e) => e.from !== to);
    loopRemoved += before - list.length;
    for (const e of list) if (e.to === from) e.to = to;
    const mine = list.find((e) => e.from === from);
    let kind;
    if (mine) { kind = mine.to === to ? 'kept' : 'updated'; mine.to = to; } else { list.push({ from, to }); kind = 'added'; added += 1; }
    if (from === path) redirect = kind;
  }
  const total = (Number.isFinite(o.existingRedirects) ? o.existingRedirects : stored.length) - loopRemoved + added;
  if (total > MAX_REDIRECTS) throw new Error(`This rename needs ${added === 1 ? 'one more redirect' : `${added} more redirects`}, and Cloudflare Pages allows ${MAX_REDIRECTS} in total (${total - added} used). Nothing was changed.`);
  if (JSON.stringify(list) !== JSON.stringify(stored)) files.push({ path: paths.redirects, text: JSON.stringify(list, null, 2) + '\n' });

  // 3. Alt text, caption, credit and the `variants` note move with the file. The key keeps its place in the list; if a stale entry for a new name exists, the moved one wins.
  const map = o.map && typeof o.map === 'object' && !Array.isArray(o.map) ? o.map : {};
  const newKey = new Map(pairs.map((p) => [p.from, p.to]));
  const newNames = new Set(newKey.values());
  const mediaEntry = Object.prototype.hasOwnProperty.call(map, path);
  if (pairs.some((p) => Object.prototype.hasOwnProperty.call(map, p.from))) {
    const moved = {};
    for (const [k, v] of Object.entries(map)) { if (newNames.has(k)) continue; moved[newKey.has(k) ? newKey.get(k) : k] = v; }
    files.push({ path: paths.mediaMeta, text: JSON.stringify(moved, null, 2) + '\n' });
  }

  return {
    oldPath: path,
    newPath,
    moves: pairs.map((p) => ({ from: paths.pub + p.from, to: paths.pub + p.to })), // the picture first, then each copy
    copies: copyPairs,
    files,
    warnings: chk.warnings,
    counts: { places, redirect, mediaEntry, loopRemoved, copies: copyPairs.length },
  };
}
