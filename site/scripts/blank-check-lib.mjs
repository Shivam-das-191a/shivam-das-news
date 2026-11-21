// Part 8bn (POLISH, Paragraphs and text): a built page has no empty text box and no gap made by hand with &nbsp;.
// An imported Blogger post and a pasted block often hold <p>&nbsp;</p> or <p></p> as a blank line, an empty list item, or a row of &nbsp; used as an indent.
// A screen reader reads an empty paragraph as a pause or as "blank", Google sees a paragraph with no words, and the spacing cannot be set in CSS. (<p><br></p> is read by break-check-lib.mjs, not here.)
// Pure function, no files, no network.
//   checkBlanks(html): { errors, warnings }
//   errors:   none (an empty box does no harm to the reader, it only wastes space); the key is kept so the result has the same shape as the other checks
//   warnings: an empty paragraph (<p></p>, or a <p> that holds only blank space, &nbsp;, a zero width space or empty <span>, <b>, <i>, <em>, <strong>);
//             an empty list item (<li></li>); an empty quote (<blockquote>) or caption (<figcaption>);
//             two or more &nbsp; in a row in the text, which is an indent or a gap made by hand (use CSS padding or margin)
//   Each kind gives one message per page that says how many places it found.
// Read on: every <p>, <li>, <blockquote> and <figcaption> of the page and the text of the page. Comments are skipped; <script>, <style>, <template>, <textarea>, <pre>, <svg> and <noscript> blocks are skipped
//          for the text, and count as content when they sit inside a box (a box with an svg in it is not empty); the case is not read.
// Left out on purpose, so there is no false alarm: an empty box that has a role, an aria-live, an id or a data- attribute (a place that a script fills later, such as <p role="status"></p>); a box that holds a picture, a video, an iframe, a link, a break, a list or any other tag; one single &nbsp; (a glued number and unit such as 5&nbsp;km);
//          an empty table cell (a table often needs one); an empty heading (heading-order-lib.mjs reads it); an empty <div> or <span> (a layout box).
// Why: Blogger posts (PLAN 32) and pasted HTML (PLAN 37) are full of <p>&nbsp;</p>, and the build can show the owner where it is before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|svg|noscript)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BOX = /<(p|li|blockquote|figcaption)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/\1\s*>/gi;
const FILLED_BY_SCRIPT = /(?:^|\s)(?:role|aria-live|id|data-[\w:.-]+)(?=[\s=/]|$)/i;
const WRAP = /<\/?(?:span|b|i|u|s|em|strong|small|mark|font|sup|sub|strike|big)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const SPACE_CHARS = '\\s\\u00a0\\u200b\\u200c\\u200d\\u2060\\ufeff\\u2002\\u2003\\u2009';
const BLANK_ENT = /&nbsp;|&#0*160;|&#x0*a0;|&#0*8203;|&#x0*200b;|&ensp;|&emsp;|&thinsp;|&zwnj;|&zwj;/gi;
const NBSP = '(?:&nbsp;|&#0*160;|&#x0*a0;|\\u00a0)';
const RUN = new RegExp(`${NBSP}(?:[ \\t\\r\\n]*${NBSP})+`, 'gi');

const isBlank = (inner) => {
  const rest = inner.replace(WRAP, '');
  if (/</.test(rest)) return false;
  return rest.replace(BLANK_ENT, ' ').replace(new RegExp(`[${SPACE_CHARS}]+`, 'g'), '') === '';
};

export function checkBlanks(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const marked = html.replace(COMMENT, '').replace(SKIP, '<skipped></skipped>');
  const count = { p: 0, li: 0, quote: 0, caption: 0, run: 0 };
  const text = marked.replace(BOX, (whole, name, attrs, inner) => {
    if (FILLED_BY_SCRIPT.test(attrs) || !isBlank(inner)) return whole;
    const n = name.toLowerCase();
    if (n === 'p') count.p++;
    else if (n === 'li') count.li++;
    else if (n === 'blockquote') count.quote++;
    else count.caption++;
    return ' ';
  });
  const visible = text.replace(/<skipped><\/skipped>/g, ' ').replace(ANY_TAG, ' ');
  const runs = visible.match(RUN);
  if (runs) count.run = runs.length;
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (count.p) warnings.push(`${has(count.p)} an empty paragraph (<p></p> or only &nbsp; or blank space); it is a blank line made by hand; remove it and use spacing in CSS`);
  if (count.li) warnings.push(`${has(count.li)} an empty list item; it shows as a bullet or number with nothing after it; fill it or remove it`);
  if (count.quote) warnings.push(`${has(count.quote)} an empty quote (<blockquote>); remove it or put the quote in it`);
  if (count.caption) warnings.push(`${has(count.caption)} an empty caption (<figcaption>); write the caption or remove it`);
  if (count.run) warnings.push(`${has(count.run)} two or more &nbsp; in a row; it is an indent or a gap made by hand; remove it and use padding or margin in CSS`);
  return { errors, warnings };
}
