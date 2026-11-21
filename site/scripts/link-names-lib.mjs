// Part 8h (POLISH, Accessibility: "Buttons and links have a name"): every link and every button of a built page has a name that a reader and a screen reader can use.
// Pure function, no files, no network.
//   checkLinkNames(html): { errors, warnings }
//   Checked: a with an href, button, input of type submit, button, reset and image.
//   An a or a button has a name when ANY of these is true:
//     - it has a non-empty aria-label;
//     - its aria-labelledby names at least one id that exists on the page;
//     - it holds visible text (text of a picture alt, a svg title, a part with its own aria-label also count);
//   Text and parts inside an element with aria-hidden="true" do not count. A title alone is NOT a name (same rule as the placeholder in 8g).
//   An input of type submit or reset always has a name (the browser writes one); type button needs a value or an aria-label; type image needs an alt or an aria-label.
//   An a or a button with aria-hidden="true" is not checked (it is not offered to a screen reader).
//   errors:   a link or a button with no name
//   warnings: a link whose only text is a vague phrase such as "click here", "here", "more" or "read more" (the words say nothing about where the link goes)
// Comments and the text inside script, style and template are ignored.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*';
const ANY_TAG = new RegExp(`</?[a-z][a-z0-9-]*(?=["'\\s>/])${ATTRS}>`, 'gi');
const VAGUE = new Set(['click here', 'here', 'link', 'this link', 'this', 'more', 'read more', 'learn more']);

const tagRe = (name) => new RegExp(`<${name}(?=[\\s>/])${ATTRS}>`, 'gi');

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

const blank = (s) => s.replace(/&nbsp;|&#160;|&#xa0;|&#8203;|&#x200b;|[\u00a0\u200b\u200c\u200d\ufeff]/gi, ' ').replace(/\s+/g, ' ').trim();

/** Takes away every element that has aria-hidden="true", with all it holds. Counts the depth of the same tag name, so a nested span does not cut it short. */
function dropHidden(inner) {
  let out = '';
  let i = 0;
  const open = new RegExp(`<([a-z][a-z0-9-]*)(?=[\\s>/])${ATTRS}>`, 'gi');
  while (i < inner.length) {
    open.lastIndex = i;
    const m = open.exec(inner);
    if (!m) { out += inner.slice(i); break; }
    out += inner.slice(i, m.index);
    const hidden = (attr(m[0], 'aria-hidden') || '').trim().toLowerCase() === 'true';
    i = m.index + m[0].length;
    if (!hidden) { out += m[0]; continue; }
    if (m[0].endsWith('/>') || /^(img|input|br|hr|meta|link|source|wbr|area|col|embed|track)$/i.test(m[1])) continue;
    const name = m[1];
    const re = new RegExp(`<(/?)${name}(?=[\\s>/])${ATTRS}>`, 'gi');
    re.lastIndex = i;
    let depth = 1, e;
    while ((e = re.exec(inner))) {
      if (e[1]) depth--;
      else if (!e[0].endsWith('/>')) depth++;
      if (depth === 0) { i = e.index + e[0].length; break; }
    }
    if (depth !== 0) i = inner.length; // never closed: everything after it is hidden too
  }
  return out;
}

/** The words an element shows: its text, the alt of a picture, the title of a svg, the aria-label of a part inside it. */
function innerName(inner) {
  const visible = dropHidden(inner);
  const parts = [];
  for (const t of visible.match(tagRe('img')) || []) parts.push(attr(t, 'alt') || '');
  for (const t of visible.match(/<[a-z][a-z0-9-]*(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []) {
    const l = attr(t, 'aria-label');
    if (l) parts.push(l);
  }
  for (const m of visible.matchAll(/<svg\b[\s\S]*?<\/svg\s*>/gi))
    for (const t of m[0].matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)) parts.push(t[1]);
  const text = visible.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, ' ').replace(ANY_TAG, ' ');
  return { name: blank(parts.join(' ') + ' ' + text), text: blank(text) };
}

function describeLink(tag) {
  const href = (attr(tag, 'href') || '').trim();
  return `link to "${href.length > 60 ? href.slice(0, 57) + '...' : href}"`;
}
function describeButton(tag) {
  const id = (attr(tag, 'id') || '').trim();
  const nm = (attr(tag, 'name') || '').trim();
  const cls = (attr(tag, 'class') || '').trim().split(/\s+/)[0];
  return `button (${id ? `id "${id}"` : nm ? `name "${nm}"` : cls ? `class "${cls}"` : 'no id, name or class'})`;
}

export function checkLinkNames(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(COMMENT, '').replace(SKIP, '');

  const ids = new Set();
  for (const t of h.match(/<[a-z][a-z0-9-]*(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []) {
    const id = (attr(t, 'id') || '').trim();
    if (id) ids.add(id);
  }
  const named = (tag) =>
    (attr(tag, 'aria-label') || '').trim() !== '' ||
    (attr(tag, 'aria-labelledby') || '').split(/\s+/).some((x) => x && ids.has(x));
  const hiddenSelf = (tag) => (attr(tag, 'aria-hidden') || '').trim().toLowerCase() === 'true';

  // links and buttons: the tag, then everything up to the closing tag (neither a nor button may hold another of its own kind)
  for (const m of h.matchAll(new RegExp(`<(a|button)(?=[\\s>/])(${ATTRS})>([\\s\\S]*?)</\\1\\s*>`, 'gi'))) {
    const kind = m[1].toLowerCase();
    const tag = `<${kind}${m[2]}>`;
    if (kind === 'a' && attr(tag, 'href') === null) continue; // an anchor without href is not a link
    if (hiddenSelf(tag)) continue;
    const { name, text } = innerName(m[3]);
    const ok = named(tag) || name !== '';
    if (!ok) {
      errors.push(kind === 'a'
        ? `the ${describeLink(tag)} has no name (add text, or an aria-label; a title is not a name)`
        : `the ${describeButton(tag)} has no name (add text, or an aria-label; a title is not a name)`);
    } else if (kind === 'a' && !(attr(tag, 'aria-label') || '').trim() && VAGUE.has(text.toLowerCase().replace(/[.!:>\u2192\u00bb]+$/g, '').trim()) && text === name) {
      warnings.push(`the ${describeLink(tag)} says only "${text}", which tells nothing about where it goes`);
    }
  }

  // inputs that act as buttons
  for (const m of h.matchAll(tagRe('input'))) {
    const tag = m[0];
    const type = (attr(tag, 'type') || '').trim().toLowerCase();
    if (!['submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (hiddenSelf(tag) || named(tag)) continue;
    if (type === 'submit' || type === 'reset') continue; // the browser gives these a name
    if (type === 'button' && (attr(tag, 'value') || '').trim() !== '') continue;
    if (type === 'image' && (attr(tag, 'alt') || '').trim() !== '') continue;
    errors.push(`the input (type "${type}", ${(attr(tag, 'id') || '').trim() ? `id "${attr(tag, 'id').trim()}"` : (attr(tag, 'name') || '').trim() ? `name "${attr(tag, 'name').trim()}"` : 'no name or id'}) has no name (add ${type === 'image' ? 'an alt' : 'a value'} or an aria-label)`);
  }
  return { errors, warnings };
}
