// Part 8g (POLISH, Accessibility: "Forms have labels"): every form field of a built page has a name that a reader and a screen reader can use.
// Pure function, no files, no network.
//   checkFormLabels(html): { errors, warnings }
//   A field is an input, a select or a textarea. It has a name when ANY of these is true:
//     - a label with text points to it (label for="id");
//     - it sits inside a label that has text (the text of a select or a textarea inside the label does not count);
//     - it has a non-empty aria-label;
//     - its aria-labelledby names at least one id that exists on the page.
//   A placeholder or a title alone is NOT a name.
//   Not checked (no visible field): input of type hidden, submit, button, reset and image.
//   errors:   a field with no name
//   warnings: a label with for="x" when no element of the page has the id x
// Comments and the text inside script, style and template are ignored.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const ANY_TAG = /<\/?[a-z][a-z0-9-]*(?="|'|\s|>|\/)(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const NOT_FIELDS = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

const tagRe = (name) => new RegExp(`<${name}(?=[\\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi');

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** The words a label shows: its text, the alt text of a picture, but not the options of a select or the content of a textarea. */
function labelText(inner) {
  return inner
    .replace(/<(select|textarea)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(tagRe('img'), (t) => ' ' + (attr(t, 'alt') || '') + ' ')
    .replace(ANY_TAG, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .trim();
}

function describe(tag) {
  const kind = /^<([a-z]+)/i.exec(tag)[1].toLowerCase();
  const type = attr(tag, 'type');
  const who = (attr(tag, 'name') || '').trim() ? `name "${attr(tag, 'name').trim()}"` : (attr(tag, 'id') || '').trim() ? `id "${attr(tag, 'id').trim()}"` : 'no name or id';
  return kind === 'input' ? `input (type "${(type || 'text').trim().toLowerCase()}", ${who})` : `${kind} (${who})`;
}

export function checkFormLabels(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(COMMENT, '').replace(SKIP, '');

  const ids = new Set();
  for (const t of h.match(/<[a-z][a-z0-9-]*(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []) {
    const id = (attr(t, 'id') || '').trim();
    if (id) ids.add(id);
  }

  const labelled = new Set(); // ids that a label with text points to
  const ranges = []; // labels with text: where they start and end in h
  for (const m of h.matchAll(/<label(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/label\s*>/gi)) {
    const hasText = labelText(m[2]).length > 0;
    const target = (attr('<label' + m[1] + '>', 'for') || '').trim();
    if (target) {
      if (hasText) labelled.add(target);
      if (!ids.has(target)) warnings.push(`a label points to "${target}" but no element of the page has that id`);
    }
    if (hasText) ranges.push([m.index, m.index + m[0].length]);
  }

  for (const m of h.matchAll(/<(input|select|textarea)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const tag = m[0];
    if (m[1].toLowerCase() === 'input' && NOT_FIELDS.has((attr(tag, 'type') || '').trim().toLowerCase())) continue;
    const id = (attr(tag, 'id') || '').trim();
    const named =
      (attr(tag, 'aria-label') || '').trim() !== '' ||
      (attr(tag, 'aria-labelledby') || '').split(/\s+/).some((x) => x && ids.has(x)) ||
      (id !== '' && labelled.has(id)) ||
      ranges.some(([a, b]) => m.index >= a && m.index < b);
    if (!named) errors.push(`the form field ${describe(tag)} has no label (add a label with text, or an aria-label); a placeholder is not a label`);
  }
  return { errors, warnings };
}
