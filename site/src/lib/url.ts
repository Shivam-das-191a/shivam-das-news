/** LOGICS.md 2: dates come from ONE configured site time zone (bug U1). */
export function dateParts(d: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day };
}

export function postUrl(category: string, slug: string, date: Date, timeZone: string) {
  const { y, m, d } = dateParts(date, timeZone);
  return `/${y}/${m}/${d}/blogs/${category}/${slug}/`;
}

export function pageUrl(slug: string, date: Date, timeZone: string) {
  const { y, m, d } = dateParts(date, timeZone);
  return `/${y}/${m}/${d}/pages/${slug}/`;
}

export const ampUrl = (url: string) => `${url}amp/`;
export const categoryUrl = (slug: string) => `/category/${slug}/`;
export const tagUrl = (slug: string) => `/tag/${slug}/`;
export const authorUrl = (slug: string) => `/author/${slug}/`;
