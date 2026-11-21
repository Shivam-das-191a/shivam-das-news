// Part 8ax (POLISH, Language tags of links and subtitles): hreflang and srclang hold a real language code.
// <link rel="alternate" hreflang="english"> and <a hreflang="en_US"> look right but are not language codes: search engines ignore the alternate page and a browser cannot name the language of the link.
// <track kind="subtitles" srclang="french"> is read the same way: the browser cannot offer the subtitle by its language.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these, and lang-check-lib.mjs leaves hreflang and srclang out on purpose, so nothing else reads them.
// Pure function, no files, no network. The language code rule is the one of lang-check-lib.mjs (isValidLang): en, en-US, zh-Hant-TW, es-419 and a private code such as x-default.
//   checkLangTags(html): { errors, warnings }
//   errors:   an hreflang of an a, area or link that is not a language code; a srclang of a track that is not a language code
//   warnings: an empty hreflang; a track of kind subtitles with no srclang or an empty one (the browser cannot offer it by language)
// Left out on purpose, so there is no false alarm: the case of a value (EN-us is read as en-US); a track of another kind with no srclang; lang and xml:lang (lang-check-lib.mjs reads them);
//   the case of a tag and an attribute; text inside comments, script, style and <template>; a tag that is not in the list.
import { isValidLang } from './lang-check-lib.mjs';
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<([a-z][a-z0-9:-]*)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const HREFLANG = new Set(['a', 'area', 'link']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);
const art = (tag) => (/^[aeiou]/.test(tag) ? 'an' : 'a');

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkLangTags(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    if (!HREFLANG.has(tag) && tag !== 'track') continue;
    const a = attrsOf(m[3]);
    const name = (k, v) => `${art(tag)} <${tag} ${k}="${short(v)}">`;
    if (HREFLANG.has(tag) && a.has('hreflang')) {
      const v = a.get('hreflang');
      if (v === '') warn(`${name('hreflang', v)} is empty; write a language code such as en, en-US or x-default`);
      else if (!isValidLang(v)) err(`${name('hreflang', v)} is not a language code, so search engines and browsers ignore it; write it like en, en-US or x-default`);
    }
    if (tag === 'track') {
      if (a.has('srclang') && a.get('srclang') !== '') {
        const v = a.get('srclang');
        if (!isValidLang(v)) err(`${name('srclang', v)} is not a language code, so the browser cannot name the language of the track; write it like en or fr`);
      } else if ((a.get('kind') || '').toLowerCase() === 'subtitles') {
        warn('a <track kind="subtitles"> has no srclang, so the browser cannot offer it by language; add srclang="en" (or the real language)');
      }
    }
  }
  return { errors, warnings };
}
