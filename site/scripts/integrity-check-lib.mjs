// Part 8bk (POLISH, Scripts and style sheets, Safety): the integrity attribute of a script or a style sheet of a built page really protects the file.
// A script or a style sheet from a library host (cdnjs, jsDelivr, unpkg) runs with full rights on every page. The integrity attribute makes the browser compare the file with a stored fingerprint
// and refuse a changed file. But a fingerprint that is mistyped is thrown away with no message, so the page is unprotected while the owner believes it is safe, and a fingerprint on a file from
// another website with no crossorigin attribute makes the browser block the file, so the page loses its look or its function. Pure function, no files, no network.
//   checkIntegrity(html, ownHosts = []): { errors, warnings }
//   errors:   an integrity word that is not a real fingerprint (an unknown kind such as sha1 or md5, a missing dash, letters that are not base64, or a length that does not fit sha256, sha384 or sha512);
//             an integrity on a script or a style sheet from another website with no crossorigin attribute (the browser blocks the file)
//   warnings: an empty integrity (it protects nothing); an integrity on a tag that does not read it (an inline script with no src, a link that is not a style sheet, preload or modulepreload, a picture, a frame, a link);
//             a script or a style sheet from a library host (cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, code.jquery.com, ajax.googleapis.com, the Bootstrap hosts) with no integrity
// Read on: <script> and <link> tags, and the integrity attribute of <img>, <iframe>, <a>, <area>, <video>, <audio>, <source>, <embed>, <object>. Comments and <template> blocks are skipped; the case of a name is not read;
//   several fingerprints separated by blanks are fine (the browser takes the strongest), and an option after a question mark (sha384-abc?ct=application/javascript) is allowed.
// Left out on purpose, so there is no false alarm: scripts from ad, analytics and challenge hosts (Adsterra, AdSense, Cloudflare Turnstile), which change by design and cannot carry a fingerprint;
//   any other host that is not on the library list; an own file with or without integrity; a protocol-relative or relative address (own file); the text inside a script; the order of the fingerprints.
// Why: the owner may paste a script or a style sheet from a library host by hand into a post or into the Ads screen (PLAN 37), and the browser reports a bad fingerprint to nobody who reads the page.
const SKIP = /<!--[\s\S]*?-->|<template(?=[\s>/])[\s\S]*?<\/template\s*>/gi;
const TAG = /<(script|link|img|iframe|a|area|video|audio|source|embed|object)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const LIBRARY_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'code.jquery.com', 'ajax.googleapis.com', 'stackpath.bootstrapcdn.com', 'maxcdn.bootstrapcdn.com', 'cdn.bootcdn.net'];
const DIGEST = { sha256: 44, sha384: 64, sha512: 88 }; // length of the base64 text, with its = signs
const READS = new Set(['stylesheet', 'preload', 'modulepreload']);
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

function hostOf(url) {
  const m = /^(?:https?:)?\/\/([^/?#:@]*@)?([^/?#:]+)/i.exec(url.trim());
  return m ? m[2].toLowerCase() : null; // null: a relative address, so an own file
}

// null when the word is a good fingerprint, else a short reason
function badWord(word) {
  const body = word.split('?')[0];
  const dash = body.indexOf('-');
  if (dash < 1) return 'it has no kind-dash-fingerprint form (write sha384- and then the fingerprint)';
  const kind = body.slice(0, dash).toLowerCase(), digest = body.slice(dash + 1);
  if (!(kind in DIGEST)) return `the kind "${kind}" is not read by a browser (use sha256, sha384 or sha512)`;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(digest)) return 'the fingerprint holds letters that are not base64';
  if (digest.length !== DIGEST[kind]) return `a ${kind} fingerprint is ${DIGEST[kind]} characters long, this one is ${digest.length}`;
  return null;
}

export function checkIntegrity(html, ownHosts = []) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const own = new Set((Array.isArray(ownHosts) ? ownHosts : []).map((h) => String(h).toLowerCase()));
  const page = html.replace(SKIP, ' ');
  for (const m of page.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    const rel = (a.get('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const isScript = tag === 'script';
    const isSheet = tag === 'link' && rel.includes('stylesheet');
    const reads = isScript || (tag === 'link' && rel.some((r) => READS.has(r)));
    const url = isScript ? a.get('src') : tag === 'link' ? a.get('href') : null;
    const where = url ? ` on ${short(url)}` : '';
    const host = url ? hostOf(url) : null;
    const foreign = host !== null && !own.has(host);
    if (a.has('integrity')) {
      const value = (a.get('integrity') || '').trim();
      if (!reads) {
        const what = tag === 'link' ? 'a link that is not a style sheet or preload' : `a <${tag}> tag`;
        warnings.push(`an integrity attribute sits on ${what}; the browser reads it only on a script with a src and on a style sheet, preload or modulepreload link, so it does nothing here`);
        continue;
      }
      if (isScript && !a.has('src')) { warnings.push('an integrity attribute sits on a script with no src; the browser reads it only on a script with a src, so it does nothing here'); continue; }
      if (value === '') { warnings.push(`an empty integrity${where} protects nothing; paste the fingerprint or remove the attribute`); continue; }
      let bad = false;
      for (const word of value.split(/\s+/)) {
        const why = badWord(word);
        if (why) { errors.push(`the integrity "${short(word)}"${where} is not a real fingerprint: ${why}; the browser ignores it and the file is not checked`); bad = true; }
      }
      if (!bad && foreign && !a.has('crossorigin')) errors.push(`a file from another website${where} has an integrity but no crossorigin attribute, so the browser blocks the file; add crossorigin="anonymous"`);
    } else if ((isScript || isSheet) && foreign && url && LIBRARY_HOSTS.includes(host)) {
      warnings.push(`${isScript ? 'a script' : 'a style sheet'} from the library host ${host} has no integrity${where}; add the fingerprint so a changed file is refused`);
    }
  }
  return { errors, warnings };
}
