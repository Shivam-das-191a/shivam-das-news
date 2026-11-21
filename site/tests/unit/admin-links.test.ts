// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const post = stringify({ title: 'A story that moved once', permalink: 'moved-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: ['/2026/11/12/blogs/news/moved-story/'] }, '## Body\ntext');
const files: Record<string, string> = {
  'site/content/blogs/technology/moved-story.md': post,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/content/pages/about.md': stringify({ title: 'About us', permalink: 'about', date: '2026-11-01T00:00:00Z', status: 'published' }, 'About text.'),
  'site/config/links.json': JSON.stringify([{ keyword: 'solar power', url: '/category/energy/' }]),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
};
const puts: { path: string; text: string }[] = [];
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') { const text = decodeText(JSON.parse(init.body).content); puts.push({ path, text }); files[path] = text; return json({ content: { sha: 'new-sha' } }); }
  if (u.pathname.startsWith('/repos/o/r/contents/')) return files[path] ? json({ content: toBase64(files[path]), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404);
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const find = (sel: string) => document.querySelector(sel) as HTMLElement;
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('Links screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/links';
    await tick(300);
  };

  it('shows the list, adds a keyword with one save, and removes one', async () => {
    await open();
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Links');
    expect(document.body.textContent).toContain('Your list (1)');
    expect(document.body.textContent).toContain('solar power');
    const [k, u] = [...document.querySelectorAll('input')] as HTMLInputElement[];
    k.value = 'wind farm'; u.value = '/category/wind';
    byText('button', 'Add keyword').click();
    await tick(400);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/config/links.json');
    expect(JSON.parse(puts[0].text)).toEqual([{ keyword: 'solar power', url: '/category/energy/' }, { keyword: 'wind farm', url: '/category/wind/' }]);
    expect(document.body.textContent).toContain('Your list (2)');
    byText('button', 'Remove').click();
    await tick(400);
    expect(JSON.parse(puts[1].text)).toEqual([{ keyword: 'wind farm', url: '/category/wind/' }]);
  });

  it('shows a plain message and saves nothing for a bad keyword', async () => {
    await open();
    const [k, u] = [...document.querySelectorAll('input')] as HTMLInputElement[];
    k.value = 'abc'; u.value = '/x/';
    byText('button', 'Add keyword').click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(document.body.textContent).toContain('at least 4 characters');
  });
});
