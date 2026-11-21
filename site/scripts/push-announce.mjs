// v0.94.0 (Phase 9 part 7d): tells the push Worker about posts that just went live (PLAN 31.4 step 2). Run by .github/workflows/push.yml.
//   node scripts/push-announce.mjs            reads content/blogs, sends the posts of the last 2 hours to POST /announce
//   add --dry                                  prints what would be sent (keys only) and sends nothing
//   add --wait 90                              seconds to wait before asking again for a page that is not live yet (default 90)
//   add --tries 4                              how many times to ask in all (default 4, at most 6)
// Needs SITE_URL, PUSH_ENDPOINT (the address of the push Worker) and PUSH_ANNOUNCE_SECRET (at least 32 characters).
// With one of them missing the job does nothing and ends well, so the workflow is harmless until push is set up.
// The Worker sends nothing twice: the key of a post is its permalink. The secret and the post texts are never printed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { postFromFile, selectRecent, readSettings, retryKeys, describeResults, SECRET_HEADER } from './push-announce-lib.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback, min, max) => {
  const i = args.indexOf(name);
  const n = i >= 0 ? Number(args[i + 1]) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const dry = args.includes('--dry');
const waitSec = flag('--wait', 90, 0, 600);
const tries = Math.round(flag('--tries', 4, 1, 6));

const cfg = readSettings(process.env);
if (!cfg.ready && !dry) {
  console.log('Push announce is not set up (missing: ' + cfg.missing.join(', ') + '). Nothing to do.');
  process.exit(0);
}

function* mdFiles(dir) {
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names.sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* mdFiles(p);
    else if (n.endsWith('.md')) yield p;
  }
}

let timeZone = 'UTC';
try {
  timeZone = JSON.parse(readFileSync('config/site.json', 'utf8')).timeZone || 'UTC';
} catch {
  console.warn('config/site.json could not be read: using UTC for the address dates.');
}
const siteUrl = cfg.siteUrl || 'https://example.invalid';

const posts = [];
for (const f of mdFiles('content/blogs')) {
  const p = postFromFile(f.split('\\').join('/'), readFileSync(f, 'utf8'), { timeZone, siteUrl });
  if (p) posts.push(p);
}
const { send, skipped } = selectRecent(posts, Date.now());
console.log(`Posts read: ${posts.length}. To send: ${send.length}. Left out here: ${skipped.length}.`);
for (const s of skipped.filter((x) => x.reason !== 'too_old')) console.log(`  left out: ${s.key} (${s.reason})`);
if (!send.length) {
  console.log('No post is new enough. Nothing to announce.');
  process.exit(0);
}
if (dry) {
  console.log('DRY RUN, would send ' + send.length + ' post(s):\n' + send.map((p) => '  ' + p.key).join('\n'));
  process.exit(0);
}

let pending = send;
let failed = false;
for (let attempt = 1; attempt <= tries && pending.length; attempt++) {
  if (attempt > 1) {
    console.log(`Asking again in ${waitSec} s for ${pending.length} post(s).`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  let res;
  try {
    res = await fetch(cfg.endpoint + '/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SECRET_HEADER]: cfg.secret },
      body: JSON.stringify({ posts: pending }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    console.warn(`Try ${attempt}: the push Worker could not be reached (${e && e.name ? e.name : 'error'}).`);
    failed = true;
    continue;
  }
  failed = false;
  if (res.status === 503) {
    console.log('The push Worker is not switched on yet (503). Nothing to do.');
    process.exit(0);
  }
  if (!res.ok) {
    console.error(`Try ${attempt}: the push Worker answered HTTP ${res.status}.`);
    process.exit(1); // 401 (wrong secret), 413, 500: asking again will not help
  }
  const answer = await res.json().catch(() => null);
  console.log(`Try ${attempt}: accepted ${answer && answer.accepted}, skipped ${answer && answer.skipped}.`);
  for (const line of describeResults(answer)) console.log('  ' + line);
  const again = new Set(retryKeys(answer));
  pending = pending.filter((p) => again.has(p.key));
}
if (failed) process.exit(1);
if (pending.length) console.log(`${pending.length} page(s) were still not live after ${tries} tries. The next run (hourly) asks again while the post is under 2 hours old.`);
