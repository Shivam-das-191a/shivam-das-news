// IndexNow (PLAN section 10). Needs env INDEXNOW_KEY (8-128 chars, letters/digits/dashes) and SITE_URL.
//   node scripts/indexnow.mjs --write-key        writes dist/indexnow-key.txt (runs in the build)
//   node scripts/indexnow.mjs [hours]            pings URLs from dist sitemaps changed in the last N hours (default 24)
//   add --dry to print the URLs without sending anything
//   node scripts/indexnow.mjs --git <base> [hours]   also pings the pages of content files changed since git commit <base> (v0.2.3)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathsForContentFile } from './indexnow-lib.mjs';

const key = process.env.INDEXNOW_KEY;
const site = (process.env.SITE_URL || '').replace(/\/+$/, '');

if (process.argv.includes('--write-key')) {
  if (key) { writeFileSync('dist/indexnow-key.txt', key); console.log('IndexNow key file written.'); }
  else console.log('INDEXNOW_KEY not set: key file skipped.');
  process.exit(0);
}
if (!key || !site) { console.error('Set INDEXNOW_KEY and SITE_URL first.'); process.exit(1); }

const args = process.argv.slice(2);
let gitBase = null;
let hours = 24;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--git') {
    const v = args[i + 1];
    const takesValue = !!v && !v.startsWith('-') && v.length >= 7; // a commit id; hours like "1" or "1.25" are shorter
    gitBase = takesValue && !/^0+$/.test(v) ? v : 'HEAD^'; // all zeros = first push on a branch: compare with the parent commit
    if (takesValue) i++;
  } else if (/^[0-9.]+$/.test(args[i])) hours = Number(args[i]) || 24;
}
const since = Date.now() - hours * 3_600_000;
const urls = new Set();
for (const f of readdirSync('dist').filter((n) => /^sitemap-.*\.xml$/.test(n) && n !== 'sitemap-index.xml')) {
  const xml = readFileSync(`dist/${f}`, 'utf8');
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    if (m[2] && new Date(m[2]).getTime() >= since) urls.add(m[1].replace(/&amp;/g, '&'));
  }
}

// v0.2.3: content files that really changed in git (also catches edits where `updated` was not set).
if (gitBase) {
  try {
    const tz = JSON.parse(readFileSync('config/site.json', 'utf8')).timeZone || 'UTC';
    const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', gitBase, 'HEAD', '--', 'site/content'], { cwd: '..', encoding: 'utf8' })
      .split('\n').filter((f) => f.endsWith('.md'));
    for (const f of changed) for (const p of pathsForContentFile(f, readFileSync(`../${f}`, 'utf8'), tz)) urls.add(site + p);
    console.log(`git: ${changed.length} changed content file(s) since ${gitBase}`);
  } catch (e) {
    console.warn('git diff failed, using the sitemap time window only: ' + e.message.split('\n')[0]);
  }
}
if (!urls.size) { console.log('Nothing to ping.'); process.exit(0); }
if (args.includes('--dry')) { console.log('DRY RUN, would send ' + urls.size + ' URL(s):\n' + [...urls].join('\n')); process.exit(0); }
const host = new URL(site).host;
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `${site}/indexnow-key.txt`, urlList: [...urls].slice(0, 10000) }),
});
console.log(`IndexNow: ${urls.size} URLs sent, HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
