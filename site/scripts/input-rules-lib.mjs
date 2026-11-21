// Part 8ay (POLISH, Input rules): the pattern, accept, multiple, minlength and maxlength of a form field do what the writer thinks.
// A pattern that is not a real regular expression is dropped by the browser without a word, so the field accepts anything and the writer believes it is checked.
// Modern browsers read a pattern with the "v" flag: a pattern such as [\w-]+ works in an old browser and is dropped in a new one, so the dash must be written \-.
// A pattern on a checkbox, a number or a date field, an accept on a field that is not a file field and a multiple on a field that is not email or file are ignored as well.
// A minlength above the maxlength means no value can ever pass.
// Pure function, no files, no network.
//   checkInputRules(html): { errors, warnings }
//   errors:   a pattern of an <input> that is not a regular expression in any browser
//   warnings: a pattern that only a new browser drops (the "v" flag) or that is not read on this field; an accept on a field that is not type=file;
//             a multiple on a field that is not type=email or type=file; a minlength above the maxlength of the same field
// Left out on purpose, so there is no false alarm: whether the pattern matches the title text; an empty pattern; the value of minlength or maxlength that is not a whole number (form-controls-lib.mjs reads it);
//   the value of multiple (bool-check-lib.mjs reads it); the case of a tag and an attribute; text inside comments, script, style and <template>; a tag that is not in the list.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const PATTERN_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password']);
const KNOWN_TYPES = new Set(['hidden', 'text', 'search', 'tel', 'url', 'email', 'password', 'date', 'month', 'week', 'time', 'datetime-local', 'number', 'range', 'color', 'checkbox', 'radio', 'file', 'submit', 'image', 'reset', 'button']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);
const NAMED = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

function decode(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (all, dec, hex, name) => {
    try {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    } catch { return all; }
    return NAMED[name.toLowerCase()] ?? all;
  });
}

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

function compiles(source, flag) {
  try { new RegExp('^(?:' + source + ')$', flag); return true; } catch { return false; }
}

const V_FLAG = compiles('a', 'v');

export function checkInputRules(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') continue;
    const a = attrsOf(m[3]);
    let type = tag === 'input' ? (a.get('type') || 'text').toLowerCase() : 'textarea';
    if (tag === 'input' && !KNOWN_TYPES.has(type)) type = 'text'; // the browser reads an unknown type as text
    const named = (k, v) => `an <${tag} ${k}="${short(v)}">`;
    if (a.has('pattern') && a.get('pattern') !== '') {
      const p = decode(a.get('pattern'));
      if (!PATTERN_TYPES.has(type)) {
        warn(`${named('pattern', p)} sits on ${type === 'textarea' ? 'a textarea' : `a field of type "${type}"`}, where the browser does not read a pattern; use a text, search, url, tel, email or password field`);
      } else if (!compiles(p, 'u')) {
        err(`${named('pattern', p)} is not a regular expression, so the browser drops it and the field accepts anything; fix the pattern`);
      } else if (V_FLAG && !compiles(p, 'v')) {
        warn(`${named('pattern', p)} is dropped by new browsers (they read a pattern with the "v" flag); write a dash inside [ ] as \\- and escape ( ) [ ] { } / | with a backslash there`);
      }
    }
    if (tag === 'input' && a.has('accept') && type !== 'file') {
      warn(`${named('accept', a.get('accept'))} sits on a field of type "${type}", where the browser does not read it; accept is for type="file"`);
    }
    if (tag === 'input' && a.has('multiple') && type !== 'email' && type !== 'file') {
      warn(`an <input multiple> sits on a field of type "${type}", where the browser does not read it; multiple is for type="email" and type="file"`);
    }
    if (a.has('minlength') && a.has('maxlength')) {
      const lo = a.get('minlength'), hi = a.get('maxlength');
      if (/^\d+$/.test(lo) && /^\d+$/.test(hi) && Number(lo) > Number(hi)) {
        warn(`${tag === 'input' ? 'an' : 'a'} <${tag} minlength="${lo}" maxlength="${hi}"> has a minlength above its maxlength, so no value can pass; swap the two numbers`);
      }
    }
  }
  return { errors, warnings };
}
