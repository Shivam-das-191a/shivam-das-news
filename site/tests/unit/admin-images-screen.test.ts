// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { toBase64 } from '../../public/admin/js/github.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const files: Record<string, string> = {
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
};
let imagesText: string | undefined;
let roles: Record<string, string> = {};
let imagesDelay = 0;
const writes: string[] = [];

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (init.method && init.method !== 'GET') writes.push(`${init.method} ${u.pathname}`);
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  const all = () => ({ ...files, ...(imagesText !== undefined ? { 'site/config/images.json': imagesText } : {}) });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(all()).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(all()[p]) }); }
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/')) {
    const found = all()[path];
    const answer = () => (found !== undefined ? json({ content: toBase64(found), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404));
    return path === 'site/config/images.json' && imagesDelay ? new Promise((r) => setTimeout(() => r(answer()), imagesDelay)) : answer();
  }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const texts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent!.trim());
const valueOf = (key: string) => (document.querySelector(`[data-key="${key}"] [data-f="value"]`) as HTMLElement | null)?.textContent;

describe('Picture settings screen in the dashboard (jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    writes.length = 0; imagesText = undefined; roles = {}; imagesDelay = 0;
    sessionStorage.setItem('adm.token', 'tok'); location.hash = '';
  });
  const open = async (hash = '#/images', wait = 400) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = hash;
    await tick(wait);
  };

  it('shows the menu item and the title, and draws the eleven rows with the values of the file', async () => {
    imagesText = JSON.stringify({ hardBlock: true, blockHosts: ['bad.example.com'], quality: 70, maxWidth: 1200 });
    await open();
    expect(texts('nav a')).toContain('Picture settings');
    expect(document.querySelector('h1')!.textContent).toBe('Picture settings');
    expect(document.querySelectorAll('[data-f="row"]')).toHaveLength(11);
    expect(valueOf('quality')).toBe('70 of 100');
    expect(valueOf('maxWidth')).toBe('1200 px');
    expect(valueOf('hardBlock')).toBe('Error');
    expect(valueOf('blockHosts')).toBe('bad.example.com');
    expect(valueOf('storage')).toBe('In the repository'); // not in the file: shipped value
    expect(document.querySelector('[data-f="note"]')!.hasAttribute('hidden')).toBe(true);
  });
  it('a missing file shows the shipped values and says so', async () => {
    await open();
    expect(document.querySelectorAll('[data-f="row"]')).toHaveLength(11);
    expect(valueOf('quality')).toBe('85 of 100');
    const note = document.querySelector('[data-f="note"]') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('config/images.json could not be read');
  });
  it('a file that is not valid JSON, or not an object, shows the shipped values and says so', async () => {
    for (const bad of ['{ "quality": ', '[1, 2]', '"text"', '']) {
      imagesText = bad;
      await open();
      expect(valueOf('quality')).toBe('85 of 100');
      expect((document.querySelector('[data-f="note"]') as HTMLElement).hidden).toBe(false);
    }
  });
  it('a wrong value inside a good file shows its shipped value and does not spoil the others', async () => {
    imagesText = JSON.stringify({ quality: 500, maxWidth: 900, storage: 'ftp' });
    await open();
    expect(valueOf('quality')).toBe('85 of 100');
    expect(valueOf('storage')).toBe('In the repository');
    expect(valueOf('maxWidth')).toBe('900 px');
  });
  it('an editor does not see the menu item and cannot open the screen', async () => {
    roles = { owner: 'editor' };
    await open();
    expect(texts('nav a')).not.toContain('Picture settings');
    expect(document.querySelector('h1')!.textContent).toBe('Picture settings');
    expect(document.body.textContent).toContain('Only admins can see the picture settings.');
    expect(document.querySelectorAll('[data-f="row"]')).toHaveLength(0);
  });
  it('is read only: nothing is written to GitHub and the screen has no button or input', async () => {
    imagesText = JSON.stringify({ quality: 60 });
    await open();
    expect(writes).toEqual([]);
    expect(document.querySelectorAll('[data-f="images-screen"] button, [data-f="images-screen"] input, [data-f="images-screen"] select, [data-f="images-screen"] textarea')).toHaveLength(0);
  });
  it('if the person goes to another screen while the file loads, the late answer does not draw over it', async () => {
    imagesText = JSON.stringify({ quality: 60 });
    imagesDelay = 150;
    await open('#/images', 20);
    location.hash = '#/settings';
    await tick(400);
    expect(document.querySelector('h1')!.textContent).toBe('Settings');
    expect(document.querySelectorAll('[data-f="row"]')).toHaveLength(0);
  });
  it('the other menu items are all still there, in their old order, with the new one before Settings', async () => {
    await open('#/', 300);
    expect(texts('nav a')).toEqual(['Posts', 'New post', 'Media', 'Files', 'Authors', 'Categories', 'Redirects', 'Import', 'Export', 'Links', 'Ads', 'Ad loader', 'Analytics', 'Security', 'Tasks', 'Picture settings', 'Settings', 'Setup']);
  });
  it('app.js reads the file only with getText and has no write call in the new code', () => {
    const app = src('public/admin/js/app.js');
    const start = app.indexOf('async function imagesView()');
    const body = app.slice(start, app.indexOf('async function linksView()'));
    expect(body).toContain('getText(imagesPathOf(S.cfg))');
    expect(body).not.toMatch(/\.put\(|\.remove\(|\.commit|fetch\(|localStorage|sessionStorage|innerHTML/);
  });
});
