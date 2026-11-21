// Phase 7, part 1: writes the required pages (About, Contact, policies) into content/pages from config/publisher.json.
//   npm run pages                 writes the pages as drafts (read them first)
//   npm run pages -- --publish    writes them as published
//   npm run pages -- --dry        shows what would be written, writes nothing
// A page that already exists (same permalink) is never touched.
// v0.75.0: the Privacy page gets a "Checks that you are a person" section only when the contact form, the analytics beacon or push is switched on.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildPages, planWrites, featuresFrom } from './required-pages-lib.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const rootAt = args.indexOf('--root');
const root = rootAt >= 0 && args[rootAt + 1] ? args[rootAt + 1] : '.';
const dry = flag('--dry');
const status = flag('--publish') ? 'published' : 'draft';

const readJson = (f) => {
  const p = join(root, f);
  if (!existsSync(p)) throw new Error(`${f} is missing`);
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { throw new Error(`${f} is not valid JSON`); }
};

try {
  const site = readJson('config/site.json');
  const publisher = readJson('config/publisher.json');
  // A config file that is missing counts as "feature off". A file that is not valid JSON still stops with a plain message.
  const optional = (f) => (existsSync(join(root, f)) ? readJson(f) : {});
  const features = featuresFrom({ contact: optional('config/contact.json'), analytics: optional('config/analytics.json'), push: optional('config/push.json') });
  const pages = buildPages({ publisher, siteName: site.siteName, status, features });

  const dir = join(root, 'content/pages');
  const existing = existsSync(dir)
    ? readdirSync(dir).filter((n) => n.endsWith('.md')).map((n) => (readFileSync(join(dir, n), 'utf8').match(/^permalink:\s*"?([a-z0-9-]+)"?\s*$/m) || [])[1]).filter(Boolean)
    : [];
  const { write, skip } = planWrites(pages, existing);

  if (!dry) {
    mkdirSync(dir, { recursive: true });
    for (const p of write) writeFileSync(join(dir, p.file), p.markdown, { flag: 'wx' });
  }
  for (const p of write) console.log(`${dry ? 'would write' : 'wrote'}  content/pages/${p.file}  (${status})`);
  for (const p of skip) console.log(`left alone  ${p.slug}  (already exists)`);
  if (!dry && write.length && status === 'draft') console.log('\nThe pages are drafts. Read them, then set status to published (or run again with --publish on a clean folder).');
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
