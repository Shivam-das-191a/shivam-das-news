// Part 8as (POLISH, Range values): the numbers of a progress bar, a meter and a number or range field make sense.
// A <progress max="abc">, a <meter value="x"> or an <input type="number" min="abc"> is a typo the browser quietly repairs or ignores, so the bar, the gauge or the field behaves differently from what the writer meant.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) carry these.
// Pure function, no files, no network.
//   checkRanges(html): { errors, warnings }
//   errors:   max, value of a <progress>; min, max, low, high, optimum, value of a <meter>; min, max, step of an <input> whose type is number or range;
//             that is not a number at all ("abc", "", "5px"); step may also be "any"
//   warnings: a <progress> with max of 0 or below, or a value below 0 or above max; a <meter> with min above max, a value, low, high or optimum outside min to max, or low above high;
//             an <input type="number"> or <input type="range"> with min above max, a step of 0 or below, a value that is not a number or a value outside min to max
// Left out on purpose, so there is no false alarm: text inside comments, script, style and <template>; the case of a tag, an attribute and a value;
//   an <input> of any other type (date, text and so on); a tag that is not in the list; names that only start with a listed word (<progressive>, <meters>, <inputs>).
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(progress|meter|input)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const NUM = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
const EXAMPLE = { min: 0, max: 100, step: 1, value: 50, low: 20, high: 80, optimum: 50 };
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);
const art = (tag) => (/^[aeiou]/.test(tag) ? 'an' : 'a');

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

export function checkRanges(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const tag = m[2].toLowerCase();
    const a = attrsOf(m[3]);
    if (tag === 'input') {
      const type = (a.get('type') || '').toLowerCase();
      if (type !== 'number' && type !== 'range') continue;
    }
    const name = `${art(tag)} <${tag}`;
    // read one attribute: undefined when it is absent, NaN when it is not a number (an error is written)
    const read = (k) => {
      if (!a.has(k)) return undefined;
      const v = a.get(k);
      if (tag === 'input' && k === 'step' && v.toLowerCase() === 'any') return undefined;
      if (!NUM.test(v)) { err(`${name} ${k}="${short(v)}"> is not a number; use a number such as ${k}="${EXAMPLE[k]}"`); return NaN; }
      return Number(v);
    };
    const outside = (k, lo, hi, loText, hiText) => {
      const v = read(k);
      if (v === undefined || Number.isNaN(v)) return;
      if (lo !== undefined && !Number.isNaN(lo) && v < lo) warn(`${name} ${k}="${a.get(k)}"> is below ${loText}, so the browser changes it; use a number inside that range`);
      else if (hi !== undefined && !Number.isNaN(hi) && v > hi) warn(`${name} ${k}="${a.get(k)}"> is above ${hiText}, so the browser changes it; use a number inside that range`);
    };
    if (tag === 'progress') {
      const max = read('max');
      if (max !== undefined && !Number.isNaN(max) && max <= 0) warn(`${name} max="${a.get('max')}"> is 0 or below, so the browser uses 1; use a number above 0`);
      const top = max === undefined ? 1 : (Number.isNaN(max) || max <= 0 ? NaN : max);
      outside('value', 0, top, '0', 'max');
      continue;
    }
    if (tag === 'meter') {
      const min = read('min');
      const max = read('max');
      const lo = min === undefined ? 0 : min;
      const hi = max === undefined ? 1 : max;
      const both = !Number.isNaN(lo) && !Number.isNaN(hi);
      if (both && lo > hi) warn(`${name}> has a min above its max, so the browser treats max as min; use a min that is not above max`);
      const top = both && lo <= hi ? hi : NaN;
      const bottom = both && lo <= hi ? lo : NaN;
      for (const k of ['value', 'low', 'high', 'optimum']) outside(k, bottom, top, 'min', 'max');
      const low = read('low');
      const high = read('high');
      if (low !== undefined && high !== undefined && !Number.isNaN(low) && !Number.isNaN(high) && low > high) warn(`${name}> has a low above its high, so the browser changes it; use a low that is not above high`);
      continue;
    }
    // an <input> of type number or range
    const min = read('min');
    const max = read('max');
    const step = read('step');
    if (min !== undefined && max !== undefined && !Number.isNaN(min) && !Number.isNaN(max) && min > max) warn(`${name} type="${a.get('type').toLowerCase()}"> has a min above its max, so no value is allowed; use a min that is not above max`);
    if (step !== undefined && !Number.isNaN(step) && step <= 0) warn(`${name} step="${a.get('step')}"> is 0 or below, so the browser uses 1; use a number above 0 or "any"`);
    if (a.has('value') && a.get('value') !== '') {
      const v = a.get('value');
      if (!NUM.test(v)) warn(`${name} value="${short(v)}"> is not a number, so the browser leaves the field empty; use a number or no value`);
      else {
        const n = Number(v);
        if (min !== undefined && !Number.isNaN(min) && n < min) warn(`${name} value="${v}"> is below its min, so the browser changes it or marks the field wrong; use a number inside the range`);
        else if (max !== undefined && !Number.isNaN(max) && n > max) warn(`${name} value="${v}"> is above its max, so the browser changes it or marks the field wrong; use a number inside the range`);
      }
    }
  }
  return { errors, warnings };
}
