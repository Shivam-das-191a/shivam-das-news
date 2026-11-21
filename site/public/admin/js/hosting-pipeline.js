// Auto image hosting, the pipeline (PLAN 34.3 steps 1 to 9, LOGICS 22; Phase 3c Part 3c-5, v0.101.49).
// One function that joins the parts that exist: read config/media.json, hostPost (hosting-run.js), the result list (hosting-result.js) and the one commit
// (hosting-commit.js). It has NO screen. The screen of the next part calls it on Save (and with `dryRun` on a Paste preview) and draws `list`.
//   savePostWithHosting(post, deps) -> { ok, status, message, run, list, commit, next }   it never throws; a failure is a status and a plain sentence
//     status  'preview'  dryRun: nothing was written                   'nothing'  there was nothing to change
//             'saved'    ONE commit was made                           'error'    something stopped the run; nothing was written
//     message one plain sentence for the top of the screen (the headline of the list is part of it)
//     run     the answer of hostPost (null when it never ran);  list  buildResultList(run);  commit  { sha, message, counts, bytes } or null
//     copies  (Phase 3c Part 4c-3, v0.101.60) one line for each new picture { src, status: 'made' | 'none' | 'failed', widths, reason?, message? } of addCopiesToRun; [] unless the optional dep `makeVariants` is given
//     next    { post, map }: what Retry or Confirm starts from: after 'saved' the saved post and map; after 'preview', 'nothing' or 'error' the post as it was and the map as it was read
// deps: { gh, postPath, mediaPath, serializePost, mediaDir?, readMap?, dryRun?,
//         fetchPictures, optimize, ownHosts, agencyHosts, confirmed, blockHosts, existing, now, sha256 }  (the second line goes to hostPost as it is)
//         makeVariants? (optional, hosting-optimize.js makeVariantMaker): the smaller copies of each new picture go in the same ONE commit; empty means off, and a preview never makes copies
// Rules: the setup is checked BEFORE any download (no picture is fetched for a save that could not be written); config/media.json is read fresh before the run AND again just
// before the commit, and the new rows are added to the fresh file, so a save made by someone else in between is never lost; if the same picture name was taken meanwhile nothing
// is written; a failed picture stays as it was in the post and the post is still saved with the rest; a failed commit changes nothing. No token or secret is ever put into a message.
import { hostPost } from './hosting-run.js';
import { buildResultList, carryOver } from './hosting-result.js';
import { commitHosting } from './hosting-commit.js';
import { addCopiesToRun } from './hosting-copies.js';

/** The pictures must stay inside this folder of the repository (an extra check of the commit). */
export const MEDIA_DIR = 'site/public/media/';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);

/** The message of an error as one plain line: no token (classic, fine grained, or any long secret looking run), at most 200 characters. */
export function plainMessage(e) {
  const raw = e && typeof e.message === 'string' && e.message.trim() ? e.message : 'Something went wrong. Nothing was changed.';
  return raw
    .replace(/\bgithub_pat_[A-Za-z0-9_]+/g, '[hidden]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]+/g, '[hidden]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[hidden]')
    .replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** config/media.json now: the `readMap` of the deps, or GitHub. A missing file is an empty map; a file that is not an object is an error. */
async function readCurrent(o) {
  if (typeof o.readMap === 'function') {
    const m = await o.readMap();
    if (!isMap(m)) throw new Error('The media file is not valid. Nothing was changed.');
    return m;
  }
  let text;
  try { text = (await o.gh.getText(o.mediaPath)).text; } catch (e) {
    if (e && e.status === 404) return {};
    throw e;
  }
  let m;
  try { m = JSON.parse(text.trim() === '' ? '{}' : text); } catch { throw new Error('The media file is not valid JSON. Nothing was changed.'); }
  if (!isMap(m)) throw new Error('The media file is not valid. Nothing was changed.');
  return m;
}

function setupError(o) {
  if (!o.gh || typeof o.gh.commitFiles !== 'function') return 'There is no connection to GitHub.';
  if (typeof o.postPath !== 'string' || !o.postPath || typeof o.mediaPath !== 'string' || !o.mediaPath || typeof o.serializePost !== 'function') return 'The dashboard is not set up to save pictures.';
  if (typeof o.readMap !== 'function' && typeof o.gh.getText !== 'function') return 'There is no connection to GitHub.';
  return '';
}

// Part 7x (v0.101.93): `nameOrder` (the naming order of config/images.json) is passed on to the run step too, which gives it to seoName.
// Part 7z (v0.101.95): `askAll` (true when config/images.json says "askFirst": true) is passed on too, so every picture that is not hosted yet waits for the writer.
const PASS = ['fetchPictures', 'optimize', 'ownHosts', 'agencyHosts', 'confirmed', 'blockHosts', 'existing', 'now', 'sha256', 'nameOrder', 'askAll'];

export async function savePostWithHosting(post = {}, deps = {}) {
  const o = deps && typeof deps === 'object' ? deps : {};
  const dry = !!o.dryRun; // any value that is not empty means preview: a stray value must never turn a preview into a real save
  // after a failure the next run starts from the post AS IT WAS (its pictures were not saved, so the new addresses must not be carried)
  let copies = [];
  const stop = (message, run = null, map = null) => ({ ok: false, status: 'error', message, run, list: buildResultList(run), commit: null, copies, next: carryOver({ post, map }) });

  if (!dry) { const bad = setupError(o); if (bad) return stop(bad); }
  if (dry && typeof o.readMap !== 'function' && !(o.gh && typeof o.gh.getText === 'function')) return stop('There is no way to read the media file.');

  let start;
  try { start = await readCurrent(o); } catch (e) { return stop(plainMessage(e)); }

  let run;
  try {
    const d = { map: start };
    for (const k of PASS) if (o[k] !== undefined) d[k] = o[k];
    run = await hostPost(post, d);
    if (!dry && typeof o.makeVariants === 'function') { const r = await addCopiesToRun(run, o.makeVariants); run = r.run; copies = r.copies; } // never throws
  } catch (e) { copies = []; return stop(plainMessage(e)); }

  const list = buildResultList(run);
  const made = (status, message, commit, next) => ({ ok: true, status, message, run, list, commit, copies, next: carryOver(next) });
  const asItWas = { post, map: start };
  if (dry) return made('preview', `Preview only, nothing was saved. ${list.headline}`, null, asItWas);
  if (!run.changed) return made('nothing', `Nothing to save. ${list.headline}`, null, asItWas);

  // Just before the commit: read the media file again and add only OUR new rows to what is there now.
  let map = run.map;
  if (run.files.length > 0) {
    let fresh;
    try { fresh = await readCurrent(o); } catch (e) { return stop(plainMessage(e), run, start); }
    const mine = Object.keys(run.map).filter((k) => !(k in start));
    const clash = mine.find((k) => k in fresh);
    if (clash) return stop(`Someone else just saved a picture with the same name (${clash}). Nothing was changed. Press Save again.`, run, start);
    map = { ...fresh };
    for (const k of mine) map[k] = run.map[k];
  }

  let commit;
  try {
    commit = await commitHosting(o.gh, { ...run, map }, { postPath: o.postPath, mediaPath: o.mediaPath, serializePost: o.serializePost, mediaDir: o.mediaDir || MEDIA_DIR });
  } catch (e) { return stop(plainMessage(e), run, start); }
  if (!commit) return made('nothing', `Nothing to save. ${list.headline}`, null, asItWas);
  const noCopy = copies.filter((c) => c.status === 'failed').length;
  const copyNote = noCopy > 0 ? ` ${noCopy} ${noCopy === 1 ? 'picture has' : 'pictures have'} no smaller copies.` : '';
  return made('saved', `Saved in one commit. ${list.headline}${copyNote}`, { sha: commit.sha, message: commit.message, counts: commit.counts, bytes: commit.bytes }, { post: run.post, map });
}
