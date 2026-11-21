// npm run tasks:check  (LOGICS 31, Phase 3k Part 2): checks every card in ../tasks/open and ../tasks/done.
// Prints one line per problem and "TASKS PASS" or "TASKS FAIL: N problems". Exit code 1 on failure.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintAll } from './task-lint-lib.mjs';

const root = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cards = [];
for (const folder of ['open', 'done']) {
  const dir = join(root, 'tasks', folder);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    cards.push({ file: `tasks/${folder}/${f}`, folder, text: readFileSync(join(dir, f), 'utf8') });
  }
}
const problems = lintAll(cards);
for (const p of problems) console.error(p);
console.log(problems.length ? `TASKS FAIL: ${problems.length} problem${problems.length === 1 ? '' : 's'}` : `TASKS PASS (${cards.length} cards)`);
process.exit(problems.length ? 1 : 0);
