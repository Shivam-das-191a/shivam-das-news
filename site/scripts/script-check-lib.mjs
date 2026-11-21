// Part 8am (POLISH, Scripts and style sheets): a script or a style sheet of a built page is loaded the way the owner expects.
// A script or a style sheet that loads from http:// is blocked by the browser on an https page, so the page loses its look or its function with no message to the reader.
// A script with an empty src never runs. Pure function, no files, no network.
//   checkScripts(html): { errors, warnings }
//   errors:   a <script src> that starts with http://; a <script> with an empty src; a <link rel="stylesheet"> whose href starts with http://
//   warnings: a <script src> that also holds text of its own (the browser ignores the text);
//             async or defer on a classic script with no src (both are ignored); nomodule on a type="module" script (a modern browser never runs it);
//             the same classic script src loaded twice on one page; document.write( inside an inline script
// Left out on purpose, so there is no false alarm: async with defer on one script (Cloudflare Turnstile and many ad snippets write both, for old browsers);
//   text inside comments and <template>; JSON and other data blocks (type="application/ld+json", "importmap", "speculationrules", "text/template");
//   the case of a tag, of a type and of a rel; a rel such as preload or icon; names that only start with a listed word (<script-box>, <linkbar>);
//   a protocol-relative (//host/x.js) or relative address; scripts from another website (that is a choice of the owner, such as an ad network).
// Why: the owner may paste a script or a style sheet by hand into a post or into the Ads screen (PLAN 37); the browser reports none of these faults to the reader.
const RE = /<!--[\s\S]*?-->|<template(?=[\s>/])[\s\S]*?<\/template\s*>|<script(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>|<link(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const DATA_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules', 'text/template', 'text/x-template']);
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkScripts(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const seen = new Set();
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[0].startsWith('<!--') || /^<template/i.test(m[0])) continue;
    if (m[3] !== undefined) {
      const a = attrsOf(m[3]);
      const rel = (a.get('rel') || '').toLowerCase().split(/\s+/);
      const href = a.get('href') || '';
      if (rel.includes('stylesheet') && /^http:\/\//i.test(href)) err(`a style sheet loads from ${short(href)}, which is not https; the browser blocks it on an https page, so the page loses its look`);
      continue;
    }
    const a = attrsOf(m[1]);
    const type = (a.get('type') || '').toLowerCase();
    if (DATA_TYPES.has(type)) continue;
    const module = type === 'module';
    const body = (m[2] || '').trim();
    if (a.has('src')) {
      const src = a.get('src');
      if (src === '') { err('a <script> has an empty src, so it never runs'); continue; }
      if (/^http:\/\//i.test(src)) err(`a script loads from ${short(src)}, which is not https; the browser blocks it on an https page, so the script never runs`);
      if (body !== '') warn(`a <script src="${short(src)}"> also holds text of its own; the browser ignores that text, so put it in a separate script`);
      if (!module) {
        if (seen.has(src)) warn(`the script ${short(src)} is loaded twice on one page, so it runs twice`);
        seen.add(src);
      }
    } else {
      if (!module && (a.has('async') || a.has('defer'))) warn('a classic <script> with no src has async or defer, which the browser ignores; the script runs at once where it stands');
      if (/\bdocument\s*\.\s*write(ln)?\s*\(/.test(body)) warn('an inline script calls document.write(, which blocks the page while it loads and is dropped by some browsers; build the element with createElement instead');
    }
    if (module && a.has('nomodule')) warn('a <script type="module"> also has nomodule, so a modern browser never runs it; remove nomodule');
  }
  return { errors, warnings };
}
