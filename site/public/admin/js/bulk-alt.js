// The bulk alt text screen (PLAN 33.3 "Bulk alt text"; Phase 3b Part 8a, v0.101.30): a table of every picture that has no alt text yet,
// one field for each, saved together. The rules come from media-meta.js; this file only draws them. Every text goes in as a text node (h() in ui.js).
// It does not talk to GitHub: `onSave(rows)` is given by app.js, saves config/media.json in one commit and returns the new map.
import { h } from './ui.js';
import { safePreviewSrc } from './listing-box.js';
import { ALT_WARN, mediaErrors, missingAlt, mergeAltBulk } from './media-meta.js';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nameOf = (path) => String(path).split('/').pop();

/**
 * opts: {
 *   files,       [{ path, bytes }]  the pictures, paths as the site shows them
 *   map,         the stored config/media.json object
 *   canEdit,     true when the role may change file details
 *   onSave,      async (rows) => the new map; rows = [{ path, alt }] with only the filled, changed rows (it may throw: the message is shown, the typed text stays)
 *   previewSrc,  optional (path) => address for the small picture
 * }
 */
export function bulkAltScreen(opts = {}) {
  const files = (opts.files || []).slice();
  let map = opts.map && typeof opts.map === 'object' && !Array.isArray(opts.map) ? opts.map : {};
  const src = (path) => safePreviewSrc(opts.previewSrc ? opts.previewSrc(path) : path);
  const count = h('p', { class: 'mute', 'data-f': 'count' });
  const status = h('p', { 'data-f': 'status', role: 'status' });
  const errBox = h('ul', { class: 'errors', 'data-f': 'errors', hidden: true });
  const rowsBox = h('div', { 'data-f': 'rows' });
  const el = h('div', { class: 'bulk' }, count, rowsBox, errBox, status);
  let inputs = new Map();

  const rowError = (path, message) => {
    const box = [...rowsBox.querySelectorAll('[data-f="row-error"]')].find((e) => e.dataset.path === path);
    if (box) { box.textContent = message || ''; box.hidden = !message; }
  };

  const draw = () => {
    inputs = new Map();
    const miss = new Set(missingAlt(files.map((f) => f.path), map));
    const list = files.filter((f) => miss.has(f.path));
    count.textContent = list.length === 1 ? '1 file without alt text' : `${list.length} files without alt text`;
    if (!list.length) {
      rowsBox.replaceChildren(h('p', { class: 'mute', 'data-f': 'done' }, files.length ? 'All files have alt text.' : 'No images yet. Upload the first one in Media.'));
      return;
    }
    const rows = list.map((f) => {
      const input = h('input', { value: '', 'data-f': 'alt', 'data-path': f.path, 'aria-label': `Alt text for ${nameOf(f.path)}`, disabled: !opts.canEdit });
      const counter = h('span', { class: 'counter mute', 'data-f': 'alt-count' }, `0 characters (up to ${ALT_WARN} recommended)`);
      const err = h('span', { class: 'warnline', 'data-f': 'row-error', 'data-path': f.path, hidden: true });
      input.addEventListener('input', () => {
        counter.textContent = `${clean(input.value).length} characters (up to ${ALT_WARN} recommended)`;
        const bad = mediaErrors({ alt: input.value });
        err.textContent = bad[0] || ''; err.hidden = !bad.length;
      });
      inputs.set(f.path, input);
      return h('div', { class: 'row', 'data-f': 'row', 'data-path': f.path, style: 'align-items:flex-start;margin-bottom:.6rem' },
        h('img', { src: src(f.path), alt: '', loading: 'lazy', style: 'width:96px;height:72px;object-fit:cover;border-radius:8px' }),
        h('div', { style: 'flex:1;min-width:220px' }, h('strong', { 'data-f': 'name' }, nameOf(f.path)), input, counter, err));
    });
    rowsBox.replaceChildren(...rows, opts.canEdit
      ? h('button', { class: 'primary', type: 'button', 'data-f': 'save', onclick: () => save() }, 'Save all')
      : h('p', { class: 'mute', 'data-f': 'readonly' }, 'Your role cannot change file details.'));
  };

  async function save() {
    if (!opts.canEdit) return;
    status.textContent = ''; errBox.hidden = true;
    const rows = [...inputs].map(([path, input]) => ({ path, alt: input.value })).filter((r) => clean(r.alt));
    if (!rows.length) { status.textContent = 'Type an alt text for at least one file.'; return; }
    const r = mergeAltBulk(map, rows);
    for (const [path] of inputs) rowError(path, '');
    if (r.errors.length) { for (const e of r.errors) rowError(e.path, e.message); status.textContent = 'Nothing was saved. Fix the red lines and try again.'; return; }
    try { map = await opts.onSave(rows.filter((x) => r.changed.includes(x.path)).map((x) => ({ path: x.path, alt: clean(x.alt) }))); }
    catch (err) { errBox.replaceChildren(h('li', null, err && err.message ? err.message : String(err))); errBox.hidden = false; status.textContent = 'Nothing was saved.'; return; }
    draw();
    status.textContent = r.changed.length === 1 ? 'Saved 1 file.' : `Saved ${r.changed.length} files.`;
  }

  draw();
  return { el, save, map: () => map, rows: () => [...inputs.keys()] };
}
