// Part 8ab (POLISH, Accessibility): every lang and dir of a built page is a real value a screen reader and a browser can use.
// A screen reader picks the voice from lang; a wrong value such as lang="english" or lang="en_US" is silently ignored and the page is read in the wrong voice.
// A dir that is not ltr, rtl or auto is ignored by the browser. Pure function, no files, no network.
//   checkLang(html): { errors, warnings }
//   errors:   a lang or xml:lang that is not a language code (the form is a 2 or 3 letter language, then optional script of 4 letters, region of 2 letters or 3 digits and variants,
//             for example en, en-US, zh-Hant-TW, es-419; a private use code such as x-news is also read); a dir that is not ltr, rtl or auto
//   warnings: a tag with both lang and xml:lang that name different languages
// Left out on purpose, so there is no false alarm: an empty lang on a tag other than html (it means "language unknown" in HTML) and the empty lang of the html tag
//   (page-basics-lib.mjs already reports it); hreflang and other names that only end with lang; the case of a value (EN-us is read as en-US);
//   text inside script, style, template and comments.
// Why: a post written by hand (PLAN 37) can carry a quotation in another language with lang="french" instead of lang="fr", and the site language is the base of every page (PLAN 36).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);
const LANG = /^[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?(?:-(?:[a-z0-9]{5,8}|\d[a-z0-9]{3}))*$/;
const PRIVATE = /^x(?:-[a-z0-9]{1,8})+$/;

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

/** True when the text is a language code of the form described above. */
export function isValidLang(v) {
  const s = String(v).trim().toLowerCase();
  return LANG.test(s) || PRIVATE.test(s);
}

export function checkLang(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    if (!/lang|dir/i.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    for (const name of ['lang', 'xml:lang']) {
      if (!a.has(name)) continue;
      const v = a.get(name);
      if (v === '') continue; // empty means "unknown" outside html; html is reported by page-basics-lib.mjs
      if (!isValidLang(v)) errors.push(`a <${tag}> has ${name}="${short(v)}", which is not a language code; write it like en, en-US or fr`);
    }
    if (a.has('lang') && a.has('xml:lang') && a.get('lang') && a.get('xml:lang') && a.get('lang').toLowerCase() !== a.get('xml:lang').toLowerCase())
      warnings.push(`a <${tag}> has lang="${short(a.get('lang'))}" and xml:lang="${short(a.get('xml:lang'))}", which name different languages; keep them the same`);
    if (a.has('dir')) {
      const d = a.get('dir').toLowerCase();
      if (!['ltr', 'rtl', 'auto'].includes(d)) errors.push(`a <${tag}> has dir="${short(a.get('dir'))}", which is not ltr, rtl or auto, so the browser ignores it`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
