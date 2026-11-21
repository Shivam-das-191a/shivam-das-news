/** v0.8.0: auto internal links inside the article text (PLAN section 7, LOGICS 4). Pure functions, unit tested.
 *  Works on the rendered HTML of one article. It links only inside paragraphs and list items, never inside
 *  headings, links, code, captions or buttons. Each target is linked once, never the post itself. */
import { slugify } from './slug';

export interface LinkTarget { phrase: string; url: string; weight: number }
export interface AutoLinkResult { html: string; used: string[] }

export interface LinkPost {
  id: string;
  url: string;
  data: { title: string; category: string; tags: string[]; focusKeyword: string; date: Date };
}

/** About one link per 250 words, at most 5 (LOGICS 4). */
export const linkLimit = (words: number): number => Math.min(5, Math.floor(words / 250));

// Weights: a hand-made entry always wins, then posts (same category, shared tag, other), then tag pages, then category pages.
const W = { manual: 100, sameCategory: 40, sharedTag: 30, post: 20, tag: 10, category: 5 };

const SAFE = /^[A-Za-z0-9][A-Za-z0-9 '-]*$/;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const words = (s: string) => (s ? s.split(' ').length : 0);

export function buildTargets(input: {
  cur: LinkPost;
  posts: LinkPost[];
  tags?: { name: string; url: string }[];
  categories?: { name: string; url: string }[];
  manual?: { keyword: string; url: string }[];
}): LinkTarget[] {
  const best = new Map<string, LinkTarget>(); // lower-case phrase -> best target
  const add = (raw: string, url: string, weight: number, minWords = 1) => {
    const phrase = clean(raw);
    if (phrase.length < 4 || !SAFE.test(phrase) || words(phrase) < minWords) return;
    if (!url.startsWith('/') || url.startsWith('//') || url === input.cur.url) return;
    const key = phrase.toLowerCase();
    const old = best.get(key);
    if (!old || weight > old.weight) best.set(key, { phrase, url, weight });
  };
  const curTags = new Set(input.cur.data.tags.map((t) => slugify(t)).filter(Boolean));
  for (const k of input.manual ?? []) add(k.keyword, k.url, W.manual);
  for (const p of input.posts) {
    if (p.id === input.cur.id || p.url === input.cur.url) continue;
    const shared = p.data.tags.some((t) => curTags.has(slugify(t)));
    const w = (p.data.category === input.cur.data.category ? W.sameCategory : shared ? W.sharedTag : W.post) + Math.min(5, p.data.date.getTime() / 1e13);
    // Posts are linked by a phrase of two or more words, so a common single word never points to one story.
    add(p.data.focusKeyword, p.url, w, 2);
    add(p.data.title, p.url, w - 1, 2);
  }
  for (const t of input.tags ?? []) add(t.name, t.url, W.tag);
  for (const c of input.categories ?? []) add(c.name, c.url, W.category);
  return [...best.values()];
}

const SKIP = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'script', 'style', 'figcaption', 'button', 'kbd', 'samp', 'textarea']);
const BLOCK = new Set(['p', 'li']);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function autoLink(html: string, targets: LinkTarget[], opts: { limit: number; skipUrls?: string[] }): AutoLinkResult {
  if (opts.limit <= 0 || !targets.length || !html) return { html, used: [] };
  const parts = html.split(/(<[^>]*>)/);
  let block = 0;
  const eligible: boolean[] = [];
  let skipping = 0;
  parts.forEach((part, i) => {
    if (part.startsWith('<') && part.endsWith('>')) {
      const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
      if (m && !part.endsWith('/>')) {
        const close = m[1] === '/';
        const name = m[2].toLowerCase();
        if (SKIP.has(name)) skipping = Math.max(0, skipping + (close ? -1 : 1));
        if (BLOCK.has(name)) block = Math.max(0, block + (close ? -1 : 1));
      }
      eligible[i] = false;
    } else eligible[i] = block > 0 && skipping === 0 && part.trim() !== '';
  });

  // Pass 1: the first match of every target in the eligible text.
  const skipUrls = new Set(opts.skipUrls ?? []);
  type Cand = { node: number; start: number; end: number; t: LinkTarget };
  const cands: Cand[] = [];
  for (const t of targets) {
    if (skipUrls.has(t.url)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9&])${esc(t.phrase).replace(/ /g, '\\s+')}(?![A-Za-z0-9;])`, 'i');
    for (let i = 0; i < parts.length; i++) {
      if (!eligible[i]) continue;
      const m = re.exec(parts[i]);
      if (m) { cands.push({ node: i, start: m.index, end: m.index + m[0].length, t }); break; }
    }
  }
  // Pass 2: best weight first, then longer phrase, then earlier position. No overlaps, each URL once.
  cands.sort((a, b) => b.t.weight - a.t.weight || b.t.phrase.length - a.t.phrase.length || a.node - b.node || a.start - b.start);
  const chosen: Cand[] = [];
  const usedUrls = new Set<string>();
  for (const c of cands) {
    if (chosen.length >= opts.limit) break;
    if (usedUrls.has(c.t.url)) continue;
    if (chosen.some((o) => o.node === c.node && c.start < o.end && o.start < c.end)) continue;
    chosen.push(c);
    usedUrls.add(c.t.url);
  }
  const byNode = new Map<number, Cand[]>();
  for (const c of chosen) byNode.set(c.node, [...(byNode.get(c.node) ?? []), c]);
  for (const [node, list] of byNode) {
    const text = parts[node];
    let out = '';
    let pos = 0;
    for (const c of list.sort((a, b) => a.start - b.start)) {
      out += text.slice(pos, c.start) + `<a href="${attr(c.t.url)}">${text.slice(c.start, c.end)}</a>`;
      pos = c.end;
    }
    parts[node] = out + text.slice(pos);
  }
  return { html: parts.join(''), used: chosen.map((c) => c.t.url) };
}
