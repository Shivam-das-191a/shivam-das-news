// Part 8bm (POLISH, Paragraphs and text): the line breaks (<br>) of a built page are used for a line break and for nothing else.
// An imported Blogger post and a pasted block often hold <br><br> in place of a new paragraph, an empty <p><br></p> as a blank line, or a <br> next to a block tag. The page then has no real paragraph for a screen reader
// or for Google to read, the spacing cannot be changed in CSS, and a <br> inside a list or a table is moved by the browser to a place the writer did not mean. A stray </br> is read by every browser as one more line break.
// Pure function, no files, no network.
//   checkBreaks(html): { errors, warnings }
//   errors:   a stray end tag </br> (a browser reads it as a new <br>, so the page has a line break nobody wrote)
//   warnings: two or more <br> in a row (close the paragraph and open a new <p>); a paragraph or box that holds only a <br> (<p><br></p>); a <br> right after the opening or right before the closing tag of a
//             paragraph, list item, cell, box or heading; a <br> next to a block tag (</p><br>, <br><div>); a <br> directly inside a list, a table or a select (it is not allowed there);
//             an end tag of another empty element (</img>, </input>, </hr>, </meta>, </link>, ...), which the browser ignores
//   Each kind gives one message per page that says how many places it found.
// Read on: every <br>, <br/> and </br> of the page and the tags next to it. Comments and <script>, <style>, <template>, <textarea>, <pre> and <svg> blocks are skipped; the case is not read; blank space between two tags is ignored.
// Left out on purpose, so there is no false alarm: one <br> between two pieces of text (an address, a poem line); one <br> before or after an inline tag (<b>, <a>, <span>); <br> in a <pre>; the number of <br> on a page.
// Why: Blogger posts (PLAN 32) and pasted HTML (PLAN 37) are full of <br><br>, and the build can show the owner where it is before the post is published.
const SKIP = /<!--[\s\S]*?-->|<(script|style|template|textarea|pre|svg)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TOKEN = /<(\/?)([a-zA-Z][^\s>/]*)(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+|</g;
const LEAD = new Set(['p', 'li', 'td', 'th', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figcaption', 'dd', 'dt', 'summary']);
const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'section', 'article', 'figure', 'aside', 'header', 'footer', 'main', 'nav', 'hr', 'form', 'dl', 'details', 'fieldset']);
const CONTAINER_OPEN = new Set(['ul', 'ol', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'select', 'dl', 'colgroup']);
const CONTAINER_CLOSE = new Set(['li', 'tr', 'td', 'th', 'dt', 'dd', 'option', 'optgroup', 'tbody', 'thead', 'tfoot', 'caption', 'colgroup']);
const VOID = new Set(['img', 'input', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track']);

export function checkBreaks(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const toks = [];
  for (const m of html.replace(SKIP, ' ').matchAll(TOKEN)) {
    if (m[2] === undefined) { if (m[0].trim() !== '') toks.push({ kind: 'text' }); continue; }
    toks.push({ kind: m[1] ? 'close' : 'open', name: m[2].toLowerCase() });
  }
  const count = { stray: 0, run: 0, only: 0, lead: 0, trail: 0, block: 0, inside: 0 };
  const voidEnds = new Map();
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === 'close' && t.name === 'br') { count.stray++; continue; }
    if (t.kind === 'close' && VOID.has(t.name)) { voidEnds.set(t.name, (voidEnds.get(t.name) || 0) + 1); continue; }
    if (t.kind !== 'open' || t.name !== 'br') continue;
    let j = i;
    while (j + 1 < toks.length && toks[j + 1].kind === 'open' && toks[j + 1].name === 'br') j++;
    const len = j - i + 1, prev = toks[i - 1], next = toks[j + 1];
    i = j;
    const prevOpen = prev && prev.kind === 'open' ? prev.name : null, prevClose = prev && prev.kind === 'close' ? prev.name : null;
    const nextOpen = next && next.kind === 'open' ? next.name : null, nextClose = next && next.kind === 'close' ? next.name : null;
    if ((prevOpen && CONTAINER_OPEN.has(prevOpen)) || (prevClose && CONTAINER_CLOSE.has(prevClose))) count.inside++;
    else if ((prevOpen === 'p' || prevOpen === 'div') && nextClose === prevOpen) count.only++;
    else if (len >= 2) count.run++;
    else if (prevOpen && LEAD.has(prevOpen)) count.lead++;
    else if (nextClose && LEAD.has(nextClose)) count.trail++;
    else if ((prevClose && BLOCK.has(prevClose)) || (prevOpen === 'hr') || (nextOpen && BLOCK.has(nextOpen))) count.block++;
  }
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (count.stray) errors.push(`${has(count.stray)} a stray </br>; a browser reads it as one more line break; remove it or write <br>`);
  if (count.run) warnings.push(`${has(count.run)} two or more line breaks (<br>) in a row; close the paragraph and open a new <p> so the text has real paragraphs`);
  if (count.only) warnings.push(`${has(count.only)} a paragraph or box that holds only a line break (<p><br></p>); it is a blank line made by hand; remove it and use spacing in CSS`);
  if (count.lead) warnings.push(`${has(count.lead)} a line break right after the opening tag of a paragraph, list item, cell, box or heading; it adds a blank first line`);
  if (count.trail) warnings.push(`${has(count.trail)} a line break right before the closing tag of a paragraph, list item, cell, box or heading; it adds nothing; remove it`);
  if (count.block) warnings.push(`${has(count.block)} a line break next to a block tag (a paragraph, box, heading, list or table); it adds nothing or a blank line made by hand; remove it and use spacing in CSS`);
  if (count.inside) warnings.push(`${has(count.inside)} a line break directly inside a list, a table or a select, where it is not allowed; the browser moves it out; put it inside a list item or a cell, or remove it`);
  for (const [name, n] of voidEnds) warnings.push(`${has(n)} an end tag </${name}>; <${name}> has no end tag and the browser ignores it; remove it`);
  return { errors, warnings };
}
