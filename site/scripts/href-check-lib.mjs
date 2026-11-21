// Part 8w (POLISH, Safety and Links): every link address (a and area with href) of a built page is a real, safe address.
// Pure function, no files, no network.
//   checkHrefs(html, ownHosts): { errors, warnings }
//   errors:   an empty href; an address that starts with javascript:, vbscript: or file:; a mailto: with no e-mail address; a tel: with fewer than 3 digits
//   warnings: href="#" (a link that goes nowhere); a link on http:// (also to our own site); a bare web address with no scheme (www.example.org or example.com/page, which the browser reads
//             as a page of this site); a link to localhost, 127.0.0.1 or 0.0.0.0
// Left out on purpose, so there is no false alarm: a or area with no href; link, base and script tags (other checks); links made by a script; text inside script, style, template and comments;
// #name links (ids-lib.mjs reads them); relative links such as /story/ or ../x; mailto: with only a ?subject (allowed when the query has to=).
// Why: a javascript: link runs code from the page text, a mailto: with no address opens an empty mail, and a post written by the owner can bring a link typed by hand (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const LINK = /<(a|area)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const BARE = /^(?:www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|news|co|io|in|us|uk|edu|gov)(?::\d+)?(?:[/?#]|$))/i;

export function checkHrefs(html, ownHosts = []) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const own = new Set((Array.isArray(ownHosts) ? ownHosts : []).map((x) => String(x).toLowerCase()));
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(LINK)) {
    const raw = attr(' ' + m[2].trim(), 'href');
    if (raw === null) continue;
    const href = raw.trim();
    const name = short(href);
    if (!href) { errors.push(`an <${m[1].toLowerCase()}> has an empty href`); continue; }
    const scheme = href.replace(/[\u0000- \u007f]+/g, '').toLowerCase();
    if (/^(javascript|vbscript):/.test(scheme)) { errors.push(`a link has the address ${short(scheme.slice(0, 40))}; a link must go to a page, not run code`); continue; }
    if (/^file:/.test(scheme)) { errors.push(`a link goes to ${name}, a file on a computer; use an https:// address`); continue; }
    if (/^mailto:/.test(scheme)) {
      const rest = scheme.slice(7);
      const q = rest.indexOf('?');
      const to = q === -1 ? rest : rest.slice(0, q);
      const query = q === -1 ? '' : rest.slice(q + 1);
      if (!to.includes('@') && !/(^|&)to=[^&]*@/.test(query)) errors.push(`a mailto: link has no e-mail address (${name})`);
      continue;
    }
    if (/^tel:/.test(scheme)) {
      if ((scheme.slice(4).match(/\d/g) || []).length < 3) errors.push(`a tel: link has no phone number (${name})`);
      continue;
    }
    if (href === '#') { warnings.push('a link has href="#" and goes nowhere; give it a real address or make it a button'); continue; }
    if (/^http:\/\//i.test(href)) {
      const host = hostOf(href);
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) warnings.push(`a link goes to ${host} (${name}), the writer's own computer`);
      else if (own.has(host)) warnings.push(`a link to our own site is on http:// (${name}); use https://`);
      else warnings.push(`a link is on http:// (${name}); use https:// if the site has it`);
      continue;
    }
    if (/^https:\/\//i.test(href)) {
      const host = hostOf(href);
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) warnings.push(`a link goes to ${host} (${name}), the writer's own computer`);
      continue;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/') && !href.startsWith('.') && !href.startsWith('#') && !href.startsWith('?') && BARE.test(href))
      warnings.push(`a link goes to ${name} with no https://; the browser reads it as a page of this site`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
