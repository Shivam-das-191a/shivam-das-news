import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker
import worker from '../../../workers/push/index.js';
// @ts-ignore plain JS Worker code
import * as A from '../../../workers/push/announce.js';
// @ts-ignore plain JS Worker code
import { MAX_AGE_MIN, IMPORT_GUARD, IMPORT_KEEP } from '../../../workers/push/lib.js';

const SITE = 'https://news.test';
const SECRET = 's'.repeat(40);
const NOW = Date.parse('2026-11-16T10:00:00Z');
const SCHEMA = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
let Sqlite: any = null;
try {
  Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync;
} catch {
  Sqlite = null;
}
const withDb = Sqlite ? describe : describe.skip;

const post = (o: any = {}) => ({
  key: 'phone-launch',
  url: `${SITE}/2026/11/16/blogs/tech/phone-launch/`,
  title: 'A new phone is launched today',
  description: 'The company showed its new phone at an event in the capital this morning.',
  category: 'tech',
  tags: ['phones', 'launch'],
  focus: 'new phone',
  author: 'shivam-das',
  publishedAt: new Date(NOW - 10 * 60000).toISOString(),
  ...o,
});

describe('cleanPost', () => {
  it('accepts a normal post and fills the defaults', () => {
    const r = A.cleanPost({ key: 'a-b', url: `${SITE}/x/`, title: ' Title ', publishedAt: NOW });
    expect(r.ok).toBe(true);
    expect(r.post).toMatchObject({ key: 'a-b', title: 'Title', description: '', category: '', tags: [], focus: '', author: '', breaking: false, featured: false, trending: false, sponsored: false, push: 'auto', pushTitle: '', pushBody: '', image: null, imageWidth: 0, wordCount: 0, publishedAt: NOW });
  });
  it('reads the publish time as milliseconds or as an ISO text', () => {
    expect(A.cleanPost(post({ publishedAt: NOW })).post.publishedAt).toBe(NOW);
    expect(A.cleanPost(post({ publishedAt: '2026-11-16T10:00:00Z' })).post.publishedAt).toBe(NOW);
  });
  it('names the field that is wrong', () => {
    const cases: [string, any][] = [
      ['key', { key: 'Bad Key' }], ['key', { key: '' }], ['key', { key: 'a'.repeat(121) }], ['key', { key: 5 }],
      ['url', { url: '' }], ['url', { url: 'u'.repeat(1001) }],
      ['title', { title: '' }], ['title', { title: '   ' }], ['title', { title: 't'.repeat(201) }],
      ['description', { description: 'd'.repeat(401) }], ['description', { description: 5 }],
      ['category', { category: 'Tech News' }], ['tags', { tags: 'a' }], ['tags', { tags: Array(21).fill('a') }], ['tags', { tags: [''] }], ['tags', { tags: [5] }],
      ['focus', { focus: 'f'.repeat(81) }], ['author', { author: 'Shivam Das' }],
      ['breaking', { breaking: 'yes' }], ['featured', { featured: 1 }], ['trending', { trending: 'no' }], ['sponsored', { sponsored: 'x' }],
      ['push', { push: 'maybe' }], ['pushTitle', { pushTitle: 'x'.repeat(71) }], ['pushBody', { pushBody: 'x'.repeat(121) }],
      ['image', { image: 5 }], ['imageWidth', { imageWidth: 0 }], ['imageWidth', { imageWidth: 1.5 }], ['wordCount', { wordCount: -1 }],
      ['robots', { robots: 'r'.repeat(101) }], ['status', { status: 5 }],
      ['publishedAt', { publishedAt: 'yesterday' }], ['publishedAt', { publishedAt: undefined }], ['publishedAt', { publishedAt: 0 }],
    ];
    for (const [field, o] of cases) {
      const r = A.cleanPost(post(o));
      expect(r.ok, JSON.stringify(o)).toBe(false);
      expect(r.reason).toBe('bad_post');
      expect(r.field, JSON.stringify(o)).toBe(field);
    }
  });
  it('refuses something that is not a post', () => {
    for (const v of [null, undefined, 5, 'x', [], true]) expect(A.cleanPost(v)).toEqual({ ok: false, reason: 'bad_post', field: 'post' });
  });
});

describe('onSite', () => {
  it('accepts https addresses of the site only', () => {
    expect(A.onSite(`${SITE}/a/`, SITE)).toBe(true);
    expect(A.onSite(`${SITE}/a/`, `${SITE}/`)).toBe(true);
    for (const u of ['http://news.test/a/', 'https://other.test/a/', 'https://news.test.evil.com/a/', 'https://user:pw@news.test/a/', 'https://news.test:8443/a/', 'javascript:alert(1)', 'not a url', '']) expect(A.onSite(u, SITE), u).toBe(false);
    expect(A.onSite(`${SITE}/a/`, 'not a url')).toBe(false);
  });
});

describe('checkPost (PLAN 31.5)', () => {
  const ok = (o: any = {}) => A.checkPost(A.cleanPost(post(o)).post, NOW, SITE);
  it('lets a fresh normal post go on', () => {
    expect(ok()).toBeNull();
    expect(ok({ breaking: true, featured: true, push: 'force' })).toBeNull();
  });
  it('push off, sponsored, not published, noindex', () => {
    expect(ok({ push: 'off' })).toBe('push_off');
    expect(ok({ sponsored: true })).toBe('sponsored');
    for (const status of ['draft', 'scheduled', 'archived']) expect(ok({ status })).toBe('not_published');
    expect(ok({ status: 'published' })).toBeNull();
    expect(ok({ robots: 'noindex,follow' })).toBe('noindex');
    expect(ok({ robots: 'NOINDEX' })).toBe('noindex');
    expect(ok({ robots: 'index,follow' })).toBeNull();
  });
  it('force never skips these rules', () => {
    expect(ok({ push: 'force', sponsored: true })).toBe('sponsored');
    expect(ok({ push: 'force', robots: 'noindex' })).toBe('noindex');
    expect(ok({ push: 'force', status: 'draft' })).toBe('not_published');
    expect(ok({ push: 'force', publishedAt: NOW - (MAX_AGE_MIN + 1) * 60000 })).toBe('too_old');
    expect(ok({ push: 'force', title: 'Big news \u{1F525}' })).toBe('emoji');
  });
  it('the age: up to 2 hours is fine, older is too old, a little in the future is fine, more is not yet live', () => {
    expect(ok({ publishedAt: NOW - MAX_AGE_MIN * 60000 })).toBeNull();
    expect(ok({ publishedAt: NOW - MAX_AGE_MIN * 60000 - 1 })).toBe('too_old');
    expect(ok({ publishedAt: NOW + A.FUTURE_SLACK_MS })).toBeNull();
    expect(ok({ publishedAt: NOW + A.FUTURE_SLACK_MS + 1 })).toBe('not_yet');
  });
  it('an old post that is re-saved or imported is too old', () => {
    expect(ok({ publishedAt: '2020-01-01T00:00:00Z' })).toBe('too_old');
  });
  it('the address must be https and on this site', () => {
    expect(ok({ url: 'http://news.test/a/' })).toBe('bad_url');
    expect(ok({ url: 'https://evil.test/a/' })).toBe('bad_url');
  });
  it('no emoji in the title, the description or the editor text (PLAN 29.3)', () => {
    expect(ok({ title: 'Launch \u{1F680}' })).toBe('emoji');
    expect(ok({ description: 'Big day \u{1F389}' })).toBe('emoji');
    expect(ok({ pushTitle: 'Now \u2764\uFE0F' })).toBe('emoji');
    expect(ok({ pushBody: 'Go \u{1F1EE}\u{1F1F3}' })).toBe('emoji');
    expect(ok({ title: 'Brand\u2122 and copyright \u00A9' })).toBeNull(); // plain signs are allowed
  });
});

describe('importGuard', () => {
  const p = (key: string, o: any = {}) => A.cleanPost(post({ key, ...o })).post;
  it('leaves up to 3 posts alone', () => {
    expect(IMPORT_GUARD).toBe(3);
    expect(A.importGuard([p('a'), p('b'), p('c')]).size).toBe(0);
    expect(A.importGuard([]).size).toBe(0);
  });
  it('keeps the 2 most important of 4 or more and drops the rest', () => {
    expect(IMPORT_KEEP).toBe(2);
    const d = A.importGuard([p('a'), p('b', { trending: true }), p('c', { breaking: true }), p('d', { featured: true })]);
    expect([...d].sort()).toEqual(['a', 'b']); // breaking 25 and featured 12 stay; trending 10 and plain 0 go
  });
  it('never drops a post with push force', () => {
    const d = A.importGuard([p('a'), p('b'), p('c', { push: 'force' }), p('d', { push: 'force' }), p('e', { breaking: true }), p('f', { featured: true })]);
    expect([...d].sort()).toEqual(['a', 'b']); // force c and d, plus the 2 best of the rest (breaking e, featured f)
  });
  it('ties go to the newer post, then to the key', () => {
    const t = NOW - 60000;
    const d = A.importGuard([p('a', { publishedAt: t - 3000 }), p('b', { publishedAt: t - 1000 }), p('c', { publishedAt: t - 2000 }), p('d', { publishedAt: t })]);
    expect([...d].sort()).toEqual(['a', 'c']); // d and b are the newest
    const same = A.importGuard([p('d'), p('c'), p('b'), p('a')]);
    expect([...same].sort()).toEqual(['c', 'd']); // same time, same importance: a and b go first by key
  });
});

describe('decide', () => {
  it('answers every post in the same order, with only reason words', () => {
    const { results, record } = A.decide([post(), { key: 'oops' }, post({ key: 'old-one', publishedAt: '2020-01-01T00:00:00Z' }), post({ key: 'quiet', push: 'off' })], new Set(), NOW, SITE);
    expect(results).toEqual([
      { key: 'phone-launch', status: 'accepted' },
      { key: 'oops', status: 'skipped', reason: 'bad_post', field: 'url' },
      { key: 'old-one', status: 'skipped', reason: 'too_old' },
      { key: 'quiet', status: 'skipped', reason: 'push_off' },
    ]);
    expect(record.map((r: any) => r.key)).toEqual(['phone-launch']);
  });
  it('a bad post without a usable key has key null', () => {
    expect(A.decide([{ nothing: 1 }, null], new Set(), NOW, SITE).results).toEqual([
      { key: null, status: 'skipped', reason: 'bad_post', field: 'key' }, // an object with no key
      { key: null, status: 'skipped', reason: 'bad_post', field: 'post' }, // not an object at all
    ]);
  });
  it('the same key twice in one call: the first counts, the second is a duplicate', () => {
    const { results } = A.decide([post(), post()], new Set(), NOW, SITE);
    expect(results.map((r: any) => r.reason ?? r.status)).toEqual(['accepted', 'duplicate']);
  });
  it('a key that was announced before is skipped and does not count for the import guard', () => {
    const posts = [post({ key: 'a' }), post({ key: 'b' }), post({ key: 'c' }), post({ key: 'd' })];
    const { results } = A.decide(posts, new Set(['d']), NOW, SITE);
    expect(results.map((r: any) => r.reason ?? r.status)).toEqual(['accepted', 'accepted', 'accepted', 'already_announced']); // 3 new posts: the guard stays off
  });
  it('the import guard skips the extra posts of a big deploy', () => {
    const posts = ['a', 'b', 'c', 'd', 'e'].map((key, i) => post({ key, breaking: i === 4, featured: i === 3 }));
    const { results, record } = A.decide(posts, new Set(), NOW, SITE);
    expect(results.filter((r: any) => r.status === 'accepted').map((r: any) => r.key)).toEqual(['d', 'e']);
    expect(results.filter((r: any) => r.reason === 'import_guard').map((r: any) => r.key)).toEqual(['a', 'b', 'c']);
    expect(record.length).toBe(2);
  });
  it('every reason it gives is in the list of reasons', () => {
    const all = A.decide(
      [post({ key: 'a' }), { key: 'b' }, post({ key: 'a' }), post({ key: 'c', push: 'off' }), post({ key: 'd', sponsored: true }), post({ key: 'e', status: 'draft' }), post({ key: 'f', robots: 'noindex' }),
        post({ key: 'g', publishedAt: NOW + 3600000 }), post({ key: 'h', publishedAt: 1 }), post({ key: 'i', title: 'x \u{1F525}' }), post({ key: 'j', url: 'http://x.test/' }), post({ key: 'k' })],
      new Set(['k']), NOW, SITE).results;
    for (const r of all) if (r.reason) expect(A.REASONS).toContain(r.reason);
    expect(new Set(all.map((r: any) => r.reason)).size).toBeGreaterThanOrEqual(10);
  });
});

describe('the secret', () => {
  it('matches only the same long secret', async () => {
    expect(await A.secretMatches(SECRET, SECRET)).toBe(true);
    expect(await A.secretMatches(SECRET + 'x', SECRET)).toBe(false);
    expect(await A.secretMatches('', SECRET)).toBe(false);
    expect(await A.secretMatches(null, SECRET)).toBe(false);
    expect(await A.secretMatches('short', 'short')).toBe(false); // a short secret is never a match
    expect(await A.secretMatches(SECRET, undefined)).toBe(false);
  });
});

describe('the rows', () => {
  it('flagsOf keeps what later parts need, and only what is set', () => {
    const c = A.cleanPost(post({ breaking: true, push: 'force', pushTitle: 'T', pushBody: 'B', imageWidth: 1600, wordCount: 420 })).post;
    expect(A.flagsOf(c)).toEqual({ breaking: true, featured: false, trending: false, push: 'force', pushTitle: 'T', pushBody: 'B', imageWidth: 1600, wordCount: 420 });
    expect(A.flagsOf(A.cleanPost(post()).post)).toEqual({ breaking: false, featured: false, trending: false, push: 'auto' });
  });
  it('insertValues has one value for each column of the SQL', () => {
    const v = A.insertValues(A.cleanPost(post()).post, NOW);
    expect(v.length).toBe((A.INSERT_POST_SQL.match(/\?/g) || []).length);
    expect(v[v.length - 1]).toBe(NOW);
  });
  it('the SQL numbers its marks', () => {
    expect(A.existingKeysSql(3)).toBe('SELECT key FROM push_posts WHERE key IN (?,?,?)');
  });
});

// ---------------------------------------------------------------- the Worker

function d1(db: any, o: { failSelect?: boolean; failBatch?: boolean; hideKnown?: boolean } = {}) {
  const mk = (sql: string) => ({
    values: [] as any[],
    bind(...v: any[]) { this.values = v; return this; },
    async first() { return db.prepare(sql).get(...this.values) ?? null; },
    async all() {
      if (o.failSelect) throw new Error('db down');
      if (o.hideKnown && /FROM push_posts/.test(sql)) return { results: [] }; // simulates another call writing the row a moment later
      return { results: db.prepare(sql).all(...this.values) };
    },
    async run() { const r = db.prepare(sql).run(...this.values); return { success: true, meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: mk,
    async batch(statements: any[]) {
      if (o.failBatch) throw new Error('db down');
      db.exec('BEGIN');
      try { const out = []; for (const s of statements) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const freshDb = () => { const db = new Sqlite(':memory:'); db.exec(SCHEMA); return db; };
const send = (body: any, o: { secret?: string | null; method?: string; origin?: string; db?: any; env?: any; raw?: string; fetch?: any } = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.secret !== null) headers['X-Announce-Secret'] = o.secret ?? SECRET;
  if (o.origin) headers.Origin = o.origin;
  const init: any = { method: o.method ?? 'POST', headers };
  if ((o.method ?? 'POST') === 'POST') init.body = o.raw ?? JSON.stringify(body);
  return worker.fetch(new Request('https://push.test/announce', init), { SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: o.db ? d1(o.db) : undefined, ...o.env }, undefined, o.fetch ?? livePage);
};
// v0.65.0: the Worker now opens each post's page (live check, part 6b). These tests hand it a fake page that is live, so no real network is used.
const livePage = async () => new Response('<!doctype html><html><head><title>x</title></head><body></body></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const rows = (db: any) => db.prepare('SELECT * FROM push_posts ORDER BY id').all();

afterEach(() => vi.useRealTimers());
function at() { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); }

withDb('POST /announce', () => {
  it('records a good post with every column, and answers with the key and a status only', async () => {
    at(); const db = freshDb();
    const res = await send({ posts: [post({ breaking: true, pushTitle: 'Short title', imageWidth: 1600, image: `${SITE}/m/a.jpg`, wordCount: 300 })] }, { db });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const out = await res.json();
    expect(out).toEqual({ ok: true, accepted: 1, skipped: 0, results: [{ key: 'phone-launch', status: 'accepted' }] });
    const r = rows(db);
    expect(r.length).toBe(1);
    expect(r[0]).toMatchObject({ key: 'phone-launch', url: post().url, title: 'A new phone is launched today', category: 'tech', focus: 'new phone', author: 'shivam-das', image: `${SITE}/m/a.jpg`, published_at: NOW - 10 * 60000, announced_at: NOW });
    expect(JSON.parse(r[0].tags)).toEqual(['phones', 'launch']);
    expect(JSON.parse(r[0].flags)).toEqual({ breaking: true, featured: false, trending: false, push: 'auto', pushTitle: 'Short title', imageWidth: 1600, wordCount: 300 });
  });
  it('the same post again is already_announced and nothing is added', async () => {
    at(); const db = freshDb();
    await send({ posts: [post()] }, { db });
    const out = await (await send({ posts: [post()] }, { db })).json();
    expect(out).toEqual({ ok: true, accepted: 0, skipped: 1, results: [{ key: 'phone-launch', status: 'skipped', reason: 'already_announced' }] });
    expect(rows(db).length).toBe(1);
  });
  it('a row written by another call a moment earlier is a duplicate, not accepted twice', async () => {
    at(); const db = freshDb();
    await send({ posts: [post()] }, { db });
    const res = await worker.fetch(new Request('https://push.test/announce', { method: 'POST', headers: { 'X-Announce-Secret': SECRET }, body: JSON.stringify({ posts: [post()] }) }), { SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: d1(db, { hideKnown: true }) }, undefined, livePage);
    const out = await res.json();
    expect(out.accepted).toBe(0);
    expect(out.results[0]).toEqual({ key: 'phone-launch', status: 'skipped', reason: 'already_announced' });
    expect(rows(db).length).toBe(1);
  });
  it('a mixed call: each post gets its own answer and only the good ones are recorded', async () => {
    at(); const db = freshDb();
    const out = await (await send({ posts: [post({ key: 'good-one' }), post({ key: 'old-one', publishedAt: NOW - 5 * 3600000 }), { key: 'broken' }, post({ key: 'muted', push: 'off' })] }, { db })).json();
    expect(out.accepted).toBe(1);
    expect(out.skipped).toBe(3);
    expect(out.results.map((r: any) => r.reason ?? r.status)).toEqual(['accepted', 'too_old', 'bad_post', 'push_off']);
    expect(rows(db).map((r: any) => r.key)).toEqual(['good-one']);
  });
  it('an import of many posts records only the best 2 (and every force)', async () => {
    at(); const db = freshDb();
    const posts = Array.from({ length: 8 }, (_, i) => post({ key: `story-${i}`, featured: i === 6, breaking: i === 7 }));
    const out = await (await send({ posts }, { db })).json();
    expect(out.accepted).toBe(2);
    expect(rows(db).map((r: any) => r.key).sort()).toEqual(['story-6', 'story-7']);
    const forced = await (await send({ posts: ['x1', 'x2', 'x3', 'x4', 'x5'].map((key) => post({ key, push: key === 'x1' ? 'force' : 'auto' })) }, { db })).json();
    expect(forced.results.filter((r: any) => r.status === 'accepted').map((r: any) => r.key)).toContain('x1');
  });
  it('the answer never holds a title, a description or an address', async () => {
    at(); const db = freshDb();
    const res = await send({ posts: [post(), post({ key: 'bad-url', url: 'http://evil.test/secret-path' }), post({ key: 'emoji-one', title: 'Secret headline \u{1F525}' })] }, { db });
    const text = await res.text();
    expect(text).not.toMatch(/phone is launched|secret-path|Secret headline|news\.test|evil\.test/);
  });
  it('touches only push_posts', async () => {
    at(); const db = freshDb();
    await send({ posts: [post()] }, { db });
    for (const t of ['push_subs', 'push_terms', 'push_queue', 'push_held', 'push_sent', 'push_audit']) expect(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, t).toBe(0);
  });
  it('is off (503) without the secret setting, with a short one, or without the database', async () => {
    const db = freshDb();
    for (const env of [{ ANNOUNCE_SECRET: undefined }, { ANNOUNCE_SECRET: 'short' }, { ANNOUNCE_SECRET: '' }, { SITE_ORIGIN: undefined }]) {
      const res = await send({ posts: [post()] }, { db, env });
      expect(res.status, JSON.stringify(env)).toBe(503);
      expect((await res.json()).error).toBe('Announcing is not switched on yet.');
    }
    expect((await send({ posts: [post()] })).status).toBe(503);
    expect(rows(db).length).toBe(0);
  });
  it('answers 401 for a missing or wrong secret and records nothing', async () => {
    const db = freshDb();
    for (const secret of [null, '', 'wrong', SECRET + 'x', SECRET.slice(1)]) {
      const res = await send({ posts: [post()] }, { db, secret });
      expect(res.status, String(secret)).toBe(401);
      expect(await res.json()).toEqual({ error: 'Not allowed.' });
    }
    expect(rows(db).length).toBe(0);
  });
  it('a browser origin does not help: no CORS header, and the secret is still needed', async () => {
    at(); const db = freshDb();
    const withSecret = await send({ posts: [post()] }, { db, origin: SITE });
    expect(withSecret.status).toBe(200);
    expect(withSecret.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await send({ posts: [post()] }, { db, origin: SITE, secret: null })).status).toBe(401);
    expect((await send({ posts: [post()] }, { db, origin: 'https://evil.test', secret: null })).status).toBe(401);
  });
  it('answers 405 for another method', async () => {
    const res = await send({}, { method: 'GET', db: freshDb() });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect((await send({}, { method: 'OPTIONS', db: freshDb() })).status).toBe(405);
  });
  it('answers 400 for a body that is not a list of posts, 413 for too many or too large', async () => {
    const db = freshDb();
    for (const raw of ['not json', '[]', '{}', '{"posts":[]}', '{"posts":"x"}', '"text"', 'null']) expect((await send(null, { db, raw })).status, raw).toBe(400);
    const many = await send({ posts: Array.from({ length: A.ANNOUNCE_MAX_POSTS + 1 }, (_, i) => post({ key: `k-${i}` })) }, { db });
    expect(many.status).toBe(413);
    const big = await send({ posts: [post({ description: 'x' })], pad: 'p'.repeat(A.ANNOUNCE_MAX_BODY) }, { db });
    expect(big.status).toBe(413);
    expect(rows(db).length).toBe(0);
  });
  it('a database failure answers 500 and records nothing', async () => {
    at(); const db = freshDb();
    for (const o of [{ failSelect: true }, { failBatch: true }]) {
      const res = await worker.fetch(new Request('https://push.test/announce', { method: 'POST', headers: { 'X-Announce-Secret': SECRET }, body: JSON.stringify({ posts: [post()] }) }), { SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: d1(db, o) }, undefined, livePage);
      expect(res.status, JSON.stringify(o)).toBe(500);
      expect(JSON.stringify(await res.json())).not.toMatch(/db down/);
    }
    expect(rows(db).length).toBe(0);
  });
  it('the other routes work as before', async () => {
    const db = freshDb();
    const r = await worker.fetch(new Request('https://push.test/subscribe', { method: 'POST', headers: { 'X-Announce-Secret': SECRET }, body: '{}' }), { SITE_ORIGIN: SITE, ANNOUNCE_SECRET: SECRET, DB: d1(db) });
    expect(r.status).toBe(403); // the secret opens /announce only
    expect((await worker.fetch(new Request('https://push.test/other', { method: 'POST' }), { SITE_ORIGIN: SITE, DB: d1(db) })).status).toBe(404);
  });
});

withDb('POST /announce, the live check (v0.65.0, part 6b)', () => {
  const page = (head = '') => `<!doctype html><html><head><title>x</title>${head}</head><body></body></html>`;
  const answer = (status: number, text = page(), headers: Record<string, string> = {}) => new Response(text, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } });
  /** A fake fetch that records every address it is asked for. `by` maps a part of the address to an answer or a function. */
  const spy = (by: Record<string, any> = {}) => {
    const seen: { url: string; init: any }[] = [];
    const f = async (url: string, init: any) => {
      seen.push({ url, init });
      const hit = Object.keys(by).find((k) => url.includes(k));
      const v = hit ? by[hit] : answer(200);
      return typeof v === 'function' ? v() : v.clone();
    };
    return { f, seen };
  };
  const reasons = (out: any) => out.results.map((r: any) => r.reason ?? r.status);

  it('opens the address of a good post once, without following redirects, and records it', async () => {
    at(); const db = freshDb(); const { f, seen } = spy();
    const out = await (await send({ posts: [post()] }, { db, fetch: f })).json();
    expect(out).toMatchObject({ ok: true, accepted: 1, skipped: 0 });
    expect(seen.length).toBe(1);
    expect(seen[0].url).toBe(post().url);
    expect(seen[0].init.redirect).toBe('manual');
    expect(rows(db).length).toBe(1);
  });
  it('a page that answers 404 is not_live and is NOT recorded; the same post is accepted when the page is live later', async () => {
    at(); const db = freshDb();
    const first = await (await send({ posts: [post()] }, { db, fetch: spy({ 'phone-launch': answer(404) }).f })).json();
    expect(reasons(first)).toEqual(['not_live']);
    expect(rows(db).length).toBe(0);
    const second = await (await send({ posts: [post()] }, { db, fetch: spy().f })).json();
    expect(reasons(second)).toEqual(['accepted']);
    expect(rows(db).length).toBe(1);
  });
  it('410, 500 and a redirect are not_live', async () => {
    at(); const db = freshDb();
    for (const [status, extra] of [[410, {}], [500, {}], [301, { Location: `${SITE}/new/` }]] as const) {
      const out = await (await send({ posts: [post()] }, { db, fetch: spy({ 'phone-launch': answer(status, '', extra as any) }).f })).json();
      expect(reasons(out), String(status)).toEqual(['not_live']);
    }
    expect(rows(db).length).toBe(0);
  });
  it('noindex in the header or in the page is skipped as noindex and is not recorded', async () => {
    at(); const db = freshDb();
    const a = await (await send({ posts: [post()] }, { db, fetch: spy({ 'phone-launch': answer(200, page(), { 'X-Robots-Tag': 'noindex' }) }).f })).json();
    const b = await (await send({ posts: [post()] }, { db, fetch: spy({ 'phone-launch': answer(200, page('<meta name="robots" content="noindex,follow">')) }).f })).json();
    expect(reasons(a)).toEqual(['noindex']);
    expect(reasons(b)).toEqual(['noindex']);
    expect(rows(db).length).toBe(0);
  });
  it('a network error or a timeout is check_failed: the call still answers 200 and nothing is recorded', async () => {
    at(); const db = freshDb();
    const res = await send({ posts: [post()] }, { db, fetch: async () => { throw new TypeError('network down'); } });
    expect(res.status).toBe(200);
    expect(reasons(await res.json())).toEqual(['check_failed']);
    expect(rows(db).length).toBe(0);
  });
  it('posts that are refused by the other checks, or already announced, are never opened', async () => {
    at(); const db = freshDb();
    await send({ posts: [post({ key: 'old-one' })] }, { db });
    const { f, seen } = spy();
    const out = await (await send({ posts: [
      post({ key: 'old-one' }), // already announced
      post({ key: 'off-one', push: 'off' }),
      post({ key: 'sponsored-one', sponsored: true }),
      post({ key: 'emoji-one', title: 'Hot news \u{1F525}' }),
      post({ key: 'foreign-one', url: 'https://evil.test/a/' }),
      post({ key: 'late-one', publishedAt: new Date(NOW - 3 * 3600000).toISOString() }),
      post({ key: 'good-one' }),
    ] }, { db, fetch: f })).json();
    expect(reasons(out)).toEqual(['already_announced', 'push_off', 'sponsored', 'emoji', 'bad_url', 'too_old', 'accepted']);
    expect(seen.map((s) => s.url)).toEqual([post({ key: 'good-one' }).url]);
  });
  it('a failed live check comes before the import guard', async () => {
    at(); const db = freshDb();
    const mk = (key: string, o: any = {}) => post({ key, url: `${SITE}/${key}/`, ...o });
    const out = await (await send({ posts: [mk('b-one', { breaking: true }), mk('b-two', { breaking: true }), mk('n-one'), mk('n-two')] }, { db, fetch: spy({ 'b-one': answer(404), 'b-two': answer(404) }).f })).json();
    expect(reasons(out)).toEqual(['not_live', 'not_live', 'accepted', 'accepted']);
    expect(rows(db).map((r: any) => r.key).sort()).toEqual(['n-one', 'n-two']);
  });
  it('one bad page does not stop the others', async () => {
    at(); const db = freshDb();
    const mk = (key: string) => post({ key, url: `${SITE}/${key}/` });
    const out = await (await send({ posts: [mk('s-one'), mk('s-two'), mk('s-three')] }, { db, fetch: spy({ 's-two': () => { throw new Error('boom'); } }).f })).json();
    expect(reasons(out)).toEqual(['accepted', 'check_failed', 'accepted']);
    expect(out).toMatchObject({ accepted: 2, skipped: 1 });
  });
  it('the answer holds keys, a status and a reason word only, never page text or an address', async () => {
    at(); const db = freshDb();
    const text = await (await send({ posts: [post()] }, { db, fetch: spy({ 'phone-launch': answer(404, 'Secret page body') }).f })).text();
    expect(text).not.toMatch(/Secret page body|news\.test|phone is launched/);
  });
  it('the live check does not run when the secret is wrong or the Worker is not set up', async () => {
    const { f, seen } = spy();
    expect((await send({ posts: [post()] }, { db: freshDb(), secret: 'x'.repeat(40), fetch: f })).status).toBe(401);
    expect((await send({ posts: [post()] }, { db: freshDb(), env: { ANNOUNCE_SECRET: undefined }, fetch: f })).status).toBe(503);
    expect(seen.length).toBe(0);
  });
});

describe('the files', () => {
  const toml = readFileSync(new URL('../../../workers/push/wrangler.toml', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../../../workers/push/announce.js', import.meta.url), 'utf8');
  it('the secret is never written in wrangler.toml, only explained', () => {
    expect(toml).toContain('ANNOUNCE_SECRET');
    expect(toml).not.toMatch(/^\s*ANNOUNCE_SECRET\s*=/m);
  });
  it('announce.js does no network call, reads no clock and prints nothing', () => {
    expect(code).not.toMatch(/\bfetch\s*\(|Date\.now|console\./);
  });
});
