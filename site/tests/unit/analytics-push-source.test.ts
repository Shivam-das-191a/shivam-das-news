import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker code
import { PUSH_SOURCE, cleanBeacon, eventValues, referrerHost, sourceName, groupSources, groupUnverified } from '../../../workers/analytics/lib.js';
// @ts-ignore plain JS Worker
import worker from '../../../workers/analytics/index.js';
// @ts-ignore plain JS Worker code
import { issueStamp } from '../../../workers/shared/guard.js';

const SITE = 'https://news.test';
const SECRET = 'stamp-secret-for-the-analytics-tests-0123456789';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const msg = { sid: 'abcd1234efgh', pv: 'pv-0001-xyz', path: '/2026/11/13/blogs/world/a-story/', tz: 'Asia/Kolkata', ref: 'https://www.google.com/', read: 42, scroll: 80 };
const ctx = { userAgent: CHROME, country: 'IN', siteHost: 'news.test', now: 1_800_000_000_000 };

describe('the source "Push notification" (v0.97.0, part 7e-3): the Worker rules', () => {
  it('the reserved value is (push) and its name is Push notification', () => {
    expect(PUSH_SOURCE).toBe('(push)');
    expect(sourceName(PUSH_SOURCE)).toBe('Push notification');
  });
  it('no real host can become the reserved value, whatever the referrer says', () => {
    for (const r of ['https://(push)/', 'http://(push).com/', '(push)', 'push', 'https://push/', 'https://%28push%29/']) expect(referrerHost(r, 'news.test')).not.toBe(PUSH_SOURCE);
  });
  it('pn 1 stores the reserved value, even when the page also had a referrer', () => {
    const r: any = cleanBeacon({ ...msg, pn: 1 }, ctx);
    expect(r.ok).toBe(true);
    expect(r.event.referrer_host).toBe('(push)');
    expect(eventValues(r.event)[6]).toBe('(push)');
  });
  it('only the number 1 counts: text, true, 0, 2 and arrays keep the normal source', () => {
    for (const pn of ['1', true, 0, 2, -1, [1], { a: 1 }, null, undefined]) expect((cleanBeacon({ ...msg, pn }, ctx) as any).event.referrer_host, String(pn)).toBe('google.com');
  });
  it('without pn nothing changes', () => {
    expect((cleanBeacon(msg, ctx) as any).event.referrer_host).toBe('google.com');
    expect((cleanBeacon({ ...msg, ref: '' }, ctx) as any).event.referrer_host).toBe('');
  });
  it('groupSources shows one Push notification line, next to Direct and Google, never the raw (push) text', () => {
    const rows = [{ k: 'google.com', views: 10, read_seconds: 100 }, { k: '(push)', views: 6, read_seconds: 120 }, { k: '', views: 3, read_seconds: 30 }];
    expect(groupSources(rows)).toEqual([
      { key: 'Google', views: 10, avgRead: 10 },
      { key: 'Push notification', views: 6, avgRead: 20 },
      { key: 'Direct', views: 3, avgRead: 10 },
    ]);
  });
  it('the unverified per source note uses the same name', () => {
    expect(groupUnverified([{ k: '(push)', cur: 4, prev: 1 }, { k: '', cur: 2, prev: 0 }], sourceName)).toEqual([
      { key: 'Push notification', current: 4, previous: 1 },
      { key: 'Direct', current: 2, previous: 0 },
    ]);
  });
});

function fakeDb() {
  const runs: { sql: string; values: any[] }[] = [];
  return { runs, prepare: (sql: string) => ({ bind: (...values: any[]) => ({ run: async () => { runs.push({ sql, values }); return { success: true }; } }) }) };
}
const post = async (body: any, env: any) => {
  const stamp = await issueStamp(SECRET, Date.now(), 'analytics');
  return worker.fetch(new Request('https://an.test/collect', { method: 'POST', headers: { 'User-Agent': CHROME, 'Content-Type': 'text/plain', 'CF-IPCountry': 'IN', Origin: SITE }, body: JSON.stringify({ ...body, stamp }) }), env);
};

describe('the source "Push notification": through the real Worker', () => {
  it('accepts the optional field pn and stores the reserved source', async () => {
    const env = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb() };
    const res = await post({ ...msg, pn: 1 }, env);
    expect(res.status).toBe(204);
    expect(env.DB.runs).toHaveLength(1);
    expect(env.DB.runs[0].values[6]).toBe('(push)');
  });
  it('a message without pn is still accepted (an older page script)', async () => {
    const env = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb() };
    expect((await post(msg, env)).status).toBe(204);
    expect(env.DB.runs[0].values[6]).toBe('google.com');
  });
  it('pn as text is refused as a wrong shape, and nothing is stored', async () => {
    const env = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb() };
    expect((await post({ ...msg, pn: 'yes' }, env)).status).toBe(400);
    expect(env.DB.runs).toHaveLength(0);
  });
  it('any other extra field is still refused', async () => {
    const env = { SITE_ORIGIN: SITE, STAMP_SECRET: SECRET, DB: fakeDb() };
    expect((await post({ ...msg, pnn: 1 }, env)).status).toBe(400);
  });
});

describe('files (v0.97.0)', () => {
  it('the Worker schema lists pn as an optional number', () => {
    expect(readFileSync('../workers/analytics/index.js', 'utf8')).toContain('pn: { number: true, optional: true }');
  });
  it('the notification link of the push Worker carries the same mark that the beacon reads', () => {
    expect(readFileSync('../workers/push/lib.js', 'utf8')).toContain("u.searchParams.set('pn', '1')");
    expect(readFileSync('src/lib/beacon-client.js', 'utf8')).toContain('pn=1');
  });
  it('the package version is 0.97.0 or newer', () => {
    const v = JSON.parse(readFileSync('package.json', 'utf8')).version.split('.').map(Number);
    expect(v[0] > 0 || v[1] >= 97).toBe(true);
  });
});
