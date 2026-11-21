// Part 8an (POLISH, Document settings): the character set, the page refresh and the base address of a built page are set the way the owner expects.
// A wrong character set shows letters and quotes as strange signs, a refresh moves or reloads the page under the reader (a screen reader cannot stop it),
// and a base address that is not https or is set twice changes every link of the page in a way nobody sees. The browser reports none of this. Pure function, no files, no network.
//   checkMeta(html): { errors, warnings }
//   errors:   a character set other than UTF-8 (<meta charset> or http-equiv="content-type"); a <meta http-equiv="refresh"> with a delay over 0 seconds (it reloads or moves the page by itself);
//             a <base href> that starts with http://; more than one <base> (the browser uses the first and ignores the rest)
//   warnings: a <meta http-equiv="refresh"> with a delay of 0 and an address (a real 301 in config/redirects.json is faster and keeps the search ranking);
//             a <base> with no href and no target; a character set declared more than once; a <meta charset> that starts after the first 1024 bytes
// Left out on purpose, so there is no false alarm: a page with no character set at all (the fake pages of older tests have none, and the real layout always has one);
//   text inside comments, script, style and <template>; the case of a tag, an attribute and a value; names that only start with a listed word (<meta-box>, <baseline>);
//   a page with no <head> (a fragment); http-equiv values other than refresh and content-type; a refresh with a content that is not a number.
// Why: a post or a page written by hand (PLAN 37) or a snippet pasted into the head can carry any of these; the dashboard preview shows none of them.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(meta|base)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
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

const isUtf8 = (cs) => /^utf-?8$/i.test(cs.trim());

export function checkMeta(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  let charsets = 0, bases = 0;
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const a = attrsOf(m[3]);
    if (tag === 'base') {
      bases++;
      const href = a.get('href');
      if (bases === 2) err('the page has more than one <base>; the browser uses the first and ignores the rest');
      if (href !== undefined && /^http:\/\//i.test(href)) err(`a <base href="${short(href)}"> is not https, so every link and picture without a full address loads from http://`);
      if (href === undefined && !a.has('target')) warn('a <base> has no href and no target, so it does nothing');
      continue;
    }
    if (a.has('charset')) {
      charsets++;
      const cs = a.get('charset');
      if (!isUtf8(cs)) err(`the page declares the character set "${short(cs)}", but this site is UTF-8; letters and quotes will show as wrong signs`);
      else if (Buffer.byteLength(html.slice(0, m.index)) > 1024) warn('the <meta charset> starts after the first 1024 bytes of the page, so a browser may miss it; put it first in the <head>');
      continue;
    }
    const eq = (a.get('http-equiv') || '').toLowerCase();
    if (eq === 'content-type') {
      charsets++;
      const cm = /charset\s*=\s*([^\s;"']+)/i.exec(a.get('content') || '');
      if (cm && !isUtf8(cm[1])) err(`the page declares the character set "${short(cm[1])}", but this site is UTF-8; letters and quotes will show as wrong signs`);
    } else if (eq === 'refresh') {
      const rm = /^\s*(\d+(?:\.\d+)?)\s*(?:[;,]\s*(?:url\s*=\s*)?(.*?))?\s*$/i.exec(a.get('content') || '');
      if (!rm) continue;
      const delay = Number(rm[1]);
      const target = (rm[2] || '').replace(/^['"]|['"]$/g, '');
      if (delay > 0) err(`a <meta http-equiv="refresh"> ${target ? 'moves the reader to ' + short(target) : 'reloads the page'} after ${rm[1]} seconds; readers lose their place and a screen reader cannot stop it`);
      else if (target) warn(`a <meta http-equiv="refresh"> moves the reader to ${short(target)} at once; a real 301 redirect (config/redirects.json) is faster and keeps the search ranking`);
    }
  }
  if (charsets > 1) warn('the character set is declared more than once; keep one <meta charset="utf-8">');
  return { errors, warnings };
}
