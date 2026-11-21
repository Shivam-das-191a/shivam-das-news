// Auto image hosting, the picture settings reader (PLAN 34.10; Phase 3c Part 7j, v0.101.78).
// It reads `quality` from config/images.json and gives it to the picture steps of Part 7h, as plain functions.
//   imagesPathOf(cfg)               -> '<contentRoot>/config/images.json' (contentRoot is "site" in this repository)
//   qualityOf(settings)             -> a whole number from 1 to 100, or undefined (missing or wrong: the picture steps then use their own 85)
//   qualityFromText(text)           -> qualityOf of the parsed JSON text; undefined for text that is not a JSON object
//   readImagesQuality(gh)  (async)  -> the quality from the file in the repository, or undefined; `gh` is the GitHub client (gh.getText(path) -> { text, sha })
//   qualityDeps(deps, quality)      -> a copy of a deps object with `quality` added when it is valid and deps has none yet; deps is never changed
// Part 7q (v0.101.86) adds the reader of ALL the settings of config/images.json (nothing calls it yet):
//   imagesDefaults()                -> a fresh object with the shipped value of every setting (a test keeps it equal to the shipped file)
//   imagesSettingsOf(settings)      -> every setting, each one checked alone; a missing or wrong one gets its shipped value; a list drops its bad names
//   imagesSettingsFromText(text)    -> imagesSettingsOf of the parsed JSON text; all shipped values for text that is not a JSON object
//   readImagesSettings(gh, cfg)  (async) -> imagesSettingsOf of the file in the repository; never throws; all shipped values when anything is wrong
// Rules: it never throws; a missing file, a bad file or a bad number gives undefined, so the pictures are made exactly as before; a quality that the caller already
// put in deps wins over the file. It writes nothing. hostingSetup (hosting-setup.js) accepts the number as `quality`; nothing reads the file yet in the Save, so the live site and the dashboard do not change.
const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);

/** The file path: `<contentRoot>/config/images.json`. */
export function imagesPathOf(cfg) {
  const root = isMap(cfg) && typeof cfg.contentRoot === 'string' ? cfg.contentRoot.trim().replace(/^\/+|\/+$/g, '') : 'site';
  return `${root ? root + '/' : ''}config/images.json`;
}

/** A whole number from 1 to 100 from the `quality` of the settings, else undefined. */
export function qualityOf(settings) {
  if (!isMap(settings)) return undefined;
  const q = settings.quality;
  return Number.isInteger(q) && q >= 1 && q <= 100 ? q : undefined;
}

/** The quality inside the text of config/images.json, else undefined. */
export function qualityFromText(text) {
  if (typeof text !== 'string' || text.trim() === '') return undefined;
  try { return qualityOf(JSON.parse(text)); } catch { return undefined; }
}

/** Reads config/images.json with the GitHub client and gives the quality, or undefined when anything is wrong (no file, no client, bad JSON, bad number). */
export async function readImagesQuality(gh, cfg) {
  try {
    if (!gh || typeof gh.getText !== 'function') return undefined;
    const got = await gh.getText(imagesPathOf(cfg));
    return qualityFromText(isMap(got) ? got.text : undefined);
  } catch {
    return undefined;
  }
}

/** What the Save of the editor needs from the text of config/images.json: { on, quality } and, only when the file holds them, `nameOrder` (its own valid naming order, Part 7x, v0.101.93), `askHosts` (a list of websites with at least one valid name, Part 7y, v0.101.94) `askFirst` (only the real value true, Part 7z, v0.101.95) `blockHosts` (a list of websites with at least one valid name, Part 7aa, v0.101.96) and `allowHosts` (a list of websites with at least one valid name, Part 7ab, v0.101.97). `on` is false ONLY when the file says "enabled": false (a real boolean); a missing, empty, bad or other text keeps it true, so a broken file never switches picture hosting off. `quality` is as in qualityFromText. */
export function hostingSettingsFromText(text) {
  const keep = { on: true, quality: undefined };
  if (typeof text !== 'string' || text.trim() === '') return keep;
  try {
    const p = JSON.parse(text);
    const out = { on: !(isMap(p) && p.enabled === false), quality: qualityOf(p) };
    const order = isMap(p) ? customNameOrder(p.nameOrder) : undefined;
    if (order) out.nameOrder = order;
    const ask = isMap(p) ? customAskHosts(p.askHosts) : undefined;
    if (ask) out.askHosts = ask;
    const block = isMap(p) ? customBlockHosts(p.blockHosts) : undefined;
    if (block) out.blockHosts = block; // Part 7aa (v0.101.96): a list of websites with at least one valid name
    const allow = isMap(p) ? customAllowHosts(p.allowHosts) : undefined;
    if (allow) out.allowHosts = allow; // Part 7ab (v0.101.97): a list of websites with at least one valid name
    if (isMap(p) && p.askFirst === true) out.askFirst = true; // Part 7z (v0.101.95): only a real `true` counts; anything else leaves the key out
    return out;
  } catch { return keep; }
}

/** One read of config/images.json for the Save (Part 7w, v0.101.92): { on, quality }. Anything wrong (no client, no file, a GitHub error) gives { on: true, quality: undefined }, so the Save goes on as before. Never throws. */
export async function readImagesForSave(gh, cfg) {
  try {
    if (!gh || typeof gh.getText !== 'function') return { on: true, quality: undefined };
    const got = await gh.getText(imagesPathOf(cfg));
    return hostingSettingsFromText(isMap(got) ? got.text : undefined);
  } catch {
    return { on: true, quality: undefined };
  }
}

/** A copy of `deps` with `quality` added, only when the number is valid and `deps` has no `quality` of its own. */
export function qualityDeps(deps, quality) {
  const base = isMap(deps) ? { ...deps } : {};
  if (base.quality === undefined && Number.isInteger(quality) && quality >= 1 && quality <= 100) base.quality = quality;
  return base;
}

// ---- Part 7q (v0.101.86): all the settings of config/images.json, read the same careful way (nothing calls these yet) ----

/** The six ways to make a picture file name, in the order of PLAN 34.4 (a test keeps it equal to NAME_SOURCES of scripts/validate-content-lib.mjs). */
export const NAME_SOURCES = ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle'];

// A website name as the lists want it (a test keeps it equal to HOST_NAME of scripts/validate-content-lib.mjs).
export const HOST_NAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** The shipped value of every setting, as a fresh object each time (a test keeps it equal to site/config/images.json). */
export function imagesDefaults() {
  return { hardBlock: false, blockHosts: [], allowHosts: [], sizeWarnKb: 0, maxWidth: 0, quality: 85, storage: 'repo', askFirst: false, askHosts: [], nameOrder: [...NAME_SOURCES], enabled: true };
}

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const whole = (v, min, max, d) => (Number.isInteger(v) && v >= min && v <= max ? v : d);
// A list of website names: bad entries are dropped, names are made lower case, repeats are dropped, at most 200 are kept.
function hostList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const h of v) {
    if (typeof h !== 'string') continue;
    const n = h.trim().toLowerCase();
    if (HOST_NAME.test(n) && !out.includes(n)) out.push(n);
    if (out.length === 200) break;
  }
  return out;
}
// The naming order is taken whole or not at all: only the six words, each once, ending with "handle"; anything else gives the shipped order.
function nameOrder(v) {
  if (!Array.isArray(v) || v.length === 0 || v.length > NAME_SOURCES.length) return [...NAME_SOURCES];
  const ok = v.every((w, i) => typeof w === 'string' && NAME_SOURCES.includes(w) && v.indexOf(w) === i) && v[v.length - 1] === 'handle';
  return ok ? [...v] : [...NAME_SOURCES];
}

/** The naming order of PLAN 34.4 as the file holds it, only when it is a valid order that is NOT the shipped one; otherwise undefined (the shipped order is then used, so nothing changes). Part 7x (v0.101.93). Never throws, never changes its input. */
export function customNameOrder(v) {
  const ok = nameOrder(v);
  return ok.join(',') === NAME_SOURCES.join(',') ? undefined : ok;
}

/** The websites of `askHosts` as the Save wants them (Part 7y, v0.101.94): the valid names only (lower case, no repeat, at most 200), or undefined when the list is missing, wrong or has no valid name (then nothing is added). Never throws, never changes its input. */
export function customAskHosts(v) {
  const list = hostList(v);
  return list.length > 0 ? list : undefined;
}

/** The websites of `blockHosts` as the Save wants them (Part 7aa, v0.101.96): the valid names only (lower case, no repeat, at most 200), or undefined when the list is missing, wrong or has no valid name (then nothing is added). Never throws, never changes its input. */
export function customBlockHosts(v) {
  const list = hostList(v);
  return list.length > 0 ? list : undefined;
}

/** The websites of `allowHosts` as the Save wants them (Part 7ab, v0.101.97): the valid names only (lower case, no repeat, at most 200), or undefined when the list is missing, wrong or has no valid name (then nothing is added). Never throws, never changes its input. */
export function customAllowHosts(v) {
  const list = hostList(v);
  return list.length > 0 ? list : undefined;
}

/** Every setting of config/images.json, each one checked alone; a missing or wrong one gets its shipped value. Never throws, never changes its input. */
export function imagesSettingsOf(settings) {
  const d = imagesDefaults();
  if (!isMap(settings)) return d;
  return {
    hardBlock: bool(settings.hardBlock, d.hardBlock),
    blockHosts: hostList(settings.blockHosts),
    allowHosts: hostList(settings.allowHosts),
    sizeWarnKb: whole(settings.sizeWarnKb, 0, 20000, d.sizeWarnKb),
    maxWidth: whole(settings.maxWidth, 0, 20000, d.maxWidth),
    quality: qualityOf(settings) ?? d.quality,
    storage: settings.storage === 'repo' || settings.storage === 'r2' ? settings.storage : d.storage,
    askFirst: bool(settings.askFirst, d.askFirst),
    askHosts: hostList(settings.askHosts),
    nameOrder: nameOrder(settings.nameOrder),
    enabled: bool(settings.enabled, d.enabled),
  };
}

/** The settings inside the text of config/images.json; all shipped values for text that is not a JSON object. */
export function imagesSettingsFromText(text) {
  if (typeof text !== 'string' || text.trim() === '') return imagesDefaults();
  try { return imagesSettingsOf(JSON.parse(text)); } catch { return imagesDefaults(); }
}

/** Reads config/images.json with the GitHub client and gives every setting; all shipped values when anything is wrong (no file, no client, bad JSON). */
export async function readImagesSettings(gh, cfg) {
  try {
    if (!gh || typeof gh.getText !== 'function') return imagesDefaults();
    const got = await gh.getText(imagesPathOf(cfg));
    return imagesSettingsFromText(isMap(got) ? got.text : undefined);
  } catch {
    return imagesDefaults();
  }
}
