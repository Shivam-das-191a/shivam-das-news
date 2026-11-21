// Part 8ap (POLISH, Inline SVG): an inline <svg> on a built page is safe, named or hidden, and able to scale.
// Every icon of this site is an inline SVG (PLAN 29.3). A picture that carries meaning needs a name for a screen reader; a decoration must be hidden from it.
// A <script> inside an <svg> and a picture loaded from http:// break the security rules of this site. Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) can carry any of these.
// Pure function, no files, no network.
//   checkSvg(html): { errors, warnings }
//   errors:   a <script> inside an <svg>; a <use> or <image> inside an <svg> whose href or xlink:href starts with http://;
//             an <svg role="img"> (or role="graphics-document") with no name (no aria-label, no aria-labelledby, no <title> with text) that is not aria-hidden
//   warnings: an <svg> with no role, no name and no aria-hidden (decoration should say aria-hidden="true"); an <svg aria-hidden="true"> that still has a name (the name is never read);
//             an <svg> with a width or height and no viewBox (it cannot scale on a small screen); a <foreignObject> (HTML inside SVG, drawn wrong by some browsers);
//             a <use href="#name"> that points to an id this page does not have
// Left out on purpose, so there is no false alarm: text inside comments, <style>, <template> and a <script> outside an <svg>; the case of a tag, an attribute and a value;
//   a nested <svg> (only the outer one is judged); a <title> outside an <svg> (the page title); a <use> to another file (/sprite.svg#a); an <svg> with width or height 0 and no viewBox;
//   names that only start with a listed word (<svg-icon>, <user>, <imagemap>).
const RE = /<!--[\s\S]*?-->|<(style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<script(?=[\s>/])[^>]*>[\s\S]*?<\/script\s*>|<title(?=[\s>/])[^>]*>([\s\S]*?)<\/title\s*>|<\/svg\s*>|<(svg|use|image|foreignobject)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const SCRIPT_START = /^<script/i;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ID = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const short = (s) => (s.length > 60 ? s.slice(0, 57) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

const isZero = (v) => /^0+(?:\.0+)?(?:px|em|rem|%)?$/i.test(v);

export function checkSvg(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  let ids = null;
  const idsOfPage = () => {
    if (ids) return ids;
    ids = new Set();
    for (const m of html.matchAll(ID)) ids.add(m[1] ?? m[2] ?? m[3] ?? '');
    return ids;
  };
  let depth = 0;
  let outer = null; // attributes of the outer <svg> being read
  let titled = false; // the outer <svg> holds a <title> with text
  const judge = (a, selfClosing) => {
    const hidden = (a.get('aria-hidden') || '').toLowerCase() === 'true';
    const role = (a.get('role') || '').toLowerCase();
    const label = !!(a.get('aria-label') || a.get('aria-labelledby'));
    const named = label || titled;
    if ((role === 'img' || role === 'graphics-document') && !named && !hidden) {
      err(`an <svg role="${role}"> has no name (no <title>, aria-label or aria-labelledby), so a screen reader says nothing useful; add one, or aria-hidden="true" if it is only decoration`);
    } else if (!role && !named && !hidden && a.get('role') === undefined) {
      warn('an <svg> has no name and is not hidden from screen readers; add aria-hidden="true" if it is decoration, or a <title> or aria-label if it carries meaning');
    }
    if (hidden && named) warn('an <svg aria-hidden="true"> has a name (<title>, aria-label or aria-labelledby) that no screen reader will ever read; remove the name or the aria-hidden');
    const w = a.get('width'), h = a.get('height');
    const sized = (w !== undefined && w !== '' && !isZero(w)) || (h !== undefined && h !== '' && !isZero(h));
    if (sized && !a.has('viewbox')) warn('an <svg> has a width or height and no viewBox, so it cannot scale on a small screen; add a viewBox');
    void selfClosing;
  };
  for (const m of html.matchAll(RE)) {
    const whole = m[0];
    if (whole.startsWith('<!--')) continue;
    if (m[1] !== undefined) continue; // a style or template block
    if (SCRIPT_START.test(whole)) {
      if (depth > 0) err('an <svg> holds a <script>, which the security rules of this site block and which a picture never needs; move the code out of the <svg>');
      continue;
    }
    if (m[2] !== undefined || /^<title/i.test(whole)) {
      if (depth > 0 && /\S/.test((m[2] || '').replace(/<[^>]*>/g, ''))) titled = true;
      continue;
    }
    if (/^<\/svg/i.test(whole)) {
      if (depth > 0) {
        depth--;
        if (depth === 0 && outer) { judge(outer, false); outer = null; }
      }
      continue;
    }
    const tag = (m[3] || '').toLowerCase();
    const raw = m[4] || '';
    if (tag === 'svg') {
      const selfClosing = /\/\s*$/.test(raw);
      if (depth === 0) { outer = attrsOf(raw); titled = false; }
      if (selfClosing) {
        if (depth === 0) { judge(outer, true); outer = null; }
      } else depth++;
      continue;
    }
    if (depth === 0) continue; // a <use>, <image> or <foreignObject> outside an <svg> is not SVG
    const a = attrsOf(raw);
    if (tag === 'foreignobject') { warn('an <svg> holds a <foreignObject>, which is HTML inside a picture and is drawn wrong by some browsers; use plain HTML next to the picture instead'); continue; }
    const href = a.get('href') ?? a.get('xlink:href') ?? '';
    if (/^http:\/\//i.test(href)) { err(`an <svg> <${tag}> loads ${short(href)}, which is not https; the browser blocks it on an https page`); continue; }
    if (tag === 'use' && /^#./.test(href) && !idsOfPage().has(href.slice(1))) warn(`an <svg> <use> points to ${short(href)}, but no element of this page has that id, so nothing is drawn`);
  }
  return { errors, warnings };
}
