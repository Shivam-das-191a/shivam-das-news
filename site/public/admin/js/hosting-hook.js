// Auto image hosting, the Save hook helper (PLAN 34.3; Phase 3c Part 3c-8c-1, v0.101.54).
// It is everything the hook in `save()` of app.js has to DECIDE, as plain functions, so the hook itself (Part 3c-8c-2) is only a few lines.
//   runHostingSave({ cfg, gh, next, body, orig, newPath, tree?, canEdit?, dryRun?, fetch?, optimizeDeps?, quality?, mount?, onSaved? })
//       -> { action, message, reason?, open?, flow? }     it never throws
//        action 'normal'  Save goes on as before (it makes its own commit): hosting is off, not needed, not possible, or it found nothing to change.
//                         `message` is a plain sentence to show after the Save (empty when there is nothing to say).
//        action 'saved'   ONE commit was made by the pictures flow and it already holds the post file. Save must NOT write the post again.
//                         `open` is the number of pictures that still need the writer (Retry, Confirm or Replace); 0 means the list can go.
//        action 'stop'    the pictures flow could not save. Nothing was written. Save must stop too; the list stays on the screen so the writer can read it.
//       mount(el)   called once with the list element before the run starts, so the writer sees it draw. A mount that throws is ignored.
//       onSaved({ fields, open, message })   called after EVERY run that made a commit, also a later Retry or Confirm; `fields` is { body?, image?, imageAlt?, ogImage? }
//                   (only text values), the new addresses the editor must show. A callback that throws is ignored: it can not undo a save.
//   editorFieldsFrom(post)   the four fields of a post that the pipeline may change, only when they are text
//   openCount(list)          how many rows of a result list still offer an action (retry, confirm or replace)
//   hostingOutcome(started, answer)   the decision table of runHostingSave as one pure function
//   origFrom(next, path, sha)         the `orig` object of the editor after a save: the same shape app.js builds when it opens a post
//   freshOrig(gh, next, path)         origFrom with the sha that GitHub holds now (the pictures commit changed the file), or null when it can not be read
// Phase 3c Part 7ab (v0.101.97): the same read also gives `allowHosts` of config/images.json (only when it has at least one valid website name); a picture from those websites is counted as ours: the Save does not fetch or host it. They are added to our own websites (the exact name, "www." ignored; sub names are still checked). A name that is related to an agency website or to a blocked website is ignored, so this list can never let an agency or a blocked picture through. Without it, or with a wrong one, nothing changes.
// Phase 3c Part 7aa (v0.101.96): the same read also gives `blockHosts` of config/images.json (only when it has at least one valid website name); a picture from those websites is refused by the Save (nothing is fetched or hosted), and the writer sees the plain sentence of the refusal. They are added to the dashboard list `blockHosts`; nothing is removed. Without it, or with a wrong one, nothing changes.
// Phase 3c Part 7z (v0.101.95): the same read also gives `askFirst` of config/images.json (only the real value true); then every outside picture that is not hosted yet waits for the writer to confirm, not only the ones from agency websites. Without it, or with any other value, nothing changes.
// Phase 3c Part 7y (v0.101.94): the same read also gives `askHosts` of config/images.json (only when it has at least one valid website name); those websites are added to the agency list, so a picture from them waits for the writer to confirm. Without it, or with a wrong one, nothing changes.
// Phase 3c Part 7x (v0.101.93): the same read also gives the naming order `nameOrder` of config/images.json (only a valid order that differs from the shipped one); it goes on to the picture names (seoName), so the order in the file now changes the names of NEW pictures. Without it, or with a wrong one, the names are made as before.
// Phase 3c Part 7w (v0.101.92): the same read also gives the switch `enabled` of config/images.json; "enabled": false stops the pictures flow and the Save goes on as before ({ action: 'normal', reason: 'off' }); any other value, a missing file or a bad file leaves hosting as it was.
// Phase 3c Part 7k (v0.101.78): when picture hosting is on and no `quality` is given, runHostingSave reads `quality` from config/images.json (images-setting.js) and passes it on; the picture steps use it, so the number in the file now changes new pictures. Without the file or with a bad number the old 85 is used.
// Rules: no token or service address is put in a message (the messages come from hosting-save.js and hosting-pipeline.js, which hide them); the editor's `next` and `orig` are never
// changed; it does not fetch, store or touch the page by itself. It writes nothing and nothing calls it yet, so the live site and the dashboard do not change.
import { startHostingSave } from './hosting-save.js';
import { hostingEnabled } from './hosting-setup.js';
import { readImagesForSave } from './images-setting.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);
const FIELDS = ['body', 'image', 'imageAlt', 'ogImage'];
const ACTIONS = new Set(['retry', 'confirm', 'replace']);

export const STOP_MESSAGE = 'The pictures could not be saved, so the post was not saved. Nothing was changed. Read the message above the list, then press Save again.';

/** The fields of a post that the pipeline may change, only the ones that are text. */
export function editorFieldsFrom(post) {
  const p = isMap(post) ? post : {};
  const out = {};
  for (const k of FIELDS) if (typeof p[k] === 'string') out[k] = p[k];
  return out;
}

/** The number of rows of a result list that still offer Retry, Confirm or Replace. */
export function openCount(list) {
  const rows = isMap(list) && Array.isArray(list.rows) ? list.rows : [];
  return rows.filter((r) => isMap(r) && ACTIONS.has(r.action)).length;
}

const say = (s) => (typeof s === 'string' ? s : '');

/** The decision table. `started` is the answer of startHostingSave; `answer` is what flow.start() gave (the last result, or null when the first run failed). */
export function hostingOutcome(started, answer) {
  if (!isMap(started)) return { action: 'normal', reason: 'setup', message: '' };
  if (started.use !== true) {
    const shown = started.reason === 'setup' || started.reason === 'moved';
    return { action: 'normal', reason: say(started.reason), message: shown ? say(started.message) : '' };
  }
  if (!isMap(answer)) return { action: 'stop', reason: 'error', message: STOP_MESSAGE };
  if (answer.status === 'saved') return { action: 'saved', reason: 'saved', open: openCount(answer.list), message: say(answer.message) };
  if (answer.status === 'nothing') return { action: 'normal', reason: 'nothing', message: say(answer.message) };
  return { action: 'stop', reason: say(answer.status) || 'error', message: STOP_MESSAGE };
}

export async function runHostingSave(given) {
  try {
    const o = isMap(given) ? given : {};
    const { mount, onSaved, onResult: ignored, ...rest } = o;
    const onResult = (r) => {
      if (!isMap(r) || r.status !== 'saved' || typeof onSaved !== 'function') return;
      try { onSaved({ fields: editorFieldsFrom(isMap(r.next) ? r.next.post : null), open: openCount(r.list), message: say(r.message) }); } catch { /* a callback can not undo a save */ }
    };
    // Part 7k (v0.101.78): the picture quality of config/images.json. Read only when picture hosting is on and the caller gave no `quality`; a missing file or a bad number gives undefined, so the pictures are made as before.
    // Part 7w (v0.101.92): the same one read also gives the switch "enabled". Only a real `"enabled": false` in the file switches picture hosting off for this Save: the Save goes on as before and the post keeps its outside pictures.
    // Part 7x (v0.101.93): the same one read also gives the naming order `nameOrder` of config/images.json, only when the file holds a valid order that differs from the shipped one; a `nameOrder` given by the caller wins. When the caller gave a `quality`, the file is still not read (so the shipped order is used unless the caller gave one).
    let quality = rest.quality;
    let nameOrder = rest.nameOrder;
    let askHosts = rest.askHosts; // Part 7y (v0.101.94): the websites of config/images.json that ask first; a list given by the caller wins over the file
    let blockHosts = rest.blockHosts; // Part 7aa (v0.101.96): the websites of config/images.json that are never allowed; a list given by the caller wins over the file
    let allowHosts = rest.allowHosts; // Part 7ab (v0.101.97): the websites of config/images.json that are counted as ours; a list given by the caller wins over the file
    let askFirst = rest.askFirst; // Part 7z (v0.101.95): true when config/images.json says "askFirst": true; a value given by the caller wins over the file
    if (quality === undefined && hostingEnabled(rest.cfg) && rest.gh) {
      const fromFile = await readImagesForSave(rest.gh, rest.cfg);
      if (!fromFile.on) return { action: 'normal', reason: 'off', message: '' };
      quality = fromFile.quality;
      if (nameOrder === undefined) nameOrder = fromFile.nameOrder;
      if (askHosts === undefined) askHosts = fromFile.askHosts;
      if (askFirst === undefined) askFirst = fromFile.askFirst;
      if (blockHosts === undefined) blockHosts = fromFile.blockHosts;
      if (allowHosts === undefined) allowHosts = fromFile.allowHosts;
    }
    const started = startHostingSave({ ...rest, quality, nameOrder, askHosts, askFirst, blockHosts, allowHosts, onResult });
    if (!started || started.use !== true) return hostingOutcome(started, null);
    try { if (typeof mount === 'function') mount(started.flow.el); } catch { /* the list is only a help */ }
    let answer = null;
    try { answer = await started.flow.start(); } catch { answer = null; }
    return { ...hostingOutcome(started, answer), flow: started.flow };
  } catch {
    return { action: 'normal', reason: 'setup', message: '' };
  }
}

/** The `orig` of the editor (the same keys app.js builds when it opens a post) for a post that was just saved at `path` with the file sha `sha`. */
export function origFrom(next, path, sha) {
  const n = isMap(next) ? next : {};
  return { category: n.category, permalink: n.permalink, date: n.date, status: n.status, robots: n.robots, canonical: n.canonical, path, sha };
}

/** origFrom with the sha that GitHub holds now. null when the file can not be read: the caller then reloads the post instead of guessing. */
export async function freshOrig(gh, next, path) {
  try {
    if (!gh || typeof gh.getText !== 'function' || typeof path !== 'string' || !path) return null;
    const f = await gh.getText(path);
    return f && typeof f.sha === 'string' && f.sha ? origFrom(next, path, f.sha) : null;
  } catch {
    return null;
  }
}
