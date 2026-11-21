// Two gates for task cards (Phase 3k Part 5; LOGICS 31.9 and 31.6).
//   node scripts/task-gate.mjs paths --branch ai/T-0006 [--files a,b,c | --base origin/main]
//       Every changed file must be inside the card's `paths` (the card's own file is always allowed).
//   node scripts/task-gate.mjs close T-0006 [--owners login1,login2]
//       May this card be closed? yellow and red need "Confirmed by <name>, <date>" in the Log from someone other than the doer;
//       red only from an owner login.
// Prints plain lines and GATE PASS or GATE FAIL. Exit 1 on failure. The workflow that runs it on pull requests is not built yet (it is under .github/).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseCard } from './task-lint-lib.mjs';
import { cardOfBranch, extraFiles, closeProblems } from './task-gate-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => { const i = rest.indexOf(n); return i === -1 ? '' : rest[i + 1] || ''; };
const finish = (bad, what) => { for (const b of bad) console.error(b); console.log(bad.length ? `GATE FAIL (${what}): ${bad.length} problem${bad.length === 1 ? '' : 's'}` : `GATE PASS (${what})`); process.exit(bad.length ? 1 : 0); };
const find = (id) => ['open', 'done'].map((f) => join(root, 'tasks', f, id + '.md')).find((p) => existsSync(p));

if (cmd === 'paths') {
  const id = cardOfBranch(flag('--branch'));
  if (!id) finish(['the branch must be named ai/T-0000 or human/T-0000'], 'paths');
  const file = find(id);
  if (!file) finish([`no card ${id} in tasks/open or tasks/done`], 'paths');
  const { fm } = parseCard(readFileSync(file, 'utf8'));
  let changed;
  if (flag('--files')) changed = flag('--files').split(',');
  else {
    const g = spawnSync('git', ['diff', '--name-only', `${flag('--base') || 'origin/main'}...HEAD`], { cwd: root, encoding: 'utf8' });
    if (g.status !== 0) finish(['could not read the changed files from git: ' + (g.stderr || '').trim().slice(0, 120)], 'paths');
    changed = g.stdout.split('\n');
  }
  const extra = extraFiles(id, fm.paths, changed);
  finish(extra.map((f) => `${f} is outside the paths of ${id}`), 'paths');
} else if (cmd === 'close') {
  const id = rest[0];
  if (!/^T-\d{4}$/.test(id || '')) finish(['usage: task-gate.mjs close T-0000 [--owners login1,login2]'], 'close');
  const file = find(id);
  if (!file) finish([`no card ${id} in tasks/open or tasks/done`], 'close');
  finish(closeProblems(readFileSync(file, 'utf8'), flag('--owners').split(',')), 'close');
} else {
  finish(['usage: task-gate.mjs paths --branch ai/T-0000 [--files a,b | --base origin/main]  or  task-gate.mjs close T-0000 [--owners a,b]'], 'usage');
}
