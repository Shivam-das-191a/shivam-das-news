// v0.16.0: rename a category slug with redirects for every post (PLAN 9 and 17, BUGS U5, H4).
// The category is part of every post address, so a rename moves each post file, keeps its old address in `redirects`
// and redirects the old category page. Pure functions: they only build the list of files. app.js saves them in ONE commit,
// because a half-finished rename would leave posts split over two categories.
import { stringify } from './frontmatter.js';
import { joinPath } from './github.js';
import { postUrl } from './url.js';
import { SLUG_RE } from './slug.js';
import { MAX_REDIRECTS } from './import-save.js';

/** One commit holds the whole rename. More posts than this is refused with a plain message. */
export const MAX_RENAME_POSTS = 1000;
const categoryPage = (slug) => `/category/${slug}/`;

/**
 * posts: [{ path, data, body }] every post of the site.
 * o = { root, tz, cats: {slug: {name, description}}, manualRedirects: [{from,to}], existingRedirects: number, takenPaths: [] }
 * Returns { files: [{path,text}|{path,delete:true}], counts: { posts, redirects, live } }. Throws an Error with a plain message.
 */
export function planRename(posts, oldSlug, newSlug, o = {}) {
  const root = o.root || '';
  const from = String(oldSlug || '').trim();
  const to = String(newSlug || '').trim();
  if (!SLUG_RE.test(to)) throw new Error('The new name may only hold lowercase letters, numbers and hyphens, for example world-news.');
  if (to === from) throw new Error('The new name is the same as the old one.');
  const cats = o.cats || {};
  if (posts.some((p) => p.data.category === to) || Object.prototype.hasOwnProperty.call(cats, to)) throw new Error(`"${to}" already exists. Merging two categories is not supported here; pick a new name.`);
  const moving = posts.filter((p) => p.data.category === from);
  if (!moving.length) throw new Error(`No post uses "${from}".`);
  if (moving.length > MAX_RENAME_POSTS) throw new Error(`${moving.length} posts in one category is more than one safe save can hold (${MAX_RENAME_POSTS}).`);
  const taken = new Set([...(o.takenPaths || []), ...posts.map((p) => p.path)]);

  const files = [];
  let redirects = 0;
  let live = 0;
  for (const p of moving) {
    const newPath = joinPath(root, 'content/blogs', to, `${p.data.permalink}.md`);
    if (!p.data.permalink) throw new Error(`"${p.data.title || p.path}" has no permalink, so it cannot be moved.`);
    if (taken.has(newPath)) throw new Error(`${newPath} already exists, so "${p.data.title || p.data.permalink}" cannot be moved.`);
    const list = Array.isArray(p.data.redirects) ? [...p.data.redirects] : [];
    // A post that was ever public keeps its old address. A draft never had one.
    if ((p.data.status === 'published' || p.data.status === 'archived') && p.data.date && !Number.isNaN(new Date(p.data.date).getTime())) {
      const old = postUrl(from, p.data.permalink, new Date(p.data.date), o.tz || 'UTC');
      if (!list.includes(old)) { list.push(old); redirects++; }
      if (p.data.status === 'published') live++;
    }
    const next = { ...p.data, category: to, redirects: list.filter((u) => u !== postUrl(to, p.data.permalink, new Date(p.data.date || 0), o.tz || 'UTC')) };
    files.push({ path: newPath, text: stringify(next, p.body) });
    files.push({ path: p.path, delete: true });
  }

  // The old category page redirects to the new one (BUGS H4). The new page must not stay a redirect source (loop guard).
  const manual = (o.manualRedirects || []).filter((r) => r.from !== categoryPage(to));
  const hadNew = manual.length !== (o.manualRedirects || []).length;
  let manualChanged = hadNew;
  if (live > 0 && !manual.some((r) => r.from === categoryPage(from))) { manual.push({ from: categoryPage(from), to: categoryPage(to) }); manualChanged = true; redirects++; }
  if ((o.existingRedirects || 0) + redirects > MAX_REDIRECTS) throw new Error(`This rename needs ${redirects} more redirects, and Cloudflare Pages allows ${MAX_REDIRECTS} in total (${o.existingRedirects || 0} used). Nothing was changed.`);
  if (manualChanged) files.push({ path: joinPath(root, 'config/redirects.json'), text: JSON.stringify(manual, null, 2) + '\n' });

  if (Object.prototype.hasOwnProperty.call(cats, from)) {
    const moved = {};
    for (const [k, v] of Object.entries(cats)) moved[k === from ? to : k] = v;
    files.push({ path: joinPath(root, 'config/categories.json'), text: JSON.stringify(moved, null, 2) + '\n' });
  }
  return { files, counts: { posts: moving.length, redirects, live } };
}
