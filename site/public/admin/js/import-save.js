// v0.12.0: Blogger and WordPress XML import, step 3 = turn the preview into files (PLAN 11, BUGS I3, I4, U2).
// Pure functions. They only build the list of files; app.js commits them in one go.
// Images are NOT downloaded here (next step). Published posts keep the old image address for now.
import { stringify } from './frontmatter.js';
import { joinPath } from './github.js';
import { SLUG_RE } from './slug.js';

/** Cloudflare Pages allows 2000 static redirects (the build stops above that). */
export const MAX_REDIRECTS = 2000;
/** Files per commit. One commit means one deploy, so a big import is split only when it must be. */
export const BATCH = 200;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * plan: result of planImport. o = { root, author, now, fallbackCategory, takenPaths: Set|[], manualRedirects: [{from,to}], existingRedirects: number }
 * Returns { files: [{path, text}], saved, skipped: [{title, reason}] }.
 *  - posts go to content/blogs/<category>/<permalink>.md, pages to content/pages/<permalink>.md
 *  - a post without a usable category uses o.fallbackCategory, and is skipped when there is none
 *  - a published post keeps its old address in `redirects`; a published page gets a line in config/redirects.json
 *  - a draft post keeps its old address too, so the redirect appears when the draft is published later
 *  - redirects beyond the Cloudflare limit are not written, and are counted
 */
export function buildImportFiles(plan, o = {}) {
  const root = o.root || '';
  const now = o.now || new Date().toISOString();
  const taken = new Set(o.takenPaths || []);
  const manual = [...(o.manualRedirects || [])];
  const manualFrom = new Set(manual.map((r) => r.from));
  let budget = Math.max(0, MAX_REDIRECTS - (o.existingRedirects || 0));
  const fallback = SLUG_RE.test(o.fallbackCategory || '') ? o.fallbackCategory : '';
  const files = [];
  const skipped = [];
  const saved = { posts: 0, pages: 0, drafts: 0, redirects: 0, noRedirect: 0 };
  let manualChanged = false;

  for (const r of plan.rows) {
    if (r.skip) continue;
    const isPage = r.kind === 'page';
    const status = r.status === 'published' ? 'published' : 'draft';
    const live = status === 'published';
    const category = isPage ? '' : r.category || fallback;
    if (!isPage && !category) { skipped.push({ title: r.title, reason: 'No category. Type a category above, then save again.' }); continue; }
    const path = isPage ? joinPath(root, 'content/pages', r.permalink + '.md') : joinPath(root, 'content/blogs', category, r.permalink + '.md');
    if (taken.has(path)) { skipped.push({ title: r.title, reason: `A ${isPage ? 'page' : 'post'} file with this address already exists` }); continue; }
    taken.add(path);

    // Old address. A live item uses the redirect budget; a draft post only remembers it for later.
    let redirects = [];
    let manualEntry = null;
    if (live && r.oldUrl && r.newUrl && r.oldUrl !== r.newUrl) {
      if (budget > 0 && !(isPage && manualFrom.has(r.oldUrl))) {
        budget--; saved.redirects++;
        if (isPage) manualEntry = { from: r.oldUrl, to: r.newUrl }; else redirects = [r.oldUrl];
      } else saved.noRedirect++;
    } else if (!live && !isPage && r.oldUrl) redirects = [r.oldUrl];

    if (isPage) {
      files.push({ path, text: stringify({ title: clean(r.title), permalink: r.permalink, date: r.date || now, description: r.description, status }, r.markdown) });
      saved.pages++;
      if (manualEntry) { manual.push(manualEntry); manualFrom.add(manualEntry.from); manualChanged = true; }
    } else {
      files.push({ path, text: stringify({
        title: clean(r.title), permalink: r.permalink, category, tags: r.tags || [], date: r.date || now, author: o.author || 'shivam-das',
        description: r.description, image: r.image, imageAlt: r.imageAlt, redirects, status,
      }, r.markdown) });
      saved.posts++;
    }
    if (!live) saved.drafts++;
  }

  if (manualChanged) files.push({ path: joinPath(root, 'config/redirects.json'), text: JSON.stringify(manual, null, 2) + '\n' });
  return { files, saved, skipped };
}

/** Splits the file list into commits of at most `size` files. */
export function batches(files, size = BATCH) {
  const out = [];
  for (let i = 0; i < files.length; i += size) out.push(files.slice(i, i + size));
  return out;
}
