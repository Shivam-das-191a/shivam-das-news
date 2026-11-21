// Part 8t (POLISH, Accessibility and Safety): every frame (iframe) of a built page has a name, a safe address and room to load without shifting the page.
// Pure function, no files, no network.
//   checkIframes(html, ownHosts): { errors, warnings }
//   errors:   an iframe with no name (title, aria-label or aria-labelledby with text); an address on http:// (mixed content), javascript: or data:
//   warnings: a vague name ("iframe", "video", "embed" and the like); no loading="lazy"; no width and height (and no aspect-ratio in its style); an address that has no scheme (//host/...);
//             a frame from another website with no sandbox; no src and no srcdoc
// Left out on purpose, so there is no false alarm: a frame that is hidden (hidden attribute, aria-hidden="true", role presentation or none); about:blank and about:srcdoc;
// amp-iframe (another tag); text inside script, style, template and comments.
// Why: a screen reader reads a frame by its name; a frame with none is announced as "frame" with no clue what is inside. A post written by the owner can bring an HTML block with an embed (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const FRAME = /<iframe(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const VAGUE = new Set(['iframe', 'frame', 'embed', 'video', 'audio', 'map', 'widget', 'content', 'untitled', 'title', 'external content', 'youtube', 'vimeo']);

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}
const has = (text, name) => new RegExp(`\\s${name}(?=[\\s=>/]|$)`, 'i').test(text);
const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

export function checkIframes(html, ownHosts = []) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const own = new Set((Array.isArray(ownHosts) ? ownHosts : []).map((h) => String(h).toLowerCase()));
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(FRAME)) {
    const a = ' ' + m[1].trim();
    const role = (attr(a, 'role') || '').trim().toLowerCase();
    if (has(a, 'hidden') && attr(a, 'hidden') !== 'false') continue;
    if ((attr(a, 'aria-hidden') || '').trim().toLowerCase() === 'true') continue;
    if (role === 'presentation' || role === 'none') continue;
    const src = (attr(a, 'src') || '').trim();
    const srcdoc = attr(a, 'srcdoc');
    const name = src ? short(src) : '(no address)';
    const title = (attr(a, 'title') || '').trim();
    const label = (attr(a, 'aria-label') || '').trim();
    const labelledby = (attr(a, 'aria-labelledby') || '').trim();
    const given = title || label;
    if (!given && !labelledby) errors.push(`an iframe (${name}) has no name; add a title that says what is inside`);
    else if (given && VAGUE.has(given.toLowerCase().replace(/[.:!]+$/, ''))) warnings.push(`the iframe (${name}) is named "${given}"; say what is inside, for example "Video: interview with the mayor"`);
    if (/^http:\/\//i.test(src)) errors.push(`an iframe loads ${name} over http://; use https://`);
    else if (/^(javascript|data|vbscript):/i.test(src)) errors.push(`an iframe has the address ${short(src.slice(0, 30))}; a frame must load a page by https://`);
    else if (src.startsWith('//')) warnings.push(`an iframe address has no scheme (${name}); write https://`);
    if (!src && srcdoc === null) warnings.push('an iframe has no src and no srcdoc, so it shows nothing');
    const lazy = (attr(a, 'loading') || '').trim().toLowerCase();
    if (lazy !== 'lazy') warnings.push(`the iframe (${name}) has no loading="lazy"; it slows the first screen`);
    const style = attr(a, 'style') || '';
    if (!(attr(a, 'width') && attr(a, 'height')) && !/aspect-ratio/i.test(style)) warnings.push(`the iframe (${name}) has no width and height (or aspect-ratio); the page may jump while it loads`);
    const host = /^https:\/\//i.test(src) ? hostOf(src) : '';
    if (host && !own.has(host) && !has(a, 'sandbox')) warnings.push(`the iframe from ${host} has no sandbox attribute`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
