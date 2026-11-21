// Part 8ac (POLISH, Speed and Privacy): the fixed-choice attributes of a built page hold a value the browser knows.
// A typo such as loading="laz" or fetchpriority="hihg" is never reported: the browser silently falls back to its default, so a picture meant to load late loads at once,
// or the hero picture loses its priority. Pure function, no files, no network.
//   checkAttrValues(html): { errors, warnings }
//   errors:   a value that is not one of the real choices, on these tags only:
//             loading (img, iframe: lazy, eager); decoding (img: async, sync, auto); fetchpriority (img, link, script, iframe: high, low, auto);
//             referrerpolicy (a, area, img, iframe, link, script: the eight policies); crossorigin (img, script, link, audio, video: anonymous, use-credentials, or empty);
//             method (form: get, post, dialog); enctype (form: the three encodings); type (ol: 1, a, A, i, I)
//   warnings: referrerpolicy="unsafe-url", which sends the full address of the page (path and query) to every other site
// Left out on purpose, so there is no false alarm: the case of a value (LAZY is read as lazy; the type of an ol is the one place where case counts);
//   an empty referrerpolicy or crossorigin (both mean the default); the same attribute names on other tags; text inside script, style, template and comments.
// Why: pictures, frames and links written by hand in a post (PLAN 37) can carry these attributes, and the speed rules of POLISH depend on loading and fetchpriority.
// The text inside script, style and template is dropped, but the opening tag stays, because a script tag has attributes of its own (fetchpriority, crossorigin, referrerpolicy).
const SKIP = /<(script|style|template)\b((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);
const POLICIES = ['no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin', 'unsafe-url'];
const RULES = [
  { attr: 'loading', tags: ['img', 'iframe'], values: ['lazy', 'eager'] },
  { attr: 'decoding', tags: ['img'], values: ['async', 'sync', 'auto'] },
  { attr: 'fetchpriority', tags: ['img', 'link', 'script', 'iframe'], values: ['high', 'low', 'auto'] },
  { attr: 'referrerpolicy', tags: ['a', 'area', 'img', 'iframe', 'link', 'script'], values: POLICIES, empty: true },
  { attr: 'crossorigin', tags: ['img', 'script', 'link', 'audio', 'video'], values: ['anonymous', 'use-credentials'], empty: true },
  { attr: 'method', tags: ['form'], values: ['get', 'post', 'dialog'] },
  { attr: 'enctype', tags: ['form'], values: ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'] },
  { attr: 'type', tags: ['ol'], values: ['1', 'a', 'A', 'i', 'I'], exact: true },
];
const FAST = /loading|decoding|fetchpriority|referrerpolicy|crossorigin|method|enctype|type/i;

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}
const list = (v) => (v.length === 2 ? `${v[0]} or ${v[1]}` : v.length > 4 ? 'one of ' + v.slice(0, 4).join(', ') + ' and so on' : v.slice(0, -1).join(', ') + ' or ' + v[v.length - 1]);

export function checkAttrValues(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, (_m, name, attrs) => `<${name}${attrs}>`);
  for (const m of h.matchAll(TAG)) {
    if (!FAST.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    let a = null;
    for (const r of RULES) {
      if (!r.tags.includes(tag)) continue;
      a ??= attrsOf(m[2]);
      if (!a.has(r.attr)) continue;
      const raw = a.get(r.attr);
      if (raw === '' && r.empty) continue;
      const v = r.exact ? raw : raw.toLowerCase();
      if (!r.values.includes(v)) errors.push(`a <${tag}> has ${r.attr}="${short(raw)}", which is not a real value, so the browser ignores it; use ${list(r.values)}`);
      else if (r.attr === 'referrerpolicy' && v === 'unsafe-url') warnings.push(`a <${tag}> has referrerpolicy="unsafe-url", which sends the full address of this page to other sites; use strict-origin-when-cross-origin or no-referrer`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
