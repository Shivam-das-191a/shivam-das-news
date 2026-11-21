// Auto image hosting, the setup (PLAN 34.3; Phase 3c Part 3c-8a, v0.101.52).
// It joins what the dashboard knows (admin/config.json, the signed-in GitHub client) to what the flow needs (hostingFlow in hosting-flow.js wants `deps`).
//   hostingSetup({ cfg, gh, postPath, serializePost, existing?, fetch?, optimizeDeps?, quality?, nameOrder?, askHosts?, askFirst?, blockHosts?, allowHosts? })  -> { ok: true, deps } | { ok: false, off, message }
//   hostingEnabled(cfg)                                                                    -> true when admin/config.json names a valid picture service address
// The Worker address lives in admin/config.json as `imagesUrl`, next to `authUrl` (decision 52 of INCOMPLETE.md; the owner may move it). An empty or missing `imagesUrl` means
// the feature is OFF: `off: true`, and the Save of the editor works exactly as before. Other optional keys of admin/config.json: `ownHosts` (more own website names),
// `agencyHosts` and `blockHosts` (lists of website names), `imageCopies` (true switches the smaller copies on).
// Phase 3c Part 4c-4e (v0.101.65): the switch for the smaller picture copies (PLAN 34.5). The optional key `imageCopies` of admin/config.json turns them on, and ONLY the
// value true does ("true" as text, 1, \"on\" and a missing key all mean off). Off is the default: no copy is made and the Save works as before. It needs `imagesUrl` as well,
// because copies belong to pictures that the hosting flow saves. When it is on, `deps.makeVariants` is given and the pipeline puts the copies in the same ONE commit.
// Phase 3c Part 7ab (v0.101.97): the optional `allowHosts` (the websites of config/images.json that are counted as ours) is ADDED to `ownHosts` of deps, except a name related to an agency or blocked website; only valid names count; without it every call is exactly as before.
// Phase 3c Part 7aa (v0.101.96): the optional `blockHosts` (the websites of config/images.json that are never allowed) is ADDED to `blockHosts` of deps (the dashboard list, or an empty list); only valid names count; without it every call is exactly as before.
// Phase 3c Part 7z (v0.101.95): the optional `askFirst` of the given object goes to deps as `askAll: true` only when it is the value true; hosting-plan.js then makes every picture that would be fetched wait for the writer (a picture that is already hosted is reused as before). Without it every call is exactly as before.
// Phase 3c Part 7y (v0.101.94): the optional key `askHosts` (the websites of config/images.json that ask first) is added to `agencyHosts` of deps (the dashboard list, or the starting list of hosted-meta.js); only valid names count; without it every call is exactly as before.
// Phase 3c Part 7x (v0.101.93): the optional key `nameOrder` (the naming order of config/images.json) goes to deps as `nameOrder` only when it is a valid order that differs from the shipped one; hosting-run.js gives it to seoName. Without it every call is exactly as before.
// Phase 3c Part 7j (v0.101.78): the optional key `quality` of the given object (a whole percent from 1 to 100, from config/images.json; see images-setting.js) goes to the picture step and to the copies step when the deps of that step have no `quality` of their own. With no `quality` (or a wrong one) every call is exactly as before.
// Rules: it never fetches, never writes and never throws; a bad address, a missing GitHub client or a missing post path is a plain sentence; no token or address of the
// service is put in a message; `deps` holds only what savePostWithHosting reads (the token stays inside `gh` and inside the fetch function). Nothing calls it yet, so the live
// site and the dashboard do not change.
import { imagesUrl, makeFetchPictures } from './hosting-client.js';
import { makeOptimizer, makeVariantMaker } from './hosting-optimize.js';
import { qualityDeps, customNameOrder, customAskHosts, customBlockHosts, customAllowHosts } from './images-setting.js';
import { DEFAULT_AGENCY_HOSTS } from './hosted-meta.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);
const clean = (s) => String(s ?? '').trim();
const OFF = 'Picture hosting is switched off. Nothing was changed.';

/** The website name of an address ("https://a.example.com/x" gives "a.example.com"), or ''. */
function hostOf(raw) {
  try { return new URL(clean(raw)).hostname.toLowerCase().replace(/\.$/, ''); } catch { return ''; }
}

/** A list of website names from the config: only strings, trimmed, lower case, no empty, no repeat, at most 200. */
function names(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    if (typeof v !== 'string') continue;
    const k = (/^[a-z][a-z0-9+.-]*:/i.test(v.trim()) ? hostOf(v) : v.trim().toLowerCase().replace(/\.$/, ''));
    if (k && !out.includes(k)) out.push(k);
    if (out.length >= 200) break;
  }
  return out;
}

/** The media file path: `<contentRoot>/config/media.json` (contentRoot is "site" in this repository). */
export function mediaPathOf(cfg) {
  const root = isMap(cfg) && typeof cfg.contentRoot === 'string' ? cfg.contentRoot.trim().replace(/^\/+|\/+$/g, '') : 'site';
  return `${root ? root + '/' : ''}config/media.json`;
}

/** True only when admin/config.json has `imageCopies` set to the value true. The value true as text or a number is not enough. */
export function copiesEnabled(cfg) {
  return isMap(cfg) && cfg.imageCopies === true;
}

/** True when admin/config.json has a valid https `imagesUrl`. */
export function hostingEnabled(cfg) {
  if (!isMap(cfg) || clean(cfg.imagesUrl) === '') return false;
  try { imagesUrl(cfg.imagesUrl); return true; } catch { return false; }
}

export function hostingSetup(given) {
  try {
    const o = isMap(given) ? given : {};
    const cfg = isMap(o.cfg) ? o.cfg : {};
    if (clean(cfg.imagesUrl) === '') return { ok: false, off: true, message: OFF };
    try { imagesUrl(cfg.imagesUrl); } catch (e) { return { ok: false, off: false, message: e.message } ; }
    const gh = o.gh;
    if (!gh || typeof gh.commitFiles !== 'function' || typeof gh.getText !== 'function') return { ok: false, off: false, message: 'There is no connection to GitHub.' };
    const postPath = clean(o.postPath);
    if (!postPath || typeof o.serializePost !== 'function') return { ok: false, off: false, message: 'The dashboard is not set up to save pictures.' };

    const own = names([hostOf(cfg.siteUrl), ...(Array.isArray(cfg.ownHosts) ? cfg.ownHosts : [])]);
    const deps = {
      gh,
      postPath,
      mediaPath: mediaPathOf(cfg),
      serializePost: o.serializePost,
      fetchPictures: makeFetchPictures({ endpoint: cfg.imagesUrl, token: gh.token, ...(typeof o.fetch === 'function' ? { fetch: o.fetch } : {}) }),
      optimize: makeOptimizer(qualityDeps(o.optimizeDeps, o.quality)),
      ownHosts: own,
      existing: Array.isArray(o.existing) ? o.existing.filter((p) => typeof p === 'string') : [],
    };
    if (copiesEnabled(cfg)) deps.makeVariants = makeVariantMaker(qualityDeps(o.copyDeps, o.quality)); // Part 4c-4e: off unless the owner switches it on
    const order = customNameOrder(o.nameOrder); // Part 7x (v0.101.93): the naming order of config/images.json, only when it is a valid order that is not the shipped one
    if (order) deps.nameOrder = order;
    if (Array.isArray(cfg.agencyHosts)) deps.agencyHosts = names(cfg.agencyHosts);
    if (Array.isArray(cfg.blockHosts)) deps.blockHosts = names(cfg.blockHosts);
    // Part 7y (v0.101.94): the `askHosts` of config/images.json are ADDED to the agency list (the list of the dashboard setting `agencyHosts`, or the starting list of hosted-meta.js when there is none). They never remove a host, so a picture from a listed website waits for the writer to confirm. No valid `askHosts`: nothing changes.
    const ask = customAskHosts(o.askHosts);
    if (ask) {
      const base = Array.isArray(deps.agencyHosts) ? deps.agencyHosts : DEFAULT_AGENCY_HOSTS;
      deps.agencyHosts = [...base, ...ask.filter((h) => !base.includes(h))];
    }
    // Part 7aa (v0.101.96): the `blockHosts` of config/images.json are ADDED to the block list (the list of the dashboard setting `blockHosts`, or an empty list). They never remove a host, so a picture from a listed website (and its sub names) is refused by the Save. No valid `blockHosts`: nothing changes.
    const block = customBlockHosts(o.blockHosts);
    if (block) {
      const base = Array.isArray(deps.blockHosts) ? deps.blockHosts : [];
      deps.blockHosts = [...base, ...block.filter((h) => !base.includes(h))];
    }
    // Part 7ab (v0.101.97): the `allowHosts` of config/images.json are ADDED to our own websites (the exact name, "www." ignored, like every own website), so a picture from them is not an outside picture. A name that is the same as, a sub name of, or a parent name of a website on the agency list or the block list is ignored: this list can never let an agency or a blocked picture through. No valid `allowHosts`: nothing changes.
    const allow = customAllowHosts(o.allowHosts);
    if (allow) {
      const unsafe = [...(Array.isArray(deps.agencyHosts) ? deps.agencyHosts : DEFAULT_AGENCY_HOSTS), ...(Array.isArray(deps.blockHosts) ? deps.blockHosts : [])];
      const related = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
      const add = allow.filter((h) => !unsafe.some((x) => related(h, x)) && !deps.ownHosts.includes(h));
      if (add.length > 0) deps.ownHosts = [...deps.ownHosts, ...add];
    }
    // Part 7z (v0.101.95): only the real value true (the setting "askFirst" of config/images.json) makes every picture that is not hosted yet wait for the writer. Any other value changes nothing.
    if (o.askFirst === true) deps.askAll = true;
    return { ok: true, deps };
  } catch {
    return { ok: false, off: false, message: 'The dashboard is not set up to save pictures.' };
  }
}
