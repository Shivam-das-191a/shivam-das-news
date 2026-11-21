// Part 8at (POLISH, Image maps): a clickable picture (usemap, map, area) is wired correctly.
// A picture with usemap="#shop" and no <map name="shop"> has no clickable parts, an <area> with coords of the wrong length is ignored, and an <area> with a link and no alt is a link with no name.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these, and the dashboard preview shows nothing wrong.
// Pure function, no files, no network.
//   checkMaps(html): { errors, warnings }
//   errors:   an <img> usemap that is not "#" and a name, or names a map that is not on the page (the name is read as written, upper and lower case count);
//             a <map> with no name, an empty name, a name with a space or a name used by a second map;
//             an <area> with a shape that is not rect, circle, poly or default; with no coords (shape default needs none); with coords that are not numbers;
//             with coords of the wrong length (rect 4, circle 3, poly an even number of at least 6); an <area> with an href and no alt
//   warnings: a <map> that no <img usemap> uses; an <area> outside a <map>; an old shape name (rectangle, circ, polygon) that browsers still read
// Left out on purpose, so there is no false alarm: text inside comments, script, style and <template>; the case of a tag, an attribute and a value (except a map name);
//   a tag that is not in the list; names that only start with a listed word (<imgs>, <mapping>, <areas>); the usemap of an <object>.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<\/(map)\s*>|<(img|map|area)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const NUM = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const SHAPES = new Set(['rect', 'circle', 'poly', 'default']);
const OLD = { rectangle: 'rect', circ: 'circle', polygon: 'poly' };
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkMaps(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  const maps = []; // names of every <map> on the page
  const uses = []; // usemap names of every <img>
  let depth = 0;
  for (const m of html.matchAll(RE)) {
    if (m[2] !== undefined) { if (depth > 0) depth--; continue; } // </map>
    if (m[3] === undefined) continue; // a comment, script, style or template
    const tag = m[3].toLowerCase();
    const a = attrsOf(m[4]);
    if (tag === 'img') {
      if (!a.has('usemap')) continue;
      const v = a.get('usemap');
      if (!/^#\S+$/.test(v)) err(`an <img usemap="${short(v)}"> is not "#" and a map name; use usemap="#name"`);
      else uses.push(v.slice(1));
      continue;
    }
    if (tag === 'map') {
      const hasName = a.has('name') && a.get('name') !== '';
      if (!hasName) err('a <map> has no name, so no picture can use it; add name="..."');
      else if (/\s/.test(a.get('name'))) err(`a <map name="${short(a.get('name'))}"> has a space in its name; use letters, digits and hyphens`);
      else {
        const n = a.get('name');
        if (maps.includes(n)) err(`two <map> tags have the name "${short(n)}"; every map needs its own name`);
        else maps.push(n);
      }
      depth++;
      continue;
    }
    // an <area>
    if (depth === 0) warn('an <area> is outside a <map>, so no picture can use it; put it inside a <map>');
    const raw = a.has('shape') ? a.get('shape').toLowerCase() : '';
    let shape = raw === '' ? 'rect' : raw;
    if (OLD[shape]) { warn(`an <area shape="${raw}"> is an old name; use shape="${OLD[shape]}"`); shape = OLD[shape]; }
    else if (!SHAPES.has(shape)) { err(`an <area shape="${short(a.get('shape'))}"> is not rect, circle, poly or default`); continue; }
    if (a.has('href') && !a.has('alt')) err('an <area> with an href has no alt, so the link has no name; add alt="..."');
    if (shape === 'default') continue;
    if (!a.has('coords') || a.get('coords') === '') { err(`an <area shape="${shape}"> has no coords, so the browser ignores it; add coords="..."`); continue; }
    const coords = a.get('coords');
    const parts = coords.split(/[\s,]+/).filter(Boolean);
    if (!parts.length || !parts.every((p) => NUM.test(p))) { err(`an <area coords="${short(coords)}"> is not a list of numbers; use numbers like coords="0,0,100,50"`); continue; }
    const n = parts.length;
    const need = shape === 'rect' ? 'rect has 4 numbers' : shape === 'circle' ? 'circle has 3 numbers' : 'poly has an even number of at least 6 numbers';
    const ok = shape === 'rect' ? n === 4 : shape === 'circle' ? n === 3 : n >= 6 && n % 2 === 0;
    if (!ok) err(`an <area shape="${shape}" coords="${short(coords)}"> has ${n} numbers, but a ${need}`);
  }
  for (const u of uses) if (!maps.includes(u)) err(`an <img usemap="#${short(u)}"> names a map that is not on the page; add <map name="${short(u)}">`);
  for (const n of maps) if (!uses.includes(n)) warn(`a <map name="${short(n)}"> is not used by any <img usemap>; remove it or add usemap="#${short(n)}"`);
  return { errors, warnings };
}
