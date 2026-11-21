/** LOGICS.md 17: a category is active if it has a published post in the last N days. */
export function activeCategories(
  posts: { category: string; date: Date }[],
  now: Date,
  days: number,
): string[] {
  const since = now.getTime() - days * 86_400_000;
  const set = new Set<string>();
  for (const p of posts) if (p.date.getTime() >= since && p.date.getTime() <= now.getTime()) set.add(p.category);
  return [...set];
}
