// Phase 3d Part 4 (PLAN 35.4, LOGICS 26.1): may a pull request be merged by itself? Pure rules plus one function that reads
// the pull request from GitHub. scripts/automerge.mjs and .github/workflows/automerge.yml use them. Off until the owner
// sets the repository variable AUTO_MERGE to "on". Only content-only changes may ever be merged this way.
import { riskOfPaths } from './task-lint-lib.mjs';
import { cardOfBranch } from './task-gate-lib.mjs';

export const MAX_FILES = 50;
export const BLOCK_LABELS = ['no-automerge', 'needs-review'];
const CONTENT_EXT = /\.(md|json)$/i;
const PICTURE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;

/** Why a file may not be merged by itself, or '' when it may. */
function fileProblem(f, cardId) {
  const path = String(f.path || '').replace(/^\.?\//, '');
  if (!path || path.includes('..') || path.includes('\\')) return `${path || '(empty)'} is not a normal path`;
  if (f.status === 'removed') return `${path} is deleted (a deletion is never merged by itself)`;
  if (f.status === 'renamed') return `${path} is renamed (a moved file can change an address)`;
  if (path === `tasks/open/${cardId}.md`) return '';
  if (riskOfPaths([path]) !== 'green') return `${path} is not a content-only path (posts, pages, authors, pictures, redirects and category names are)`;
  if (path.startsWith('site/public/media/') && !PICTURE_EXT.test(path)) return `${path} is not a plain picture (png, jpg, gif, webp or avif)`;
  if (path.startsWith('site/content/') && !CONTENT_EXT.test(path) && !path.endsWith('/.gitkeep')) return `${path} is not a .md or .json content file`;
  return '';
}

/**
 * The list of plain reasons why a pull request must NOT be merged by itself. Empty list = it may.
 * pr = { enabled, event, conclusion, repo, headRepo, headBranch, baseBranch, state, draft, labels, headSha, runSha, files: [{ path, status }] }
 */
export function automergeProblems(pr) {
  const bad = [];
  const x = pr || {};
  if (String(x.enabled || '').trim().toLowerCase() !== 'on') bad.push('auto-merge is switched off (the repository variable AUTO_MERGE is not "on")');
  if (x.event !== 'pull_request' || x.conclusion !== 'success') bad.push('the Validate run did not finish green');
  if (x.state !== 'open') bad.push('the pull request is not open');
  if (x.draft) bad.push('the pull request is a draft');
  if (x.baseBranch !== 'main') bad.push('the pull request does not target main');
  if (!x.repo || String(x.headRepo || '').toLowerCase() !== String(x.repo).toLowerCase()) bad.push('the pull request comes from another repository (a fork)');
  const cardId = cardOfBranch(x.headBranch);
  if (!cardId) bad.push('the branch must be named ai/T-0000 or human/T-0000');
  if (!x.headSha || x.headSha !== x.runSha) bad.push('the pull request changed after the check ran; wait for the next green run');
  for (const l of x.labels || []) if (BLOCK_LABELS.includes(String(l).toLowerCase())) bad.push(`the label "${l}" blocks auto-merge`);
  const files = x.files || [];
  if (files.length === 0) bad.push('no changed files were found');
  else if (files.length > MAX_FILES) bad.push(`more than ${MAX_FILES} changed files; a person should look at it`);
  else for (const f of files) { const p = fileProblem(f, cardId); if (p) bad.push(p); }
  return bad;
}

/** Reads one pull request from the GitHub API into the shape above (without enabled, event, conclusion, repo, runSha). */
export async function readPull({ fetchFn = fetch, repo, number, token }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo))) throw new Error('the repository name is not valid');
  if (!/^\d+$/.test(String(number))) throw new Error('the pull request number is not valid');
  const get = async (path) => {
    const r = await fetchFn(`https://api.github.com/repos/${repo}/${path}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'shivam-das-news-automerge', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    return r.json();
  };
  const pr = await get(`pulls/${number}`);
  const files = await get(`pulls/${number}/files?per_page=100`);
  return {
    state: pr.state,
    draft: !!pr.draft,
    baseBranch: pr.base && pr.base.ref,
    headBranch: pr.head && pr.head.ref,
    headRepo: (pr.head && pr.head.repo && pr.head.repo.full_name) || '',
    headSha: pr.head && pr.head.sha,
    labels: (pr.labels || []).map((l) => l.name),
    files: (files || []).map((f) => ({ path: f.filename, status: f.status })),
  };
}

/** One decision. Returns { eligible, lines } where lines are the plain sentences to print. A skip is normal, never an error. */
export async function decide({ repo, number, sha, env = {}, fetchFn }) {
  let pull;
  try {
    pull = await readPull({ fetchFn, repo, number, token: env.GITHUB_TOKEN || env.GH_TOKEN });
  } catch (e) {
    return { eligible: false, lines: [`AUTOMERGE SKIP: could not read the pull request (${e.message})`] };
  }
  const bad = automergeProblems({ ...pull, repo, enabled: env.AUTO_MERGE, event: env.RUN_EVENT, conclusion: env.RUN_CONCLUSION, runSha: sha });
  if (bad.length) return { eligible: false, lines: bad.map((b) => `AUTOMERGE SKIP: ${b}`) };
  return { eligible: true, lines: [`AUTOMERGE OK (${pull.files.length} file${pull.files.length === 1 ? '' : 's'}, content only, check green)`] };
}
