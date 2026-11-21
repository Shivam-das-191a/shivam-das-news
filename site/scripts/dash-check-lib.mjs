// Part 8bw (POLISH, Paragraphs and text): the text of a built page has no double hyphen where a dash belongs.
// Text typed fast, pasted from Word or imported from Blogger often has two hyphens for a dash ("He left--then she came", "He left -- then she came", "2020--2021").
// A reader sees each one at once and trusts the site a little less. Pure function, no files, no network.
//   checkDoubleHyphen(html): { errors, warnings }
//   errors:   none (a double hyphen is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found:
//     two hyphens, no more, with a letter or a digit on both sides ("left--then") or with a space on both sides between two words ("left -- then")
// Read on: the title and the body text of every page, in any language. Tags are removed (an inline tag leaves no gap); a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr)
//          and a character reference end the run. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: three or more hyphens (a drawn line); a command option written in a sentence (a space before it and a letter right after it: "run --help"); a hyphen pair at the start or the end of a paragraph; a single hyphen or an en or em dash; marks in code and preformatted text; a pair written as character references.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const GLUED = /(?<=[\p{L}\p{N}])--(?=[\p{L}\p{N}])/gu;
const SPACED = /(?<=[\p{L}\p{N}.,;:!?\u201d\u2019)\]])[ \t\r\n]+--[ \t\r\n]+(?=[\p{L}\p{N}\u201c\u2018(\[])/gu;

export function checkDoubleHyphen(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0')
    .replace(ENTITY, '\u0002');
  const n = (text.match(GLUED) || []).length + (text.match(SPACED) || []).length;
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} two hyphens where a dash belongs (for example "left--then" or "left -- then"); use one dash`);
  return { errors, warnings };
}
