// Part 8bt (POLISH, Paragraphs and text): the text of a built page has the right gaps around its brackets.
// Text typed fast, pasted from Word or imported from Blogger often has "( see below )" with a space inside, "said(see below)" with no space before, or "(see below)then" with no space after.
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkBracketSpacing(html): { errors, warnings }
//   errors:   none (a gap is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per kind per page that says how many places it found:
//     1. a space just inside a bracket: after an opening ( or [ that is followed by a letter or a digit, or before a closing ) or ] that follows a letter or a digit
//     2. no space before an opening round bracket that follows a word of 3 or more letters and starts a word of 3 or more letters ("said(see")
//     3. no space after a closing round bracket that holds 3 or more characters and is followed by a word of 2 or more letters ("(see below)then")
// Read on: the title and the body text. Tags are removed (an inline tag leaves no gap, so "(<b>word</b>)" is read as "(word)"); a block tag (p, li, div, h1 to h6, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr)
//          ends the run, a br does not, and a blank written as &nbsp; is not a plain space. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a smiley (":( sad", "ok :) bye"); a plural written "word(s)" or "ticket(es)" and a bracket that holds 1 or 2 characters; a function or a number next to a bracket ("f(x)", "Title(2020)"); a space inside a bracket before a mark ("( ... )");
//          a gap written as &nbsp; (French style); the text of an address or a file name ("Rome_(city)"); marks in code and preformatted text; text in other scripts for the second and third kind (only A to Z are read there).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const DECODE = [
  [/&(?:lpar|#40|#x0*28);/gi, '('],
  [/&(?:rpar|#41|#x0*29);/gi, ')'],
  [/&(?:lsqb|lbrack|#91|#x0*5b);/gi, '['],
  [/&(?:rsqb|rbrack|#93|#x0*5d);/gi, ']'],
];
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const SMILEY = /[:;=][-o^']?[()[\]]|[()[\]][-o^']?[:;=]/g;
const INSIDE = /[([][ \t\r\n]+(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])[ \t\r\n]+[)\]]/gu;
const NO_SPACE_BEFORE = /(?<![\w./_-])[A-Za-z]{3,}\([A-Za-z]{3,}/g;
const NO_SPACE_AFTER = /\([^()\u0001]{3,}\)[A-Za-z]{2,}/g;

export function checkBracketSpacing(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  let text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0');
  for (const [re, mark] of DECODE) text = text.replace(re, mark);
  text = text.replace(ENTITY, '\u0002');
  const inside = (text.replace(SMILEY, '  ').match(INSIDE) || []).length;
  const before = (text.match(NO_SPACE_BEFORE) || []).length;
  const after = (text.match(NO_SPACE_AFTER) || []).length;
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (inside) warnings.push(`${has(inside)} a space just inside a bracket (for example "( word" or "word )"); remove the space`);
  if (before) warnings.push(`${has(before)} no space before an opening bracket that follows a word (for example "said(see below)"); add a space`);
  if (after) warnings.push(`${has(after)} no space after a closing bracket that is followed by a word (for example "(see below)then"); add a space`);
  return { errors, warnings };
}
