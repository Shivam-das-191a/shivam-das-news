// v0.14.0: full backup as one Blogger-style Atom .xml file (PLAN 11 "Export", CODING_PLAN Phase 4).
// Same format the Import screen reads, so a backup can be imported again (a round trip).
// Pure functions: no network, no DOM. app.js loads the files and hands the data in.
import { dateParts } from './url.js';
import { renderMarkdown } from './md.js';

const KIND = 'http://schemas.google.com/g/2005#kind';
const KIND_TERM = 'http://schemas.google.com/blogger/2008/kind#';
const LABEL = 'http://www.blogger.com/atom/ns#';

// XML 1.0 cannot hold most control characters, so they are removed before escaping.
// eslint-disable-next-line no-control-regex
const BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const esc = (s) => String(s ?? '').replace(BAD, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const iso = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

const trimBase = (b) => String(b || '').replace(/\/+$/, '');

/** Address of a post or a page on the live site, built with the same rules as the site itself. */
export function addressOf(kind, data, tz) {
  const d = new Date(data.date);
  if (!data.permalink || !data.date || Number.isNaN(d.getTime())) return '';
  const { y, m, d: day } = dateParts(d, tz || 'UTC');
  return kind === 'page' ? `/${y}/${m}/${day}/pages/${data.permalink}/` : data.category ? `/${y}/${m}/${day}/blogs/${data.category}/${data.permalink}/` : '';
}

/** One Markdown body (plus the featured image) as the HTML a Blogger backup would hold. Image addresses become absolute. */
export function bodyHtml(data, body, base) {
  const abs = (u) => (/^\//.test(u) && base ? base + u : u);
  const lead = data.image
    ? `<p><img src="${esc(abs(data.image))}" alt="${esc(data.imageAlt || data.title || '')}"/>${data.imageCredit ? `<br/><em>${esc(data.imageCredit)}</em>` : ''}</p>\n`
    : '';
  return lead + renderMarkdown(body || '', abs);
}

function entry(kind, item, o) {
  const data = item.data;
  const url = addressOf(kind, data, o.tz);
  const full = url && o.base ? o.base + url : url;
  // Only live posts stay published. Drafts and archived posts are written as drafts, so a re-import never makes them public.
  const live = data.status === 'published';
  const labels = kind === 'post' ? [data.category, ...(Array.isArray(data.tags) ? data.tags : [])].filter(Boolean) : [];
  const published = iso(data.date);
  const updated = iso(data.updated) || published || o.now;
  const author = o.authors[data.author] || data.author || '';
  return [
    '<entry>',
    `<id>${esc(`tag:${o.host},export:${kind}:${data.permalink || item.path}`)}</id>`,
    published ? `<published>${published}</published>` : '',
    `<updated>${updated}</updated>`,
    `<category scheme="${KIND}" term="${KIND_TERM}${kind}"/>`,
    ...labels.map((l) => `<category scheme="${LABEL}" term="${esc(l)}"/>`),
    `<title type="text">${esc(data.title)}</title>`,
    data.description ? `<summary type="text">${esc(data.description)}</summary>` : '',
    `<content type="html">${esc(bodyHtml(data, item.body, o.base))}</content>`,
    full ? `<link rel="alternate" type="text/html" href="${esc(full)}"/>` : '',
    author ? `<author><name>${esc(author)}</name></author>` : '',
    live ? '' : '<app:control xmlns:app="http://purl.org/atom/app#"><app:draft>yes</app:draft></app:control>',
    '</entry>',
  ].filter(Boolean).join('\n');
}

/**
 * posts, pages: [{ path, data, body }] as read by the dashboard (data = front matter).
 * o = { siteName, base: 'https://domain.com', tz, authors: { slug: 'Name' }, now }
 * Returns { xml, counts: { posts, pages, drafts, noAddress } }.
 */
export function buildExport(posts, pages, o = {}) {
  const base = trimBase(o.base);
  const ctx = { base, tz: o.tz || 'UTC', authors: o.authors || {}, now: o.now || new Date().toISOString(), host: (base.replace(/^https?:\/\//, '') || 'site') };
  const byDate = (a, b) => String(a.data.date || '').localeCompare(String(b.data.date || ''));
  const P = [...posts].sort(byDate);
  const G = [...pages].sort(byDate);
  const counts = { posts: P.length, pages: G.length, drafts: [...P, ...G].filter((x) => x.data.status !== 'published').length, noAddress: 0 };
  counts.noAddress = P.filter((x) => !addressOf('post', x.data, ctx.tz)).length + G.filter((x) => !addressOf('page', x.data, ctx.tz)).length;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://purl.org/atom/app#">',
    `<id>${esc(`tag:${ctx.host},export`)}</id>`,
    `<updated>${ctx.now}</updated>`,
    `<title type="text">${esc(o.siteName || 'Site backup')}</title>`,
    '<generator>Shivam Das News dashboard export</generator>',
    ...P.map((x) => entry('post', x, ctx)),
    ...G.map((x) => entry('page', x, ctx)),
    '</feed>',
    '',
  ].join('\n');
  return { xml, counts };
}

/** File name with the day in the site time zone, for example shivam-das-news-backup-2026-11-14.xml */
export function exportName(siteName, now, tz) {
  const { y, m, d } = dateParts(now instanceof Date ? now : new Date(now || Date.now()), tz || 'UTC');
  const slug = String(siteName || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
  return `${slug}-backup-${y}-${m}-${d}.xml`;
}
