// Part 8bz (POLISH, Paragraphs and text): in the text of a built page no word is typed with the Caps Lock key on by mistake.
// Text typed fast shows the slip "hELLO" or "cAPS" (the first letter small, all the other letters capital) when the Caps Lock key was on and the Shift key was held for the first letter.
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkCapsLockSlips(html): { errors, warnings }
//   errors:   none (a typing slip is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found and shows the first one:
//     a word of 5 or more letters (A to Z) whose first letter is small and whose other letters are all capital ("hELLO", "cAPSLOCK")
// Read on: the title and the body text of every page, in any language (only the letters A to Z are read, so text in another script is never flagged). Tags are removed (an inline tag leaves no gap, so "h<b>ELLO</b>" is read as "hELLO");
//          a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr) and a character reference end the run.
//          Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a word of 4 letters or fewer ("mRNA", "iOS"); a word with a small letter after the capitals ("iPhone", "eBay", "macOS");
//          a word that follows a letter, a digit, an underscore, a dot, a slash, an at sign, a hash sign, a colon or a hyphen (an address, a handle, a hashtag, a file name or a joined word); a word that is followed by a letter, a digit or an underscore; marks in code and preformatted text.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const SLIP = /(?<![\p{L}\p{N}_./@#:-])[a-z][A-Z]{4,}(?![\p{L}\p{N}_])/gu;

export function checkCapsLockSlips(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0')
    .replace(ENTITY, '\u0002');
  let n = 0, first = '';
  for (const m of text.matchAll(SLIP)) {
    n++;
    if (!first) first = m[0];
  }
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} a word typed with Caps Lock on by mistake (first: "${first}"); retype it`);
  return { errors, warnings };
}
