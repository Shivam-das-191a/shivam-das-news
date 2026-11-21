// Part 8al (POLISH, Forms): a form of a built page does what the reader expects when the browser sends it.
// A field with no name is never sent, a password in a GET form lands in the address bar and the browser history, a form that sends to http:// is read on the way,
// and a file field without multipart sends only the file name. The browser reports none of this. Pure function, no files, no network.
//   checkFormBehavior(html): { errors, warnings }
//   errors:   a <form> whose action starts with http://; a password field in a form that sends with GET (the default when there is no method; method="dialog" sends nothing and is left alone)
//   warnings: a file field in a form that is not method="post" with enctype="multipart/form-data"; an <input> (not submit, button, reset or image), <select> or <textarea>
//             with no name inside a form; two fields of one form with the same name (radio buttons and check boxes may share a name, and so may a name that ends with []);
//             a radio button that is alone in its name; a <select> with no <option>
// Left out on purpose, so there is no false alarm: fields outside any form; a disabled field; a hidden field is read like any other field;
//   the case of a tag, of a method, of a type and of an enctype; text inside script, style, template and comments; names that only start with a listed word (<form-box>, <inputs>, <selection>, <optionbar>);
//   a form with no action (it sends to the same page, which is allowed).
// Why: the contact form and the notifications form of this site, and any form the owner writes by hand in a post (PLAN 37), must do what they say.
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<(\/?)(form|input|select|textarea|option)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const NO_NAME_NEEDED = new Set(['submit', 'button', 'reset', 'image']);
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkFormBehavior(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  let form = null; // the open <form>: { method, post, multipart, names, radios }
  let select = null; // the open <select>: { options }
  const finishForm = () => {
    if (!form) return;
    for (const [n, count] of form.radios) if (count === 1) warnings.push(`a radio button named "${short(n)}" is alone; a reader cannot undo the choice, so use a check box or add the other choices`);
    form = null;
  };
  for (const m of h.matchAll(TAGS)) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (closing) {
      if (tag === 'form') finishForm();
      else if (tag === 'select' && select) {
        if (select.options === 0) warnings.push('a <select> has no <option>, so the reader has nothing to choose');
        select = null;
      }
      continue;
    }
    const a = attrsOf(m[3]);
    if (tag === 'form') {
      finishForm();
      const method = (a.get('method') || 'get').toLowerCase();
      const enctype = (a.get('enctype') || '').toLowerCase();
      const action = a.get('action') || '';
      if (/^http:\/\//i.test(action)) errors.push(`a form sends to ${short(action)}, which is not https; what the reader types can be read on the way, and browsers warn about it`);
      form = { method, post: method === 'post', multipart: enctype === 'multipart/form-data', names: new Map(), radios: new Map() };
      continue;
    }
    if (tag === 'option') { if (select) select.options++; continue; }
    if (tag === 'select') select = { options: 0 };
    if (!form) continue;
    const type = tag === 'input' ? (a.get('type') || 'text').toLowerCase() : tag;
    if (type === 'password' && form.method !== 'post' && form.method !== 'dialog')
      errors.push('a password field sits in a form that sends with GET (the default when there is no method), so the password would show in the address and in the browser history; write method="post"');
    if (type === 'file' && !(form.post && form.multipart))
      warnings.push('a file field sits in a form that is not method="post" with enctype="multipart/form-data"; the browser sends only the file name, not the file');
    if (tag === 'input' && NO_NAME_NEEDED.has(type)) continue;
    if (a.has('disabled')) continue;
    const name = a.get('name') || '';
    if (!name) { warnings.push(`${tag === 'input' ? 'an' : 'a'} <${tag}${tag === 'input' ? ` type="${type}"` : ''}> has no name inside a form, so the browser does not send what the reader types; add a name`); continue; }
    if (type === 'radio') form.radios.set(name, (form.radios.get(name) || 0) + 1);
    if (type === 'radio' || type === 'checkbox' || name.endsWith('[]')) continue;
    if (form.names.has(name)) warnings.push(`two fields of one form share the name "${short(name)}"; the server gets both values, so give each field its own name (only radio buttons and check boxes share a name)`);
    form.names.set(name, true);
  }
  finishForm();
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
