// Part 8aj (POLISH, HTML quality): the list, figure, details and form-group tags of a built page sit inside the parent HTML names for them.
// A list item outside a list, a figcaption outside a figure or an option outside a select is not repaired by the browser: it is shown as it is,
// and a screen reader does not announce "list of 5 items", "caption" or "choice". Pure function, no files, no network.
//   checkParents(html): { errors, warnings }
//   errors:   an <li> whose parent is not <ul>, <ol> or <menu>; a <dt> or <dd> whose parent is not <dl> (or a <div> inside a <dl>);
//             an <option> whose parent is not <select>, <datalist> or <optgroup>; an <optgroup> whose parent is not <select>;
//             a <figcaption> whose parent is not <figure>; a <legend> whose parent is not <fieldset>; a <summary> whose parent is not <details>;
//             a <source> whose parent is not <picture>, <video> or <audio>; a <track> whose parent is not <video> or <audio>
//   warnings: a <ul>, <ol> or <menu> with a direct child that is not <li>; a <dl> with a direct child that is not <dt>, <dd> or <div>;
//             a <details> with no <summary>; a <fieldset> with no <legend>
// Left out on purpose, so there is no false alarm: text inside script, style, template, svg, math, pre, code, kbd, samp, textarea, xmp and comments;
//   closing tags with no opening tag (they are ignored); the case of a tag; names that only start with a listed word (<link>, <listing-box>, <optionbar>);
//   an <li> end tag that is left out (the next <li>, <dt>, <dd> and <option> close the one before, as HTML says).
// Why: a post written by hand (PLAN 37) or an old Blogger post (PLAN 11) can hold "<li>" lines with no list around them, and the owner cannot see the fault on the page.
const SKIP = /<(script|style|template|svg|math|pre|code|kbd|samp|textarea|xmp)(?=[\s>/])[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const PARENTS = {
  li: ['ul', 'ol', 'menu'],
  dt: ['dl', 'div'],
  dd: ['dl', 'div'],
  option: ['select', 'datalist', 'optgroup'],
  optgroup: ['select'],
  figcaption: ['figure'],
  legend: ['fieldset'],
  summary: ['details'],
  source: ['picture', 'video', 'audio'],
  track: ['video', 'audio'],
};
const LISTS = new Set(['ul', 'ol', 'menu']);
const say = (list) => list.map((n) => `<${n}>`).join(', ');

export function checkParents(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, ' ');
  // each open element: { name, parent, summary, legend }
  const stack = [];
  const top = () => (stack.length ? stack[stack.length - 1] : null);
  const implied = (names, boundaries) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (boundaries.includes(stack[i].name)) return;
      if (names.includes(stack[i].name)) { stack.length = i; return; }
    }
  };
  const close = (name) => {
    let i = stack.length - 1;
    while (i >= 0 && stack[i].name !== name) i--;
    if (i < 0) return;
    const el = stack[i];
    if (name === 'details' && !el.summary) warnings.push('a <details> has no <summary>, so the reader sees only the word "Details"; add a <summary> with the label');
    if (name === 'fieldset' && !el.legend) warnings.push('a <fieldset> has no <legend>, so a screen reader cannot say what the group of fields is for; add a <legend>');
    stack.length = i;
  };
  for (const m of h.matchAll(TAG)) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (closing) { close(name); continue; }
    // end tags that HTML lets a writer leave out: the next item closes the one before it (and anything left open inside it)
    if (name === 'li') implied(['li'], ['ul', 'ol', 'menu']);
    else if (name === 'dt' || name === 'dd') implied(['dt', 'dd'], ['dl']);
    else if (name === 'option') implied(['option'], ['select', 'datalist', 'optgroup']);
    else if (name === 'optgroup') implied(['option', 'optgroup'], ['select']);
    const parent = top();
    const pname = parent ? parent.name : '';
    const want = PARENTS[name];
    if (want) {
      let ok = want.includes(pname);
      if ((name === 'dt' || name === 'dd') && pname === 'div') ok = !!(stack.length > 1 && stack[stack.length - 2].name === 'dl');
      if (!ok) errors.push(`a <${name}> sits ${pname ? `inside a <${pname}>` : 'outside any tag'}, but HTML wants it directly inside ${say(name === 'dt' || name === 'dd' ? ['dl'] : want)}; the browser does not repair it, so a screen reader does not announce it as part of the group`);
    }
    if (parent) {
      if (LISTS.has(pname) && name !== 'li') warnings.push(`a <${pname}> holds a <${name}> directly; only <li> belongs directly inside a list, so wrap the content in an <li>`);
      else if (pname === 'dl' && name !== 'dt' && name !== 'dd' && name !== 'div') warnings.push(`a <dl> holds a <${name}> directly; only <dt>, <dd> and <div> belong directly inside it`);
      if (name === 'summary' && pname === 'details') parent.summary = true;
      if (name === 'legend' && pname === 'fieldset') parent.legend = true;
    }
    const selfClosed = /\/\s*$/.test(m[3]);
    if (VOID.has(name) || selfClosed) continue;
    stack.push({ name });
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
