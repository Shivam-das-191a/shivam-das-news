// Part 8a (POLISH, BUGS U): the picture rules for a BUILT page. Pure functions, no files, no network.
//   no alt attribute          -> error   (an empty alt="" is allowed: it marks a decoration)
//   an address with http://   -> error   (a browser blocks or warns on it)
//   a picture from another website -> warning (PLAN 34: our own pictures only; SITE_URL is our own website)
//   no width or no height     -> warning (the page jumps while loading)
// Pictures inside <script>, <style> and <template> are not pictures of the page and are skipped.

const IMG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;

export function attrOf(tag, name) {
  const m = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=[\\s/>])`, 'i').exec(tag);
  if (!m) return undefined;
  return m[1] ?? m[2] ?? m[3] ?? '';
}

export function hostOf(src) {
  const m = /^(?:https?:)?\/\/([^/?#:]+)/i.exec(String(src).trim());
  return m ? m[1].toLowerCase() : null;
}

export function ownHostsOf(siteUrl) {
  if (typeof siteUrl !== 'string' || !siteUrl.trim()) return [];
  const h = hostOf(/^https?:\/\//i.test(siteUrl) ? siteUrl : 'https://' + siteUrl);
  return h ? [h, h.replace(/^www\./, ''), 'www.' + h.replace(/^www\./, '')] : [];
}

const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);

export function checkImgTags(html, ownHosts = []) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors, warnings };
  const own = new Set((Array.isArray(ownHosts) ? ownHosts : []).map((h) => String(h).toLowerCase()));
  for (const tag of html.replace(SKIP, '').match(IMG) || []) {
    const src = (attrOf(tag, 'src') || '').trim();
    const name = src ? short(src) : '(no address)';
    if (attrOf(tag, 'alt') === undefined) errors.push(`a picture has no alt attribute: ${name}`);
    if (!src || /^data:/i.test(src)) continue;
    if (/^http:\/\//i.test(src)) errors.push(`a picture is loaded over http: ${name}`);
    const host = hostOf(src);
    if (host && !own.has(host)) warnings.push(`a picture is loaded from another website (${host}): ${name}`);
    const w = attrOf(tag, 'width'), h = attrOf(tag, 'height');
    if (!w || !h) warnings.push(`a picture has no width and height: ${name}`);
  }
  return { errors, warnings };
}
