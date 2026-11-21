// Auto image hosting, the plan and the rewrite (PLAN 34.3 steps 1, 2, 5 and 8, LOGICS 22; Phase 3c Part 3a, v0.101.43).
// Pure: no network, no screen, no storage. Two jobs:
//   planHosting   look at a post BEFORE anything is downloaded and say, for each outside picture: fetch, reuse, needs_confirm or refused
//   rewritePost   AFTER the pictures are hosted, change the addresses in the post (body, image, ogImage) to the new /media/... addresses
// Plus summarize (the counts for the result list). It downloads nothing, saves nothing and commits nothing: the Save pipeline (the next part) does that.
import { findExternal, checkAddress, findHosted, absoluteUrl, maskCode } from './hotlink.js';
import { needsConfirm } from './hosted-meta.js';

/** Words of `status` in a plan item. */
export const STATUS = ['fetch', 'reuse', 'needs_confirm', 'refused'];

/**
 * The plan for one post (LOGICS 22, host(post), before the download).
 * post: { body, image, imageAlt, ogImage }. o: { ownHosts, map (config/media.json), agencyHosts, confirmed, blockHosts, askAll (Part 7z: true makes every picture that would be fetched wait for the writer) }.
 * For each outside picture, in the order of findExternal, the first rule that fits wins (the order of LOGICS 22):
 *   refused        the address may not be fetched (checkAddress: http, port, user name, private host, blocked host); `reason` and `text` say why
 *   needs_confirm  an agency or stock host that the writer has not confirmed yet (with askAll: also any picture that is not hosted yet)
 *   reuse          config/media.json already holds this address as `sourceUrl`: `path` is the file we already have (no download, no new file)
 *   fetch          download it; `url` is the address to fetch (as the URL parser writes it, without #fragment)
 * Every item also carries `where`, `alt`, `heading` and `index` of findExternal. A same-hash match can be known only after the download (findHosted by sha256 in the pipeline).
 * Returns { items, counts: { total, fetch, reuse, needs_confirm, refused } }.
 */
export function planHosting(post = {}, o = {}) {
  const items = findExternal(post, o.ownHosts || []).map((f) => {
    const base = { ...f, status: '' };
    const chk = checkAddress(f.url, { blockHosts: o.blockHosts });
    if (!chk.ok) return { ...base, status: 'refused', reason: chk.reason, text: chk.text };
    if (needsConfirm(f.url, { agencyHosts: o.agencyHosts, confirmed: o.confirmed })) return { ...base, status: 'needs_confirm', url: f.url };
    const hit = findHosted(o.map || {}, { url: f.url });
    if (hit) return { ...base, status: 'reuse', path: hit.path };
    // Part 7z (v0.101.95): with askAll (the setting "askFirst" of config/images.json) a picture that would be downloaded waits for the writer too; a picture that is already hosted is reused as before.
    if (o.askAll === true && needsConfirm(f.url, { askAll: true, confirmed: o.confirmed })) return { ...base, status: 'needs_confirm', url: f.url, askFirst: true };
    return { ...base, status: 'fetch', fetchUrl: chk.url };
  });
  const counts = { total: items.length, fetch: 0, reuse: 0, needs_confirm: 0, refused: 0 };
  for (const i of items) counts[i.status]++;
  return { items, counts };
}

/** The counts of a list of results (items of a plan, or answers of the pipeline that carry a `status`), and the ones that can be tried again. */
export function summarize(items = []) {
  const counts = { total: 0, fetch: 0, reuse: 0, needs_confirm: 0, refused: 0, hosted: 0, failed: 0 };
  const retry = [];
  for (const i of items || []) {
    counts.total++;
    if (i && counts[i.status] !== undefined) counts[i.status]++;
    if (i && i.status === 'failed') retry.push(i.url);
  }
  return { counts, retry };
}

const CONTINUES = /[A-Za-z0-9_~/?#%=&+@:$-]/; // a character that would make a longer address out of the one we found

/**
 * Replaces addresses in a text. repl: Map or object { "https://other.com/a.jpg": "/media/2026/11/a.webp" }.
 * Only the exact address is replaced: a longer address that starts the same way (a.jpg?w=400) is left alone, text inside code blocks and inline code is left alone,
 * and the forms a writer may have typed are found too: `&amp;` for `&`, and `//host/x` for `https://host/x`.
 * Returns { text, count } (count = places changed).
 */
export function rewriteUrls(text, repl) {
  const src = String(text ?? '');
  const pairs = repl instanceof Map ? [...repl.entries()] : Object.entries(repl || {});
  const masked = maskCode(src);
  const needles = [];
  for (const [from, to] of pairs) {
    if (!from || typeof to !== 'string' || !to) continue;
    needles.push({ n: from, to, rel: false });
    if (from.includes('&')) needles.push({ n: from.replace(/&/g, '&amp;'), to, rel: false });
    if (/^https:\/\//.test(from)) {
      needles.push({ n: from.slice(6), to, rel: true });
      if (from.includes('&')) needles.push({ n: from.slice(6).replace(/&/g, '&amp;'), to, rel: true });
    }
  }
  needles.sort((a, b) => b.n.length - a.n.length);
  const spots = [];
  for (const { n, to, rel } of needles) {
    for (let at = masked.indexOf(n); at !== -1; at = masked.indexOf(n, at + 1)) {
      const end = at + n.length;
      const before = at > 0 ? masked[at - 1] : '';
      const after = end < masked.length ? masked[end] : '';
      if (after && CONTINUES.test(after)) continue;
      if (before && (/[A-Za-z0-9]/.test(before) || (rel && before === ':'))) continue;
      if (spots.some((s) => at < s.end && end > s.start)) continue;
      spots.push({ start: at, end, to });
    }
  }
  spots.sort((a, b) => b.start - a.start);
  let out = src;
  for (const s of spots) out = out.slice(0, s.start) + s.to + out.slice(s.end);
  return { text: out, count: spots.length };
}

/**
 * The post with the hosted addresses written in (PLAN 34.3 step 8). repl: Map or object from the outside address (as findExternal wrote it) to the new /media/... address.
 * Changes post.body (Markdown pictures, <img src>, srcset) and the front matter fields image and ogImage; other fields are copied as they are. The input is not changed.
 * Returns { post, count }.
 */
export function rewritePost(post = {}, repl) {
  const map = repl instanceof Map ? repl : new Map(Object.entries(repl || {}));
  const out = { ...post };
  const body = rewriteUrls(post.body, map);
  out.body = post.body === undefined ? undefined : body.text;
  if (out.body === undefined) delete out.body;
  let count = body.count;
  for (const k of ['image', 'ogImage']) {
    if (typeof post[k] !== 'string') continue;
    const to = map.get(absoluteUrl(post[k]));
    if (typeof to === 'string' && to) { out[k] = to; count++; }
  }
  return { post: out, count };
}
