import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkPost, checkImagesConfig, hostBlocked, localPictures, checkPage, checkPosts, livePaths, checkRedirects, removedKeys, addressChange, secretScan, headingsOf } from '../../scripts/validate-content-lib.mjs';

const DESC = 'A clear description of this story that is long enough to pass the fifty character minimum.';
const post = (o: Record<string, string> = {}, body = '## First heading\nText.') => {
  const f: Record<string, string> = { title: 'A real story title', permalink: 'a-real-story', category: 'technology', date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: DESC, image: '/media/a.webp', imageAlt: 'A picture', status: 'published', ...o };
  return `---\n${Object.entries(f).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}\n`;
};
const ok = (path: string) => path === '/media/a.webp';
const run = (text: string, imageExists = ok) => checkPost({ text, imageExists });

describe('checkPost', () => {
  it('a correct published post passes with no errors and no warnings', () => {
    const r = run(post());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it('a draft needs no image or description', () => {
    expect(run(post({ status: 'draft', image: undefined as any, imageAlt: undefined as any, description: undefined as any })).errors).toEqual([]);
  });
  it('published without image, alt or a good description fails', () => {
    expect(run(post({ image: undefined as any })).errors.join('|')).toMatch(/needs an image/);
    expect(run(post({ imageAlt: undefined as any })).errors.join('|')).toMatch(/needs imageAlt/);
    expect(run(post({ description: 'too short' })).errors.join('|')).toMatch(/50 to 160 characters \(now 9\)/);
    expect(run(post({ description: 'x'.repeat(161) })).errors.join('|')).toMatch(/at most 160/);
  });
  it('the image file must exist in public/; an outside address is only a warning', () => {
    expect(run(post({ image: '/media/missing.webp' })).errors.join('|')).toMatch(/was not found in public/);
    const r = run(post({ image: 'https://example.com/a.jpg' }));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('|')).toMatch(/outside address/);
    expect(run(post({ image: 'media/a.webp' })).errors.join('|')).toMatch(/must start with \//);
  });
  it('permalink and category must be slugs; title at least 5 characters; status and schemaType from the lists', () => {
    expect(run(post({ permalink: 'Bad Slug' })).errors.join('|')).toMatch(/permalink must be lowercase/);
    expect(run(post({ category: 'Tech News' })).errors.join('|')).toMatch(/category must be lowercase/);
    expect(run(post({ title: 'Hey' })).errors.join('|')).toMatch(/at least 5 characters/);
    expect(run(post({ status: 'live' })).errors.join('|')).toMatch(/status must be one of/);
    expect(run(post({ schemaType: 'Story' })).errors.join('|')).toMatch(/schemaType must be one of/);
  });
  it('the date needs a time zone offset: an error when published or scheduled, a warning for a draft', () => {
    expect(run(post({ date: '2026-11-12' })).errors.join('|')).toMatch(/time zone offset/);
    expect(run(post({ date: '2026-11-12T09:00:00' })).errors.join('|')).toMatch(/time zone offset/);
    const d = run(post({ date: '2026-11-12', status: 'draft' }));
    expect(d.errors).toEqual([]);
    expect(d.warnings.join('|')).toMatch(/time zone offset/);
    expect(run(post({ date: '2026-11-12T09:00:00+05:30' })).errors).toEqual([]);
    expect(run(post({ date: 'soon' })).errors.join('|')).toMatch(/not a real date/);
  });
  it('status scheduled is a warning', () => {
    const r = run(post({ status: 'scheduled' }));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('|')).toMatch(/use "published" with a future date/);
  });
  it('headings: the first must be H2 and no level may be skipped; code fences are ignored', () => {
    expect(run(post({}, '# Big\nText')).errors.join('|')).toMatch(/first heading must be H2/);
    expect(run(post({}, '## One\n#### Four')).errors.join('|')).toMatch(/skips a level/);
    expect(run(post({}, '## One\n### Two\n## Three')).errors).toEqual([]);
    expect(run(post({}, '## One\n```\n# not a heading\n```\n')).errors).toEqual([]);
    expect(headingsOf('text only')).toEqual([]);
  });
  it('an emoji or a token-like string is an error', () => {
    expect(run(post({}, '## One\nGood news \u{1F600}')).errors.join('|')).toMatch(/emoji/);
    expect(run(post({}, '## One\nkey ' + 'ghp_' + 'a'.repeat(30))).errors.join('|')).toMatch(/GitHub token/);
  });
  it('no front matter is one plain error', () => {
    expect(run('just text').errors).toEqual(['no front matter between --- lines']);
  });
  it('push text limits and booleans', () => {
    expect(run(post({ pushTitle: 'x'.repeat(71) })).errors.join('|')).toMatch(/pushTitle/);
    expect(run(post({ pushBody: 'x'.repeat(121) })).errors.join('|')).toMatch(/pushBody/);
    expect(run(post({ breaking: 'yes' })).errors.join('|')).toMatch(/breaking must be true or false/);
  });
});

describe('checkPage', () => {
  const page = (o: Record<string, string> = {}) => `---\n${Object.entries({ title: 'About us', permalink: 'about', date: '2026-11-01T00:00:00Z', status: 'published', ...o }).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\nText.\n`;
  it('a good page passes; bad slug, status or title fail', () => {
    expect(checkPage({ text: page() }).errors).toEqual([]);
    expect(checkPage({ text: page({ permalink: 'About Us' }) }).errors.join('|')).toMatch(/permalink/);
    expect(checkPage({ text: page({ status: 'archived' }) }).errors.join('|')).toMatch(/status must be one of draft, published/);
    expect(checkPage({ text: page({ title: 'A' }) }).errors.join('|')).toMatch(/at least 2/);
  });
});

describe('checkPosts and livePaths', () => {
  const p = (file: string, o: Record<string, string>) => ({ file, data: { permalink: 'same', category: 'technology', date: '2026-11-12T09:00:00Z', status: 'published', ...o } });
  it('the same permalink twice is an error naming both files', () => {
    const e = checkPosts([p('a.md', {}), p('b.md', { category: 'world' })], 'UTC');
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/b\.md: permalink "same" is also used by a\.md/);
    expect(checkPosts([p('a.md', {}), p('b.md', { permalink: 'other' })], 'UTC')).toEqual([]);
  });
  it('livePaths lists only published posts', () => {
    const s = livePaths([p('a.md', {}), p('b.md', { permalink: 'draft-one', status: 'draft' })], 'UTC');
    expect([...s]).toEqual(['/2026/11/12/blogs/technology/same/']);
  });
});

describe('checkRedirects', () => {
  it('good list passes; empty list passes', () => {
    expect(checkRedirects([], new Set())).toEqual([]);
    expect(checkRedirects([{ from: '/old/', to: '/new/' }], new Set())).toEqual([]);
  });
  it('catches not a list, bad entries, not normalized, same address, live page, duplicate from, too many', () => {
    expect(checkRedirects({} as any)).toEqual(['redirects.json must be a list']);
    expect(checkRedirects([null as any]).join('|')).toMatch(/must be \{/);
    expect(checkRedirects([{ from: 'old', to: '/new/' }]).join('|')).toMatch(/not a usable old address/);
    expect(checkRedirects([{ from: '/old', to: '/new/' }]).join('|')).toMatch(/not normalized, write \/old\//);
    expect(checkRedirects([{ from: '/a/', to: '/a/' }]).join('|')).toMatch(/the same/);
    expect(checkRedirects([{ from: '/live/', to: '/x/' }], new Set(['/live/'])).join('|')).toMatch(/live page/);
    expect(checkRedirects([{ from: '/a/', to: '/b/' }, { from: '/a/', to: '/c/' }]).join('|')).toMatch(/already has a redirect/);
    const many = Array.from({ length: 2001 }, (_, i) => ({ from: `/o${i}/`, to: '/n/' }));
    expect(checkRedirects(many).join('|')).toMatch(/2001 redirects/);
  });
});

describe('removedKeys, addressChange and secretScan', () => {
  it('lists a removed key, also a nested one; an added key and an emptied value are fine', () => {
    expect(removedKeys({ a: 1, b: { c: 1, d: 2 } }, { a: 1, b: { c: 1 } })).toEqual(['b.d']);
    expect(removedKeys({ a: 1 }, {})).toEqual(['a']);
    expect(removedKeys({ a: 1 }, { a: '', z: 2 })).toEqual([]);
    expect(removedKeys(undefined, { a: 1 })).toEqual([]);
  });
  const prev = { status: 'published', category: 'technology', permalink: 'x', date: '2026-11-12T09:00:00Z' };
  it('a changed address of a published post needs the old address in a redirect', () => {
    const next = { ...prev, permalink: 'y' };
    const old = '/2026/11/12/blogs/technology/x/';
    expect(addressChange(prev, next, [], 'UTC')).toMatch(/changed to .*\/y\/ but the old address is not in redirects/);
    expect(addressChange(prev, { ...next, redirects: [old] }, [], 'UTC')).toBe('');
    expect(addressChange(prev, next, [{ from: old, to: '/2026/11/12/blogs/technology/y/' }], 'UTC')).toBe('');
    expect(addressChange(prev, { ...prev }, [], 'UTC')).toBe('');
    expect(addressChange({ ...prev, status: 'draft' }, next, [], 'UTC')).toBe('');
    expect(addressChange(prev, { ...prev, category: 'world' }, [], 'UTC')).toMatch(/changed/);
  });
  it('secretScan finds tokens, keys and 64 hex strings; ordinary text and a 43 character code are clean', () => {
    expect(secretScan('ghp_' + 'A1'.repeat(15))).toHaveLength(1);
    expect(secretScan('github_pat_' + 'a'.repeat(30))).toHaveLength(1);
    expect(secretScan('sk-' + 'a'.repeat(30))).toHaveLength(1);
    expect(secretScan('-----BEGIN PRIVATE KEY-----')).toHaveLength(1);
    expect(secretScan('f'.repeat(64))).toHaveLength(1);
    expect(secretScan('zcb1sDXPTidVPfpxDjMVAHe6IdNRzUnmMSeUb8fMLpQ and plain words')).toEqual([]);
  });
});

describe('same rules as the build', () => {
  const cfg = readFileSync('src/content.config.ts', 'utf8');
  it('src/content.config.ts still has the numbers the script uses', () => {
    for (const s of ['title: z.string().min(5)', 'description: z.string().max(160)', 'pushTitle: z.string().max(70)', 'pushBody: z.string().max(120)', "z.enum(['draft', 'scheduled', 'published', 'archived'])", "z.enum(['NewsArticle', 'Article', 'BlogPosting'])", "z.enum(['auto', 'off', 'force'])", 'd.description.length >= 50', 'title: z.string().min(2)', "z.enum(['draft', 'published'])", 'regex(/^[a-z0-9]+(-[a-z0-9]+)*$/']) expect(cfg).toContain(s);
  });
});

describe('npm run check:content (the script)', () => {
  const node = (cwd: string, args: string[]) => spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', cwd, ...args], { encoding: 'utf8' });
  const site = () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const s of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, s), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), 'x');
    return d;
  };
  it('passes on a clean site and says how many posts', () => {
    const d = site();
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post());
    const r = node(d, []);
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n').pop()).toBe('CONTENT PASS (1 post, 0 pages, 0 warnings)');
  });
  it('fails with one line per problem and a FAIL last line', () => {
    const d = site();
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({ imageAlt: undefined as any }));
    writeFileSync(join(d, 'content/blogs/technology/b.md'), post({ title: 'Another story here' }));
    const r = node(d, []);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('ERROR content/blogs/technology/a-real-story.md: a published post needs imageAlt');
    expect(r.stdout).toMatch(/b\.md: permalink "a-real-story" is also used by/);
    expect(r.stdout.trim().split('\n').pop()).toMatch(/^CONTENT FAIL \(3 errors, 2 posts/);
  });
  it('a bad JSON file, a secret in config and a live page in redirects each fail', () => {
    const d = site();
    writeFileSync(join(d, 'config/links.json'), '{ nope');
    writeFileSync(join(d, 'config/push.json'), JSON.stringify({ k: 'f'.repeat(64) }));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post());
    writeFileSync(join(d, 'config/redirects.json'), JSON.stringify([{ from: '/2026/11/12/blogs/technology/a-real-story/', to: '/x/' }]));
    const out = node(d, []).stdout;
    expect(out).toMatch(/config\/links\.json: not valid JSON/);
    expect(out).toMatch(/config\/push\.json: looks like a 64 character hex string/);
    expect(out).toMatch(/config\/redirects\.json: redirect 1: .* is a live page/);
  });
  it('named files limit the post checks; a missing image file is found', () => {
    const d = site();
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({ image: '/media/nope.webp' }));
    writeFileSync(join(d, 'content/blogs/technology/b.md'), post({ permalink: 'b-story', title: 'Another story here', imageAlt: undefined as any }));
    const r = node(d, ['content/blogs/technology/a-real-story.md']);
    expect(r.stdout).toMatch(/nope\.webp was not found/);
    expect(r.stdout).not.toMatch(/b\.md: a published post needs imageAlt/);
  });
  it('--base: a removed config key and a changed address without a redirect both fail; fixing both passes', () => {
    const d = site();
    const sh = (...a: string[]) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC', tagline: 't' }));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post());
    sh('init', '-q', '-b', 'main'); sh('add', '-A'); sh('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'one');
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({ permalink: 'moved-story' }));
    const bad = node(d, ['--base', 'main']);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/config\/site\.json: the key "tagline" was removed/);
    expect(bad.stdout).toMatch(/a-real-story\.md: the address .* changed to .*moved-story\/ but the old address is not in redirects/);
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC', tagline: 'new' }));
    writeFileSync(join(d, 'config/redirects.json'), JSON.stringify([{ from: '/2026/11/12/blogs/technology/a-real-story/', to: '/2026/11/12/blogs/technology/moved-story/' }]));
    expect(node(d, ['--base', 'main']).status).toBe(0);
  });
  it('--base with the same file path: the address change is caught, and passes once the old address is in redirects', () => {
    const d = site();
    const sh = (...a: string[]) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post());
    sh('init', '-q', '-b', 'main'); sh('add', '-A'); sh('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'one');
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({ date: '2026-11-13T09:00:00Z' }));
    const bad = node(d, ['--base', 'main']);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/the address \/2026\/11\/12\/blogs\/technology\/a-real-story\/ changed to .* not in redirects/);
    writeFileSync(join(d, 'config/redirects.json'), JSON.stringify([{ from: '/2026/11/12/blogs/technology/a-real-story/', to: '/2026/11/13/blogs/technology/a-real-story/' }]));
    expect(node(d, ['--base', 'main']).status).toBe(0);
  });
  it('the real repository content passes', () => {
    const r = spawnSync('node', ['scripts/validate-content.mjs'], { encoding: 'utf8' });
    expect(r.stdout.trim().split('\n').pop()).toMatch(/^CONTENT PASS/);
  });
});

describe('the build gate for outside pictures in the text (PLAN 34.9, Part 6a)', () => {
  const OUT = 'https://cdn.other.test/photo.jpg';
  it('warns once for a published post whose text shows an outside picture, with the first address', () => {
    const r = run(post({}, `## First heading\nText.\n\n![x](${OUT})\n\n<img src="https://img.other.test/b.png">`));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([`2 pictures in the text are on another website (first: ${OUT}); host them on the site (AI_OPERATIONS 8)`]);
  });
  it('says "1 picture ... is" for one picture', () => {
    expect(run(post({}, `## First heading\n![x](${OUT})`)).warnings[0]).toMatch(/^1 picture in the text is on another website .*host it on the site/);
  });
  it('also warns for a scheduled post, but not for a draft or an archived post', () => {
    const body = `## First heading\n![x](${OUT})`;
    const mine = (st: string) => run(post({ status: st }, body)).warnings.filter((w: string) => w.includes('on another website'));
    expect(mine('scheduled')).toHaveLength(1);
    expect(mine('draft')).toEqual([]);
    expect(mine('archived')).toEqual([]);
  });
  it('does not warn for our own pictures, relative addresses, data pictures, code or the site host', () => {
    const body = '## First heading\n![a](/media/a.webp)\n\n![b](https://news.own.test/media/a.webp)\n\n<img src="data:image/png;base64,AAAA">\n\n```\n![c](https://cdn.other.test/in-code.jpg)\n```\n';
    expect(checkPost({ text: post({}, body), imageExists: ok, ownHosts: ['https://news.own.test'] }).warnings).toEqual([]);
  });
  it('is only a warning: nothing fails', () => {
    expect(run(post({}, `## First heading\n![x](${OUT})`)).errors).toEqual([]);
  });
  it('the script prints it as WARN and still passes; SITE_URL marks our own host', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), 'x');
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, `## First heading\n![x](${OUT})\n\n![y](https://news.own.test/media/a.webp)`));
    const run1 = (env: Record<string, string>) => spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, ...env } });
    const a = run1({ SITE_URL: 'https://news.own.test' });
    expect(a.status).toBe(0);
    expect(a.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: 1 picture in the text is on another website');
    expect(a.stdout.trim().split('\n').pop()).toBe('CONTENT PASS (1 post, 0 pages, 1 warning)');
    const b = run1({ SITE_URL: '' });
    expect(b.stdout).toContain('2 pictures in the text are on another website');
  });
});

describe('the hard block setting (config/images.json, PLAN 34.10, Part 7a)', () => {
  const OUT = 'https://cdn.other.test/photo.jpg';
  const body = `## First heading\n![x](${OUT})`;
  it('hardBlock true turns the warning into an error with the same text; false or missing keeps a warning', () => {
    const hard = checkPost({ text: post({}, body), imageExists: ok, hardBlock: true });
    const soft = checkPost({ text: post({}, body), imageExists: ok });
    expect(hard.warnings).toEqual([]);
    expect(hard.errors).toEqual(soft.warnings);
    expect(soft.errors).toEqual([]);
    expect(checkPost({ text: post({}, body), imageExists: ok, hardBlock: false }).errors).toEqual([]);
  });
  it('only the value true blocks, and a draft is never blocked', () => {
    for (const v of ['true', 1, 'on', null, {}]) expect(checkPost({ text: post({}, body), imageExists: ok, hardBlock: v as any }).errors).toEqual([]);
    expect(checkPost({ text: post({ status: 'draft' }, body), imageExists: ok, hardBlock: true }).errors).toEqual([]);
  });
  it('checkImagesConfig accepts the shipped shape and refuses a wrong type', () => {
    expect(checkImagesConfig({ hardBlock: false })).toEqual([]);
    expect(checkImagesConfig({ hardBlock: true })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
    for (const v of ['true', 1, null]) expect(checkImagesConfig({ hardBlock: v })).toHaveLength(1);
    for (const v of [null, [], 'x', 3, undefined]) expect(checkImagesConfig(v)).toHaveLength(1);
  });
  it('the shipped config/images.json exists with hardBlock false, empty block and allow lists and the size warning off', () => {
    expect(JSON.parse(readFileSync('config/images.json', 'utf8'))).toEqual({ hardBlock: false, blockHosts: [], allowHosts: [], sizeWarnKb: 0, maxWidth: 0, quality: 85, storage: 'repo', askFirst: false, askHosts: [], nameOrder: ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle'], enabled: true });
  });
  it('the script: hardBlock true fails with the error, false passes with the warning, a bad value fails', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), 'x');
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, body));
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const off = go('{"hardBlock": false}');
    expect(off.status).toBe(0);
    expect(off.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: 1 picture in the text is on another website');
    const on = go('{"hardBlock": true}');
    expect(on.status).toBe(1);
    expect(on.stdout).toContain('ERROR content/blogs/technology/a-real-story.md: 1 picture in the text is on another website');
    const quoted = go('{"hardBlock": "true"}');
    expect(quoted.status).toBe(1);
    expect(quoted.stdout).toContain('ERROR config/images.json: "hardBlock" must be true or false');
    expect(quoted.stdout).toContain('WARN  content/blogs/technology/a-real-story.md');
  });
});

describe('the block list setting (config/images.json blockHosts, PLAN 34.10, Part 7b)', () => {
  const BAD = 'https://cdn.badhost.test/photo.jpg';
  const OK = 'https://cdn.other.test/photo.jpg';
  const textWith = (...urls: string[]) => `## First heading\n${urls.map((u) => `![x](${u})`).join('\n')}`;

  it('hostBlocked: the same host and its sub-sites match, a similar name does not, bad entries are skipped', () => {
    expect(hostBlocked(BAD, ['badhost.test'])).toBe(true);
    expect(hostBlocked('https://badhost.test/a.jpg', ['badhost.test'])).toBe(true);
    expect(hostBlocked('https://CDN.BadHost.test/a.jpg', ['BADHOST.test'])).toBe(true);
    expect(hostBlocked('https://notbadhost.test/a.jpg', ['badhost.test'])).toBe(false);
    expect(hostBlocked('https://badhost.test.other.test/a.jpg', ['badhost.test'])).toBe(false);
    expect(hostBlocked(BAD, [])).toBe(false);
    expect(hostBlocked(BAD, undefined as any)).toBe(false);
    expect(hostBlocked(BAD, [3, null, 'https://badhost.test', '', 'a b'] as any)).toBe(false);
    expect(hostBlocked('not an address', ['badhost.test'])).toBe(false);
  });

  it('a blocked picture in a live post is an error even when hardBlock is off; an ordinary outside picture stays a warning', () => {
    const r = checkPost({ text: post({}, textWith(BAD, OK)), imageExists: ok, blockHosts: ['badhost.test'] });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('1 picture in the text is from a website on the block list in config/images.json (first: ' + BAD + ')');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('1 picture in the text is on another website (first: ' + OK + ')');
  });

  it('two blocked pictures are counted together, and with hardBlock on the other picture is an error too', () => {
    const two = checkPost({ text: post({}, textWith(BAD, 'https://img.badhost.test/b.jpg')), imageExists: ok, blockHosts: ['badhost.test'] });
    expect(two.errors).toHaveLength(1);
    expect(two.errors[0]).toContain('2 pictures in the text are from a website on the block list');
    const both = checkPost({ text: post({}, textWith(BAD, OK)), imageExists: ok, blockHosts: ['badhost.test'], hardBlock: true });
    expect(both.errors).toHaveLength(2);
    expect(both.warnings).toEqual([]);
  });

  it('nothing changes with an empty or missing list, and a draft is never blocked', () => {
    const base = checkPost({ text: post({}, textWith(BAD)), imageExists: ok });
    expect(checkPost({ text: post({}, textWith(BAD)), imageExists: ok, blockHosts: [] })).toEqual(base);
    expect(base.errors).toEqual([]);
    expect(checkPost({ text: post({ status: 'draft' }, textWith(BAD)), imageExists: ok, blockHosts: ['badhost.test'] }).errors).toEqual([]);
  });

  it('a picture of our own site is never blocked by a list entry for our own host', () => {
    const r = checkPost({ text: post({}, textWith('https://news.own.test/media/a.webp')), imageExists: ok, ownHosts: ['https://news.own.test'], blockHosts: ['own.test'] });
    expect(r.errors).toEqual([]);
  });

  it('checkImagesConfig accepts a good list and names the bad entry', () => {
    expect(checkImagesConfig({ hardBlock: false, blockHosts: [] })).toEqual([]);
    expect(checkImagesConfig({ blockHosts: ['photos.example.com', 'Example.org'] })).toEqual([]);
    for (const v of ['x.com', 3, null, {}]) expect(checkImagesConfig({ blockHosts: v })).toHaveLength(1);
    for (const h of ['https://x.com', 'x.com/path', 'a b', '', '.x.com', 'x.com.', 3, null]) {
      const m = checkImagesConfig({ blockHosts: ['ok.example.com', h] });
      expect(m).toHaveLength(1);
      expect(m[0]).toContain('entry 2');
    }
    expect(checkImagesConfig({ blockHosts: Array.from({ length: 201 }, (_, i) => `h${i}.example.com`) })).toHaveLength(1);
  });

  it('the script: a blocked picture fails, a bad entry fails with its position, an empty list only warns', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), 'x');
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, textWith(BAD)));
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const empty = go('{"hardBlock": false, "blockHosts": []}');
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: 1 picture in the text is on another website');
    const listed = go('{"hardBlock": false, "blockHosts": ["badhost.test"]}');
    expect(listed.status).toBe(1);
    expect(listed.stdout).toContain('ERROR content/blogs/technology/a-real-story.md: 1 picture in the text is from a website on the block list');
    const bad = go('{"blockHosts": ["https://badhost.test"]}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "blockHosts" entry 1 must be a website name only');
    expect(bad.stdout).toContain('WARN  content/blogs/technology/a-real-story.md');
  });
});

describe('the picture size warning (config/images.json sizeWarnKb, PLAN 34.10, Part 7c)', () => {
  const sizes: Record<string, number> = { '/media/a.webp': 400 * 1024, '/media/og.webp': 500 * 1024, '/media/small.webp': 100 * 1024 };
  const imageBytes = (p: string) => sizes[p];
  const exists = (p: string) => p in sizes;
  const go = (o: Record<string, string>, extra: Record<string, unknown> = {}) => checkPost({ text: post(o), imageExists: exists, imageBytes, ...extra });

  it('a picture over the limit is a warning that names the file, its size and the limit; it is never an error', () => {
    const r = go({}, { sizeWarnKb: 300 });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the image /media/a.webp is 400 KB, over the limit of 300 KB in config/images.json; make the picture smaller']);
  });
  it('the share picture is checked too, and a picture under the limit gives no warning', () => {
    const r = go({ ogImage: '/media/og.webp' }, { sizeWarnKb: 300 });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain('the share picture /media/og.webp is 500 KB');
    expect(go({ image: '/media/small.webp' }, { sizeWarnKb: 300 }).warnings).toEqual([]);
    expect(go({}, { sizeWarnKb: 400 }).warnings).toEqual([]);
  });
  it('off with 0, missing or a wrong value; the same result as before', () => {
    const base = go({});
    expect(base.warnings).toEqual([]);
    for (const v of [0, undefined, -5, 'big', null, NaN, Infinity, {}]) expect(go({}, { sizeWarnKb: v }).warnings).toEqual([]);
  });
  it('a draft is not checked, and an unknown file size is ignored', () => {
    expect(go({ status: 'draft' }, { sizeWarnKb: 300 }).warnings).toEqual([]);
    expect(checkPost({ text: post(), imageExists: () => true, imageBytes: () => undefined, sizeWarnKb: 300 }).warnings).toEqual([]);
    expect(checkPost({ text: post(), imageExists: () => true, sizeWarnKb: 300 }).warnings).toEqual([]);
  });
  it('checkImagesConfig accepts whole numbers from 0 to 20000 and refuses the rest', () => {
    for (const v of [0, 1, 300, 20000]) expect(checkImagesConfig({ sizeWarnKb: v })).toEqual([]);
    for (const v of [-1, 20001, 1.5, '300', null, true]) expect(checkImagesConfig({ sizeWarnKb: v })).toHaveLength(1);
    expect(checkImagesConfig({ sizeWarnKb: '300' })[0]).toContain('"sizeWarnKb" must be a whole number');
  });
  it('the script: a big file warns and still passes, 0 is quiet, a bad value fails', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), Buffer.alloc(3 * 1024));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post());
    const run2 = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const off = run2('{"sizeWarnKb": 0}');
    expect(off.status).toBe(0);
    expect(off.stdout).not.toContain('over the limit');
    const on = run2('{"sizeWarnKb": 2}');
    expect(on.status).toBe(0);
    expect(on.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: the image /media/a.webp is 3 KB, over the limit of 2 KB');
    expect(run2('{"sizeWarnKb": 5}').stdout).not.toContain('over the limit');
    const bad = run2('{"sizeWarnKb": "300"}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "sizeWarnKb" must be a whole number');
    expect(bad.stdout).not.toContain('over the limit');
  });
});

describe('the allow list setting (config/images.json allowHosts, PLAN 34.10, Part 7d)', () => {
  const MEDIA = 'https://media.own-cdn.test/photo.jpg';
  const OTHER = 'https://cdn.other.test/photo.jpg';
  const textWith = (...urls: string[]) => `## First heading\n${urls.map((u) => `![x](${u})`).join('\n')}`;

  it('a picture from an allowed website (or a sub-site) gets no warning; another outside picture still does', () => {
    const r = checkPost({ text: post({}, textWith(MEDIA, OTHER)), imageExists: ok, allowHosts: ['own-cdn.test'] });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('1 picture in the text is on another website (first: ' + OTHER + ')');
    const only = checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok, allowHosts: ['own-cdn.test'] });
    expect(only.warnings).toEqual([]);
  });
  it('an allowed picture is not an error even with hardBlock on; the other one is', () => {
    const r = checkPost({ text: post({}, textWith(MEDIA, OTHER)), imageExists: ok, allowHosts: ['own-cdn.test'], hardBlock: true });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain(OTHER);
    expect(r.warnings).toEqual([]);
  });
  it('the block list wins when a name is in both lists', () => {
    const r = checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok, allowHosts: ['own-cdn.test'], blockHosts: ['own-cdn.test'] });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('on the block list');
  });
  it('an empty or missing list changes nothing; a similar name is not allowed; bad entries are skipped', () => {
    const base = checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok });
    expect(checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok, allowHosts: [] })).toEqual(base);
    expect(base.warnings).toHaveLength(1);
    expect(checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok, allowHosts: ['cdn.test'] }).warnings).toHaveLength(1);
    expect(checkPost({ text: post({}, textWith(MEDIA)), imageExists: ok, allowHosts: [3, null, 'https://own-cdn.test'] as any }).warnings).toHaveLength(1);
  });
  it('a draft is never checked', () => {
    expect(checkPost({ text: post({ status: 'draft' }, textWith(MEDIA)), imageExists: ok }).warnings).toEqual([]);
  });
  it('checkImagesConfig checks allowHosts like blockHosts and refuses a name in both lists', () => {
    expect(checkImagesConfig({ allowHosts: [] })).toEqual([]);
    expect(checkImagesConfig({ allowHosts: ['media.example.com'], blockHosts: ['other.example.com'] })).toEqual([]);
    for (const v of ['x.com', 3, null, {}]) expect(checkImagesConfig({ allowHosts: v })).toHaveLength(1);
    const bad = checkImagesConfig({ allowHosts: ['ok.example.com', 'https://x.com'] });
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('"allowHosts" entry 2');
    const both = checkImagesConfig({ blockHosts: ['Same.example.com'], allowHosts: ['same.example.com'] });
    expect(both).toHaveLength(1);
    expect(both[0]).toContain('is in both "blockHosts" and "allowHosts"');
    expect(checkImagesConfig({ allowHosts: Array.from({ length: 201 }, (_, i) => `h${i}.example.com`) })).toHaveLength(1);
  });
  it('the script: an allowed website passes quietly, an empty list warns, a bad entry fails', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), 'x');
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, textWith(MEDIA)));
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const empty = go('{"allowHosts": []}');
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: 1 picture in the text is on another website');
    const listed = go('{"hardBlock": true, "allowHosts": ["own-cdn.test"]}');
    expect(listed.status).toBe(0);
    expect(listed.stdout).not.toContain('another website');
    const bad = go('{"allowHosts": ["https://own-cdn.test"]}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "allowHosts" entry 1 must be a website name only');
  });
});

describe('the size warning for pictures inside the text (sizeWarnKb, PLAN 34.10, Part 7e)', () => {
  const sizes: Record<string, number> = { '/media/a.webp': 100 * 1024, '/media/big.webp': 400 * 1024, '/media/big2.webp': 500 * 1024 };
  const imageBytes = (p: string) => sizes[p];
  const exists = () => true;
  const withBody = (body: string, o: Record<string, string> = {}, extra: Record<string, unknown> = {}) => checkPost({ text: post(o, body), imageExists: exists, imageBytes, sizeWarnKb: 300, ...extra });

  it('localPictures finds Markdown and img pictures of our site, once each, in order', () => {
    const b = '## H\n![a](/media/a.webp) text <img src="/media/b.webp?x=1" alt="q"> ![o](https://x.test/o.jpg)\n```\n![c](/media/code.webp)\n```\n`![d](/media/inline.webp)` ![e](/media/../secret.png) <img src=/media/e.webp> ![again](/media/a.webp "t") <img src=\'/media/f.webp\'>';
    expect(localPictures(b)).toEqual(['/media/a.webp', '/media/b.webp', '/media/e.webp', '/media/f.webp']);
    expect(localPictures('')).toEqual([]);
    expect(localPictures(undefined as any)).toEqual([]);
    expect(localPictures('![x](/images/a.webp) ![y](media/a.webp) <img alt="no src">')).toEqual([]);
  });
  it('a big picture in the text of a published post is a warning with its file, size and the limit', () => {
    const r = withBody('## First heading\n![x](/media/big.webp)');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the picture in the text /media/big.webp is 400 KB, over the limit of 300 KB in config/images.json; make the picture smaller']);
  });
  it('an img tag is measured too, a small picture is not, and two big ones give two warnings', () => {
    const r = withBody('## First heading\n<img src="/media/big2.webp" alt="x">\n![s](/media/a.webp)\n![y](/media/big.webp)');
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain('/media/big2.webp is 500 KB');
    expect(r.warnings[1]).toContain('/media/big.webp is 400 KB');
  });
  it('a file used as the top picture and in the text is reported once', () => {
    const r = withBody('## First heading\n![x](/media/big.webp)', { image: '/media/big.webp' });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('the image /media/big.webp is 400 KB');
  });
  it('off, a draft, a scheduled post, code and an unknown size give no size warning', () => {
    const b = '## First heading\n![x](/media/big.webp)';
    expect(withBody(b, {}, { sizeWarnKb: 0 }).warnings).toEqual([]);
    expect(withBody(b, { status: 'draft' }).warnings).toEqual([]);
    expect(withBody(b, { status: 'scheduled' }).warnings.join('|')).not.toContain('over the limit');
    expect(withBody('## First heading\n```\n![x](/media/big.webp)\n```').warnings).toEqual([]);
    expect(withBody('## First heading\n![x](/media/unknown.webp)').warnings).toEqual([]);
  });
  it('the script: a big picture in the text warns and still passes; a bigger limit is quiet', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), Buffer.alloc(1024));
    writeFileSync(join(d, 'public/media/body.webp'), Buffer.alloc(3 * 1024));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, '## First heading\n![x](/media/body.webp)'));
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const on = go('{"sizeWarnKb": 2}');
    expect(on.status).toBe(0);
    expect(on.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: the picture in the text /media/body.webp is 3 KB, over the limit of 2 KB');
    expect(go('{"sizeWarnKb": 5}').stdout).not.toContain('over the limit');
    expect(go('{"sizeWarnKb": 0}').stdout).not.toContain('over the limit');
  });
});
