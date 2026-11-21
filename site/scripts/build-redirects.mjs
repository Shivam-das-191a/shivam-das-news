// Writes, from dist/redirects-map.json (then removes that helper file):
//   dist/_redirects   real 301s for Cloudflare Pages (v0.4.0)
//   dist/gone.json    addresses that answer 410 (v0.6.0), read by functions/_middleware.js
//   dist/_routes.json the Function runs ONLY for the gone addresses, so normal page views stay free (v0.6.0)
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const src = 'dist/redirects-map.json';
if (!existsSync(src)) { console.log('No redirects map: skipped.'); process.exit(0); }
const { map = {}, gone = [] } = JSON.parse(readFileSync(src, 'utf8'));
rmSync(src);

const lines = Object.keys(map).sort().map((from) => `${from} ${map[from]} 301`);
if (lines.length > 2000) { console.error(`${lines.length} redirects: Cloudflare Pages allows 2000 static redirects. Remove old ones or use Bulk Redirects.`); process.exit(1); }
if (lines.length) { writeFileSync('dist/_redirects', lines.join('\n') + '\n'); console.log(`Wrote dist/_redirects with ${lines.length} redirect(s).`); }
else console.log('No redirects to write.');

// _routes.json needs at least one include rule and 100 rules at most. With nothing gone, "/gone-check/" is a path no page uses.
const include = gone.length ? gone : ['/gone-check/'];
if (include.length > 100 || include.some((r) => r.length > 100)) { console.error('Too many or too long gone addresses for _routes.json (100 rules, 100 characters each).'); process.exit(1); }
writeFileSync('dist/_routes.json', JSON.stringify({ version: 1, include, exclude: [] }, null, 2) + '\n');
if (gone.length) { writeFileSync('dist/gone.json', JSON.stringify({ paths: gone }) + '\n'); console.log(`Wrote dist/gone.json and dist/_routes.json with ${gone.length} gone address(es).`); }
else console.log('No gone addresses: _routes.json keeps the Function off every page.');
