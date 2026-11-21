// Part 8ah (POLISH, HTML quality): links, buttons and forms of a built page are not put inside each other.
// HTML does not allow a link inside a link, a button inside a button or a form inside a form. The browser repairs it in its own way: it closes the first link early,
// or drops the inner form tag so the inner fields are sent with the outer form. A control inside a link or a button also gives a keyboard and a screen reader two controls in one place.
// Pure function, no files, no network.
//   checkNesting(html): { errors, warnings }
//   errors:   an <a> inside an <a>; a <button> inside a <button>; a <form> inside a <form>
//   warnings: a <button> inside a link; a link inside a <button>; an <input> (not hidden), <select> or <textarea> inside a link or a <button>
// Left out on purpose, so there is no false alarm: text inside script, style, template, svg, math and comments; closing tags with no opening tag (they are ignored);
//   a hidden input; the case of a tag; names that only start with a listed word (<abbr>, <article>, <button-group>, <formula-box>, <input-box>).
// Why: a post written by hand (PLAN 37) or an old Blogger post (PLAN 11) can wrap a button in a link ("<a><button>Read</button></a>") and the owner cannot see the fault on the page.
const SKIP = /<(script|style|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(\/?)(a|button|form|input|select|textarea)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

export function checkNesting(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  let a = 0, button = 0, form = 0;
  for (const m of h.matchAll(TAG)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (closing) {
      if (tag === 'a') a = Math.max(0, a - 1);
      else if (tag === 'button') button = Math.max(0, button - 1);
      else if (tag === 'form') form = Math.max(0, form - 1);
      continue;
    }
    if (tag === 'a') {
      if (a > 0) errors.push('an <a> sits inside another <a>; the browser closes the first link early, so the page shows two broken links');
      if (button > 0) warnings.push('a link sits inside a <button>; the Tab key and a screen reader meet two controls in one place, so use only one');
      a++;
    } else if (tag === 'button') {
      if (button > 0) errors.push('a <button> sits inside another <button>; the browser closes the first one early, so the page shows two broken buttons');
      if (a > 0) warnings.push('a <button> sits inside a link; the Tab key and a screen reader meet two controls in one place, so use only one');
      button++;
    } else if (tag === 'form') {
      if (form > 0) errors.push('a <form> sits inside another <form>; the browser drops the inner form tag, so the inner fields are sent with the outer form');
      form++;
    } else {
      if (tag === 'input' && /\btype\s*=\s*(?:"hidden"|'hidden'|hidden(?=[\s>/]|$))/i.test(m[3])) continue;
      if (a > 0 || button > 0) warnings.push(`a <${tag}> sits inside a ${button > 0 ? '<button>' : 'link'}; the Tab key and a screen reader meet two controls in one place, so use only one`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
