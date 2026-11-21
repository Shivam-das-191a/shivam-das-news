// Part 8bh (POLISH, Noscript): the <noscript> blocks of a built page are closed and hold what the place allows.
// A <noscript> in the head may hold only link, style and meta. Anything else (a picture, a paragraph, text) ends the head early for a reader whose JavaScript is off, so the rest of the head
// (the canonical link, the share tags, the structured data) lands in the body and is lost. A <noscript> that is never closed turns the whole rest of the page into text for a reader whose
// JavaScript is on. The browser shows no message either way, and nothing else read <noscript>.
// Pure function, no files, no network.
//   checkNoscript(html): { errors, warnings }
//   errors:   a <noscript> in the head that holds a tag other than link, style, meta (basefont, bgsound and noframes are old and allowed) or any text; a <noscript> with no </noscript>
//   warnings: an empty <noscript>; a <script> inside a <noscript> (it never runs: the block is read only when JavaScript is off); a </noscript> with no opening one
// Read on: the whole page in order. Comments, <script>, <style> and <template> blocks outside a <noscript> are skipped (a tracking snippet that writes the word <noscript> inside a
//   script is not read); the case of names is not read.
// Left out on purpose, so there is no false alarm: a <noscript> in the body (it may hold anything); a picture pixel in a body <noscript>; the content of a body <noscript> otherwise.
const TOKEN = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<(head)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>|<\/(head)\s*>|<(noscript)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>|<\/(noscript)\s*>/gi;
const INNER = /<!--[\s\S]*?-->|<(script|style)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const HEAD_OK = new Set(['link', 'style', 'meta', 'basefont', 'bgsound', 'noframes']);

export function checkNoscript(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  let inHead = false;
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(html)) !== null) {
    if (m[2]) { inHead = true; continue; }
    if (m[3]) { inHead = false; continue; }
    if (m[5]) { warnings.push('the page has a </noscript> with no opening <noscript>; it does nothing'); continue; }
    if (!m[4]) continue; // a comment or a skipped script, style or template block
    const start = m.index + m[0].length;
    const close = /<\/noscript\s*>/i.exec(html.slice(start));
    if (!close) {
      errors.push(`a <noscript> in the ${inHead ? 'head' : 'body'} is never closed; for a reader whose JavaScript is on, the rest of the page becomes text and does not show`);
      break;
    }
    const inner = html.slice(start, start + close.index);
    TOKEN.lastIndex = start + close.index + close[0].length;
    const bare = inner.replace(/<!--[\s\S]*?-->/g, '');
    if (bare.trim() === '') { warnings.push(`an empty <noscript> in the ${inHead ? 'head' : 'body'}; it does nothing, remove it`); continue; }
    const tags = [];
    let text = false, last = 0;
    for (const t of bare.matchAll(INNER)) {
      if (bare.slice(last, t.index).trim() !== '') text = true;
      last = t.index + t[0].length;
      if (t[0].startsWith('<!--')) continue;
      if (t[1]) { tags.push(t[1].toLowerCase()); continue; }
      if (t[2] === '/') continue;
      tags.push(t[3].toLowerCase());
    }
    if (bare.slice(last).trim() !== '') text = true;
    if (tags.includes('script')) warnings.push(`a <script> stands inside a <noscript> in the ${inHead ? 'head' : 'body'}; the block is read only when JavaScript is off, so the script never runs`);
    if (inHead) {
      const bad = [...new Set(tags.filter((t) => !HEAD_OK.has(t) && t !== 'script'))];
      if (bad.length) errors.push(`a <noscript> in the head holds ${bad.map((t) => `<${t}>`).join(', ')}; only link, style and meta may stand there, and for a reader whose JavaScript is off the head ends early and the rest of it lands in the body`);
      else if (text) errors.push('a <noscript> in the head holds text; only link, style and meta may stand there, and for a reader whose JavaScript is off the head ends early and the rest of it lands in the body');
      else if (tags.includes('script')) errors.push('a <noscript> in the head holds a <script>; only link, style and meta may stand there, and for a reader whose JavaScript is off the head ends early and the rest of it lands in the body');
    }
  }
  return { errors, warnings };
}
