// Phase 3d Part 2 (LOGICS 23): the content rules behind `npm run check:content`. Pure functions, no file access.
// The rules mirror src/content.config.ts (a test keeps the two from drifting apart) and the dashboard helpers in public/admin/js.
import { parse } from '../public/admin/js/frontmatter.js';
import { postUrl } from '../public/admin/js/url.js';
import { normalizePath } from '../public/admin/js/redirects.js';
import { findEmoji, codePoints } from './no-emoji-lib.mjs';
import { findExternal, maskCode } from '../public/admin/js/hotlink.js';
import { imageSize } from './image-size-lib.mjs';

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const POST_STATUS = ['draft', 'scheduled', 'published', 'archived'];
export const PAGE_STATUS = ['draft', 'published'];
export const SCHEMA_TYPES = ['NewsArticle', 'Article', 'BlogPosting'];
export const PUSH_MODES = ['auto', 'off', 'force'];
export const MAX_REDIRECTS = 2000;
const HAS_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

const isStr = (v) => typeof v === 'string';
const len = (v) => (isStr(v) ? [...v].length : 0);

/** The heading levels of a Markdown body (code fences skipped): [{ level, text }]. */
export function headingsOf(body) {
  const out = [];
  let fence = false;
  for (const line of String(body ?? '').split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^(#{1,6})\s+(\S.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

/** Text that looks like a token or key (LOGICS 23 secretScan). Returns the kinds found, [] when clean. */
export function secretScan(text) {
  const t = String(text ?? '');
  const kinds = [];
  if (/ghp_[A-Za-z0-9]{20,}/.test(t)) kinds.push('a GitHub token (ghp_)');
  if (/github_pat_[A-Za-z0-9_]{20,}/.test(t)) kinds.push('a GitHub token (github_pat_)');
  if (/\bsk-[A-Za-z0-9_-]{20,}/.test(t)) kinds.push('a secret key (sk-)');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) kinds.push('a private key');
  if (/(?<![0-9a-fA-F])[0-9a-fA-F]{64}(?![0-9a-fA-F])/.test(t)) kinds.push('a 64 character hex string');
  return kinds;
}

const emojiProblem = (text) => { const e = findEmoji(text); return e.length ? `contains an emoji or icon symbol (${codePoints(e)}); the site uses inline SVG only` : ''; };

/**
 * The pictures of our own site that the TEXT of a post shows (Part 7e): Markdown ![alt](/media/x.webp) and <img src="/media/x.webp">.
 * Code blocks and inline code are skipped, a ?query or #part is cut off, a path with .. is ignored, each file is listed once, in the order of the text.
 */
export function localPictures(body) {
  const masked = maskCode(String(body ?? ''));
  const hits = [];
  const clean = (raw) => { const p = String(raw ?? '').split(/[?#]/)[0]; return p.startsWith('/media/') && !p.includes('..') ? p : ''; };
  const mre = /!\[[^\]]*\]\(\s*<?(\/media\/[^)\s>]+)>?/g;
  for (let m = mre.exec(masked); m; m = mre.exec(masked)) hits.push({ at: m.index, path: clean(m[1]) });
  const ire = /<img\b[^>]*>/gi;
  for (let m = ire.exec(masked); m; m = ire.exec(masked)) {
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
    if (src) hits.push({ at: m.index, path: clean(src[1] ?? src[2] ?? src[3]) });
  }
  hits.sort((a, b) => a.at - b.at);
  const out = [];
  for (const h of hits) if (h.path && !out.includes(h.path)) out.push(h.path);
  return out;
}

/**
 * One post file. `imageExists(path)` tells whether /media/x.webp exists in public/.
 * Returns { errors, warnings, data } with plain sentences.
 */
export function checkPost({ text, imageExists = () => true, ownHosts = [], hardBlock = false, blockHosts = [], allowHosts = [], sizeWarnKb = 0, imageBytes = () => undefined, maxWidth = 0, imageHead = () => undefined }) {
  const errors = [], warnings = [];
  const { data, body } = parse(String(text ?? ''));
  if (!/^---\r?\n/.test(String(text ?? '')) || !Object.keys(data).length) return { errors: ['no front matter between --- lines'], warnings, data };
  const need = (ok, msg) => { if (!ok) errors.push(msg); };
  // Part 7c (v0.101.71): a picture file of a published post that is bigger than config/images.json "sizeWarnKb" is a warning (0 or missing means off).
  const measured = new Set();
  const tooBig = (path, label) => {
    if (!(typeof sizeWarnKb === 'number' && Number.isFinite(sizeWarnKb) && sizeWarnKb > 0)) return;
    if (measured.has(path)) return; // the same file is reported once, even when it is used twice
    measured.add(path);
    const b = imageBytes(path);
    if (typeof b === 'number' && b > sizeWarnKb * 1024) warnings.push(`${label} ${path} is ${Math.ceil(b / 1024)} KB, over the limit of ${sizeWarnKb} KB in config/images.json; make the picture smaller`);
  };
  // Part 7g (v0.101.75): a picture wider than config/images.json "maxWidth" (pixels) is a warning (0 or missing means off). The width is read from the first bytes of the file (image-size-lib.mjs).
  const widthDone = new Set();
  const tooWide = (path, label) => {
    if (!(typeof maxWidth === 'number' && Number.isFinite(maxWidth) && maxWidth > 0)) return;
    if (widthDone.has(path)) return; // the same file is reported once
    widthDone.add(path);
    const head = imageHead(path);
    const size = head ? imageSize(head) : null;
    if (size && size.width > maxWidth) warnings.push(`${label} ${path} is ${size.width} pixels wide, over the limit of ${maxWidth} pixels in config/images.json; make the picture narrower`);
  };
  const measure = (path, label) => { tooBig(path, label); tooWide(path, label); };

  need(isStr(data.title) && len(data.title) >= 5, 'title must be text of at least 5 characters');
  need(isStr(data.permalink) && SLUG.test(data.permalink), 'permalink must be lowercase letters, numbers and hyphens only');
  need(isStr(data.category) && SLUG.test(data.category), 'category must be lowercase letters, numbers and hyphens only');
  if ('author' in data) need(isStr(data.author) && SLUG.test(data.author), 'author must be a slug such as shivam-das');
  const status = data.status === undefined ? 'draft' : data.status;
  need(POST_STATUS.includes(status), `status must be one of ${POST_STATUS.join(', ')}`);
  if ('description' in data) need(isStr(data.description) && len(data.description) <= 160, 'description must be at most 160 characters');
  if ('schemaType' in data) need(SCHEMA_TYPES.includes(data.schemaType), `schemaType must be one of ${SCHEMA_TYPES.join(', ')}`);
  if ('canonical' in data && isStr(data.canonical) && data.canonical.trim() !== '') {
    let okUrl = !/\s/.test(data.canonical);
    try { const u = new URL(data.canonical); okUrl = okUrl && (u.protocol === 'https:' || u.protocol === 'http:'); } catch { okUrl = false; }
    need(okUrl, 'canonical must be a full address such as https://example.com/page/ (or empty)');
  } else if ('canonical' in data) need(isStr(data.canonical), 'canonical must be text');
  if ('ogTitle' in data) need(isStr(data.ogTitle) && len(data.ogTitle) <= 70, 'ogTitle must be at most 70 characters');
  if ('ogDescription' in data) need(isStr(data.ogDescription) && len(data.ogDescription) <= 320, 'ogDescription must be at most 320 characters');
  if ('ogImage' in data) {
    need(isStr(data.ogImage), 'ogImage must be text');
    if (isStr(data.ogImage) && data.ogImage.trim()) {
      if (/^https?:\/\//i.test(data.ogImage)) warnings.push('the share picture (ogImage) is an outside address; host the picture on the site (AI_OPERATIONS 8)');
      else if (data.ogImage.startsWith('/')) { if (status === 'published') { need(imageExists(data.ogImage), `ogImage file ${data.ogImage} was not found in public/`); measure(data.ogImage, 'the share picture'); } }
      else errors.push('ogImage must start with / (a file in public/) or be a full address');
    }
  }
  if ('push' in data) need(PUSH_MODES.includes(data.push), `push must be one of ${PUSH_MODES.join(', ')}`);
  if ('pushTitle' in data) need(isStr(data.pushTitle) && len(data.pushTitle) <= 70, 'pushTitle must be at most 70 characters');
  if ('pushBody' in data) need(isStr(data.pushBody) && len(data.pushBody) <= 120, 'pushBody must be at most 120 characters');
  if ('tags' in data) need(Array.isArray(data.tags), 'tags must be a list');
  if ('location' in data) need(Array.isArray(data.location) && data.location.length <= 3, 'location must be a list of at most 3 names');
  for (const k of ['breaking', 'featured', 'trending', 'autoLinks']) if (k in data) need(typeof data[k] === 'boolean', `${k} must be true or false`);

  const rawDate = isStr(data.date) ? data.date : '';
  const dateOk = rawDate !== '' && !Number.isNaN(new Date(rawDate).getTime());
  need(dateOk, 'date is missing or not a real date');
  if (dateOk && !HAS_OFFSET.test(rawDate)) {
    const msg = 'date needs a time and a time zone offset, for example 2026-11-16T09:00:00Z';
    if (status === 'published' || status === 'scheduled') errors.push(msg); else warnings.push(msg);
  }

  if (status === 'scheduled') warnings.push('status "scheduled" is not used by the site: use "published" with a future date');
  if (status === 'published') {
    need(isStr(data.image) && data.image.trim() !== '', 'a published post needs an image');
    need(isStr(data.imageAlt) && data.imageAlt.trim() !== '', 'a published post needs imageAlt');
    const d = len(data.description);
    need(d >= 50 && d <= 160, `a published post needs a description of 50 to 160 characters (now ${d})`);
    if (isStr(data.image) && data.image.trim()) {
      if (/^https?:\/\//i.test(data.image)) warnings.push('the image is an outside address; host the picture on the site (AI_OPERATIONS 8)');
      else if (data.image.startsWith('/')) { need(imageExists(data.image), `image file ${data.image} was not found in public/`); measure(data.image, 'the image'); }
      else errors.push('image must start with / (a file in public/) or be a full address');
    }
  }

  const heads = headingsOf(body);
  if (heads.length) {
    if (heads[0].level !== 2) errors.push(`the first heading must be H2 (the title is the H1); found H${heads[0].level} "${heads[0].text}"`);
    for (let i = 1; i < heads.length; i++) if (heads[i].level > heads[i - 1].level + 1) errors.push(`heading "${heads[i].text}" skips a level (H${heads[i - 1].level} then H${heads[i].level})`);
  }
  // Part 7e (v0.101.73): the pictures of OUR OWN site inside the text of a published post (/media/...) are measured with the same sizeWarnKb.
  if (status === 'published') for (const p of localPictures(body)) measure(p, 'the picture in the text');
  // PLAN 34.9 (Phase 3c Part 6a, v0.101.68): the build gate. A live post whose TEXT still shows a picture from another website is listed as a warning.
  // (The front matter fields image and ogImage are warned about above.) It stays a warning unless config/images.json has "hardBlock": true (Part 7a, v0.101.69): then it is an error.
  if (status === 'published' || status === 'scheduled') {
    const all = findExternal({ body }, ownHosts);
    // Part 7b (v0.101.70): a picture from a website on the block list (config/images.json "blockHosts") is always an error, with or without hardBlock.
    const blocked = all.filter((f) => hostBlocked(f.url, blockHosts));
    // Part 7d (v0.101.72): a picture from a website on the allow list (config/images.json "allowHosts") is accepted like our own; the block list wins if a name is in both.
    const outside = all.filter((f) => !blocked.includes(f) && !hostBlocked(f.url, allowHosts));
    if (blocked.length) errors.push(`${blocked.length} picture${blocked.length === 1 ? '' : 's'} in the text ${blocked.length === 1 ? 'is' : 'are'} from a website on the block list in config/images.json (first: ${blocked[0].url}); use another picture`);
    if (outside.length) (hardBlock === true ? errors : warnings).push(`${outside.length} picture${outside.length === 1 ? '' : 's'} in the text ${outside.length === 1 ? 'is' : 'are'} on another website (first: ${outside[0].url}); host ${outside.length === 1 ? 'it' : 'them'} on the site (AI_OPERATIONS 8)`);
  }
  const em = emojiProblem(text); if (em) errors.push(em);
  for (const k of secretScan(text)) errors.push(`looks like ${k}; remove it`);
  return { errors, warnings, data };
}

/** A host name as the block list wants it: lowercase letters, numbers, dots and hyphens, no address, no slash, no space (for example "photos.example.com"). */
export const HOST_NAME = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** True when the address is on a listed website or on a sub-site of it ("example.com" also blocks "cdn.example.com"). Bad list entries are skipped. */
export function hostListed(url, blockHosts) {
  if (!Array.isArray(blockHosts) || blockHosts.length === 0) return false;
  let host = '';
  try { host = new URL(String(url)).hostname.toLowerCase().replace(/\.$/, ''); } catch { return false; }
  if (!host) return false;
  return blockHosts.some((b) => typeof b === 'string' && HOST_NAME.test(b.trim().toLowerCase()) && (host === b.trim().toLowerCase() || host.endsWith('.' + b.trim().toLowerCase())));
}

/** The same test under the name the block list uses. */
export const hostBlocked = hostListed;

/** The six ways to make a picture file name, in the default order of PLAN 34.4 (Part 7o). */
export const NAME_SOURCES = ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle'];

/** config/images.json (PLAN 34.10): `hardBlock` (Part 7a; true makes an outside picture in a live post an error; shipped false), `blockHosts` (Part 7b; a list of website names whose pictures are never allowed in a live post; shipped empty), `allowHosts` (Part 7d; website names whose pictures count as our own, so they get no outside-picture warning; shipped empty) `enabled` (Part 7p; true or false, shipped true; on or off for picture hosting; nothing reads it yet), `nameOrder` (Part 7o; the order of the six ways to make a file name, shipped as in PLAN 34.4, must end with "handle"; nothing reads it yet), `askHosts` (Part 7n; website names whose pictures would ask first; shipped empty; nothing reads the list yet), `askFirst` (Part 7m; true or false, shipped false = automatic; nothing reads the value yet), `storage` (Part 7l; the text "repo" or "r2", shipped "repo"; only "repo" is built, nothing reads the value yet) and `sizeWarnKb` (Part 7c; a picture file bigger than this many KB in a live post is a warning; shipped 0 = off). Returns a list of plain messages. */
export function checkImagesConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return ['must be an object such as { "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0 }'];
  const out = [];
  if ('hardBlock' in cfg && typeof cfg.hardBlock !== 'boolean') out.push('"hardBlock" must be true or false (without quotes)');
  for (const key of ['blockHosts', 'allowHosts', 'askHosts']) {
    if (!(key in cfg)) continue;
    if (!Array.isArray(cfg[key])) { out.push(`"${key}" must be a list of website names such as ["photos.example.com"]`); continue; }
    cfg[key].forEach((h, i) => {
      if (typeof h !== 'string' || !HOST_NAME.test(h.trim().toLowerCase())) out.push(`"${key}" entry ${i + 1} must be a website name only, such as photos.example.com (no https://, no slash, no spaces)`);
    });
    if (cfg[key].length > 200) out.push(`"${key}" may have at most 200 names`);
  }
  if (Array.isArray(cfg.blockHosts) && Array.isArray(cfg.allowHosts)) {
    const blocked = new Set(cfg.blockHosts.filter((h) => typeof h === 'string').map((h) => h.trim().toLowerCase()));
    for (const h of cfg.allowHosts) if (typeof h === 'string' && blocked.has(h.trim().toLowerCase())) out.push(`"${h}" is in both "blockHosts" and "allowHosts"; keep it in one list`);
  }
  // Part 7n (v0.101.83): PLAN 34.10 "the agency host list". Pictures from these websites would ask first. A name that is blocked can not also ask first. Nothing reads the list yet.
  if (Array.isArray(cfg.askHosts) && Array.isArray(cfg.blockHosts)) {
    const blocked2 = new Set(cfg.blockHosts.filter((h) => typeof h === 'string').map((h) => h.trim().toLowerCase()));
    for (const h of cfg.askHosts) if (typeof h === 'string' && blocked2.has(h.trim().toLowerCase())) out.push(`"${h}" is in both "askHosts" and "blockHosts"; keep it in one list`);
  }
  // Part 7o (v0.101.84): PLAN 34.10 "the naming order" (PLAN 34.4). A list of NAME_SOURCES, each at most once, ending with "handle" so a name can always be made. Nothing reads it yet.
  if ('nameOrder' in cfg) {
    const list = cfg.nameOrder, words = NAME_SOURCES.join(', ');
    if (!Array.isArray(list)) out.push(`"nameOrder" must be a list of the words ${words}`);
    else {
      const before = out.length, seen = new Set();
      list.forEach((w, i) => {
        if (typeof w !== 'string' || !NAME_SOURCES.includes(w)) out.push(`"nameOrder" entry ${i + 1} must be one of ${words}`);
        else if (seen.has(w)) out.push(`"nameOrder" lists "${w}" twice`);
        else seen.add(w);
      });
      if (out.length === before && list[list.length - 1] !== 'handle') out.push('"nameOrder" must end with "handle" (the last way to make a name)');
    }
  }
  // Part 7p (v0.101.85): PLAN 34.10 "on or off". true = picture hosting is allowed (it still needs imagesUrl in admin/config.json to run), false = off. Nothing reads the value yet.
  if ('enabled' in cfg && typeof cfg.enabled !== 'boolean') out.push('"enabled" must be true or false (without quotes)');
  if ('sizeWarnKb' in cfg && !(Number.isInteger(cfg.sizeWarnKb) && cfg.sizeWarnKb >= 0 && cfg.sizeWarnKb <= 20000)) out.push('"sizeWarnKb" must be a whole number from 0 to 20000 (0 means off), for example 300');
  if ('maxWidth' in cfg && !(Number.isInteger(cfg.maxWidth) && cfg.maxWidth >= 0 && cfg.maxWidth <= 20000)) out.push('"maxWidth" must be a whole number of pixels from 0 to 20000 (0 means off), for example 1600');
  if ('quality' in cfg && !(Number.isInteger(cfg.quality) && cfg.quality >= 1 && cfg.quality <= 100)) out.push('"quality" must be a whole number from 1 to 100 (a percent), for example 85');
  if ('storage' in cfg && !(cfg.storage === 'repo' || cfg.storage === 'r2')) out.push('"storage" must be the text "repo" or "r2" (with quotes), for example "repo"');
  // Part 7m (v0.101.82): PLAN 34.10 "automatic or ask first". false = automatic (as today), true = ask first. Nothing reads the value yet.
  if ('askFirst' in cfg && typeof cfg.askFirst !== 'boolean') out.push('"askFirst" must be true or false (without quotes)');
  return out;
}

/** One page file (content/pages). */
export function checkPage({ text }) {
  const errors = [], warnings = [];
  const { data } = parse(String(text ?? ''));
  if (!/^---\r?\n/.test(String(text ?? '')) || !Object.keys(data).length) return { errors: ['no front matter between --- lines'], warnings, data };
  if (!(isStr(data.title) && len(data.title) >= 2)) errors.push('title must be text of at least 2 characters');
  if (!(isStr(data.permalink) && SLUG.test(data.permalink))) errors.push('permalink must be lowercase letters, numbers and hyphens only');
  const status = data.status === undefined ? 'draft' : data.status;
  if (!PAGE_STATUS.includes(status)) errors.push(`status must be one of ${PAGE_STATUS.join(', ')}`);
  if ('description' in data && !(isStr(data.description) && len(data.description) <= 160)) errors.push('description must be at most 160 characters');
  if ('metaTitle' in data && !(isStr(data.metaTitle) && len(data.metaTitle) <= 70)) errors.push('metaTitle (search title) must be at most 70 characters');
  if ('metaDescription' in data && !(isStr(data.metaDescription) && len(data.metaDescription) <= 320)) errors.push('metaDescription (search description) must be at most 320 characters');
  if (!(isStr(data.date) && !Number.isNaN(new Date(data.date).getTime()))) errors.push('date is missing or not a real date');
  const em = emojiProblem(text); if (em) errors.push(em);
  for (const k of secretScan(text)) errors.push(`looks like ${k}; remove it`);
  return { errors, warnings, data };
}

/**
 * config/tags.json (v0.101.26, PLAN 33.2 Part 6d): an object by tag slug, each { metaTitle?, metaDescription? }.
 * Same limits as a page (70 and 320) and the same no-emoji rule. Returns plain error lines.
 */
export function checkTags(map) {
  const errors = [];
  if (map === null || typeof map !== 'object' || Array.isArray(map)) return ['must be an object with one entry per tag slug'];
  for (const [slug, v] of Object.entries(map)) {
    if (!SLUG.test(slug)) errors.push(`\"${slug}\" is not a tag slug (lowercase letters, numbers and hyphens only)`);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${slug}: must be an object`); continue; }
    for (const k of Object.keys(v)) if (k !== 'metaTitle' && k !== 'metaDescription') errors.push(`${slug}: unknown key \"${k}\"`);
    if ('metaTitle' in v && !(isStr(v.metaTitle) && len(v.metaTitle) <= 70)) errors.push(`${slug}: metaTitle must be text of at most 70 characters`);
    if ('metaDescription' in v && !(isStr(v.metaDescription) && len(v.metaDescription) <= 320)) errors.push(`${slug}: metaDescription must be text of at most 320 characters`);
    const em = emojiProblem(`${v.metaTitle ?? ''} ${v.metaDescription ?? ''}`); if (em) errors.push(`${slug}: ${em}`);
  }
  return errors;
}

/**
 * config/media.json (v0.101.27, PLAN 33.3 Part 7a): an object by file path, each { alt?, caption?, credit? }.
 * The path starts with /media/ and has no "..". Limits: alt 300, caption 300, credit 120 (the same numbers as
 * public/admin/js/media-meta.js; a test keeps the two in sync); no emoji. Other keys are allowed and ignored here
 * (the picture hosting of PLAN 34 will add its own). Returns plain error lines.
 */
export function checkMedia(map) {
  const errors = [];
  if (map === null || typeof map !== 'object' || Array.isArray(map)) return ['must be an object with one entry per file path'];
  const limits = { alt: 300, caption: 300, credit: 120 };
  for (const [path, v] of Object.entries(map)) {
    if (!path.startsWith('/media/') || path.includes('..') || /[?#\s]/.test(path)) { errors.push(`\"${path}\" is not a file path under /media/`); continue; }
    if (v === null || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${path}: must be an object`); continue; }
    for (const [k, max] of Object.entries(limits)) {
      if (k in v && !(isStr(v[k]) && len(v[k]) <= max)) errors.push(`${path}: ${k} must be text of at most ${max} characters`);
    }
    const em = emojiProblem(`${v.alt ?? ''} ${v.caption ?? ''} ${v.credit ?? ''}`); if (em) errors.push(`${path}: ${em}`);
  }
  return errors;
}

/** All posts together: `permalink` and the live address must be unique. posts = [{ file, data }]. */
export function checkPosts(posts, timeZone = 'UTC') {
  const errors = [];
  const slugs = new Map(), urls = new Map();
  for (const p of posts) {
    const { permalink, category, status } = p.data || {};
    if (!permalink) continue;
    if (slugs.has(permalink)) errors.push(`${p.file}: permalink "${permalink}" is also used by ${slugs.get(permalink)}`); else slugs.set(permalink, p.file);
    const d = new Date(p.data.date);
    if (status === 'published' && category && !Number.isNaN(d.getTime())) {
      const u = postUrl(category, permalink, d, timeZone);
      if (urls.has(u)) errors.push(`${p.file}: the address ${u} is also used by ${urls.get(u)}`); else urls.set(u, p.file);
    }
  }
  return errors;
}

/** The live addresses of the published posts, as a Set. */
export function livePaths(posts, timeZone = 'UTC') {
  const s = new Set();
  for (const p of posts) {
    const d = p.data || {};
    if (d.status === 'published' && d.category && d.permalink && !Number.isNaN(new Date(d.date).getTime())) s.add(postUrl(d.category, d.permalink, new Date(d.date), timeZone));
  }
  return s;
}

/** config/redirects.json: a list of { from, to }; both normalized; from is not a live page; no duplicate from; at most 2000. */
export function checkRedirects(list, live = new Set()) {
  const errors = [];
  if (!Array.isArray(list)) return ['redirects.json must be a list'];
  if (list.length > MAX_REDIRECTS) errors.push(`${list.length} redirects; Cloudflare Pages allows ${MAX_REDIRECTS}`);
  const seen = new Set();
  list.forEach((r, i) => {
    const at = `redirect ${i + 1}`;
    if (!r || typeof r !== 'object') { errors.push(`${at}: must be { "from": ..., "to": ... }`); return; }
    const f = normalizePath(r.from), t = normalizePath(r.to);
    if (!f) errors.push(`${at}: "${r.from}" is not a usable old address`); else if (f !== r.from) errors.push(`${at}: "${r.from}" is not normalized, write ${f}`);
    if (!t) errors.push(`${at}: "${r.to}" is not a usable new address`); else if (t !== r.to) errors.push(`${at}: "${r.to}" is not normalized, write ${t}`);
    if (f && t && f === t) errors.push(`${at}: the old and the new address are the same`);
    if (f && live.has(f)) errors.push(`${at}: ${f} is a live page, so it cannot redirect`);
    if (f) { if (seen.has(f)) errors.push(`${at}: ${f} already has a redirect`); seen.add(f); }
  });
  return errors;
}

/** checkJson(prev, next): the keys of the old version that the new version lost, as paths such as "verification.bing". */
export function removedKeys(prev, next, base = '') {
  const lost = [];
  if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return lost;
  for (const k of Object.keys(prev)) {
    const here = base ? `${base}.${k}` : k;
    if (!next || typeof next !== 'object' || !(k in next)) lost.push(here);
    else if (prev[k] && typeof prev[k] === 'object' && !Array.isArray(prev[k])) lost.push(...removedKeys(prev[k], next[k], here));
  }
  return lost;
}

/**
 * A post that was published and now has another address (date day, category or permalink) needs the old address in a redirect.
 * prev and next are front matter objects; redirects = the manual redirect list; returns a sentence or ''.
 */
export function addressChange(prev, next, redirects = [], timeZone = 'UTC') {
  if (!prev || prev.status !== 'published' || !next) return '';
  const a = new Date(prev.date), b = new Date(next.date);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const oldUrl = postUrl(prev.category, prev.permalink, a, timeZone);
  const newUrl = postUrl(next.category, next.permalink, b, timeZone);
  if (oldUrl === newUrl) return '';
  const covered = (Array.isArray(next.redirects) && next.redirects.includes(oldUrl)) || redirects.some((r) => r && r.from === oldUrl);
  return covered ? '' : `the address ${oldUrl} changed to ${newUrl} but the old address is not in redirects`;
}

// Part 7ae (BUGS U12): a repository should stay under about 1 GB. The pictures in public/media get a warning near that size.
// Fixed value, no setting. Returns one plain sentence, or null when the size is fine or not a number.
export const MEDIA_WARN_MB = 900;
export function mediaSizeWarning(totalBytes, limitMb = MEDIA_WARN_MB) {
  if (typeof totalBytes !== 'number' || !Number.isFinite(totalBytes) || totalBytes < 0) return null;
  if (typeof limitMb !== 'number' || !Number.isFinite(limitMb) || limitMb <= 0) return null;
  if (totalBytes <= limitMb * 1024 * 1024) return null;
  const mb = Math.round(totalBytes / (1024 * 1024));
  return `the pictures in public/media use ${mb} MB; a repository should stay under about 1 GB, so plan the move to Cloudflare R2 (decision 15)`;
}
