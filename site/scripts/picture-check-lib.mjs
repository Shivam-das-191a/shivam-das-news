// Part 8aq (POLISH, <picture> and <source>): a <picture> on a built page can draw something and the browser can choose from it.
// A <picture> without an <img> draws nothing and has no alt text; a <source> after the <img> is ignored; a <source> without srcset gives the browser nothing to load.
// The pictures of this site use <img srcset>; a <picture> comes from an HTML block pasted by hand (PLAN 37) or from an imported Blogger post (PLAN 36). Pure function, no files, no network.
//   checkPicture(html): { errors, warnings }
//   errors:   a <picture> with no <img>; a <picture> with more than one <img>; a <source> after the <img> inside a <picture> (the browser ignores it);
//             a <source> inside a <picture> with no srcset or an empty one (a src is not read there)
//   warnings: a <source> with neither type nor media (the browser always picks it, so the sources after it and the <img> are never used);
//             a <source type> that is not an image type; a <source media> that is empty
// Left out on purpose, so there is no false alarm: text inside comments, script, style and <template>; the case of a tag, an attribute and a value;
//   a <source> inside <video>, <audio> or on its own (other checks read them); an <img> outside a <picture>; a <picture> that is never closed;
//   names that only start with a listed word (<picture-box>, <sources>).
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<\/picture\s*>|<(picture|source|img)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkPicture(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  let open = false, imgs = 0;
  for (const m of html.matchAll(RE)) {
    const whole = m[0];
    if (whole.startsWith('<!--') || m[1] !== undefined) continue; // a comment, script, style or template
    if (/^<\/picture/i.test(whole)) {
      if (open) {
        if (imgs === 0) err('a <picture> has no <img>, so it draws nothing in a browser that cannot choose a source and it has no alt text; add an <img> as the last child');
        open = false;
      }
      continue;
    }
    const tag = (m[2] || '').toLowerCase();
    if (tag === 'picture') { open = true; imgs = 0; continue; }
    if (!open) continue; // a <source> or <img> outside a <picture> is read by other checks
    if (tag === 'img') {
      imgs++;
      if (imgs === 2) err('a <picture> has more than one <img>; the browser draws one, so keep a single <img> as the last child');
      continue;
    }
    const a = attrsOf(m[3] || '');
    if (imgs > 0) err('a <source> comes after the <img> inside a <picture>, and the browser ignores it; put every <source> before the <img>');
    if (!a.get('srcset')) err(`a <source> inside a <picture> has no srcset${a.get('src') ? ' (it has a src, which is not read there)' : ''}, so the browser has nothing to load; add a srcset`);
    const type = a.get('type'), media = a.get('media');
    if (type === undefined && media === undefined) warn('a <source> has neither type nor media, so the browser always picks it and the sources after it and the <img> are never used; add a type or a media');
    if (type && !/^image\//i.test(type)) warn(`a <source type="${short(type)}"> is not an image type, so the browser skips it; use a type such as image/webp`);
    if (media === '') warn('a <source> has an empty media; remove it or give it a media query');
  }
  return { errors, warnings };
}
