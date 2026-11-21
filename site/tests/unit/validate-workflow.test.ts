import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Phase 3d Part 3: .github/workflows/validate.yml. There is no YAML parser in this project, so the file is checked as text.
// The rules: it reads only, it uses no secret, it never trusts a value from the pull request inside a shell line,
// and it runs the four checks in a fixed order using only scripts that exist in package.json.
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const yml = readFileSync(here('../../../.github/workflows/validate.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(here('../../package.json'), 'utf8'));
const lines = yml.split('\n');
const code = lines.filter((l) => !l.trim().startsWith('#')).join('\n');

describe('validate.yml', () => {
  it('has a name and runs on pull requests, on main, on ai/ and human/ branches and by hand', () => {
    expect(code).toMatch(/^name: Validate$/m);
    expect(code).toMatch(/^ {2}pull_request:\s*$/m);
    expect(code).toMatch(/^ {2}push:\s*$/m);
    expect(code).toMatch(/branches: \[main, "ai\/\*\*", "human\/\*\*"\]/);
    expect(code).toMatch(/^ {2}workflow_dispatch:\s*$/m);
  });

  it('never uses pull_request_target (it would give a fork write rights and secrets)', () => {
    expect(code).not.toMatch(/pull_request_target/);
  });

  it('reads the repository only and uses no secret', () => {
    expect(code).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(code).not.toMatch(/contents: write|id-token|pull-requests: write|actions: write/);
    expect(code).not.toMatch(/secrets\./);
  });

  it('puts every changing value into env, never inside a shell line', () => {
    // the text of every run block: none may hold an expression
    const blocks = code.split(/\n(?=\s*- name:|\s*- uses:)/).filter((b) => /run:/.test(b));
    for (const b of blocks) {
      const runPart = b.slice(b.indexOf('run:'));
      expect(runPart).not.toMatch(/\$\{\{/);
    }
    expect(blocks.length).toBeGreaterThan(0);
    for (const name of ['EVENT: ${{ github.event_name }}', 'REF: ${{ github.ref }}', 'BASE_REF: ${{ github.base_ref }}', 'BEFORE: ${{ github.event.before }}']) {
      expect(code).toContain(name);
    }
  });

  it('fetches the full history so --base can compare', () => {
    expect(code).toMatch(/actions\/checkout@v4\n\s+with: \{ fetch-depth: 0 \}/);
  });

  it('uses Node 22 and the two official actions at a fixed major version', () => {
    expect(code).toMatch(/node-version: 22/);
    const uses = [...code.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    expect(uses.sort()).toEqual(['actions/checkout@v4', 'actions/setup-node@v4']);
  });

  it('works inside site/ and caches by the lock file', () => {
    expect(code).toMatch(/working-directory: site/);
    expect(code).toMatch(/cache-dependency-path: site\/package-lock\.json/);
  });

  it('stops an older run of the same branch and has a time limit', () => {
    expect(code).toMatch(/group: validate-\$\{\{ github\.ref \}\}/);
    expect(code).toMatch(/cancel-in-progress: true/);
    expect(code).toMatch(/timeout-minutes: 20/);
  });

  it('runs install, content check, task check, tests and build in that order', () => {
    const order = ['npm ci --no-audit --no-fund', 'npm run check:content', 'npm run tasks:check', 'npm test', 'npm run build'];
    const at = order.map((s) => code.indexOf(s));
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('calls the content check with --base on a pull request, a branch and a main push, and without it when no base exists', () => {
    expect(code).toContain('BASE="origin/$BASE_REF"');
    expect(code).toContain('BASE="origin/main"');
    expect(code).toContain('BASE="$BEFORE"');
    expect(code).toContain('npm run check:content -- --base "$BASE"');
    expect(code).toMatch(/else npm run check:content; fi/);
    expect(code).toContain('0000000000000000000000000000000000000000');
  });

  it('calls only npm scripts that exist in package.json', () => {
    const called = [...code.matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThan(0);
    for (const s of called) expect(Object.keys(pkg.scripts)).toContain(s);
    expect(Object.keys(pkg.scripts)).toContain('test');
  });

  it('holds no emoji and no tab', () => {
    expect(yml).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(yml).not.toContain('\t');
  });
});
