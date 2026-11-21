// Auto image hosting, the Save adapter (PLAN 34.3; Phase 3c Part 3c-8b, v0.101.53).
// It is everything the Save of the editor needs to know before it can call hostingFlow, as pure functions, so the hook in app.js (Part 3c-8c) stays short.
//   startHostingSave({ cfg, gh, next, body, orig, newPath, tree?, canEdit?, onResult?, dryRun?, fetch?, optimizeDeps?, quality?, nameOrder?, askHosts?, askFirst?, blockHosts?, allowHosts? })
//       -> { use: false, reason, message } | { use: true, flow, deps }
//        reason: 'off' (no imagesUrl: Save works as before), 'setup' (the setup failed: message says why), 'archived', 'no_pictures', 'moved'
//        use true: `flow.el` is the list to show, `flow.start()` runs the Save; the hook calls `onResult` with the answer of savePostWithHosting.
//   hostingPostOf(next, body)    the post as the pipeline reads it: { title, focusKeyword, handle (the permalink), date, body, image, imageAlt, ogImage }
//   makePostSerializer(next)     (post) => the text of the post file: the editor's own fields, with only body, image, imageAlt and ogImage taken from the pipeline
//   existingFromTree(tree, pub)  the /media/... addresses that are already in the repository (tree: GitHub blobs; pub: the public folder, default "site/public")
// Phase 3c Part 7ab (v0.101.97): the optional `allowHosts` (the websites of config/images.json that are counted as ours) is given to hostingSetup too; this file reads no file.
// Phase 3c Part 7aa (v0.101.96): the optional `blockHosts` (the websites of config/images.json that are never allowed) is given to hostingSetup too; this file reads no file.
// Phase 3c Part 7z (v0.101.95): the optional `askFirst` (true: every picture that is not hosted yet waits for the writer) is given to hostingSetup too; this file reads no file.
// Phase 3c Part 7y (v0.101.94): the optional `askHosts` (the websites of config/images.json that ask first) is given to hostingSetup too; this file reads no file.
// Phase 3c Part 7x (v0.101.93): the optional `nameOrder` (the naming order of config/images.json) is given to hostingSetup in the same way; this file reads no file.
// Phase 3c Part 7k (v0.101.78): the optional `quality` (a whole percent from 1 to 100) is given to hostingSetup, which passes it to the picture steps. It does not read any file itself; runHostingSave (hosting-hook.js) reads config/images.json.
// Rules: it never throws; the editor's `next` and `orig` are never changed; a post that moves to a new address (new path) is NOT hosted in this Save (the old file must be removed by
// the normal Save, and a commit of the pipeline would collide with it); an archived post is not hosted; a post with no outside picture does not call the Worker; no token or address
// of the service is put in a message. It writes nothing by itself and nothing calls it yet, so the live site and the dashboard do not change.
import { stringify } from './frontmatter.js';
import { findExternal } from './hotlink.js';
import { hostingSetup } from './hosting-setup.js';
import { hostingFlow } from './hosting-flow.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);
const str = (v) => (typeof v === 'string' ? v : '');

/** The post as hostPost reads it. Only these fields; the editor's object is not changed. */
export function hostingPostOf(next, body) {
  const n = isMap(next) ? next : {};
  return {
    title: str(n.title),
    focusKeyword: str(n.focusKeyword),
    handle: str(n.permalink),
    date: str(n.date),
    body: str(body),
    image: str(n.image),
    imageAlt: str(n.imageAlt),
    ogImage: str(n.ogImage),
  };
}

/** The serializer for the commit. Keys the pipeline did not return as text keep the editor's value, so a field is never blanked by mistake. */
export function makePostSerializer(next) {
  const base = isMap(next) ? { ...next } : {};
  return (p) => {
    const out = { ...base };
    const q = isMap(p) ? p : {};
    for (const k of ['image', 'imageAlt', 'ogImage']) if (typeof q[k] === 'string') out[k] = q[k];
    return stringify(out, typeof q.body === 'string' ? q.body : '');
  };
}

/** Every `/media/...` address that the repository already holds (GitHub tree blobs under `<pub>/media/`). */
export function existingFromTree(tree, pub = 'site/public') {
  const root = `${String(pub).replace(/^\/+|\/+$/g, '')}/media/`;
  if (!Array.isArray(tree)) return [];
  const out = [];
  for (const t of tree) {
    const p = t && typeof t.path === 'string' ? t.path : '';
    if (p.startsWith(root) && p.length > root.length) out.push('/media/' + p.slice(root.length));
  }
  return out;
}

const no = (reason, message = '') => ({ use: false, reason, message });

export function startHostingSave(given) {
  try {
    const o = isMap(given) ? given : {};
    const next = isMap(o.next) ? o.next : {};
    const pub = isMap(o.cfg) && typeof o.cfg.contentRoot === 'string' && o.cfg.contentRoot.trim() ? `${o.cfg.contentRoot.trim().replace(/^\/+|\/+$/g, '')}/public` : 'site/public';
    const setup = hostingSetup({
      cfg: o.cfg, gh: o.gh, postPath: o.newPath, serializePost: makePostSerializer(next),
      existing: existingFromTree(o.tree, pub), fetch: o.fetch, optimizeDeps: o.optimizeDeps, quality: o.quality, nameOrder: o.nameOrder, askHosts: o.askHosts, askFirst: o.askFirst, blockHosts: o.blockHosts, allowHosts: o.allowHosts,
    });
    if (!setup.ok) return setup.off ? no('off') : no('setup', setup.message);
    if (next.status === 'archived') return no('archived');
    const post = hostingPostOf(next, o.body);
    if (findExternal(post, setup.deps.ownHosts).length === 0) return no('no_pictures');
    if (isMap(o.orig) && typeof o.orig.path === 'string' && o.orig.path !== o.newPath) {
      return no('moved', 'The pictures are not saved here while the post moves to a new address. Save again after the move.');
    }
    const flow = hostingFlow({ post, deps: setup.deps, dryRun: o.dryRun === true, onResult: o.onResult, canEdit: o.canEdit });
    return { use: true, flow, deps: setup.deps };
  } catch {
    return no('setup', 'The dashboard is not set up to save pictures.');
  }
}
