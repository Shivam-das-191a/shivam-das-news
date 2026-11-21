// npm run preflight  (Phase 3k Part 3): tests, build, content check, tasks check and document budgets.
// Prints one line per step and a last line "PREFLIGHT PASS" or "PREFLIGHT FAIL: <steps>". Exit code 1 on failure.
// Flags: --fast (skip tests and build, for a quick look), --strict-budgets (an over-budget document fails; the default is a warning
// until decision 43 is answered and task T-0008 has shrunk the documents).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordCount, budgetReport, summarize, vitestLine } from './preflight-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, '..');
const repoRoot = join(siteDir, '..');
const args = process.argv.slice(2);
const fast = args.includes('--fast');
const strict = args.includes('--strict-budgets');

const sh = (cmd, a) => spawnSync(cmd, a, { cwd: siteDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
const results = [];

if (fast) {
  results.push({ name: 'tests', status: 'skip', note: '--fast' }, { name: 'build', status: 'skip', note: '--fast' });
} else {
  const t = sh('npx', ['vitest', 'run']);
  results.push({ name: 'tests', status: t.status === 0 ? 'pass' : 'fail', note: vitestLine(t.stdout || '') });
  const b = sh('npm', ['run', 'build']);
  results.push({ name: 'build', status: b.status === 0 ? 'pass' : 'fail', note: b.status === 0 ? '' : 'see the output of npm run build' });
}

// The content check is task T-0007; until that script exists the step is skipped, never faked.
results.push(existsSync(join(siteDir, 'scripts', 'validate-content.mjs'))
  ? (() => { const c = sh('node', ['scripts/validate-content.mjs']); return { name: 'content', status: c.status === 0 ? 'pass' : 'fail', note: (c.stdout || '').trim().split('\n').pop() }; })()
  : { name: 'content', status: 'skip', note: 'scripts/validate-content.mjs does not exist yet (task T-0007)' });

const tk = sh('node', ['scripts/task-lint.mjs']);
results.push({ name: 'tasks', status: tk.status === 0 ? 'pass' : 'fail', note: (tk.stdout || '').trim().split('\n').pop() });
if (tk.status !== 0) process.stderr.write(tk.stderr || '');

const docs = readdirSync(repoRoot).filter((f) => f.endsWith('.md')).sort().map((name) => ({ name, words: wordCount(readFileSync(join(repoRoot, name), 'utf8')) }));
const { over, near } = budgetReport(docs);
for (const m of [...over, ...near]) console.log('  budget: ' + m);
results.push(over.length
  ? { name: 'budgets', status: strict ? 'fail' : 'warn', note: `${over.length} document${over.length === 1 ? '' : 's'} over budget` + (strict ? '' : ' (warning only until decision 43 and T-0008)') }
  : { name: 'budgets', status: 'pass', note: near.length ? `${near.length} near the limit` : '' });

const s = summarize(results);
for (const d of s.details) console.log(d);
console.log(s.line);
process.exit(s.ok ? 0 : 1);
