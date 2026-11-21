// Part 8o (POLISH, Accessibility and Mobile): the landmarks of every built page sit in the right places, and a story page has its article.
// Pure function, no files, no network. page-basics-lib.mjs already checks that there is one main, a header and a footer; this adds where things sit.
//   checkLandmarks(html, type): { errors, warnings }   (type is the value of data-page-type on the body, or undefined)
//   errors:   the h1 is not inside main; a main inside a header, footer, nav, aside or article;
//             an article page (type "article") with no article element, with more than one, with the h1 outside it, or with the article outside main
//   warnings: an aside with no label (aria-label or aria-labelledby)
// Left out on purpose, so there is no false alarm: text inside script, style, template and comments; pages that are not of type "article" are not asked for an article
// element; pages with no h1 or no main (the h1 count and page-basics-lib.mjs report those already, so they are not reported twice).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<(\/?)(main|header|footer|nav|aside|article|h1)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function checkLandmarks(html, type) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  const stack = [];
  let articles = 0, h1Outside = 0, h1InArticle = 0, h1Total = 0, articleOutsideMain = 0;
  let mainBad = 0;
  for (const m of h.matchAll(TAGS)) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at !== -1) stack.length = at;
      continue;
    }
    if (name === 'h1') {
      h1Total++;
      if (!stack.includes('main')) h1Outside++;
      if (stack.includes('article')) h1InArticle++;
      continue;
    }
    if (name === 'main' && stack.some((s) => ['header', 'footer', 'nav', 'aside', 'article'].includes(s))) mainBad++;
    if (name === 'article') {
      articles++;
      if (!stack.includes('main')) articleOutsideMain++;
    }
    if (name === 'aside' && !(attr(m[3], 'aria-label') || '').trim() && !(attr(m[3], 'aria-labelledby') || '').trim())
      warnings.push('an aside has no aria-label, so a screen reader cannot tell what it holds');
    stack.push(name);
  }
  if (h1Outside > 0 && h1Total > 0 && /<main(?=[\s>/])/i.test(h)) errors.push('the h1 is outside the main landmark, so the skip link would jump past the title');
  if (mainBad > 0) errors.push('the main landmark sits inside a header, footer, nav, aside or article');
  if (type === 'article') {
    if (articles === 0) errors.push('a story page has no article element');
    else if (articles > 1) errors.push(`a story page must have one article element, found ${articles}`);
    else {
      if (articleOutsideMain > 0) errors.push('the article element of a story page is outside the main landmark');
      if (h1Total > 0 && h1InArticle === 0) errors.push('the h1 of a story page is outside its article element');
    }
  }
  return { errors, warnings: [...new Set(warnings)] };
}
