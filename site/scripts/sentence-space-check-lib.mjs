// Part 8bv (POLISH, Paragraphs and text): in the text of a built page a sentence ends with a space after its full stop, question mark or exclamation mark.
// Text typed fast, pasted from Word or imported from Blogger often has two sentences glued together ("He left.Then she came", "Why?Because it rained"), or a line break that the import dropped.
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkSentenceSpacing(html): { errors, warnings }
//   errors:   none (a missing space is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found:
//     no space after a full stop, question mark or exclamation mark that ends a word of 2 or more letters (A to Z) and is followed at once by a word that starts with a capital letter and has 2 or more small letters after it (A to Z)
// Read on: the title and the body text of every page, in any language (only the letters A to Z are read, so text in another script is never flagged). Tags are removed (an inline tag leaves no gap, so "left.<b>Then</b>" is read as "left.Then");
//          a block tag (p, li, div, h1 to h6, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr, br) and a character reference end the run,
//          and a blank written as &nbsp; is not a plain space. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a full stop after a short form of a title or a name (Mr, Mrs, Ms, Dr, St, Jr, Sr, Prof, Mt, Ft, Gen, Sen, Rep, Gov, Rev, Hon, Lt, Col, Sgt, Capt, Inc, Ltd, Co, Corp, Dept, vs, no, est, approx, fig, vol, al; the case does not matter);
//          an address that starts with www and an e-mail address (the word before the mark follows a dot, a slash, an at sign or an underscore, or is www; real addresses and file names are written in small letters, so they never reach a capital);
//          an ellipsis (a mark that follows another mark); a letter alone (U.S.Army); a number; a mark followed by a space, a quote, a bracket or a character reference; a word after the mark with only one small letter (Node.Js); marks in code and preformatted text.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const GLUED = /(?<![\p{L}\p{N}'\u2019.@/_])([A-Za-z]{2,})([.?!])[A-Z][a-z]{2,}/gu;
const SHORT_FORMS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'prof', 'mt', 'ft', 'gen', 'sen', 'rep', 'gov', 'rev', 'hon', 'lt', 'col', 'sgt', 'capt', 'inc', 'ltd', 'co', 'corp', 'dept', 'vs', 'no', 'est', 'approx', 'fig', 'vol', 'al', 'www']);

export function checkSentenceSpacing(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0')
    .replace(ENTITY, '\u0002');
  let n = 0;
  for (const m of text.matchAll(GLUED)) if (!(SHORT_FORMS.has(m[1].toLowerCase()) && (m[2] === '.' || m[1].toLowerCase() === 'www'))) n++;
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} no space after the full stop, question mark or exclamation mark that ends a sentence (for example "left.Then"); add a space`);
  return { errors, warnings };
}
