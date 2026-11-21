// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const post = stringify({ title: 'A story that moved once', permalink: 'moved-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: ['/2026/11/12/blogs/news/moved-story/'] }, '## Body\ntext');
const files: Record<string, string> = {
  'site/content/blogs/technology/moved-story.md': post,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/content/pages/about.md': stringify({ title: 'About us', permalink: 'about', date: '2026-11-01T00:00:00Z', status: 'published' }, 'About text.'),
  'site/config/ads.json': JSON.stringify({ adsensePublisherId: '', extraLines: [] }),
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

describe('Ads screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/ads';
    await tick(300);
  };
  const fire = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

  it('shows an empty file, previews live, and saves a checked config in one write', async () => {
    await open();
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Ads');
    expect(document.body.textContent).toContain('(empty file)');
    const id = find('input') as HTMLInputElement;
    const lines = find('textarea') as HTMLTextAreaElement;
    fire(id, 'ca-pub-1234567890123456');
    fire(lines, 'Ads.Test, 99, reseller');
    expect(document.querySelector('pre')!.textContent).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\nads.test, 99, RESELLER\n');
    byText('button', 'Save ads settings').click();
    await tick(400);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/config/ads.json');
    expect(JSON.parse(puts[0].text)).toEqual({ adsensePublisherId: 'ca-pub-1234567890123456', extraLines: ['ads.test, 99, RESELLER'] });
  });

  it('shows a plain message and saves nothing for a bad id', async () => {
    await open();
    fire(find('input'), 'oops');
    expect(document.body.textContent).toContain('is not valid');
    byText('button', 'Save ads settings').click();
    await tick(300);
    expect(puts).toHaveLength(0);
  });
});
