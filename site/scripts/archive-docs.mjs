// node scripts/archive-docs.mjs [--apply] [--keep-incomplete 2] [--keep-changelog 1] [--root <folder>]
// Moves old "Open Items After vX" blocks of INCOMPLETE.md and old entries of CHANGELOG.md to docs/archive/ (LOGICS 31.10, task T-0008).
// Without --apply it only shows the plan and changes nothing. With --apply it writes the archive first, checks that nothing was lost,
// then rewrites the main file; if the check fails it removes the archive file and leaves the main file as it was.
// Run it only after the owner answered decision 43 (the size budgets).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, rebuildMain, archiveText, archivePath, verifyLossless, isOpenItems, isChangelogEntry, wordsOf } from './archive-docs-lib.mjs';

const a = process.argv.slice(2);
const flag = (n, d) => { const i = a.indexOf(n); return i === -1 ? d : a[i + 1]; };
const apply = a.includes('--apply');
const root = flag('--root', join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const keeps = { 'INCOMPLETE.md': Number(flag('--keep-incomplete', 2)), 'CHANGELOG.md': Number(flag('--keep-changelog', 1)) };
const movable = { 'INCOMPLETE.md': isOpenItems, 'CHANGELOG.md': isChangelogEntry };
let failed = false;

for (const name of ['INCOMPLETE.md', 'CHANGELOG.md']) {
  const file = join(root, name);
  if (!existsSync(file)) { console.log(`${name}: not found, skipped`); continue; }
  const original = readFileSync(file, 'utf8');
  const p = plan(original, movable[name], keeps[name]);
  if (!p.moved.length) { console.log(`${name}: nothing to move (${wordsOf(original)} words)`); continue; }
  const rel = archivePath(name, p.range);
  const newMain = rebuildMain(p, rel);
  const arc = archiveText(name, p);
  const bad = verifyLossless(original, p, newMain, arc);
  console.log(`${name}: ${wordsOf(original)} words now; would keep ${p.kept.length} sections (${wordsOf(newMain)} words) and move ${p.moved.length} sections (${wordsOf(arc)} words) to ${rel}`);
  if (bad.length) { for (const b of bad) console.error('  ' + b); failed = true; continue; }
  if (!apply) continue;
  const target = join(root, rel);
  if (existsSync(target)) { console.error(`  ${rel} already exists; not overwritten`); failed = true; continue; }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, arc);
  if (readFileSync(target, 'utf8') !== arc) { rmSync(target); console.error('  the archive file did not read back the same; nothing changed'); failed = true; continue; }
  writeFileSync(file, newMain);
  console.log(`  done: ${name} rewritten, ${rel} written`);
}
console.log(failed ? 'ARCHIVE FAIL' : apply ? 'ARCHIVE DONE' : 'ARCHIVE PLAN ONLY (add --apply to write)');
process.exit(failed ? 1 : 0);
