import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import * as U from '../../../workers/push/audience.js';
// @ts-ignore plain JS Worker code
import { keywordIndexTerms, cleanKeyword, MAX_FAILURES } from '../../../workers/push/lib.js';

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
  title: 'A new phone is launched today',
  description: 'The company showed its new phone at an event in the capital this morning.',
  category: 'tech',
  tags: ['phones', 'launch'],
  focus: 'new phone',
  author: 'shivam-das',
  breaking: false,
  ...o,
});

function d1(db: any, o: { fail?: boolean } = {}) {
  return {
    prepare(sql: string) {
      return {
        values: [] as any[],
        bind(...v: any[]) { this.values = v; return this; },
        async all() {
          if (o.fail) throw new Error('db down');
          if (this.values.length > 100) throw new Error('too many values for D1');
          return { results: db.prepare(sql).all(...this.values) };
        },
      };
    },
  };
}
const freshDb = () => { const db = new Sqlite(':memory:'); db.exec(SCHEMA); return db; };

/** Adds one reader and the rows of push_terms the Worker would write for the given choices. */
function addSub(db: any, o: any = {}) {
  const r = db.prepare(
    `INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, status, failures, paused_until, breaking_all, created, last_seen)
     VALUES (?, ?, 'k', 'a', 't', ?, ?, ?, ?, ?, ?)`,
  ).run(`https://push.test/${Math.random()}`, `h${Math.random()}`, o.status ?? 'active', o.failures ?? 0, o.paused_until ?? null, o.breaking_all ?? 0, NOW, NOW);
  const id = Number(r.lastInsertRowid);
  const add = (kind: string, term: string) => db.prepare('INSERT OR IGNORE INTO push_terms (sub_id, kind, term) VALUES (?, ?, ?)').run(id, kind, term);
  for (const c of o.cats ?? []) add('cat', c);
  for (const a of o.authors ?? []) add('author', a);
  for (const text of o.kws ?? []) {
    const k = cleanKeyword(text);
    add('kw', k.keyword);
    for (const t of keywordIndexTerms(k.keyword)) add('kwtok', t);
    add('kwtext', text);
  }
  for (const m of o.mutes ?? []) add('mute', cleanKeyword(m).keyword);
  return id;
}

describe('audienceKeys', () => {
  it('takes the category, the author and the stemmed words of the post', () => {
    const k = U.audienceKeys(post());
    expect(k.category).toBe('tech');
    expect(k.author).toBe('shivam-das');
    expect(k.breaking).toBe(false);
    expect(k.tokens).toContain('phon'); // "phones" and "phone" give one stem
    expect(k.tokens).toContain('launch');
    expect(new Set(k.tokens).size).toBe(k.tokens.length);
  });
  it('is safe with a missing or strange post', () => {
    for (const p of [null, undefined, {}, 5]) {
      const k = U.audienceKeys(p as any);
      expect(k).toEqual({ category: '', author: '', tokens: [], breaking: false });
    }
  });
  it('only a real true makes a post breaking', () => {
    expect(U.audienceKeys(post({ breaking: 'yes' })).breaking).toBe(false);
    expect(U.audienceKeys(post({ breaking: true })).breaking).toBe(true);
  });
  it('cuts a very long word list', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}x`);
    expect(U.audienceKeys(post({ description: words.join(' ') })).tokens.length).toBe(U.MAX_POST_TOKENS);
  });
});

describe('candidateQueries', () => {
  it('makes one query for each door that the post has', () => {
    const doors = (p: any) => U.candidateQueries(p, NOW).map((q: any) => q.door);
    expect(doors(post())).toEqual(['cat', 'author', 'kw']);
    expect(doors(post({ breaking: true }))).toEqual(['cat', 'author', 'kw', 'breaking']);
    expect(doors(post({ category: '', author: '' }))).toEqual(['kw']);
    expect(doors({ title: '', breaking: true })).toEqual(['breaking']);
    expect(doors({})).toEqual([]);
  });
  it('numbers its marks to match its values and stays under 100 values', () => {
    const many = Array.from({ length: 300 }, (_, i) => `term${i}`).join(' ');
    const qs = U.candidateQueries(post({ description: many, tags: [] }), NOW);
    for (const q of qs) {
      expect((q.sql.match(/\?/g) || []).length, q.door).toBe(q.values.length);
      expect(q.values.length).toBeLessThan(100);
    }
  });
  it('splits a long word list in chunks of TOKEN_CHUNK', () => {
    const many = Array.from({ length: 150 }, (_, i) => `term${i}x`.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])).join(' ');
    const kw = U.candidateQueries(post({ title: many, description: '', tags: [], focus: '', category: '', author: '' }), NOW).filter((q: any) => q.door === 'kw');
    expect(kw.length).toBeGreaterThan(1);
    const total = kw.reduce((n: number, q: any) => n + q.values.length - 1, 0);
    expect(total).toBe(U.audienceKeys(post({ title: many, description: '', tags: [], focus: '' })).tokens.length);
  });
  it('every query keeps only readers who can receive', () => {
    for (const q of U.candidateQueries(post({ breaking: true }), NOW)) {
      expect(q.sql).toContain("s.status = 'active'");
      expect(q.sql).toContain(`s.failures < ${MAX_FAILURES}`);
      expect(q.sql).toContain('s.paused_until');
      expect(q.values[q.values.length - 1]).toBe(NOW);
    }
  });
  it('never reads the push endpoint or the keys', () => {
    expect(U.SUB_COLUMNS).not.toMatch(/endpoint|p256dh|auth\b|token/);
    expect(U.loadSubsSql(2)).not.toMatch(/endpoint|p256dh|token_hash/);
    expect(U.loadSubsSql(3)).toContain('IN (?,?,?)');
  });
});

withDb('findCandidates', () => {
  it('finds a reader through the category, the keyword, the author and breaking news', async () => {
    const db = freshDb();
    const byCat = addSub(db, { cats: ['tech'] });
    const byKw = addSub(db, { kws: ['phones'] });
    const byAuthor = addSub(db, { authors: ['shivam-das'] });
    const byBreaking = addSub(db, { breaking_all: 1 });
    addSub(db, { cats: ['sports'], kws: ['cricket'], authors: ['someone-else'] }); // nothing in common
    const r = await U.findCandidates(d1(db), post({ breaking: true }), NOW);
    expect(r.ids).toEqual([byCat, byKw, byAuthor, byBreaking]);
    expect(r.via[byCat]).toEqual(['cat']);
    expect(r.via[byKw]).toEqual(['kw']);
    expect(r.via[byAuthor]).toEqual(['author']);
    expect(r.via[byBreaking]).toEqual(['breaking']);
    expect(r.counts).toEqual({ cat: 1, kw: 1, author: 1, breaking: 1 });
    expect(r.truncated).toBe(false);
  });
  it('a reader found through two doors is one candidate with both doors', async () => {
    const db = freshDb();
    const id = addSub(db, { cats: ['tech'], kws: ['new phone'], breaking_all: 1 });
    const r = await U.findCandidates(d1(db), post({ breaking: true }), NOW);
    expect(r.ids).toEqual([id]);
    expect(r.via[id]).toEqual(['cat', 'kw', 'breaking']);
    expect(r.counts).toEqual({ cat: 1, kw: 1, author: 0, breaking: 1 });
  });
  it('a reader with two matching words of one keyword is counted once', async () => {
    const db = freshDb();
    const id = addSub(db, { kws: ['new phone launch'] });
    const r = await U.findCandidates(d1(db), post(), NOW);
    expect(r.ids).toEqual([id]);
    expect(r.counts.kw).toBe(1);
  });
  it('the keyword index matches a plural, an ending and a capital letter', async () => {
    const db = freshDb();
    const id = addSub(db, { kws: ['Launched'] });
    const r = await U.findCandidates(d1(db), post({ tags: [], focus: '' }), NOW);
    expect(r.ids).toEqual([id]); // "launched" and "launch" share a stem
  });
  it('breaking_all readers are found only for breaking posts', async () => {
    const db = freshDb();
    addSub(db, { breaking_all: 1 });
    expect((await U.findCandidates(d1(db), post({ category: '', author: '', title: 'Quiet', description: '', tags: [], focus: '' }), NOW)).ids).toEqual([]);
    expect((await U.findCandidates(d1(db), post({ breaking: true, category: '', author: '', title: 'Quiet', description: '', tags: [], focus: '' }), NOW)).ids.length).toBe(1);
  });
  it('removes readers who are not active, failed 5 times or are paused', async () => {
    const db = freshDb();
    const ok = addSub(db, { cats: ['tech'] });
    addSub(db, { cats: ['tech'], status: 'paused' });
    addSub(db, { cats: ['tech'], status: 'gone' });
    addSub(db, { cats: ['tech'], failures: MAX_FAILURES });
    addSub(db, { cats: ['tech'], paused_until: NOW + 60000 });
    const expired = addSub(db, { cats: ['tech'], paused_until: NOW - 1 }); // the pause is over
    const edge = addSub(db, { cats: ['tech'], failures: MAX_FAILURES - 1 });
    addSub(db, { kws: ['phones'], paused_until: NOW + 60000 });
    addSub(db, { authors: ['shivam-das'], status: 'gone' });
    addSub(db, { breaking_all: 1, failures: 9 });
    const r = await U.findCandidates(d1(db), post({ breaking: true }), NOW);
    expect(r.ids).toEqual([ok, expired, edge]);
  });
  it('a muted word alone is not a door (mute is applied by the scoring part)', async () => {
    const db = freshDb();
    addSub(db, { mutes: ['phone'] });
    expect((await U.findCandidates(d1(db), post(), NOW)).ids).toEqual([]);
  });
  it('a category and a keyword are different doors: a word is not a category and a category is not a word', async () => {
    const db = freshDb();
    addSub(db, { cats: ['phon'] }); // a category written like a word of the post
    addSub(db, { kws: ['tech'] }); // a keyword written like the category of the post
    const r = await U.findCandidates(d1(db), post({ title: 'Phone news', description: '', tags: [], focus: '', category: 'tech', author: '' }), NOW);
    expect(r.ids).toEqual([]);
  });
  it('finds nothing when the post has nothing to look for', async () => {
    const db = freshDb();
    addSub(db, { cats: ['tech'], breaking_all: 1 });
    const r = await U.findCandidates(d1(db), {}, NOW);
    expect(r).toEqual({ ids: [], via: {}, truncated: false, counts: { cat: 0, kw: 0, author: 0, breaking: 0 } });
  });
  it('works with a very long post (many chunks) and stays under the value limit', async () => {
    const db = freshDb();
    const id = addSub(db, { kws: ['zebra'] });
    const filler = Array.from({ length: 400 }, (_, i) => `aa${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`).join(' ');
    const r = await U.findCandidates(d1(db), post({ title: 'Zebra news', description: filler, tags: [], focus: '', category: '', author: '' }), NOW);
    expect(r.ids).toEqual([id]);
  });
  it('cuts a huge list at MAX_CANDIDATES and says so', async () => {
    const db = freshDb();
    db.exec('BEGIN');
    const ins = db.prepare("INSERT INTO push_subs (endpoint, endpoint_hash, p256dh, auth, token_hash, created, last_seen) VALUES (?, ?, 'k', 'a', 't', 1, 1)");
    const term = db.prepare("INSERT INTO push_terms (sub_id, kind, term) VALUES (?, 'cat', 'tech')");
    for (let i = 0; i < U.MAX_CANDIDATES + 20; i++) term.run(Number(ins.run(`e${i}`, `h${i}`).lastInsertRowid));
    db.exec('COMMIT');
    const r = await U.findCandidates(d1(db), post({ title: '', description: '', tags: [], focus: '', author: '' }), NOW);
    expect(r.truncated).toBe(true);
    expect(r.ids.length).toBe(U.MAX_CANDIDATES);
    expect(Object.keys(r.via).length).toBe(U.MAX_CANDIDATES);
  });
  it('a database error goes up: no half list (when unsure, do not send)', async () => {
    const db = freshDb();
    addSub(db, { cats: ['tech'] });
    await expect(U.findCandidates(d1(db, { fail: true }), post(), NOW)).rejects.toThrow('db down');
  });
  it('uses the indexes, not a scan of every reader', () => {
    const db = freshDb();
    for (const q of U.candidateQueries(post({ breaking: true }), NOW)) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...q.values).map((r: any) => r.detail).join(' | ');
      if (q.door === 'breaking') expect(plan, q.door).toMatch(/push_subs_breaking/);
      else expect(plan, q.door).toMatch(/push_terms_lookup|sqlite_autoindex_push_terms/);
      expect(plan, q.door).not.toMatch(/SCAN s\b|SCAN push_subs/);
    }
  });
});

withDb('loadCandidates', () => {
  it('loads the rows of the ids, in order, without any secret column', async () => {
    const db = freshDb();
    const a = addSub(db, { cats: ['tech'] });
    addSub(db, { cats: ['sports'] });
    const c = addSub(db, { cats: ['tech'] });
    const rows = await U.loadCandidates(d1(db), [c, a]);
    expect(rows.map((r: any) => r.id)).toEqual([a, c]);
    for (const r of rows) {
      for (const secret of ['endpoint', 'endpoint_hash', 'p256dh', 'auth', 'token_hash']) expect(Object.keys(r), secret).not.toContain(secret);
      expect(r).toMatchObject({ status: 'active', level: 'balanced', daily_limit: 4, failures: 0 });
    }
  });
  it('loads in chunks and handles an empty list', async () => {
    const db = freshDb();
    const ids = Array.from({ length: U.LOAD_CHUNK * 2 + 5 }, () => addSub(db, {}));
    expect((await U.loadCandidates(d1(db), ids)).length).toBe(ids.length);
    expect(await U.loadCandidates(d1(db), [])).toEqual([]);
  });
});
