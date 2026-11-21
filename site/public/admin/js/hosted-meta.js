// Auto image hosting, the rules about the picture itself (PLAN 34.5 and 34.6, LOGICS 22; Phase 3c Part 4a, v0.101.42).
// Pure: no network, no screen, no storage, no clock (the time is passed in).
//   autoAlt        the alt text when the writer left it empty (caption, nearest heading, post title), marked "auto, please review"
//   imgAttributes  width, height, loading and fetchpriority of one picture, and which srcset widths it is wide enough for
//   isAgencyHost / needsConfirm   the agency and stock hosts that are never hosted without the writer's confirmation
//   RIGHTS_NOTICE  the sentence that is always shown
//   recordHosted   the row written to config/media.json for one hosted file (PLAN 34.6), through mergeMedia
//   autoAltFiles   the files whose alt text still waits for a review
// Nothing here fetches, saves or rewrites a post, and nothing is sent to an AI service. Facts are never invented: with no text to use the alt stays empty.
import { ALT_WARN, mergeMedia, mediaErrors } from './media-meta.js';

/** PLAN 34.5: shown every time, never hidden. */
export const RIGHTS_NOTICE = 'Hosting a picture here does not give you the right to publish it. Check the licence and add the credit.';
/** PLAN 34.5: the widths of the srcset (a width is used only when the picture is at least that wide). */
export const SRCSET_WIDTHS = [480, 800, 1200, 1600];
/**
 * A STARTING list of well known agency and stock hosts (PLAN 34.5). The owner owns the real list in config/images.json (Part 7). A host name also matches its sub names
 * (media.gettyimages.com). It is a help to stop and ask, not legal advice and not a complete list.
 */
export const DEFAULT_AGENCY_HOSTS = [
  'gettyimages.com', 'gettyimages.co.uk', 'istockphoto.com', 'shutterstock.com', 'alamy.com', 'adobestock.com', 'stock.adobe.com', 'depositphotos.com',
  'dreamstime.com', '123rf.com', 'apimages.com', 'ap.org', 'reuters.com', 'reutersmedia.net', 'afp.com', 'afpforum.com', 'imago-images.com', 'zumapress.com',
];

const hostOf = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  try { return new URL(/^[a-z][a-z0-9+.-]*:/.test(s) ? s : `https://${s}`).hostname.replace(/\.$/, '').replace(/^www\./, ''); } catch { return ''; }
};

/** The host of an address in lower case, without "www." and without a trailing dot. '' when it cannot be read. */
export const sourceHostOf = (url) => hostOf(url);

/** True when the host (or an address) is on the list or is a sub name of a listed host. list: host names. */
export function isAgencyHost(hostOrUrl, list = DEFAULT_AGENCY_HOSTS) {
  const h = hostOf(hostOrUrl);
  if (!h) return false;
  return (list || []).some((x) => { const k = hostOf(x); return k && (h === k || h.endsWith(`.${k}`)); });
}

/**
 * Must the writer confirm before this picture is hosted? (LOGICS 22: result "needs_confirm".)
 * o: { agencyHosts: list (default DEFAULT_AGENCY_HOSTS), confirmed: addresses or hosts the writer already confirmed, askAll: true (Part 7z, v0.101.95: every readable address waits, whatever its host) }.
 * An address confirmed once is confirmed (the same address, without the #fragment); a confirmed host confirms its whole host.
 */
export function needsConfirm(url, o = {}) {
  const h = hostOf(url);
  if (o.askAll === true ? !h : !isAgencyHost(url, o.agencyHosts ?? DEFAULT_AGENCY_HOSTS)) return false;
  const bare = (u) => { try { const x = new URL(u); x.hash = ''; return x.href; } catch { return ''; } };
  const clean = bare(url);
  return !(o.confirmed || []).some((c) => {
    const s = String(c ?? '').trim();
    if (!s) return false;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? bare(s) === clean && clean !== '' : hostOf(s) === h;
  });
}

/** Text that may be an alt text: tags, Markdown marks and emoji removed, spaces joined, cut at a word end to ALT_WARN characters. */
function altText(text) {
  const t = String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]+/g, ' ')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= ALT_WARN) return t;
  const cut = t.slice(0, ALT_WARN + 1);
  const at = cut.lastIndexOf(' ');
  return (at > 20 ? cut.slice(0, at) : t.slice(0, ALT_WARN)).replace(/[\s,;:.\-]+$/, '');
}

/**
 * The alt text of a picture (PLAN 34.5). img: { alt, caption, heading }. post: { title }.
 * The writer's alt text is kept as it is. If it is empty: the caption, else the nearest heading, else the post title, cleaned and cut to 125 characters,
 * and marked auto (the writer is asked to review it). With no text at all the alt stays empty and is NOT marked auto: nothing is invented.
 * Returns { alt, auto, source: 'alt' | 'caption' | 'heading' | 'title' | '' }.
 */
export function autoAlt(img = {}, post = {}) {
  const own = String(img.alt ?? '').replace(/\s+/g, ' ').trim();
  if (own) return { alt: own, auto: false, source: 'alt' };
  for (const [source, text] of [['caption', img.caption], ['heading', img.heading], ['title', post.title]]) {
    const t = altText(text);
    if (t) return { alt: t, auto: true, source };
  }
  return { alt: '', auto: false, source: '' };
}

const whole = (n) => Number.isInteger(n) && n > 0;

/**
 * The attributes of one picture (PLAN 34.5). info: { width, height } of the hosted file. index: the place of the picture in the page, 0 for the first.
 * width and height are always written (no layout shift); every picture is loading="lazy" except the first, which gets fetchpriority="high" (and no loading attribute, so it loads at once).
 * srcsetWidths: the widths of SRCSET_WIDTHS that are not wider than the file, in order (empty when the file is narrower than 480).
 * Throws a plain message when the size is not known, because a picture without a size would shift the page.
 */
export function imgAttributes(info = {}, index = 0) {
  if (!whole(info.width) || !whole(info.height)) throw new Error('The picture size is not known, so width and height cannot be written.');
  const first = index === 0;
  return {
    width: info.width,
    height: info.height,
    ...(first ? { fetchpriority: 'high' } : { loading: 'lazy' }),
    srcsetWidths: SRCSET_WIDTHS.filter((w) => w <= info.width),
  };
}

const HASH = /^[0-9a-f]{64}$/;

/** "2026-11-16T10:00:00Z" from a Date or an ISO text (seconds, always Z). Throws a plain message for anything else. */
function stamp(v) {
  const d = v instanceof Date ? v : new Date(String(v ?? ''));
  if (Number.isNaN(d.getTime())) throw new Error('The time of hosting is not a valid date.');
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Writes the row of one hosted file into the stored map and returns a NEW map (PLAN 34.6; the input is not changed). Goes through mergeMedia, so the path rule, empty-key removal and
 * keys of other screens are kept. info: { sourceUrl, sha256, width, height, bytes, hostedAt (Date or ISO text), alt, auto, caption, credit }.
 * The row holds: alt, caption, credit (only when not empty), sourceUrl, sourceHost, sha256 (lower case), width, height, bytes, hostedAt, and autoAlt: true only while the alt text waits for a review.
 * Throws a plain message for a bad address, hash, size or time, and for a field the Files screen would refuse (mediaErrors).
 */
export function recordHosted(map, path, info = {}) {
  const sourceUrl = String(info.sourceUrl ?? '').trim();
  const sourceHost = hostOf(sourceUrl);
  if (!/^https?:\/\//i.test(sourceUrl) || !sourceHost) throw new Error('The outside address of the picture is not valid.');
  const sha256 = String(info.sha256 ?? '').trim().toLowerCase();
  if (!HASH.test(sha256)) throw new Error('The picture hash must be 64 hexadecimal characters.');
  if (!whole(info.width) || !whole(info.height) || !whole(info.bytes)) throw new Error('The width, height and size of the picture must be whole numbers above 0.');
  const fields = {
    alt: info.alt, caption: info.caption, credit: info.credit,
    sourceUrl, sourceHost, sha256, width: info.width, height: info.height, bytes: info.bytes, hostedAt: stamp(info.hostedAt),
    autoAlt: info.auto && String(info.alt ?? '').trim() ? true : null,
  };
  const problems = mediaErrors({ alt: fields.alt, caption: fields.caption, credit: fields.credit });
  if (problems.length) throw new Error(problems[0]);
  return mergeMedia(map, path, fields);
}

/** The files whose alt text was made automatically and not reviewed yet: [{ path, alt }], in the order of the map. */
export function autoAltFiles(map = {}) {
  return Object.entries(map && typeof map === 'object' ? map : {}).filter(([, e]) => e && e.autoAlt === true && String(e.alt ?? '').trim()).map(([path, e]) => ({ path, alt: e.alt }));
}
