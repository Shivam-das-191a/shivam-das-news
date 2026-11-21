// v0.2.3: pure helpers for IndexNow (unit tested in tests/unit/indexnow.test.ts).
// They turn a changed content file (from git) into the live URLs that must be pinged.

export function dateParts(d, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day };
}

/** Reads simple `key: value` lines from the front matter block. Returns null when there is none. */
export function parseFront(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (k) out[k[1]] = k[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** URL paths to ping for one changed content file: the page itself, its category page and the home page. */
export function pathsForContentFile(file, text, timeZone, now = new Date()) {
  const fm = parseFront(text);
  if (!fm || fm.status !== 'published') return [];
  const date = new Date(fm.date);
  if (Number.isNaN(date.getTime()) || date.getTime() > now.getTime()) return []; // scheduled: pinged when it goes live
  const { y, m, d } = dateParts(date, timeZone);
  if (/(^|\/)content\/blogs\//.test(file)) {
    if (!fm.category || !fm.permalink) return [];
    return [`/${y}/${m}/${d}/blogs/${fm.category}/${fm.permalink}/`, `/category/${fm.category}/`, '/'];
  }
  if (/(^|\/)content\/pages\//.test(file)) {
    if (!fm.permalink) return [];
    return [`/${y}/${m}/${d}/pages/${fm.permalink}/`, '/'];
  }
  return [];
}
