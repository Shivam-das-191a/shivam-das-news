import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { parseCard, sectionsOf, riskOfPaths, hasSecret, evidenceOk, lintCard, lintAll } from '../../scripts/task-lint-lib.mjs';

const card = (o: Record<string, string> = {}, body?: string) => {
  const fm: Record<string, string> = {
    id: 'T-0100', title: 'A small task', owner: 'ai', risk: 'yellow', status: 'ready', time: '1 hour', needs: '[]',
    paths: '[site/tests/]', 'approved-by': '', 'claimed-by': '', 'blocked-by': '', created: '2026-11-16', ...o,
  };
  const head = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${head}\n---\n\n` + (body ?? `## Goal
One sentence.

## Why it matters
Because.

## Steps
1. Do it.

## Done when
- The test passes.

## Evidence
(Fill when finished.)

## If it goes wrong
Revert the commit.

## Stop and ask the owner if
- A fact is missing.

## Log
`);
};
const lint = (text: string, folder = 'open', file = 'tasks/open/T-0100.md') => lintCard({ file, folder, text });

describe('parseCard and sectionsOf', () => {
  it('reads keys, lists and strips comments', () => {
    const { fm } = parseCard('---\nid: T-0001\nneeds: [T-0002, decision-43]\nrisk: green   # note\n---\n\n## Goal\nx\n');
    expect(fm).toEqual({ id: 'T-0001', needs: ['T-0002', 'decision-43'], risk: 'green' });
  });
  it('says so when there is no front matter', () => {
    expect(parseCard('hello').error).toMatch(/front matter/);
  });
  it('lists the sections in order', () => {
    expect(sectionsOf('## A\none\n## B\ntwo').map((s: any) => s.name)).toEqual(['A', 'B']);
  });
});

describe('riskOfPaths (LOGICS 31.3)', () => {
  it('is red for workers, .github, admin, package files', () => {
    for (const p of ['workers/push/', '.github/workflows/x.yml', 'site/public/admin/app.js', 'site/package.json', 'site/package-lock.json']) expect(riskOfPaths([p])).toBe('red');
  });
  it('is yellow for code, tests, scripts, other config and root documents', () => {
    for (const p of ['site/src/lib/a.ts', 'site/tests/', 'site/scripts/x.mjs', 'site/config/site.json', 'INCOMPLETE.md']) expect(riskOfPaths([p])).toBe('yellow');
  });
  it('is green only for content, media, redirects and categories', () => {
    expect(riskOfPaths(['site/content/blogs/', 'site/public/media/', 'site/config/redirects.json', 'site/config/categories.json'])).toBe('green');
  });
  it('takes the highest', () => {
    expect(riskOfPaths(['site/content/blogs/', 'site/src/a.ts', 'workers/geo/'])).toBe('red');
  });
});

describe('secrets and evidence', () => {
  it('finds token shapes and private keys', () => {
    expect(hasSecret('token ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1')).toBe(true);
    expect(hasSecret('github_pat_' + 'A'.repeat(30))).toBe(true);
    expect(hasSecret('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(hasSecret('Zk3' + 'a'.repeat(20) + 'Q9' + 'B'.repeat(20))).toBe(true);
  });
  it('lets normal text, paths and words through', () => {
    expect(hasSecret('See site/content/blogs/entertainment/welcome-to-shivam-das-news.md and the ghp rule.')).toBe(false);
  });
  it('refuses placeholders and one-word evidence', () => {
    for (const t of ['', '(Fill when finished.)', 'done', 'ok.', 'short']) expect(evidenceOk(t)).toBe(false);
    expect(evidenceOk('Tests: 106 files passed. Files changed: site/tests/. Build: validation passed.')).toBe(true);
  });
});

describe('lintCard: good cards', () => {
  it('accepts a ready yellow card', () => {
    expect(lint(card())).toEqual([]);
  });
  it('accepts an idea card with thin sections', () => {
    expect(lint(card({ status: 'idea' }, card().split('---\n\n')[1].replace('1. Do it.', 'later')))).toEqual([]);
  });
  it('accepts a human card with no paths', () => {
    expect(lint(card({ owner: 'human', paths: '[]', risk: 'green' }))).toEqual([]);
  });
  it('accepts a done card in tasks/done/ with evidence', () => {
    const t = card({ status: 'done' }).replace('(Fill when finished.)', 'Tests: all passed. Files: site/tests/. Build passed.').replace('## Log\n', '## Log\n- 2026-11-16, Claude. Done: x.');
    expect(lint(t, 'done', 'tasks/done/T-0100.md')).toEqual([]);
  });
});

describe('lintCard: bad cards', () => {
  const has = (text: string, re: RegExp, folder = 'open') => expect(lint(text, folder).join('\n')).toMatch(re);
  it('id must equal the file name', () => has(card({ id: 'T-0101' }), /id "T-0101" must equal/));
  it('refuses a wrong status, owner, risk and date', () => {
    has(card({ status: 'finished' }), /status must be one of/);
    has(card({ owner: 'robot' }), /owner must be one of/);
    has(card({ risk: 'blue' }), /risk must be one of/);
    has(card({ created: '16-11-2026' }), /created must be YYYY-MM-DD/);
  });
  it('refuses a risk lower than the paths need', () => has(card({ risk: 'green' }), /risk is green but its paths need yellow/));
  it('refuses a bad needs entry', () => has(card({ needs: '[task-1]' }), /needs entry "task-1"/));
  it('a red card needs approved-by before it is ready', () => {
    has(card({ risk: 'red', paths: '[workers/push/]' }), /needs "approved-by:"/);
    expect(lint(card({ risk: 'red', paths: '[workers/push/]', 'approved-by': 'Owner, 2026-11-16' }))).toEqual([]);
    expect(lint(card({ risk: 'red', paths: '[workers/push/]', status: 'idea' }))).toEqual([]);
  });
  it('a card in open cannot be done, a card in done must be', () => {
    has(card({ status: 'done' }), /cannot have status done/);
    has(card({ status: 'ready' }), /must have status done/, 'done');
  });
  it('a ready card needs numbered steps, a Done when line and an undo line', () => {
    has(card({}, card().split('---\n\n')[1].replace('1. Do it.', 'just do it')), /numbered step/);
    has(card({}, card().split('---\n\n')[1].replace('- The test passes.', 'nothing')), /Done when/);
    has(card({}, card().split('---\n\n')[1].replace('Revert the commit.', '')), /If it goes wrong is empty/);
  });
  it('a missing section is named', () => has(card({}, card().split('---\n\n')[1].replace('## Why it matters\nBecause.\n\n', '')), /missing section "## Why it matters"/));
  it('sections out of order are refused', () => {
    const b = card().split('---\n\n')[1].replace('## Goal\nOne sentence.\n\n', '') + '\n## Goal\nOne sentence.\n';
    has(card({}, b), /not in the order/);
  });
  it('an AI card with empty paths is refused', () => has(card({ paths: '[]' }), /paths is empty/));
  it('in-progress needs claimed-by, blocked needs blocked-by', () => {
    has(card({ status: 'in-progress' }).replace('(Fill when finished.)', 'Evidence line that is long enough to pass.'), /claimed-by is empty/);
    has(card({ status: 'blocked' }), /needs "blocked-by:"/);
  });
  it('review without evidence is refused', () => has(card({ status: 'review', 'claimed-by': 'Claude, 2026-11-16' }), /Evidence is empty/));
  it('a secret in a card is refused', () => has(card().replace('Because.', 'Use ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1' + ' here.'), /secret/));
  it('a file with no front matter is refused', () => has('# nothing', /front matter/));
});

describe('lintAll', () => {
  const mk = (id: string, o: Record<string, string> = {}, folder = 'open') => ({ file: `tasks/${folder}/${id}.md`, folder, text: card({ id, ...o }) });
  it('passes two good cards', () => expect(lintAll([mk('T-0100'), mk('T-0101')])).toEqual([]));
  it('finds a needs that does not exist, and accepts one that does', () => {
    expect(lintAll([mk('T-0100', { needs: '[T-0999]' })]).join()).toMatch(/needs T-0999/);
    expect(lintAll([mk('T-0100', { needs: '[T-0101]' }), mk('T-0101')])).toEqual([]);
  });
  it('finds two cards with the same id', () => {
    const a = mk('T-0100'); const b = { ...mk('T-0100'), file: 'tasks/done/T-0100.md', folder: 'done' };
    expect(lintAll([a, b]).join()).toMatch(/also used by/);
  });
  it('one in-progress card per claimer, and no shared paths', () => {
    const ev = 'Evidence line that is long enough to pass.';
    const prog = (id: string, who: string, paths: string) => {
      const c = mk(id, { status: 'in-progress', 'claimed-by': who, paths });
      return { ...c, text: c.text.replace('(Fill when finished.)', ev) };
    };
    expect(lintAll([prog('T-0100', 'Claude, 2026-11-16', '[site/tests/a/]'), prog('T-0101', 'Claude, 2026-11-17', '[site/tests/b/]')]).join()).toMatch(/already has T-0100/);
    expect(lintAll([prog('T-0100', 'Claude, 2026-11-16', '[site/tests/]'), prog('T-0101', 'Asha, 2026-11-16', '[site/tests/unit/]')]).join()).toMatch(/share a path/);
    expect(lintAll([prog('T-0100', 'Claude, 2026-11-16', '[site/tests/]'), prog('T-0101', 'Asha, 2026-11-16', '[site/src/]')])).toEqual([]);
  });
});

describe('the real cards and npm run tasks:check', () => {
  it('every shipped card passes', () => {
    const cards: any[] = [];
    for (const folder of ['open', 'done']) for (const f of readdirSync('../tasks/' + folder).filter((x) => x.endsWith('.md'))) cards.push({ file: `tasks/${folder}/${f}`, folder, text: readFileSync(`../tasks/${folder}/${f}`, 'utf8') });
    expect(cards.length).toBeGreaterThan(5);
    expect(lintAll(cards)).toEqual([]);
  });
  it('the script prints TASKS PASS and exits 0', () => {
    const r = spawnSync('node', ['scripts/task-lint.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^TASKS PASS \(\d+ cards\)/);
  });
});
