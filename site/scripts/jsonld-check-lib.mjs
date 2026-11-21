// Part 8bb (POLISH, Structured data): the JSON-LD blocks of a built page can be read by a search engine.
// <script type="application/ld+json"> holds the NewsArticle, the breadcrumbs and the publisher that Google reads for Top Stories, Discover and rich results.
// One comma too many, one wrong quote or a type written application/ld-json makes the whole block unreadable, and no message reaches the owner or the reader.
// script-check-lib.mjs leaves data blocks alone on purpose, so nothing read them. Old Blogger posts (XML import) and a snippet pasted by hand (PLAN 37) can carry these.
// Pure function, no files, no network.
//   checkJsonLd(html): { errors, warnings }
//   errors:   a script whose type is a typo of application/ld+json (application/ld-json, application/jsonld); a block that is not valid JSON;
//             a block that holds a plain value and not an object or a list; an @type that is a typo of a real schema.org type (NewsArtcle)
//             or has the wrong capital letters (newsarticle); a datePublished, dateModified, dateCreated or uploadDate that is not a real ISO date or time (2026-02-30)
// warnings: an empty block; a list that holds something that is not an object; a node with no @context or with an @context that is not https://schema.org;
//             a node with no @type; a text value that holds an HTML entity (&amp;), which search engines show as typed; a date with a space instead of T;
//             a dateModified before the datePublished
// Read on: <script type="application/ld+json"> (the case of the type and a charset after it are not read), and the other scripts only to catch a type that is a typo of it.
// Left out on purpose, so there is no false alarm: comments, <template> blocks; a block whose tag holds a template expression ({value}) or set:html (the real text is not there yet);
//   other data blocks (application/json, importmap, speculationrules); an @type that is not close to a listed type (it may be a real schema.org type);
//   an @type with a prefix (schema:Article); an @context that is a list or an object; the @type of a node deeper than the top node and the nodes of @graph;
//   what Google asks of a type (a required headline or image): that is the job of the Rich Results Test, not of the build.
const RE = /<!--[\s\S]*?-->|<template(?=[\s>/])[\s\S]*?<\/template\s*>|<script(?=[\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const LD = 'application/ld+json';
const TYPES = [
  'Thing', 'CreativeWork', 'Article', 'NewsArticle', 'BlogPosting', 'Report', 'LiveBlogPosting', 'OpinionNewsArticle', 'AnalysisNewsArticle',
  'ReportageNewsArticle', 'ReviewNewsArticle', 'BackgroundNewsArticle', 'SatiricalArticle', 'TechArticle', 'SocialMediaPosting', 'DiscussionForumPosting',
  'WebPage', 'WebSite', 'AboutPage', 'ContactPage', 'CollectionPage', 'SearchResultsPage', 'ProfilePage', 'FAQPage', 'Blog', 'Dataset', 'Series',
  'Organization', 'NewsMediaOrganization', 'Corporation', 'LocalBusiness', 'Person', 'Audience', 'Brand', 'PublishingPrinciples',
  'BreadcrumbList', 'ListItem', 'ItemList', 'SiteNavigationElement', 'WPHeader', 'WPFooter',
  'ImageObject', 'VideoObject', 'AudioObject', 'MediaObject', 'Photograph', 'Clip',
  'SearchAction', 'ReadAction', 'EntryPoint', 'PostalAddress', 'ContactPoint', 'Place', 'GeoCoordinates', 'Country', 'City',
  'Event', 'Review', 'Rating', 'Comment', 'Question', 'Answer', 'Product', 'Offer', 'Language', 'HowTo', 'HowToStep',
];
const TYPE_BY_LOW = new Map(TYPES.map((t) => [t.toLowerCase(), t]));
const DATES = ['datePublished', 'dateModified', 'dateCreated', 'uploadDate'];
const ENTITY = /&(?:amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});/i;
const short = (s) => (s.length > 40 ? s.slice(0, 37) + '...' : s);

function attrsOf(text) {
  const out = new Map();
  for (const m of text.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, (m[2] ?? m[3] ?? m[4] ?? '').trim());
  }
  return out;
}

/** Edit distance where swapping two neighbouring letters counts as one change (NewsArtcle is a typo of NewsArticle). */
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

/** The listed word this word is one change away from, or '' when it is not close to any. */
function typoOf(word, list) {
  if (word.length > 60 || word.length < 4) return '';
  let best = '';
  for (const w of list) {
    if (Math.abs(w.length - word.length) > 1) continue;
    if (distance(word, w) === 1) { best = w; break; }
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

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function checkJsonLd(html) {
  const errors = [], warnings = [];
  if (typeof html !== 'string') return { errors: ['the page is not text'], warnings };
  const said = new Set();
  const err = (m) => { if (!said.has('e' + m)) { said.add('e' + m); errors.push(m); } };
  const warn = (m) => { if (!said.has('w' + m)) { said.add('w' + m); warnings.push(m); } };
  let block = 0;
  const blocks = [];
  for (const m of html.matchAll(RE)) {
    if (m[1] === undefined) continue; // a comment or a template
    const open = m[1];
    const a = attrsOf(open);
    if (!a.has('type')) continue;
    const type = a.get('type').toLowerCase().split(';')[0].trim();
    if (type !== LD) {
      const flat = (type.split('/')[1] ?? '').replace(/[^a-z]/g, '');
      if (flat === 'ldjson' || flat === 'jsonld' || (flat.length >= 5 && distance(flat, 'ldjson') === 1)) {
        err(`<script type="${short(a.get('type'))}"> is a typo of "${LD}", so search engines never read this structured data`);
      }
      continue;
    }
    if (/[{}]/.test(open) || /(?:^|\s)set:html(?:\s|=|$)/i.test(open)) continue; // the real text is not here yet
    block++;
    blocks.push({ n: block, body: m[2] });
  }
  for (const { n, body } of blocks) {
    const where = blocks.length > 1 ? `structured data block ${n}` : 'the structured data block';
    const text = body.trim();
    if (text === '') { warn(`${where} (${LD}) is empty, so it says nothing`); continue; }
    let root;
    try {
      root = JSON.parse(text);
    } catch (e) {
      const hint = /^(<!--|<!\[CDATA\[|\/\/|\/\*)/.test(text) ? '; a comment or a CDATA wrapper is not JSON, remove it' : '';
      err(`${where} (${LD}) is not valid JSON (${String(e && e.message ? e.message : e).slice(0, 90)})${hint}, so search engines ignore all of it`);
      continue;
    }
    if (!isObject(root) && !Array.isArray(root)) { err(`${where} (${LD}) holds a plain value; it must be an object or a list of objects`); continue; }
    const tops = Array.isArray(root) ? root : [root];
    tops.forEach((node) => { if (!isObject(node)) warn(`${where} holds a list entry that is not an object, so search engines skip it`); });
    for (const top of tops.filter(isObject)) {
      if (!('@context' in top)) warn(`${where} has a node with no @context; write "@context": "https://schema.org"`);
      else if (typeof top['@context'] === 'string' && !/^https?:\/\/schema\.org\/?$/i.test(top['@context'].trim())) {
        warn(`${where} has an @context "${short(top['@context'])}" that is not https://schema.org`);
      }
      const nodes = Array.isArray(top['@graph']) ? top['@graph'].filter(isObject) : [top];
      if (Array.isArray(top['@graph']) && nodes.length < top['@graph'].length) warn(`${where} has a @graph entry that is not an object, so search engines skip it`);
      for (const node of nodes) {
        if (!('@type' in node)) { warn(`${where} has a node with no @type, so search engines do not know what it is`); continue; }
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        for (const t of types) {
          if (typeof t !== 'string' || t.includes(':') || /[{}]/.test(t) || TYPES.includes(t)) continue;
          const exact = TYPE_BY_LOW.get(t.toLowerCase());
          if (exact) { err(`${where} has an @type "${short(t)}" with the wrong capital letters; write "${exact}"`); continue; }
          const typo = typoOf(t, TYPES);
          if (typo) err(`${where} has an @type "${short(t)}" that is a typo of "${typo}", so search engines do not read this node`);
        }
      }
    }
    const walk = (v, depth) => {
      if (depth > 40) return;
      if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
      if (!isObject(v)) {
        if (typeof v === 'string' && ENTITY.test(v)) warn(`${where} holds the HTML entity "${ENTITY.exec(v)[0]}" in a text; search engines show it as typed, so write the real character`);
        return;
      }
      for (const [k, val] of Object.entries(v)) {
        if (DATES.includes(k) && typeof val === 'string') {
          const s = isoState(val.trim());
          if (s === 'bad') err(`${where} has a ${k} "${short(val)}" that is not a real ISO date or time; write it like 2026-11-20T09:17:00Z`);
          else if (s === 'space') warn(`${where} has a ${k} "${short(val)}" with a space between the date and the time; write a T there`);
        }
        walk(val, depth + 1);
      }
      const pub = v.datePublished, mod = v.dateModified;
      if (typeof pub === 'string' && typeof mod === 'string' && isoState(pub.trim()) !== 'bad' && isoState(mod.trim()) !== 'bad') {
        const p = Date.parse(pub.trim().replace(' ', 'T')), q = Date.parse(mod.trim().replace(' ', 'T'));
        if (!Number.isNaN(p) && !Number.isNaN(q) && q < p) warn(`${where} has a dateModified (${mod}) before its datePublished (${pub})`);
      }
    };
    walk(root, 0);
  }
  return { errors, warnings };
}
