
// Part 8y (POLISH, Accessibility): the keyboard order of a built page is the natural one, and nothing that only a mouse can use is built from a plain tag.
// Pure function, no files, no network.
//   checkTabindex(html): { errors, warnings }
//   errors:   a tabindex that is not a whole number (empty, abc, 1.5); a tabindex above 0 (it jumps ahead of everything else and breaks the order of the Tab key)
//   warnings: an accesskey (it clashes with the shortcuts of browsers and screen readers); a click handler (onclick) on a plain tag such as div, span, p, li or img that has no role and
//             is not a link, button or field (a keyboard cannot use it)
// Left out on purpose, so there is no false alarm: tabindex="0" and tabindex="-1" on any tag (a skip link target, a scrollable box and the contact form honeypot use them);
//   an onclick on a tag that has a role; text inside script, style, template and comments; an accesskey that is empty.
// Why: a positive tabindex makes a reader with a keyboard jump around the page in a strange order (WCAG 2.4.3), and a post written by the owner can carry hand typed HTML (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const PLAIN = new Set(['div', 'span', 'p', 'li', 'ul', 'ol', 'img', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'tr', 'table', 'svg', 'i', 'b', 'em', 'strong']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkTabindex(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    const ti = a.get('tabindex');
    if (ti !== undefined) {
      if (!/^[+-]?\d+$/.test(ti)) errors.push(`<${tag}> has tabindex="${short(ti)}"; it must be a whole number (0 or -1)`);
      else if (parseInt(ti, 10) > 0) errors.push(`<${tag}> has tabindex="${short(ti)}"; a number above 0 breaks the order of the Tab key, use 0 or -1`);
    }
    const ak = a.get('accesskey');
    if (ak) warnings.push(`<${tag}> has accesskey="${short(ak)}"; it clashes with the shortcuts of browsers and screen readers`);
    if (a.has('onclick') && PLAIN.has(tag) && !a.get('role')) warnings.push(`a <${tag}> has onclick and no role, so a keyboard cannot use it; make it a button or a link`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
