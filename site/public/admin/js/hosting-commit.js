// Auto image hosting, the one commit (PLAN 34.3 step 9, LOGICS 22; Phase 3c Part 3c-2, v0.101.45).
// hostPost (hosting-run.js) writes nothing: it returns the new pictures, the new post and the new config/media.json. This file turns that answer into ONE commit,
// all or nothing, so the live site never has a post that points at a picture that is not there (and a picture is never saved without its media row).
//   buildHostingCommit(run, o)   pure: -> null (nothing to save) or { files, message, counts, bytes }; throws a plain sentence for a bad path or a bad file
//   commitHosting(gh, run, o)    builds, then gh.commitFiles(files, message) (github.js: one tree, one commit, the branch moves only if nobody else saved) -> { sha, ...built } or null
// Smaller copies (Phase 3c Part 4c-3, v0.101.60): a file with `variant: <width>` is a smaller copy of the picture named by its `src`. It goes in the same commit, right after its picture; it is not counted as a picture
// (counts.copies, and it is part of `bytes`), and it is saved only if the media row of its picture lists that width in `variants` AND every width in `variants` has its copy in this commit (all or nothing both ways).
// o: { postPath (repo path of the post file), serializePost (post -> file text), mediaPath (repo path of config/media.json), mediaDir (optional: every new picture must be inside it) }.
// It writes nothing by itself and nothing calls it yet, so the live site and the dashboard do not change.

/** The pictures, the post and the media file, in this order, inside one commit. A run with nothing hosted, reused or changed gives null (no empty commit). */
export function buildHostingCommit(run = {}, o = {}) {
  if (!run || typeof run !== 'object' || !run.changed) return null;
  const post = o.postPath;
  const media = o.mediaPath;
  for (const [what, p] of [['post file', post], ['media file', media]]) if (!safePath(p)) throw new Error(`The path of the ${what} is not valid.`);
  if (post === media) throw new Error('The post file and the media file must be two different files.');
  if (typeof o.serializePost !== 'function') throw new Error('There is no way to write the post file.');
  const pictures = Array.isArray(run.files) ? run.files : [];
  const seen = new Set([post, media]);
  const files = [];
  let bytes = 0;
  const mains = pictures.filter((f) => f && f.variant === undefined);
  const copies = pictures.filter((f) => f && f.variant !== undefined);
  for (const f of pictures) {
    if (!f || !safePath(f.path)) throw new Error('A picture has a path that is not valid.');
    if (o.mediaDir && !f.path.startsWith(o.mediaDir)) throw new Error(`The picture ${f.path} is outside ${o.mediaDir}.`);
    if (seen.has(f.path)) throw new Error(`The path ${f.path} is used twice in one commit.`);
    if (!(f.bytes instanceof Uint8Array) || f.bytes.length === 0) throw new Error(`The picture ${f.path} is empty.`);
    seen.add(f.path);
    bytes += f.bytes.length;
    files.push({ path: f.path, bytes: f.bytes });
  }
  const postText = o.serializePost(run.post);
  if (typeof postText !== 'string' || postText.trim() === '') throw new Error('The post file would be empty.');
  files.push({ path: post, text: postText });
  if (pictures.length > 0) {
    if (!run.map || typeof run.map !== 'object' || Array.isArray(run.map)) throw new Error('The media map is not valid.');
    for (const f of pictures) if (typeof f.src !== 'string' || !run.map[f.src]) throw new Error(`The picture ${f.path} has no media row.`);
    checkCopies(mains, copies, run.map);
    files.push({ path: media, text: JSON.stringify(run.map, null, 2) + '\n' });
  }
  const reused = (Array.isArray(run.items) ? run.items : []).filter((i) => i && i.status === 'reuse').length;
  return { files, message: messageFor(run.post, mains.length, reused), counts: { pictures: mains.length, reused, post: true, media: pictures.length > 0, ...(copies.length ? { copies: copies.length } : {}) }, bytes };
}

/** Builds and commits. Returns null when there is nothing to save. A failed commit throws and changes nothing (github.js commitFiles is all or nothing). */
export async function commitHosting(gh, run, o = {}) {
  const built = buildHostingCommit(run, o);
  if (!built) return null;
  if (!gh || typeof gh.commitFiles !== 'function') throw new Error('There is no connection to GitHub.');
  const sha = await gh.commitFiles(built.files, built.message);
  return { sha, ...built };
}

/** A copy is saved only with its note and a note only with its copies. Throws a plain sentence. */
function checkCopies(mains, copies, map) {
  const here = new Set(copies.map((c) => c.path));
  for (const c of copies) {
    const main = mains.find((m) => m.src === c.src);
    if (!main) throw new Error(`The copy ${c.path} has no picture in this commit.`);
    if (!Number.isInteger(c.variant) || c.variant <= 0) throw new Error(`The copy ${c.path} has no valid width.`);
    if (!String(main.path).endsWith('.webp') || c.path !== `${main.path.slice(0, -'.webp'.length)}.${c.variant}w.webp`) throw new Error(`The copy ${c.path} is not named after its picture.`);
    const row = map[c.src];
    if (!Array.isArray(row.variants) || !row.variants.includes(c.variant)) throw new Error(`The copy ${c.path} is not noted in the media file.`);
  }
  for (const m of mains) {
    const row = map[m.src];
    if (row.variants === undefined) continue;
    if (!Array.isArray(row.variants) || row.variants.some((w) => !Number.isInteger(w) || w <= 0)) throw new Error(`The copies noted for ${m.path} are not valid.`);
    for (const w of row.variants) if (!here.has(`${m.path.slice(0, -'.webp'.length)}.${w}w.webp`)) throw new Error(`The ${w} pixel copy of ${m.path} is noted but missing.`);
  }
}

const safePath = (p) => typeof p === 'string' && p.length > 0 && p.length < 400 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').some((s) => s === '' || s === '.' || s === '..') && !/[\u0000-\u001f]/.test(p);

function messageFor(post, hosted, reused) {
  const who = String((post && (post.handle || post.title)) || 'a post').replace(/\s+/g, ' ').trim().slice(0, 50) || 'a post';
  const n = hosted > 0 ? hosted : reused;
  const noun = n === 1 ? 'picture' : 'pictures';
  return hosted > 0 ? `admin: host ${n} ${noun} for ${who}` : `admin: use ${n} hosted ${noun} in ${who}`;
}
