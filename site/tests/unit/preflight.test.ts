import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { wordCount, budgetOf, budgetReport, summarize, vitestLine, BUDGETS, DEFAULT_BUDGET } from '../../scripts/preflight-lib.mjs';

describe('wordCount and budgetOf (LOGICS 31.10)', () => {
  it('counts words like wc -w', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  one two\nthree\t four  ')).toBe(4);
    expect(wordCount(null)).toBe(0);
  });
  it('has the budgets of decision 43', () => {
    expect(BUDGETS).toEqual({ 'AI_START_HERE.md': 900, 'INCOMPLETE.md': 8000, 'CHANGELOG.md': 20000 });
    expect(budgetOf('AI_START_HERE.md')).toBe(900);
    expect(budgetOf('LOGICS.md')).toBe(DEFAULT_BUDGET);
    expect(DEFAULT_BUDGET).toBe(25000);
  });
});

describe('budgetReport', () => {
  it('is quiet below 90 percent', () => {
    expect(budgetReport([{ name: 'AI_START_HERE.md', words: 800 }])).toEqual({ over: [], near: [] });
  });
  it('warns at 90 percent and stays below over', () => {
    const r = budgetReport([{ name: 'AI_START_HERE.md', words: 810 }]);
    expect(r.over).toEqual([]);
    expect(r.near[0]).toMatch(/AI_START_HERE\.md has 810 words, budget 900/);
  });
  it('the exact budget is allowed, one word more is over', () => {
    expect(budgetReport([{ name: 'AI_START_HERE.md', words: 900 }]).over).toEqual([]);
    expect(budgetReport([{ name: 'AI_START_HERE.md', words: 901 }]).over).toHaveLength(1);
  });
  it('uses the default budget for other documents', () => {
    expect(budgetReport([{ name: 'BUGS.md', words: 25001 }]).over[0]).toMatch(/budget 25000/);
  });
});

describe('summarize', () => {
  it('says PREFLIGHT PASS when nothing failed', () => {
    const s = summarize([{ name: 'tests', status: 'pass' }, { name: 'tasks', status: 'pass' }]);
    expect(s).toMatchObject({ ok: true, line: 'PREFLIGHT PASS' });
  });
  it('names every failed step', () => {
    const s = summarize([{ name: 'tests', status: 'fail' }, { name: 'build', status: 'pass' }, { name: 'tasks', status: 'fail' }]);
    expect(s.ok).toBe(false);
    expect(s.line).toBe('PREFLIGHT FAIL: tests, tasks');
  });
  it('shows skipped steps and warnings but still passes', () => {
    const s = summarize([{ name: 'content', status: 'skip' }, { name: 'budgets', status: 'warn' }, { name: 'tasks', status: 'pass' }]);
    expect(s.ok).toBe(true);
    expect(s.line).toBe('PREFLIGHT PASS (skipped: content; warnings: budgets)');
  });
  it('lists one detail line per step', () => {
    expect(summarize([{ name: 'tests', status: 'pass', note: 'files 3 passed' }]).details).toEqual(['tests: pass - files 3 passed']);
  });
  it('an empty list passes (nothing failed)', () => expect(summarize([]).ok).toBe(true));
});

describe('vitestLine', () => {
  it('reads the two summary lines', () => {
    const out = ' Test Files  107 passed (107)\n      Tests  1973 passed (1973)\n   Start at 20:14';
    expect(vitestLine(out)).toBe('files 107 passed, tests 1973 passed');
  });
  it('is empty when there is nothing to read', () => expect(vitestLine('boom')).toBe(''));
});

describe('npm run preflight --fast', () => {
  it('runs the quick steps and ends with a PREFLIGHT line', () => {
    const r = spawnSync('node', ['scripts/preflight.mjs', '--fast'], { encoding: 'utf8' });
    const last = r.stdout.trim().split('\n').pop();
    expect(last).toMatch(/^PREFLIGHT (PASS|FAIL: )/);
    expect(r.stdout).toMatch(/tasks: pass/);
    expect(r.stdout).toMatch(/tests: skip - --fast/);
    expect(r.status).toBe(last.startsWith('PREFLIGHT PASS') ? 0 : 1);
  });
});
