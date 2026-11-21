import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker file
import worker, { trapEnabled, ownIps, blockHours, configured, processHit, cleanup, resetState, MIN_ADD_GAP_MS, SEEN_WINDOW_MS } from '../../../workers/trap/index.js';
// @ts-ignore plain JS Worker file
import { listRequest, parseListPage, blockItem } from '../../../workers/trap/lib.js';

// v0.90.0 (BOT_PROTECTION Part 7b): the trap Worker, with a fake Cloudflare. No network.
const NOW = Date.parse('2026-11-16T10:00:00.000Z');
const ACC = 'a'.repeat(32);
const LST = '0123456789abcdef0123456789abcdef';
const TOKEN = 'SECRET-TOKEN-12345';
const ENV = { TRAP_ENABLED: 'true', CF_ACCOUNT_ID: ACC, CF_LIST_ID: LST, CF_API_TOKEN: TOKEN, OWN_IPS: '203.0.114.200' };
const BOT = { ip: '203.0.114.7', userAgent: 'python-requests/2.31' };

type Call = { url: string; method: string; body?: string; auth?: string };
/** A fake fetch. `pages` are the answers to the list calls in order; `post` and `del` give the status of the other calls. */
function fake(opts: { pages?: any[]; post?: number; del?: number; throws?: boolean } = {}) {
  const calls: Call[] = [];
  let page = 0;
  const fn = async (url: string, init: any) => {
    calls.push({ url, method: init.method, body: init.body, auth: init.headers && init.headers.Authorization });
    if (opts.throws) throw new Error('network down ' + TOKEN);
    if (init.method === 'GET') {
      const p = (opts.pages || [{ result: [] }])[page++] ?? { result: [] };
      return { ok: true, json: async () => ({ success: true, ...p }) };
    }
    const status = init.method === 'POST' ? (opts.post ?? 200) : (opts.del ?? 200);
    return { ok: status < 300, json: async () => ({ success: status < 300, result: {} }) };
  };
  return { fn, calls };
}
const reset = () => resetState();
const ours = (id: string, ip: string, untilMs: number) => ({ id, ip, comment: `sdn-trap until=${new Date(untilMs).toISOString()} seen=${new Date(NOW).toISOString()}` });

describe('the settings', () => {
  it('the kill switch is ON only for exactly true', () => {
    expect(trapEnabled({ TRAP_ENABLED: 'true' })).toBe(true);
    expect(trapEnabled({ TRAP_ENABLED: ' TRUE ' })).toBe(true);
    for (const v of [undefined, '', 'false', '1', 'yes', 'on', 'truee', null]) expect(trapEnabled({ TRAP_ENABLED: v as any }), String(v)).toBe(false);
    expect(trapEnabled({})).toBe(false);
  });
  it('reads the own addresses, the hours and the ids', () => {
    expect(ownIps({ OWN_IPS: ' 203.0.114.200 , bad, 2A00:1450:4001:081B:0000:0000:0000:200E ' })).toEqual(['203.0.114.200', '2a00:1450:4001:81b::200e']);
    expect(blockHours({})).toBe(24);
    expect(blockHours({ BLOCK_HOURS: '48' })).toBe(48);
    for (const v of ['0', '169', 'x', '1.5', '']) expect(blockHours({ BLOCK_HOURS: v }), v).toBe(24);
    expect(configured(ENV)).toBe(true);
    expect(configured({ ...ENV, CF_ACCOUNT_ID: 'short' })).toBe(false);
    expect(configured({ ...ENV, CF_LIST_ID: '' })).toBe(false);
    expect(configured({ ...ENV, CF_API_TOKEN: '' })).toBe(false);
    expect(configured({})).toBe(false);
  });
});

describe('the list calls in the rules file', () => {
  it('builds the read call and its cursor', () => {
    expect(listRequest(ACC, LST)).toEqual({ method: 'GET', url: `https://api.cloudflare.com/client/v4/accounts/${ACC}/rules/lists/${LST}/items?per_page=500` });
    expect(listRequest(ACC, LST, 'abc_DEF-12=').url).toContain('&cursor=abc_DEF-12%3D');
    expect(() => listRequest(ACC, LST, 'bad cursor!')).toThrow();
    expect(() => listRequest('x', LST)).toThrow();
  });
  it('reads one page and survives a broken answer', () => {
    expect(parseListPage({ result: [{ id: 'a1', ip: '1.2.3.4', comment: 'c' }, { id: '' }, null, { ip: '5.6.7.8' }], result_info: { cursors: { after: 'next' } } })).toEqual({ items: [{ id: 'a1', ip: '1.2.3.4', comment: 'c' }], next: 'next' });
    for (const bad of [null, undefined, {}, { result: 'x' }, 'text']) expect(parseListPage(bad as any)).toEqual({ items: [], next: null });
  });
});

describe('one trap hit', () => {
  it('lists, then adds one item with the secret, and nothing else', async () => {
    reset();
    const f = fake();
    const r = await processHit(BOT, ENV, { fetch: f.fn, now: NOW });
    expect(r).toEqual({ action: 'block', reason: 'blocked' });
    expect(f.calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(f.calls.every((c) => c.auth === 'Bearer ' + TOKEN)).toBe(true);
    expect(f.calls.every((c) => c.url.startsWith('https://api.cloudflare.com/client/v4/accounts/' + ACC + '/rules/lists/' + LST + '/items'))).toBe(true);
    const sent = JSON.parse(f.calls[1].body as string);
    expect(sent).toEqual([blockItem('203.0.114.7', NOW, 24)]);
  });

  it('never calls Cloudflare for an own, reserved, bad or good-bot client', async () => {
    reset();
    const f = fake();
    expect((await processHit({ ip: '203.0.114.200', userAgent: 'x' }, ENV, { fetch: f.fn, now: NOW })).reason).toBe('own-address');
    expect((await processHit({ ip: '10.0.0.5', userAgent: 'x' }, ENV, { fetch: f.fn, now: NOW })).reason).toBe('reserved-address');
    expect((await processHit({ ip: 'nope', userAgent: 'x' }, ENV, { fetch: f.fn, now: NOW })).reason).toBe('bad-address');
    expect((await processHit({ ip: '203.0.114.9', userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, ENV, { fetch: f.fn, now: NOW })).action).toBe('record');
    expect(f.calls).toHaveLength(0);
  });

  it('does nothing when the ids or the secret are missing', async () => {
    reset();
    const f = fake();
    const r = await processHit(BOT, { ...ENV, CF_API_TOKEN: '' }, { fetch: f.fn, now: NOW });
    expect(r).toEqual({ action: 'skip', reason: 'not-configured' });
    expect(f.calls).toHaveLength(0);
  });

  it('does not add an address that is already in the list', async () => {
    reset();
    const f = fake({ pages: [{ result: [{ id: 'i1', ip: '203.0.114.7', comment: '' }] }] });
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW })).reason).toBe('already-listed');
    expect(f.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('stops at our own limit of 1000 items, and the owner entries do not count', async () => {
    reset();
    const full = Array.from({ length: 1000 }, (_, i) => ours('id' + String(i).padStart(8, '0'), '9.9.' + (i >> 8) + '.' + (i & 255), NOW + 3600000));
    const f = fake({ pages: [{ result: full }] });
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW })).reason).toBe('list-full');
    expect(f.calls.map((c) => c.method)).toEqual(['GET']);
    reset();
    const owner = Array.from({ length: 1000 }, (_, i) => ({ id: 'owner' + String(i).padStart(6, '0'), ip: '8.8.' + (i >> 8) + '.' + (i & 255), comment: 'mine' }));
    const g = fake({ pages: [{ result: owner }] });
    expect((await processHit(BOT, ENV, { fetch: g.fn, now: NOW })).reason).toBe('blocked');
  });

  it('reads the next page with the cursor', async () => {
    reset();
    const f = fake({ pages: [{ result: [], result_info: { cursors: { after: 'p2' } } }, { result: [{ id: 'i1', ip: '203.0.114.7', comment: '' }] }] });
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW })).reason).toBe('already-listed');
    expect(f.calls[1].url).toContain('cursor=p2');
  });

  it('does not add when the list cannot be read completely', async () => {
    reset();
    const endless = Array.from({ length: 10 }, () => ({ result: [], result_info: { cursors: { after: 'more' } } }));
    const f = fake({ pages: endless });
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW })).reason).toBe('list-failed');
    expect(f.calls.filter((c) => c.method === 'GET')).toHaveLength(5);
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('reports a failed add and a failed network without throwing or leaking the secret', async () => {
    reset();
    expect((await processHit(BOT, ENV, { fetch: fake({ post: 500 }).fn, now: NOW })).reason).toBe('add-failed');
    reset();
    const logs: string[] = [];
    const orig = [console.log, console.warn, console.error];
    console.log = console.warn = console.error = (...a: any[]) => { logs.push(a.join(' ')); };
    let r: any;
    try { r = await processHit(BOT, ENV, { fetch: fake({ throws: true }).fn, now: NOW }); } finally { [console.log, console.warn, console.error] = orig; }
    expect(r.reason).toBe('list-failed');
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('spaces the add calls and skips the same address for 10 minutes', async () => {
    reset();
    const f = fake();
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW })).reason).toBe('blocked');
    expect((await processHit({ ip: '203.0.114.8', userAgent: 'x' }, ENV, { fetch: f.fn, now: NOW + 1000 })).reason).toBe('throttled');
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW + MIN_ADD_GAP_MS + 1 })).reason).toBe('seen-recently');
    expect((await processHit({ ip: '203.0.114.8', userAgent: 'x' }, ENV, { fetch: f.fn, now: NOW + MIN_ADD_GAP_MS + 1 })).reason).toBe('blocked');
    expect((await processHit(BOT, ENV, { fetch: f.fn, now: NOW + SEEN_WINDOW_MS + MIN_ADD_GAP_MS * 3 })).reason).toBe('blocked');
  });
});

describe('the clean-up', () => {
  it('deletes only our own expired items', async () => {
    const items = [
      ours('expired000001', '1.1.1.1', NOW - 1000),
      ours('stillgood0001', '2.2.2.2', NOW + 3600000),
      { id: 'ownerentry001', ip: '3.3.3.3', comment: 'my office' },
      { id: 'brokendate001', ip: '4.4.4.4', comment: 'sdn-trap until=soon' },
      { id: 'nocomment0001', ip: '5.5.5.5', comment: '' },
    ];
    const f = fake({ pages: [{ result: items }] });
    expect(await cleanup(ENV, { fetch: f.fn, now: NOW })).toEqual({ deleted: 1, reason: 'done' });
    const del = f.calls.filter((c) => c.method === 'DELETE');
    expect(del).toHaveLength(1);
    expect(JSON.parse(del[0].body as string)).toEqual({ items: [{ id: 'expired000001' }] });
  });

  it('runs even when the kill switch is off, and sends nothing when nothing is expired', async () => {
    const f = fake({ pages: [{ result: [ours('stillgood0001', '2.2.2.2', NOW + 1000)] }] });
    expect(await cleanup({ ...ENV, TRAP_ENABLED: 'false' }, { fetch: f.fn, now: NOW })).toEqual({ deleted: 0, reason: 'done' });
    expect(f.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('deletes in calls of 100, one after the other, at most 5 calls', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ours('exp' + String(i).padStart(8, '0'), '7.7.' + (i >> 8) + '.' + (i & 255), NOW - 1));
    const f = fake({ pages: [{ result: many }] });
    expect(await cleanup(ENV, { fetch: f.fn, now: NOW })).toEqual({ deleted: 250, reason: 'done' });
    expect(f.calls.filter((c) => c.method === 'DELETE').map((c) => JSON.parse(c.body as string).items.length)).toEqual([100, 100, 50]);
    const huge = Array.from({ length: 700 }, (_, i) => ours('exp' + String(i).padStart(8, '0'), '6.6.' + (i >> 8) + '.' + (i & 255), NOW - 1));
    const g = fake({ pages: [{ result: huge }] });
    expect((await cleanup(ENV, { fetch: g.fn, now: NOW })).deleted).toBe(500);
  });

  it('stops at the first failed delete, and does nothing without settings or without the list', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ours('exp' + String(i).padStart(8, '0'), '7.7.' + (i >> 8) + '.' + (i & 255), NOW - 1));
    const f = fake({ pages: [{ result: many }], del: 500 });
    expect(await cleanup(ENV, { fetch: f.fn, now: NOW })).toEqual({ deleted: 0, reason: 'delete-failed' });
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    expect((await cleanup({}, { fetch: fake().fn, now: NOW })).reason).toBe('not-configured');
    expect((await cleanup(ENV, { fetch: fake({ throws: true }).fn, now: NOW })).reason).toBe('list-failed');
  });
});

describe('the Worker answers', () => {
  const req = (path: string, method = 'GET', ip = '203.0.114.7') => new Request('https://example.com' + path, { method, headers: { 'CF-Connecting-IP': ip, 'User-Agent': 'curl/8' } });
  const ctx = () => { const jobs: Promise<any>[] = []; return { jobs, waitUntil: (p: Promise<any>) => { jobs.push(p); } }; };

  it('gives the same plain 404 with noindex whatever happens', async () => {
    reset();
    const a = await worker.fetch(req('/trap/'), { ...ENV, TRAP_ENABLED: 'false' }, ctx());
    const b = await worker.fetch(req('/other/'), ENV, ctx());
    const c = await worker.fetch(req('/trap/', 'HEAD'), { ...ENV, TRAP_ENABLED: 'false' }, ctx());
    for (const r of [a, b, c]) {
      expect(r.status).toBe(404);
      expect(r.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(r.headers.get('Cache-Control')).toContain('no-store');
    }
    expect(await a.text()).toBe('Not found');
    expect(await b.text()).toBe('Not found');
    expect(await c.text()).toBe('');
  });

  it('does no work when the switch is off or the path is not /trap/', async () => {
    reset();
    const f = fake();
    const orig = globalThis.fetch;
    (globalThis as any).fetch = f.fn;
    try {
      const c1 = ctx(); await worker.fetch(req('/trap/'), { ...ENV, TRAP_ENABLED: 'false' }, c1);
      const c2 = ctx(); await worker.fetch(req('/trap/x'), ENV, c2);
      const c3 = ctx(); await worker.fetch(req('/trap/', 'POST'), ENV, c3);
      expect(c1.jobs.length + c2.jobs.length + c3.jobs.length).toBe(0);
      expect(f.calls).toHaveLength(0);
    } finally { (globalThis as any).fetch = orig; }
  });

  it('blocks in the background when the switch is on, and answers the same 404', async () => {
    reset();
    const f = fake();
    const orig = globalThis.fetch;
    (globalThis as any).fetch = f.fn;
    const log = console.log; console.log = () => {};
    try {
      const c = ctx();
      const res = await worker.fetch(req('/trap/'), ENV, c);
      await Promise.all(c.jobs);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not found');
      expect(c.jobs).toHaveLength(1);
      expect(f.calls.map((x) => x.method)).toEqual(['GET', 'POST']);
    } finally { (globalThis as any).fetch = orig; console.log = log; }
  });

  it('has a scheduled clean-up that never throws', async () => {
    const c = ctx();
    const log = console.log; console.log = () => {};
    try { await worker.scheduled({}, {}, c); await Promise.all(c.jobs); } finally { console.log = log; }
    expect(c.jobs).toHaveLength(1);
  });
});

describe('the files', () => {
  const toml = readFileSync(new URL('../../../workers/trap/wrangler.toml', import.meta.url), 'utf8');
  const code = readFileSync(new URL('../../../workers/trap/index.js', import.meta.url), 'utf8');
  const live = toml.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

  it('has the kill switch set to true or false, no route and no secret; the ids are empty or 32 letters or numbers', () => {
    // v0.101.36: the owner switched the trap on, so "true" is allowed; it still blocks nobody without the ids, a route and a WAF rule.
    expect(live).toMatch(/^TRAP_ENABLED = "(true|false)"/m);
    expect(live).not.toMatch(/^\s*routes?\s*=/m);
    expect(live).not.toMatch(/CF_API_TOKEN\s*=/);
    expect(live).toMatch(/^CF_ACCOUNT_ID = "([0-9a-f]{32})?"/m);
    expect(live).toMatch(/^CF_LIST_ID = "([0-9a-f]{32})?"/m);
  });
  it('keeps the secret and the address out of every log line', () => {
    const lines = code.split('\n').filter((l) => /console\./.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) { expect(l).not.toMatch(/TOKEN|\.ip|userAgent|CF-Connecting-IP/); }
  });
  it('talks only to api.cloudflare.com (through the rules file)', () => {
    expect(code).not.toMatch(/https?:\/\//);
  });
});
