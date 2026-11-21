// Auto image hosting, the smaller copies join the run (PLAN 34.5, 34.6, LOGICS 22; Phase 3c Part 4c-3, v0.101.60).
// hostPost (hosting-run.js) answers with the new pictures, the post and the new config/media.json. This file adds the smaller WebP copies of each new picture to that answer,
// so the ONE commit (hosting-commit.js) saves the picture, its copies and its media row together, all or nothing.
//   addCopiesToRun(run, makeVariants)  -> { run, copies }   it never throws
//     run          the answer of hostPost; the input is not changed
//     makeVariants the function (main) of makeVariantMaker (hosting-optimize.js): main = { path, bytes, width, height } -> [{ width, height, path, bytes }]
//     run          a NEW run: after each picture its copies as files { src, path, bytes, variant: width }, and the media row of the picture gets `variants: [480, 800, ...]`
//     copies       one line for each new picture: { src, status: 'made' | 'none' | 'failed', widths, reason?, message? }
//                  'none' + reason 'cannot' (a GIF) or 'small' (480 pixels or less); 'failed' + a plain sentence: that picture keeps NO copy and NO `variants`, the picture itself is still saved
// Rules: the copies are checked against the plan of variantsFor (same widths, same paths, WebP bytes, not empty); one wrong copy means no copy for that picture; a picture that
// was reused (not new) gets no copy here, because its bytes are not in the run. Nothing calls it yet except the pipeline when the optional dep `makeVariants` is given, so the live site and the dashboard do not change.
import { canHaveVariants, variantsFor } from './hosting-srcset.js';
import { mergeMedia } from './media-meta.js';
import { isWebpBytes } from './hosting-optimize.js';

const whole = (n) => Number.isInteger(n) && n > 0;
const say = (e) => String(e && typeof e.message === 'string' && e.message.trim() ? e.message : 'The copies could not be made.').replace(/\s+/g, ' ').trim().slice(0, 200);

/** The repository path of a copy: the repository path of the picture with `.<width>w` before `.webp` (the address of the copy has the same ending). */
const repoPath = (file, copySrc) => `${file.path.slice(0, -'.webp'.length)}${copySrc.slice(file.src.length - '.webp'.length)}`;

async function copiesOf(file, map, makeVariants) {
  const row = map && map[file.src];
  const info = { width: row && row.width, height: row && row.height };
  if (!canHaveVariants(file.src) || !String(file.path).endsWith('.webp')) return { entry: { src: file.src, status: 'none', widths: [], reason: 'cannot' }, files: [] };
  if (!whole(info.width) || !whole(info.height)) return { entry: { src: file.src, status: 'failed', widths: [], message: 'The size of the picture is not known, so no smaller copies were made.' }, files: [] };
  const plan = variantsFor(file.src, info);
  if (!plan.length) return { entry: { src: file.src, status: 'none', widths: [], reason: 'small' }, files: [] };
  let got;
  try { got = await makeVariants({ path: file.src, bytes: file.bytes, width: info.width, height: info.height }); } catch (e) { return { entry: { src: file.src, status: 'failed', widths: [], message: say(e) }, files: [] }; }
  const fail = (message) => ({ entry: { src: file.src, status: 'failed', widths: [], message }, files: [] });
  if (!Array.isArray(got) || got.length !== plan.length) return fail('The copies do not match the plan, so none was saved.');
  const files = [];
  for (const [i, want] of plan.entries()) {
    const c = got[i];
    if (!c || c.width !== want.width || c.height !== want.height || c.path !== want.path) return fail('The copies do not match the plan, so none was saved.');
    if (!isWebpBytes(c.bytes)) return fail(`The ${want.width} pixel copy is not a WebP file, so none was saved.`);
    files.push({ src: file.src, path: repoPath(file, want.path), bytes: c.bytes, variant: want.width });
  }
  return { entry: { src: file.src, status: 'made', widths: plan.map((p) => p.width) }, files };
}

export async function addCopiesToRun(run, makeVariants) {
  if (!run || typeof run !== 'object' || !run.changed || !Array.isArray(run.files) || run.files.length === 0 || typeof makeVariants !== 'function') return { run, copies: [] };
  try {
    const files = [];
    const copies = [];
    let map = run.map;
    for (const f of run.files) {
      files.push(f);
      if (!f || typeof f.src !== 'string' || typeof f.path !== 'string' || !(f.bytes instanceof Uint8Array)) continue;
      const r = await copiesOf(f, map, makeVariants);
      copies.push(r.entry);
      if (r.entry.status === 'made') { files.push(...r.files); map = mergeMedia(map, f.src, { variants: r.entry.widths }); }
    }
    return { run: { ...run, files, map }, copies };
  } catch (e) {
    return { run, copies: [{ src: '', status: 'failed', widths: [], message: say(e) }] };
  }
}
