// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const existing = stringify({ title: 'An older story about phones', permalink: 'older-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: [] }, '## Body\ntext');
const files: Record<string, string> = {
  'site/content/blogs/technology/older-story.md': existing,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
};
const puts: { path: string; body: any }[] = [];

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') {
    const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
    const body = JSON.parse(init.body); puts.push({ path, body });
    files[path] = decodeText(body.content);
    return json({ content: { sha: 'new-sha' } });
  }
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const find = (sel: string) => document.querySelector(sel) as HTMLElement;
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('dashboard app (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });

  it('lists posts, then publishes a new post as one clean Markdown commit', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.stubGlobal('confirm', () => true);
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    await tick(200);
    expect(document.body.textContent).toContain('An older story about phones');
    expect(document.body.textContent).toContain('owner (admin)');

    location.hash = '#/post/new';
    await tick(200);
    const title = find('input[placeholder^="Headline"]') as HTMLInputElement;
    type(title, 'Brand new phone launched today');
    expect((find('input[placeholder="auto from title"]') as HTMLInputElement).value).toBe('brand-new-phone-launched-today');
    type(find('input[placeholder="technology"]'), 'technology');
    type(find('textarea[maxlength="200"]'), 'The new phone launched today with a faster chip, a brighter screen and a lower price for buyers in India.');
    type(find('input[placeholder^="/media"]'), '/media/a.webp');
    type(find('input[placeholder="Describe the picture"]'), 'A phone');
    type(find('textarea.body'), '## Details\nRead [older](/2026/11/12/blogs/technology/older-story/). ' + 'word '.repeat(300));
    await tick(600);
    expect(document.body.textContent).toContain('SEO score');
    byText('button', 'Publish or schedule').click();
    await tick(300);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/content/blogs/technology/brand-new-phone-launched-today.md');
    const saved = decodeText(puts[0].body.content);
    expect(saved).toMatch(/^---\ntitle: "Brand new phone launched today"/);
    expect(saved).toContain('status: "published"');
    expect(saved).toContain('author: "shivam-das"');
    expect(saved).toMatch(/\ndate: \d{4}-\d\d-\d\dT[\d:]+Z\n/);
    expect(puts[0].body.message).toBe('admin: publish: brand-new-phone-launched-today');
  });

  it('refuses to publish a duplicate permalink and shows the reason', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/new';
    await tick(200);
    type(find('input[placeholder^="Headline"]'), 'Another headline for the test');
    type(find('input[placeholder="auto from title"]'), 'older-story');
    type(find('input[placeholder="technology"]'), 'technology');
    byText('button', 'Save draft').click();
    await tick(200);
    expect(document.body.textContent).toContain('already used by another post');
    expect(puts).toHaveLength(0);
  });

  it('renames a live post: new file, old file removed, old URL kept as redirect', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => { if (i && (i.method === 'DELETE')) calls.push('DELETE ' + new URL(String(u)).pathname); return i && i.method === 'DELETE' ? Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) : api(String(u), i); }));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/' + encodeURIComponent('site/content/blogs/technology/older-story.md');
    await tick(300);
    type(find('input[placeholder="auto from title"]'), 'older-story-renamed');
    byText('button', 'Update post').click();
    await tick(300);
    expect(puts[0].path).toBe('site/content/blogs/technology/older-story-renamed.md');
    expect(decodeText(puts[0].body.content)).toContain('redirects: ["/2026/11/12/blogs/technology/older-story/"]');
    expect(calls).toEqual(['DELETE /repos/o/r/contents/site/content/blogs/technology/older-story.md']);
  });

  it('cancels a move when the old file cannot be removed, so no duplicate permalink is left', async () => {
    const deletes: string[] = [];
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => {
      if (i && i.method === 'DELETE') {
        const path = new URL(String(u)).pathname.replace('/repos/o/r/contents/', '');
        deletes.push(path);
        return Promise.resolve(path.endsWith('older-story.md') ? new Response(JSON.stringify({ message: 'Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return api(String(u), i);
    }));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/' + encodeURIComponent('site/content/blogs/technology/older-story.md');
    await tick(300);
    type(find('input[placeholder="auto from title"]'), 'older-story-again');
    byText('button', 'Update post').click();
    await tick(400);
    expect(deletes).toEqual(['site/content/blogs/technology/older-story.md', 'site/content/blogs/technology/older-story-again.md']);
    expect(document.body.textContent).toContain('The move was cancelled');
  });
});
