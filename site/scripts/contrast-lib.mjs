// Part 8k (POLISH, Accessibility: "Contrast at least 4.5:1"): text colours of the built style stay readable on their background.
// Pure functions, no files, no network.
//   contrastRatio(a, b): the WCAG contrast ratio of two colours (strings), or null when one of them cannot be read.
//   parseColor(text): { r, g, b } or null. Reads #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba() (commas or spaces), white and black.
//                     A colour that is not solid (alpha under 1), transparent, currentColor, inherit, hsl(), gradients and names other than white and black give null.
//   checkContrast(css): { errors, warnings }
//   Part A, the colour tokens. The custom properties of the style are read for every look: light, dark, and each colour style (data-style) in light and dark.
//          The layers are applied in the order the style intends: base, colour style, dark base, dark colour style. In each look these pairs must keep 4.5:1 (error):
//          --text and --muted on --bg and on --card, --acc-t on --bg and on --card, and white on --acc (the fill with white text).
//   Part B, rules. A rule that sets both a text colour (color) and a solid background (background or background-color) is judged on its own, with var() resolved for each look
//          (a rule inside the dark media query, or with [data-theme=dark], only in the dark looks; with [data-theme=light], only in the light looks).
//          Under 3:1 is an error (the least WCAG 1.4.11 and 1.4.3 allow, for large text); under 4.5:1 is a warning (normal text needs 4.5:1, and the size of the text is not known here).
//   Not judged (no message, so no false alarm): a rule that sets only one of the two colours (the other comes from somewhere else); a colour that is not solid or cannot be read;
//          a var() with no value and no fallback; a background that is a gradient, a picture or several layers; a rule with display:none; a rule inside @media print,
//          @keyframes, @font-face, @page or @property.
//   Known limit: the real page behind a text is not known, so a text colour with no background in the same rule is only judged through the tokens of Part A.
const LIGHT_NAMES = new Set(['white', 'black']);
const NAMED = { white: { r: 255, g: 255, b: 255 }, black: { r: 0, g: 0, b: 0 } };
const MIN_ERROR_RULE = 3;
const MIN_NORMAL = 4.5;

const hex = (s) => parseInt(s, 16);

export function parseColor(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (LIGHT_NAMES.has(t)) return { ...NAMED[t] };
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      if (h.length === 4 && h[3] !== 'f') return null;
      return { r: hex(h[0] + h[0]), g: hex(h[1] + h[1]), b: hex(h[2] + h[2]) };
    }
    if (h.length === 6 || h.length === 8) {
      if (h.length === 8 && h.slice(6) !== 'ff') return null;
      return { r: hex(h.slice(0, 2)), g: hex(h.slice(2, 4)), b: hex(h.slice(4, 6)) };
    }
    return null;
  }
  m = /^rgba?\(\s*([^)]*)\)$/.exec(t);
  if (m) {
    const parts = m[1].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const ch = [];
    for (const p of parts.slice(0, 3)) {
      const n = /^(-?\d*\.?\d+)(%?)$/.exec(p);
      if (!n) return null;
      const v = n[2] ? (parseFloat(n[1]) * 255) / 100 : parseFloat(n[1]);
      ch.push(Math.min(255, Math.max(0, Math.round(v))));
    }
    if (parts.length === 4) {
      const a = /^(\d*\.?\d+)(%?)$/.exec(parts[3]);
      if (!a) return null;
      const alpha = a[2] ? parseFloat(a[1]) / 100 : parseFloat(a[1]);
      if (!(alpha >= 1)) return null;
    }
    return { r: ch[0], g: ch[1], b: ch[2] };
  }
  return null;
}

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrastRatio(a, b) {
  const x = typeof a === 'string' ? parseColor(a) : a;
  const y = typeof b === 'string' ? parseColor(b) : b;
  if (!x || !y) return null;
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

const show = (n) => String(Math.floor(n * 100) / 100); // never rounds up a failing 4.499 to 4.5

/** Every innermost rule of the style: { selector, body, context }, context = the at-rule heads around it. */
function parseRules(css) {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(\[[^\]"']*?=\s*)(["'])([\w-]*)\2/g, '$1$3') // [data-theme="dark"] is read as [data-theme=dark] before the strings are blanked
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/url\([^)]*\)/gi, 'url()');
  const rules = [];
  const stack = [];
  let buf = '';
  for (const c of text) {
    if (c === '{') {
      const head = buf.slice(buf.lastIndexOf(';') + 1).trim();
      if (stack.length) stack[stack.length - 1].hasChild = true;
      stack.push({ head, hasChild: false });
      buf = '';
    } else if (c === '}') {
      const top = stack.pop();
      if (top && !top.hasChild) rules.push({ selector: top.head, body: buf, context: stack.map((s) => s.head) });
      buf = '';
    } else buf += c;
  }
  return rules;
}

function declarations(body) {
  const d = {};
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).replace(/!\s*important/i, '').trim();
    if (prop) d[prop] = val; // the last one wins
  }
  return d;
}

function skipContext(context) {
  return context.some((h) => /^@(?:-webkit-)?keyframes\b|^@font-face\b|^@page\b|^@property\b/i.test(h) || /^@media[^{]*\bprint\b/i.test(h));
}

const isDarkMedia = (context) => context.some((h) => /^@media[^{]*prefers-color-scheme\s*:\s*dark/i.test(h));

/** Replaces every var(--name) and var(--name, fallback) by its value; null when one cannot be resolved. */
function resolveVars(value, vars) {
  let v = value;
  for (let i = 0; i < 10 && /var\(/i.test(v); i++) {
    let failed = false;
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/gi, (_, name, fallback) => {
      if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
      if (fallback !== undefined) return fallback.trim();
      failed = true;
      return '';
    });
    if (failed) return null;
  }
  return /var\(/i.test(v) ? null : v.trim();
}

/** What a selector list says about a custom property rule: is it on the root, is it dark, which colour style. null when it is not a plain root rule. */
function rootInfo(selector, context) {
  const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  let dark = isDarkMedia(context);
  let style = null;
  for (const p of parts) {
    if (!/^(?::root|html)(?![\w-])/i.test(p)) return null;
    const attrs = [...p.matchAll(/\[\s*([\w-]+)\s*=\s*([\w-]+)\s*\]/g)];
    const rest = p.replace(/:not\(\s*\[[^\]]*\]\s*\)/gi, '').replace(/\[[^\]]*\]/g, '').replace(/^(?::root|html)/i, '');
    if (rest.trim()) return null; // something we do not know (a class, a pseudo class)
    for (const [, name, val] of attrs) {
      const inNot = new RegExp(`:not\\(\\s*\\[\\s*${name}\\s*=\\s*${val}\\s*\\]\\s*\\)`, 'i').test(p);
      if (inNot) continue;
      if (name.toLowerCase() === 'data-theme') { if (val.toLowerCase() === 'dark') dark = true; }
      else if (name.toLowerCase() === 'data-style') style = val.toLowerCase();
      else return null; // another switch (for example a future look): not judged
    }
  }
  return { dark, style };
}

function buildPalettes(rules) {
  const layers = { base: {}, dark: {}, style: {}, darkStyle: {} };
  const styles = new Set();
  for (const rule of rules) {
    if (!rule.selector || rule.selector.startsWith('@') || skipContext(rule.context)) continue;
    const info = rootInfo(rule.selector, rule.context);
    if (!info) continue;
    const props = {};
    for (const [k, v] of Object.entries(declarations(rule.body))) if (k.startsWith('--')) props[k] = v;
    if (!Object.keys(props).length) continue;
    if (info.style) {
      styles.add(info.style);
      const bag = (info.dark ? layers.darkStyle : layers.style);
      bag[info.style] = { ...(bag[info.style] || {}), ...props };
    } else if (info.dark) layers.dark = { ...layers.dark, ...props };
    else layers.base = { ...layers.base, ...props };
  }
  const looks = [];
  for (const style of [null, ...[...styles].sort()]) {
    const light = { ...layers.base, ...(style ? layers.style[style] : {}) };
    const dark = { ...light, ...layers.dark, ...(style ? layers.darkStyle[style] : {}) };
    const tag = style ? ` (${style})` : '';
    looks.push({ name: `light${tag}`, dark: false, vars: light });
    looks.push({ name: `dark${tag}`, dark: true, vars: dark });
  }
  return looks;
}

const TOKEN_PAIRS = [
  ['--text', '--bg'], ['--text', '--card'],
  ['--muted', '--bg'], ['--muted', '--card'],
  ['--acc-t', '--bg'], ['--acc-t', '--card'],
  ['white', '--acc'],
];

function backgroundOf(d) {
  if ('background-color' in d && !('background' in d)) return d['background-color'];
  if ('background' in d && !('background-color' in d)) return d.background;
  if ('background' in d && 'background-color' in d) return d['background-color']; // the last of the two wins in the browser; the colour is the safe one to judge
  return null;
}

export function checkContrast(css) {
  const errors = [], warnings = [];
  if (typeof css !== 'string' || !css.trim()) return { errors: ['no style was found to check the contrast of text colours'], warnings };
  const rules = parseRules(css);
  const looks = buildPalettes(rules);

  // Part A: the colour tokens. One message per pair and ratio; it lists every look where the pair fails.
  const groups = new Map();
  for (const look of looks) {
    for (const [fgName, bgName] of TOKEN_PAIRS) {
      const fg = fgName === 'white' ? parseColor('white') : parseColor(resolveVars(`var(${fgName})`, look.vars) || '');
      const bg = parseColor(resolveVars(`var(${bgName})`, look.vars) || '');
      if (!fg || !bg) continue;
      const r = contrastRatio(fg, bg);
      if (r >= MIN_NORMAL) continue;
      const label = fgName === 'white' ? `white text on ${bgName}` : `${fgName} on ${bgName}`;
      const key = `${label}|${show(r)}`;
      if (!groups.has(key)) groups.set(key, { label, ratio: show(r), looks: [] });
      groups.get(key).looks.push(look.name);
    }
  }
  for (const g of groups.values()) {
    const where = g.looks.length === 1 ? `the ${g.looks[0]} look` : `the looks ${g.looks.join(', ')}`;
    errors.push(`${g.label} is ${g.ratio}:1 in ${where}; text must keep 4.5:1 (WCAG 1.4.3)`);
  }

  // Part B: a rule with both a text colour and a solid background.
  const reported = new Set();
  for (const rule of rules) {
    if (!rule.selector || rule.selector.startsWith('@') || skipContext(rule.context)) continue;
    const d = declarations(rule.body);
    if (/^none$/i.test(d.display || '')) continue;
    const fgRaw = d.color;
    const bgRaw = backgroundOf(d);
    if (fgRaw === undefined || bgRaw === null) continue;
    const darkOnly = isDarkMedia(rule.context) || /\[\s*data-theme\s*=\s*dark\s*\]/i.test(rule.selector);
    const lightOnly = !darkOnly && /\[\s*data-theme\s*=\s*light\s*\]/i.test(rule.selector) && !/:not\(\s*\[\s*data-theme\s*=\s*light/i.test(rule.selector);
    const usesVar = /var\(/i.test(fgRaw + bgRaw);
    const pool = looks.length ? looks : [{ name: 'light', dark: false, vars: {} }];
    for (const look of pool) {
      if (darkOnly && !look.dark) continue;
      if (lightOnly && look.dark) continue;
      const fgText = resolveVars(fgRaw, look.vars);
      const bgText = resolveVars(bgRaw, look.vars);
      if (fgText === null || bgText === null) continue;
      const fg = parseColor(fgText), bg = parseColor(bgText);
      if (!fg || !bg) continue;
      const r = contrastRatio(fg, bg);
      if (r >= MIN_NORMAL) continue;
      const key = `${rule.selector}|${fgText}|${bgText}`;
      if (reported.has(key)) continue;
      reported.add(key);
      const where = usesVar ? ` in the ${look.name} look` : '';
      const sel = rule.selector.length > 60 ? rule.selector.slice(0, 57) + '...' : rule.selector;
      if (r < MIN_ERROR_RULE) errors.push(`"${sel}" has text ${fgText} on ${bgText}, ${show(r)}:1${where}; the least allowed is 3:1 (WCAG 1.4.3)`);
      else warnings.push(`"${sel}" has text ${fgText} on ${bgText}, ${show(r)}:1${where}; normal text needs 4.5:1 (WCAG 1.4.3)`);
    }
  }
  return { errors, warnings };
}
