import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error plain JS module without types
import { wordCount, budgetOf, budgetReport } from '../../scripts/preflight-lib.mjs';

// LOGICS 31.10. Only AI_START_HERE.md is enforced today: it must stay one page. The other documents are over budget
// until decision 43 is answered and task T-0008 runs scripts/archive-docs.mjs; `npm run preflight` shows them as a warning.
const docs = readdirSync('..').filter((f) => f.endsWith('.md')).map((name) => ({ name, words: wordCount(readFileSync('../' + name, 'utf8')) }));

describe('document budgets', () => {
  it('finds the root documents', () => {
    expect(docs.map((d) => d.name)).toEqual(expect.arrayContaining(['AI_START_HERE.md', 'INCOMPLETE.md', 'CHANGELOG.md', 'NEWS_WEBSITE_PLAN.md']));
  });
  it('AI_START_HERE.md stays within its budget', () => {
    const d = docs.find((x) => x.name === 'AI_START_HERE.md')!;
    expect(d.words).toBeLessThanOrEqual(budgetOf('AI_START_HERE.md'));
  });
  it('no document other than INCOMPLETE.md and CHANGELOG.md is over its budget', () => {
    const over = budgetReport(docs).over.filter((m: string) => !/^(INCOMPLETE|CHANGELOG)\.md /.test(m));
    expect(over).toEqual([]);
  });
});
