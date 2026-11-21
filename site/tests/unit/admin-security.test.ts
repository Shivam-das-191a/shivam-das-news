// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64 } from '../../public/admin/js/github.js';
import { can } from '../../public/admin/js/roles.js';
import { LAST_DONE_KEY } from '../../public/admin/js/security.js';

// v0.93.0 (BOT_PROTECTION Part 8b-2): the Security screen inside the dashboard, run in jsdom like admin-analytics.test.ts.
const files: Record<string, string> = {
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
};
const calls: { url: string; auth: string }[] = [];
const reply: Record<string, () => Response> = {};
const ok = (o: any) => () => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.hostname === 'an.test') {
    calls.push({ url, auth: init.headers?.Authorization });
    const r = reply[u.searchParams.get('range') || ''];
    return Promise.resolve(r ? r() : new Response('{}', { status: 500 }));
  }
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

// v0.96.0: every test boots a fresh copy of the dashboard, and each copy adds its own hashchange listener to the one window.
// Old copies then ask the Worker again and the call count doubles. We remember the listeners and remove them before each test.
const hashListeners: any[] = [];
const realAdd = window.addEventListener.bind(window);
(window as any).addEventListener = (type: string, fn: any, opt?: any) => { if (type === 'hashchange') hashListeners.push(fn); return realAdd(type, fn, opt); };

describe('Security screen (jsdom)', () => {
  beforeEach(() => {
    while (hashListeners.length) window.removeEventListener('hashchange', hashListeners.pop());
    document.body.innerHTML = '<div id="app"></div>';
    calls.length = 0; sessionStorage.clear(); localStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = '';
    delete files['site/config/analytics.json'];
    reply['24h'] = ok({ views: 100, verifiedViews: 95 });
    reply['7d'] = ok({ views: 1000, verifiedViews: 300 });
    vi.restoreAllMocks();
  });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/security';
    await tick(300);
  };

  it('is in the menu for admins only', () => {
    expect(can('admin', 'analytics')).toBe(true);
    expect(can('editor', 'analytics')).toBe(false);
    expect(can('author', 'analytics')).toBe(false);
  });

  it('with no analytics address: says so, asks nobody, and still shows the two lists', async () => {
    await open();
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Security');
    expect(document.body.textContent).toContain('Analytics is not switched on');
    expect(document.querySelector('[data-level]')).toBeNull();
    expect(calls).toHaveLength(0);
    expect(document.querySelectorAll('[data-check]').length).toBe(6);
  });

  it('asks the Worker twice (24h and 7d) with the sign-in token and draws both levels and the alert', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    await open();
    expect(calls.map((c) => c.url).sort()).toEqual(['https://an.test/stats?range=24h', 'https://an.test/stats?range=7d']);
    expect(calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
    expect([...document.querySelectorAll('[data-level]')].map((e) => e.getAttribute('data-level'))).toEqual(['ok', 'high']);
    expect(document.querySelector('[data-sec=alert]')).not.toBeNull();
    expect(document.body.textContent).toContain('70%');
  });

  it('shows the plain reason and no level when the Worker refuses or is not reachable', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    reply['24h'] = () => new Response('{}', { status: 403 });
    await open();
    expect(document.body.textContent).toContain('ALLOWED_USERS');
    expect(document.querySelector('[data-level]')).toBeNull();
    reply['24h'] = () => { throw new Error('offline'); };
    byText('button', 'Refresh').click();
    await tick(100);
    expect(document.body.textContent).toContain('Could not reach the analytics Worker');
    expect(document.querySelector('[data-level]')).toBeNull();
  });

  it('shows "no verified count" and no share when an older Worker sends no verified number', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    reply['24h'] = ok({ views: 500 });
    reply['7d'] = ok({ views: 500 });
    await open();
    expect([...document.querySelectorAll('[data-level]')].map((e) => e.getAttribute('data-level'))).toEqual(['unknown', 'unknown']);
  });

  it('Mark done writes the time to this browser, shows it, and it is still there after a reload of the screen', async () => {
    await open();
    expect(document.body.textContent).toContain('Never marked done.');
    (document.querySelector('[data-done=cf-events]') as HTMLElement).click();
    await tick(30);
    const saved = JSON.parse(localStorage.getItem(LAST_DONE_KEY) || '{}');
    expect(Object.keys(saved)).toEqual(['cf-events']);
    expect(document.querySelector('[data-check=cf-events]')!.textContent).toContain('Last done');
    expect(document.querySelector('[data-check=cf-events]')!.getAttribute('data-due')).toBe('false');
    expect(document.querySelector('[data-check=analytics-share]')!.textContent).toContain('Never marked done.');
    document.body.innerHTML = '<div id="app"></div>';
    await open();
    expect(document.querySelector('[data-check=cf-events]')!.textContent).toContain('Last done');
  });

  it('survives a browser that refuses to save, and a broken saved text', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await open();
    (document.querySelector('[data-done=cf-real-readers]') as HTMLElement).click();
    await tick(30);
    expect(document.querySelector('[data-check=cf-real-readers]')!.textContent).toContain('Last done');
    vi.restoreAllMocks();
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.setItem(LAST_DONE_KEY, 'not json {{{');
    await open();
    expect(document.querySelectorAll('[data-check]').length).toBe(6);
    expect(document.body.textContent).toContain('Never marked done.');
  });

  it('has one outside link, to Cloudflare, and nothing was sent to any other address', async () => {
    files['site/config/analytics.json'] = JSON.stringify({ endpoint: 'https://an.test/collect' });
    await open();
    const links = [...document.querySelectorAll('main a')] as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://dash.cloudflare.com/']);
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(calls.every((c) => c.url.startsWith('https://an.test/stats?range='))).toBe(true);
  });
});
