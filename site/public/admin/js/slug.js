// Same rules as src/lib/slug.ts (tests keep the two in sync).
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in']);

export function slugify(input, max = 60) {
  const words = String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w));
  const list = kept.length ? kept : words;
  let out = '';
  for (const w of list) {
    const next = out ? `${out}-${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || list.join('-').slice(0, max);
}

export function uniqueSlug(slug, taken) {
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
