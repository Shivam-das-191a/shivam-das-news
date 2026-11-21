import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Phase 3d Part 4: .github/workflows/automerge.yml, read as text. The safe design: it runs from main, never runs code of the pull request,
// does nothing unless AUTO_MERGE is "on", and merges only the commit that was checked.
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const yml = readFileSync(here('../../../.github/workflows/automerge.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(here('../../package.json'), 'utf8'));
const code = yml.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

describe('automerge.yml', () => {
  it('starts after the Validate workflow finishes, and only then', () => {
    expect(code).toMatch(/^name: Auto-merge$/m);
    expect(code).toMatch(/^ {2}workflow_run:\n {4}workflows: \[Validate\]\n {4}types: \[completed\]$/m);
    expect(code).not.toMatch(/^ {2}(push|pull_request|pull_request_target|schedule):/m);
    // the name it waits for must be the real name of the other workflow
    expect(readFileSync(here('../../../.github/workflows/validate.yml'), 'utf8')).toMatch(/^name: Validate$/m);
  });
  it('does nothing unless AUTO_MERGE is on and the run was a green pull request run', () => {
    expect(code).toMatch(/if: vars\.AUTO_MERGE == 'on' && github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.event == 'pull_request'/);
  });
  it('has exactly the two write rights it needs and nothing else', () => {
    expect(code).toMatch(/^permissions:\n {2}contents: write\n {2}pull-requests: write$/m);
    expect(code).not.toMatch(/id-token|actions: write|packages|secrets\./);
  });
  it('never checks out or runs the code of the pull request', () => {
    expect(code).not.toMatch(/ref:/);
    expect(code).toMatch(/actions\/checkout@v4\n\s+with: \{ persist-credentials: false \}/);
    expect(code).not.toMatch(/npm (ci|install|test|run)/);
  });
  it('keeps every changing value in env, never inside a shell line', () => {
    const blocks = code.split(/\n(?=\s*- name:|\s*- uses:)/).filter((b) => /^\s+run:/m.test(b));
    expect(blocks.length).toBe(2);
    for (const b of blocks) expect(b.slice(b.indexOf('run:'))).not.toMatch(/\$\{\{/);
    for (const v of ['PR_NUMBER: ${{ github.event.workflow_run.pull_requests[0].number }}', 'HEAD_SHA: ${{ github.event.workflow_run.head_sha }}', 'REPO: ${{ github.repository }}']) expect(code).toContain(v);
  });
  it('merges only when the decision said yes, and only the commit that was checked', () => {
    expect(code).toMatch(/if: steps\.decide\.outputs\.eligible == 'true'/);
    expect(code).toContain('gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch --match-head-commit "$HEAD_SHA"');
    expect(code).not.toMatch(/--admin|--auto/);
  });
  it('asks the script that exists, with the three arguments', () => {
    expect(code).toContain('node site/scripts/automerge.mjs --repo "$REPO" --pr "$PR_NUMBER" --sha "$HEAD_SHA"');
    expect(Object.keys(pkg.scripts)).toContain('test');
  });
  it('uses Node 22 and the two official actions at a fixed major version', () => {
    expect(code).toMatch(/node-version: 22/);
    expect([...code.matchAll(/uses: (\S+)/g)].map((m) => m[1]).sort()).toEqual(['actions/checkout@v4', 'actions/setup-node@v4']);
  });
  it('does not run two merges for the same commit at once, and has a time limit', () => {
    expect(code).toMatch(/group: automerge-\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    expect(code).toMatch(/cancel-in-progress: false/);
    expect(code).toMatch(/timeout-minutes: 10/);
  });
  it('holds no emoji and no tab', () => {
    expect(yml).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(yml).not.toContain('\t');
  });
});
