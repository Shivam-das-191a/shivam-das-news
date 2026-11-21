// Part 8f (POLISH, Speed): "Fonts self-hosted, font-display: swap, one or two weights". Pure functions, no files, no network.
//   checkFontCss(css):  { errors, warnings }
//     errors:   an @font-face with no font-display of swap, fallback or optional; an @font-face file (or an @import) from another website
//     warnings: more than four different font faces (family, weight and style)
//   checkFontLinks(html): errors when a link or script of the page points to a known font host
const FONT_HOSTS = /(?:^|[/.@])(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|use\.fontawesome\.com|kit\.fontawesome\.com)(?![a-z0-9.-])/i;
const REMOTE = /url\(\s*["']?\s*(?:https?:)?\/\//i;
const OK_DISPLAY = new Set(['swap', 'fallback', 'optional']);
const MAX_FACES = 4;

const clean = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const prop = (block, name) => {
  const m = new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;}]*)`, 'i').exec(block);
  return m ? m[1].replace(/!important/i, '').trim() : '';
};

export function checkFontCss(css) {
  const errors = [], warnings = [];
  if (typeof css !== 'string') return { errors, warnings };
  const c = clean(css);
  const faces = new Set();
  for (const m of c.matchAll(/@font-face\s*\{([^{}]*)\}/gi)) {
    const b = m[1];
    const family = prop(b, 'font-family').replace(/["']/g, '') || '(no name)';
    const weight = prop(b, 'font-weight') || '400', style = prop(b, 'font-style') || 'normal';
    faces.add(`${family.toLowerCase()}|${weight}|${style.toLowerCase()}`);
    const label = `${family} ${weight}`;
    const d = prop(b, 'font-display').toLowerCase();
    if (!OK_DISPLAY.has(d)) errors.push(`the font ${label} has no font-display of swap (text would stay invisible while it loads)`);
    if (REMOTE.test(b)) errors.push(`the font ${label} is loaded from another website; fonts must be hosted on our own site`);
  }
  if (/@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\/[^;]*/i.test(c) && FONT_HOSTS.test(c)) errors.push('the style imports a font from a font website; fonts must be hosted on our own site');
  if (faces.size > MAX_FACES) warnings.push(`the style has ${faces.size} different font faces; POLISH asks for one or two weights (more than ${MAX_FACES} slows the page)`);
  return { errors, warnings };
}

export function checkFontLinks(html) {
  const errors = [];
  if (typeof html !== 'string') return errors;
  const h = html.replace(/<(script|style|template)\b(?![^>]*\bsrc\s*=)[\s\S]*?<\/\1\s*>/gi, '');
  for (const t of h.match(/<(?:link|script)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []) {
    const m = /\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(t);
    const v = m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
    if (FONT_HOSTS.test(v.replace(/^[a-z]+:\/\//i, '//'))) errors.push(`the page loads a font from another website (${v.length > 80 ? v.slice(0, 77) + '...' : v})`);
  }
  return errors;
}
