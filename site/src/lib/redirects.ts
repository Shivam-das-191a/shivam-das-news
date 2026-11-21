/** Phase 4 (v0.4.0): redirect map builder (PLAN 9, LOGICS 3, BUGS U3, U4, U8). Pure functions, unit tested. */

export interface RedirectEntry { from: string; to: string }
export interface RedirectResult { map: Record<string, string>; problems: string[] }

export const MAX_HOPS = 10;
/** Cloudflare Pages allows 2000 static redirects per site. */
export const MAX_STATIC_REDIRECTS = 2000;

/** One path form: starts with "/", ends with "/", no host, no query, no hash. Returns null when it is not a usable path. */
export function normalizePath(input: string): string | null {
  let p = String(input || '').trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) { try { p = new URL(p).pathname; } catch { return null; } }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith('/')) return null;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  // Cloudflare treats ":" and "*" as placeholders, and spaces break the file format.
  if (/[\s*:]/.test(p)) return null;
  return p;
}

/**
 * entries: old URL -> URL of the post that now lives at its current address.
 * live: every URL that really exists in this build.
 * Rules: a source that is a live URL is dropped (loop guard); chains collapse to the final live URL;
 * a loop, a dead end or a second claim on the same source is dropped and reported.
 */
export function buildRedirects(entries: RedirectEntry[], live: Set<string>): RedirectResult {
  const problems: string[] = [];
  const raw = new Map<string, string>();
  for (const e of entries) {
    const from = normalizePath(e.from);
    const to = normalizePath(e.to);
    if (!from) { problems.push(`ignored "${e.from}": not a usable path`); continue; }
    if (!to) { problems.push(`ignored "${e.from}": target "${e.to}" is not a usable path`); continue; }
    if (live.has(from)) { problems.push(`dropped ${from}: it is a live page (loop guard)`); continue; }
    const prev = raw.get(from);
    if (prev && prev !== to) { problems.push(`conflict for ${from}: ${prev} and ${to}; kept ${prev}`); continue; }
    raw.set(from, to);
  }
  const map: Record<string, string> = {};
  for (const [from, first] of raw) {
    let cur = first;
    const seen = new Set([from]);
    let hops = 1;
    while (!live.has(cur) && raw.has(cur) && hops < MAX_HOPS) {
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = raw.get(cur)!;
      hops++;
    }
    if (!live.has(cur)) { problems.push(`dropped ${from}: it ends at ${cur}, which is not a live page`); continue; }
    if (cur === from) continue;
    map[from] = cur;
  }
  return { map, problems };
}

/** Cloudflare Pages `_redirects` file: one 301 per line, sorted so the file is stable between builds. */
export function toRedirectsFile(map: Record<string, string>): string {
  const lines = Object.keys(map).sort().map((from) => `${from} ${map[from]} 301`);
  return lines.join('\n') + (lines.length ? '\n' : '');
}
