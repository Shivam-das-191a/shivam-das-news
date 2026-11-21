// Part 8au (POLISH, Id references): the attributes that point to another element by its id point to a real one.
// A <td headers="h1"> with no id="h1" in the table, an <input list="cities"> with no <datalist id="cities">, an <input form="signup"> with no <form id="signup"> and a
// <button popovertarget="menu"> with no element id="menu" are typos the browser quietly ignores: the cell has no header, the field shows no suggestions, the field is never sent and the button does nothing.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these, and the dashboard preview shows nothing wrong.
// Pure function, no files, no network.
//   checkRefs(html): { errors, warnings }
//   errors:   a name in headers of a <td> or <th>, list of an <input>, form of an input, button, select, textarea, output, fieldset, object, meter or progress,
//             for of an <output> and popovertarget of a <button> or <input> that is not an id on the page (the id is read as written, upper and lower case count);
//             headers and for hold a list of ids, each one is read; an empty value is left alone
//   warnings: a headers that points to something that is not a <th>; a list that points to something that is not a <datalist>; a form that points to something that is not a <form>;
//             a popovertarget that points to an element with no popover attribute
// Left out on purpose, so there is no false alarm: label for (form-labels-lib.mjs reads it); aria-labelledby, aria-describedby and aria-controls (ids-lib.mjs and aria-check-lib.mjs read them);
//   ids made by a script; the case of a tag and an attribute; text inside comments, script, style and <template>; the same id on two elements (ids-lib.mjs); a tag that is not in the list.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const FORM_OWNED = new Set(['input', 'button', 'select', 'textarea', 'output', 'fieldset', 'object', 'meter', 'progress']);
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

export function checkRefs(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  const ids = new Map(); // id -> { tag, attrs } of the first element that has it
  const tags = [];
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const a = attrsOf(m[3]);
    if (a.has('id') && a.get('id') !== '' && !ids.has(a.get('id'))) ids.set(a.get('id'), { tag, attrs: a });
    tags.push({ tag, a });
  }
  for (const { tag, a } of tags) {
    const name = `${art(tag)} <${tag}`;
    const point = (k, valueIsList, missing, wrongTag, wrongWhy) => {
      if (!a.has(k)) return;
      const names = valueIsList ? a.get(k).split(/\s+/).filter(Boolean) : (a.get(k) === '' ? [] : [a.get(k)]);
      for (const n of names) {
        const t = ids.get(n);
        if (!t) { err(`${name} ${k}="${short(n)}"> names an id that is not on the page${missing}`); continue; }
        if (wrongTag && t.tag !== wrongTag) warn(`${name} ${k}="${short(n)}"> points to ${art(t.tag)} <${t.tag}>, not ${art(wrongTag)} <${wrongTag}>${wrongWhy}`);
      }
    };
    if (tag === 'td' || tag === 'th') point('headers', true, '; point it at the id of a <th> in the same table', 'th', '; point it at the id of a <th>');
    if (tag === 'input') point('list', false, ', so the field shows no suggestions; add a <datalist> with that id', 'datalist', ', so the field shows no suggestions');
    if (FORM_OWNED.has(tag)) point('form', false, ', so the field belongs to no form and is never sent; point it at the id of a <form>', 'form', ', so the field is never sent');
    if (tag === 'output') point('for', true, '; point it at the id of the field it counts', '', '');
    if (tag === 'button' || tag === 'input') {
      const k = 'popovertarget';
      if (a.has(k) && a.get(k) !== '') {
        const n = a.get(k);
        const t = ids.get(n);
        if (!t) err(`${name} ${k}="${short(n)}"> names an id that is not on the page, so the button does nothing; point it at the id of the element to show`);
        else if (!t.attrs.has('popover')) warn(`${name} ${k}="${short(n)}"> points to an element with no popover attribute, so the button does nothing; add popover to it`);
      }
    }
  }
  return { errors, warnings };
}
