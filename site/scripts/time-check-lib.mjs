
// Part 8z (POLISH, News and Search): every <time> of a built page holds a date or time that a machine can read.
// A news site shows dates on every story; search engines and readers' tools read the datetime value (WCAG 1.3.1, HTML time element).
// Pure function, no files, no network.
//   checkTimes(html): { errors, warnings }
//   errors:   a datetime that is empty or is not a valid year (4 digits; 20261119 is a typo, not a year), month, date, week, time, local date and time, date and time with offset (Z or +05:30), time zone offset or duration;
//             a date that does not exist (2026-02-30, month 13, hour 25)
//   warnings: a <time> with no datetime whose text is not itself a valid value (for example "November 19, 2026"), so a machine cannot read it
// Left out on purpose, so there is no false alarm: a <time> with no datetime and no text of its own (it holds other tags); the text of a <time> that has a datetime;
//   the 1 to 3 digit rule for fractions of a second (up to 9 digits are read); text inside script, style, template and comments.
// Why: a typed date such as 2026-11-31 or "19/11/2026" in datetime is silently ignored by every reader and by search engines, and a post written by the owner can carry hand typed HTML (PLAN 37).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TIME = /<time(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([^<]*)/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}
const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const dim = (y, m) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const pFn = (y) => (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)) % 7;
const weeks = (y) => (pFn(y) === 4 || pFn(y - 1) === 3 ? 53 : 52);

const isYear = (s) => /^\d{4}$/.test(s) && Number(s) > 0;
const isMonth = (s) => { const m = /^(\d{4})-(\d\d)$/.exec(s); return !!m && Number(m[1]) > 0 && Number(m[2]) >= 1 && Number(m[2]) <= 12; };
const isDate = (s) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return y > 0 && mo >= 1 && mo <= 12 && d >= 1 && d <= dim(y, mo);
};
const isYearless = (s) => { const m = /^(\d\d)-(\d\d)$/.exec(s); return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= dim(2000, Number(m[1])); };
const isWeek = (s) => { const m = /^(\d{4})-W(\d\d)$/.exec(s); return !!m && Number(m[1]) > 0 && Number(m[2]) >= 1 && Number(m[2]) <= weeks(Number(m[1])); };
const isTime = (s) => { const m = /^(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,9})?)?$/.exec(s); return !!m && Number(m[1]) < 24 && Number(m[2]) < 60 && (m[3] === undefined || Number(m[3]) < 60); };
const isOffset = (s) => { if (s === 'Z') return true; const m = /^[+-](\d\d)(?::?(\d\d))?$/.exec(s); return !!m && Number(m[1]) < 24 && (m[2] === undefined || Number(m[2]) < 60); };
const isLocal = (s) => { const m = /^([^T ]+)[T ](.+)$/.exec(s); return !!m && isDate(m[1]) && isTime(m[2]); };
const isGlobal = (s) => { const m = /^([^T ]+)[T ](\d\d:\d\d(?::\d\d(?:\.\d{1,9})?)?)(Z|[+-]\d\d(?::?\d\d)?)$/.exec(s); return !!m && isDate(m[1]) && isTime(m[2]) && isOffset(m[3]); };
const isDuration = (s) =>
  (/^P(?=\d|T\d)(?:\d+W)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/.test(s) && s !== 'P') ||
  /^(?:\s*\d+(?:\.\d+)?\s*[wdhms]\s*)+$/.test(s);

/** True when the text is any value the HTML time element accepts. */
export function isValidDatetime(v) {
  const s = String(v).trim();
  return !!s && (isYear(s) || isMonth(s) || isDate(s) || isYearless(s) || isWeek(s) || isTime(s) || isLocal(s) || isGlobal(s) || isOffset(s) || isDuration(s));
}

export function checkTimes(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TIME)) {
    const a = attrsOf(m[1]);
    const text = m[2].replace(/\s+/g, ' ').trim();
    if (a.has('datetime')) {
      const v = a.get('datetime');
      if (!isValidDatetime(v)) errors.push(`a <time> has datetime="${short(v)}", which is not a real date or time; write it like 2026-11-19 or 2026-11-19T10:30:00Z`);
    } else if (text && !isValidDatetime(text)) {
      warnings.push(`a <time> with no datetime holds "${short(text)}", which a machine cannot read; add datetime="2026-11-19"`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
