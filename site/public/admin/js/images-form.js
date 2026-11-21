// Auto image hosting, the picture settings FORM LOGIC (PLAN 34.10; Phase 3c Part 7t, v0.101.89).
// Plain functions only: no page, no fetch, no save, no GitHub. They turn what a form would hold into a checked settings object and into the new text of
// config/images.json, and they say what would change. Nothing calls them yet, so the dashboard and the live site do not change.
//   imagesFormValues(settings)             -> the values as a form holds them: numbers and lists as text (one website per line), the naming order as a list
//   imagesFromForm(raw, current?)          -> { ok: true, settings } or { ok: false, errors: [{ key, message }] }   STRICT: a wrong value is an error with a plain sentence,
//                                             it is never repaired (the reader of Part 7q is gentle; a form must not be). A key missing from `raw` keeps its value from `current`
//                                             (or its shipped value). Website names are lower-cased and a repeated name is dropped. The rules are those of checkImagesConfig in
//                                             scripts/validate-content-lib.mjs; a test keeps the two in step.
//   imagesFileText(settings, currentText?) -> the text to write to config/images.json: two-space indent, a newline at the end, the keys in the order of the shipped file,
//                                             and every key of the current file that this code does not know is kept after them
//   imagesChanges(before, after)           -> [{ key, label, from, to }] for each setting whose words on the Picture settings screen would change (empty when nothing changes)
// Rules: it never throws; it never changes its input; it writes nothing.
import { imagesSettingsOf, imagesDefaults, NAME_SOURCES, HOST_NAME } from './images-setting.js';
import { imagesRows } from './images-screen.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);
const KEYS = Object.keys(imagesDefaults());
const LISTS = ['askHosts', 'allowHosts', 'blockHosts'];
const LIST_LABEL = { askHosts: 'Websites that ask first', allowHosts: 'Websites counted as ours', blockHosts: 'Websites never allowed' };
const LABEL = { enabled: 'Picture hosting', askFirst: 'How it starts', maxWidth: 'Widest picture', sizeWarnKb: 'Biggest picture file', quality: 'Picture quality', storage: 'Where pictures are kept', hardBlock: 'Outside pictures at publish', nameOrder: 'Order of picture names', ...LIST_LABEL };

/** The settings as a form holds them (text for numbers, one website per line). */
export function imagesFormValues(settings) {
  const s = imagesSettingsOf(settings);
  return {
    enabled: s.enabled, askFirst: s.askFirst, maxWidth: String(s.maxWidth), sizeWarnKb: String(s.sizeWarnKb), quality: String(s.quality), storage: s.storage,
    askHosts: s.askHosts.join('\n'), allowHosts: s.allowHosts.join('\n'), blockHosts: s.blockHosts.join('\n'), hardBlock: s.hardBlock, nameOrder: [...s.nameOrder],
  };
}

// A whole number from a number or from text such as " 85 "; anything else (empty text, 1.5, "abc", "1e3", null) is NaN.
function wholeOf(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v === 'string' && /^\d{1,6}$/.test(v.trim())) return Number(v.trim());
  return NaN;
}

export function imagesFromForm(raw, current) {
  const errors = [];
  const fail = (key, message) => errors.push({ key, message });
  const base = imagesSettingsOf(current);
  const given = isMap(raw) ? raw : {};
  const has = (k) => Object.prototype.hasOwnProperty.call(given, k);
  const out = { ...base, askHosts: [...base.askHosts], allowHosts: [...base.allowHosts], blockHosts: [...base.blockHosts], nameOrder: [...base.nameOrder] };

  for (const k of ['enabled', 'askFirst', 'hardBlock']) {
    if (!has(k)) continue;
    if (typeof given[k] === 'boolean') out[k] = given[k];
    else fail(k, `${LABEL[k]} must be on or off.`);
  }
  for (const [k, min, max, hint] of [['maxWidth', 0, 20000, 'pixels, 0 means no limit'], ['sizeWarnKb', 0, 20000, 'KB, 0 means no limit'], ['quality', 1, 100, 'a percent']]) {
    if (!has(k)) continue;
    const n = wholeOf(given[k]);
    if (Number.isInteger(n) && n >= min && n <= max) out[k] = n;
    else fail(k, `${LABEL[k]} must be a whole number from ${min} to ${max} (${hint}).`);
  }
  if (has('storage')) {
    if (given.storage === 'repo' || given.storage === 'r2') out.storage = given.storage;
    else fail('storage', `${LABEL.storage} must be the repository or Cloudflare R2.`);
  }
  for (const k of LISTS) {
    if (!has(k)) continue;
    const v = given[k];
    const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/) : null;
    if (!parts) { fail(k, `${LABEL[k]} must be a list of website names.`); continue; }
    const names = [];
    let bad = false;
    parts.forEach((p, i) => {
      if (typeof p !== 'string') { bad = true; fail(k, `${LABEL[k]}: entry ${i + 1} is not a website name.`); return; }
      const n = p.trim().toLowerCase();
      if (n === '') return;
      if (!HOST_NAME.test(n)) { bad = true; fail(k, `${LABEL[k]}: "${p.trim().slice(0, 60)}" is not a website name. Write only the name, such as photos.example.com (no https://, no slash, no spaces).`); return; }
      if (!names.includes(n)) names.push(n);
    });
    if (!bad && names.length > 200) fail(k, `${LABEL[k]} may have at most 200 names.`);
    if (!bad) out[k] = names;
  }
  if (has('nameOrder')) {
    const v = given.nameOrder;
    const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,]+/).filter(Boolean) : null;
    const words = NAME_SOURCES.join(', ');
    if (!list || list.length === 0) fail('nameOrder', `${LABEL.nameOrder} must be a list of these words: ${words}.`);
    else {
      const seen = new Set();
      let bad = false;
      list.forEach((w, i) => {
        if (typeof w !== 'string' || !NAME_SOURCES.includes(w)) { bad = true; fail('nameOrder', `${LABEL.nameOrder}: entry ${i + 1} must be one of ${words}.`); }
        else if (seen.has(w)) { bad = true; fail('nameOrder', `${LABEL.nameOrder}: "${w}" is listed twice.`); }
        else seen.add(w);
      });
      if (!bad && list[list.length - 1] !== 'handle') { bad = true; fail('nameOrder', `${LABEL.nameOrder} must end with "handle", the last way to make a name.`); }
      if (!bad) out.nameOrder = [...list];
    }
  }
  // A website may be in only one list (the same rules as the build check). Checked on the final lists, so a kept list from `current` counts too.
  for (const [a, b] of [['allowHosts', 'blockHosts'], ['askHosts', 'blockHosts']]) {
    for (const n of out[a]) if (out[b].includes(n)) fail(a, `"${n}" is in both "${LIST_LABEL[a]}" and "${LIST_LABEL[b]}". Keep it in one list.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, settings: out };
}

/** The text of config/images.json for these settings. Keys this code does not know, found in `currentText`, are kept after the known ones. */
export function imagesFileText(settings, currentText) {
  const known = imagesSettingsOf(settings);
  const obj = {};
  for (const k of KEYS) obj[k] = known[k];
  if (typeof currentText === 'string') {
    try {
      const cur = JSON.parse(currentText);
      if (isMap(cur)) for (const k of Object.keys(cur)) if (!KEYS.includes(k) && k !== '__proto__') obj[k] = cur[k];
    } catch { /* a bad current file: only the known keys are written */ }
  }
  return JSON.stringify(obj, null, 2) + '\n';
}

/** What would change on the screen: one item for each setting whose words differ. */
export function imagesChanges(before, after) {
  const a = imagesRows(before);
  const b = imagesRows(after);
  const out = [];
  for (let i = 0; i < b.length; i++) if (a[i].value !== b[i].value) out.push({ key: b[i].key, label: b[i].label, from: a[i].value, to: b[i].value });
  return out;
}
