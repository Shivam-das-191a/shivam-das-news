// Part 8af (POLISH, Speed and Mobile): the srcset and sizes of every picture of a built page can be read by a browser.
// A broken srcset is never reported: the browser silently drops the bad candidate or the whole list, so a phone downloads the big picture, or the page falls back to the plain src.
// A sizes of "100%" is the usual slip (it is not a length), and a w descriptor with no sizes makes the browser assume the picture fills the whole screen.
// Pure function, no files, no network.
//   checkSrcset(html): { errors, warnings }
//   errors:   on img and source: an empty srcset; a candidate with a descriptor that is not a whole number plus w (400w) or a positive number plus x (2x), or with more than one descriptor;
//             a srcset that mixes w and x descriptors; the same descriptor twice (400w and 400w); a candidate address on http:// (mixed content);
//             an empty sizes; a sizes whose last item is not a length (100%, auto-fill) or whose other items do not start with a media condition in brackets
//   warnings: a srcset with w descriptors and no sizes (the browser assumes 100vw); a sizes with no srcset or with a srcset of x descriptors only (it does nothing)
// Left out on purpose, so there is no false alarm: a srcset with no descriptor at all (one plain address means 1x); sizes="auto" (it is real on a lazy picture); the case of a value;
//   a comma inside an address when no space follows it; text inside script, style, template and comments; the imagesrcset of a link tag (rel-check-lib.mjs reads that tag).
// Why: the hosted pictures get a srcset and sizes from picture-set.ts (PLAN 34.5), and a picture written by hand in a post (PLAN 37) can carry its own.
const SKIP = /<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(img|source)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const FAST = /(?:^|[\s"'])(?:srcset|sizes)(?=[\s=>/]|$)/i;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);
const UNIT = '(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|cap|lh|rlh|svw|svh|lvw|lvh|dvw|dvh|vi|vb)';
const LENGTH = new RegExp(`^(?:[+-]?(?:\\d+\\.?\\d*|\\.\\d+)${UNIT}|0|(?:calc|min|max|clamp)\\(.+\\))$`, 'i');
const CONDITIONED = new RegExp(`^(?:not\\s+)?\\(.*\\)\\s+(?:[+-]?(?:\\d+\\.?\\d*|\\.\\d+)${UNIT}|0|(?:calc|min|max|clamp)\\(.+\\))$`, 'i');

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}
// A comma ends a candidate only when a space (or the end) follows it, so a comma inside an address stays.
function candidatesOf(srcset) {
  return srcset.split(/,(?=\s)|,\s*$/).map((c) => c.trim()).filter(Boolean);
}
// Split a sizes value at the commas that are not inside brackets.
function sizeItems(sizes) {
  const items = [];
  let depth = 0, cur = '';
  for (const ch of sizes) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { items.push(cur.trim()); cur = ''; } else cur += ch;
  }
  items.push(cur.trim());
  return items;
}

export function checkSrcset(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    if (!FAST.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    let kind = null; // 'w' or 'x' when the srcset is read and fine
    if (a.has('srcset')) {
      const raw = a.get('srcset');
      if (raw === '') errors.push(`a <${tag}> has an empty srcset, which the browser ignores`);
      else {
        const seen = new Set();
        let bad = false, hasW = false, hasX = false;
        for (const cand of candidatesOf(raw)) {
          const parts = cand.split(/\s+/);
          const url = parts[0];
          if (/^http:\/\//i.test(url)) errors.push(`a <${tag}> srcset names ${short(url)} on http://, which a secure page blocks; use https://`);
          if (parts.length > 2) { errors.push(`a <${tag}> srcset candidate "${short(cand)}" has more than one descriptor; use one such as 400w or 2x`); bad = true; continue; }
          let key;
          if (parts.length === 1) { key = '1x'; hasX = true; }
          else {
            const d = parts[1].toLowerCase();
            if (/^\d+w$/.test(d) && parseInt(d, 10) > 0) { key = parseInt(d, 10) + 'w'; hasW = true; }
            else if (/^(?:\d+\.?\d*|\.\d+)x$/.test(d) && parseFloat(d) > 0) { key = parseFloat(d) + 'x'; hasX = true; }
            else { errors.push(`a <${tag}> srcset has the descriptor "${short(parts[1])}", which is not real; use a whole number and w (400w) or a number and x (2x)`); bad = true; continue; }
          }
          if (seen.has(key)) { errors.push(`a <${tag}> srcset uses ${key} twice, so the browser cannot choose between the pictures`); bad = true; }
          seen.add(key);
        }
        if (hasW && hasX) { errors.push(`a <${tag}> srcset mixes w and x descriptors, so the browser ignores the whole list; use only one kind`); bad = true; }
        if (!bad) kind = hasW ? 'w' : 'x';
      }
    }
    if (a.has('sizes')) {
      const raw = a.get('sizes');
      if (raw === '') errors.push(`a <${tag}> has an empty sizes, which the browser reads as 100vw; give the width the picture is drawn at, such as 100vw`);
      else if (raw.toLowerCase() !== 'auto') {
        const items = sizeItems(raw);
        const last = items[items.length - 1];
        const head = items.slice(0, -1);
        if (!LENGTH.test(last)) errors.push(`a <${tag}> sizes ends with "${short(last)}", which is not a length; use a width such as 100vw, 50vw or 640px (a percent is not allowed)`);
        else if (head.some((it) => !CONDITIONED.test(it)))
          errors.push(`a <${tag}> sizes has an item that is not a media condition in brackets and a length, such as (min-width: 800px) 640px`);
        if (!a.has('srcset')) warnings.push(`a <${tag}> has sizes but no srcset, so sizes does nothing`);
        else if (kind === 'x') warnings.push(`a <${tag}> has sizes but its srcset uses x descriptors only, so sizes does nothing`);
      }
    }
    if (kind === 'w' && !a.has('sizes') && tag === 'img') warnings.push(`an <img> has a srcset with w descriptors and no sizes, so the browser assumes the picture fills the screen and may load the biggest copy`);
    if (kind === 'w' && !a.has('sizes') && tag === 'source') warnings.push(`a <source> has a srcset with w descriptors and no sizes, so the browser assumes the picture fills the screen and may load the biggest copy`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
