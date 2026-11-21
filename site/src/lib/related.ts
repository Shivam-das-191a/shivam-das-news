/** v0.7.0: related posts (LOGICS 5). Pure functions, unit tested.
 *  score = 3*sharedTags + 2*sameCategory + 2*keywordOverlap + recencyBoost (+ 0.5*popularity once analytics exists; no fake numbers before that). */
import { slugify } from './slug';

export interface RelPost {
  id: string;
  url: string;
  body?: string;
  data: { title: string; category: string; tags: string[]; focusKeyword: string; date: Date };
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'its', 'new', 'how', 'why', 'what', 'who', 'will', 'can', 'into', 'over', 'after', 'about', 'says', 'said']);

/** Lower-case words of 3+ letters or digits, without common filler words. */
export const keywords = (s: string): string[] =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));

export function relatedScore(cur: RelPost, other: RelPost, now: Date): { score: number; relevant: boolean } {
  const curTags = new Set(cur.data.tags.map((t) => slugify(t)).filter(Boolean));
  const sharedTags = other.data.tags.map((t) => slugify(t)).filter((t) => t && curTags.has(t)).length;
  const sameCategory = cur.data.category === other.data.category ? 1 : 0;
  const mine = new Set(cur.data.focusKeyword ? keywords(cur.data.focusKeyword) : keywords(cur.data.title).filter((w) => w.length >= 4));
  const theirs = new Set([...keywords(other.data.title), ...keywords(other.data.focusKeyword), ...other.data.tags.flatMap(keywords)]);
  const overlap = mine.size ? [...mine].filter((w) => theirs.has(w)).length / mine.size : 0;
  const ageDays = Math.max(0, (now.getTime() - other.data.date.getTime()) / 86_400_000);
  const recency = 1 / (1 + ageDays / 14);
  // A post is related only when it shares a tag, the category or some keywords. Recency alone never makes it related.
  return { score: 3 * sharedTags + 2 * sameCategory + 2 * overlap + recency, relevant: sharedTags > 0 || sameCategory > 0 || overlap > 0 };
}

/** Best `limit` related posts: never itself, none the body already links to, newest first on equal scores. */
export function relatedPosts<T extends RelPost>(cur: T, all: T[], now: Date, limit = 4): T[] {
  const body = cur.body ?? '';
  return all
    .filter((p) => p.id !== cur.id && p.url !== cur.url && !body.includes(p.url))
    .map((p) => ({ p, ...relatedScore(cur, p, now) }))
    .filter((x) => x.relevant)
    .sort((a, b) => b.score - a.score || b.p.data.date.getTime() - a.p.data.date.getTime() || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => x.p);
}
