// Part 8aw (POLISH, Link targets): the target of a link, an image map area, a form or a button names a real place.
// <a target="_blnk"> and <a target="_new"> look like "open in a new tab" but are not: the browser opens a window with that odd name and every such link reuses it.
// <a target="blank"> (no underscore) does the same, and <a target=" _blank"> (a space in front) is read with the space, so it is not _blank either.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these, and the dashboard preview shows nothing wrong.
// Pure function, no files, no network.
//   checkTargets(html): { errors, warnings }
//   errors:   a target or formtarget that starts with an underscore and is not _blank, _self, _parent or _top (upper or lower case); one of those four words with a space around it
//   warnings: a target or formtarget that is the plain word blank, self, parent, top or new with no underscore (a window name, not the keyword)
// Read on: a, area, form and base (target) and button and input (formtarget).
// Left out on purpose, so there is no false alarm: a name of a frame or window with no underscore that is not one of those words (target="gallery" is a real name); an empty target;
//   the case of a tag and an attribute; whether the link needs noopener (new-tab-lib.mjs reads that); text inside comments, script, style and <template>; a tag that is not in the list.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const READ = { a: 'target', area: 'target', form: 'target', base: 'target', button: 'formtarget', input: 'formtarget' };
const KEYWORDS = new Set(['_blank', '_self', '_parent', '_top']);
const PLAIN = new Set(['blank', 'self', 'parent', 'top', 'new']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);
const art = (tag) => (/^[aeiou]/.test(tag) ? 'an' : 'a');

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export function checkTargets(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const k = READ[tag];
    if (!k) continue;
    const a = attrsOf(m[3]);
    if (!a.has(k)) continue;
    const v = a.get(k);
    if (v.trim() === '') continue;
    const low = v.trim().toLowerCase();
    const name = `${art(tag)} <${tag} ${k}="${short(v)}">`;
    if (v !== v.trim() && (KEYWORDS.has(low) || PLAIN.has(low))) err(`${name} has a space around the word; the browser reads the space as part of the name, so it is not ${low.startsWith('_') ? low : '_' + low}; remove the space`);
    else if (KEYWORDS.has(low)) continue;
    else if (low.startsWith('_')) err(`${name} starts with an underscore but is not _blank, _self, _parent or _top; the browser opens a window with that odd name; use one of the four words`);
    else if (PLAIN.has(low)) warn(`${name} is a window name, not the keyword; write _${low === 'new' ? 'blank' : low} with the underscore`);
  }
  return { errors, warnings };
}
