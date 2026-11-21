// Part 8bu (POLISH, Paragraphs and text): the text of an English built page has the right gaps around its curly double quotes.
// Text typed fast, pasted from Word or imported from Blogger often has a quote with a space inside it ("\u201c word \u201d"), a quote glued to the word before it (said\u201cno\u201d) or glued to the word after it (\u201cno\u201dthen).
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkQuoteSpacing(html): { errors, warnings }
//   errors:   none (a gap is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per kind per page that says how many places it found:
//     1. a space just inside a curly double quote: after an opening mark (U+201C) that is followed by a letter or a digit, or before a closing mark (U+201D) that follows a letter, a digit or a mark
//     2. no space before an opening curly double quote that follows a letter
//     3. no space after a closing curly double quote that is followed by a word of 2 or more letters (A to Z)
// Read on: the title and the body text of a page whose lang is English or is not given (any other language writes its quote marks another way, so the page is not read). Tags are removed (an inline tag leaves no gap); a block tag (p, li, div, h1 to h6, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr)
//          ends the run, a br does not, and a blank written as &nbsp; is not a plain space. The references &ldquo;, &rdquo; and their number forms are read as the mark they stand for. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: the straight quote (it is both an opening and a closing mark, so a gap cannot be judged); the single quote and the apostrophe; a German style quote (a low opening mark and a curly closing mark); a gap written as &nbsp;; a quote at the start or end of a paragraph;
//          a quote next to a bracket, a dash or a mark; marks in code and preformatted text; text in other scripts for the third kind (only A to Z are read there).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const DECODE = [
  [/&(?:ldquo|#8220|#x0*201c);/gi, '\u201c'],
  [/&(?:rdquo|#8221|#x0*201d);/gi, '\u201d'],
];
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const GERMAN = /\u201e[^\u201c\u201d\u201e\u0001]*[\u201c\u201d]/g;
const LANG = /<html(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*?\slang\s*=\s*["']?([A-Za-z]{2,3})(?=[-_"'\s>/])/i;
const INSIDE = /\u201c[ \t\r\n]+(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}.,;:!?])[ \t\r\n]+\u201d/gu;
const NO_SPACE_BEFORE = /\p{L}\u201c/gu;
const NO_SPACE_AFTER = /\u201d[A-Za-z]{2,}/g;

export function checkQuoteSpacing(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const lang = html.match(LANG);
  if (lang && lang[1].toLowerCase() !== 'en') return { errors, warnings };
  let text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0');
  for (const [re, mark] of DECODE) text = text.replace(re, mark);
  text = text.replace(ENTITY, '\u0002').replace(GERMAN, ' ');
  const inside = (text.match(INSIDE) || []).length;
  const before = (text.match(NO_SPACE_BEFORE) || []).length;
  const after = (text.match(NO_SPACE_AFTER) || []).length;
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (inside) warnings.push(`${has(inside)} a space just inside a curly double quote (for example "\u201c word" or "word \u201d"); remove the space`);
  if (before) warnings.push(`${has(before)} no space before an opening curly double quote that follows a word (for example "said\u201cno\u201d"); add a space`);
  if (after) warnings.push(`${has(after)} no space after a closing curly double quote that is followed by a word (for example "\u201cno\u201dthen"); add a space`);
  return { errors, warnings };
}
