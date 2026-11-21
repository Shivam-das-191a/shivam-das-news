// Part 8aa (POLISH, Accessibility and Forms): every <input> and <button> of a built page uses a real type and a real length.
// A typo such as type="emial" or type="sumbit" is never reported by a browser: the box silently becomes a plain text box,
// or the button silently submits the form. A maxlength that is not a whole number is ignored. Pure function, no files, no network.
//   checkFormControls(html): { errors, warnings }
//   errors:   an <input> whose type is empty or is not a real input type; a <button> whose type is empty or is not submit, reset or button;
//             a maxlength or minlength on an <input> or <textarea> that is not a whole number (the browser ignores it)
//   warnings: a <button> inside a <form> with no type (it submits the form, which is often not meant)
// Left out on purpose, so there is no false alarm: an <input> with no type (it is a text box by the HTML rule); a <button> with no type outside a form;
//   the case of a value (Submit and submit are the same); text inside script, style, template and comments.
// Why: the contact form and the notifications form of this site, and any form the owner writes by hand in a post (PLAN 37), must do what they say.
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<(\/?)(form|button|input|textarea)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month',
  'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week',
]);
const BUTTON_TYPES = new Set(['submit', 'reset', 'button']);
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkFormControls(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  let depth = 0; // how many <form> tags are open at this point
  for (const m of h.matchAll(TAGS)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'form') {
      if (closing) depth = Math.max(0, depth - 1);
      else depth++;
      continue;
    }
    if (closing) continue;
    const a = attrsOf(m[3]);
    if (tag === 'input' && a.has('type')) {
      const v = a.get('type').toLowerCase();
      if (!INPUT_TYPES.has(v)) errors.push(`an <input> has type="${short(a.get('type'))}", which is not a real input type, so the browser shows a plain text box; use text, email, tel, url, number, password, checkbox, radio, hidden, submit or another real type`);
    }
    if (tag === 'button') {
      if (a.has('type')) {
        const v = a.get('type').toLowerCase();
        if (!BUTTON_TYPES.has(v)) errors.push(`a <button> has type="${short(a.get('type'))}", which is not submit, reset or button, so the browser treats it as submit; write type="button" or type="submit"`);
      } else if (depth > 0) {
        warnings.push('a <button> inside a <form> has no type, so it submits the form; add type="submit" or type="button"');
      }
    }
    if (tag === 'input' || tag === 'textarea') {
      for (const name of ['maxlength', 'minlength']) {
        if (a.has(name) && !/^\d+$/.test(a.get(name))) errors.push(`an <${tag}> has ${name}="${short(a.get(name))}", which is not a whole number, so the browser ignores it; write it like ${name}="200"`);
      }
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
