import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain .mjs helper
import { readFront, bodyOf, countWords, postFromFile, skipReason, selectRecent, readSettings, retryKeys, describeResults, MAX_POSTS, MAX_AGE_MIN, FUTURE_SLACK_MS as SLACK, SECRET_HEADER as HEADER } from '../../scripts/push-announce-lib.mjs';
// @ts-ignore plain JS Worker code
import { ANNOUNCE_MAX_POSTS, FUTURE_SLACK_MS, SECRET_HEADER } from '../../../workers/push/announce.js';
// @ts-ignore plain JS Worker code
import { MAX_AGE_MIN as WORKER_MAX_AGE_MIN } from '../../../workers/push/lib.js';
// @ts-expect-error plain .mjs helper
import { findIconGlyphs } from '../../scripts/no-emoji-lib.mjs';

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const NOW = Date.parse('2026-11-16T12:00:00Z');
const file = 'content/blogs/technology/a.md';
const doc = (extra = '', over: Record<string, string> = {}) => {
  const f: Record<string, string> = { title: 'A real headline', permalink: 'real-headline', category: 'technology', date: '2026-11-16T11:30:00Z', status: 'published', ...over };
  const lines = Object.entries(f).map(([k, v]) => `${k}: ${k === 'date' ? v : JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n${extra}---\n\nFirst words of the story here.\n`;
};
const opts = { timeZone: 'Asia/Kolkata', siteUrl: 'https://news.example' };

describe('push announce script: reading the front matter (v0.94.0)', () => {
  it('reads plain values, booleans, inline lists and block lists', () => {
    const fm = readFront(doc('breaking: true\ntags: ["one", "two"]\nkeyPoints:\n  - first\n  - "second"\nfeatured: false\n'));
    expect(fm.permalink).toBe('real-headline');
    expect(fm.breaking).toBe(true);
    expect(fm.featured).toBe(false);
    expect(fm.tags).toEqual(['one', 'two']);
    expect(fm.keyPoints).toEqual(['first', 'second']);
  });
  it('gives null without a front matter block and the body without it', () => {
    expect(readFront('no front matter')).toBeNull();
    expect(bodyOf(doc())).toContain('First words');
    expect(bodyOf(doc())).not.toContain('permalink');
  });
  it('counts words and ignores marks and links', () => {
    expect(countWords('# Title\n\nOne two [three four](https://x.example) ![img](a.png) five')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});

describe('push announce script: one file to one post', () => {
  it('builds the address with the site time zone and the key from the permalink', () => {
    const text = doc('', { date: '2026-11-16T19:00:00Z' });
    const p = postFromFile(file, text, opts);
    expect(p.key).toBe('real-headline');
    expect(p.url).toBe('https://news.example/2026/11/17/blogs/technology/real-headline/'); // 00:30 the next day in Asia/Kolkata
    expect(postFromFile(file, text, { ...opts, timeZone: 'UTC' }).url).toContain('/2026/11/16/');
  });
  it('carries the fields the Worker uses and cleans the lists', () => {
    const p = postFromFile(file, doc('breaking: true\nfeatured: true\nfocusKeyword: "real headline"\nauthor: "shivam-das"\nimage: "/media/a.jpg"\ntags: ["one", "two"]\n'), opts);
    expect(p).toMatchObject({ breaking: true, featured: true, trending: false, focus: 'real headline', author: 'shivam-das', image: 'https://news.example/media/a.jpg', tags: ['one', 'two'], status: 'published' });
    expect(p.publishedAt).toBe('2026-11-16T11:30:00.000Z');
    expect(p.wordCount).toBeGreaterThan(3);
  });
  it('leaves out an image that is not https, and keeps an https one', () => {
    expect('image' in postFromFile(file, doc('image: "http://other.example/a.jpg"\n'), opts)).toBe(false);
    expect('image' in postFromFile(file, doc('image: "//other.example/a.jpg"\n'), opts)).toBe(false);
    expect(postFromFile(file, doc('image: "https://cdn.example/a.jpg"\n'), opts).image).toBe('https://cdn.example/a.jpg');
  });
  it('reads the editor push fields when they exist (part 7e) and ignores a wrong value', () => {
    const p = postFromFile(file, doc('push: "force"\npushTitle: "Short title"\npushBody: "Short body"\n'), opts);
    expect(p).toMatchObject({ push: 'force', pushTitle: 'Short title', pushBody: 'Short body' });
    expect('push' in postFromFile(file, doc('push: "maybe"\n'), opts)).toBe(false);
  });
  it('gives null for drafts, scheduled, archived, pages, other folders and broken dates', () => {
    for (const status of ['draft', 'scheduled', 'archived']) expect(postFromFile(file, doc('', { status }), opts)).toBeNull();
    expect(postFromFile('content/pages/about.md', doc(), opts)).toBeNull();
    expect(postFromFile('content/authors/a.json', '{}', opts)).toBeNull();
    expect(postFromFile(file, doc('', { date: 'not a date' }), opts)).toBeNull();
    expect(postFromFile(file, 'no front matter', opts)).toBeNull();
  });
});

describe('push announce script: which posts are sent', () => {
  const mk = (over: Record<string, unknown> = {}) => ({ key: 'k', title: 'Title', description: 'Description', robots: 'index,follow', publishedAt: '2026-11-16T11:30:00.000Z', ...over });
  it('sends a fresh post', () => {
    expect(skipReason(mk(), NOW)).toBeNull();
  });
  it('skips by the same rules as the Worker', () => {
    expect(skipReason(mk({ push: 'off' }), NOW)).toBe('push_off');
    expect(skipReason(mk({ robots: 'noindex,follow' }), NOW)).toBe('noindex');
    expect(skipReason(mk({ publishedAt: new Date(NOW + 10 * 60000).toISOString() }), NOW)).toBe('not_yet');
    expect(skipReason(mk({ publishedAt: new Date(NOW + 4 * 60000).toISOString() }), NOW)).toBeNull(); // a small clock difference is fine
    expect(skipReason(mk({ publishedAt: new Date(NOW - (MAX_AGE_MIN + 1) * 60000).toISOString() }), NOW)).toBe('too_old');
    expect(skipReason(mk({ publishedAt: new Date(NOW - MAX_AGE_MIN * 60000).toISOString() }), NOW)).toBeNull();
    expect(skipReason(mk({ publishedAt: 'bad' }), NOW)).toBe('bad_date');
  });
  it('skips an emoji in the title, description or the notification text', () => {
    const e = String.fromCodePoint(0x1f525);
    expect(skipReason(mk({ title: 'Hot ' + e }), NOW)).toBe('emoji');
    expect(skipReason(mk({ description: e }), NOW)).toBe('emoji');
    expect(skipReason(mk({ pushTitle: e }), NOW)).toBe('emoji');
    expect(skipReason(mk({ pushBody: e }), NOW)).toBe('emoji');
  });
  it('sorts newest first, drops a repeated key and says why for every post left out', () => {
    const a = mk({ key: 'a', publishedAt: '2026-11-16T10:30:00.000Z' });
    const b = mk({ key: 'b', publishedAt: '2026-11-16T11:45:00.000Z' });
    const old = mk({ key: 'old', publishedAt: '2026-11-15T00:00:00.000Z' });
    const r = selectRecent([a, b, old, { ...a }], NOW);
    expect(r.send.map((p: { key: string }) => p.key)).toEqual(['b', 'a']);
    expect(r.skipped).toEqual([{ key: 'old', reason: 'too_old' }, { key: 'a', reason: 'duplicate' }]);
  });
  it('sends at most as many posts as the Worker accepts and reports the rest', () => {
    const many = Array.from({ length: MAX_POSTS + 3 }, (_, i) => mk({ key: 'p' + i, publishedAt: new Date(NOW - i * 1000).toISOString() }));
    const r = selectRecent(many, NOW);
    expect(r.send).toHaveLength(MAX_POSTS);
    expect(r.skipped.filter((s: { reason: string }) => s.reason === 'too_many')).toHaveLength(3);
    expect(r.send[0].key).toBe('p0');
  });
});

describe('push announce script: same numbers as the Worker', () => {
  it('uses the age limit, the post limit, the clock slack and the header name of the Worker', () => {
    expect(MAX_AGE_MIN).toBe(120);
    expect(MAX_AGE_MIN).toBe(WORKER_MAX_AGE_MIN);
    expect(MAX_POSTS).toBe(ANNOUNCE_MAX_POSTS);
    expect(SLACK).toBe(FUTURE_SLACK_MS);
    expect(HEADER).toBe(SECRET_HEADER);
  });
});

describe('push announce script: settings and the answer of the Worker', () => {
  const env = { SITE_URL: 'https://news.example/', PUSH_ENDPOINT: 'https://push.example/', PUSH_ANNOUNCE_SECRET: 'x'.repeat(32) };
  it('is ready only with an https site, an https endpoint and a secret of 32 characters', () => {
    expect(readSettings(env)).toMatchObject({ ready: true, siteUrl: 'https://news.example', endpoint: 'https://push.example', missing: [] });
    expect(readSettings({}).missing).toEqual(['SITE_URL', 'PUSH_ENDPOINT', 'PUSH_ANNOUNCE_SECRET']);
    expect(readSettings({ ...env, PUSH_ANNOUNCE_SECRET: 'x'.repeat(31) }).missing).toEqual(['PUSH_ANNOUNCE_SECRET']);
    expect(readSettings({ ...env, PUSH_ENDPOINT: 'http://push.example' }).ready).toBe(false);
  });
  it('asks again only for pages that were not live yet', () => {
    const answer = { ok: true, results: [
      { key: 'a', status: 'accepted' },
      { key: 'b', status: 'skipped', reason: 'not_live' },
      { key: 'c', status: 'skipped', reason: 'check_failed' },
      { key: 'd', status: 'skipped', reason: 'too_old' },
      { key: 'e', status: 'skipped', reason: 'already_announced' },
    ] };
    expect(retryKeys(answer)).toEqual(['b', 'c']);
    expect(retryKeys(null)).toEqual([]);
    expect(retryKeys({ results: 'x' })).toEqual([]);
  });
  it('describes results with the key, the status and the reason word only', () => {
    const lines = describeResults({ results: [{ key: 'a', status: 'accepted' }, { key: 'b', status: 'skipped', reason: 'bad_post', field: 'title' }] });
    expect(lines).toEqual(['a: accepted', 'b: skipped (bad_post: title)']);
    expect(describeResults(null)).toEqual(['No results in the answer.']);
  });
});

describe('push announce script: the runner and the workflow', () => {
  const script = here('../../scripts/push-announce.mjs');
  const run = (args: string[], env: Record<string, string>, cwd: string) => spawnSync(process.execPath, [script, ...args], { cwd, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
  const makeSite = (posts: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'push-announce-'));
    mkdirSync(join(dir, 'config'), { recursive: true });
    mkdirSync(join(dir, 'content/blogs/technology'), { recursive: true });
    writeFileSync(join(dir, 'config/site.json'), JSON.stringify({ timeZone: 'UTC' }));
    posts.forEach((text, i) => writeFileSync(join(dir, `content/blogs/technology/p${i}.md`), text));
    return dir;
  };
  const fresh = (over: Record<string, string> = {}) => doc('', { date: new Date(Date.now() - 10 * 60000).toISOString(), ...over });

  it('does nothing and ends well when the settings are missing', () => {
    const r = run([], {}, makeSite([fresh()]));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('not set up');
    expect(r.stdout).toContain('PUSH_ANNOUNCE_SECRET');
  });
  it('a dry run lists the keys of the new posts and sends nothing', () => {
    const dir = makeSite([
      fresh(),
      fresh({ permalink: 'second-story', title: 'Second story headline' }),
      fresh({ permalink: 'a-draft', status: 'draft' }),
      doc('', { permalink: 'old-story', date: '2026-01-01T00:00:00Z' }),
    ]);
    const r = run(['--dry'], { SITE_URL: 'https://news.example' }, dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('To send: 2');
    expect(r.stdout).toContain('real-headline');
    expect(r.stdout).toContain('second-story');
    expect(r.stdout).not.toContain('a-draft');
    expect(r.stdout).not.toContain('old-story');
  });
  it('says plainly when no post is new enough', () => {
    const r = run(['--dry'], { SITE_URL: 'https://news.example' }, makeSite([doc('', { date: '2026-01-01T00:00:00Z' })]));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Nothing to announce');
  });
  it('the runner never prints the secret and does not retry a refusal', () => {
    const src = readFileSync(script, 'utf8');
    expect(/console\.\w+\([^;]*cfg\.secret/.test(src)).toBe(false);
    expect(src).toContain('process.exit(1); // 401');
    expect(src).toContain('res.status === 503');
  });
  it('the workflow uses the three secrets, reads only, waits after a push and installs nothing', () => {
    const yml = readFileSync(here('../../../.github/workflows/push.yml'), 'utf8');
    for (const s of ['SITE_URL', 'PUSH_ENDPOINT', 'PUSH_ANNOUNCE_SECRET']) expect(yml).toContain('secrets.' + s);
    expect(yml).toContain('contents: read');
    expect(yml).toContain("github.event_name == 'push'");
    expect(yml).toContain('cron:');
    expect(yml).not.toMatch(/npm (ci|install)/);
  });
  it('the new files hold no emoji and no icon symbols', () => {
    for (const f of ['../../scripts/push-announce-lib.mjs', '../../scripts/push-announce.mjs', '../../../.github/workflows/push.yml']) {
      expect(findIconGlyphs(readFileSync(here(f), 'utf8'))).toEqual([]);
    }
  });
});
