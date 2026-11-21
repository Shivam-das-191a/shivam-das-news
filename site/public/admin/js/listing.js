// Search engine listing rules (PLAN 33, LOGICS 21). Pure: no screen, no network, no storage.
// The cut is the same function as `truncate` in src/lib/seo.ts (tests/unit/listing.test.ts keeps the two in sync).
import { slugify, SLUG_RE } from './slug.js';
import { plainText } from './text.js';
import { postUrl, dateParts } from './url.js';
import { MIN_IMAGE_WIDTH } from './validate.js';

export const TITLE_WARN = 60;
export const TITLE_STOP = 70;
export const DESC_WARN = 160;
export const DESC_STOP = 320;
export const DESC_AUTO = 155;
export const HANDLE_MAX = 120;
export const REDIRECT_REQUIRED_HOURS = 24;
// Part 5a (v0.101.21): the share card (Open Graph) uses the same limits as the page title and the meta description.
export const OG_TITLE_WARN = TITLE_WARN;
export const OG_TITLE_STOP = TITLE_STOP;
export const OG_DESC_WARN = DESC_WARN;
export const OG_DESC_STOP = DESC_STOP;
export const SCHEMA_TYPES = ['NewsArticle', 'Article', 'BlogPosting'];

const HANDLE_RE = /^[a-z0-9-]+$/;
// Same pattern as src/lib/no-emoji (scripts/no-emoji-lib.mjs): copyright, registered and trade mark signs are allowed.
const EMOJI = /(?![\u00A9\u00AE\u2122])(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}])/u;

/** Cut text at a word boundary, add an ellipsis only when cut (same as truncate in src/lib/seo.ts). */
export function cut(text, max) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const part = t.slice(0, max - 1);
  const i = part.lastIndexOf(' ');
  return (i > max * 0.6 ? part.slice(0, i) : part).replace(/[\s,.;:-]+$/, '') + '\u2026';
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Page title: metaTitle, or the headline plus " | " plus the site name. */
export function autoTitle(post, siteName) {
  const t = clean(post.title);
  const s = clean(siteName);
  return s && t ? `${t} | ${s}` : t;
}

/** The first paragraph of plain text that is not a heading; the summary comes first when the post has one. */
export function firstParagraph(post) {
  const source = clean(post.summary) ? String(post.summary) : String(post.body ?? '');
  // Split first and look for headings on the raw text: plainText() removes the # marks.
  const blocks = source.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const body = blocks.find((b) => !/^#{1,6}\s/.test(b) && !/^<\/?[a-z]/i.test(b) && !/^(```|~~~)/.test(b));
  return body ? clean(plainText(body)) : '';
}

/** Meta description: description, or the first paragraph cut to 155 characters at a word end. */
export function autoDescription(post) {
  return cut(firstParagraph(post), DESC_AUTO);
}

/** URL handle: permalink, or the slug of the headline. */
export function autoHandle(post) {
  return clean(post.permalink) || slugify(clean(post.title));
}

/**
 * What the search engine listing shows (LOGICS 21).
 * ctx: { siteName, origin, timeZone }. Nothing is saved; `auto` says which values came from the fallback.
 */
export function listing(post, ctx = {}) {
  const auto = { title: !clean(post.metaTitle), description: !clean(post.description), handle: !clean(post.permalink) };
  const title = clean(post.metaTitle) || autoTitle(post, ctx.siteName);
  const description = clean(post.description) || autoDescription(post);
  const handle = autoHandle(post);
  const date = post.date instanceof Date ? post.date : new Date(post.date);
  const path = post.category && handle && !Number.isNaN(date.getTime()) && ctx.timeZone ? postUrl(post.category, handle, date, ctx.timeZone) : '';
  const origin = String(ctx.origin ?? '').replace(/\/+$/, '');
  const url = path ? origin + path : '';
  return {
    title, description, handle, path, url, auto,
    shown: { title: cut(title, TITLE_WARN), description: cut(description, DESC_WARN), url },
    counts: { title: title.length, description: description.length, handle: handle.length },
  };
}

/** 'ok', 'warn' or 'stop' for a length, with the same edges as LOGICS 21 (warn above the first limit, stop above the second). */
export function level(length, warn, stop) {
  return length > stop ? 'stop' : length > warn ? 'warn' : 'ok';
}

/** The limit checks of the three fields. Pass the values the page really gets (typed or automatic). */
export function checkLimits(fields) {
  const title = clean(fields.title);
  const description = clean(fields.description);
  const handle = String(fields.handle ?? '');
  const out = { title: level(title.length, TITLE_WARN, TITLE_STOP), description: level(description.length, DESC_WARN, DESC_STOP), handle: 'ok', notes: [] };
  if (title.length > TITLE_STOP) out.notes.push(`Page title is ${title.length} characters; the limit is ${TITLE_STOP}.`);
  else if (title.length > TITLE_WARN) out.notes.push(`Page title is ${title.length} characters; Google usually cuts after ${TITLE_WARN}.`);
  if (description.length > DESC_STOP) out.notes.push(`Meta description is ${description.length} characters; the limit is ${DESC_STOP}.`);
  else if (description.length > DESC_WARN) out.notes.push(`Meta description is ${description.length} characters; Google usually cuts after ${DESC_WARN}.`);
  if (!handle) { out.handle = 'stop'; out.notes.push('The URL handle cannot be empty.'); }
  else if (handle.length > HANDLE_MAX) { out.handle = 'stop'; out.notes.push(`URL handle is ${handle.length} characters; the limit is ${HANDLE_MAX}.`); }
  else if (!HANDLE_RE.test(handle)) { out.handle = 'stop'; out.notes.push('URL handle: lowercase letters, numbers and hyphens only.'); }
  else if (!SLUG_RE.test(handle)) { out.handle = 'warn'; out.notes.push('URL handle should not start or end with a hyphen or hold two hyphens in a row.'); }
  return out;
}

const dayKey = (d, tz) => { const p = dateParts(d instanceof Date ? d : new Date(d), tz); return `${p.y}-${p.m}-${p.d}`; };

/**
 * Hard errors: these block Publish (LOGICS 21). Everything else is a warning.
 * ctx: { timeZone, others: [{ id, permalink, category, date }], selfId }.
 */
export function hardErrors(post, ctx = {}) {
  const errors = [];
  if (!clean(post.title)) errors.push('The title is empty.');
  const handle = autoHandle(post);
  if (handle && post.category && post.date && ctx.timeZone) {
    const mine = dayKey(post.date, ctx.timeZone);
    const same = (ctx.others || []).some((o) => o.id !== ctx.selfId && o.permalink === handle && o.category === post.category && o.date && dayKey(o.date, ctx.timeZone) === mine);
    if (same) errors.push(`The handle "${handle}" is already used in this category on this date.`);
  }
  if (EMOJI.test(`${post.title ?? ''} ${post.metaTitle ?? ''}`)) errors.push('The title must not contain emoji (icons are SVG only).');
  if (EMOJI.test(String(post.description ?? ''))) errors.push('The meta description must not contain emoji (icons are SVG only).');
  const adv = advancedErrors(post, ctx);
  for (const e of adv) errors.push(e);
  if (post.image && post.imageWidth != null && post.imageWidth < MIN_IMAGE_WIDTH) errors.push(`The featured image is ${post.imageWidth} px wide; it needs ${MIN_IMAGE_WIDTH} px or more.`);
  return errors;
}

/**
 * Changing the handle of a post (LOGICS 21).
 * A draft needs no redirect. A published post younger than 24 hours: redirect on by default, may be switched off.
 * Older than 24 hours: the redirect is required. The new handle can never be empty or the handle of another live post.
 * ctx: { now, timeZone, others: [{ id, permalink, category, date, status }], selfId }.
 */
export function changeHandle(post, newHandle, ctx = {}) {
  const next = clean(newHandle);
  const old = autoHandle(post);
  const res = { ok: true, error: null, changed: next !== old, redirect: 'none', canSwitchOff: false };
  if (!next) return { ...res, ok: false, error: 'The URL handle cannot be empty.' };
  const limit = checkLimits({ title: 'x', description: '', handle: next });
  if (limit.handle === 'stop') return { ...res, ok: false, error: limit.notes[limit.notes.length - 1] };
  const clash = (ctx.others || []).some((o) => o.id !== ctx.selfId && o.permalink === next && o.status !== 'draft' && o.status !== 'archived' && (!post.category || o.category === post.category));
  if (clash) return { ...res, ok: false, error: `The handle "${next}" belongs to another live post.` };
  if (!res.changed || post.status !== 'published') return res;
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now ?? Date.now());
  const since = new Date(post.date);
  const hours = (now.getTime() - since.getTime()) / 3600000;
  if (hours > REDIRECT_REQUIRED_HOURS) return { ...res, redirect: 'required', canSwitchOff: false };
  return { ...res, redirect: 'default-on', canSwitchOff: true };
}

/** Hide from search engines (LOGICS 21): robots, and what it removes. `warnBreaking` is the red note of PLAN 33.2. */
export function hideFromSearch(post, on) {
  const robots = on ? 'noindex,follow' : 'index,follow';
  return {
    robots,
    inSitemaps: !on,
    inNewsSitemap: !on,
    inPushAnnounce: !on,
    pushReason: on ? 'noindex' : null,
    warnBreaking: Boolean(on && (post.breaking || post.featured)),
  };
}

// ---------- Advanced fold (PLAN 33.2, Part 5a): share card, canonical, schema type ----------

const absolute = (value, origin) => {
  const v = clean(value);
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const o = String(origin ?? '').replace(/\/+$/, '');
  return o ? o + (v.startsWith('/') ? v : '/' + v) : v;
};

/**
 * What a share (Open Graph) card shows. Same fallbacks as src/lib/seo.ts `shareValues` and the page head:
 * title = ogTitle, else metaTitle, else the headline; description = ogDescription, else the meta description;
 * image = ogImage, else the featured image (empty ogImage means "use the featured image").
 * ctx: { origin }. Nothing is saved; `auto` says which values came from the fallback.
 */
export function shareCard(post, ctx = {}) {
  const auto = { title: !clean(post.ogTitle), description: !clean(post.ogDescription), image: !clean(post.ogImage) };
  const title = clean(post.ogTitle) || clean(post.metaTitle) || clean(post.title);
  const description = clean(post.ogDescription) || clean(post.description);
  const image = clean(post.ogImage) || clean(post.image);
  const origin = String(ctx.origin ?? '').replace(/\/+$/, '');
  let host = '';
  try { host = origin ? new URL(origin).hostname : ''; } catch { host = ''; }
  const titleLevel = level(title.length, OG_TITLE_WARN, OG_TITLE_STOP);
  const descriptionLevel = level(description.length, OG_DESC_WARN, OG_DESC_STOP);
  const notes = [];
  if (title.length > OG_TITLE_STOP) notes.push(`Share title is ${title.length} characters; the limit is ${OG_TITLE_STOP}.`);
  else if (title.length > OG_TITLE_WARN) notes.push(`Share title is ${title.length} characters; apps usually cut after ${OG_TITLE_WARN}.`);
  if (description.length > OG_DESC_STOP) notes.push(`Share description is ${description.length} characters; the limit is ${OG_DESC_STOP}.`);
  else if (description.length > OG_DESC_WARN) notes.push(`Share description is ${description.length} characters; apps usually cut after ${OG_DESC_WARN}.`);
  if (!image) notes.push('No share picture: the site default picture is used.');
  return {
    title, description, image, imageUrl: absolute(image, origin), host, auto,
    usesFeaturedImage: auto.image && Boolean(clean(post.image)),
    shown: { title: cut(title, OG_TITLE_STOP), description: cut(description, OG_DESC_WARN) },
    counts: { title: title.length, description: description.length },
    levels: { title: titleLevel, description: descriptionLevel },
    notes,
  };
}

/**
 * Canonical address check (LOGICS 21). Empty is fine: the page then names its own address.
 * ctx: { selfUrl, origin }. Returns { level: 'ok' | 'warn' | 'stop', notes, effective }.
 */
export function checkCanonical(value, ctx = {}) {
  const v = String(value ?? '').trim();
  const selfUrl = clean(ctx.selfUrl);
  if (!v) return { level: 'ok', notes: [], effective: selfUrl, auto: true };
  const out = { level: 'ok', notes: [], effective: v, auto: false };
  const stop = (msg) => { out.level = 'stop'; out.notes.push(msg); return out; };
  if (/\s/.test(v)) return stop('The canonical address cannot hold spaces.');
  let u;
  try { u = new URL(v); } catch { return stop('The canonical address must be a full address such as https://example.com/page/.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return stop('The canonical address must start with https://.');
  const warn = (msg) => { if (out.level === 'ok') out.level = 'warn'; out.notes.push(msg); };
  if (u.protocol === 'http:') warn('The canonical address uses http; use https.');
  if (u.hash) warn('The canonical address has a # part; remove it.');
  let selfHref = '';
  try { selfHref = selfUrl ? new URL(selfUrl).href : ''; } catch { selfHref = ''; } // a relative or broken own address must not stop the screen
  if (selfHref && u.href === selfHref) { warn('This is the page\'s own address; leave the field empty.'); return out; }
  let originHost = '';
  try { originHost = ctx.origin ? new URL(ctx.origin).hostname : ''; } catch { originHost = ''; }
  if (originHost && u.hostname.toLowerCase() !== originHost.toLowerCase()) warn('This address is on another website. Search engines may list that page and not this one.');
  else warn('This address is another page of this site. Search engines will usually list that page and not this one, and Trending skips this post.');
  return out;
}

/** The schema type must be one of the three the site writes (src/content.config.ts). */
export function checkSchemaType(value) {
  const v = String(value ?? '').trim();
  if (!v) return { level: 'ok', notes: [], effective: 'NewsArticle', auto: true };
  if (!SCHEMA_TYPES.includes(v)) return { level: 'stop', notes: [`Schema type must be one of ${SCHEMA_TYPES.join(', ')}.`], effective: v, auto: false };
  return { level: 'ok', notes: [], effective: v, auto: false };
}

/** Hard errors of the Advanced fold. ctx: { origin, timeZone }. Plain sentences, [] when clean. */
export function advancedErrors(post, ctx = {}) {
  const errors = [];
  const origin = String(ctx.origin ?? '').replace(/\/+$/, '');
  let selfUrl = '';
  try {
    const l = listing(post, ctx);
    selfUrl = l.url;
  } catch { selfUrl = ''; }
  const c = checkCanonical(post.canonical, { selfUrl, origin });
  if (c.level === 'stop') errors.push(c.notes[0]);
  const st = checkSchemaType(post.schemaType);
  if (st.level === 'stop') errors.push(st.notes[0]);
  const ogTitle = clean(post.ogTitle), ogDesc = clean(post.ogDescription);
  if (ogTitle.length > OG_TITLE_STOP) errors.push(`Share title is ${ogTitle.length} characters; the limit is ${OG_TITLE_STOP}.`);
  if (ogDesc.length > OG_DESC_STOP) errors.push(`Share description is ${ogDesc.length} characters; the limit is ${OG_DESC_STOP}.`);
  if (EMOJI.test(`${ogTitle} ${ogDesc}`)) errors.push('The share title and description must not contain emoji (icons are SVG only).');
  const img = clean(post.ogImage);
  if (img && !/^https?:\/\//i.test(img) && !img.startsWith('/')) errors.push('The share picture must start with / (a file of the site) or be a full address.');
  return errors;
}

/**
 * Part 6a (v0.101.23): the search title and description of a category or an author (no screen yet).
 * Same limits and the same no-emoji rule as the post box. Returns the red errors; empty fields are fine (they fall back).
 */
export function entryErrors(entry = {}) {
  const errors = [];
  const t = clean(entry.metaTitle);
  const d = clean(entry.metaDescription);
  if (t.length > TITLE_STOP) errors.push(`The search title is ${t.length} characters; the limit is ${TITLE_STOP}.`);
  if (d.length > DESC_STOP) errors.push(`The search description is ${d.length} characters; the limit is ${DESC_STOP}.`);
  if (EMOJI.test(`${t} ${d}`)) errors.push('The search title and description must not contain emoji (icons are SVG only).');
  return errors;
}

/**
 * Save without losing fields this screen does not show (for example metaTitle of a category).
 * `prev` is the stored entry; `fields` are the values the screen owns: an empty string removes the key, anything else sets it.
 */
export function mergeEntry(prev, fields) {
  const out = { ...(prev && typeof prev === 'object' ? prev : {}) };
  for (const [k, v] of Object.entries(fields)) {
    if (v === '' || v == null) delete out[k];
    else out[k] = v;
  }
  return out;
}

/**
 * Part 6b (v0.101.24): what the listing box shows for a category or an author.
 * entry: { title (display name), description (the text shown on the page), metaTitle, metaDescription }.
 * ctx: { siteName, origin, path }. Same fallback as the page head (listingHead in src/lib/seo.ts): empty fields use the name and the visible text.
 * Same look as the post box: an own search title is shown as typed, the automatic one carries the site name.
 */
export function entryListing(entry = {}, ctx = {}) {
  const auto = { title: !clean(entry.metaTitle), description: !clean(entry.metaDescription) };
  const name = clean(entry.title);
  const site = clean(ctx.siteName);
  // ctx.autoTitle: a page whose automatic title is not "name | site" (the home page: "site - tagline").
  const title = clean(entry.metaTitle) || (ctx.autoTitle != null ? clean(ctx.autoTitle) : site && name ? `${name} | ${site}` : name);
  const description = clean(entry.metaDescription) || clean(entry.description);
  const path = String(ctx.path ?? '');
  const origin = String(ctx.origin ?? '').replace(/\/+$/, '');
  const counts = { title: title.length, description: description.length };
  const levels = { title: level(counts.title, TITLE_WARN, TITLE_STOP), description: level(counts.description, DESC_WARN, DESC_STOP) };
  const notes = [];
  if (levels.title === 'warn') notes.push(`The search title is ${counts.title} characters; Google usually cuts after ${TITLE_WARN}.`);
  if (levels.description === 'warn') notes.push(`The search description is ${counts.description} characters; Google usually cuts after ${DESC_WARN}.`);
  return {
    title, description, auto, path, url: path ? origin + path : '', counts, levels, notes,
    shown: { title: cut(title, TITLE_WARN), description: cut(description, DESC_WARN) },
    errors: entryErrors(entry),
  };
}
