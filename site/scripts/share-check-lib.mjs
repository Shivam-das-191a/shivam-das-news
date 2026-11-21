// Part 8ba (POLISH, Share tag values): the share tags of a page hold real words and real values.
// <meta name="twitter:card" content="summary_large_img"> looks right, but the card falls back to a plain link. <meta property="og:titel"> is not read at all.
// og:image:width written as 1200px is refused, og:locale written as en-US is not the form Facebook reads and an article time that is not a date is dropped.
// head-check-lib.mjs reads "og:title is there", "og:url and og:image are full addresses", "og:url is the canonical" and "twitter:card is there", and nothing else,
// so a typo of a tag name or a wrong value passed. Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) can carry these.
// Pure function, no files, no network.
//   checkShareTags(html): { errors, warnings }
//   errors:   a tag name that is a typo of a real share tag (og:titel, twiter:card); a twitter:card or og:type that is a typo of a real value (summary_large_img, artcle);
//             an og:image:width or og:image:height that is not a whole number of pixels (1200px); an og:locale that is not written like en_US (en-US);
//             an article:published_time, article:modified_time or article:expiration_time that is not an ISO date or a date that does not exist (2026-02-30);
//             a twitter:image that is not a full http or https address; an og:image:secure_url that is not https
// warnings: an empty content; a twitter:card or og:type no platform knows that is not a typo of one; an og:locale with only a language (en);
//             a time written with a space instead of T; a modified time before the published time; an og:image or twitter:image from http://;
//             a tag that holds one value written twice; an og: or article: tag written with name= instead of property=;
//             a summary_large_image card with no picture tag; a twitter:site or twitter:creator that is not an @name
// Read on: <meta property="..."> and <meta name="...">, only when the name holds a colon (og:, twitter:, article:).
// Left out on purpose, so there is no false alarm: the case of a name and a value; a content written as a template expression ({value}); a name with no colon;
//   a name no share tag is close to (fb:app_id, al:ios:url, og:video:tag, twitter:label1); repeated og:image, og:image:alt and article:tag (they may repeat);
//   what head-check-lib.mjs reads (a missing og:title, og:url, og:image or twitter:card, an og:url that is not full or not the canonical, an og:image that is not full);
//   text inside comments, script, style and <template>; a meta tag with another name.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(meta)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const CARDS = ['summary', 'summary_large_image', 'app', 'player'];
const TYPES = ['website', 'article', 'book', 'profile', 'product', 'place', 'business.business',
  'video.movie', 'video.episode', 'video.tv_show', 'video.other',
  'music.song', 'music.album', 'music.playlist', 'music.radio_station'];
const KNOWN = new Set([
  'og:title', 'og:type', 'og:url', 'og:image', 'og:image:url', 'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt',
  'og:description', 'og:site_name', 'og:locale', 'og:locale:alternate', 'og:determiner', 'og:updated_time', 'og:see_also', 'og:ttl', 'og:video', 'og:audio',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'twitter:site', 'twitter:site:id', 'twitter:creator', 'twitter:creator:id',
  'twitter:url', 'twitter:label1', 'twitter:data1', 'twitter:label2', 'twitter:data2',
  'article:published_time', 'article:modified_time', 'article:expiration_time', 'article:author', 'article:section', 'article:tag',
]);
const SINGLE = ['og:title', 'og:type', 'og:url', 'og:site_name', 'og:description', 'og:locale', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image',
  'article:published_time', 'article:modified_time'];
const TIMES = ['article:published_time', 'article:modified_time', 'article:expiration_time'];
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

/** Edit distance where swapping two neighbouring letters counts as one change (titel is a typo of title). */
function distance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The real word this word is a typo of, or '' when it is not close to any. */
function typoOf(word, list, limit) {
  if (word.length > 60) return '';
  const max = limit ?? (word.length >= 8 ? 2 : 1);
  let best = '', bestD = 99;
  for (const w of list) {
    if (Math.abs(w.length - word.length) > max) continue;
    const dist = distance(word, w);
    if (dist <= max && dist < bestD) { best = w; bestD = dist; }
  }
  return best;
}

/** 'ok' for an ISO date or time, 'space' for the same with a space instead of T, 'bad' for anything else or a date that does not exist. */
function isoState(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:([T ])(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(v);
  if (!m) return 'bad';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1 || mo < 1 || mo > 12 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return 'bad';
  if (m[4] !== undefined) {
    if (Number(m[5]) > 23 || Number(m[6]) > 59 || (m[7] !== undefined && Number(m[7]) > 59)) return 'bad';
    if (m[4] === ' ') return 'space';
  }
  return 'ok';
}

export function checkShareTags(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  const seen = new Set(); // every share name on the page, even one with a template expression
  const counts = new Map(); // name -> how many times it is written with a real value
  const values = new Map(); // name -> the first real value
  const typos = new Map();
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const a = attrsOf(m[3]);
    const viaProperty = a.has('property');
    const raw = viaProperty ? a.get('property') : a.get('name');
    if (raw === undefined) continue;
    const key = raw.toLowerCase();
    if (!key.includes(':') || /[{}]/.test(key)) continue;
    const attr = viaProperty ? 'property' : 'name';
    const tag = `<meta ${attr}="${short(raw)}">`;
    if (!KNOWN.has(key)) {
      if (!typos.has(key)) typos.set(key, typoOf(key, [...KNOWN], 1));
      const t = typos.get(key);
      if (t) err(`${tag} is a typo of "${t}", so the share tags of this page lose it`);
      continue;
    }
    seen.add(key);
    const hasContent = a.has('content');
    const v = (a.get('content') ?? '').trim();
    if (/[{}]/.test(v)) continue; // a template expression such as content={value}: the real value is not here yet
    if (!hasContent || v === '') { warn(`${tag} has an empty content, so it says nothing`); continue; }
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!values.has(key)) values.set(key, v);
    if (attr === 'name' && (key.startsWith('og:') || key.startsWith('article:'))) warn(`${tag} is written with name=; Facebook and LinkedIn read property= for ${key}`);
    const low = v.toLowerCase();
    if (key === 'twitter:card') {
      if (!CARDS.includes(low)) {
        const t = typoOf(low, CARDS);
        if (t) err(`twitter:card "${short(v)}" is a typo of "${t}", so the card falls back to a plain link`);
        else warn(`twitter:card "${short(v)}" is not a card type any platform knows; use summary, summary_large_image, app or player`);
      }
    } else if (key === 'og:type') {
      if (!TYPES.includes(low)) {
        const t = typoOf(low, TYPES);
        if (t) err(`og:type "${short(v)}" is a typo of "${t}", so the page is shared as a plain website`);
        else warn(`og:type "${short(v)}" is not a type the Open Graph list has; use website or article for a news page`);
      }
    } else if (key === 'og:image:width' || key === 'og:image:height') {
      if (!/^[1-9]\d*$/.test(v)) err(`${key} "${short(v)}" is not a whole number of pixels; write 1200, not 1200px`);
    } else if (key === 'og:locale' || key === 'og:locale:alternate') {
      if (!/^[a-z]{2,3}_[A-Z]{2}$/.test(v)) {
        if (/^[a-z]{2,3}$/.test(v)) warn(`${key} "${v}" holds only a language; write the territory too, like en_US`);
        else if (/^[a-z]{2,3}[-_][A-Za-z]{2}$/i.test(v)) err(`${key} "${short(v)}" is not written the way Facebook reads it; write en_US (language, underscore, capital territory)`);
        else err(`${key} "${short(v)}" is not a locale such as en_US`);
      }
    } else if (TIMES.includes(key)) {
      const s = isoState(v);
      if (s === 'bad') err(`${key} "${short(v)}" is not a real ISO date or time; write it like 2026-11-20T09:17:00Z`);
      else if (s === 'space') warn(`${key} "${short(v)}" has a space between the date and the time; write a T there`);
    } else if (key === 'twitter:image') {
      if (/^http:\/\//i.test(v)) warn(`twitter:image is an http:// address; share an https:// picture`);
      else if (!/^https:\/\//i.test(v)) err(`twitter:image is not a full http or https address: "${short(v)}"`);
    } else if (key === 'og:image') {
      if (/^http:\/\//i.test(v)) warn(`og:image is an http:// address; share an https:// picture`);
    } else if (key === 'og:image:secure_url') {
      if (!/^https:\/\//i.test(v)) err(`og:image:secure_url "${short(v)}" must be an https:// address`);
    } else if (key === 'twitter:site' || key === 'twitter:creator') {
      if (!/^@[A-Za-z0-9_]{1,15}$/.test(v) && !/^\d+$/.test(v)) warn(`${key} "${short(v)}" is not an @name; write it like @yourname`);
    }
  }
  for (const key of SINGLE) {
    if ((counts.get(key) ?? 0) > 1) warn(`the share tag ${key} is written ${counts.get(key)} times; keep one`);
  }
  if ((values.get('twitter:card') ?? '').toLowerCase() === 'summary_large_image' && !seen.has('twitter:image') && !seen.has('og:image')) {
    warn('twitter:card is summary_large_image but the page has no twitter:image or og:image, so the card shows no picture');
  }
  const pub = values.get('article:published_time'), mod = values.get('article:modified_time');
  if (pub && mod && isoState(pub) !== 'bad' && isoState(mod) !== 'bad') {
    const p = Date.parse(pub.replace(' ', 'T')), q = Date.parse(mod.replace(' ', 'T'));
    if (!Number.isNaN(p) && !Number.isNaN(q) && q < p) warn(`article:modified_time (${mod}) is before article:published_time (${pub})`);
  }
  return { errors, warnings };
}
