import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { cardOfBranch, extraFiles, nameOf, confirmations, closeProblems } from '../../scripts/task-gate-lib.mjs';

const card = (o: Record<string, string> = {}, log = '') => `---
id: T-0100
title: A task
owner: ai
risk: ${o.risk ?? 'yellow'}
status: verify
time: 1 hour
needs: []
paths: [site/tests/]
approved-by:
claimed-by: ${o['claimed-by'] ?? 'Claude, 2026-11-16'}
created: 2026-11-16
---

## Goal
x

## Why it matters
x

## Steps
1. x

## Done when
- x

## Evidence
Evidence line that is long enough to count.

## If it goes wrong
x

## Stop and ask the owner if
- x

## Log
${log}
`;

describe('cardOfBranch', () => {
  it('reads ai/ and human/ branches', () => {
    expect(cardOfBranch('ai/T-0006')).toBe('T-0006');
    expect(cardOfBranch('human/T-0123')).toBe('T-0123');
  });
  it('refuses every other name', () => {
    for (const b of ['main', 'ai/T-6', 'feature/T-0006', 'ai/T-0006-extra', '', undefined]) expect(cardOfBranch(b)).toBe('');
  });
});

describe('extraFiles (LOGICS 31.9)', () => {
  const paths = ['site/tests/', 'site/config/site.json', 'docs/archive'];
  it('allows files inside a folder entry, an exact file and a folder without a slash', () => {
    expect(extraFiles('T-0100', paths, ['site/tests/unit/a.ts', 'site/config/site.json', 'docs/archive/x.md'])).toEqual([]);
  });
  it('names files outside the paths', () => {
    expect(extraFiles('T-0100', paths, ['site/tests/a.ts', 'site/src/b.ts', 'workers/geo/index.js'])).toEqual(['site/src/b.ts', 'workers/geo/index.js']);
  });
  it('does not let a similar name through', () => {
    expect(extraFiles('T-0100', ['site/tests/'], ['site/tests-extra/a.ts'])).toEqual(['site/tests-extra/a.ts']);
    expect(extraFiles('T-0100', ['docs/archive'], ['docs/archive2/a.md'])).toEqual(['docs/archive2/a.md']);
  });
  it('always allows the card itself, open or done, but not another card', () => {
    expect(extraFiles('T-0100', [], ['tasks/open/T-0100.md', 'tasks/done/T-0100.md'])).toEqual([]);
    expect(extraFiles('T-0100', [], ['tasks/open/T-0101.md'])).toEqual(['tasks/open/T-0101.md']);
  });
  it('cleans ./ prefixes and blank lines', () => {
    expect(extraFiles('T-0100', ['site/tests/'], ['./site/tests/a.ts', '', '  '])).toEqual([]);
  });
});

describe('nameOf and confirmations', () => {
  it('takes the name before the date', () => {
    expect(nameOf('Claude, 2026-11-16')).toBe('claude');
    expect(nameOf('Claude (2026-11-16)')).toBe('claude');
    expect(nameOf('ChatGPT session 2')).toBe('chatgpt session 2');
    expect(nameOf('')).toBe('');
  });
  it('finds every Confirmed by line', () => {
    expect(confirmations('- Confirmed by Asha, 2026-11-17\nConfirmed by Shivam-Das, 2026-11-18')).toEqual([{ name: 'asha', date: '2026-11-17' }, { name: 'shivam-das', date: '2026-11-18' }]);
    expect(confirmations('Confirmed by someone')).toEqual([]);
  });
});

describe('closeProblems (LOGICS 31.6)', () => {
  it('green needs no second key', () => expect(closeProblems(card({ risk: 'green' }))).toEqual([]));
  it('yellow needs a confirmation', () => expect(closeProblems(card()).join()).toMatch(/needs a Log line "Confirmed by/));
  it('yellow refuses the doer confirming their own work', () => {
    expect(closeProblems(card({}, '- Confirmed by Claude, 2026-11-17')).join()).toMatch(/only confirmation is by the doer/);
  });
  it('yellow accepts someone else', () => expect(closeProblems(card({}, '- Confirmed by Asha, 2026-11-17'))).toEqual([]));
  it('a missing claimed-by is named', () => expect(closeProblems(card({ 'claimed-by': '' }, '- Confirmed by Asha, 2026-11-17')).join()).toMatch(/claimed-by is empty/));
  it('red needs an owner login', () => {
    const t = card({ risk: 'red' }, '- Confirmed by Asha, 2026-11-17');
    expect(closeProblems(t, ['Shivam-Das']).join()).toMatch(/no confirmation is from an owner login/);
    expect(closeProblems(t, []).join()).toMatch(/no owner names were given/);
    expect(closeProblems(card({ risk: 'red' }, '- Confirmed by shivam-das, 2026-11-17'), ['Shivam-Das'])).toEqual([]);
  });
  it('a file without front matter is reported', () => expect(closeProblems('hello')[0]).toMatch(/front matter/));
});

describe('node scripts/task-gate.mjs', () => {
  const run = (...a: string[]) => spawnSync('node', ['scripts/task-gate.mjs', ...a], { encoding: 'utf8' });
  it('paths: passes for files inside the card, fails outside', () => {
    const ok = run('paths', '--branch', 'ai/T-0006', '--files', 'site/tests/unit/x.ts,tasks/open/T-0006.md');
    expect(ok.status).toBe(0);
    expect(ok.stdout).toMatch(/GATE PASS \(paths\)/);
    const bad = run('paths', '--branch', 'ai/T-0006', '--files', 'site/src/x.ts');
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/site\/src\/x\.ts is outside the paths of T-0006/);
  });
  it('paths: a wrong branch name or an unknown card fails', () => {
    expect(run('paths', '--branch', 'main', '--files', 'a').stderr).toMatch(/must be named ai\/T-0000/);
    expect(run('paths', '--branch', 'ai/T-9999', '--files', 'a').stderr).toMatch(/no card T-9999/);
  });
  it('close: a green card passes and an unknown card fails', () => {
    expect(run('close', 'T-0002').status).toBe(0);
    expect(run('close', 'T-9999').stderr).toMatch(/no card T-9999/);
  });
  it('a missing command prints the usage and fails', () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/usage/);
  });
});
