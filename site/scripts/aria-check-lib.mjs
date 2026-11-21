
// Part 8x (POLISH, Accessibility): the ARIA words of a built page are real and are not used against the reader.
// Pure function, no files, no network.
//   checkAria(html): { errors, warnings }
//   errors:   a role that is not a real role (a typo, or a role that only exists in theory such as widget); an aria- attribute that does not exist (aria-lable);
//             a wrong value for an aria- attribute that has a fixed list (aria-hidden="yes", aria-live="loud", aria-level="0");
//             aria-hidden="true" on body or html (the whole page is hidden from a screen reader);
//             aria-hidden="true" on something the keyboard can reach (a link, button, field, summary or tabindex of 0 or more) unless it is disabled or has tabindex="-1"
//   warnings: aria-hidden="true" around something the keyboard can reach inside; an empty aria-label; role="presentation" or "none" on something the keyboard can reach;
//             a role that the tag already has (nav with role="navigation", button with role="button")
// Left out on purpose, so there is no false alarm: text inside script, style, template and comments; a role with several words (the first real one counts, like the browser);
//   roles that start with doc- or graphics-; an aria- attribute inside an attribute value; aria-labelledby and aria-describedby ids (ids-lib.mjs and link-names-lib.mjs read them);
//   an input of type hidden (nobody reaches it); aria-hidden="false" (it hides nothing).
// Why: a link hidden from a screen reader but still reached by the Tab key is a trap, a typo in an aria- name is silently ignored, and a post written by the owner can carry hand typed HTML (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const ROLES = new Set(('alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem').split(' '));

const BOOL = ['true', 'false', 'undefined'];
const VALUES = {
  'aria-atomic': BOOL, 'aria-busy': BOOL, 'aria-disabled': BOOL, 'aria-modal': BOOL, 'aria-multiline': BOOL, 'aria-multiselectable': BOOL,
  'aria-readonly': BOOL, 'aria-required': BOOL, 'aria-hidden': BOOL, 'aria-expanded': BOOL, 'aria-selected': BOOL,
  'aria-checked': ['true', 'false', 'mixed', 'undefined'], 'aria-pressed': ['true', 'false', 'mixed', 'undefined'],
  'aria-invalid': ['true', 'false', 'grammar', 'spelling'], 'aria-live': ['off', 'polite', 'assertive'],
  'aria-current': ['true', 'false', 'page', 'step', 'location', 'date', 'time'],
  'aria-haspopup': ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
  'aria-orientation': ['horizontal', 'vertical', 'undefined'], 'aria-autocomplete': ['inline', 'list', 'both', 'none'],
  'aria-sort': ['ascending', 'descending', 'none', 'other'],
};
const NAMES = new Set(['aria-activedescendant', 'aria-braillelabel', 'aria-brailleroledescription', 'aria-colcount', 'aria-colindex', 'aria-colindextext', 'aria-colspan', 'aria-controls',
  'aria-describedby', 'aria-description', 'aria-details', 'aria-dropeffect', 'aria-errormessage', 'aria-flowto', 'aria-grabbed', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby',
  'aria-level', 'aria-owns', 'aria-placeholder', 'aria-posinset', 'aria-relevant', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowindextext', 'aria-rowspan',
  'aria-setsize', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext', ...Object.keys(VALUES)]);
const SAME_ROLE = { nav: 'navigation', main: 'main', button: 'button', article: 'article', aside: 'complementary', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading' };

const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

/** True when the Tab key can reach this element (disabled, tabindex -1 and hidden inputs are not reached). */
function reachable(tag, a) {
  if (a.has('disabled') && ['button', 'input', 'select', 'textarea'].includes(tag)) return false;
  const ti = a.get('tabindex');
  if (ti !== undefined && /^-\d+$/.test(ti)) return false;
  if (ti !== undefined && /^\d+$/.test(ti)) return true;
  if (tag === 'input') return (a.get('type') || 'text').toLowerCase() !== 'hidden';
  if (['button', 'select', 'textarea', 'summary'].includes(tag)) return true;
  if ((tag === 'a' || tag === 'area') && a.has('href')) return true;
  if (a.has('contenteditable') && a.get('contenteditable').toLowerCase() !== 'false') return true;
  return false;
}

/** The text between the open tag that ends at `from` and its own close tag. Counts the depth of the same tag name, so a nested div does not cut it short. */
function innerOf(h, tag, from) {
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>`, 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(h))) {
    if (m[1]) depth--;
    else if (!/\/\s*$/.test(m[2])) depth++;
    if (depth === 0) return h.slice(from, m.index);
  }
  return h.slice(from);
}

function hasReachableInside(inner) {
  for (const m of inner.matchAll(TAG)) {
    if (reachable(m[1].toLowerCase(), attrsOf(m[2]))) return true;
  }
  return false;
}

export function checkAria(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    const hidden = a.get('aria-hidden') !== undefined && a.get('aria-hidden').toLowerCase() === 'true';

    for (const [name, raw] of a) {
      if (!name.startsWith('aria-')) continue;
      if (!NAMES.has(name)) { errors.push(`<${tag}> has ${short(name)}, which is not a real aria attribute (a typo is ignored by every screen reader)`); continue; }
      const value = raw.toLowerCase();
      if (VALUES[name] && !VALUES[name].includes(value)) errors.push(`<${tag}> has ${name}="${short(raw)}"; allowed: ${VALUES[name].join(', ')}`);
      if (name === 'aria-level' && !/^[1-9]\d*$/.test(raw)) errors.push(`<${tag}> has aria-level="${short(raw)}"; it must be a whole number from 1`);
      if (name === 'aria-label' && raw === '') warnings.push(`<${tag}> has an empty aria-label, so it gives no name; write the name or take the attribute away`);
    }

    const role = a.get('role');
    if (role !== undefined) {
      const words = role.toLowerCase().split(/\s+/).filter(Boolean);
      const real = words.find((w) => ROLES.has(w) || w.startsWith('doc-') || w.startsWith('graphics-'));
      if (!real) errors.push(`<${tag}> has role="${short(role)}", which is not a real role`);
      else {
        if (SAME_ROLE[tag] === real) warnings.push(`<${tag}> has role="${real}", which it already has; take the role away`);
        if ((real === 'presentation' || real === 'none') && reachable(tag, a)) warnings.push(`<${tag}> has role="${real}" but the Tab key still reaches it; the role is ignored there`);
      }
    }

    if (hidden) {
      if (tag === 'body' || tag === 'html') errors.push(`<${tag}> has aria-hidden="true", so a screen reader sees an empty page`);
      else if (reachable(tag, a)) errors.push(`<${tag}> has aria-hidden="true" but the Tab key still reaches it; add tabindex="-1" or take aria-hidden away`);
      else if (!VOID.has(tag) && !/\/\s*$/.test(m[2]) && hasReachableInside(innerOf(h, tag, m.index + m[0].length)))
        warnings.push(`a <${tag}> with aria-hidden="true" holds a link, button or field that the Tab key reaches; add tabindex="-1" to it`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
