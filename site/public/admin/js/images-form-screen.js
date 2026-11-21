// Auto image hosting, the picture settings FORM PAGE (PLAN 34.10; Phase 3c Part 7u, v0.101.90). The form itself has no button; the Save button is added under it by imagesView in app.js (Part 7ad, v0.101.99).
// It draws a form for the eleven settings of config/images.json and, while the person types, shows (1) a plain sentence under each wrong value, (2) what would change,
// (3) the text that would be written. It does not fetch, save or touch GitHub, and it has no button of its own (the Save button is added by imagesView in app.js).
//   imagesFormScreen({ settings, currentText?, onChange? }) -> { el, read(), text(), update(settings, currentText?) }
//     settings     the current settings (any object; a bad one shows its shipped values, as in images-screen.js)
//     currentText  the current text of config/images.json, so that the keys this code does not know are kept in text()
//     onChange     called with the result of read() after each edit by the person and after update()
//     read()       -> { ok: true, settings } or { ok: false, errors: [{ key, message }] }  (imagesFromForm of images-form.js; the same rules as the build check)
//     text()       -> the new text of config/images.json, or null while a value is wrong
//     update(...)  puts new settings into the fields and draws again
// Each field has data-key="<setting>" on its control (checkbox, text box, select, text area). A wrong field has aria-invalid="true".
// Rules: every text goes in as a TEXT node (h() in ui.js); no emoji; no <form>, no button; the classes are those that admin.css already has (card, errors, hint).
import { h, field } from './ui.js';
import { imagesFormValues, imagesFromForm, imagesFileText, imagesChanges } from './images-form.js';
import { imagesSettingsOf, NAME_SOURCES } from './images-setting.js';

const isMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m);

export function imagesFormScreen(given) {
  const opts = isMap(given) ? given : {};
  let base = imagesSettingsOf(opts.settings);
  let currentText = typeof opts.currentText === 'string' ? opts.currentText : undefined;
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  const start = imagesFormValues(base);

  const box = (key, label, hint) => {
    const c = h('input', { type: 'checkbox', 'data-key': key });
    c.checked = !!start[key];
    return h('div', null, h('label', null, c, ' ' + label, hint ? h('span', { class: 'hint' }, ' ' + hint) : null));
  };
  const numBox = (key) => h('input', { type: 'text', inputmode: 'numeric', 'data-key': key, value: start[key], autocomplete: 'off' });
  const area = (key) => h('textarea', { 'data-key': key, rows: '3', spellcheck: 'false', value: start[key] });
  const storage = h('select', { 'data-key': 'storage' },
    h('option', { value: 'repo' }, 'In the repository'),
    h('option', { value: 'r2' }, 'Cloudflare R2 (not built yet)'));
  storage.value = start.storage;
  const order = h('input', { type: 'text', 'data-key': 'nameOrder', value: start.nameOrder.join(', '), autocomplete: 'off', spellcheck: 'false' });

  const controls = {
    enabled: box('enabled', 'Picture hosting is on'),
    askFirst: box('askFirst', 'Ask the writer first', '(off = automatic)'),
    maxWidth: numBox('maxWidth'), sizeWarnKb: numBox('sizeWarnKb'), quality: numBox('quality'), storage,
    askHosts: area('askHosts'), allowHosts: area('allowHosts'), blockHosts: area('blockHosts'),
    hardBlock: box('hardBlock', 'An outside picture in a live post is an error', '(off = warning only)'),
    nameOrder: order,
  };
  const input = (key) => (key === 'enabled' || key === 'askFirst' || key === 'hardBlock' ? controls[key].querySelector('input') : controls[key]);

  const errorsBox = h('ul', { class: 'card errors', 'data-f': 'errors', hidden: true });
  const changesBox = h('ul', { class: 'card', 'data-f': 'changes' });
  const fileBox = h('pre', { 'data-f': 'filetext', class: 'card', style: 'white-space:pre-wrap;overflow-x:auto' });
  const el = h('div', { 'data-f': 'images-form' },
    h('p', { class: 'mute', 'data-f': 'intro' }, 'Change a value and check the lines below. When they are right, press Save picture settings at the bottom of this screen to write config/images.json.'),
    h('div', { class: 'card' },
      controls.enabled, controls.askFirst,
      field('Widest picture, in pixels', controls.maxWidth, '(0 = no limit)'),
      field('Biggest picture file, in KB', controls.sizeWarnKb, '(0 = no limit)'),
      field('Picture quality, 1 to 100', controls.quality),
      field('Where pictures are kept', controls.storage),
      field('Websites that ask first', controls.askHosts, '(one name on each line)'),
      field('Websites counted as ours', controls.allowHosts, '(one name on each line)'),
      field('Websites never allowed', controls.blockHosts, '(one name on each line)'),
      controls.hardBlock,
      field('Order of picture names', controls.nameOrder, `(words, with commas: ${NAME_SOURCES.join(', ')}; the last must be handle)`)),
    errorsBox,
    h('p', { class: 'mute', 'data-f': 'changes-title' }, 'What would change'),
    changesBox,
    h('p', { class: 'mute', 'data-f': 'filetext-title' }, 'The text of config/images.json after the change'),
    fileBox);

  function readRaw() {
    const raw = {};
    for (const k of ['enabled', 'askFirst', 'hardBlock']) raw[k] = input(k).checked;
    for (const k of ['maxWidth', 'sizeWarnKb', 'quality', 'storage', 'askHosts', 'allowHosts', 'blockHosts', 'nameOrder']) raw[k] = input(k).value;
    return raw;
  }

  function draw() {
    const result = imagesFromForm(readRaw(), base);
    const bad = new Set(result.ok ? [] : result.errors.map((e) => e.key));
    for (const k of Object.keys(controls)) {
      const c = input(k);
      if (bad.has(k)) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    }
    errorsBox.textContent = '';
    errorsBox.hidden = result.ok;
    if (!result.ok) for (const e of result.errors) errorsBox.append(h('li', { 'data-key': e.key }, e.message));
    changesBox.textContent = '';
    if (!result.ok) changesBox.append(h('li', { class: 'mute' }, 'Fix the lines above first.'));
    else {
      const list = imagesChanges(base, result.settings);
      if (list.length === 0) changesBox.append(h('li', { class: 'mute' }, 'Nothing is changed.'));
      for (const c of list) changesBox.append(h('li', { 'data-key': c.key }, `${c.label}: ${c.from} -> ${c.to}`));
    }
    fileBox.textContent = result.ok ? imagesFileText(result.settings, currentText) : '';
    return result;
  }

  const edited = () => { const r = draw(); if (onChange) onChange(r); };
  el.addEventListener('input', edited);
  el.addEventListener('change', edited);
  draw();

  return {
    el,
    read: () => imagesFromForm(readRaw(), base),
    text() { const r = imagesFromForm(readRaw(), base); return r.ok ? imagesFileText(r.settings, currentText) : null; },
    update(settings, text) {
      base = imagesSettingsOf(settings);
      if (typeof text === 'string') currentText = text;
      const v = imagesFormValues(base);
      for (const k of ['enabled', 'askFirst', 'hardBlock']) input(k).checked = !!v[k];
      for (const k of ['maxWidth', 'sizeWarnKb', 'quality', 'storage', 'askHosts', 'allowHosts', 'blockHosts']) input(k).value = v[k];
      input('nameOrder').value = v.nameOrder.join(', ');
      const r = draw();
      if (onChange) onChange(r);
    },
  };
}
