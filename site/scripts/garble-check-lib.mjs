// Part 8bq (POLISH, Paragraphs and text): the text of a built page has no broken characters.
// When a post is imported from Blogger, pasted from Word or saved in the wrong encoding, a curly apostrophe turns into three odd letters, an accented letter into two, and a letter that could not be read into a black diamond with a question mark.
// A reader sees it at once, and Google News and Discover read it as a careless site. Pure function, no files, no network. Every character below is written as a \u escape so this file stays plain ASCII.
//   checkGarbledText(html): { errors, warnings }
//   errors:   none (broken text is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per kind per page that says how many places it found:
//     1. the replacement mark U+FFFD (a letter that was lost); a run of them is one place
//     2. text that was saved in one encoding and read in another (mojibake): a lead letter a-circumflex, A-tilde or A-circumflex followed by a symbol of the Windows-1252 table, such as a curly apostrophe turned into three odd letters or e-acute turned into two
//     3. a hidden control character U+0080 to U+009F (usually left by a bad paste); a run of them is one place
// Read on: the text of the page (the title and the body). Tags are removed, so a tag name, an attribute (alt, title, content) and the meta description are not read. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg> and <noscript> blocks are skipped.
// Left out on purpose, so there is no false alarm: real accented text (an A-tilde in a word, an A-circumflex in a word, an a-circumflex in a word: they are not followed by a Windows-1252 symbol); a non breaking space written as &nbsp; (it is a reference, not the character
//          after an A-circumflex); a lone lead letter; the zero width characters (U+200B to U+200D, U+FEFF); text in other scripts; the case of the tag names.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that was saved by other tools; the build can show the owner which page holds a broken mark before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
// A symbol that the Windows-1252 table puts on a byte from 0x80 to 0xBF (what a UTF-8 second or third byte turns into when it is read as Windows-1252).
const SYM = '[\\u0080-\\u00bf\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e\\u0192\\u02c6\\u02dc\\u2013\\u2014\\u2018-\\u201e\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203a\\u20ac\\u2122]';
const MOJIBAKE = new RegExp(`\\u00e2${SYM}${SYM}|[\\u00c3\\u00c2]${SYM}`, 'g');
const REPLACEMENT = /\ufffd+/g;
const CONTROL = /[\u0080-\u009f]+/g;

export function checkGarbledText(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html.replace(COMMENT, ' ').replace(SKIP, ' ').replace(ANY_TAG, ' ');
  const lost = (text.match(REPLACEMENT) || []).length;
  const mojibake = (text.match(MOJIBAKE) || []).length;
  // A control character that is already part of a mojibake pair is counted there, not twice.
  const control = (text.replace(MOJIBAKE, ' ').match(CONTROL) || []).length;
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (lost) warnings.push(`${has(lost)} a broken character mark (a black diamond with a question mark, U+FFFD): a letter was lost when the text was saved; retype the word`);
  if (mojibake) warnings.push(`${has(mojibake)} text saved in one encoding and read in another (for example a curly apostrophe shown as three odd letters); save the post as UTF-8 and retype the mark`);
  if (control) warnings.push(`${has(control)} a hidden control character (U+0080 to U+009F), usually left by a bad paste; delete it and retype the text around it`);
  return { errors, warnings };
}
