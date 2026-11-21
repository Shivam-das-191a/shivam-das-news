// Part 8j (POLISH, Accessibility: "Tap targets are big enough for a finger"): a button, a link or a field is not drawn smaller than a finger can hit.
// Pure functions, no files, no network.
//   controlClassesOf(html): the class names that sit on a control of one built page (button, summary, select, textarea, input that is not hidden,
//                           a with href, anything with role="button"); an element with aria-hidden="true" is not counted.
//   checkTapTargets(css, classes): { errors, warnings }
//   The style is read rule by rule. A rule is about a control when the LAST part of one of its selectors is a control tag (button, summary, select, textarea,
//   input, a), or has one of the given classes, or has [role=button]. The size is the declared width, min-width, height and min-height in px, rem or em
//   (1rem = 16px); the biggest of width and min-width counts, the biggest of height and min-height counts.
//   errors:   a control is drawn under 24px wide or tall (WCAG 2.2, 2.5.8 Target Size Minimum)
//   warnings: a control is drawn under 44px wide or tall (the size this site uses for touch; WCAG 2.5.5, Apple and Google advice)
//   Not judged (no message, so no false alarm): a size in %, vw, calc(), var(), clamp() or auto; a rule with display:none; a rule that makes a thing
//   1px by 1px (a hidden trap field); a rule with box-sizing:content-box; a checkbox or a radio (its label is the tap area), a hidden input; a rule
//   about ::before or ::after; a rule inside @media print, @keyframes, @font-face, or a media query for a mouse only (pointer: fine, hover: hover).
//   Known limit: every rule is judged alone; a bigger size in a later rule does not cancel a small one (use a mouse only media query for a small size).
const COMMENT = /<!--[\s\S]*?-->/g;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^\'">])*';
const TAG = new RegExp(`<([a-z][a-z0-9-]*)(?=["'\\s>/])(${ATTRS})>`, 'gi');
const MIN_ERROR = 24;
const MIN_WARNING = 44;
const CONTROL_TAGS = new Set(['button', 'summary', 'select', 'textarea', 'input', 'a']);

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function controlClassesOf(html) {
  if (typeof html !== 'string') return [];
  const h = html.replace(COMMENT, '').replace(SKIP, '');
  const found = new Set();
  for (const m of h.matchAll(TAG)) {
    const name = m[1].toLowerCase();
    const tag = m[0];
    let control = false;
    if (name === 'button' || name === 'summary' || name === 'select' || name === 'textarea') control = true;
    else if (name === 'input') control = (attr(tag, 'type') || 'text').trim().toLowerCase() !== 'hidden';
    else if (name === 'a') control = attr(tag, 'href') !== null;
    if ((attr(tag, 'role') || '').trim().toLowerCase() === 'button') control = true;
    if (!control) continue;
    if ((attr(tag, 'aria-hidden') || '').trim().toLowerCase() === 'true') continue;
    for (const c of (attr(tag, 'class') || '').split(/\s+/)) if (c) found.add(c);
  }
  return [...found].sort();
}

/** Every innermost rule of the style: { selector, body, context } where context is the list of the at-rule heads around it. */
function parseRules(css) {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(\[[^\]"']*?=\s*)(["'])([\w-]*)\2/g, '$1$3') // [type="radio"] is read as [type=radio] before the strings are blanked
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

function skipContext(context) {
  return context.some((h) =>
    /^@(?:-webkit-)?keyframes\b|^@font-face\b|^@page\b|^@property\b/i.test(h) ||
    /^@media[^{]*\bprint\b/i.test(h) ||
    /^@media[^{]*\b(?:any-)?pointer\s*:\s*fine\b/i.test(h) ||
    /^@media[^{]*\bhover\s*:\s*hover\b/i.test(h));
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

/** A length in px, or null when it cannot be judged (%, vw, calc, var, auto ...). A bare 0 is 0px. */
function toPx(value) {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/i.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (!unit) return n === 0 ? 0 : null;
  return unit === 'px' ? n : n * 16;
}

/** The size one rule gives in one direction: the biggest of the size and the minimum size; null if nothing is declared or one part cannot be judged. */
function sizeOf(d, dim) {
  const values = [];
  for (const p of [dim, `min-${dim}`]) {
    if (!(p in d)) continue;
    const n = toPx(d[p]);
    if (n === null) return null;
    values.push(n);
  }
  return values.length ? Math.max(...values) : null;
}

function lastCompound(selector) {
  let s = selector.replace(/\[([^\]]*)\]/g, (m) => m.replace(/\s+/g, ''));
  for (let i = 0; i < 3; i++) s = s.replace(/\(([^()]*)\)/g, '()');
  return (s.trim().split(/\s*[>+~]\s*|\s+/).pop() || '');
}

function describeCompound(compound) {
  const pseudoElement = /::|:(?:before|after|first-line|first-letter)(?![\w-])/i.test(compound);
  const attrs = [...compound.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].toLowerCase());
  const bare = compound.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').replace(/:[a-z-]+/gi, '');
  const tag = ((/^([a-z][a-z0-9]*)/i.exec(bare) || [])[1] || '').toLowerCase();
  const classes = [...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  let type = '';
  let roleButton = false;
  for (const a of attrs) {
    const t = /^type=["']?([a-z]+)["']?$/.exec(a);
    if (t) type = t[1];
    if (/^role=["']?button["']?$/.test(a)) roleButton = true;
  }
  return { pseudoElement, tag, classes, type, roleButton };
}

const fmt = (n) => String(+n.toFixed(1));
const shorten = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

export function checkTapTargets(css, classes = []) {
  const errors = [], warnings = [];
  if (typeof css !== 'string' || !css.trim()) return { errors: ['no style was found to check the size of buttons and links'], warnings };
  const known = new Set(Array.isArray(classes) ? classes.filter((c) => typeof c === 'string') : []);
  const seenErrors = new Set(), seenWarnings = new Set();

  for (const rule of parseRules(css)) {
    if (!rule.selector || rule.selector.startsWith('@') || skipContext(rule.context)) continue;
    const d = declarations(rule.body);
    if (/^none$/i.test(d.display || '') || /^content-box$/i.test(d['box-sizing'] || '')) continue;
    const w = sizeOf(d, 'width');
    const h = sizeOf(d, 'height');
    if (w === null && h === null) continue;
    if (w !== null && h !== null && w <= 1 && h <= 1) continue; // a hidden trap field or a screen reader only part

    for (const sel of rule.selector.split(',')) {
      const part = describeCompound(lastCompound(sel));
      if (part.pseudoElement) continue;
      const control = CONTROL_TAGS.has(part.tag) || part.roleButton || part.classes.some((c) => known.has(c));
      if (!control) continue;
      if (part.tag === 'input' && ['hidden', 'checkbox', 'radio'].includes(part.type)) continue;
      if (part.tag === 'input' && part.type === '' && w !== null && w === h && w <= 32) continue; // a square box is a checkbox or a radio: its label is the tap area

      const name = shorten(sel.trim().replace(/\s+/g, ' '));
      const small = (limit) => {
        const out = [];
        if (w !== null && w < limit) out.push(`${fmt(w)}px wide`);
        if (h !== null && h < limit) out.push(`${fmt(h)}px tall`);
        return out;
      };
      const tooSmall = small(MIN_ERROR);
      if (tooSmall.length) {
        seenErrors.add(`"${name}" is drawn ${tooSmall.join(' and ')}; a tap target must be at least ${MIN_ERROR}px each way (WCAG 2.5.8)`);
        continue;
      }
      const notBig = small(MIN_WARNING);
      if (notBig.length)
        seenWarnings.add(`"${name}" is drawn ${notBig.join(' and ')}; this site uses ${MIN_WARNING}px for touch (WCAG 2.5.5), so a finger may miss it`);
    }
  }
  return { errors: [...seenErrors], warnings: [...seenWarnings] };
}
