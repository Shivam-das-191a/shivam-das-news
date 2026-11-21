// Auto image hosting, the pure rules (PLAN 34, LOGICS 22; Phase 3c Part 1, v0.101.39).
// Pure: no network, no screen, no storage. It only answers questions:
//   findExternal   which pictures of a post live on another website?
//   checkAddress   may this address be fetched at all? (https, port 443, no password, a public host)
//   checkRedirects may this chain of redirects be followed? (at most 3, every hop checked again)
//   seoName        what should the hosted file be called?
//   hostedPath     where does it go? (public/media/YYYY/MM/<name>.<ext>, from the POST date)
//   findHosted     is this picture already ours? (same outside address or same SHA-256)
// Part 2 (the Worker) does the real download and must also resolve the host name and refuse a name that points to a private address;
// a name cannot be judged here without a network (LOGICS 22). Nothing here fetches, saves or rewrites a post.
import { readableName } from './media-meta.js';
import { customNameOrder } from './images-setting.js';

/** Redirects that may be followed (PLAN 34.3). */
export const MAX_FETCH_REDIRECTS = 3;
/** Longest address that is accepted. */
export const MAX_URL_LENGTH = 2000;
/** The hosted name: 3 to 6 words, 60 characters at most (PLAN 34.4). */
export const MIN_NAME_WORDS = 3;
export const MAX_NAME_WORDS = 6;
export const MAX_NAME_CHARS = 60;

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in']);

// ---------------------------------------------------------------- find

/** Host in lower case, no trailing dot, no leading "www.". Empty when the text is not an address. */
function hostKey(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, ''); } catch { return ''; }
}

/** Does the address belong to this site? ownHosts: ["shivam-das-news.pages.dev"] or full addresses; "www." is ignored on both sides. */
export function isOwnHost(url, ownHosts = []) {
  const h = hostKey(url);
  if (!h) return false;
  return ownHosts.some((o) => {
    const k = /^[a-z][a-z0-9+.-]*:/i.test(String(o)) ? hostKey(o) : String(o).toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
    return k && k === h;
  });
}

/** Turns the text of an address into an absolute http(s) address, or ''. "//host/x" becomes https. Relative, data:, blob:, mailto: and so on give ''. */
export function absoluteUrl(raw) {
  let u = String(raw ?? '').trim();
  if (!u) return '';
  u = u.replace(/&amp;/gi, '&');
  if (u.startsWith('//')) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) return '';
  return u;
}

/** The same text with code (fenced blocks and `inline`) blanked out, so a picture shown as an example is not found. Same length, so positions stay true. */
export function maskCode(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  let out = String(text ?? '').replace(/(^|\n)([ \t]*)(```|~~~)[^\n]*\n[\s\S]*?(?:\n[ \t]*\3[^\n]*(?=\n|$)|$)/g, (m) => blank(m));
  out = out.replace(/(`+)[^`\n]+?\1/g, (m) => blank(m));
  return out;
}

/** srcset: "a.jpg 480w, b.jpg 800w" gives ["a.jpg","b.jpg"]. A comma inside an address (no space after it) stays in the address. */
function srcsetUrls(value) {
  return String(value ?? '').split(/,\s+/).map((c) => c.trim().split(/\s+/)[0].replace(/,$/, '')).filter(Boolean);
}

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
}

/**
 * Every picture of the post that lives on another website (PLAN 34.3 step 1).
 * post: { body, image, ogImage, imageAlt }. ownHosts: the host names of this site (and of the old hosted addresses).
 * Looks at: the front matter fields image and ogImage; Markdown pictures; HTML <img src> and <img srcset>.
 * Skipped: relative addresses, data: pictures, our own host, pictures inside code. Each address is listed once, in the order
 * image, ogImage, then the body from top to bottom.
 * Returns [{ url, where: 'image'|'ogImage'|'markdown'|'img'|'srcset', alt, heading, index }]; heading is the nearest heading above the picture ('' if none),
 * index is the position in the body (-1 for the front matter fields).
 */
export function findExternal(post = {}, ownHosts = []) {
  const found = [];
  const seen = new Set();
  const add = (raw, where, alt, heading, index) => {
    const url = absoluteUrl(raw);
    if (!url || seen.has(url) || isOwnHost(url, ownHosts)) return;
    seen.add(url);
    found.push({ url, where, alt: String(alt ?? '').trim(), heading: heading || '', index });
  };
  add(post.image, 'image', post.imageAlt, '', -1);
  add(post.ogImage, 'ogImage', '', '', -1);

  const body = String(post.body ?? '');
  const masked = maskCode(body);
  const headings = [];
  const hre = /^(?: {0,3})#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  for (let m = hre.exec(masked); m; m = hre.exec(masked)) headings.push({ at: m.index, text: m[1].replace(/[*_`[\]]/g, '').trim() });
  const htre = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  for (let m = htre.exec(masked); m; m = htre.exec(masked)) headings.push({ at: m.index, text: m[1].replace(/<[^>]*>/g, '').trim() });
  headings.sort((x, y) => x.at - y.at);
  const headingAt = (pos) => { let t = ''; for (const h of headings) { if (h.at < pos) t = h.text; else break; } return t; };

  const hits = [];
  const mre = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  for (let m = mre.exec(masked); m; m = mre.exec(masked)) hits.push({ at: m.index, urls: [[m[2], 'markdown']], alt: m[1] });
  const ire = /<img\b[^>]*>/gi;
  for (let m = ire.exec(masked); m; m = ire.exec(masked)) {
    const tag = m[0];
    const urls = [[attr(tag, 'src'), 'img'], ...srcsetUrls(attr(tag, 'srcset')).map((u) => [u, 'srcset'])];
    hits.push({ at: m.index, urls, alt: attr(tag, 'alt') });
  }
  hits.sort((x, y) => x.at - y.at);
  for (const h of hits) for (const [u, where] of h.urls) add(u, where, h.alt, headingAt(h.at), h.at);
  return found;
}

// ---------------------------------------------------------------- address safety

const BAD_SUFFIX = ['.local', '.localhost', '.localdomain', '.internal', '.intranet', '.private', '.lan', '.home', '.corp', '.test', '.invalid', '.example'];

/** True for an IPv4 address that is not on the public internet. */
function privateV4(a, b) {
  if (a === 0 || a === 10 || a === 127) return true; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier grade NAT
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 and 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true; // benchmarking and documentation
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** Reads an IPv6 address (inside the brackets, as the URL parser writes it) into 8 numbers, or null. */
function parseV6(text) {
  let s = text.toLowerCase();
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (dotted) {
    const p = dotted.slice(1).map(Number);
    s = `${s.slice(0, dotted.index)}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? left.length !== 8 : missing < 1) return null;
  const parts = [...left, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...right];
  if (parts.length !== 8) return null;
  const nums = parts.map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function privateV6(text) {
  const n = parseV6(text);
  if (!n) return true; // cannot read it: do not fetch
  if (n.every((x) => x === 0)) return true; // ::
  if (n.slice(0, 7).every((x) => x === 0) && n[7] === 1) return true; // ::1
  const v4 = (hi) => privateV4(hi >> 8, hi & 255);
  if (n.slice(0, 5).every((x) => x === 0) && (n[5] === 0xffff || n[5] === 0)) return v4(n[6]); // ::ffff:a.b.c.d and ::a.b.c.d
  if (n[0] === 0x64 && n[1] === 0xff9b) return true; // NAT64: may point to a private IPv4
  if (n[0] === 0x2002) return v4(n[1]); // 6to4 wraps an IPv4
  if ((n[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((n[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((n[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((n[0] & 0xff00) === 0xff00) return true; // multicast
  if (n[0] === 0x2001 && n[1] === 0x0db8) return true; // documentation
  return false;
}

const refuse = (reason, text) => ({ ok: false, reason, text });

/**
 * May this address be fetched? (PLAN 34.3 step 2.) Rules: https only; port 443 or none; no user name or password; a host name or a public IP address;
 * never localhost, *.local, *.internal, a private, loopback or link-local IP, or a short name without a dot.
 * o.blockHosts: host names the owner blocked (a name matches itself and its sub names).
 * Returns { ok: true, url, host } (url is the address as the URL parser writes it, without the #fragment) or { ok: false, reason, text }.
 * reason: bad_url | not_https | bad_port | credentials | private_host | blocked_host.
 */
export function checkAddress(raw, o = {}) {
  const text = String(raw ?? '').trim();
  if (!text || text.length > MAX_URL_LENGTH || /[\s\u0000-\u001f]/.test(text)) return refuse('bad_url', 'The address is empty, too long or has a space in it.');
  let u;
  try { u = new URL(text); } catch { return refuse('bad_url', 'The address cannot be read.'); }
  if (u.protocol !== 'https:') return refuse('not_https', 'Only https addresses are fetched.');
  if (u.username || u.password) return refuse('credentials', 'An address with a user name or password is refused.');
  if (u.port && u.port !== '443') return refuse('bad_port', 'Only port 443 is allowed.');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return refuse('bad_url', 'The address has no host.');
  if (host.startsWith('[')) {
    if (privateV6(host.slice(1, -1))) return refuse('private_host', 'That is not a public internet address.');
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (privateV4(a, b)) return refuse('private_host', 'That is not a public internet address.');
  } else {
    if (host === 'localhost' || !host.includes('.') || BAD_SUFFIX.some((s) => host.endsWith(s))) return refuse('private_host', 'That host name is internal.');
    if (/^[0-9.]+$/.test(host)) return refuse('private_host', 'That number is not a public internet address.');
  }
  for (const b of o.blockHosts || []) {
    const k = String(b).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    if (k && (host === k || host === `www.${k}` || host.endsWith(`.${k}`))) return refuse('blocked_host', 'The owner blocked this host.');
  }
  u.hash = '';
  return { ok: true, url: u.href, host };
}

/**
 * May a chain of addresses be followed? chain = [first address, address after redirect 1, ...]. At most 3 redirects (PLAN 34.3);
 * every address, the last one too, passes checkAddress again (a redirect to http or to a private address stops it).
 * Returns { ok: true, hops } or { ok: false, reason, text, at } where `at` is the position in the chain that failed.
 */
export function checkRedirects(chain = [], o = {}) {
  if (!Array.isArray(chain) || chain.length === 0) return { ...refuse('bad_url', 'There is no address.'), at: 0 };
  const hops = chain.length - 1;
  for (let i = 0; i < chain.length; i++) {
    const r = checkAddress(chain[i], o);
    if (!r.ok) return { ...r, at: i };
    if (i > MAX_FETCH_REDIRECTS) break;
  }
  if (hops > MAX_FETCH_REDIRECTS) return { ...refuse('too_many_redirects', `The address redirects more than ${MAX_FETCH_REDIRECTS} times.`), at: MAX_FETCH_REDIRECTS + 1 };
  return { ok: true, hops };
}

// ---------------------------------------------------------------- name and path

/** Plain lower case ASCII words of a text. Accents are removed; other scripts are dropped (they cannot go in a file name). */
function words(text) {
  return String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

/** A word that must never become part of a name: a long number (5 digits or more), a hash (16 or more hex letters and digits with a digit), or a stop word. */
function junk(w) {
  if (STOP.has(w)) return true;
  if (/^\d{5,}$/.test(w)) return true;
  if (/^[0-9a-f]{16,}$/.test(w) && /\d/.test(w)) return true;
  return false;
}

/** The words that may be used from a text, without the other site's name. */
function usable(text, skip) {
  return words(text).filter((w) => !junk(w) && !skip.has(w));
}

/** Words of the old file name in the address, only when the name is meaningful (not IMG_1234, not a hash). */
function oldNameWords(url, skip) {
  let name = '';
  try { name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || ''); } catch { name = ''; }
  const stem = name.replace(/\.[^.]+$/, '');
  if (!stem || !readableName(stem)) return [];
  return usable(stem, skip);
}

/** Cuts a word list to MAX_NAME_WORDS words and MAX_NAME_CHARS characters (whole words only). */
function cut(list) {
  const out = [];
  let len = 0;
  for (const w of list) {
    if (out.length >= MAX_NAME_WORDS) break;
    const next = len + (out.length ? 1 : 0) + w.length;
    if (next > MAX_NAME_CHARS) break;
    out.push(w);
    len = next;
  }
  return out;
}

/**
 * The SEO file name, without folder and ending (PLAN 34.4, LOGICS 22).
 * img:  { url, alt, caption, heading, sourceHost }.   post: { title, focusKeyword, handle }.   n: the number of the picture in the post (1, 2, ...), for the last fallback.
 * Order of the text: alt, caption, nearest heading, focus keyword with the title, a meaningful old file name. The first one that gives at least one word wins;
 * `order` (optional, Part 7x, v0.101.93) is the naming order of config/images.json (the words alt, caption, heading, keyword, oldName, handle; see customNameOrder of images-setting.js): the ways are tried in that order and a way that is not in the list is skipped. A missing, wrong or shipped order gives exactly the order above;
 * if it gives fewer than 3 words, words of the title are added; if that is still under 3, the name is <handle>-image-<n>.
 * Never a camera or random name, never the other site's name, only a-z, 0-9 and hyphens.
 * Returns { name, source: 'alt'|'caption'|'heading'|'title'|'oldname'|'handle' }.
 */
export function seoName(img = {}, post = {}, n = 1, order = undefined) {
  const skip = new Set();
  for (const part of String(img.sourceHost ?? '').toLowerCase().replace(/^www\./, '').split('.')) if (part && part.length > 1) skip.add(part);
  const title = usable(post.title, skip);
  const all = [
    ['alt', usable(img.alt, skip)],
    ['caption', usable(img.caption, skip)],
    ['heading', usable(img.heading, skip)],
    ['title', [...usable(post.focusKeyword, skip), ...title]],
    ['oldname', oldNameWords(img.url, skip)],
  ];
  // Part 7x: the writer's own order of config/images.json ("keyword" is the focus keyword with the title, "oldName" the old file name; "handle" is always the last fallback below).
  const KEY = { alt: 'alt', caption: 'caption', heading: 'heading', keyword: 'title', oldName: 'oldname' };
  const custom = customNameOrder(order);
  const tries = custom ? custom.filter((w) => KEY[w]).map((w) => all.find((t) => t[0] === KEY[w])) : all;
  for (const [source, list] of tries) {
    if (!list.length) continue;
    let w = [...new Set(list)];
    if (w.length < MIN_NAME_WORDS) w = [...new Set([...w, ...title])];
    if (w.length >= MIN_NAME_WORDS) return { name: cut(w).join('-'), source };
    break;
  }
  const handle = words(post.handle).join('-') || 'picture';
  const num = Number.isInteger(n) && n > 0 ? n : 1;
  return { name: `${handle}-image-${num}`.slice(-MAX_NAME_CHARS).replace(/^-+/, ''), source: 'handle' };
}

/** "YYYY/MM" from the POST's publish date (the text written in the post, not the day of the download and not a time zone shift). Throws a plain message when there is none. */
export function datePart(date) {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(String(date ?? '').trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error('The post has no valid date, so the picture folder cannot be chosen.');
  return `${m[1]}/${m[2]}`;
}

/**
 * Where the hosted picture goes (PLAN 34.4): the folder is /media/YYYY/MM/ from the post date. A name that is taken by a DIFFERENT picture gets -2, -3, ...
 * name: from seoName. ext: "webp" or "gif" (no dot). taken: every /media/... address that exists now (array or Set). pub: the repository prefix of /media (for example "site/public").
 * Returns { src: "/media/2026/11/name.webp", path: "site/public/media/2026/11/name.webp", name } (name is the final one, with the number).
 * The caller adds `src` to `taken` before the next picture of the same save.
 */
export function hostedPath(post = {}, name, ext, taken = [], pub = 'site/public') {
  const e = String(ext ?? '').replace(/^\./, '').toLowerCase();
  if (e !== 'webp' && e !== 'gif') throw new Error('A hosted picture is a .webp or a .gif file.');
  const base = String(name ?? '').trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(base)) throw new Error('The picture name may only hold lowercase letters, numbers and hyphens.');
  const dir = `/media/${datePart(post.date)}/`;
  const used = new Set([...taken].map((t) => String(t).toLowerCase()));
  let final = base;
  for (let i = 2; used.has(`${dir}${final}.${e}`); i++) final = `${base}-${i}`;
  const src = `${dir}${final}.${e}`;
  const root = String(pub ?? '').replace(/\/+$/, '');
  return { src, path: root ? `${root}${src}` : src.slice(1), name: final };
}

// ---------------------------------------------------------------- duplicates

/** The outside address without the #fragment, for comparing. */
function same(url) {
  try { const u = new URL(url); u.hash = ''; return u.href; } catch { return String(url ?? '').trim(); }
}

/**
 * Is this picture already hosted? (PLAN 34.3 step 5.) map: the stored config/media.json object. `url` is the outside address, `sha256` the hash of the bytes (hex, any case).
 * An entry matches when its sourceUrl is the same address or its sha256 is the same hash. The address is checked first (no download needed),
 * the hash after the download. Returns { path, by: 'url'|'sha256' } or null.
 */
export function findHosted(map = {}, { url, sha256 } = {}) {
  const u = url ? same(url) : '';
  const h = String(sha256 ?? '').trim().toLowerCase();
  if (u) for (const [path, e] of Object.entries(map || {})) if (e && e.sourceUrl && same(e.sourceUrl) === u) return { path, by: 'url' };
  if (h) for (const [path, e] of Object.entries(map || {})) if (e && e.sha256 && String(e.sha256).toLowerCase() === h) return { path, by: 'sha256' };
  return null;
}
