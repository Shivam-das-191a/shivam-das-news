// Same rules as src/lib/url.ts. One site time zone for every date (BUGS U1).
export function dateParts(d, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day };
}

export function postUrl(category, slug, date, timeZone) {
  const { y, m, d } = dateParts(date, timeZone);
  return `/${y}/${m}/${d}/blogs/${category}/${slug}/`;
}

function wall(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

const offset = (date, tz) => wall(date, tz) - Math.floor(date.getTime() / 1000) * 1000;

/** 'YYYY-MM-DDTHH:mm' typed in the site time zone to a real UTC Date. */
export function zonedToUtc(local, tz) {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, da] = d.split('-').map(Number);
  const [H, M] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, da, H, M);
  let utc = guess - offset(new Date(guess), tz);
  const again = offset(new Date(utc), tz);
  utc = guess - again;
  return new Date(utc);
}

/** A UTC Date as 'YYYY-MM-DDTHH:mm' wall time in the site time zone. */
export function utcToZoned(date, tz) {
  return new Date(wall(date, tz)).toISOString().slice(0, 16);
}
