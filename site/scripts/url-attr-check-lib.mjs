// Part 8bg (POLISH, Address attributes): the action, formaction, cite, ping, poster and longdesc addresses of a built page are safe and sit on a tag that reads them.
// href and src have their own checks (href-check-lib.mjs, img-check-lib.mjs, script-check-lib.mjs). These six attributes were never read: a javascript: address in a
// formaction or an action runs code when the button is pressed, a file: address points to the reader's own disk, and an attribute on a tag that ignores it does nothing.
// Pure function, no files, no network.
//   checkUrlAttrs(html): { errors, warnings }
//   errors:   a javascript:, file: or data: address in action, formaction, cite, ping, poster or longdesc (data: is fine in poster); formaction that starts with http://
//             (a form action with http:// is read by form-behavior-check-lib.mjs, not here)
//   warnings: a ping with an http:// address; formaction on a tag that is not a button or an input of type submit or image; cite on a tag that is not blockquote, q, ins or del;
//             ping on a tag that is not a or area; poster on a tag that is not video; a ping with a word that is not an address
// Read on: every start tag; the case of names and of the scheme is not read; the HTML characters &quot; &amp; &#39; in a value are decoded first; blanks around the address are cut.
// Left out on purpose, so there is no false alarm: an empty value; a relative address; https:// and mailto: and tel:; text inside comments, script, style and <template>;
//   a value that starts with { or holds a template expression (${...}).
const SKIP = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const NAMES = new Set(['action', 'formaction', 'cite', 'ping', 'poster', 'longdesc']);
const decode = (v) => v.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&apos;|&#39;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);
// Browsers drop tabs, new lines and leading blanks inside a scheme, so "java\nscript:" is still javascript:.
const scheme = (v) => {
  const m = /^[\u0000- ]*([a-z][a-z0-9+.-]*)[\t\r\n]*:/i.exec(v.replace(/[\t\r\n]/g, ''));
  return m ? m[1].toLowerCase() : '';
};

export function checkUrlAttrs(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const attrs = new Map();
    for (const a of m[2].matchAll(ATTR)) {
      const name = a[1].toLowerCase();
      if (!NAMES.has(name) && name !== 'type') continue;
      if (attrs.has(name)) continue;
      const raw = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : '';
      attrs.set(name, decode(raw));
    }
    const type = (attrs.get('type') || '').trim().toLowerCase();
    for (const [name, val] of attrs) {
      if (name === 'type') continue;
      const v = val.trim();
      if (v === '' || v[0] === '{' || v.includes('${')) continue;
      const where = `a <${tag}> has a ${name} of ${short(v)}`;
      const parts = name === 'ping' ? v.split(/\s+/) : [v];
      for (const p of parts) {
        const sc = scheme(p);
        if (name === 'ping' && sc === '' && /^[a-z]+$/i.test(p) && !p.includes('/')) {
          warnings.push(`${where}; "${short(p)}" is not an address, so the browser sends nothing there`);
          continue;
        }
        if (sc === 'javascript') errors.push(`${where}; a javascript: address runs code, write a real address`);
        else if (sc === 'file') errors.push(`${where}; a file: address points to the reader's own disk, write a real address`);
        else if (sc === 'data' && name !== 'poster') errors.push(`${where}; a data: address is not allowed here, write a real address`);
        else if (sc === 'http' && name === 'formaction') errors.push(`${where}; the form sends to an address that is not https, so what the reader types can be read on the way`);
        else if (sc === 'http' && name === 'ping') warnings.push(`${where}; the address is not https`);
      }
      if (name === 'formaction') {
        const ok = tag === 'button' || (tag === 'input' && (type === 'submit' || type === 'image'));
        if (!ok) warnings.push(`${where}; only a button or an input of type submit or image reads formaction, so it does nothing here`);
      } else if (name === 'cite' && !['blockquote', 'q', 'ins', 'del'].includes(tag)) {
        warnings.push(`${where}; only blockquote, q, ins and del read cite, so it does nothing here`);
      } else if (name === 'ping' && tag !== 'a' && tag !== 'area') {
        warnings.push(`${where}; only a and area read ping, so it does nothing here`);
      } else if (name === 'poster' && tag !== 'video') {
        warnings.push(`${where}; only video reads poster, so it does nothing here`);
      }
    }
  }
  return { errors, warnings };
}
