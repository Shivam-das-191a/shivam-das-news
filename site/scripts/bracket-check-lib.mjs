// Part 8bs (POLISH, Paragraphs and text): the text of a built page has no bracket or double quote that is opened and never closed.
// Text typed fast, pasted from Word or imported from Blogger often holds "(see the table below" with no closing bracket, or a quotation that starts with a curly quote and never ends.
// A reader sees the open bracket or quote at once, and it can also swallow the rest of a headline in a share card. Pure function, no files, no network.
//   checkBrackets(html): { errors, warnings }
//   errors:   none (an open bracket is a fault of the words, not a broken page, so the build never stops for it); the key is kept so the result has the same shape as the other checks
//   warnings: one message per kind per page that says how many places it found:
//     1. a round ( ) or square [ ] bracket that is opened and never closed, or closed and never opened, counted per paragraph (a block of text)
//     2. a curly double quote: a closing one with no opening one before it, or an opening one never closed
//     3. a straight double quote that is opened and never closed (an odd number of them on the page)
// Read on: the title and the body text. Tags are removed (an inline tag leaves no gap); a block tag (p, li, div, h1 to h6, td, th, tr, blockquote, figcaption, section, article, header, footer, nav, ul, ol, dl, dt, dd, main, aside, form, button, option, label, table, figure, details, summary, hr)
//          and a block break end a paragraph; a br does not. These references are read as the mark they stand for: &quot;, &ldquo;, &rdquo;, &lpar;, &rpar;, &lsqb;, &rsqb; and their number forms. Comments and <script>, <style>, <template>, <textarea>, <pre>, <code>, <kbd>, <samp>, <svg>, <noscript> and <select> blocks are skipped. Attributes and the meta description are not read.
// Left out on purpose, so there is no false alarm: a smiley (":)", ";(", "(:"); a list marker with a closing bracket only ("1) one 2) two", "a) first", "iv) fourth") when nothing is open; a quotation that runs over several paragraphs
//          (a paragraph that starts with a quote mark while the last quote is still open continues it; the usual way to write it); a straight quote after a digit (5'10", a 12" pizza); a German style quote (low opening mark, curly closing mark); marks in code and preformatted text; the single quote and the apostrophe (they are not read at all).
// Why: BUGS group F (content import) and PLAN 37 (pasted HTML) bring text that no editor has read; the build can show the owner which page holds a slip before the post is published.
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template|textarea|pre|code|kbd|samp|svg|noscript|select)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK = /<\/?(?:p|li|div|h[1-6]|td|th|tr|blockquote|figcaption|section|article|header|footer|nav|ul|ol|dl|dt|dd|main|aside|form|button|option|label|table|thead|tbody|tfoot|caption|figure|details|summary|hr|body|html|head|title|meta|link)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const ANY_TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
const BLANK_REF = /&(?:nbsp|#160|#xa0|#x00a0|ensp|emsp|thinsp);/gi;
const ENTITY = /&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;
const DECODE = [
  [/&(?:quot|#34|#x0*22);/gi, '"'],
  [/&(?:ldquo|#8220|#x0*201c);/gi, '\u201c'],
  [/&(?:rdquo|#8221|#x0*201d);/gi, '\u201d'],
  [/&(?:lpar|#40|#x0*28);/gi, '('],
  [/&(?:rpar|#41|#x0*29);/gi, ')'],
  [/&(?:lsqb|lbrack|#91|#x0*5b);/gi, '['],
  [/&(?:rsqb|rbrack|#93|#x0*5d);/gi, ']'],
];
const BREAK = '\u0001';
const GERMAN = /\u201e[^\u201c\u201d\u201e\u0001]*[\u201c\u201d]/g; // a quote opened low and closed with a curly mark (German style) is a pair
const SMILEY = /[:;=][-o^']?[()[\]]|[()[\]][-o^']?[:;=]/g;
const MARKER = /(?:^|\s)(?:\d{1,3}|[A-Za-z]|[ivxIVX]{1,5})$/;

// true when this block has a bracket that is not matched
function blockHasLooseBracket(block, open, close) {
  const text = block.replace(SMILEY, ' ');
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      if (depth > 0) depth--;
      else if (close === ')' && MARKER.test(text.slice(0, i))) continue; // a list marker such as "1)" with nothing open
      else return true;
    }
  }
  return depth > 0;
}

// curly double quotes over the whole page; a paragraph that starts with an opening quote while one is still open continues it
function curlyProblems(blocks) {
  let depth = 0, bad = 0;
  for (const block of blocks) {
    const start = block.replace(/^\s+/, '');
    let skipFirst = depth > 0 && start.startsWith('\u201c');
    for (const ch of start) {
      if (ch === '\u201c') {
        if (skipFirst) { skipFirst = false; continue; }
        depth++;
      } else if (ch === '\u201d') {
        if (depth > 0) depth--; else bad++;
      }
      skipFirst = false;
    }
  }
  return bad + depth;
}

// straight double quotes over the whole page: 1 when one is left open, else 0
function straightProblems(blocks) {
  let open = false;
  for (const block of blocks) {
    const start = block.replace(/^\s+/, '').replace(/(\d)"/g, '$1');
    let skipFirst = open && start.startsWith('"');
    for (const ch of start) {
      if (ch === '"') {
        if (skipFirst) { skipFirst = false; continue; }
        open = !open;
      }
      skipFirst = false;
    }
  }
  return open ? 1 : 0;
}

export function checkBrackets(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  let text = html
    .replace(COMMENT, ' ')
    .replace(SKIP, ' ')
    .replace(BLOCK, BREAK)
    .replace(ANY_TAG, '')
    .replace(BLANK_REF, ' ');
  for (const [re, mark] of DECODE) text = text.replace(re, mark);
  text = text.replace(ENTITY, ' ').replace(GERMAN, ' ');
  const blocks = text.split(BREAK).filter((b) => b.trim() !== '');
  let brackets = 0;
  for (const b of blocks) if (blockHasLooseBracket(b, '(', ')') || blockHasLooseBracket(b, '[', ']')) brackets++;
  const curly = curlyProblems(blocks);
  const straight = straightProblems(blocks);
  const has = (n) => (n === 1 ? '1 place has' : `${n} places have`);
  if (brackets) warnings.push(`${has(brackets)} a round or square bracket that is opened and never closed, or closed and never opened (for example "(see below"); add the missing bracket`);
  if (curly) warnings.push(`${has(curly)} a curly double quote that is opened and never closed, or closed and never opened; add the missing quote mark`);
  if (straight) warnings.push(`${has(straight)} a straight double quote that is opened and never closed (an odd number of them on the page); add the missing quote mark`);
  return { errors, warnings };
}
