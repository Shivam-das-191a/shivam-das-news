// Part 8c (POLISH): "image ratio 16:9 everywhere, no stretched images". Pure functions, no files, no network.
//   checkThumbRatio(html): every picture with the class "thumb" must say a width and a height of 16:9 (error otherwise);
//                          a picture with no width or height is left to img-check-lib.mjs (it warns there).
//   thumbCssProblem(css):  the style of ".thumb" must keep aspect-ratio 16/9 and object-fit cover; returns a plain sentence or null.
import { attrOf } from './img-check-lib.mjs';

const IMG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const RATIO = 16 / 9;
const TOLERANCE = 0.02;

const short = (s) => (s.length > 80 ? s.slice(0, 77) + '...' : s);

export function checkThumbRatio(html) {
  const errors = [];
  if (typeof html !== 'string') return errors;
  for (const tag of html.replace(SKIP, '').match(IMG) || []) {
    if (!(attrOf(tag, 'class') || '').split(/\s+/).includes('thumb')) continue;
    const ws = (attrOf(tag, 'width') || '').trim(), hs = (attrOf(tag, 'height') || '').trim();
    if (!ws || !hs) continue;
    const src = short((attrOf(tag, 'src') || '').trim() || '(no address)');
    const w = /^\d+$/.test(ws) ? Number(ws) : NaN, h = /^\d+$/.test(hs) ? Number(hs) : NaN;
    if (!(w > 0) || !(h > 0)) { errors.push(`a thumbnail has a width or height that is not a whole number above 0 (${ws} x ${hs}): ${src}`); continue; }
    if (Math.abs(w / h - RATIO) > TOLERANCE) errors.push(`a thumbnail is not 16:9 (${w} x ${h}): ${src}`);
  }
  return errors;
}

export function thumbCssProblem(css) {
  if (typeof css !== 'string') return 'no style was found for the class thumb';
  let body = '', found = false;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').some((sel) => sel.trim() === '.thumb')) { found = true; body += ';' + m[2]; }
  }
  if (!found) return 'no style was found for the class thumb';
  const flat = body.toLowerCase().replace(/\s+/g, '');
  if (!/aspect-ratio:16\/9(;|$|!)/.test(flat)) return 'the style of .thumb has lost aspect-ratio 16/9';
  if (!/object-fit:cover(;|$|!)/.test(flat)) return 'the style of .thumb has lost object-fit cover';
  return null;
}
