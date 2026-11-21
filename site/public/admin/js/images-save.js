// Auto image hosting, the SAVE of the picture settings (PLAN 34.10; Phase 3c Part 7ac, v0.101.98).
// One plain async function that checks what a form holds and writes the new text of config/images.json to GitHub, the same way the dashboard already saves its
// other settings (ads, ad loader, robots, links, redirects): ONE file, one `gh.put` with the sha that was just read, to the branch of the dashboard.
//   saveImagesSettings(gh, cfg, raw, opts?)  (async) -> { ok: true, changed, settings, text, changes, sha? }
//                                                     or { ok: false, reason, message, errors? }
//     gh     the GitHub client (gh.getText(path) -> { text, sha }, gh.put(path, content, message, sha))
//     cfg    the dashboard config (only `contentRoot` is used, as in imagesPathOf)
//     raw    what the form holds (the same shape as imagesFromForm of images-form.js; a key that is missing keeps the value of the file)
//     opts   { loadedText }  the text of config/images.json that the form was filled from (a string), or null when the form was filled with no file.
//            When it is given and the file in the repository is different now, nothing is written (reason 'changed-meanwhile').
//            When it is not given there is no such check.
//   reason words: 'no-client', 'read-failed', 'changed-meanwhile', 'invalid' (with `errors`: [{ key, message }], the strict sentences of imagesFromForm),
//                 'conflict' (someone saved at the same moment), 'no-permission', 'failed'.
//   changed: false when the new text says the same as the file, even if only the spaces, line breaks or order of keys differ (nothing is written, no commit); true after a write. A missing file is always written.
// Rules: it never throws; it never changes `raw`; the message of a failure is a fixed plain sentence (it never repeats an error text of GitHub, so no token or
// address can leak); a wrong value is never repaired and never written; keys of the file that this code does not know are kept (imagesFileText).
// Used by the Save button of the Picture settings screen (imagesView in app.js, Part 7ad, v0.101.99). Before that part nothing called it.
import { imagesPathOf, imagesSettingsFromText } from './images-setting.js';
import { imagesFromForm, imagesFileText, imagesChanges } from './images-form.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);
const MESSAGE = {
  'no-client': 'The dashboard is not connected to GitHub, so nothing was saved.',
  'read-failed': 'The current picture settings could not be read, so nothing was saved. Try again.',
  'changed-meanwhile': 'The picture settings were changed by someone else after this page was opened, so nothing was saved. Open the screen again and make the change again.',
  invalid: 'Some values are wrong, so nothing was saved. Fix the lines marked in red.',
  conflict: 'Someone else saved at the same moment, so nothing was changed. Try again.',
  'no-permission': 'GitHub did not allow this change, so nothing was saved. Sign in again as an admin.',
  failed: 'The picture settings could not be saved. Nothing was changed. Try again.',
};
const fail = (reason, extra) => ({ ok: false, reason, message: MESSAGE[reason], ...(extra || {}) });

// The same JSON value, whatever the layout and the order of the keys (so a file that only differs in its spaces and line breaks is not written again).
function sameJson(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  if (isMap(a) && isMap(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
  }
  return false;
}
function sameText(a, b) {
  if (a === b) return true;
  try { return sameJson(JSON.parse(a), JSON.parse(b)); } catch { return false; }
}

/** Checks the form values, then writes config/images.json in one commit. See the top of the file. */
export async function saveImagesSettings(gh, cfg, raw, opts) {
  try {
    if (!gh || typeof gh.getText !== 'function' || typeof gh.put !== 'function') return fail('no-client');
    const path = imagesPathOf(cfg);

    // 1. The file as it is now. A file that does not exist (404) is not an error: the form then started from the shipped values.
    let currentText;
    let sha;
    try {
      const got = await gh.getText(path);
      if (isMap(got) && typeof got.text === 'string') { currentText = got.text; sha = typeof got.sha === 'string' ? got.sha : undefined; }
    } catch (e) {
      if (!(e && e.status === 404)) return fail('read-failed');
    }

    // 2. The file must still be the one the form was filled from.
    if (isMap(opts) && Object.prototype.hasOwnProperty.call(opts, 'loadedText')) {
      const was = opts.loadedText;
      if (typeof was === 'string' && was !== currentText) return fail('changed-meanwhile');
      if (was === null && currentText !== undefined) return fail('changed-meanwhile');
    }

    // 3. Strict check of the values, on top of what the file holds now.
    const before = imagesSettingsFromText(currentText);
    const checked = imagesFromForm(raw, before);
    if (!checked.ok) return fail('invalid', { errors: checked.errors });

    // 4. Nothing new: no commit.
    const text = imagesFileText(checked.settings, currentText);
    const changes = imagesChanges(before, checked.settings);
    if (currentText !== undefined && sameText(text, currentText)) return { ok: true, changed: false, settings: checked.settings, text, changes };

    // 5. One write with the sha just read (none when the file is new).
    try {
      const res = await gh.put(path, text, 'admin: picture settings', sha);
      const newSha = isMap(res) && isMap(res.content) && typeof res.content.sha === 'string' ? res.content.sha : undefined;
      return { ok: true, changed: true, settings: checked.settings, text, changes, ...(newSha ? { sha: newSha } : {}) };
    } catch (e) {
      const s = e && e.status;
      if (s === 409 || s === 422) return fail('conflict');
      if (s === 401 || s === 403) return fail('no-permission');
      return fail('failed');
    }
  } catch {
    return fail('failed');
  }
}
