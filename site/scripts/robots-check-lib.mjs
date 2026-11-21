// Part 8az (POLISH, Robots tag words): the words of a robots meta tag are real ones.
// <meta name="robots" content="noindx"> looks right, but a crawler does not know the word and reads nothing: the page is indexed although the writer wanted it kept out.
// <meta name="robot"> (no s) is not read at all. max-image-preview:big is not a size a crawler knows. follow and nofollow in one tag contradict each other.
// head-check-lib.mjs reads "more than one robots tag" and "index and noindex together" and nothing else, so a typo of a word passed.
// Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) can carry these.
// Pure function, no files, no network.
//   checkRobots(html): { errors, warnings }
//   errors:   a word that is a typo of a real one (noindx, no-index, nofolow); a max-snippet, max-video-preview or max-image-preview with a value a crawler does not know;
//             a parameter word written wrong (max-snipet); follow and nofollow together; a meta name that is a typo of robots (robot, robtos)
//   warnings: an empty content; a word no crawler knows that is not a typo of one; a list with spaces and no commas (noindex nofollow); an old word that is ignored now (noodp, noydir);
//             an unavailable_after with a date that cannot be read; none together with another word
// Read on: <meta name="robots">, "googlebot", "googlebot-news" and "bingbot".
// Left out on purpose, so there is no false alarm: the case of a word, a name and a tag; spaces around a comma; more than one robots tag (head-check-lib.mjs reads it); index with noindex (head-check-lib.mjs reads it);
//   the meaning of a good list (noindex with max-snippet); a content written as a template expression ({value}); text inside comments, script, style and <template>; a meta tag with another name.
const RE = /<!--[\s\S]*?-->|<(script|style|template)(?=[\s>/])[\s\S]*?<\/\1\s*>|<(meta)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const NAMES = new Set(['robots', 'googlebot', 'googlebot-news', 'bingbot']);
const WORDS = new Set(['all', 'none', 'index', 'noindex', 'follow', 'nofollow', 'noarchive', 'nosnippet', 'notranslate', 'noimageindex', 'indexifembedded', 'nositelinkssearchbox', 'nopagereadaloud']);
const OLD = new Set(['noodp', 'noydir']);
const PARAMS = new Set(['max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after']);
const IMAGE_SIZES = new Set(['none', 'standard', 'large']);
const short = (s) => (s.length > 30 ? s.slice(0, 27) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** The real word this word is a typo of, or '' when it is not close to any. */
function typoOf(word, list) {
  const limit = word.length >= 6 ? 2 : 1;
  let best = '', bestD = 99;
  for (const w of list) {
    const d = distance(word, w);
    if (d <= limit && d < bestD) { best = w; bestD = d; }
  }
  return best;
}

export function checkRobots(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  for (const m of html.matchAll(RE)) {
    if (m[2] === undefined) continue; // a comment, script, style or template
    const a = attrsOf(m[3]);
    if (!a.has('name')) continue;
    const name = a.get('name').toLowerCase();
    if (!NAMES.has(name)) {
      if (name !== 'robots' && typoOf(name, ['robots']) === 'robots') {
        err(`a <meta name="${short(a.get('name'))}"> is not read by any crawler; the name is robots`);
      }
      continue;
    }
    const content = (a.get('content') ?? '').trim();
    if (/[{}]/.test(content)) continue; // a template expression such as content={value}: the real words are not here yet
    const tag = `<meta name="${name}">`;
    if (content === '') { warn(`a ${tag} has an empty content, so it says nothing; write for example index,follow`); continue; }
    if (!content.includes(',') && /\s/.test(content) && !/^[a-z_-]+\s*:/i.test(content)) {
      warn(`a ${tag} lists words with spaces and no commas ("${short(content)}"); separate the words with commas`);
    }
    const words = content.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const seen = new Set();
    for (const raw of content.toLowerCase().split(',')) {
      const w = raw.trim();
      if (!w) continue;
      const p = /^([a-z_-]+)\s*:\s*(.*)$/.exec(w);
      if (p) {
        const key = p[1], val = p[2].trim();
        if (!PARAMS.has(key)) {
          const t = typoOf(key, [...PARAMS]);
          if (t) err(`the word "${short(key)}" in a ${tag} is a typo of "${t}", so crawlers ignore it`);
          else warn(`the word "${short(key)}" in a ${tag} is not one a crawler knows`);
          continue;
        }
        if (key === 'max-image-preview' && !IMAGE_SIZES.has(val)) err(`max-image-preview:${short(val)} in a ${tag} is not a size a crawler knows; write none, standard or large`);
        else if ((key === 'max-snippet' || key === 'max-video-preview') && !/^-?\d+$/.test(val)) err(`${key}:${short(val)} in a ${tag} is not a number; write -1 (no limit), 0 or a number of ${key === 'max-snippet' ? 'characters' : 'seconds'}`);
        else if ((key === 'max-snippet' || key === 'max-video-preview') && Number(val) < -1) err(`${key}:${val} in a ${tag} is below -1; write -1 (no limit), 0 or a larger number`);
        else if (key === 'unavailable_after' && Number.isNaN(Date.parse(val))) warn(`unavailable_after:${short(val)} in a ${tag} is a date that cannot be read; write it like 25 Jun 2030 15:00:00 EST or 2030-06-25`);
        continue;
      }
      if (/\s/.test(w)) continue; // a list with spaces is warned about once above
      seen.add(w);
      if (WORDS.has(w)) continue;
      if (OLD.has(w)) { warn(`the word "${w}" in a ${tag} is old and ignored now; remove it`); continue; }
      const t = typoOf(w, [...WORDS]);
      if (t) err(`the word "${short(w)}" in a ${tag} is a typo of "${t}", so crawlers ignore it`);
      else warn(`the word "${short(w)}" in a ${tag} is not one a crawler knows`);
    }
    if (seen.has('follow') && seen.has('nofollow')) err(`a ${tag} says both follow and nofollow; keep one`);
    if (seen.has('none') && words.length > 1 && [...seen].some((w) => w !== 'none')) warn(`a ${tag} has none together with other words; none already means noindex,nofollow`);
  }
  return { errors, warnings };
}
