const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in']);

/** LOGICS.md 1: lower-case, strip accents, drop stop words, max 60 chars. */
export function slugify(input: string, max = 60): string {
  const words = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
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

export function uniqueSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
