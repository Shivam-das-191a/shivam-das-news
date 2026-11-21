// Phase 3k Part 3 (PLAN 43, LOGICS 31.10): the rules behind `npm run preflight`. Pure functions, no file access.

export const BUDGETS = { 'AI_START_HERE.md': 900, 'INCOMPLETE.md': 8000, 'CHANGELOG.md': 20000 };
export const DEFAULT_BUDGET = 25000;
export const WARN_AT = 0.9;

/** Words in a text, counted like `wc -w`. */
export const wordCount = (text) => (String(text ?? '').match(/\S+/g) || []).length;

/** The budget of one root document. */
export const budgetOf = (name) => BUDGETS[name] ?? DEFAULT_BUDGET;

/**
 * files = [{ name, words }]. Returns { over: [...], near: [...] } with plain sentences.
 * "over" is above the budget; "near" is at 90 percent or more but not above.
 */
export function budgetReport(files) {
  const over = [], near = [];
  for (const f of files) {
    const max = budgetOf(f.name);
    if (f.words > max) over.push(`${f.name} has ${f.words} words, budget ${max}`);
    else if (f.words >= max * WARN_AT) near.push(`${f.name} has ${f.words} words, budget ${max} (90 percent reached)`);
  }
  return { over, near };
}

/**
 * results = [{ name, status: 'pass' | 'fail' | 'skip' | 'warn', note }].
 * Returns { ok, line, details }. line is "PREFLIGHT PASS" or "PREFLIGHT FAIL: <names>".
 */
export function summarize(results) {
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.name);
  const ok = failed.length === 0;
  const skipped = results.filter((r) => r.status === 'skip').map((r) => r.name);
  const warned = results.filter((r) => r.status === 'warn').map((r) => r.name);
  let line = ok ? 'PREFLIGHT PASS' : `PREFLIGHT FAIL: ${failed.join(', ')}`;
  const extra = [];
  if (skipped.length) extra.push(`skipped: ${skipped.join(', ')}`);
  if (warned.length) extra.push(`warnings: ${warned.join(', ')}`);
  if (extra.length) line += ` (${extra.join('; ')})`;
  const details = results.map((r) => `${r.name}: ${r.status}${r.note ? ' - ' + r.note : ''}`);
  return { ok, line, details };
}

/** The one-line result of a vitest run, from its output, or ''. */
export function vitestLine(out) {
  const files = /Test Files\s+(.+)/.exec(out);
  const tests = /\n\s*Tests\s+(.+)/.exec(out);
  return [files && 'files ' + files[1].replace(/\s+\(.*$/, ''), tests && 'tests ' + tests[1].replace(/\s+\(.*$/, '')].filter(Boolean).join(', ');
}
