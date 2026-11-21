// Part 8ao (POLISH, Plug-in content): an <object> or <embed> on a built page loads what the owner expects.
// Flash no longer runs in any browser, so a page that still carries it shows an empty box. The security rules of this site (public/_headers) say object-src 'none',
// so every other <object> and <embed> is blocked as soon as that rule is enforced. Old Blogger posts (XML import) still carry both tags. Pure function, no files, no network.
//   checkObjects(html): { errors, warnings }
//   errors:   an <object> or <embed> that loads Flash (type application/x-shockwave-flash, an address that ends in .swf, a classid), a <param name="movie"> or a <param> whose value ends in .swf;
//             an <object data> or <embed src> that starts with http://
//   warnings: any other <object> or <embed> (blocked by object-src 'none'; use <img>, <video>, <audio> or an <iframe> instead); kept back on a page that already has a Flash error, so the owner fixes the Flash first
// Left out on purpose, so there is no false alarm: text inside comments, script, style and <template>; the case of a tag, an attribute and a value; an address with a query or a hash after .swf is still read;
//   names that only start with a listed word (<object-box>, <embedded>); an <img>, <video>, <audio> and <iframe> (other checks read them).
// Why: the XML import of old Blogger posts (PLAN 36) and a snippet pasted by hand (PLAN 37) can carry these tags; the dashboard preview of a post shows an empty box or nothing at all.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(object|embed|param)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);
const SWF = /\.swf(?:[?#]|$)/i;

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkObjects(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  let flash = false, plain = false;
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const a = attrsOf(m[3]);
    if (tag === 'param') {
      const name = (a.get('name') || '').toLowerCase();
      const value = a.get('value') || '';
      if (name === 'movie' || SWF.test(value)) { flash = true; err(`a <param> hands ${short(value || name)} to Flash, which no browser runs any more; replace it with a video, a picture or an iframe`); }
      continue;
    }
    const src = a.get(tag === 'object' ? 'data' : 'src') || '';
    const type = (a.get('type') || '').toLowerCase();
    if (type === 'application/x-shockwave-flash' || SWF.test(src) || (tag === 'object' && a.has('classid'))) {
      flash = true;
      err(`an <${tag}> loads Flash${src ? ' (' + short(src) + ')' : ''}, which no browser runs any more; replace it with a video, a picture or an iframe`);
      continue;
    }
    if (/^http:\/\//i.test(src)) { err(`an <${tag}> loads ${short(src)}, which is not https; the browser blocks it on an https page`); continue; }
    plain = true;
    warn(`an <${tag}> is plug-in content, and the security rules of this site (object-src 'none') block it once they are enforced; use <img>, <video>, <audio> or an <iframe> instead`);
  }
  if (flash && plain) { const keep = warnings.filter((w) => !w.includes('plug-in content')); warnings.length = 0; warnings.push(...keep); }
  return { errors, warnings };
}
