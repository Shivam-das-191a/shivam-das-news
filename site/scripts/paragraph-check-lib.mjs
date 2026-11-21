// Part 8ak (POLISH, HTML quality): a paragraph of a built page holds only text-level tags, and so do headings and inline tags.
// HTML does not allow a <div>, a list, a table, a heading or a figure inside a <p>. The browser closes the paragraph early and leaves an empty
// paragraph behind the old end tag, so the page shows extra space and the text is split in two paragraphs for a screen reader.
// Pure function, no files, no network.
//   checkParagraphs(html): { errors, warnings }
//   errors:   a block tag (div, ul, ol, dl, table, h1 to h6, figure, blockquote, pre, form, hr, fieldset, details, address, section, article, aside, header, footer, nav, main)
//             opened while a <p> is still open
//   warnings: a block tag or a <p> directly inside an inline tag (span, b, i, em, strong, u, s, small, abbr, cite, q, sub, sup, mark, label, var, time)
//             or directly inside a heading
// Left out on purpose, so there is no false alarm: text inside script, style, template, svg, math, pre, code, kbd, samp, textarea, xmp and comments;
//   a <p> that is closed by the next <p> (HTML allows that); a block tag inside a link or a button that is not itself inside a <p> (HTML allows it); a <p> in an earlier <li>, <dt> or <dd> that was left open;
//   closing tags with no opening tag (they are ignored); the case of a tag; names that only start with a listed word (<para-box>, <spanner>, <table-of-contents>).
// Why: a post written by hand (PLAN 37) or an old Blogger post (PLAN 11) can wrap a <div> or a list in a <p>, and the owner cannot see the extra empty paragraph in the dashboard preview.
const SKIP = /<(script|style|template|svg|math|code|kbd|samp|textarea|xmp)(?=[\s>/])[\s\S]*?<\/\1\s*>/gi;
// the inside of a <pre> is a code sample, but the <pre> tag itself is still a block, so it is kept as an empty <pre></pre>
const PRE = /<pre(?=[\s>/])[\s\S]*?<\/pre\s*>/gi;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BLOCK = new Set(['div', 'ul', 'ol', 'dl', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'blockquote', 'pre', 'form', 'hr', 'fieldset', 'details', 'address', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main']);
const INLINE = new Set(['span', 'b', 'i', 'em', 'strong', 'u', 's', 'small', 'abbr', 'cite', 'q', 'sub', 'sup', 'mark', 'label', 'var', 'time', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
// where the search for an open <p> stops (the browser rules call this the button scope, and an earlier list item is closed by the next one)
const STOP = new Set(['button', 'td', 'th', 'caption', 'table', 'object', 'template', 'li', 'dt', 'dd']);

export function checkParagraphs(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(PRE, '<pre></pre>').replace(SKIP, ' ');
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1] : null);
  const close = (name) => {
    let i = stack.length - 1;
    while (i >= 0 && stack[i] !== name) i--;
    if (i >= 0) stack.length = i;
  };
  // the index of the open <p> that this tag would close, or -1
  const openP = () => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === 'p') return i;
      if (STOP.has(stack[i])) return -1;
    }
    return -1;
  };
  for (const m of h.matchAll(TAG)) {
    const name = m[2].toLowerCase();
    if (m[1] === '/') { close(name); continue; }
    if (name === 'li' || name === 'dt' || name === 'dd') {
      // the next item closes the one before it, and anything left open inside it
      const stops = name === 'li' ? ['ul', 'ol', 'menu'] : ['dl'];
      const same = name === 'li' ? ['li'] : ['dt', 'dd'];
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stops.includes(stack[i])) break;
        if (same.includes(stack[i])) { stack.length = i; break; }
      }
    } else if (name === 'p') {
      const i = openP();
      if (i >= 0) stack.length = i; // a <p> closes the open <p>, HTML allows it
    } else if (BLOCK.has(name)) {
      const i = openP();
      if (i >= 0) {
        errors.push(`a <${name}> sits inside a <p>; the browser closes the paragraph early and leaves an empty paragraph after it, so close the <p> before the <${name}>, or make the outer tag a <div>`);
        stack.length = i;
      }
    }
    if ((BLOCK.has(name) || name === 'p') && top() && INLINE.has(top())) {
      const at = top();
      warnings.push(`a <${name}> sits directly inside ${/^h[1-6]$/.test(at) ? `a <${at}> heading` : `an inline <${at}>`}; HTML allows only text-level tags there, so a screen reader may read it wrongly`);
    }
    if (VOID.has(name) || /\/\s*$/.test(m[3])) continue;
    stack.push(name);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
