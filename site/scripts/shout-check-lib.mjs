// Part 8bo (POLISH, Paragraphs and text): the title and the headings of a built page do not shout.
// A news site is judged by its headlines. A title or heading written in ALL CAPITAL LETTERS, or with !!! and ??? marks, reads as clickbait to a reader and to Google News and Discover,
// and Google often rewrites such a title in the search result. A post imported from Blogger or pasted by hand often has one.
// Pure function, no files, no network.
//   checkShouting(html): { errors, warnings }
//   errors:   none (a shouting headline is bad style, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: a <title> or a heading (<h1>, <h2>, <h3>) with 12 or more letters and no small letter at all; a <title> or heading with !! or ?? or three or more ! and ? marks in a row
//   Each kind gives one message per page that says how many places it found.
// Read on: the text of every <title>, <h1>, <h2> and <h3> of the page (tags inside the heading are removed, a character reference is read as a blank). Comments and <script>, <style>, <template>, <textarea>, <pre>, <svg> and <noscript> blocks are skipped
//          (so the <title> inside an svg is not read); the case of the tag names is not read; only the letters A to Z count.
// Left out on purpose, so there is no false alarm: a short heading in capitals (FAQ, NASA, FBI RAID: under 12 letters); a heading with one small letter or more; one single ! or ? mark and a ?! pair; a heading with no Latin letters
//          (other scripts have no capitals); the text of a paragraph, a link or a button; the meta description.
// Why: Blogger posts (PLAN 32) and pasted HTML (PLAN 37) are full of old headlines in capitals, and the build can show the owner which page holds one before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|svg|noscript)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const HEAD = /<(title|h1|h2|h3)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>([\s\S]*?)<\/\1\s*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const MARKS = /!{2,}|\?{2,}|[!?]{3,}/;

export function checkShouting(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const marked = html.replace(COMMENT, '').replace(SKIP, ' ');
  let caps = 0, marks = 0;
  for (const m of marked.matchAll(HEAD)) {
    const text = m[2].replace(ANY_TAG, ' ').replace(ENTITY, ' ').replace(/\s+/g, ' ').trim();
    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 12 && !/[a-z]/.test(text)) caps++;
    if (MARKS.test(text)) marks++;
  }
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (caps) warnings.push(`${has(caps)} a title or heading in all capital letters; it reads as shouting and Google may rewrite it; write it in normal case and let CSS do any capital style`);
  if (marks) warnings.push(`${has(marks)} repeated ! or ? marks in a title or heading (!!, ??, ?!?); one mark is enough`);
  return { errors, warnings };
}
