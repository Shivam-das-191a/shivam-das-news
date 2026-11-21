// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';
import { normalizePath as adminNormalize, cleanEntry, parseCsv, toCsv } from '../../public/admin/js/redirects.js';
import { normalizePath as siteNormalize } from '../../src/lib/redirects';

describe('redirect helpers (dashboard)', () => {
  it('normalizePath matches the build rule', () => {
    for (const x of ['/a/b', 'https://n.test/a/b/?q=1', 'a/b', '/a b/', '/a/:id/', '', '/file.html']) expect(adminNormalize(x)).toBe(siteNormalize(x));
  });
  it('cleanEntry accepts a good pair and explains bad ones', () => {
    expect(cleanEntry('/old', '/new')).toEqual({ from: '/old/', to: '/new/' });
    expect(() => cleanEntry('old', '/new')).toThrow('not a usable old address');
    expect(() => cleanEntry('/old', 'new')).toThrow('not a usable new address');
    expect(() => cleanEntry('/a/', '/a')).toThrow('same');
    expect(() => cleanEntry('/live/', '/new/', new Set(['/live/']))).toThrow('live page');
    expect(() => cleanEntry('/old/', '/new/', new Set(), [{ from: '/old/', to: '/x/' }])).toThrow('already has');
  });
  it('reads and writes CSV', () => {
    expect(parseCsv('from,to\n/a,/b\n\n"/c/","/d/"\n/bad\n')).toEqual([['/a', '/b'], ['/c/', '/d/']]);
    expect(toCsv([{ from: '/a/', to: '/b/' }, { from: '/c/', to: '/d/', source: 'post' }])).toBe('from,to,source\n/a/,/b/,manual\n/c/,/d/,post\n');
  });
});

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

describe('Redirects screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });

  it('shows post redirects, adds one by hand, rejects a live address, then removes it', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/redirects';
    await tick(300);
    expect(document.body.textContent).toContain('/2026/11/12/blogs/news/moved-story/');
    expect(document.body.textContent).toContain('From moved posts (1)');

    type(find('input[placeholder="/old/address/"]'), '/2026/11/12/blogs/technology/moved-story/');
    type(find('input[placeholder="/new/address/"]'), '/category/technology/');
    byText('button', 'Add redirect').click();
    await tick(200);
    expect(document.body.textContent).toContain('is a live page');
    expect(puts).toHaveLength(0);

    type(find('input[placeholder="/old/address/"]'), '/2020/05/old-blogger-post.html');
    type(find('input[placeholder="/new/address/"]'), '/2026/11/12/blogs/technology/moved-story/');
    byText('button', 'Add redirect').click();
    await tick(300);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('site/config/redirects.json');
    expect(JSON.parse(puts[0].text)).toEqual([{ from: '/2020/05/old-blogger-post.html', to: '/2026/11/12/blogs/technology/moved-story/' }]);
    expect(document.body.textContent).toContain('Added here (1)');

    byText('button', 'Remove').click();
    await tick(300);
    expect(JSON.parse(puts[1].text)).toEqual([]);
  });
});
