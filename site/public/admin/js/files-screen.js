// The Files screen (PLAN 33.3; Phase 3b Part 7b, v0.101.27+): a grid of the pictures in /media/, a search box, and one editor
// for the alt text, caption and credit of a file, with the Image SEO checks and the "Used in" list.
// The rules come from media-meta.js; this file only draws them. Every text goes in as a text node (h() in ui.js), never as HTML.
// It does not talk to GitHub: `onSave(path, fields)` is given by app.js, saves config/media.json and returns the new map.
import { h } from './ui.js';
import { safePreviewSrc } from './listing-box.js';
import { ALT_WARN, ALT_STOP, CAPTION_STOP, CREDIT_STOP, mediaErrors, imageChecks, usedIn, featuredIn, missingAlt, deleteCheck, removeMedia, replaceCheck, pathPattern } from './media-meta.js';
import { checkNewName } from './file-rename.js';
import { autoAltFiles } from './hosted-meta.js';
import { isVariantOf, variantsOnList, variantPath, parseVariant } from './hosting-srcset.js';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const kb = (n) => (Number.isFinite(n) ? `${Math.max(1, Math.round(n / 1024))} KB` : 'unknown size');
const nameOf = (path) => String(path).split('/').pop();

/**
 * opts: {
 *   files,        [{ path, bytes }]  the pictures, paths as the site shows them (/media/2026/11/a.webp)
 *   map,          the stored config/media.json object
 *   items,        [{ file, text }]   posts and pages, for "Used in"
 *   sizes,        Map or object: path -> { width, height } (filled when a picture has loaded)
 *   canEdit,      true when the role may change file details
 *   onSave,       async (path, fields) => the new map (it may throw: the message is shown, nothing changes)
 *   canDelete,    true when the role may delete a file (editors and admins, PLAN 33.5)
 *   deleteItems,  [{ file, text }] every file that can name a picture (posts, pages, authors, config); default: items
 *   onDelete,     async (path) => optional new map (it may throw: the message is shown, nothing changes; it checks the role and the use again)
 *   canReplace,   true when the role may replace a file (editors and admins)
 *   onReplace,    async (path, { name, bytes }) (it may throw: the message is shown, nothing changes; it checks the role and the file again)
 *   canRename,    true when the role may rename a file (editors and admins)
 *   onRename,     async (path, newName) => { newPath, map? } (it may throw: the message is shown, nothing changes; it checks the role, the name and the use again)
 *   previewSrc,   optional (path) => address for the preview picture
 * }
 */
export function filesScreen(opts = {}) {
  // Part 4c-4a (v0.101.61): a smaller copy (name.480w.webp) is not a picture of its own. The screen hides it while its main picture is in the list
  // (a copy whose main picture is missing stays visible, so nothing disappears by mistake). Part 4c-4b (v0.101.62): a delete takes the copies along
  // (file-delete.js, ONE commit). Part 4c-4c (v0.101.63): a rename takes the copies along (file-rename.js, ONE commit).
  // Part 4c-4d (v0.101.64): a replace removes the old copies in the same commit (file-replace.js), because they would still show the old picture.
  const everyPath = (opts.files || []).map((f) => f.path);
  const files = (opts.files || []).filter((f) => !isVariantOf(f.path, everyPath)); // Part 8b: a deleted file leaves this list
  let hiddenCopies = (opts.files || []).length - files.length;
  const copiesOf = (path) => variantsOnList(path, everyPath);
  let map = opts.map && typeof opts.map === 'object' && !Array.isArray(opts.map) ? opts.map : {};
  // Part 8d-3: a rename changes the text of posts, so the screen keeps its own copies and updates them after a rename.
  const copy = (list) => (list || []).map((i) => ({ ...i }));
  const items = copy(opts.items);
  const delItems = opts.deleteItems ? copy(opts.deleteItems) : items;
  const dims = opts.sizes instanceof Map ? opts.sizes : new Map(Object.entries(opts.sizes || {}));
  const src = (path) => safePreviewSrc(opts.previewSrc ? opts.previewSrc(path) : path);
  let current = null;

  const search = h('input', { type: 'search', placeholder: 'Search by file name', 'data-f': 'search', 'aria-label': 'Search files' });
  const noAlt = h('input', { type: 'checkbox', 'data-f': 'noalt', id: 'files-noalt' });
  const count = h('span', { class: 'mute', 'data-f': 'count' });
  const grid = h('div', { class: 'mgrid', 'data-f': 'grid' });
  const editor = h('div', { class: 'card', 'data-f': 'editor' }, h('p', { class: 'mute' }, 'Pick a file to see and edit its details.'));
  const el = h('div', { class: 'files' },
    h('div', { class: 'row' }, search, h('label', { for: 'files-noalt', style: 'margin:0' }, noAlt, ' Only files without alt text'), count),
    h('div', { style: 'margin-top:1rem' }, grid), editor);

  const visible = () => {
    const q = clean(search.value).toLowerCase();
    let list = files.filter((f) => !q || f.path.toLowerCase().includes(q));
    if (noAlt.checked) { const miss = new Set(missingAlt(list.map((f) => f.path), map)); list = list.filter((f) => miss.has(f.path)); }
    return list;
  };

  const drawGrid = () => {
    const list = visible();
    const miss = new Set(missingAlt(files.map((f) => f.path), map));
    const review = new Set(autoAltFiles(map).map((x) => x.path)); // Part 4b (v0.101.57): alt text written for the writer, not read yet
    count.textContent = `${list.length} of ${files.length} files, ${miss.size} without alt text${review.size ? `, ${review.size} to review` : ''}${hiddenCopies ? `, ${hiddenCopies} smaller ${hiddenCopies === 1 ? 'copy' : 'copies'} hidden` : ''}`;
    grid.replaceChildren(...(list.length ? list.map((f) => {
      const img = h('img', { src: src(f.path), alt: '', loading: 'lazy' });
      img.addEventListener('load', () => { dims.set(f.path, { width: img.naturalWidth, height: img.naturalHeight }); if (current === f.path) drawEditor(f.path); });
      return h('button', { class: 'tile', type: 'button', 'data-f': 'tile', 'data-path': f.path, 'aria-pressed': current === f.path ? 'true' : 'false', onclick: () => drawEditor(f.path) },
        img, h('span', null, nameOf(f.path), miss.has(f.path) ? h('em', { class: 'warnline', 'data-f': 'noalt-badge' }, ' (no alt text)') : null,
        review.has(f.path) ? h('em', { class: 'review-badge', 'data-f': 'review-badge' }, 'alt text to review') : null));
    }) : [h('p', { class: 'mute', 'data-f': 'none' }, files.length ? 'No file matches.' : 'No images yet. Upload the first one in Media.')]));
  };

  function drawEditor(path) {
    current = path;
    for (const t of grid.querySelectorAll('[data-f="tile"]')) t.setAttribute('aria-pressed', t.dataset.path === path ? 'true' : 'false');
    const f = files.find((x) => x.path === path);
    if (!f) { editor.replaceChildren(h('p', { class: 'mute' }, 'That file was not found.')); return; }
    const e = map[path] || {};
    const reviewing = autoAltFiles(map).some((x) => x.path === path);
    const d = dims.get(path);
    const inputs = {
      alt: h('textarea', { rows: 2, value: e.alt || '', 'data-f': 'alt', disabled: !opts.canEdit }),
      caption: h('textarea', { rows: 2, value: e.caption || '', 'data-f': 'caption', disabled: !opts.canEdit }),
      credit: h('input', { value: e.credit || '', 'data-f': 'credit', disabled: !opts.canEdit }),
    };
    const altCount = h('span', { class: 'counter', 'data-f': 'alt-count' });
    const errBox = h('ul', { class: 'errors', 'data-f': 'errors', hidden: true });
    const checkBox = h('ul', { class: 'warnings', 'data-f': 'checks' });
    const values = () => ({ alt: inputs.alt.value, caption: inputs.caption.value, credit: inputs.credit.value });
    const featured = featuredIn(path, items);
    const redraw = () => {
      const v = values();
      altCount.textContent = `${clean(v.alt).length} characters (up to ${ALT_WARN} recommended)`;
      const errs = mediaErrors(v);
      errBox.replaceChildren(...errs.map((m) => h('li', null, m)));
      errBox.hidden = !errs.length;
      const warn = imageChecks({ path, width: d ? d.width : undefined, bytes: f.bytes, alt: v.alt, featured: featured.length > 0 });
      checkBox.replaceChildren(...(warn.length ? warn.map((w) => h('li', { 'data-code': w.code }, w.text)) : [h('li', { class: 'mute', 'data-code': 'ok' }, 'No problems found.')]));
    };
    for (const i of Object.values(inputs)) i.addEventListener('input', redraw);
    const used = usedIn(path, items);
    const save = async () => {
      if (!opts.canEdit) return;
      const v = values();
      const errs = mediaErrors(v);
      if (errs.length) { redraw(); return; }
      const fields = reviewing ? { ...v, autoAlt: null } : v; // Save means the writer has read it: the review mark goes (mergeMedia drops a null key)
      try { map = await opts.onSave(path, fields); } catch (err) { errBox.replaceChildren(h('li', null, err && err.message ? err.message : String(err))); errBox.hidden = false; return; }
      drawGrid(); drawEditor(path);
    };
    editor.replaceChildren(
      h('div', { class: 'row' }, h('img', { src: src(path), alt: '', 'data-f': 'preview', style: 'max-width:180px;max-height:140px;border-radius:8px' }),
        h('div', null, h('strong', { 'data-f': 'name' }, nameOf(path)), h('div', { class: 'mute', 'data-f': 'meta' }, `${path} \u00B7 ${(path.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toUpperCase()} \u00B7 ${kb(f.bytes)} \u00B7 ${d ? `${d.width} x ${d.height} px` : 'size not read yet'}`))),
      reviewing && opts.canEdit ? h('p', { class: 'review-note', 'data-f': 'review-note' }, 'This alt text was written for you from the caption, a heading or the post title. Please read it, correct it if it is wrong, and press Save details.') : null,
      h('div', { class: 'grid' },
        h('div', null, h('label', null, 'Alt text ', altCount), inputs.alt),
        h('div', null, h('label', null, 'Caption'), inputs.caption),
        h('div', null, h('label', null, 'Credit'), inputs.credit)),
      errBox,
      h('h3', null, 'Image checks'), checkBox,
      h('h3', null, 'Used in'),
      used.length ? h('ul', { 'data-f': 'used' }, used.map((u) => h('li', null, u, featured.includes(u) ? h('span', { class: 'mute' }, ' (featured image)') : null))) : h('p', { class: 'mute', 'data-f': 'used-none' }, 'No post or page shows this file yet.'),
      opts.canEdit ? h('button', { class: 'primary', type: 'button', 'data-f': 'save', onclick: save }, 'Save details') : h('p', { class: 'mute', 'data-f': 'readonly' }, 'Your role cannot change file details.'),
      h('h3', null, 'Replace file'), replaceBox(path, f),
      h('h3', null, 'Rename file'), renameBox(path, f),
      h('h3', null, 'Delete'), deleteBox(path, f));
    redraw();
    drawEditor.save = save;
  }

  // Part 8c (v0.101.32): replace. The address stays the same, so the new file must be the same kind of picture (looked at by its first bytes).
  // Choosing the file is the first step, Yes is the second; nothing is sent before Yes.
  function replaceBox(path, f) {
    const box = h('div', { 'data-f': 'replace-box' });
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
    const readBytes = async (file) => new Uint8Array(file.arrayBuffer ? await file.arrayBuffer() : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('The file could not be read.')); r.readAsArrayBuffer(file); }));
    const idle = (message) => {
      if (!opts.canReplace || typeof opts.onReplace !== 'function') { box.replaceChildren(h('p', { class: 'mute', 'data-f': 'replace-locked' }, 'Only an editor or an admin can replace a file.')); return; }
      const input = h('input', { type: 'file', accept: `.${ext}`, 'data-f': 'replace-input', 'aria-label': 'Choose the new file' });
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0]; if (!file) return;
        let bytes;
        try { bytes = await readBytes(file); } catch (e) { idle(e && e.message ? e.message : String(e)); return; }
        picked({ name: file.name || 'file', bytes });
      });
      box.replaceChildren(message ? h('p', { class: 'warnline', 'data-f': 'replace-error' }, message) : null,
        h('p', { class: 'mute' }, `Choose a new .${ext} file. The address stays the same, so posts keep working.`), input);
    };
    const picked = (file) => {
      const check = replaceCheck(path, file);
      const yes = h('button', { class: 'primary', type: 'button', 'data-f': 'replace-yes' }, 'Yes, replace the file');
      const no = h('button', { type: 'button', 'data-f': 'replace-cancel', onclick: () => idle() }, check.ok ? 'Cancel' : 'Choose another file');
      yes.addEventListener('click', async () => {
        yes.disabled = true; no.disabled = true;
        const old = copiesOf(path); // the copies that are removed with the old picture (read before everyPath changes)
        let r;
        try { r = await opts.onReplace(path, { name: file.name, bytes: file.bytes }); } catch (e) { idle(e && e.message ? e.message : String(e)); return; }
        if (r && r.map && typeof r.map === 'object' && !Array.isArray(r.map)) map = r.map;
        for (const c of old) { const i = everyPath.indexOf(c); if (i >= 0) everyPath.splice(i, 1); }
        hiddenCopies = Math.max(0, hiddenCopies - old.length);
        f.bytes = file.bytes.length; dims.delete(path);
        drawGrid(); drawEditor(path);
        editor.prepend(h('p', { 'data-f': 'replaced' }, `Replaced ${nameOf(path)}${old.length ? ` and removed its ${old.length} old smaller ${old.length === 1 ? 'copy' : 'copies'}` : ''}. The address stays the same.`));
      });
      box.replaceChildren(h('p', { 'data-f': 'replace-info' }, `${file.name} \u00B7 ${kb(file.bytes.length)}`),
        check.errors.length ? h('ul', { class: 'errors', 'data-f': 'replace-errors' }, check.errors.map((m) => h('li', null, m))) : null,
        check.warnings.length ? h('ul', { class: 'warnings', 'data-f': 'replace-warnings' }, check.warnings.map((m) => h('li', null, m))) : null,
        check.ok ? h('p', { 'data-f': 'replace-ask' }, `Replace ${nameOf(path)}? The old picture is kept in Git history. The address stays ${path}.${copiesOf(path).length ? ` Its ${copiesOf(path).length} smaller ${copiesOf(path).length === 1 ? 'copy is' : 'copies are'} removed in the same commit, because ${copiesOf(path).length === 1 ? 'it' : 'they'} would still show the old picture.` : ''}`) : null,
        h('div', { class: 'row' }, check.ok ? yes : null, no));
    };
    idle();
    return box;
  }

  // Part 8d-3 (v0.101.35): rename. The rules are in file-rename.js (checkNewName here, planFileRename in app.js). Typing the name is the first step,
  // Yes is the second; nothing is sent before Yes. One commit moves the picture, updates the posts, adds the 301 and moves the alt text.
  function renameBox(path, f) {
    const box = h('div', { 'data-f': 'rename-box' });
    const idle = (message, value = '') => {
      if (!opts.canRename || typeof opts.onRename !== 'function') { box.replaceChildren(h('p', { class: 'mute', 'data-f': 'rename-locked' }, 'Only an editor or an admin can rename a file.')); return; }
      const input = h('input', { value, placeholder: 'new-file-name', 'data-f': 'rename-input', 'aria-label': 'New file name' });
      const go = h('button', { type: 'button', 'data-f': 'rename-go' }, 'Rename file');
      go.addEventListener('click', () => {
        const check = checkNewName(path, input.value, files.map((x) => x.path));
        if (!check.ok) { idle(check.errors[0], input.value); return; }
        picked(check, input.value);
      });
      box.replaceChildren(message ? h('p', { class: 'warnline', 'data-f': 'rename-error' }, message) : null,
        h('p', { class: 'mute' }, 'Type a new name (lowercase letters, numbers and hyphens). The folder and the ending stay. The old address keeps working.'),
        h('div', { class: 'row' }, input, go));
    };
    const picked = (check, typed) => {
      const yes = h('button', { class: 'primary', type: 'button', 'data-f': 'rename-yes' }, 'Yes, rename the file');
      const no = h('button', { type: 'button', 'data-f': 'rename-cancel', onclick: () => idle('', typed) }, 'Cancel');
      yes.addEventListener('click', async () => {
        yes.disabled = true; no.disabled = true;
        let r;
        try { r = await opts.onRename(path, typed); } catch (e) { idle(e && e.message ? e.message : String(e), typed); return; }
        const newPath = (r && r.newPath) || check.newPath;
        const moved = copiesOf(path); // the copies that moved with the picture (read before everyPath changes)
        const pairs = [[path, newPath], ...moved.map((c) => [c, variantPath(newPath, parseVariant(c).width)])];
        for (const [from, to] of pairs) { const i = everyPath.indexOf(from); if (i >= 0) everyPath[i] = to; }
        const re = pathPattern(path, 'g');
        for (const list of new Set([items, delItems])) for (const it of list) it.text = String(it.text).replace(re, () => newPath);
        if (r && r.map && typeof r.map === 'object' && !Array.isArray(r.map)) map = r.map;
        else if (Object.prototype.hasOwnProperty.call(map, path)) { const moved = {}; for (const [k, v] of Object.entries(map)) { if (k !== newPath) moved[k === path ? newPath : k] = v; } map = moved; }
        if (dims.has(path)) { dims.set(newPath, dims.get(path)); dims.delete(path); }
        f.path = newPath; current = newPath;
        drawGrid(); drawEditor(newPath);
        editor.prepend(h('p', { 'data-f': 'renamed' }, `Renamed ${nameOf(path)} to ${nameOf(newPath)}${moved.length ? ` and its ${moved.length} smaller ${moved.length === 1 ? 'copy' : 'copies'}` : ''}. The old address will send readers to the new one after the next deploy.`));
      });
      const places = usedIn(path, items).length;
      box.replaceChildren(
        check.warnings.length ? h('ul', { class: 'warnings', 'data-f': 'rename-warnings' }, check.warnings.map((m) => h('li', null, m))) : null,
        h('p', { 'data-f': 'rename-ask' }, `Rename ${nameOf(path)} to ${nameOf(check.newPath)}? ${copiesOf(path).length ? `Its ${copiesOf(path).length} smaller ${copiesOf(path).length === 1 ? 'copy is' : 'copies are'} renamed with it. ` : ''}${places ? `${places} post or page that shows it is changed to the new address. ` : ''}The old address is redirected (301), and the alt text, caption and credit move with the file. It is saved in one commit.`),
        h('div', { class: 'row' }, yes, no));
    };
    idle();
    return box;
  }

  // Part 8b (v0.101.31): delete. Refused while anything names the file (with the list); otherwise two taps, then one commit made by app.js.
  function deleteBox(path, f) {
    const box = h('div', { 'data-f': 'delete-box' });
    const draw = (mode, message) => {
      const name = nameOf(path);
      const err = message ? h('p', { class: 'warnline', 'data-f': 'delete-error' }, message) : null;
      if (!opts.canDelete || typeof opts.onDelete !== 'function') { box.replaceChildren(h('p', { class: 'mute', 'data-f': 'delete-locked' }, 'Only an editor or an admin can delete a file.')); return; }
      const check = deleteCheck(path, delItems);
      if (!check.ok) {
        box.replaceChildren(h('p', { 'data-f': 'delete-refused' }, check.reason),
          check.usedBy.length ? h('ul', { 'data-f': 'delete-used' }, check.usedBy.map((u) => h('li', null, u))) : null);
        return;
      }
      if (mode === 'confirm') {
        const copies = copiesOf(path);
        const yes = h('button', { class: 'primary', type: 'button', 'data-f': 'delete-yes' }, 'Yes, delete the file');
        const no = h('button', { type: 'button', 'data-f': 'delete-cancel', onclick: () => draw('idle') }, 'Cancel');
        yes.addEventListener('click', async () => {
          yes.disabled = true; no.disabled = true;
          try {
            const r = await opts.onDelete(path);
            map = r && typeof r === 'object' && !Array.isArray(r) ? r : removeMedia(map, path);
          } catch (e) { draw('idle', e && e.message ? e.message : String(e)); return; }
          const i = files.findIndex((x) => x.path === path); if (i >= 0) files.splice(i, 1);
          hiddenCopies = Math.max(0, hiddenCopies - copies.length); // the copies left with the picture
          current = null; drawGrid();
          editor.replaceChildren(h('p', { 'data-f': 'deleted' }, `Deleted ${name}${copies.length ? ` and its ${copies.length} smaller ${copies.length === 1 ? 'copy' : 'copies'}` : ''}.`));
        });
        box.replaceChildren(h('p', { 'data-f': 'delete-ask' }, `Delete ${name} for good? The file${copies.length ? `, its ${copies.length} smaller ${copies.length === 1 ? 'copy' : 'copies'}` : ''} and its alt text, caption and credit are removed in one commit.`), h('div', { class: 'row' }, yes, no));
        return;
      }
      box.replaceChildren(err, h('button', { type: 'button', 'data-f': 'delete', onclick: () => draw('confirm') }, 'Delete file'));
    };
    draw('idle');
    return box;
  }

  search.addEventListener('input', drawGrid);
  noAlt.addEventListener('change', drawGrid);
  drawGrid();
  return { el, select: drawEditor, save: () => (drawEditor.save ? drawEditor.save() : Promise.resolve()), map: () => map, visible };
}
