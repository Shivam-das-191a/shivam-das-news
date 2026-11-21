// Part 8i (POLISH, Accessibility: "Headings in order"): the headings of a built page tell a reader and a screen reader how the page is built.
// Pure function, no files, no network.
//   checkHeadingOrder(html): { errors, warnings }
//   Checked: h1 to h6. A heading is read from its tag to its closing tag; its name is its text, the alt text of a picture inside it,
//   or an aria-label (on the heading or on a part inside it).
//   errors:   an empty heading (no name): a screen reader reads "heading" and nothing else
//   warnings: - headings that come before the first h1 (one message per page, with the first three named);
//             - a level that is skipped after the h1, for example an h3 straight after the h1 or an h4 straight after an h2
//               (one message for each jump; going back up, h4 then h2, is fine and a second h3 in a row is not a new jump).
//   Not checked: a heading with aria-hidden="true" or the hidden attribute (it is not offered to a screen reader).
//   When a page has no h1, only empty headings are reported (the number of h1 is checked by validate-html.mjs itself).
// Comments and the text inside script, style and template are ignored.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*';
const ANY_TAG = new RegExp(`</?[a-z][a-z0-9-]*(?=["'\\s>/])${ATTRS}>`, 'gi');

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const blank = (s) => s.replace(/&nbsp;|&#160;|&#xa0;|&#8203;|&#x200b;|[\u00a0\u200b\u200c\u200d\ufeff]/gi, ' ').replace(/\s+/g, ' ').trim();
// the hidden attribute has no value, so attr() cannot see it; values in quotes are blanked first so class="hidden" does not count
const hasHidden = (tag) => /\shidden(?=[\s>/=])/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '""'));
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function nameOf(tag, inner) {
  const parts = [attr(tag, 'aria-label') || ''];
  for (const t of inner.match(new RegExp(`<img(?=[\\s>/])${ATTRS}>`, 'gi')) || []) parts.push(attr(t, 'alt') || '');
  for (const t of inner.match(new RegExp(`<[a-z][a-z0-9-]*(?=[\\s>/])${ATTRS}>`, 'gi')) || []) parts.push(attr(t, 'aria-label') || '');
  return blank(parts.join(' ') + ' ' + inner.replace(ANY_TAG, ' '));
}
// the text a message shows for a heading: its own words, without the aria-label
const shownText = (inner) => blank(inner.replace(new RegExp(`<img(?=[\\s>/])${ATTRS}>`, 'gi'), ' ').replace(ANY_TAG, ' '));

export function checkHeadingOrder(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(COMMENT, '').replace(SKIP, '');
  const list = [];
  for (const m of h.matchAll(new RegExp(`<h([1-6])(?=[\\s>/])(${ATTRS})>([\\s\\S]*?)</h\\1\\s*>`, 'gi'))) {
    const tag = `<h${m[1]}${m[2]}>`;
    if ((attr(tag, 'aria-hidden') || '').trim().toLowerCase() === 'true' || hasHidden(tag)) continue;
    const name = nameOf(tag, m[3]);
    const shown = shownText(m[3]) || name;
    list.push({ level: Number(m[1]), name, shown: short(shown) });
  }
  for (const x of list) if (x.name === '') errors.push(`an empty heading h${x.level} (a screen reader would read "heading" and nothing else)`);

  const first = list.findIndex((x) => x.level === 1);
  if (first === -1) return { errors, warnings };
  if (first > 0) {
    const pre = list.slice(0, first);
    const named = pre.slice(0, 3).map((x) => `h${x.level} "${x.shown}"`).join(', ');
    warnings.push(`${pre.length} heading${pre.length === 1 ? '' : 's'} come${pre.length === 1 ? 's' : ''} before the h1 (${named}${pre.length > 3 ? ', ...' : ''}); a page should start with its h1`);
  }
  let prev = 1, prevName = list[first].shown;
  for (const x of list.slice(first + 1)) {
    if (x.level > prev + 1) warnings.push(`h${x.level} "${x.shown}" follows h${prev} "${prevName}" and skips a level (no h${prev + 1} between them)`);
    prev = x.level; prevName = x.shown;
  }
  return { errors, warnings };
}
