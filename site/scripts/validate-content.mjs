// npm run check:content  (Phase 3d Part 2, LOGICS 23): checks the posts, pages, redirects and config files in seconds, before the build.
// Usage: node scripts/validate-content.mjs [--root <site folder>] [--base <git ref>] [file ...]
//   --base origin/main   also compares with that version: a published post whose address changed needs a redirect, and a config file must not lose a key.
//   file ...             check only these content files (paths relative to the site folder); redirects and config are always checked.
// Last line: "CONTENT PASS (...)" or "CONTENT FAIL (...)". Exit code 1 on any error. Warnings do not fail.
import { readdirSync, readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from '../public/admin/js/frontmatter.js';
import { checkPost, checkImagesConfig, checkPage, checkPosts, livePaths, checkRedirects, checkTags, checkMedia, removedKeys, addressChange, secretScan, mediaSizeWarning } from './validate-content-lib.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(opt('--root') || join(here, '..'));
const base = opt('--base');
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root' && args[i - 1] !== '--base');

const errors = [], warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const walk = (dir, ext) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
};
const rel = (p) => relative(root, p).split('\\').join('/');
const readJson = (p, label) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(label, `not valid JSON (${e.message})`); return undefined; } };
const gitShow = (path) => {
  if (!base) return null;
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  if (top.status !== 0) return null;
  const full = relative(top.stdout.trim(), join(root, path)).split('\\').join('/');
  const r = spawnSync('git', ['show', `${base}:${full}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};
if (base && spawnSync('git', ['rev-parse', '--verify', base], { cwd: root }).status !== 0) warn('--base', `${base} was not found, so the comparison with it is skipped`);

const site = existsSync(join(root, 'config/site.json')) ? readJson(join(root, 'config/site.json'), 'config/site.json') : undefined;
const tz = (site && site.timeZone) || 'UTC';
// The host of this site (from SITE_URL), so a full address of our own picture is not counted as an outside picture.
const ownHosts = process.env.SITE_URL ? [process.env.SITE_URL] : [];
// config/images.json: "hardBlock": true turns the outside-picture warning into an error (only the value true; anything else means warning only).
const imagesPath = join(root, 'config/images.json');
const imagesCfg = existsSync(imagesPath) ? readJson(imagesPath, 'config/images.json') : undefined;
if (imagesCfg !== undefined) for (const m of checkImagesConfig(imagesCfg)) err('config/images.json', m);
const hardBlock = !!imagesCfg && typeof imagesCfg === 'object' && imagesCfg.hardBlock === true;
// "blockHosts": a list of website names; only the good entries are used here (a bad entry is reported above).
const blockHosts = imagesCfg && typeof imagesCfg === 'object' && Array.isArray(imagesCfg.blockHosts) ? imagesCfg.blockHosts.filter((h) => typeof h === 'string') : [];
// "allowHosts": website names whose pictures count as our own (a bad entry is reported above).
const allowHosts = imagesCfg && typeof imagesCfg === 'object' && Array.isArray(imagesCfg.allowHosts) ? imagesCfg.allowHosts.filter((h) => typeof h === 'string') : [];
// "sizeWarnKb": a picture file bigger than this many KB is a warning; only a whole number above 0 turns it on.
const sizeWarnKb = imagesCfg && typeof imagesCfg === 'object' && Number.isInteger(imagesCfg.sizeWarnKb) && imagesCfg.sizeWarnKb > 0 ? imagesCfg.sizeWarnKb : 0;
const imageBytes = (p) => { try { return statSync(join(root, 'public', p.replace(/^\//, ''))).size; } catch { return undefined; } };
// "maxWidth": a picture wider than this many pixels is a warning; only a whole number above 0 turns it on. The width is read from the first 256 KB of the file.
const maxWidth = imagesCfg && typeof imagesCfg === 'object' && Number.isInteger(imagesCfg.maxWidth) && imagesCfg.maxWidth > 0 ? imagesCfg.maxWidth : 0;
const imageHead = (p) => {
  let fd;
  try { fd = openSync(join(root, 'public', p.replace(/^\//, '')), 'r'); const buf = Buffer.alloc(262144); const n = readSync(fd, buf, 0, buf.length, 0); return buf.subarray(0, n); } catch { return undefined; } finally { if (fd !== undefined) closeSync(fd); }
};
const imageExists = (p) => existsSync(join(root, 'public', p.replace(/^\//, '')));
const wanted = (file) => only.length === 0 || only.some((o) => o === file || o === './' + file);

// Posts
const postFiles = walk(join(root, 'content/blogs'), '.md');
const posts = [];
for (const p of postFiles) {
  const file = rel(p);
  const text = readFileSync(p, 'utf8');
  const r = checkPost({ text, imageExists, ownHosts, hardBlock, blockHosts, allowHosts, sizeWarnKb, imageBytes, maxWidth, imageHead });
  posts.push({ file, data: r.data, text });
  if (wanted(file)) { r.errors.forEach((m) => err(file, m)); r.warnings.forEach((m) => warn(file, m)); }
}
for (const m of checkPosts(posts.map(({ file, data }) => ({ file, data })), tz)) errors.push(m);

// Pages
const pageFiles = walk(join(root, 'content/pages'), '.md');
for (const p of pageFiles) {
  const file = rel(p);
  if (!wanted(file)) continue;
  const r = checkPage({ text: readFileSync(p, 'utf8') });
  r.errors.forEach((m) => err(file, m)); r.warnings.forEach((m) => warn(file, m));
}

// Redirects (manual list)
const redirectsPath = join(root, 'config/redirects.json');
const manual = existsSync(redirectsPath) ? readJson(redirectsPath, 'config/redirects.json') : [];
for (const m of checkRedirects(manual === undefined ? [] : manual, livePaths(posts.map(({ file, data }) => ({ file, data })), tz))) err('config/redirects.json', m);

// Tags (config/tags.json): search title and description by tag slug
const tagsPath = join(root, 'config/tags.json');
if (existsSync(tagsPath)) { const t = readJson(tagsPath, 'config/tags.json'); if (t !== undefined) for (const m of checkTags(t)) err('config/tags.json', m); }

// Picture details (config/media.json): alt text, caption and credit by file path
const mediaPath = join(root, 'config/media.json');
if (existsSync(mediaPath)) { const t = readJson(mediaPath, 'config/media.json'); if (t !== undefined) for (const m of checkMedia(t)) err('config/media.json', m); }

// Size of the pictures folder (BUGS U12): a warning near 1 GB. Skipped when only some files are named.
if (only.length === 0) {
  const mediaBytes = walk(join(root, 'public/media'), '').reduce((sum, f) => { try { return sum + statSync(f).size; } catch { return sum; } }, 0);
  const big = mediaSizeWarning(mediaBytes);
  if (big) warn('public/media', big);
}

// Every JSON file in config/ and content/authors: valid, no secret, and (with --base) no lost key
for (const p of [...walk(join(root, 'config'), '.json'), ...walk(join(root, 'content/authors'), '.json')]) {
  const file = rel(p);
  const text = readFileSync(p, 'utf8');
  const now = readJson(p, file);
  for (const k of secretScan(text)) err(file, `looks like ${k}; remove it`);
  const old = gitShow(file);
  if (old && now) { try { for (const k of removedKeys(JSON.parse(old), now)) err(file, `the key "${k}" was removed; keep it (an empty value is fine)`); } catch { /* the old file was not JSON: nothing to compare */ } }
}

// With --base: a published post whose address changed needs the old address in redirects
if (base) {
  for (const p of posts) {
    if (!wanted(p.file)) continue;
    const old = gitShow(p.file);
    if (!old) continue;
    const msg = addressChange(parse(old).data, p.data, Array.isArray(manual) ? manual : [], tz);
    if (msg) err(p.file, msg);
  }
}

for (const w of warnings) console.log('WARN  ' + w);
for (const e of errors) console.log('ERROR ' + e);
const counts = `${posts.length} post${posts.length === 1 ? '' : 's'}, ${pageFiles.length} page${pageFiles.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
console.log(errors.length ? `CONTENT FAIL (${errors.length} error${errors.length === 1 ? '' : 's'}, ${counts})` : `CONTENT PASS (${counts})`);
process.exit(errors.length ? 1 : 0);
