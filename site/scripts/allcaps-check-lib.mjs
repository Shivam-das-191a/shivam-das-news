// Part 8ca (POLISH, Paragraphs and text): the body text of a built page has no long run of words in capital letters.
// Text pasted from a chat, an old notice or a social post is sometimes typed in capitals for a whole sentence ("BREAKING NEWS THE CITY COUNCIL HAS VOTED TO CLOSE THE OLD BRIDGE TODAY").
// A reader takes it for shouting and trusts the site a little less. The check of the title and the headings (shout-check-lib.mjs, Part 8bo) already reads those; this one reads the rest of the page. Pure function, no files, no network.
//   checkAllCapsRuns(html): { errors, warnings }
//   errors:   none (a run of capitals is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found and shows the first four words of the first one:
//     10 or more words in a row that are written in capital letters (A to Z), where at least 8 of them have 2 or more letters; the words "A" and "I" may sit inside the run
// Read on: the body text of every page. The <title> and the <h1>, <h2> and <h3> blocks are not read here (Part 8bo reads them). Tags are removed (an inline tag leaves no gap, so "TO<b>DAY</b>" is read as one word);
//          a block tag (p, li, div, h1 to h6, br, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr) ends a run,
//          and so does a character reference. Marks round a word (a full stop, a comma, a quote, a bracket) are not part of the word. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped.
//          Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a run of 9 words or fewer (a name such as "UNITED STATES OF AMERICA", a short list of short forms); a run that is mostly one letter words; a word with a digit, a small letter, an apostrophe, a hyphen or a dot inside ("U.S.", "COVID-19", "DON'T") which ends the run;
//          text in code and preformatted text; text in another script (only the letters A to Z are read).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const HEADINGS = /<(title|h[1-3])(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|br|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const BREAK = '\u0001';
const EDGE = /^[\s"'()[\]{}.,;:!?\u2018\u2019\u201c\u201d\u2013\u2014-]+|[\s"'()[\]{}.,;:!?\u2018\u2019\u201c\u201d\u2013\u2014-]+$/g;
const CAPS = /^[A-Z]{2,}$/;
const MIN_RUN = 10;
const MIN_LONG = 8;

export function checkAllCapsRuns(html) {
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
  const close = (run) => {
    if (run.length >= MIN_RUN && run.filter((w) => w.length >= 2).length >= MIN_LONG) {
      n++;
      if (!first) first = run.slice(0, 4).join(' ');
    }
  };
  for (const block of text.split(/[\u0001\u0002]/)) {
    let run = [];
    for (const raw of block.split(/[ \t\r\n\u00a0]+/)) {
      if (!raw) continue;
      const w = raw.replace(EDGE, '');
      if (CAPS.test(w) || w === 'A' || w === 'I') run.push(w);
      else { close(run); run = []; }
    }
    close(run);
  }
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} a run of 10 or more words in capital letters (first: "${first} ..."); write it in normal letters`);
  return { errors, warnings };
}
