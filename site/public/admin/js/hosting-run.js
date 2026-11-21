// Auto image hosting, the run (PLAN 34.3 steps 3 to 8, LOGICS 22; Phase 3c Part 3b, v0.101.44).
// hostPost(post, deps) takes one post and returns everything the Save needs: the post with the new addresses, the new files, the new config/media.json and one
// line for each picture (hosted, reuse, failed, needs_confirm, refused). It does NOT write anything: the caller commits the files, the post and config/media.json
// in ONE commit (all or nothing), and shows the result list with a Retry for the failed ones. Everything that touches the world is passed in, so tests use fakes:
//   deps.fetchPictures(urls)  the images Worker: -> { ok: true, results: [{ url, ok, kind, data (base64), size, reason, text, status }] } or { ok: false, reason, text }
//   deps.optimize(bytes, kind) the browser step (image.js): -> { bytes, ext: 'webp' | 'gif', width, height }
//   deps.sha256(bytes) (default sha256Hex), deps.now (a Date), deps.existing (every /media/... address that is already in the repository)
// Rules: the plan comes first (planHosting); a picture that fails stays as it was in the post; a name already taken gets -2, -3; a picture met again is reused
// (same outside address, or the same hash of the DOWNLOADED file, also inside this run); nothing is sent to an AI service.
import { planHosting, rewritePost, summarize } from './hosting-plan.js';
import { findHosted, seoName, hostedPath, datePart } from './hotlink.js';
import { autoAlt, recordHosted } from './hosted-meta.js';

/** The Worker answers at most this many addresses in one call (it must equal MAX_PER_CALL of workers/images/lib.js; a test keeps them equal). */
export const WORKER_BATCH = 30;
/** PLAN 34.3 step 5: a GIF over this size is not hosted (it would make the page slow). */
export const GIF_MAX_BYTES = 5 * 1024 * 1024;

/** A plain sentence for every reason word, for the result list. Unknown words get a general sentence. */
const REASONS = {
  bad_url: 'The address cannot be read.',
  not_https: 'Only https addresses are fetched.',
  bad_port: 'Only the normal https port is allowed.',
  credentials: 'An address with a user name or password is refused.',
  private_host: 'That address is not on the public internet.',
  blocked_host: 'You blocked this website.',
  too_many_redirects: 'The address sends the browser around too many times.',
  dns_failed: 'The website name could not be found.',
  not_found: 'The picture is gone from the other website.',
  http_error: 'The other website refused the request.',
  too_big: 'The picture is larger than 10 MB.',
  timeout: 'The other website was too slow.',
  network: 'The other website could not be reached.',
  not_image: 'The file is not a JPEG, PNG, WebP, AVIF or GIF picture.',
  svg_refused: 'SVG pictures are not hosted.',
  call_too_big: 'Too many large pictures at once. Press Retry.',
  worker_failed: 'The picture service did not answer. Press Retry.',
  sign_in: 'Sign in to the dashboard again, then press Retry.',
  not_allowed: 'This account may not use the picture service.',
  rate_limited: 'Too many pictures in one minute. Wait a moment, then press Retry.',
  worker_off: 'The picture service is switched off or not ready. Try again later.',
  optimize_failed: 'The picture could not be converted.',
  unsupported_format: 'This browser cannot make a WebP picture.',
  gif_too_big: 'The GIF is larger than 5 MB.',
  bad_data: 'The picture arrived damaged. Press Retry.',
  missing: 'The picture service sent no answer for this picture. Press Retry.',
  needs_confirm: 'This picture is from a picture agency. Confirm before it is hosted.',
};
export const REASON_WORDS = Object.keys(REASONS);
/** Part 7z (v0.101.95): the sentence for a picture that waits only because picture hosting is set to ask first (it is not from an agency). */
export const ASK_FIRST_TEXT = 'Picture hosting is set to ask first. Confirm before this picture is hosted.';
export const explain = (reason) => REASONS[reason] || 'The picture could not be hosted.';

/** The SHA-256 of some bytes as 64 lower case hexadecimal characters (Web Crypto, in the browser and in Node). */
export async function sha256Hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64 text to bytes. Throws on text that is not base64. */
export function fromBase64(text) {
  const s = atob(String(text ?? ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const failed = (item, reason, text) => ({ ...item, status: 'failed', reason, text: text || explain(reason) });

/** Asks the Worker for the addresses in groups of WORKER_BATCH. Returns a Map: address -> result (a failed one for a group that got no answer). */
async function download(urls, deps) {
  const out = new Map();
  for (let i = 0; i < urls.length; i += WORKER_BATCH) {
    const group = urls.slice(i, i + WORKER_BATCH);
    let ans;
    try { ans = await deps.fetchPictures(group); } catch { ans = null; }
    if (!ans || ans.ok === false || !Array.isArray(ans.results)) {
      const reason = ans && ans.reason ? ans.reason : 'worker_failed'; // an unknown word is turned into worker_failed below
      for (const u of group) out.set(u, { url: u, ok: false, reason });
      continue;
    }
    for (const r of ans.results) if (r && typeof r.url === 'string') out.set(r.url, r);
  }
  return out;
}

/**
 * Hosts the outside pictures of one post.
 * post: { body, image, imageAlt, ogImage, title, focusKeyword, handle, date }.
 * deps: { fetchPictures, optimize, sha256?, now?, ownHosts, map, agencyHosts, confirmed, blockHosts, existing, askAll? }.
 * Throws a plain message (before any download) when there is something to host and the post has no valid date.
 * Returns { post, map, files: [{ src, path, bytes }], items, summary, changed }:
 *   post     the post with the hosted and reused addresses written in; a picture that failed, needs confirmation or was refused is unchanged
 *   map      the new config/media.json object (a new object; the input is not changed)
 *   files    the new files to write, `path` is the repository path (site/public/media/YYYY/MM/name.webp)
 *   items    one line for each picture: { url, status: 'hosted' | 'reuse' | 'failed' | 'needs_confirm' | 'refused', src?, reason?, text?, by? }
 *   summary  { counts, retry } of `summarize` (retry = the addresses that failed)
 *   changed  true when the post or the map is different
 */
export async function hostPost(post = {}, deps = {}) {
  const sha = deps.sha256 || sha256Hex;
  const plan = planHosting(post, { ownHosts: deps.ownHosts, map: deps.map, agencyHosts: deps.agencyHosts, confirmed: deps.confirmed, blockHosts: deps.blockHosts, askAll: deps.askAll });
  if (plan.counts.fetch > 0) datePart(post.date); // throws the plain message before any download
  const fetchUrls = [...new Set(plan.items.filter((i) => i.status === 'fetch').map((i) => i.fetchUrl))];
  const got = fetchUrls.length ? await download(fetchUrls, deps) : new Map();

  let map = { ...(deps.map && typeof deps.map === 'object' ? deps.map : {}) };
  const taken = [...(deps.existing || []), ...Object.keys(map)];
  const files = [];
  const repl = new Map();
  const items = [];
  const now = deps.now || new Date();

  for (const [n, item] of plan.items.entries()) {
    if (item.status === 'needs_confirm') { items.push({ ...item, reason: 'needs_confirm', text: item.askFirst === true ? ASK_FIRST_TEXT : explain('needs_confirm') }); continue; }
    if (item.status === 'refused') { items.push(item); continue; }
    if (item.status === 'reuse') { repl.set(item.url, item.path); items.push({ ...item, src: item.path, by: 'url' }); continue; }

    // fetch: the same address may already be hosted earlier in this run (two places of one picture)
    const again = findHosted(map, { url: item.fetchUrl });
    if (again) { repl.set(item.url, again.path); items.push({ ...item, status: 'reuse', path: again.path, src: again.path, by: 'url' }); continue; }
    const r = got.get(item.fetchUrl);
    if (!r) { items.push(failed(item, 'missing')); continue; }
    if (!r.ok) { items.push(failed(item, REASONS[r.reason] ? r.reason : 'worker_failed')); continue; }
    let original;
    try { original = fromBase64(r.data); } catch { items.push(failed(item, 'bad_data')); continue; }
    if (original.length === 0 || (Number.isFinite(r.size) && r.size !== original.length)) { items.push(failed(item, 'bad_data')); continue; }
    const hash = await sha(original);
    const same = findHosted(map, { sha256: hash });
    if (same) { repl.set(item.url, same.path); items.push({ ...item, status: 'reuse', path: same.path, src: same.path, by: 'sha256' }); continue; }
    let out;
    try { out = await deps.optimize(original, r.kind); } catch { items.push(failed(item, 'optimize_failed')); continue; }
    if (!out || !out.bytes || !out.bytes.length) { items.push(failed(item, 'optimize_failed')); continue; }
    if (out.ext !== 'webp' && out.ext !== 'gif') { items.push(failed(item, 'unsupported_format')); continue; }
    if (out.ext === 'gif' && out.bytes.length > GIF_MAX_BYTES) { items.push(failed(item, 'gif_too_big')); continue; }

    const alt = autoAlt({ alt: item.alt, heading: item.heading }, post);
    const name = seoName({ url: item.fetchUrl, alt: item.alt, heading: item.heading, sourceHost: hostOfUrl(item.fetchUrl) }, post, n + 1, deps.nameOrder).name; // Part 7x: deps.nameOrder is the naming order of config/images.json, or undefined for the shipped order
    const where = hostedPath(post, name, out.ext, taken);
    taken.push(where.src);
    map = recordHosted(map, where.src, { sourceUrl: item.fetchUrl, sha256: hash, width: out.width, height: out.height, bytes: out.bytes.length, hostedAt: now, alt: alt.alt, auto: alt.auto });
    files.push({ src: where.src, path: where.path, bytes: out.bytes });
    repl.set(item.url, where.src);
    items.push({ ...item, status: 'hosted', src: where.src, path: where.path, autoAlt: alt.auto });
  }

  const rewritten = rewritePost(post, repl);
  const changed = rewritten.count > 0 || files.length > 0;
  return { post: rewritten.post, map, files, items, summary: summarize(items.map((i) => ({ url: i.url, status: i.status }))), changed };
}

function hostOfUrl(u) { try { return new URL(u).hostname; } catch { return ''; } }
