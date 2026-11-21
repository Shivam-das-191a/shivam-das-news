// Phase 3d Part 4: decides whether .github/workflows/automerge.yml may merge a pull request.
// Usage: node scripts/automerge.mjs --repo owner/name --pr 12 --sha <commit the Validate run checked>
// Reads AUTO_MERGE, RUN_EVENT, RUN_CONCLUSION and GITHUB_TOKEN from the environment. Prints AUTOMERGE OK or one AUTOMERGE SKIP line per reason.
// Writes eligible=true or eligible=false to $GITHUB_OUTPUT when it exists. Exit code 0 in both cases (a skip is normal); 2 for wrong use.
import { appendFileSync } from 'node:fs';
import { decide } from './automerge-lib.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? '' : args[i + 1] || ''; };
const repo = flag('--repo'), number = flag('--pr'), sha = flag('--sha');
const out = (v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${v}\n`); };

if (!repo || !sha) {
  console.error('use: node scripts/automerge.mjs --repo owner/name --pr 12 --sha <commit>');
  out('false');
  process.exit(2);
}
if (!number) {
  console.log('AUTOMERGE SKIP: the Validate run is not tied to a pull request');
  out('false');
} else {
  const r = await decide({ repo, number, sha, env: process.env, fetchFn: fetch });
  for (const l of r.lines) console.log(l);
  out(r.eligible ? 'true' : 'false');
}
