// Part 8bl (POLISH, Accessibility, Speed and Safety): the media query of a media attribute of a built page is one a browser can read.
// A <link rel="stylesheet" media="...">, a <source media="..."> of a picture, a <style media="..."> and a <meta name="theme-color" media="..."> choose by a media query. A browser that cannot read the query
// treats it as "not all": the style sheet is never applied, the picture source is skipped, the dark theme colour never shows, and nothing is reported to the reader or to the owner.
// Pure function, no files, no network.
//   checkMediaQueries(html): { errors, warnings }
//   errors:   unbalanced brackets; empty brackets; a missing "and" between two conditions or between a type and a condition ("(min-width:600px)(max-width:900px)", "screen (min-width:600px)");
//             a query that starts or ends with and/or; a media type that is not a real one (screeen); a feature with no value ("(min-width:)");
//             a length (width, height, device-width, device-height) with no unit ("min-width: 600") or with a unit that is not a length; a resolution with no unit; an aspect ratio that is not 16/9 or a number;
//             a colour scheme, motion, contrast, orientation, hover or pointer feature with a value it does not have, or with min- or max- in front; a feature name that is one or two letters away from a real one (min-widht)
//   warnings: a media type that matches nothing in a modern browser (tty, tv, projection, handheld, braille, embossed, aural); a min-width that is larger than the max-width of the same query (it never matches)
// Read on: media on <link>, <source>, <style> and <meta> tags. Comments and <script>, <template> blocks are skipped; the text of a <style> block is not read (the CSS check reads it); the case is not read;
//   a list of queries separated by commas is read one query at a time.
// Left out on purpose, so there is no false alarm: an empty media (picture-check-lib.mjs reads an empty <source media>); the range syntax ((width >= 600px), (400px <= width <= 700px)) and any bracket that holds another bracket,
//   because only the balance of those is checked; feature names that are not near a real name (the list is open, vendor names such as -webkit-min-device-pixel-ratio are fine); the order of the queries; media="all" and media="screen".
// Why: a pasted <picture> or style sheet link (PLAN 37) carries a media query, and a query that fails does not fail loudly.
const SKIP = /<!--[\s\S]*?-->|<template(?=[\s>/])[\s\S]*?<\/template\s*>/gi;
const BLOCKS = /(<(?:script|style)(?=[\s>/])(?:"[^"]*"|'[^']*'|[^'">])*>)[\s\S]*?(<\/(?:script|style)\s*>)/gi;
const TAG = /<(link|source|style|meta)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const TYPES = new Set(['all', 'screen', 'print', 'speech']);
const OLD_TYPES = new Set(['tty', 'tv', 'projection', 'handheld', 'braille', 'embossed', 'aural']);
const LENGTH_FEATURES = new Set(['width', 'height', 'device-width', 'device-height']);
const UNIT = '(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|q|in|pt|pc|svw|svh|lvw|lvh|dvw|dvh)';
const LENGTH = new RegExp(`^(?:[+]?0|[+]?\\d*\\.?\\d+${UNIT})$`, 'i');
const ENUM = {
  'prefers-color-scheme': ['light', 'dark'],
  'prefers-reduced-motion': ['no-preference', 'reduce'],
  'prefers-contrast': ['no-preference', 'more', 'less', 'custom'],
  'prefers-reduced-data': ['no-preference', 'reduce'],
  'prefers-reduced-transparency': ['no-preference', 'reduce'],
  orientation: ['portrait', 'landscape'],
  hover: ['none', 'hover'], 'any-hover': ['none', 'hover'],
  pointer: ['none', 'coarse', 'fine'], 'any-pointer': ['none', 'coarse', 'fine'],
  'forced-colors': ['none', 'active'], 'inverted-colors': ['none', 'inverted'],
  scripting: ['none', 'initial-only', 'enabled'], update: ['none', 'slow', 'fast'],
  'display-mode': ['fullscreen', 'standalone', 'minimal-ui', 'browser', 'picture-in-picture', 'window-controls-overlay'],
};
const KNOWN = new Set([...Object.keys(ENUM), 'width', 'height', 'aspect-ratio', 'resolution', 'device-width', 'device-height', 'device-aspect-ratio', 'color', 'color-index', 'monochrome',
  'scan', 'grid', 'overflow-block', 'overflow-inline', 'color-gamut', 'dynamic-range', 'video-dynamic-range', 'device-pixel-ratio']);
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// brackets balanced? returns false when not
function balanced(s) {
  let depth = 0;
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

// split at top-level commas
function splitList(s) {
  const out = []; let depth = 0, cur = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

// items of one query: { group: 'inner text' } or { word: 'screen' }
function itemsOf(q) {
  const items = []; let i = 0;
  while (i < q.length) {
    if (/\s/.test(q[i])) { i++; continue; }
    if (q[i] === '(') {
      let depth = 0, j = i;
      for (; j < q.length; j++) { if (q[j] === '(') depth++; if (q[j] === ')' && --depth === 0) break; }
      items.push({ group: q.slice(i + 1, j) });
      i = j + 1;
    } else {
      let j = i;
      while (j < q.length && !/\s/.test(q[j]) && q[j] !== '(') j++;
      items.push({ word: q.slice(i, j) });
      i = j;
    }
  }
  return items;
}

function checkGroup(inner, errors, at) {
  const text = inner.trim();
  if (text === '') { errors.push(`${at} has empty brackets "()"`); return null; }
  if (text.includes('(') || /[<>=]/.test(text)) return null; // range syntax or nested: balance only
  const m = /^([a-z-]+)\s*(?::\s*(.*))?$/i.exec(text);
  if (!m) return null;
  const name = m[1].toLowerCase(), value = m[2] === undefined ? undefined : m[2].trim().toLowerCase();
  const base = name.replace(/^(?:min|max)-/, '');
  const ranged = base !== name;
  if (name.startsWith('-')) return null; // vendor name
  if (value === undefined) return null; // a boolean feature such as (hover) or (color)
  if (value === '') { errors.push(`${at} has the feature "${name}" with no value`); return null; }
  if (value.includes('(')) return null; // calc() and others
  if (ENUM[base]) {
    if (ranged) { errors.push(`${at} has "${name}", but ${base} takes no min- or max-; write (${base}: ${ENUM[base][0]})`); return null; }
    if (!ENUM[base].includes(value)) errors.push(`${at} has ${name}: ${short(value)}, which is not a value of ${name} (use ${ENUM[base].join(', ')})`);
    return null;
  }
  if (LENGTH_FEATURES.has(base)) {
    if (!LENGTH.test(value)) errors.push(`${at} has ${name}: ${short(value)}, which is not a length; a length needs a unit such as px or em (only 0 may stand alone)`);
    else { const px = /^([+]?\d*\.?\d+)px$/i.exec(value); if (px) return { name: base, ranged: name.slice(0, 3), px: parseFloat(px[1]) }; }
    return null;
  }
  if (base === 'resolution') {
    if (value !== 'infinite' && !/^\d*\.?\d+(?:dpi|dpcm|dppx|x)$/.test(value)) errors.push(`${at} has ${name}: ${short(value)}, which is not a resolution (write 2dppx, 192dpi or 2x)`);
    return null;
  }
  if (base === 'aspect-ratio' || base === 'device-aspect-ratio') {
    if (!/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(value)) errors.push(`${at} has ${name}: ${short(value)}, which is not a ratio (write 16/9)`);
    return null;
  }
  if (!KNOWN.has(base)) {
    const near = [...KNOWN].find((k) => distance(base, k) <= 2 && distance(base, k) > 0 && Math.abs(base.length - k.length) <= 2 && base.length >= 4);
    if (near) errors.push(`${at} has the feature "${name}"; do you mean "${ranged ? name.slice(0, 4) : ''}${near}"? A browser ignores an unknown feature and the query never matches`);
  }
  return null;
}

function checkQuery(raw, errors, warnings, at) {
  const q = raw.trim().toLowerCase();
  if (q === '') return;
  const items = itemsOf(q);
  const mins = new Map(), maxs = new Map();
  let prev = null;
  items.forEach((it, i) => {
    if (it.group !== undefined) {
      const hit = checkGroup(it.group, errors, at);
      if (hit) (hit.ranged === 'min' ? mins : hit.ranged === 'max' ? maxs : new Map()).set(hit.name, hit.px);
      if (prev && prev.group !== undefined)
        errors.push(`${at} has two conditions with no "and" between them (${short(q)}); a browser cannot read it and the query never matches`);
    } else {
      const w = it.word;
      if (i === 0 && (w === 'and' || w === 'or')) errors.push(`${at} starts with "${w}" (${short(q)}); a browser cannot read it and the query never matches`);
      else if (!['and', 'or', 'not', 'only'].includes(w)) {
        if (OLD_TYPES.has(w)) warnings.push(`${at} uses the media type "${w}", which matches nothing in a modern browser; use screen, print or all`);
        else if (!TYPES.has(w)) errors.push(`${at} has "${short(w)}", which is not a media type or condition (use all, screen or print); a browser cannot read it and the query never matches`);
        else if (items[i + 1] && items[i + 1].group !== undefined) errors.push(`${at} has the type "${w}" followed by a condition with no "and" (${short(q)}); write "${w} and (...)"`);
      }
      if (i === items.length - 1 && (w === 'and' || w === 'or' || w === 'not' || w === 'only')) errors.push(`${at} ends with "${w}" (${short(q)}); a browser cannot read it and the query never matches`);
    }
    prev = it;
  });
  for (const [name, lo] of mins) if (maxs.has(name) && lo > maxs.get(name)) warnings.push(`${at} has min-${name}: ${lo}px larger than max-${name}: ${maxs.get(name)}px, so it never matches`);
}

export function checkMediaQueries(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const page = html.replace(SKIP, ' ').replace(BLOCKS, '$1$2');
  for (const m of page.matchAll(TAG)) {
    const a = attrsOf(m[2]);
    if (!a.has('media')) continue;
    const tag = m[1].toLowerCase();
    if (tag === 'meta' && (a.get('name') || '').toLowerCase() !== 'theme-color') continue;
    if (tag === 'link' && !/(?:^|\s)(?:stylesheet|preload|alternate|prefetch|modulepreload|icon)(?:\s|$)/i.test(a.get('rel') || '')) continue;
    const media = (a.get('media') || '').trim();
    if (media === '') continue;
    const at = `the media "${short(media)}" of a <${tag}>`;
    if (!balanced(media)) { errors.push(`${at} has brackets that do not close; a browser cannot read it and the query never matches`); continue; }
    for (const q of splitList(media)) checkQuery(q, errors, warnings, at);
  }
  return { errors, warnings };
}
