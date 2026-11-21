// Part 8br (POLISH, Paragraphs and text): the text of a built page has no slips in its punctuation.
// Text typed fast, pasted from Word or imported from Blogger often has a space before a comma ("the vote , which"), two commas in a row, two dots instead of three, or no space after a comma ("said,then").
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkPunctuation(html): { errors, warnings }
//   errors:   none (a punctuation slip is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per kind per page that says how many places it found:
//     1. a space before a comma, full stop, semicolon, colon, ! or ? that follows a letter, a digit, a closing bracket or a closing quote and is followed by a space or the end of the text
//     2. repeated punctuation: two or more commas, semicolons or colons in a row, exactly two dots, or four or more dots
//     3. no space after a comma or semicolon that sits between two words of 2 or more letters (A to Z)
// Read on: the title and the body text. Tags are removed (an inline tag leaves no gap, so "<b>word</b>," is read as "word,"); a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr)
//          and a character reference end the run, and a blank written as &nbsp; is not a plain space. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: an ellipsis of exactly three dots, with or without spaces ("wait ... what", "wait. . ."); a space before a mark in French style written with &nbsp;; a number with a comma ("1,000", "3,5"); a time ("5:30"); a web address or a file name ("example.com", "e.g.", "U.S.");
//          a comma between a word and a digit or a word of one letter ("a,b"); a mark that is followed by another mark (":)", "?!", ".)"); marks in code and preformatted text; text in other scripts for the third kind (only A to Z are read there).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const SPACE_BEFORE = /[\p{L}\p{N})\]"\u201d\u2019'][ \t\r\n]+[,.;:!?](?=[ \t\r\n\u0001]|$)/gu;
const REPEATED = /,{2,}|;{2,}|:{2,}|(?<!\.)\.\.(?!\.)|\.{4,}/g;
const NO_SPACE = /[A-Za-z]{2,}[,;][A-Za-z]{2,}/g;

export function checkPunctuation(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, ` ${BREAK} `)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0')
    .replace(ENTITY, BREAK);
  const before = (text.match(SPACE_BEFORE) || []).length;
  const repeated = (text.match(REPEATED) || []).length;
  const missing = (text.match(NO_SPACE) || []).length;
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (before) warnings.push(`${has(before)} a space before a comma, full stop, semicolon, colon, ! or ? (for example "word ,"); remove the space`);
  if (repeated) warnings.push(`${has(repeated)} repeated punctuation (two commas in a row, two dots, or four or more dots); keep one mark, or exactly three dots for an ellipsis`);
  if (missing) warnings.push(`${has(missing)} no space after a comma or semicolon (for example "word,word"); add a space`);
  return { errors, warnings };
}
