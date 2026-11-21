// Small front matter reader/writer for the post model (PLAN section 20). Pure, no dependencies.
// Writes JSON-style quoted strings, which are valid YAML, so Astro reads them without surprises.

const ORDER = ['title', 'permalink', 'category', 'tags', 'date', 'updated', 'author', 'description', 'metaTitle', 'focusKeyword',
  'image', 'imageAlt', 'imageCredit', 'keyPoints', 'canonical', 'ogTitle', 'ogDescription', 'ogImage', 'robots', 'location', 'schemaType', 'breaking', 'featured', 'trending',
  'push', 'pushTitle', 'pushBody', 'autoLinks', 'ads', 'redirects', 'status'];
const KEEP_EMPTY = new Set(['tags', 'redirects']);

function scalar(raw) {
  let v = raw.trim();
  if (v && !'"\'['.includes(v[0])) v = v.replace(/\s+#.*$/, '').trim(); // trailing comment
  if (v === '') return '';
  if (v[0] === '"') { try { return JSON.parse(v); } catch { return v.replace(/^"|"$/g, ''); } }
  if (v[0] === "'") return v.slice(1, v.endsWith("'") ? -1 : undefined).replace(/''/g, "'");
  if (v[0] === '[') {
    try { return JSON.parse(v); } catch {
      const inner = v.replace(/^\[|\]$/g, '').trim();
      return inner ? inner.split(',').map((x) => scalar(x)) : [];
    }
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseYaml(src) {
  const lines = src.split(/\r?\n/);
  const out = {};
  let i = 0;
  const indentOf = (l) => l.length - l.trimStart().length;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m || indentOf(line) > 0) { i++; continue; }
    const [, key, rest] = m;
    i++;
    if (/^[|>][+-]?$/.test(rest.trim())) {
      const folded = rest.trim()[0] === '>';
      const buf = [];
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) buf.push(lines[i++].trim());
      out[key] = (folded ? buf.join(' ') : buf.join('\n')).trim();
      continue;
    }
    if (rest.trim() !== '') { out[key] = scalar(rest); continue; }
    const kids = [];
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0 || lines[i].startsWith('- '))) kids.push(lines[i++]);
    const real = kids.filter((l) => l.trim());
    if (!real.length) { out[key] = ''; continue; }
    if (real[0].trim().startsWith('- ')) out[key] = real.map((l) => scalar(l.trim().slice(2)));
    else {
      const obj = {};
      for (const l of real) {
        const mm = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(l);
        if (mm) obj[mm[1]] = scalar(mm[2]);
      }
      out[key] = obj;
    }
  }
  return out;
}

export function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  return { data: parseYaml(m[1]), body: m[2] };
}

function emit(key, v) {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return v === '' && !KEEP_EMPTY.has(key) ? [] : [`${key}: ${key === 'date' || key === 'updated' ? v : JSON.stringify(v)}`];
  if (typeof v === 'boolean' || typeof v === 'number') return [`${key}: ${v}`];
  if (Array.isArray(v)) return v.length === 0 && !KEEP_EMPTY.has(key) ? [] : [`${key}: ${JSON.stringify(v)}`];
  if (typeof v === 'object') {
    const kids = Object.entries(v).flatMap(([k, x]) => emit(k, x).map((l) => '  ' + l));
    return kids.length ? [`${key}:`, ...kids] : [];
  }
  return [];
}

export function stringify(data, body) {
  const keys = [...ORDER.filter((k) => k in data), ...Object.keys(data).filter((k) => !ORDER.includes(k))];
  const lines = keys.flatMap((k) => emit(k, data[k]));
  return `---\n${lines.join('\n')}\n---\n${body.replace(/\s+$/, '')}\n`;
}
