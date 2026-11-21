import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain JS module without types
import { automergeProblems, readPull, decide, MAX_FILES } from '../../scripts/automerge-lib.mjs';

// Phase 3d Part 4: when may a pull request be merged by itself? Only content-only changes, only when everything else is in order.
const good = () => ({
  enabled: 'on', event: 'pull_request', conclusion: 'success', repo: 'me/site', headRepo: 'me/site', headBranch: 'ai/T-0002',
  baseBranch: 'main', state: 'open', draft: false, labels: [], headSha: 'abc123', runSha: 'abc123',
  files: [{ path: 'site/content/blogs/film/a-story.md', status: 'added' }, { path: 'site/public/media/a-story.jpg', status: 'added' }],
});
const why = (over: Record<string, unknown>) => automergeProblems({ ...good(), ...over });

describe('automergeProblems: the change that may go through', () => {
  it('accepts a content-only pull request from an ai/T-0000 branch', () => {
    expect(automergeProblems(good())).toEqual([]);
  });
  it('accepts human/T-0000, authors, pages, redirects, category names and the card own file', () => {
    const files = ['site/content/authors/x.json', 'site/content/pages/about.md', 'site/config/redirects.json', 'site/config/categories.json', 'tasks/open/T-0002.md'].map((path) => ({ path, status: 'modified' }));
    expect(why({ headBranch: 'human/T-0002', files })).toEqual([]);
  });
});

describe('automergeProblems: the switch and the check', () => {
  it('is off unless AUTO_MERGE is on (any case, spaces allowed)', () => {
    expect(why({ enabled: '' })[0]).toMatch(/switched off/);
    expect(why({ enabled: undefined })[0]).toMatch(/switched off/);
    expect(why({ enabled: 'true' })[0]).toMatch(/switched off/);
    expect(why({ enabled: ' ON ' })).toEqual([]);
  });
  it('needs a green Validate run for a pull request', () => {
    expect(why({ conclusion: 'failure' })).toContain('the Validate run did not finish green');
    expect(why({ conclusion: 'cancelled' })).toContain('the Validate run did not finish green');
    expect(why({ event: 'push' })).toContain('the Validate run did not finish green');
  });
  it('refuses a closed, draft or wrong-target pull request', () => {
    expect(why({ state: 'closed' })).toContain('the pull request is not open');
    expect(why({ draft: true })).toContain('the pull request is a draft');
    expect(why({ baseBranch: 'dev' })).toContain('the pull request does not target main');
  });
  it('refuses a pull request that changed after the check ran', () => {
    expect(why({ headSha: 'def456' })[0]).toMatch(/changed after the check/);
    expect(why({ headSha: undefined, runSha: undefined })[0]).toMatch(/changed after the check/);
  });
});

describe('automergeProblems: who and what', () => {
  it('refuses a fork, also with different letter case only when the name really differs', () => {
    expect(why({ headRepo: 'someone/site' })[0]).toMatch(/fork/);
    expect(why({ headRepo: '' })[0]).toMatch(/fork/);
    expect(why({ headRepo: 'Me/Site' })).toEqual([]);
  });
  it('wants the branch name ai/T-0000 or human/T-0000', () => {
    for (const b of ['main', 'ai/fix', 'feature/T-0002', 'ai/T-2', 'ai/T-0002/extra', '']) expect(why({ headBranch: b }).join(' ')).toMatch(/ai\/T-0000 or human\/T-0000/);
  });
  it('refuses the labels no-automerge and needs-review', () => {
    expect(why({ labels: ['no-automerge'] })[0]).toMatch(/blocks auto-merge/);
    expect(why({ labels: ['Needs-Review'] })[0]).toMatch(/blocks auto-merge/);
    expect(why({ labels: ['content'] })).toEqual([]);
  });
  it('refuses anything outside the content paths and says which file', () => {
    for (const p of ['site/src/lib/seo.ts', 'site/public/admin/js/app.js', 'workers/push/index.js', '.github/workflows/validate.yml', 'site/package.json', 'site/config/site.json', 'CHANGELOG.md', 'site/tests/unit/x.test.ts']) {
      expect(why({ files: [{ path: p, status: 'modified' }] }).join(' ')).toContain(`${p} is not a content-only path`);
    }
  });
  it('refuses another card file and one bad file hidden among good ones', () => {
    expect(why({ files: [{ path: 'tasks/open/T-0009.md', status: 'modified' }] }).join(' ')).toMatch(/not a content-only path/);
    const files = [...good().files, { path: 'site/src/pages/index.astro', status: 'modified' }];
    expect(why({ files })).toHaveLength(1);
  });
  it('never merges a deletion or a rename by itself', () => {
    expect(why({ files: [{ path: 'site/content/blogs/film/a.md', status: 'removed' }] })[0]).toMatch(/deleted/);
    expect(why({ files: [{ path: 'site/content/blogs/film/b.md', status: 'renamed' }] })[0]).toMatch(/renamed/);
  });
  it('allows only plain pictures in media and only .md or .json in content', () => {
    expect(why({ files: [{ path: 'site/public/media/x.svg', status: 'added' }] })[0]).toMatch(/not a plain picture/);
    expect(why({ files: [{ path: 'site/public/media/x.html', status: 'added' }] })[0]).toMatch(/not a plain picture/);
    expect(why({ files: [{ path: 'site/public/media/x.js', status: 'added' }] })[0]).toMatch(/not a plain picture/);
    for (const e of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']) expect(why({ files: [{ path: `site/public/media/x.${e}`, status: 'added' }] })).toEqual([]);
    expect(why({ files: [{ path: 'site/content/blogs/film/x.mdx', status: 'added' }] })[0]).toMatch(/not a \.md or \.json/);
    expect(why({ files: [{ path: 'site/content/blogs/film/x.html', status: 'added' }] })[0]).toMatch(/not a \.md or \.json/);
  });
  it('refuses odd paths', () => {
    expect(why({ files: [{ path: 'site/content/../src/x.ts', status: 'added' }] })[0]).toMatch(/not a normal path/);
    expect(why({ files: [{ path: 'site\\content\\a.md', status: 'added' }] })[0]).toMatch(/not a normal path/);
  });
  it('refuses no files and too many files', () => {
    expect(why({ files: [] })).toContain('no changed files were found');
    const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ path: `site/content/blogs/film/p${i}.md`, status: 'added' }));
    expect(why({ files: many })[0]).toMatch(/more than 50 changed files/);
    expect(why({ files: many.slice(0, MAX_FILES) })).toEqual([]);
  });
  it('lists every reason, not only the first', () => {
    const r = why({ enabled: 'off', draft: true, headBranch: 'x', labels: ['no-automerge'] });
    expect(r.length).toBeGreaterThanOrEqual(4);
  });
});

// A fake GitHub. It answers the two addresses the reader asks for.
const fake = (pr: Record<string, unknown>, files: unknown[], status = 200) => {
  const calls: string[] = [];
  const fn = async (url: string, init: { headers: Record<string, string> }) => {
    calls.push(url + '|' + (init.headers.Authorization || ''));
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => (url.includes('/files') ? files : pr) };
  };
  return { fn, calls };
};
const ghPr = { state: 'open', draft: false, base: { ref: 'main' }, head: { ref: 'ai/T-0002', sha: 'abc123', repo: { full_name: 'me/site' } }, labels: [{ name: 'content' }] };
const ghFiles = [{ filename: 'site/content/blogs/film/a-story.md', status: 'added' }];

describe('readPull and decide', () => {
  it('reads the pull request and its files with the token', async () => {
    const f = fake(ghPr, ghFiles);
    const p = await readPull({ fetchFn: f.fn, repo: 'me/site', number: '7', token: 'tok' });
    expect(p).toEqual({ state: 'open', draft: false, baseBranch: 'main', headBranch: 'ai/T-0002', headRepo: 'me/site', headSha: 'abc123', labels: ['content'], files: [{ path: 'site/content/blogs/film/a-story.md', status: 'added' }] });
    expect(f.calls).toEqual(['https://api.github.com/repos/me/site/pulls/7|Bearer tok', 'https://api.github.com/repos/me/site/pulls/7/files?per_page=100|Bearer tok']);
  });
  it('refuses a repository name or number that could change the address', async () => {
    const f = fake(ghPr, ghFiles);
    await expect(readPull({ fetchFn: f.fn, repo: 'me/site/../../x', number: '7' })).rejects.toThrow(/repository name/);
    await expect(readPull({ fetchFn: f.fn, repo: 'me/site', number: '7/files' })).rejects.toThrow(/number/);
    expect(f.calls).toEqual([]);
  });
  it('says OK for a good change when everything is in order', async () => {
    const f = fake(ghPr, ghFiles);
    const r = await decide({ repo: 'me/site', number: '7', sha: 'abc123', env: { AUTO_MERGE: 'on', RUN_EVENT: 'pull_request', RUN_CONCLUSION: 'success', GITHUB_TOKEN: 'tok' }, fetchFn: f.fn });
    expect(r).toEqual({ eligible: true, lines: ['AUTOMERGE OK (1 file, content only, check green)'] });
  });
  it('skips with one line per reason, and never prints the token', async () => {
    const f = fake({ ...ghPr, draft: true }, [{ filename: 'site/src/lib/seo.ts', status: 'modified' }]);
    const r = await decide({ repo: 'me/site', number: '7', sha: 'abc123', env: { AUTO_MERGE: 'on', RUN_EVENT: 'pull_request', RUN_CONCLUSION: 'success', GITHUB_TOKEN: 'secret-token' }, fetchFn: f.fn });
    expect(r.eligible).toBe(false);
    expect(r.lines).toEqual(['AUTOMERGE SKIP: the pull request is a draft', 'AUTOMERGE SKIP: site/src/lib/seo.ts is not a content-only path (posts, pages, authors, pictures, redirects and category names are)']);
    expect(JSON.stringify(r)).not.toContain('secret-token');
  });
  it('skips (does not fail) when GitHub cannot be read', async () => {
    const f = fake(ghPr, ghFiles, 404);
    const r = await decide({ repo: 'me/site', number: '7', sha: 'abc123', env: { AUTO_MERGE: 'on' }, fetchFn: f.fn });
    expect(r).toEqual({ eligible: false, lines: ['AUTOMERGE SKIP: could not read the pull request (GitHub answered 404)'] });
  });
  it('skips when the head commit is not the one that was checked', async () => {
    const f = fake(ghPr, ghFiles);
    const r = await decide({ repo: 'me/site', number: '7', sha: 'zzz999', env: { AUTO_MERGE: 'on', RUN_EVENT: 'pull_request', RUN_CONCLUSION: 'success' }, fetchFn: f.fn });
    expect(r.eligible).toBe(false);
    expect(r.lines[0]).toMatch(/changed after the check ran/);
  });
});

describe('scripts/automerge.mjs', () => {
  const script = fileURLToPath(new URL('../../scripts/automerge.mjs', import.meta.url));
  const run = (args: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'am-'));
    const out = join(dir, 'out.txt');
    const r = spawnSync('node', [script, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, output: existsSync(out) ? readFileSync(out, 'utf8') : '' };
  };
  it('skips without a network call when the run has no pull request', () => {
    const r = run(['--repo', 'me/site', '--pr', '', '--sha', 'abc']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('AUTOMERGE SKIP: the Validate run is not tied to a pull request\n');
    expect(r.output).toBe('eligible=false\n');
  });
  it('explains wrong use, exits 2 and writes eligible=false', () => {
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/use: node scripts\/automerge\.mjs/);
    expect(r.output).toBe('eligible=false\n');
  });
});
