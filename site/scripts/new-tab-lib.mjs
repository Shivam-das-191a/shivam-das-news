// Part 8r (POLISH, Accessibility and Safety): a link that opens a new tab is safe and tells the reader.
// Pure function, no files, no network.
//   checkNewTabLinks(html): { errors, warnings }
//   errors:   a link (a or area with href) with a target that opens another tab or window (_blank or any name that is not _self, _parent or _top) and a rel with neither noopener nor noreferrer;
//             a base tag with such a target (it would open every link of the page in a new tab)
//   warnings: such a link whose text, aria-label and title never say "new tab" or "new window" (a screen reader user is not told)
// Left out on purpose, so there is no false alarm: a link with no href; a link that opens in the same tab (no target, _self, _parent, _top); the words in other languages are not read
// (the site is English); text inside script, style, template and comments; links made by a script (the Worker and script code is not part of a built page).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const LINK = /<(a|area)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)(?=<\/a\s*>|<a[\s>/]|$)/gi;
const BASE = /<base(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const SAME = new Set(['', '_self', '_parent', '_top']);

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const opensNew = (target) => target !== null && !SAME.has(target.trim().toLowerCase());
const short = (s) => (s.length > 70 ? s.slice(0, 67) + '...' : s);

export function checkNewTabLinks(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(BASE)) {
    const t = attr(m[1], 'target');
    if (opensNew(t)) errors.push(`the base tag has target="${t.trim()}", so every link of the page would open in a new tab`);
  }
  for (const m of h.matchAll(LINK)) {
    const href = attr(m[2], 'href');
    if (href === null) continue;
    const target = attr(m[2], 'target');
    if (!opensNew(target)) continue;
    const rel = (attr(m[2], 'rel') || '').toLowerCase().split(/\s+/);
    const where = short(href.trim() || '(empty address)');
    if (!rel.includes('noopener') && !rel.includes('noreferrer'))
      errors.push(`the link to ${where} opens a new tab but its rel has no noopener (the new page could control this one)`);
    const words = `${m[3].replace(/<[^>]*>/g, ' ')} ${attr(m[2], 'aria-label') || ''} ${attr(m[2], 'title') || ''}`;
    if (!/new\s+(?:tab|window)/i.test(words))
      warnings.push(`the link to ${where} opens a new tab but never says so (add "opens in a new tab" in its text or aria-label)`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
