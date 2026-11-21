// Part 8bi (POLISH, Structure): the html, head and body of a built page stand once, in order, and the head holds only what a head may hold.
// A tag that does not belong in the head (a div, a picture, a link, text) ends the head early. Every head tag after it (the canonical link, the share tags, the structured data) then lands in the body
// and search engines and share buttons may not read it. A second <html>, <head> or <body> (often a whole page pasted into a post) is ignored by the browser. The browser shows no message either way,
// and nothing else read the skeleton of the page.
// Pure function, no files, no network.
//   checkStructure(html): { errors, warnings }
//   errors:   a second <html>, <head> or <body>; a <head> after the <body> starts; a tag in the head that a head may not hold (it ends the head); text in the head; a canonical link in the body;
//             a <title> in the body when the head has none
//   warnings: a second <title> in the body; a <meta> with name, property, http-equiv or charset in the body; content after </body> or after </html>; a page with no <head> or no <body> tag
// Read on: the whole page in order. Comments, <script>, <style>, <template>, <noscript> (own check: noscript-check-lib.mjs) and <textarea> blocks are skipped; everything inside an <svg> or <math>
//   is skipped (an svg <title> is right); the case of names is not read.
// Left out on purpose, so there is no false alarm: a <meta itemprop> in the body (microdata); a <link> other than canonical in the body; a page with a blank text; the tags of a page with no <head> tag
//   when they are head tags (the browser makes the head by itself).
const TOKEN = /<!--[\s\S]*?-->|<(script|style|template|noscript|textarea|title)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const HEAD_OK = new Set(['title', 'meta', 'link', 'style', 'script', 'noscript', 'base', 'template', 'basefont', 'bgsound', 'noframes']);
const attrOf = (attrs, name) => {
  const m = new RegExp(`(?:^|[\\s/"'])${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=[\\s/>]|$)`, 'i').exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};

export function checkStructure(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  if (html.trim() === '') return { errors, warnings };
  const count = { html: 0, head: 0, body: 0 };
  let phase = 'before'; // before, head, afterHead, body
  let svgDepth = 0, headTitle = false, bodyTitles = 0, bodyEnded = false, htmlEnded = false;
  let after = false; // a "content after" warning is already given
  let last = 0;
  const bodyMeta = new Set();
  const endHead = (why) => { errors.push(`${why}; the head ends there and every head tag after it (canonical link, share tags, structured data) lands in the body`); phase = 'body'; };
  const lateContent = () => {
    if (after) return;
    if (htmlEnded) { warnings.push('content stands after </html>; the browser moves it into the body'); after = true; }
    else if (bodyEnded) { warnings.push('content stands after </body>; the browser moves it back into the body'); after = true; }
  };
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(html)) !== null) {
    const gap = html.slice(last, m.index);
    last = m.index + m[0].length;
    const text = svgDepth === 0 && gap.replace(/&nbsp;/g, '').trim() !== '';
    if (text) {
      if (phase === 'head') endHead('text stands in the head');
      else if (phase === 'body') lateContent();
    }
    if (m[0].startsWith('<!--')) continue;
    const block = m[1] ? m[1].toLowerCase() : '';
    const closing = m[3] === '/';
    const name = block || m[4].toLowerCase();
    const attrs = block ? (m[2] || '') : (m[5] || '');
    if (svgDepth > 0) {
      if (!block && name === 'svg' || name === 'math') {
        if (closing) svgDepth--;
        else if (!/\/\s*$/.test(attrs)) svgDepth++;
      }
      continue;
    }
    if (closing) {
      if (name === 'head') phase = 'afterHead';
      else if (name === 'body') { bodyEnded = true; }
      else if (name === 'html') { htmlEnded = true; }
      else if (phase === 'body') lateContent();
      continue;
    }
    if (name === 'html') {
      count.html++;
      if (count.html > 1) errors.push('the page has a second <html> tag; the browser ignores it (a whole page pasted into another one?)');
      continue;
    }
    if (name === 'head') {
      count.head++;
      if (count.head > 1) errors.push('the page has a second <head> tag; the browser ignores it (a whole page pasted into another one?)');
      else if (phase === 'body') errors.push('a <head> tag stands after the <body> starts; the browser ignores it and its tags land in the body');
      else phase = 'head';
      continue;
    }
    if (name === 'body') {
      count.body++;
      if (count.body > 1) errors.push('the page has a second <body> tag; the browser ignores it (a whole page pasted into another one?)');
      else phase = 'body';
      continue;
    }
    if (phase === 'before') phase = HEAD_OK.has(name) ? 'head' : 'body';
    if (phase === 'head') {
      if (!HEAD_OK.has(name)) endHead(`a <${name}> tag stands in the head, where only title, meta, link, style, script, noscript, base and template may stand`);
      else if (name === 'title') headTitle = true;
    } else if (phase === 'afterHead') {
      if (!HEAD_OK.has(name)) phase = 'body';
    }
    if (phase === 'body' || phase === 'afterHead') {
      if (bodyEnded || htmlEnded) lateContent();
    }
    if (name === 'svg' || name === 'math') {
      if (!/\/\s*$/.test(attrs)) svgDepth++;
      continue;
    }
    if (phase !== 'body') continue;
    if (name === 'title') bodyTitles++;
    else if (name === 'link' && /(^|\s)canonical(\s|$)/i.test(attrOf(attrs, 'rel') || '')) errors.push('a canonical link stands in the body; it belongs in the head, where search engines read it');
    else if (name === 'meta' && attrOf(attrs, 'itemprop') === null) {
      for (const a of ['name', 'property', 'http-equiv', 'charset']) if (attrOf(attrs, a) !== null) bodyMeta.add(a);
    }
  }
  const tail = html.slice(last);
  if (svgDepth === 0 && tail.trim() !== '' && (bodyEnded || htmlEnded)) lateContent();
  if (bodyTitles > 0) {
    if (headTitle) warnings.push('a second <title> stands in the body; only the first title of the page counts');
    else errors.push('the page has its <title> only inside the body; a title belongs in the head');
  }
  for (const a of bodyMeta) warnings.push(`a <meta> tag with ${a} stands in the body; meta tags belong in the head`);
  if (count.head === 0) warnings.push('the page has no <head> tag; the browser makes one');
  if (count.body === 0) warnings.push('the page has no <body> tag; the browser makes one');
  return { errors, warnings };
}
