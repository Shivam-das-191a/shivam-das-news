// Part 8n (POLISH, Final Pre-launch Sweep): every built page has a sound head: a title, one canonical with a full address,
// a robots tag that does not contradict itself, and the share tags. Pure functions, no files, no network.
//   checkHead(html): { errors, warnings, title, noindex }
//   errors:   no title, more than one title, an empty title; more than one canonical, or a canonical that is not a full
//             http(s) address; more than one meta description; more than one robots tag, or robots that says both index and
//             noindex; no og:title; an og:url or og:image that is not a full http(s) address
//   warnings: a title over 70 characters; an empty or a more than 160 character description; a canonical on http that is not
//             localhost; og:url that differs from the canonical; no og:image; no twitter:card; no theme-color
//   checkDuplicateTitles(list): warnings for indexable pages that share one title; list is [{ file, title, noindex }]
// Left out on purpose, so there is no false alarm: pages without a head (reported as one error); text inside script, style,
// template and comments; a missing canonical or a missing description (validate-html.mjs reports those already).
const SKIP = /<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi;
const TAGS = /<(meta|link)(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function attrs(text) {
  const out = {};
  for (const m of text.matchAll(ATTR)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function fullAddress(v) {
  try { const u = new URL(v); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname; } catch { return false; }
}

export function checkHead(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings, title: '', noindex: false };
  const headMatch = /<head(?=[\s>])[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html.replace(/<!--[\s\S]*?-->/g, ''));
  if (!headMatch) return { errors: ['the page has no head'], warnings, title: '', noindex: false };
  const head = headMatch[1].replace(SKIP, '');

  const titles = [...head.matchAll(/<title(?=[\s>])[^>]*>([\s\S]*?)<\/title\s*>/gi)].map((m) => decode(m[1]).replace(/\s+/g, ' ').trim());
  if (!titles.length) errors.push('no title tag');
  else if (titles.length > 1) errors.push(`more than one title tag (${titles.length})`);
  const title = titles[0] ?? '';
  if (titles.length && !title) errors.push('the title is empty');
  if (title.length > 70) warnings.push(`the title is ${title.length} characters; Google cuts it near 60 to 70`);

  const metas = [], links = [];
  for (const m of head.matchAll(TAGS)) (m[1].toLowerCase() === 'meta' ? metas : links).push(attrs(m[2]));
  const meta = (name) => metas.filter((a) => (a.name || '').toLowerCase() === name);
  const prop = (name) => metas.filter((a) => (a.property || '').toLowerCase() === name);

  const canon = links.filter((a) => (a.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canon.length > 1) errors.push(`more than one canonical link (${canon.length})`);
  const canonHref = (canon[0]?.href ?? '').trim();
  if (canon.length && !fullAddress(canonHref)) errors.push(`the canonical link is not a full http or https address: "${canonHref}"`);
  else if (canon.length && /^http:/i.test(canonHref) && !/^(localhost|127\.0\.0\.1)$/i.test(new URL(canonHref).hostname))
    warnings.push(`the canonical link uses http, not https: ${canonHref}`);

  const descs = meta('description');
  if (descs.length > 1) errors.push(`more than one meta description (${descs.length})`);
  if (descs.length) {
    const d = (descs[0].content ?? '').trim();
    if (!d) warnings.push('the meta description is empty');
    else if (d.length > 160) warnings.push(`the meta description is ${d.length} characters; Google shows about 160`);
  }

  const robots = meta('robots');
  if (robots.length > 1) errors.push(`more than one robots tag (${robots.length}); crawlers read them together`);
  const tokens = robots.flatMap((a) => (a.content ?? '').toLowerCase().split(',').map((t) => t.trim()));
  const noindex = tokens.includes('noindex') || tokens.includes('none');
  if (noindex && tokens.includes('index')) errors.push('the robots tag says both index and noindex');

  const ogTitle = prop('og:title');
  if (!ogTitle.length || !(ogTitle[0].content ?? '').trim()) errors.push('no og:title (the title shown when the page is shared)');
  const ogUrl = (prop('og:url')[0]?.content ?? '').trim();
  if (prop('og:url').length && !fullAddress(ogUrl)) errors.push(`og:url is not a full http or https address: "${ogUrl}"`);
  else if (ogUrl && canonHref && fullAddress(canonHref) && ogUrl !== canonHref) warnings.push(`og:url (${ogUrl}) is not the canonical (${canonHref})`);
  const ogImage = prop('og:image');
  if (!ogImage.length) warnings.push('no og:image (a shared link shows no picture)');
  else if (!fullAddress((ogImage[0].content ?? '').trim())) errors.push(`og:image is not a full http or https address: "${(ogImage[0].content ?? '').trim()}"`);
  if (!meta('twitter:card').length) warnings.push('no twitter:card tag');
  if (!meta('theme-color').length) warnings.push('no theme-color tag (the browser bar will not match the page)');

  return { errors, warnings, title, noindex };
}

export function checkDuplicateTitles(list) {
  const warnings = [];
  if (!Array.isArray(list)) return warnings;
  const groups = new Map();
  for (const e of list) {
    if (!e || e.noindex || typeof e.title !== 'string' || !e.title.trim()) continue;
    const k = e.title.trim().toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const shown = g.slice(0, 3).map((e) => e.file).join(', ') + (g.length > 3 ? `, and ${g.length - 3} more` : '');
    warnings.push(`${g.length} indexable pages share the title "${g[0].title}": ${shown}`);
  }
  return warnings;
}
