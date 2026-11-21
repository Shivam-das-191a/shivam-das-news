// Part 8bp (POLISH, Paragraphs and text): the text of a built page does not repeat a word twice in a row ("the the", "and and").
// A doubled word is the most common typing slip in a news story, and a reader sees it at once and trusts the site a little less. A post pasted from Blogger or typed fast often has one.
// Pure function, no files, no network.
//   checkDoubledWords(html): { errors, warnings }
//   errors:   none (a doubled word is a slip of the pen, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places repeat a word and shows the first one, for example: 2 places repeat the same word twice in a row (first: "the the"); read the text and remove the extra word
// Read on: the text of the <body> only. Tags are removed; a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, select, option, label, table, figure, details, summary, hr)
//          and a character reference (except a blank, &nbsp;) end the run, so two neighbouring menu items or a word on each side of a dash never count as a pair. Comments and <head>, <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped.
//          The case is not read ("The the" counts). Only words of 3 or more letters (A to Z) count.
// Left out on purpose, so there is no false alarm: "had had" and "that that" (both are real English); a first word with a mark glued to its end, such as "the, the" or "no. No" (a comma or a full stop is a real break; a mark after the second word, as in "the the.", is read); a word of 1 or 2 letters ("is is" is rare and "to to" is a list of letters, not a slip);
//          a word with digits or other marks inside it; three or more of the same word in a row are one place, not two; a heading and the paragraph under it (a block tag ends the run); code, preformatted text and other scripts (no Latin letters, nothing to read).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(head|script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|title)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const ALLOWED_PAIRS = new Set(['had', 'that']);

export function checkDoubledWords(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, ` ${BREAK} `)
    .replace(ANY_TAG, ' ')
    .replace(BLANK_REF, ' ')
    .replace(ENTITY, ` ${BREAK} `);
  const tokens = text.split(/\s+/).filter(Boolean);
  let places = 0, first = '', run = false;
  for (let i = 1; i < tokens.length; i++) {
    const a = tokens[i - 1].replace(/^[("'\u201c\u2018]+/, '');
    const b = tokens[i].replace(/[)"'\u201d\u2019.,;:!?]+$/, '');
    if (/^[A-Za-z]{3,}$/.test(a) && a.toLowerCase() === b.toLowerCase() && !ALLOWED_PAIRS.has(a.toLowerCase())) {
      if (!run) {
        places++;
        if (!first) first = `${a} ${b}`;
      }
      run = true;
    } else {
      run = false;
    }
  }
  if (places) {
    const n = places === 1 ? '1 place repeats' : `${places} places repeat`;
    warnings.push(`${n} the same word twice in a row (first: "${first}"); read the text and remove the extra word`);
  }
  return { errors, warnings };
}
