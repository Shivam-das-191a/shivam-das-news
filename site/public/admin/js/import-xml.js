// v0.10.0: Blogger and WordPress XML import, step 1 = read the file and preview (PLAN 11, LOGICS 15, BUGS I1 to I4).
// v0.11.0: the preview also converts each text to Markdown and finds its images (step 2).
// v0.12.0: page permalinks are also unique against pages already on the site; saving lives in import-save.js.
// Nothing is written to the repository here. Pure functions; DOMParser comes from the browser.
import { slugify, uniqueSlug } from './slug.js';
import { postUrl, dateParts } from './url.js';
import { normalizePath } from './redirects.js';
import { htmlToMarkdown } from './html-to-md.js';

const kids = (el, local, prefix) => Array.from(el.children).filter((c) => c.localName === local && (prefix === undefined || c.prefix === prefix));
const first = (el, local, prefix) => kids(el, local, prefix)[0];
const text = (el, local, prefix) => (first(el, local, prefix)?.textContent ?? '').trim();
const count = (o, k) => { o[k] = (o[k] || 0) + 1; };

/** WordPress "2020-05-01 10:00:00" (GMT) to ISO. Zero dates (drafts) give ''. */
function wpDate(s) {
  if (!s || s.startsWith('0000')) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
function isoDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
const lastSegment = (url) => {
  const p = normalizePath(url);
  return p ? p.replace(/\/$/, '').split('/').pop().replace(/\.html?$/i, '') : '';
};

function parseBlogger(doc) {
  const items = [];
  const skipped = {};
  for (const e of kids(doc.documentElement, 'entry')) {
    const kindTerm = kids(e, 'category').find((c) => (c.getAttribute('scheme') || '').endsWith('#kind'))?.getAttribute('term') || '';
    const type = (kindTerm.split('#').pop() || '').toLowerCase();
    if (type !== 'post' && type !== 'page') { count(skipped, type || 'other'); continue; }
    const labels = kids(e, 'category').filter((c) => (c.getAttribute('scheme') || '').endsWith('/atom/ns#')).map((c) => (c.getAttribute('term') || '').trim()).filter(Boolean);
    const draft = Array.from(e.getElementsByTagNameNS('*', 'draft')).some((d) => d.textContent.trim().toLowerCase() === 'yes');
    const link = kids(e, 'link').find((l) => l.getAttribute('rel') === 'alternate');
    const oldUrl = link ? link.getAttribute('href') || '' : '';
    items.push({
      kind: type, title: text(e, 'title'), html: text(e, 'content'), date: isoDate(text(e, 'published')), status: draft ? 'draft' : 'published',
      // BUGS I3: the first label is the category, the others are tags.
      categories: labels.slice(0, 1), tags: labels.slice(1), author: text(first(e, 'author') || e, 'name'), oldUrl, name: lastSegment(oldUrl),
    });
  }
  return { format: 'blogger', items, skipped };
}

function parseWordPress(doc) {
  const channel = first(doc.documentElement, 'channel');
  const items = [];
  const skipped = {};
  for (const e of channel ? kids(channel, 'item') : []) {
    const type = text(e, 'post_type', 'wp');
    const st = text(e, 'status', 'wp');
    if (type !== 'post' && type !== 'page') { count(skipped, type || 'other'); continue; }
    if (!['publish', 'future', 'draft', 'pending', 'auto-draft'].includes(st)) { count(skipped, `${type} (${st || 'no status'})`); continue; }
    const cats = kids(e, 'category');
    const named = (domain) => cats.filter((c) => c.getAttribute('domain') === domain && c.getAttribute('nicename') !== 'uncategorized').map((c) => c.textContent.trim()).filter(Boolean);
    items.push({
      kind: type, title: text(e, 'title'), html: text(e, 'encoded', 'content'),
      date: wpDate(text(e, 'post_date_gmt', 'wp')) || wpDate(text(e, 'post_date', 'wp')),
      status: st === 'publish' || st === 'future' ? 'published' : 'draft',
      categories: named('category'), tags: named('post_tag'), author: text(e, 'creator', 'dc'),
      oldUrl: text(e, 'link'), name: text(e, 'post_name', 'wp'),
    });
  }
  return { format: 'wordpress', items, skipped };
}

/** Reads a Blogger Atom backup or a WordPress WXR export. Throws a plain message for anything else. */
export function parseXml(source) {
  const doc = new DOMParser().parseFromString(String(source).replace(/^\uFEFF/, ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not valid XML. Export it again from Blogger or WordPress and try once more.');
  const root = doc.documentElement;
  if (root.localName === 'feed') return parseBlogger(doc);
  if (root.localName === 'rss' && first(root, 'channel')) return parseWordPress(doc);
  throw new Error('This XML is not a Blogger backup or a WordPress export.');
}

const plain = (html) => (new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
/** First 160 characters at a word boundary, for the meta description. */
const excerpt = (t) => {
  if (t.length <= 160) return t;
  const cut = t.slice(0, 160);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 100)).replace(/[\s,;:-]+$/, '');
};
const nameKey = (title, iso) => `${title.trim().toLowerCase()}|${(iso || '').slice(0, 10)}`;

/** Turns parsed items into a preview: what would be created, what is skipped (duplicates), the redirects it would add.
 *  ctx = { tz, existing: [{ title, date, permalink, redirects }], existingPages: [permalink] } */
export function planImport(items, ctx) {
  const tz = ctx.tz || 'UTC';
  const existing = ctx.existing || [];
  const takenPosts = new Set(existing.map((p) => p.permalink).filter(Boolean));
  const takenPages = new Set(ctx.existingPages || []);
  const oldUrls = new Set(existing.flatMap((p) => (Array.isArray(p.redirects) ? p.redirects : [])).map((u) => normalizePath(u)).filter(Boolean));
  const titleDates = new Set(existing.map((p) => nameKey(String(p.title || ''), String(p.date || ''))));
  const rows = [];
  const redirects = [];
  const counts = { posts: 0, pages: 0, drafts: 0, duplicates: 0, noTitle: 0, redirects: 0, images: 0 };

  items.forEach((it, i) => {
    const row = { index: i, kind: it.kind, title: it.title, status: it.status, date: it.date, category: '', tags: [], permalink: '', newUrl: '', oldUrl: normalizePath(it.oldUrl) || '', words: 0, markdown: '', images: [], description: '', image: '', imageAlt: '', issues: [], skip: '' };
    rows.push(row);
    if (!it.title.trim()) { row.skip = 'No title'; counts.noTitle++; return; }
    // The site needs a title of 5 characters for a post and 2 for a page (content schema).
    if (it.title.trim().length < (it.kind === 'page' ? 2 : 5)) { row.skip = 'Title is too short for this site'; return; }
    const key = nameKey(it.title, it.date);
    // BUGS I4: match by the old address, then by title and day. A second copy inside the same file counts too.
    if ((row.oldUrl && oldUrls.has(row.oldUrl)) || titleDates.has(key)) { row.skip = 'Already on the site'; counts.duplicates++; return; }
    if (row.oldUrl) oldUrls.add(row.oldUrl);
    titleDates.add(key);

    const conv = htmlToMarkdown(it.html);
    row.markdown = conv.markdown;
    row.images = conv.images;
    row.words = (plain(it.html).match(/\S+/g) || []).length;
    row.description = excerpt(plain(it.html));
    row.issues.push(...conv.warnings);
    counts.images += conv.images.length;
    const seen = new Set();
    const tagNames = [...it.categories.slice(1), ...it.tags].filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    row.tags = tagNames;
    const catName = it.kind === 'post' ? it.categories[0] || '' : '';
    row.category = catName ? slugify(catName) : '';
    if (it.kind === 'post' && catName && !row.category) { row.issues.push(`The label "${catName}" has no Latin letters, so it cannot be a category address. Pick a category after import.`); }
    if (it.kind === 'post' && !row.category) row.issues.push('No usable category. It will be imported as a draft until you pick one.');

    let base = slugify(it.name || '') || slugify(it.title);
    if (!base) { base = it.kind === 'page' ? 'imported-page' : 'imported-post'; row.issues.push('The title has no Latin letters, so the permalink is generic. Edit it after import.'); }
    const taken = it.kind === 'page' ? takenPages : takenPosts;
    row.permalink = uniqueSlug(base, taken); // BUGS U2: unique site-wide
    taken.add(row.permalink);

    let status = it.status;
    if (status === 'published' && it.kind === 'post' && !row.category) status = 'draft';
    if (status === 'published' && !it.date) { status = 'draft'; row.issues.push('No publish date, so it will be a draft.'); }
    // The site only publishes a post with a featured image, its alt text and a description of 50 to 160 characters.
    if (it.kind === 'post') {
      const img = conv.images[0];
      if (img) { row.image = img.src; row.imageAlt = img.alt || it.title.trim(); if (!img.alt) row.issues.push('The first image has no alt text, so the title is used. Improve it after import.'); }
      if (status === 'published' && !img) { status = 'draft'; row.issues.push('No image in the text. A published post needs a featured image, so it will be a draft until you add one.'); }
      if (status === 'published' && row.description.length < 50) { status = 'draft'; row.issues.push('The text is too short for a meta description (50 characters), so it will be a draft.'); }
    }
    row.status = status;
    if (status === 'published' && it.date) {
      const d = new Date(it.date);
      if (it.kind === 'post') row.newUrl = postUrl(row.category, row.permalink, d, tz);
      else { const p = dateParts(d, tz); row.newUrl = `/${p.y}/${p.m}/${p.d}/pages/${row.permalink}/`; }
      if (row.oldUrl && row.oldUrl !== row.newUrl) redirects.push({ from: row.oldUrl, to: row.newUrl });
    }
    if (it.kind === 'page') counts.pages++; else counts.posts++;
    if (status === 'draft') counts.drafts++;
  });
  counts.redirects = redirects.length;
  return { rows, redirects, counts };
}
