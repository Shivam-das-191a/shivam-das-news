// Part 8d (POLISH, Accessibility and Mobile): every built page has the basics a reader and a screen reader need.
// Pure function, no files, no network.
//   checkPageBasics(html): { errors, warnings }
//   errors:   no lang on the html tag; no viewport with width=device-width; no skip link to #main; no element with id "main";
//             not exactly one main; no header; no footer
//   warnings: more than one nav and a nav without a label (aria-label or aria-labelledby)
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = (name) => new RegExp(`<${name}(?=[\\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi');

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function checkPageBasics(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(SKIP, '');
  const htmlTag = (h.match(TAG('html')) || [])[0] || '';
  if (!(attr(htmlTag, 'lang') || '').trim()) errors.push('the html tag has no lang attribute (screen readers need the language)');
  const viewport = (h.match(TAG('meta')) || []).find((t) => (attr(t, 'name') || '').toLowerCase() === 'viewport');
  if (!viewport || !/width\s*=\s*device-width/i.test(attr(viewport, 'content') || '')) errors.push('no viewport meta tag with width=device-width (the page would be tiny on a phone)');
  const skip = (h.match(TAG('a')) || []).find((t) => (attr(t, 'class') || '').split(/\s+/).includes('skip') && (attr(t, 'href') || '').trim() === '#main');
  if (!skip) errors.push('no "Skip to content" link (class skip, href #main)');
  const ids = (h.match(/<[a-z][a-z0-9-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []).filter((t) => (attr(t, 'id') || '').trim() === 'main');
  if (!ids.length) errors.push('no element with id "main", so the skip link goes nowhere');
  const mains = (h.match(TAG('main')) || []).length;
  if (mains !== 1) errors.push(`expected exactly one main landmark, found ${mains}`);
  if (!TAG('header').test(h)) errors.push('no header landmark');
  if (!TAG('footer').test(h)) errors.push('no footer landmark');
  const navs = h.match(TAG('nav')) || [];
  if (navs.length > 1 && navs.some((t) => !(attr(t, 'aria-label') || '').trim() && !(attr(t, 'aria-labelledby') || '').trim()))
    warnings.push('the page has more than one nav and one of them has no aria-label');
  return { errors, warnings };
}
