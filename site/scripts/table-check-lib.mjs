// Part 8u (POLISH, Accessibility): every data table of a built page can be read by a screen reader.
// Pure function, no files, no network.
//   checkTables(html): { errors, warnings }
//   errors:   a th or td with a scope that is not col, row, colgroup or rowgroup; a table marked role="presentation" or role="none" that still holds a th (the two say opposite things)
//   warnings: a data table with no th (no header cells); a data table with no caption and no aria-label, aria-labelledby or title; a th with no text, no aria-label and no picture alt
// Left out on purpose, so there is no false alarm: a table marked role="presentation" or role="none" (a layout table needs no header and no caption); a hidden table (hidden, aria-hidden="true");
// a th that holds only a picture with alt text, an aria-label or an svg title; tables made by a script; text inside script, style, template and comments.
// Why: a screen reader tells the reader which column and row a cell belongs to only from th cells; a post written by the owner can bring a table (PLAN 37 allows tables).
// A table inside a table is read as part of the outer one (the first </table> ends the outer table); the site does not allow nested tables in a post.
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TABLE = /<table(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/table\s*>/gi;
const CELL = /<(th|td)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)(?=<\/\1\s*>|<(?:th|td|tr)[\s>/]|<\/(?:tr|thead|tbody|tfoot|table)\s*>|$)/gi;
const SCOPES = new Set(['col', 'row', 'colgroup', 'rowgroup']);

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const has = (text, name) => new RegExp(`\\s${name}(?=[\\s=>/]|$)`, 'i').test(text);
const textOf = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
const named = (inner) => /<img\b[^>]*\salt\s*=\s*(?:"[^"]+"|'[^']+')/i.test(inner) || /<svg\b[\s\S]*?<title[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(inner) || /\saria-label\s*=\s*(?:"[^"]+"|'[^']+')/i.test(inner);

export function checkTables(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TABLE)) {
    const a = ' ' + m[1].trim();
    const body = m[2];
    if (has(a, 'hidden') && attr(a, 'hidden') !== 'false') continue;
    if ((attr(a, 'aria-hidden') || '').trim().toLowerCase() === 'true') continue;
    const role = (attr(a, 'role') || '').trim().toLowerCase();
    const cells = [...body.matchAll(CELL)];
    const ths = cells.filter((c) => c[1].toLowerCase() === 'th');
    for (const c of cells) {
      const scope = attr(' ' + c[2].trim(), 'scope');
      if (scope !== null && !SCOPES.has(scope.trim().toLowerCase())) errors.push(`a <${c[1].toLowerCase()}> has scope="${scope.trim()}"; scope is col, row, colgroup or rowgroup`);
    }
    if (role === 'presentation' || role === 'none') {
      if (ths.length) errors.push('a table is marked role="' + role + '" but holds a th; a layout table has no header cells (remove the role or the th)');
      continue;
    }
    if (!ths.length) warnings.push('a table has no th (header cells); a screen reader cannot tell which column a cell belongs to');
    const cap = /<caption(?=[\s>/])[^>]*>([\s\S]*?)<\/caption\s*>/i.exec(body);
    const label = (attr(a, 'aria-label') || '').trim() || (attr(a, 'aria-labelledby') || '').trim() || (attr(a, 'title') || '').trim();
    if (!(cap && textOf(cap[1])) && !label) warnings.push('a table has no caption (and no aria-label, aria-labelledby or title); say what the table shows');
    for (const t of ths) {
      const inner = t[3];
      if (!textOf(inner) && !named(inner) && !named(' ' + t[2])) warnings.push('a th has no text; give it text or an aria-label (an empty corner cell reads as "blank")');
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
