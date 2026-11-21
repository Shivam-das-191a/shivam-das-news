// The "File" tab of the post editor (PLAN 33.4, Phase 3b Part 9). Pure rules, no screen and no network.
// The tab shows the raw Markdown file (front matter first). Writers see it read-only; admins can edit and save it.
// Saving always goes through validatePost and the role check in app.js; this file only parses, compares and refuses.
import { parse, stringify } from './frontmatter.js';
import { can } from './roles.js';

export const RAW_ACTION = 'post:raw';
export const RAW_MAX = 200000; // characters; a story this long is a mistake, and GitHub and the browser slow down

/** The text shown in the tab: exactly what a save would write for this post. */
export function rawText(data, body) {
  return stringify(data || {}, body || '');
}

/** Read the text typed in the tab. Never throws. Returns { ok, data, body, errors }. */
export function parseRaw(text) {
  const errors = [];
  const t = String(text ?? '').replace(/^\uFEFF/, '');
  if (!t.trim()) return { ok: false, data: {}, body: '', errors: ['The file is empty.'] };
  if (t.length > RAW_MAX) return { ok: false, data: {}, body: '', errors: [`The file is longer than ${RAW_MAX} characters.`] };
  if (!/^---\r?\n/.test(t)) errors.push('The file must start with a line of three dashes (---), then the front matter.');
  else if (!/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/.test(t)) errors.push('The front matter must end with a second line of three dashes (---).');
  if (errors.length) return { ok: false, data: {}, body: '', errors };
  const { data, body } = parse(t);
  if (!Object.keys(data).length) errors.push('The front matter is empty. A post needs at least a title.');
  let fence = false;
  for (const l of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (!fence && /^# \S/.test(l)) { errors.push('The body has a first-level heading (# ...). The title is the only H1; start with ## headings.'); break; }
  }
  return { ok: errors.length === 0, data, body, errors };
}

/**
 * The role check that runs again at save (BUGS S10). `orig` is what the file was when it was opened (null for a new post):
 * { path, status, permalink, category, date, robots, canonical }. `next` is the parsed front matter.
 * Returns a list of plain sentences; an empty list means the role may save this.
 */
export function rawGuard({ role, orig, next }) {
  const errors = [];
  if (!can(role, RAW_ACTION)) return ['Only admins can change the raw file.'];
  if (!orig) return ['Save the post from the form first; the raw file can change a post that already exists.'];
  const live = orig.status === 'published';
  if (live) {
    if (String(next.permalink || '') !== String(orig.permalink || '')) errors.push('The handle of a live post is changed in the form, where the old address gets its redirect.');
    if (String(next.category || '') !== String(orig.category || '')) errors.push('The category of a live post is changed in the form, where the old address gets its redirect.');
    if (String(next.date || '') !== String(orig.date || '')) errors.push('The date of a live post is changed in the form with "Unlock date", because it is part of the address.');
  } else if (String(next.permalink || '') !== String(orig.permalink || '') || String(next.category || '') !== String(orig.category || '')) {
    errors.push('The handle and the category are changed in the form, so the file moves in one safe step.');
  }
  if (String(next.canonical || '') !== String(orig.canonical || '') && !can(role, 'post:canonical')) errors.push('Only editors and admins can change the canonical address.');
  if (String(next.robots || 'index,follow') !== String(orig.robots || 'index,follow') && !can(role, 'post:noindex')) errors.push('Only editors and admins can change what search engines may list.');
  if (next.status === 'published' && orig.status !== 'published' && !can(role, 'post:publish')) errors.push('Your role can save drafts only.');
  return errors;
}

/** True when the typed text is the same file as the saved one (so the Save button can stay off). */
export function rawUnchanged(saved, typed) {
  const n = (s) => String(s ?? '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return n(saved) === n(typed);
}
