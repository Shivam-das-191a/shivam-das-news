// Part 8ad (POLISH, Accessibility, Speed and Safety): the rel words and the preload hints of a built page are real.
// A typo such as rel="noopner" or rel="nofolow" is never reported: the browser silently ignores the unknown word, so the safety or the SEO hint is lost,
// and a preload with no "as" is thrown away, so the font or picture is fetched late or twice. Pure function, no files, no network.
//   checkRel(html): { errors, warnings }
//   errors:   a rel word on a, area or link that is almost, but not exactly, a real word (noopner, nofolow, stylesheeet, prelaod);
//             an empty rel on a link tag; a link with a rel that needs a file (stylesheet, icon, manifest, preload, preconnect, dns-prefetch, prefetch, modulepreload, alternate) and no href
//             (a preload that names its pictures with imagesrcset needs no href);
//             a preload or modulepreload with no "as", or an "as" that is not a real destination
//   warnings: a preload of a font with no crossorigin attribute (the browser fetches the font twice); rel="opener" on a link (the new page can control this one);
//             a rel word that only works on a link tag (stylesheet, preload, icon, manifest, canonical, ...) written on an a or area tag (it does nothing)
// Left out on purpose, so there is no false alarm: a rel word that is not near any real word (the rel list is open for extensions such as apple-touch-icon or webmention);
//   the case of a word (NoOpener is read as noopener); the canonical link (head-check-lib.mjs reads it); text inside script, style, template and comments.
// Why: links and hints written by hand in a post or a custom block (PLAN 37) can carry rel, and the safety of new-tab-lib.mjs and the speed rules of POLISH depend on the exact words.
const SKIP = /<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(a|area|link)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

// Words that matter most: a typo of one of these is an error.
const WATCHED = ['noopener', 'noreferrer', 'nofollow', 'sponsored', 'ugc', 'stylesheet', 'preload', 'preconnect', 'prefetch', 'dns-prefetch', 'modulepreload', 'alternate', 'manifest', 'icon', 'external', 'license', 'author', 'bookmark'];
// Every real word we know, so that an exact real word is never taken for a typo of another one.
const KNOWN = new Set([...WATCHED, 'opener', 'canonical', 'help', 'me', 'next', 'prev', 'previous', 'search', 'tag', 'pingback', 'prerender', 'privacy-policy', 'terms-of-service', 'expect', 'compression-dictionary',
  'apple-touch-icon', 'apple-touch-icon-precomposed', 'mask-icon', 'shortcut', 'shortlink', 'amphtml', 'sitemap', 'webmention', 'openid', 'openid2.provider', 'openid2.local_id', 'archives', 'index', 'start', 'contents', 'up', 'first', 'last', 'section', 'subsection', 'glossary', 'appendix', 'copyright', 'chapter', 'stylesheet/less', 'hub', 'self', 'edit', 'edituri', 'profile', 'import', 'publisher', 'dns-prefetch']);
const NEEDS_HREF = new Set(['stylesheet', 'icon', 'manifest', 'preload', 'preconnect', 'dns-prefetch', 'prefetch', 'modulepreload', 'alternate']);
const LINK_ONLY = new Set(['stylesheet', 'preload', 'preconnect', 'dns-prefetch', 'prefetch', 'modulepreload', 'icon', 'manifest', 'canonical']);
const AS_VALUES = ['audio', 'document', 'embed', 'fetch', 'font', 'image', 'object', 'script', 'style', 'track', 'video', 'worker'];

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}
// Edit distance in which swapping two neighbouring letters counts as one change (noopner, noopnere, nooepner).
function distance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
function nearMiss(word) {
  if (KNOWN.has(word) || word.length < 4) return null;
  let best = null, bestD = 99;
  for (const w of WATCHED) {
    const limit = w.length <= 6 ? 1 : 2;
    const dist = distance(word, w);
    if (dist <= limit && dist < bestD) { best = w; bestD = dist; }
  }
  return best;
}

export function checkRel(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(SKIP, '');
  for (const m of h.matchAll(TAG)) {
    if (!/\brel\b|\bas\b/i.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    const a = attrsOf(m[2]);
    const relRaw = a.get('rel');
    const words = relRaw === undefined ? [] : relRaw.toLowerCase().split(/\s+/).filter(Boolean);
    const where = tag === 'link' ? (a.get('href') ? short(a.get('href')) : '') : short(a.get('href') || '');
    if (tag === 'link' && relRaw !== undefined && words.length === 0) {
      errors.push('a <link> has an empty rel, so the browser ignores it');
      continue;
    }
    for (const w of words) {
      const near = nearMiss(w);
      if (near) errors.push(`a <${tag}> has rel word "${short(w)}", which looks like a typo of "${near}"; the browser ignores an unknown word, so use "${near}"`);
      if (tag !== 'link' && LINK_ONLY.has(w)) warnings.push(`an <${tag}> has rel="${w}", which only works on a <link> tag, so it does nothing here`);
      if (tag === 'a' && w === 'opener') warnings.push(`a link${where ? ' to ' + where : ''} has rel="opener", which lets the page it opens control this one; remove it or use noopener`);
    }
    if (tag !== 'link') continue;
    for (const w of words) {
      if (NEEDS_HREF.has(w) && !a.get('href') && !(w === 'preload' && a.get('imagesrcset'))) {
        errors.push(`a <link rel="${w}"> has no href, so the browser has nothing to load`);
        break;
      }
    }
    if (words.includes('preload') || words.includes('modulepreload')) {
      const kind = words.includes('preload') ? 'preload' : 'modulepreload';
      const as = a.get('as');
      if (kind === 'preload' && (as === undefined || as === ''))
        errors.push(`a <link rel="preload"${where ? ' href="' + where + '"' : ''}> has no "as", so the browser throws the hint away; add as="font", "image", "script" or "style"`);
      else if (as !== undefined && as !== '' && !AS_VALUES.includes(as.toLowerCase()))
        errors.push(`a <link rel="${kind}"> has as="${short(as)}", which is not a real value; use ${AS_VALUES.slice(0, 5).join(', ')} and so on`);
      else if (kind === 'preload' && (as || '').toLowerCase() === 'font' && !a.has('crossorigin'))
        warnings.push(`a font preload${where ? ' of ' + where : ''} has no crossorigin, so the browser fetches the font twice; add crossorigin`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
