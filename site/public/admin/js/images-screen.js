// Auto image hosting, the picture settings screen, READ ONLY (PLAN 34.10; Phase 3c Part 7r, v0.101.87).
// It only DRAWS the settings of config/images.json in plain words. It does not fetch, save or touch GitHub, and it has no button that changes a setting.
//   imagesRows(settings)            -> an array of 11 rows { key, label, value, help, use } in the order of PLAN 34.10; `settings` goes through imagesSettingsOf first,
//                                      so a missing or wrong value shows its shipped value; never throws; the input is never changed
//   imagesScreen({ settings, note? }) -> { el, update(settings, note?) }   `el` is the box to put on a page; update() draws it again with new settings (and a new note, or none)
// Each row is one list item: data-f="row", data-key="<setting>", with data-f="label", "value", "help" and "use" inside. `use` says in words where the setting works today:
//   build   the build check (`npm run check:content`) uses it           quality   the Save of the editor uses it when picture hosting is on
//   save    the Save of the editor uses it (the switch `enabled`)           none   nothing reads it yet
// Rules: every text goes in as a TEXT node (h() in ui.js): a website name comes from a file that someone could edit and is never HTML. No emoji. The look reuses the classes
// of the hosting list screen (admin.css is not changed). It writes nothing. Since Part 7s (v0.101.88) app.js shows it at #/images (menu: Picture settings, admins only); the live site does not change.
import { h } from './ui.js';
import { imagesSettingsOf } from './images-setting.js';

/** The six ways to make a picture file name, in plain words (PLAN 34.4). */
export const NAME_WORDS = {
  alt: 'alt text',
  caption: 'caption',
  heading: 'nearest heading',
  keyword: 'focus keyword and title words',
  oldName: 'old file name',
  handle: 'post handle and a number',
};

/** Where each setting works today. */
export const USE_WORDS = {
  build: 'Used today by the build check.',
  quality: 'Used today by the Save of the editor, when picture hosting is on.',
  save: 'Used today by the Save of the editor: Off stops it from hosting pictures.',
  name: 'Used today by the Save of the editor, when it names new pictures.',
  ask: 'Used today by the Save of the editor: pictures from these websites wait for the writer to confirm.',
  askFirst: 'Used today by the Save of the editor: with Ask first, every picture that is not hosted yet waits for the writer to confirm.',
  buildSave: 'Used today by the build check and by the Save of the editor: pictures from these websites are refused.',
  buildSaveOwn: 'Used today by the build check and by the Save of the editor: pictures from these websites are counted as ours and are not hosted.',
  none: 'Not used yet: nothing reads this value.',
};

const MAX_SHOWN = 10;

// A list of website names as one line: "None", or the first ten and "and N more".
function hostLine(list) {
  if (!Array.isArray(list) || list.length === 0) return 'None';
  const shown = list.slice(0, MAX_SHOWN).join(', ');
  return list.length > MAX_SHOWN ? `${shown} and ${list.length - MAX_SHOWN} more` : shown;
}

/** The eleven rows of the screen, from any settings object (bad or missing values show their shipped value). */
export function imagesRows(settings) {
  const s = imagesSettingsOf(settings);
  return [
    { key: 'enabled', label: 'Picture hosting', value: s.enabled ? 'On' : 'Off', help: 'Whether the Save may copy outside pictures to our own site. Off keeps them where they are.', use: 'save' },
    { key: 'askFirst', label: 'How it starts', value: s.askFirst ? 'Ask first' : 'Automatic', help: 'Automatic hosts the pictures at once; Ask first waits for the writer.', use: 'askFirst' },
    { key: 'maxWidth', label: 'Widest picture', value: s.maxWidth === 0 ? 'No limit' : `${s.maxWidth} px`, help: 'A published post with a wider picture gets a warning.', use: 'build' },
    { key: 'sizeWarnKb', label: 'Biggest picture file', value: s.sizeWarnKb === 0 ? 'No limit' : `${s.sizeWarnKb} KB`, help: 'A published post with a bigger picture file gets a warning.', use: 'build' },
    { key: 'quality', label: 'Picture quality', value: `${s.quality} of 100`, help: 'The quality of new hosted pictures. A higher number is sharper and heavier.', use: 'quality' },
    { key: 'storage', label: 'Where pictures are kept', value: s.storage === 'r2' ? 'Cloudflare R2 (not built yet)' : 'In the repository', help: 'Only the repository is built today.', use: 'none' },
    { key: 'askHosts', label: 'Websites that ask first', value: hostLine(s.askHosts), help: 'Pictures from these websites wait for the writer to confirm the rights. They are added to the built-in list of agency websites.', use: 'ask' },
    { key: 'allowHosts', label: 'Websites counted as ours', value: hostLine(s.allowHosts), help: 'A picture from these websites is not counted as an outside picture. The Save of the editor matches the exact name and ignores a name that is related to an agency or a blocked website.', use: 'buildSaveOwn' },
    { key: 'blockHosts', label: 'Websites never allowed', value: hostLine(s.blockHosts), help: 'A picture from these websites in a live post is always an error. The Save of the editor does not host them.', use: 'buildSave' },
    { key: 'hardBlock', label: 'Outside pictures at publish', value: s.hardBlock ? 'Error' : 'Warning only', help: 'Error stops the check when a live post still has an outside picture in its text.', use: 'build' },
    { key: 'nameOrder', label: 'Order of picture names', value: s.nameOrder.map((w) => NAME_WORDS[w] || w).join(', then '), help: 'The first way that gives a good text makes the file name. Only new pictures use this order; saved ones keep their names.', use: 'name' },
  ];
}

export function imagesScreen(given) {
  const opts = given && typeof given === 'object' ? given : {};
  const intro = h('p', { class: 'mute', 'data-f': 'intro' }, 'These are the picture settings. This screen only shows them. To change one, edit config/images.json.');
  const note = h('p', { class: 'mute', 'data-f': 'note', hidden: true });
  const list = h('ul', { class: 'hosting-list', 'data-f': 'rows' });
  const el = h('div', { class: 'hosting-result', 'data-f': 'images-screen' }, intro, note, list);

  const say = (message) => {
    note.textContent = typeof message === 'string' ? message : '';
    note.hidden = !note.textContent;
  };

  function draw(settings) {
    list.textContent = '';
    for (const r of imagesRows(settings)) {
      list.append(h('li', { 'data-f': 'row', 'data-key': r.key },
        h('strong', { 'data-f': 'label' }, r.label),
        ' ',
        h('span', { 'data-f': 'value' }, r.value),
        h('p', { class: 'mute', 'data-f': 'help' }, r.help),
        h('p', { class: 'mute', 'data-f': 'use' }, USE_WORDS[r.use] || USE_WORDS.none)));
    }
  }

  say(opts.note);
  draw(opts.settings);
  return {
    el,
    update(settings, message) { say(message); draw(settings); },
  };
}
