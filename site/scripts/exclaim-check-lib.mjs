// Part 8by (POLISH, Paragraphs and text): in the body text of a built page an exclamation mark or a question mark is used once, not piled up.
// Text typed fast or pasted from a chat, a forum or a social post often has "Wow!!", "Really???" or "What?!?!". A news reader sees each one at once and takes the site for a rumour page.
// The check of the title and the headings (shout-check-lib.mjs, Part 8bo) already reads those; this one reads the rest of the page. Pure function, no files, no network.
//   checkExclaimRuns(html): { errors, warnings }
//   errors:   none (a pile of marks is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found and shows the first one:
//     a run of 2 or more of the marks ! and ? that is not exactly "?!" or "!?" (so "!!", "??", "!!!", "?!?", "???" and longer runs are read; the one pair "?!" or "!?" is allowed)
// Read on: the body text of every page, in any language. The <title> and the <h1>, <h2> and <h3> blocks are not read here (Part 8bo reads them). Tags are removed (an inline tag leaves no gap, so "Wow!<b>!</b>" is read as "Wow!!");
//          a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr) and a character reference end the run.
//          Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: the single pair "?!" or "!?"; one mark alone; a mark followed by a space and another mark ("Why? ? Because"); a word of the text that holds a web address ("://" or "www.") because a query string may hold marks; marks in code and preformatted text;
//          marks written in the full width form of other scripts.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const HEADINGS = /<(title|h[1-3])(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const RUN = /[!?]{2,}/g;
const ADDRESS = /:\/\/|www\./i;

export function checkExclaimRuns(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(HEADINGS, BREAK)
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, '\u00a0')
    .replace(ENTITY, '\u0002');
  let n = 0, first = '';
  for (const word of text.split(/[ \t\r\n\u00a0\u0001\u0002]+/)) {
    if (!word || ADDRESS.test(word)) continue;
    for (const m of word.matchAll(RUN)) {
      if (m[0] === '?!' || m[0] === '!?') continue;
      n++;
      if (!first) first = m[0];
    }
  }
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} a pile of exclamation or question marks (first: "${first}"); use one mark`);
  return { errors, warnings };
}
