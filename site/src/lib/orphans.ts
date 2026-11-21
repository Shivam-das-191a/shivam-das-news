/** v0.9.0: orphan report (PLAN section 7). An orphan is an article that no OTHER article links to
 *  (in its text, in "Related stories" or in "Read next"). Category and tag pages do not count, because
 *  they list every post and would hide the problem. Pure function, unit tested. */
export function findOrphans(edges: Map<string, string[]>): string[] {
  if (edges.size < 2) return []; // one article alone cannot be linked from anywhere
  const linked = new Set<string>();
  for (const [from, tos] of edges) for (const to of tos) if (to !== from) linked.add(to);
  return [...edges.keys()].filter((u) => !linked.has(u)).sort();
}
