// Part 8p (POLISH, Accessibility and Mobile): nothing on a page is made wider than a 320px phone screen, so the page never scrolls sideways.
// Pure functions, no files, no network. They read text only; the build gate (validate-html.mjs) calls them.
//   checkSideScrollCss(css, flags): { errors, warnings }   (flags: { images, pre } = some built page has a picture, video or frame / a pre block)
//   checkSideScrollHtml(html): { errors, warnings }        (inline style="width:..." and width="..." attributes on layout tags)
// Only rules that apply on a 320px screen are read: rules inside @media print, inside @media (min-width: more than 320px) and inside @keyframes, @font-face or @page are left out.
// errors:   a rule (or an inline style) sets width or min-width to a fixed length wider than 320px (px, rem or em, 1rem = 16px) and does not cap it
//           (max-width of 100% or 320px or less, or overflow auto, scroll, hidden or clip on the same rule); the same for a width attribute on table, td, th, div, section, aside, pre or code
// warnings: width or min-width of 100vw (the scroll bar can push it past the screen); white-space nowrap or pre with no overflow and no wrapping on the same rule;
//           the pages have pictures, video or frames but no rule gives them max-width 100%; the pages have pre blocks but no rule lets them scroll or wrap
// Left out on purpose, so there is no false alarm: lengths made with calc(), var(), clamp(), min() or max() (they cannot be read as one number); percent and vw widths other than 100vw;
// max-width and the other kinds of lengths; text inside script, style, template and comments of a page.
const LIMIT = 320;
const SKIP_BLOCKS = /^@(?:keyframes|-webkit-keyframes|font-face|page|property|counter-style)\b/i;
const NEST = /^@(?:media|supports|layer|container|scope|document)\b/i;

function splitTop(text, sep) {
  const out = []; let depth = 0, cur = '', q = '';
  for (const ch of text) {
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')' && depth) depth--;
    if (ch === sep && !depth) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function declarations(body) {
  const d = {};
  for (const part of splitTop(String(body), ';')) {
    const i = part.indexOf(':');
    if (i < 1) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).replace(/!important/i, '').trim().toLowerCase();
    if (prop && val) d[prop] = val;
  }
  return d;
}

// All rules that apply on a 320px screen: [{ selector, decl }]
function rulesAt320(css, ctx = []) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i), semi = css.indexOf(';', i);
    if (brace === -1) break;
    if (semi !== -1 && semi < brace) { i = semi + 1; continue; } // @import, @charset
    const prelude = css.slice(i, brace).trim();
    let depth = 1, j = brace + 1;
    while (j < css.length && depth) { const ch = css[j]; if (ch === '{') depth++; else if (ch === '}') depth--; j++; }
    const inner = css.slice(brace + 1, depth ? css.length : j - 1);
    i = j;
    if (!prelude) continue;
    if (prelude[0] === '@') {
      if (SKIP_BLOCKS.test(prelude)) continue;
      if (NEST.test(prelude)) {
        if (/^@media/i.test(prelude) && !appliesAt320(prelude)) continue;
        out.push(...rulesAt320(inner, [...ctx, prelude]));
      }
      continue;
    }
    out.push({ selector: prelude.replace(/\s+/g, ' '), decl: declarations(inner) });
  }
  return out;
}

function px(value) {
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(String(value).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : n * 16;
}

function appliesAt320(media) {
  if (/\bprint\b/i.test(media) && !/\bnot\s+print\b/i.test(media)) return false;
  for (const m of media.matchAll(/min-width\s*:\s*(-?\d*\.?\d+)(px|rem|em)/gi)) {
    const w = parseFloat(m[1]) * (m[2].toLowerCase() === 'px' ? 1 : 16);
    if (w > LIMIT) return false;
  }
  return true;
}

const SCROLLS = /^(?:auto|scroll|hidden|clip)\b/;
function overflowsOwn(d) {
  for (const k of ['overflow', 'overflow-x', 'overflow-inline']) if (d[k] && SCROLLS.test(d[k])) return true;
  return false;
}
function capped(d) {
  const m = d['max-width'] ?? d['max-inline-size'];
  if (!m) return false;
  if (/^100%$/.test(m) || /^(?:100|[1-9]?\d)vw$/.test(m) || /^\d{1,2}(?:\.\d+)?%$/.test(m)) return true;
  const n = px(m);
  return n !== null && n <= LIMIT;
}
function wideProblem(d) {
  const found = [];
  for (const k of ['width', 'min-width', 'inline-size', 'min-inline-size']) {
    const v = d[k];
    if (!v || /\b(?:calc|var|clamp|min|max)\(/.test(v)) continue;
    const n = px(v);
    if (n !== null && n > LIMIT) found.push({ k, v, n });
    else if (v === '100vw') found.push({ k, v, n: -1 });
  }
  return found;
}

const MEDIA_SEL = /(?:^|[\s,>+~])(?:img|picture|video|iframe|svg|embed|object|\*)(?=$|[\s,.:#\[>+~])/i;
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

export function checkSideScrollCss(css, flags = {}) {
  const errors = [], warnings = [];
  if (typeof css !== 'string' || !css.trim()) return { errors, warnings };
  const c = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = rulesAt320(c);
  let imgCap = false, preOk = false;
  for (const { selector, decl } of rules) {
    for (const f of wideProblem(decl)) {
      if (f.n === -1) {
        if (!overflowsOwn(decl)) warnings.push(`the rule "${short(selector)}" sets ${f.k} to 100vw; a scroll bar can push it past a phone screen, use 100% instead`);
      } else if (!capped(decl) && !overflowsOwn(decl)) {
        errors.push(`the rule "${short(selector)}" sets ${f.k} to ${f.v}, wider than a ${LIMIT}px phone screen, so the page would scroll sideways; use max-width: 100% or put it in a min-width media query`);
      }
    }
    const ws = decl['white-space'];
    if (ws && /^(?:nowrap|pre)(?![-\w])/.test(ws) && !overflowsOwn(decl) && !decl['text-overflow'] && !/^(?:anywhere|break-word)$/.test(decl['overflow-wrap'] || decl['word-wrap'] || ''))
      warnings.push(`the rule "${short(selector)}" sets white-space to ${ws} with no scroll, no ellipsis and no wrapping; a long line can run out of a phone screen`);
    if ((decl['max-width'] === '100%' || decl.width === '100%') && MEDIA_SEL.test(selector)) imgCap = true;
    if (/(?:^|[\s,>+~])(?:pre|code)(?=$|[\s,.:#\[>+~])/i.test(selector)) {
      if (overflowsOwn(decl) || /^(?:pre-wrap|pre-line|break-spaces|normal)\b/.test(decl['white-space'] || '') || /^(?:anywhere|break-word)$/.test(decl['overflow-wrap'] || decl['word-wrap'] || '') || decl['word-break'] === 'break-all') preOk = true;
    }
  }
  if (flags.images && !imgCap)
    warnings.push('the pages have pictures, video or frames but no rule gives them max-width: 100%; a wide picture can push the page past a phone screen');
  if (flags.pre && !preOk)
    warnings.push('the pages have pre blocks but no rule lets them scroll or wrap (overflow-x: auto, or white-space: pre-wrap); long code lines can run out of a phone screen');
  return { errors, warnings: [...new Set(warnings)] };
}

const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(table|td|th|div|section|aside|pre|code|p|span|ul|ol|li|a|img|figure|main|header|footer|nav|article)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const WIDTH_ATTR_TAGS = new Set(['table', 'td', 'th', 'div', 'section', 'aside', 'pre', 'code']);

function attr(text, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(text);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

export function checkSideScrollHtml(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    const name = m[1].toLowerCase();
    const style = attr(m[2], 'style');
    if (style) {
      const d = declarations(style);
      for (const f of wideProblem(d)) {
        if (f.n === -1) { if (!overflowsOwn(d)) warnings.push(`a <${name}> has an inline ${f.k} of 100vw; use 100% instead`); }
        else if (!capped(d) && !overflowsOwn(d))
          errors.push(`a <${name}> has an inline ${f.k} of ${f.v}, wider than a ${LIMIT}px phone screen; use max-width: 100%`);
      }
    }
    if (WIDTH_ATTR_TAGS.has(name)) {
      const w = attr(m[2], 'width');
      if (w !== null && /^\d+(?:px)?$/.test(w.trim()) && parseInt(w, 10) > LIMIT && !(style && capped(declarations(style))))
        errors.push(`a <${name}> has a width attribute of ${w.trim()}, wider than a ${LIMIT}px phone screen; remove it and let the style set the width`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
