// Part 8q (POLISH, Accessibility and Mobile): a reader can always zoom. Low vision readers pinch to zoom and must not be blocked (WCAG 1.4.4, resize text to 200 percent).
// Pure functions, no files, no network.
//   checkZoomHtml(html): { errors, warnings }   reads the viewport meta tag of one built page
//   checkZoomCss(css):   { errors, warnings }   reads the whole built style
// errors:   the viewport says user-scalable=no (or 0, or false); the viewport sets maximum-scale under 2;
//           a rule on html, body, :root, main or * sets touch-action to none, or to pan-x and/or pan-y without pinch-zoom (that turns off pinch zoom)
// warnings: the viewport sets maximum-scale under 5 (Lighthouse asks for 5); a rule on html, body, :root or * sets text-size-adjust to none (phones could not enlarge the text)
// Left out on purpose, so there is no false alarm: a page with no viewport tag (page-basics-lib.mjs reports that already); minimum-scale; touch-action on a small part
// such as a slider or a map; touch-action: manipulation (it keeps pinch zoom); text inside script, style, template and comments.
import { declarations } from './side-scroll-lib.mjs';

const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const META = /<meta(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const GLOBAL = new Set(['html', 'body', ':root', 'main', '*']);

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function checkZoomHtml(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(META)) {
    if ((attr(m[1], 'name') || '').trim().toLowerCase() !== 'viewport') continue;
    const content = attr(m[1], 'content') || '';
    const parts = {};
    for (const p of content.split(/[,;]/)) {
      const i = p.indexOf('=');
      if (i > 0) parts[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().toLowerCase();
    }
    const us = parts['user-scalable'];
    if (us === 'no' || us === '0' || us === 'false') errors.push('the viewport has user-scalable=no, so a reader cannot pinch to zoom (WCAG 1.4.4)');
    const mx = parts['maximum-scale'];
    if (mx !== undefined && /^\d*\.?\d+$/.test(mx)) {
      const n = parseFloat(mx);
      if (n < 2) errors.push(`the viewport has maximum-scale=${mx}; a reader must be able to zoom to at least 2 (WCAG 1.4.4)`);
      else if (n < 5) warnings.push(`the viewport has maximum-scale=${mx}; Lighthouse asks for 5 or no limit`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function checkZoomCss(css) {
  const errors = [], warnings = [];
  if (typeof css !== 'string' || !css.trim()) return { errors, warnings };
  const c = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of c.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '));
    const globals = sels.filter((s) => GLOBAL.has(s));
    if (!globals.length) continue;
    const d = declarations(m[2]);
    const ta = d['touch-action'];
    if (ta && (ta === 'none' || (!/\b(?:pinch-zoom|manipulation|auto)\b/.test(ta) && /\bpan-(?:x|y|left|right|up|down)\b/.test(ta))))
      errors.push(`the rule "${globals[0]}" sets touch-action to ${ta}, which turns off pinch zoom for the whole page`);
    const ts = d['text-size-adjust'] ?? d['-webkit-text-size-adjust'] ?? d['-moz-text-size-adjust'];
    if (ts === 'none' && !globals.every((s) => s === 'main'))
      warnings.push(`the rule "${globals[0]}" sets text-size-adjust to none, so a phone cannot enlarge the text`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
