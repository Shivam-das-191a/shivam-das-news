// npm run verify:live -- https://yourdomain.com / /2026/11/16/blogs/news/my-post/ /old-address@301
// Opens each address on the real site and checks it (LOGICS 31.11). One line per address, then VERIFY-LIVE PASS or FAIL. Exit 1 on failure.
// "path@301" means that address must answer with that redirect status. --allow-noindex is for a page that is meant to be noindex.
// Needs a computer that can reach the website (the Cloudflare preview or the live site).
import { verifyAll } from './verify-live-lib.mjs';

const args = process.argv.slice(2);
const allowNoindex = args.includes('--allow-noindex');
const rest = args.filter((a) => !a.startsWith('--'));
const [base, ...specs] = rest;
if (!base || !/^https?:\/\//i.test(base)) {
  console.error('Usage: npm run verify:live -- https://yourdomain.com /path1 /path2@301 [--allow-noindex]');
  console.log('VERIFY-LIVE FAIL (no base address)');
  process.exit(1);
}
const r = await verifyAll(fetch, base, specs.length ? specs : ['/'], { allowNoindex });
for (const l of r.lines) console.log(l);
console.log(r.last);
process.exit(r.ok ? 0 : 1);
