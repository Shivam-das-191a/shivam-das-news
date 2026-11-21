// Part 8s (POLISH, Accessibility and Mobile): the ids of a page are clean, so skip links, labels and in-page links reach the right element.
// Pure function, no files, no network.
//   checkIds(html): { errors, warnings }
//   errors:   an id that is empty or has a space in it; the same id on two elements of one page (a label, a skip link or aria-labelledby would point to the wrong one)
//   warnings: an in-page link (href="#name") whose name is no id and no a name on the page; an aria-controls or aria-describedby that points to an id that is not on the page
// Left out on purpose, so there is no false alarm: href="#" and href="#top" (the browser goes to the top); links to other pages that end in a #name; aria-labelledby (form-labels-lib.mjs
// and link-names-lib.mjs read it); ids made by a script; text inside script, style, template and comments.
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function checkIds(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  const ids = new Map(); // id -> count
  const names = new Set();
  const links = [], refs = [];
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const id = attr(m[2], 'id');
    if (id !== null) {
      if (!id.trim()) errors.push(`a <${tag}> has an empty id`);
      else if (/\s/.test(id.trim())) errors.push(`the id "${id.trim()}" on a <${tag}> has a space in it; an id is one word`);
      else ids.set(id.trim(), (ids.get(id.trim()) || 0) + 1);
    }
    if (tag === 'a') {
      const name = attr(m[2], 'name');
      if (name) names.add(name.trim());
      const href = attr(m[2], 'href');
      if (href !== null && href.trim().startsWith('#')) links.push(href.trim().slice(1));
    }
    for (const k of ['aria-controls', 'aria-describedby']) {
      const v = attr(m[2], k);
      if (v) for (const r of v.trim().split(/\s+/)) refs.push([k, r]);
    }
  }
  for (const [id, n] of ids) if (n > 1) errors.push(`the id "${id}" is used ${n} times on one page; an id must be used once`);
  for (const l of links) {
    if (l === '' || l.toLowerCase() === 'top') continue;
    if (!ids.has(l) && !ids.has(decode(l)) && !names.has(l) && !names.has(decode(l))) warnings.push(`a link goes to #${l} but nothing on the page has that id`);
  }
  for (const [k, r] of refs) if (!ids.has(r)) warnings.push(`${k} points to "${r}" but nothing on the page has that id`);
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
