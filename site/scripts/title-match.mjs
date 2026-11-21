// Finds posts that have the SAME title on the old Blogger blog and on this site, and keeps the pairs for life (PLAN 32).
//   node scripts/title-match.mjs                    live: reads the Blogger feed and https://<site>/title-index.json
//   node scripts/title-match.mjs --dry              prints the result, writes nothing
//   node scripts/title-match.mjs --old f.json --new g.json   offline files (tests, backups)
// Writes: config/title-redirects.json (append only) and blogger/redirect-snippet.html (paste into the Blogger theme).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { oldPathOf, matchTitles, mergeLifetime, checkEntries, bloggerSnippet } from '../src/lib/title-match.js';

const BLOG = process.env.OLD_BLOG || 'shivam-das-news-usa';
const ORIGIN = (process.env.SITE_URL || 'https://www.shivam-das.online').replace(/\/+$/, '');
const STORE = 'config/title-redirects.json';
const SNIPPET = 'blogger/redirect-snippet.html';
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const die = (m) => { console.error(`[title-match] ${m}`); process.exit(1); };

async function getJson(url) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'title-match/1' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { last = e; await new Promise((ok) => setTimeout(ok, 1500 * i)); }
  }
  throw new Error(`${url}: ${last.message}`);
}

/** Whole feed or nothing: a half-read feed must never decide anything. */
async function bloggerFeed(kind) {
  const out = [];
  let total = null;
  for (let start = 1; ; start += 150) {
    const j = await getJson(`https://${BLOG}.blogspot.com/feeds/${kind}/default?alt=json&max-results=150&start-index=${start}`);
    const f = j.feed || {};
    total = Number(f.openSearch$totalResults?.$t ?? total ?? 0);
    const got = f.entry || [];
    for (const e of got) {
      const href = (e.link || []).find((l) => l.rel === 'alternate')?.href;
      if (href && e.title?.$t) out.push({ title: e.title.$t, url: href });
    }
    if (got.length < 150) break;
  }
  if (total !== null && out.length < total) throw new Error(`${kind} feed gave ${out.length} of ${total} items`);
  return out;
}

const oldRaw = val('--old') ? JSON.parse(readFileSync(val('--old'), 'utf8')) : [...(await bloggerFeed('posts')), ...(await bloggerFeed('pages'))];
const newRaw = val('--new') ? JSON.parse(readFileSync(val('--new'), 'utf8')) : await getJson(`${ORIGIN}/title-index.json`);
if (!Array.isArray(oldRaw) || !Array.isArray(newRaw)) die('both lists must be arrays');
if (!oldRaw.length) die('the old blog gave no posts: nothing is changed');
if (!newRaw.length) die('the new site gave no posts: nothing is changed');

const skippedOld = [];
const oldPosts = oldRaw.flatMap((p) => { const path = oldPathOf(p.url, BLOG); if (!path) { skippedOld.push(p.url); return []; } return [{ ...p, path }]; });
const newPosts = newRaw.filter((p) => typeof p.title === 'string' && typeof p.url === 'string' && p.url.startsWith('/'));

const r = matchTitles(oldPosts, newPosts);
const existing = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : [];
const today = new Date().toISOString().slice(0, 10);
const m = mergeLifetime(existing, r.pairs, today);
const bad = checkEntries(m.entries);
if (bad.length) die(`unsafe entries, nothing written:\n  ${bad.join('\n  ')}`);

const list = (t, a) => { if (a.length) console.log(`${t} (${a.length}):\n${a.slice(0, 25).map((x) => `  ${x}`).join('\n')}${a.length > 25 ? '\n  ...' : ''}`); };
console.log(`Old posts ${oldPosts.length}, new posts ${newPosts.length}, exact matches ${r.pairs.length}.`);
console.log(`Stored for life: ${m.entries.length} (added ${m.added.length}, moved with their post ${m.moved.length}).`);
list('Same title used more than once, skipped', r.ambiguous.map((a) => `"${a.title}"`));
list('Near matches, NOT redirected (read and fix a title by hand if they are the same story)', r.near.map((n) => `"${n.old.title}"  vs  "${n.new[0].title}"`));
list('Conflicts, kept as they were', m.conflicts.map((c) => `${c.from}: kept ${c.kept}, saw ${c.seen}`));
list('Old blog addresses of another shape, ignored', skippedOld);
console.log(`Only on the old blog: ${r.onlyOld.length}. Only on the new site: ${r.onlyNew.length}. (No redirect is made for these.)`);

if (flag('--dry')) { console.log('Dry run: nothing written.'); process.exit(0); }
const text = JSON.stringify(m.entries, null, 2) + '\n';
if (!existsSync(STORE) || readFileSync(STORE, 'utf8') !== text) writeFileSync(STORE, text);
mkdirSync('blogger', { recursive: true });
const snip = bloggerSnippet(m.entries, ORIGIN);
if (!existsSync(SNIPPET) || readFileSync(SNIPPET, 'utf8') !== snip) writeFileSync(SNIPPET, snip);
console.log(`Wrote ${STORE} and ${SNIPPET}.`);
