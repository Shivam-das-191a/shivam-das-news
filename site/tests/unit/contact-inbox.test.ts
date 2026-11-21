import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker
import worker from '../../../workers/contact/index.js';
// @ts-ignore plain JS Worker code
import { inboxPlan, listValues, inboxPage, inboxCounts, statusChange, allowedUsers, LIST_SQL, COUNTS_SQL, UPDATE_SQL, STATUSES, INBOX_DEFAULT, INBOX_MAX } from '../../../workers/contact/lib.js';

const SITE = 'https://news.test';
const q = (s: string) => new URLSearchParams(s);

const row = (id: number, status = 'new') => ({ id, ts: 1700000000 + id, name: 'Asha Roy', email: 'asha@example.org', subject: id % 2 ? 'Hello' : null, message: 'A message number ' + id, status });

function fakeDb(o: { rows?: any[]; counts?: any[]; changes?: number; failList?: boolean; failUpdate?: boolean } = {}) {
  const lists: any[][] = [];
  const updates: any[][] = [];
  return {
    lists,
    updates,
    prepare: (sql: string) => ({
      bind: (...values: any[]) => ({
        all: async () => {
          if (o.failList) throw new Error('db down');
          if (sql === LIST_SQL) { lists.push(values); return { results: o.rows ?? [] }; }
          return { results: o.counts ?? [] };
        },
        run: async () => {
          if (o.failUpdate) throw new Error('db down');
          updates.push(values);
          return { success: true, meta: { changes: o.changes ?? 1 } };
        },
      }),
      all: async () => {
        if (o.failList) throw new Error('db down');
        return { results: o.counts ?? [] };
      },
    }),
  };
}

function fakeGithub(login: string | null, calls: string[] = []) {
  return async (url: string, init: any) => {
    calls.push(String(init?.headers?.Authorization));
    if (login === null) return { ok: false, status: 401, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ login }) };
  };
}

let tokenNo = 0;
const freshToken = () => 'ghp_token' + String(++tokenNo).padStart(12, '0'); // a new token each time, the Worker remembers tokens for 60 seconds
const mkEnv = (extra: any = {}) => ({ SITE_ORIGIN: SITE, ALLOWED_USERS: 'Shivam-Das', DB: fakeDb(), ...extra });

function call(path: string, o: { method?: string; token?: string | null; origin?: string | null; body?: any; gh?: any } = {}, env: any = mkEnv()) {
  const headers: Record<string, string> = {};
  if (o.origin !== null) headers.Origin = o.origin ?? SITE;
  if (o.token !== null) headers.Authorization = 'Bearer ' + (o.token ?? freshToken());
  const init: any = { method: o.method ?? 'GET', headers };
  if (o.body !== undefined) init.body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
  return worker.fetch(new Request('https://contact.test' + path, init), env, undefined, o.gh ?? fakeGithub('shivam-das'));
}

describe('inboxPlan', () => {
  it('has safe defaults', () => {
    expect(inboxPlan(q(''))).toEqual({ status: 'all', limit: INBOX_DEFAULT, before: 0 });
    expect(INBOX_DEFAULT).toBe(50);
    expect(INBOX_MAX).toBe(100);
  });
  it('accepts each status, a limit from 1 to 100 and a before id', () => {
    for (const s of STATUSES) expect(inboxPlan(q('status=' + s))?.status).toBe(s);
    expect(inboxPlan(q('status=all&limit=1&before=12'))).toEqual({ status: 'all', limit: 1, before: 12 });
    expect(inboxPlan(q('limit=100'))?.limit).toBe(100);
  });
  it('refuses anything else', () => {
    for (const bad of ['status=spam', 'status=', "status=new'--", 'limit=0', 'limit=101', 'limit=-1', 'limit=abc', 'limit=1.5', 'limit=', 'before=-3', 'before=x', 'before=', 'before=1e5']) expect(inboxPlan(q(bad))).toBeNull();
    expect(inboxPlan(null as any)).toEqual({ status: 'all', limit: 50, before: 0 });
  });
  it('gives the SQL values in the order the question marks need, with one extra row', () => {
    expect(listValues({ status: 'new', limit: 50, before: 9 })).toEqual(['new', 'new', 9, 9, 51]);
    expect((LIST_SQL.match(/\?/g) || []).length).toBe(5);
    expect((UPDATE_SQL.match(/\?/g) || []).length).toBe(2);
  });
});

describe('inboxPage and inboxCounts', () => {
  it('cuts the extra row and gives the id for the next older page', () => {
    const r = inboxPage([row(5), row(4), row(3)], 2);
    expect(r.messages.map((m: any) => m.id)).toEqual([5, 4]);
    expect(r.next).toBe(4);
  });
  it('has no next page when the rows fit, and no rows is fine', () => {
    expect(inboxPage([row(2), row(1)], 2).next).toBeNull();
    expect(inboxPage([], 50)).toEqual({ messages: [], next: null });
    expect(inboxPage(undefined as any, 50)).toEqual({ messages: [], next: null });
  });
  it('turns an empty subject into an empty text and an unknown status into new', () => {
    const m = inboxPage([{ ...row(1), subject: null, status: 'weird' }], 5).messages[0];
    expect(m.subject).toBe('');
    expect(m.status).toBe('new');
  });
  it('counts always give all three keys as whole numbers', () => {
    expect(inboxCounts([])).toEqual({ new: 0, read: 0, done: 0 });
    expect(inboxCounts([{ status: 'new', n: 3 }, { status: 'done', n: '2' }, { status: 'junk', n: 9 }, { status: 'read', n: -4 }])).toEqual({ new: 3, read: 0, done: 2 });
    expect(inboxCounts(null as any)).toEqual({ new: 0, read: 0, done: 0 });
  });
});

describe('statusChange and allowedUsers', () => {
  it('accepts a whole id and a known status', () => {
    expect(statusChange('{"id":7,"status":"read"}')).toEqual({ id: 7, status: 'read' });
    expect(statusChange('{"id":7,"status":"done","extra":1}')).toEqual({ id: 7, status: 'done' });
  });
  it('refuses everything else', () => {
    for (const bad of ['', 'nope', '[]', 'null', '{"id":0,"status":"new"}', '{"id":-1,"status":"new"}', '{"id":1.5,"status":"new"}', '{"id":"7","status":"new"}', '{"id":7,"status":"deleted"}', '{"id":7}', '{"status":"new"}', '{"id":1e300,"status":"new"}']) expect(statusChange(bad)).toBeNull();
  });
  it('reads the allowed list in lower case and ignores empty parts', () => {
    expect(allowedUsers(' Shivam-Das , ,Editor2 ')).toEqual(['shivam-das', 'editor2']);
    expect(allowedUsers('')).toEqual([]);
    expect(allowedUsers(undefined)).toEqual([]);
  });
});

describe('GET /messages', () => {
  it('gives the page, the counts and the CORS header for the site only', async () => {
    const db = fakeDb({ rows: [row(3), row(2), row(1)], counts: [{ status: 'new', n: 2 }, { status: 'done', n: 1 }] });
    const res = await call('/messages?limit=2', {}, mkEnv({ DB: db }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const j = await res.json();
    expect(j.messages.map((m: any) => m.id)).toEqual([3, 2]);
    expect(j.next).toBe(2);
    expect(j.counts).toEqual({ new: 2, read: 0, done: 1 });
    expect(db.lists[0]).toEqual(['all', 'all', 0, 0, 3]);
  });
  it('passes the status and the before id to the database', async () => {
    const db = fakeDb();
    await call('/messages?status=new&before=40', {}, mkEnv({ DB: db }));
    expect(db.lists[0]).toEqual(['new', 'new', 40, 40, 51]);
  });
  it('asks GitHub with the token and accepts the login in any letter case', async () => {
    const calls: string[] = [];
    const token = freshToken();
    const res = await call('/messages', { token, gh: fakeGithub('SHIVAM-das', calls) });
    expect(res.status).toBe(200);
    expect(calls).toEqual(['Bearer ' + token]);
  });
  it('remembers a good token for a short time (one GitHub call for two reads)', async () => {
    const calls: string[] = [];
    const token = freshToken();
    await call('/messages', { token, gh: fakeGithub('shivam-das', calls) });
    await call('/messages', { token, gh: fakeGithub('shivam-das', calls) });
    expect(calls.length).toBe(1);
  });
  it('answers 401 without a token, with a bad header, or when GitHub says no', async () => {
    expect((await call('/messages', { token: null })).status).toBe(401);
    expect((await worker.fetch(new Request('https://contact.test/messages', { headers: { Origin: SITE, Authorization: 'Basic abc' } }), mkEnv(), undefined, fakeGithub('shivam-das'))).status).toBe(401);
    expect((await call('/messages', { gh: fakeGithub(null) })).status).toBe(401);
    expect((await call('/messages', { gh: async () => { throw new Error('network'); } })).status).toBe(401);
  });
  it('answers 403 for a GitHub user who is not on the list', async () => {
    const res = await call('/messages', { gh: fakeGithub('someone-else') });
    expect(res.status).toBe(403);
  });
  it('answers 503 and never reads when the list or the database is missing', async () => {
    const db = fakeDb({ rows: [row(1)] });
    expect((await call('/messages', {}, mkEnv({ ALLOWED_USERS: '', DB: db }))).status).toBe(503);
    expect((await call('/messages', {}, mkEnv({ ALLOWED_USERS: undefined, DB: db }))).status).toBe(503);
    expect((await call('/messages', {}, mkEnv({ DB: undefined }))).status).toBe(503);
    expect(db.lists.length).toBe(0);
  });
  it('answers 400 for a bad query and 500 when the database fails, without leaking the reason', async () => {
    expect((await call('/messages?status=spam')).status).toBe(400);
    const res = await call('/messages', {}, mkEnv({ DB: fakeDb({ failList: true }) }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/db down/);
  });
  it('answers the preflight for the site only, and refuses other methods', async () => {
    const ok = await call('/messages', { method: 'OPTIONS', token: null });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(ok.headers.get('Access-Control-Allow-Methods')).toBe('GET');
    const other = await call('/messages', { method: 'OPTIONS', token: null, origin: 'https://evil.test' });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const post = await call('/messages', { method: 'POST', body: '{}' });
    expect(post.status).toBe(405);
  });
  it('gives no CORS header to another origin, so a page of another site cannot read the answer', async () => {
    const res = await call('/messages', { origin: 'https://evil.test' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('POST /messages/status', () => {
  it('sets the status of one message', async () => {
    const db = fakeDb();
    const res = await call('/messages/status', { method: 'POST', body: { id: 12, status: 'read' } }, mkEnv({ DB: db }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 12, status: 'read' });
    expect(db.updates).toEqual([['read', 12]]);
  });
  it('answers 404 when no row changed', async () => {
    const res = await call('/messages/status', { method: 'POST', body: { id: 99, status: 'done' } }, mkEnv({ DB: fakeDb({ changes: 0 }) }));
    expect(res.status).toBe(404);
  });
  it('needs the same sign-in as the list and writes nothing without it', async () => {
    const db = fakeDb();
    const env = mkEnv({ DB: db });
    expect((await call('/messages/status', { method: 'POST', token: null, body: { id: 1, status: 'read' } }, env)).status).toBe(401);
    expect((await call('/messages/status', { method: 'POST', body: { id: 1, status: 'read' }, gh: fakeGithub('someone-else') }, env)).status).toBe(403);
    expect((await call('/messages/status', { method: 'POST', body: { id: 1, status: 'read' } }, mkEnv({ DB: db, ALLOWED_USERS: '' }))).status).toBe(503);
    expect(db.updates.length).toBe(0);
  });
  it('refuses a bad body, a big body, and other methods', async () => {
    const db = fakeDb();
    const env = mkEnv({ DB: db });
    for (const body of ['nope', { id: 'x', status: 'read' }, { id: 1, status: 'deleted' }]) expect((await call('/messages/status', { method: 'POST', body }, env)).status).toBe(400);
    expect((await call('/messages/status', { method: 'POST', body: 'x'.repeat(500) }, env)).status).toBe(413);
    expect((await call('/messages/status', { method: 'GET' }, env)).status).toBe(405);
    expect(db.updates.length).toBe(0);
  });
  it('answers 500 when the database fails', async () => {
    const res = await call('/messages/status', { method: 'POST', body: { id: 1, status: 'read' } }, mkEnv({ DB: fakeDb({ failUpdate: true }) }));
    expect(res.status).toBe(500);
  });
});

describe('the public form endpoint and the files', () => {
  const read = (f: string) => readFileSync(new URL('../../../workers/contact/' + f, import.meta.url), 'utf8');
  it('/contact still answers as before and unknown paths give 404', async () => {
    expect((await worker.fetch(new Request('https://contact.test/nothing'), mkEnv())).status).toBe(404);
    expect((await worker.fetch(new Request('https://contact.test/messages/other', { headers: { Origin: SITE } }), mkEnv())).status).toBe(404);
    expect((await worker.fetch(new Request('https://contact.test/contact', { method: 'GET', headers: { Origin: SITE } }), mkEnv())).status).toBe(405);
  });
  it('the list SQL never reads an IP and the code has no delete', () => {
    const code = (read('index.js') + read('lib.js')).replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/DELETE\s+FROM/i);
    expect(LIST_SQL + COUNTS_SQL + UPDATE_SQL).not.toMatch(/\bip\b/i);
  });
  it('wrangler.toml has an empty ALLOWED_USERS and no secret value', () => {
    const t = readFileSync('tests/fixtures/shipped/workers/contact/wrangler.toml', 'utf8');
    expect(t).toMatch(/^ALLOWED_USERS = ""/m);
    expect(t).not.toMatch(/TURNSTILE_SECRET\s*=\s*"/);
  });
});
