// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const post = stringify({ title: 'A story that moved once', permalink: 'moved-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: ['/2026/11/12/blogs/news/moved-story/'] }, '## Body\ntext');
const files: Record<string, string> = {
  'site/content/blogs/technology/moved-story.md': post,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
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

const BLOGGER = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry><category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#post"/>
<category scheme="http://www.blogger.com/atom/ns#" term="World"/><category scheme="http://www.blogger.com/atom/ns#" term="Asia"/>
<published>2020-05-01T10:00:00.000-07:00</published><title type="text">Old Blogger story</title>
<content type="html">&lt;p&gt;One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.&lt;/p&gt;&lt;img src="https://img.test/a.jpg" alt="Pic"/&gt;</content><link rel="alternate" type="text/html" href="https://old.blogspot.com/2020/05/old-blogger-story.html"/></entry>
<entry><category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#post"/>
<category scheme="http://www.blogger.com/atom/ns#" term="Technology"/>
<published>2026-11-12T09:00:00.000Z</published><title type="text">A story that moved once</title><content type="html">&lt;p&gt;Already here&lt;/p&gt;</content></entry>
<entry><category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#comment"/><published>2020-05-02T10:00:00Z</published><title>c</title></entry>
</feed>`;

describe('Import preview screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });

  it('reads a Blogger file, shows what would be created, flags the duplicate and writes nothing', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toContain('Import');
    location.hash = '#/import';
    await tick(300);
    const input = find('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ text: async () => BLOGGER }] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick(300);
    const t = document.body.textContent!;
    expect(t).toContain('Blogger file read');
    expect(t).toContain('1 post(s), 0 page(s), 0 of them drafts. 1 already on the site');
    expect(t).toContain('1 redirect(s) from old addresses. 1 image(s) found.');
    expect(t).toContain('1 image(s)');
    expect(t).toContain('Old Blogger story');
    expect(t).toContain('/2020/05/01/blogs/world/old-blogger-story/');
    expect(t).toContain('Skipped: Already on the site');
    expect(t).toContain('1 comment');
    expect(puts).toHaveLength(0);
  });

  it('shows a plain message for a file that is not Blogger or WordPress', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/import';
    await tick(300);
    const input = find('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ text: async () => '<html><body/></html>' }] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick(200);
    expect(document.body.textContent).toContain('not a Blogger backup or a WordPress export');
    expect(puts).toHaveLength(0);
  });
});
