// Part 8cb (POLISH, Paragraphs and text): a built page does not hold the same paragraph twice in a row.
// A story pasted twice, a block copied by mistake or an import that ran two times leaves a paragraph written again right after itself. A reader sees it at once and trusts the site a little less. The check of doubled words (doubled-check-lib.mjs, Part 8bp) reads one word; this one reads a whole paragraph. Pure function, no files, no network.
//   checkRepeatedParagraphs(html): { errors, warnings }
//   errors:   none (a repeated paragraph is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per page that says how many places it found and shows the first five words of the first one:
//     a <p> whose text is the same as the text of the <p> right before it (the next <p> in the page), when the text has 8 or more words
// Read on: every <p> of the page, in any language. The text of a paragraph is read with its tags removed (an inline tag leaves no gap, a <br> is a space), a blank written as &nbsp; is a plain space, runs of spaces are one space and capital letters are small letters, so two copies that differ only in spacing or capitals count as the same. Three copies in a row are two places.
//          Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a paragraph of 7 words or fewer (a short line such as a button note or a label may be written twice on purpose); two equal paragraphs with any other <p> between them; the same text in a list item, a heading or a table cell; the same paragraph far apart on a page (a footer line may repeat a line of the page); an empty <p>; text in code and preformatted text.
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const PARA = /<p(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>([\s\S]*?)(?=<\/p\s*>|<p[\s>/]|$)/gi;
const BR = /<br(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const MIN_WORDS = 8;

export function checkRepeatedParagraphs(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const clean = html.replace(COMMENT, ' ').replace(SKIP, ' ');
  let n = 0, first = '', before = null;
  for (const m of clean.matchAll(PARA)) {
    const text = m[1]
      .replace(BR, ' ')
      .replace(ANY_TAG, '')
      .replace(BLANK_REF, ' ')
      .replace(/[\s\u00a0]+/g, ' ')
      .trim()
      .toLowerCase();
    const words = text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (words.length >= MIN_WORDS && before === text) {
      n++;
      if (!first) first = words.slice(0, 5).join(' ');
    }
    before = text;
  }
  if (n) warnings.push(`${n === 1 ? '1 place has' : `${n} places have`} a paragraph written twice in a row (first: "${first} ..."); delete one copy`);
  return { errors, warnings };
}
