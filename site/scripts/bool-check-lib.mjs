// Part 8av (POLISH, Switch attributes): an on/off attribute written as off is still on.
// <input disabled="false"> is a disabled field, <details open="false"> is open, <button hidden="0"> is hidden and <video autoplay="no"> plays: an attribute of this kind is ON when it is present,
// whatever its value says. Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these, and the dashboard preview shows the same wrong page, so nobody sees the mistake.
// Pure function, no files, no network.
//   checkBools(html): { errors, warnings }
//   errors:   an on/off attribute whose value says off (false, 0, no or off, upper or lower case): the browser still switches it on
//   warnings: an on/off attribute with any other value than nothing or its own name (disabled="true", disabled="yes"): it works, but HTML wants disabled or disabled="disabled"
// On/off attributes read, each on the tags that take it:
//   disabled (button, fieldset, input, optgroup, option, select, textarea), checked (input), selected (option), required (input, select, textarea), readonly (input, textarea),
//   multiple (input, select), open (details, dialog), controls, autoplay, loop, muted and playsinline (video, audio; playsinline on video only), async, defer and nomodule (script),
//   novalidate (form), formnovalidate (button, input), reversed (ol), ismap (img), allowfullscreen (iframe), default (track), and on any tag: hidden, inert, autofocus and itemscope.
// Left out on purpose, so there is no false alarm: aria-disabled, aria-hidden, aria-checked and every other aria- name (they hold a real true or false); data- attributes; contenteditable, draggable and spellcheck
//   (a real false is allowed there, input-hints-lib.mjs reads them); hidden="until-found"; the same attribute on a tag that does not take it; the case of a tag and an attribute;
//   text inside comments, script, style and <template>; a custom tag.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ANY = '*';
const TAKES = {
  disabled: ['button', 'fieldset', 'input', 'optgroup', 'option', 'select', 'textarea'],
  checked: ['input'],
  selected: ['option'],
  required: ['input', 'select', 'textarea'],
  readonly: ['input', 'textarea'],
  multiple: ['input', 'select'],
  open: ['details', 'dialog'],
  controls: ['video', 'audio'],
  autoplay: ['video', 'audio'],
  loop: ['video', 'audio'],
  muted: ['video', 'audio'],
  playsinline: ['video'],
  async: ['script'],
  defer: ['script'],
  nomodule: ['script'],
  novalidate: ['form'],
  formnovalidate: ['button', 'input'],
  reversed: ['ol'],
  ismap: ['img'],
  allowfullscreen: ['iframe'],
  default: ['track'],
  hidden: ANY,
  inert: ANY,
  autofocus: ANY,
  itemscope: ANY,
};
const OFF = new Set(['false', '0', 'no', 'off']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);
const art = (tag) => (/^[aeiou]/.test(tag) ? 'an' : 'a');

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkBools(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    let tag, text;
    if (m[3] !== undefined) { tag = m[3].toLowerCase(); text = m[4]; } // an ordinary tag
    else if (m[1] !== undefined && m[1].toLowerCase() === 'script') { tag = 'script'; text = m[2]; } // the opening tag of a script is read, its text is not
    else continue; // a comment, style or template
    const a = attrsOf(text);
    for (const [k, takes] of Object.entries(TAKES)) {
      if (!a.has(k)) continue;
      if (takes !== ANY && !takes.includes(tag)) continue;
      const v = a.get(k);
      const low = v.toLowerCase();
      if (v === '' || low === k) continue;
      if (k === 'hidden' && low === 'until-found') continue;
      const name = `${art(tag)} <${tag} ${k}="${short(v)}">`;
      if (OFF.has(low)) err(`${name} is still ON: an on/off attribute is on whenever it is there, whatever its value says; delete ${k} to switch it off`);
      else warn(`${name} works, but write ${k} with no value, or as ${k}="${k}"`);
    }
  }
  return { errors, warnings };
}
