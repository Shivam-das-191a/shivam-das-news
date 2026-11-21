/** Phase 3b Part 8d-1 (v0.101.33): the pictures in public/media/ count as live addresses for the redirect builder (PLAN 33.3 "Rename: the old address is kept working").
 * Before this, a redirect from an old picture address to a new one was dropped as "ends at a page that is not live". Pure rules plus one small file reader. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PICTURE = /\.(webp|jpe?g|png|gif|svg|avif)$/i;

/** Every file under `dir` as a path relative to it, with "/" even on Windows. A missing folder gives []. Dot files (.gitkeep) are skipped. */
export function listMediaFiles(dir: string, base = ''): string[] {
  const here = base ? join(dir, base) : dir;
  if (!existsSync(here)) return [];
  const out: string[] = [];
  for (const e of readdirSync(here, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listMediaFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * files: paths relative to public/media/ (for example "2026/11/a.webp").
 * Returns the addresses the site serves, "/media/2026/11/a.webp". Only pictures; nothing with "..", a space, ":" or "*" (such an address could not be a redirect anyway).
 */
export function mediaUrls(files: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const rel = String(f ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel || rel.split('/').some((s) => s === '..' || s === '.' || s.startsWith('.'))) continue;
    if (!PICTURE.test(rel) || /[\s*:?#]/.test(rel)) continue;
    out.push(`/media/${rel}`);
  }
  return out;
}
