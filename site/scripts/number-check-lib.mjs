// Part 8ar (POLISH, Number attributes): an attribute that must hold a whole number holds one.
// A table cell with colspan="abc", a picture with width="auto" or a list that starts at "x" is a typo the browser quietly repairs, and the page then looks different from what the writer meant.
// A width and height of "100%" or "640px" is not valid on a picture and the browser cannot reserve the space before it loads. Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these.
// Pure function, no files, no network.
//   checkNumbers(html): { errors, warnings }
//   errors:   width or height of an <img>, <video> or <canvas> that is not a number at all ("auto", "abc", "-5"; an empty value is left to img-check-lib);
//             colspan or rowspan of a <td> or <th>, span of a <col> or <colgroup>, rows or cols of a <textarea>, size of an <input> or <select> that is not a whole number ("abc", "2.5", "-1", an empty value);
//             start of an <ol> and value of an <li> that is not a whole number (a negative number is fine)
//   warnings: width or height of an <img>, <video> or <canvas> written as "640px", "100%" or "640.5"; colspan of 0 or above 1000; rowspan above 65534 (0 is real: to the end of the group);
//             span of 0 or above 1000; rows, cols or size of 0
// Left out on purpose, so there is no false alarm: text inside comments, script, style and <template>; the case of a tag, an attribute and a value; width and height of an <iframe> (a percentage is common there);
//   a tag that is not in the list; names that only start with a listed word (<imgs>, <tdx>, <olist>).
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(img|video|canvas|td|th|colgroup|col|ol|li|textarea|input|select)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
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

const WHOLE = /^\d+$/;
const SIGNED = /^-?\d+$/;
const SIZED = new Set(['img', 'video', 'canvas']);
const RANGES = { colspan: [1, 1000], rowspan: [0, 65534], span: [1, 1000] };
const WHOLE_ATTRS = {
  td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], col: ['span'], colgroup: ['span'],
  textarea: ['rows', 'cols'], input: ['size'], select: ['size'],
};

export function checkNumbers(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const a = attrsOf(m[3]);
    const name = `${art(tag)} <${tag}`;
    if (SIZED.has(tag)) {
      for (const k of ['width', 'height']) {
        const v = a.get(k);
        if (v === undefined || v === '') continue;
        if (WHOLE.test(v)) continue;
        const ex = k === 'width' ? 640 : 360;
        if (/^\d+(?:\.\d+)?(?:px|%)?$/i.test(v)) warn(`${name} ${k}="${short(v)}"> is not a whole number of pixels, so the browser cannot reserve the space before it loads; use a whole number such as ${k}="${ex}" and let the style scale it`);
        else err(`${name} ${k}="${short(v)}"> is not a number; use a whole number of pixels such as ${k}="${ex}"`);
      }
      continue;
    }
    if (tag === 'ol' && a.has('start') && !SIGNED.test(a.get('start'))) err(`${name} start="${short(a.get('start'))}"> is not a whole number; use a number such as start="1"`);
    if (tag === 'li' && a.has('value') && !SIGNED.test(a.get('value'))) err(`${name} value="${short(a.get('value'))}"> is not a whole number; use a number such as value="1"`);
    for (const k of WHOLE_ATTRS[tag] || []) {
      if (!a.has(k)) continue;
      const v = a.get(k);
      if (!WHOLE.test(v)) { err(`${name} ${k}="${short(v)}"> is not a whole number; use a number such as ${k}="2"`); continue; }
      const n = Number(v);
      const r = RANGES[k];
      if (r) { if (n < r[0] || n > r[1]) warn(`${name} ${k}="${v}"> is outside ${r[0]} to ${r[1]}, so the browser changes it; use a number inside that range`); }
      else if (n === 0) warn(`${name} ${k}="0"> is 0, so the browser uses its own default; use a number above 0`);
    }
  }
  return { errors, warnings };
}
