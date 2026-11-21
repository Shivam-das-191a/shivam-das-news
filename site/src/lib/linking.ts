/** v0.9.0: one place that decides every internal link of an article: links inside the text (v0.8.0),
 *  "Related stories" (v0.7.0) and "Read next". Pure functions, unit tested. The page and the orphan report use the same plan,
 *  so the report matches what readers really see. */
import { autoLink, buildTargets, linkLimit, type LinkPost } from './autolink';
import { relatedPosts, type RelPost } from './related';
import { wordCount } from './readtime';

export interface PlanPost extends LinkPost, RelPost {
  body?: string;
  data: LinkPost['data'] & RelPost['data'] & { autoLinks: boolean };
  rendered?: { html?: string };
}

export interface LinkCtx {
  tags: { name: string; url: string }[];
  categories: { name: string; url: string }[];
  manual: { keyword: string; url: string }[];
  now: Date;
}

export interface LinkPlan<T> {
  html: string | undefined; // article text with auto links, or undefined when the rendered text is not available
  autoUsed: string[];
  related: T[];
  next: T | null;
  out: string[]; // addresses of other articles this article links to
}

/** "Read next": the nearest OLDER story of the same category, else the nearest newer one.
 *  Never a story the text of the article already links to (`exclude`). */
export function readNext<T extends { id: string; url: string; data: { category: string; date: Date } }>(cur: T, all: T[], exclude: Set<string>): T | null {
  const same = all.filter((p) => p.id !== cur.id && p.url !== cur.url && p.data.category === cur.data.category && !exclude.has(p.url));
  const t = cur.data.date.getTime();
  const byDate = (a: T, b: T) => a.data.date.getTime() - b.data.date.getTime() || a.id.localeCompare(b.id);
  const older = same.filter((p) => p.data.date.getTime() <= t).sort((a, b) => byDate(b, a))[0];
  if (older) return older;
  return same.filter((p) => p.data.date.getTime() > t).sort(byDate)[0] ?? null;
}

export function planLinks<T extends PlanPost>(post: T, all: T[], ctx: LinkCtx): LinkPlan<T> {
  const body = post.body ?? '';
  let html = post.rendered?.html;
  let autoUsed: string[] = [];
  if (post.data.autoLinks && html) {
    const targets = buildTargets({ cur: post, posts: all, tags: ctx.tags, categories: ctx.categories, manual: ctx.manual });
    const byHand = targets.map((t) => t.url).filter((u) => body.includes(u));
    const r = autoLink(html, targets, { limit: linkLimit(wordCount(body)), skipUrls: byHand });
    html = r.html;
    autoUsed = r.used;
  }
  // Related stories never repeat a story the text already links to (LOGICS 5).
  const related = relatedPosts({ ...post, body: `${body} ${autoUsed.join(' ')}` }, all, ctx.now, 4);
  // Read next is a different block from Related stories, so it only skips stories the text itself already links to.
  const seen = new Set<string>([...autoUsed, ...all.filter((p) => body.includes(p.url)).map((p) => p.url)]);
  const next = readNext(post, all, seen);
  const text = html ?? body;
  const out = new Set<string>();
  for (const p of all) if (p.url !== post.url && (text.includes(p.url) || body.includes(p.url))) out.add(p.url);
  for (const p of related) out.add(p.url);
  if (next) out.add(next.url);
  return { html, autoUsed, related, next, out: [...out] };
}
