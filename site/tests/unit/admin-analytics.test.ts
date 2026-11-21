// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64 } from '../../public/admin/js/github.js';
import { statsUrl, readEndpoint, fmtDuration, fmtCount, bucketLabel, fillTimeline, statsError, zoneList, RANGES } from '../../public/admin/js/analytics.js';
import { can } from '../../public/admin/js/roles.js';

describe('analytics helpers', () => {
  it('derives the stats address from the saved collect address, and nothing else', () => {
    expect(statsUrl('https://news-analytics.me.workers.dev/collect')).toBe('https://news-analytics.me.workers.dev/stats');
    for (const bad of ['', '  ', 'http://a.test/collect', 'https://a.test/other', 'https://a.test/', 'not a url', null, undefined]) expect(statsUrl(bad as any)).toBe('');
    expect(readEndpoint('{"endpoint":" https://a.test/collect "}')).toBe('https://a.test/collect');
    for (const bad of ['', 'nope', '{"endpoint":5}', '[]']) expect(readEndpoint(bad)).toBe('');
  });
  it('formats durations and counts', () => {
    expect([0, 45, 59.6, 185, 3720, -4, NaN].map(fmtDuration)).toEqual(['0s', '45s', '1m 00s', '3m 05s', '1h 02m', '0s', '0s']);
    expect(fmtCount(1234567)).toBe('1,234,567');
  });
  it('labels a chart step in the chosen time zone and falls back to UTC for a bad zone', () => {
    const t = Date.UTC(2026, 10, 14, 20, 30) / 1000;
    expect(bucketLabel(t, 60, 'UTC')).toBe('20:30');
    expect(bucketLabel(t, 60, 'Asia/Kolkata')).toBe('02:00');
    expect(bucketLabel(t, 3600, 'UTC')).toBe('14 Nov, 20:30');
    expect(bucketLabel(t, 86400, 'UTC')).toBe('14 Nov');
    expect(bucketLabel(t, 60, 'Not/AZone')).toBe('20:30');
  });
  it('zero-fills the chart, and lifetime starts at the first day with data', () => {
    const f = fillTimeline([{ t: 120, views: 5 }], 60, 240, 60, false);
    expect(f).toEqual([{ t: 60, views: 0 }, { t: 120, views: 5 }, { t: 180, views: 0 }, { t: 240, views: 0 }]);
    expect(fillTimeline([], 0, 100, 60, true)).toEqual([]);
    expect(fillTimeline([{ t: 86400, views: 2 }, { t: 3 * 86400, views: 1 }], 3 * 86400, 3 * 86400, 86400, true).map((x) => x.views)).toEqual([2, 0, 1]);
  });
  it('has a plain sentence for each Worker failure, five ranges, and the zone list starts with the site zone', () => {
    for (const s of [400, 401, 403, 503, 500]) expect(statsError(s).length).toBeGreaterThan(20);
    expect(statsError(403)).toContain('ALLOWED_USERS');
    expect(RANGES.map((r) => r[0])).toEqual(['5m', '1h', '24h', '7d', 'life']);
    expect(zoneList('Asia/Kolkata').slice(0, 2)).toEqual(['Asia/Kolkata', 'UTC']);
  });
  it('only admins may open the screen', () => {
    expect(can('admin', 'analytics')).toBe(true);
    expect(can('editor', 'analytics')).toBe(false);
    expect(can('author', 'analytics')).toBe(false);
  });
});

const files: Record<string, string> = {
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
};
const stats: any = { range: '24h', from: 1_700_000_000, to: 1_700_000_000 + 7200, step: 3600, views: 12, visitors: 5, avgRead: 75, pages: [{ key: '/2026/11/14/blogs/world/a-story/', views: 9, avgRead: 80 }], countries: [{ key: 'US', views: 7, avgRead: 70 }], sources: [{ key: 'google.com', views: 6, avgRead: 90 }], devices: [{ key: 'mobile', views: 10, avgRead: 70 }], browsers: [{ key: 'Chrome', views: 11, avgRead: 75 }], timeline: [{ t: 1_699_999_200, views: 4 }, { t: 1_700_002_800, views: 8 }] };
const calls: { url: string; auth: string }[] = [];
let statsReply: () => Response = () => new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } });

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.hostname === 'an.test') { calls.push({ url, auth: init.headers?.Authorization }); return Promise.resolve(statsReply()); }
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/')) return files[path] ? json({ content: toBase64(files[path]), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404);
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;

describe('Analytics screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; calls.length = 0; sessionStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; delete files['site/config/analytics.json']; statsReply = () => new Response(JSON.stringify(stats), { status: 200 }); });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/analytics';
    await tick(300);
  };

  it('says it is not switched on, and shows no numbers, when there is no endpoint', async () => {
    await open();
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Analytics');
    expect(document.body.textContent).toContain('Analytics is not switched on');
    expect(document.querySelector('[data-an=stats]')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('asks the Worker with the sign-in token and draws the numbers, chart and lists', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    await open();
    expect(calls[0].url).toBe('https://an.test/stats?range=24h');
    expect(calls[0].auth).toBe('Bearer tok');
    const t = document.body.textContent!;
    expect(t).toContain('12');
    expect(t).toContain('1m 15s');
    expect(t).toContain('/2026/11/14/blogs/world/a-story/');
    expect(t).toContain('google.com');
    expect(document.querySelectorAll('.an-bar').length).toBeGreaterThan(1);
    expect(document.querySelectorAll('.an-range button').length).toBe(5);
  });

  it('switches the period, and lifetime shows visitors as not counted', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    await open();
    statsReply = () => new Response(JSON.stringify({ ...stats, range: 'life', visitors: null, step: 86400 }), { status: 200 });
    byText('button', 'Lifetime').click();
    await tick(100);
    expect(calls[calls.length - 1].url).toBe('https://an.test/stats?range=life');
    expect(document.querySelector('[data-range=life]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).toContain('not counted for lifetime');
  });

  it('shows a plain empty message for zero visits, not fake numbers', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    statsReply = () => new Response(JSON.stringify({ ...stats, views: 0, visitors: 0, avgRead: 0, pages: [], countries: [], sources: [], devices: [], browsers: [], timeline: [] }), { status: 200 });
    await open();
    expect(document.body.textContent).toContain('No visits recorded in this period yet.');
    expect(document.querySelector('.an-bar')).toBeNull();
  });

  it('explains a refusal in plain words, and a network failure too', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    statsReply = () => new Response(JSON.stringify({ error: 'x' }), { status: 403 });
    await open();
    expect(document.querySelector('[data-an=note]')!.textContent).toContain('ALLOWED_USERS');
    expect(document.querySelector('[data-an=stats]')).toBeNull();
    statsReply = () => { throw new Error('offline'); };
    byText('button', 'Refresh').click();
    await tick(100);
    expect(document.querySelector('[data-an=note]')!.textContent).toContain('Could not reach');
  });

  it('redraws the labels when the time zone changes, without asking the Worker again', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    await open();
    const n = calls.length;
    const sel = document.querySelector('#an-zone') as HTMLSelectElement;
    const first = document.querySelector('.an-bar')!.getAttribute('title');
    sel.value = 'UTC';
    sel.dispatchEvent(new Event('change'));
    expect(calls.length).toBe(n);
    expect(document.querySelector('.an-bar')!.getAttribute('title')).not.toBe(first);
  });
});
