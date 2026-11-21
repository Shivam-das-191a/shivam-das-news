// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64 } from '../../public/admin/js/github.js';
import { parse } from '../../public/admin/js/frontmatter.js';

const files: Record<string, string> = {};
const commits: { message: string; paths: string[] }[] = [];
let failPatch = false;
const reset = () => {
  for (const k of Object.keys(files)) delete files[k];
  files['site/content/authors/shivam-das.json'] = JSON.stringify({ name: 'Shivam Das', bio: '' });
  files['site/config/site.json'] = JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' });
  files['site/content/pages/about.md'] = '---\ntitle: "About"\npermalink: "about"\ndate: 2026-01-01T00:00:00Z\nstatus: "published"\n---\nx\n';
  files['site/content/blogs/tech/a.md'] = '---\ntitle: "Story A here"\npermalink: "a"\ncategory: "tech"\ntags: []\ndate: 2026-11-13T09:30:00Z\nauthor: "shivam-das"\nstatus: "published"\nredirects: []\n---\nBody A\n';
  files['site/content/blogs/tech/b.md'] = '---\ntitle: "Story B here"\npermalink: "b"\ncategory: "tech"\ntags: []\ndate: 2026-11-12T09:30:00Z\nauthor: "shivam-das"\nstatus: "draft"\nredirects: []\n---\nBody B\n';
  files['site/config/categories.json'] = JSON.stringify({ tech: { name: 'Technology', description: 'Gadgets' } });
  commits.length = 0; failPatch = false; for (const k of Object.keys(blobs)) delete blobs[k];
};
let pending: { message: string; tree: any[] } | null = null;
const blobs: Record<string, string> = {};
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const m = init.method || 'GET';
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname === '/repos/o/r/git/blobs' && m === 'POST') { const id = 'blob' + Object.keys(blobs).length; blobs[id] = JSON.parse(init.body).content; return json({ sha: id }); }
  if (u.pathname === '/repos/o/r/git/trees' && m === 'POST') { pending = { message: '', tree: JSON.parse(init.body).tree }; return json({ sha: 'tree1' }); }
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname === '/repos/o/r/git/ref/heads/main') return json({ object: { sha: 'parent1' } });
  if (u.pathname === '/repos/o/r/git/commits/parent1') return json({ tree: { sha: 'tree0' } });
  if (u.pathname === '/repos/o/r/git/commits' && m === 'POST') { pending!.message = JSON.parse(init.body).message; return json({ sha: 'commit1' }); }
  if (u.pathname === '/repos/o/r/git/refs/heads/main' && m === 'PATCH') {
    if (failPatch) return json({ message: 'Update is not a fast forward' }, 422);
    for (const t of pending!.tree) { if (t.sha === null) delete files[t.path]; else files[t.path] = t.sha ? 'BINARY:' + blobs[t.sha] : t.content; }
    commits.push({ message: pending!.message, paths: pending!.tree.map((t) => t.path) });
    return json({});
  }
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const find = (sel: string) => document.querySelector(sel) as HTMLElement;
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('Rename category screen (jsdom)', () => {
  beforeEach(() => { reset(); document.body.innerHTML = '<div id="app"></div>'; sessionStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; vi.stubGlobal('confirm', () => true); });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/categories';
    await tick(400);
  };

  it('moves both posts, deletes the old files, adds redirects and renames the settings key in ONE commit', async () => {
    await open();
    const input = [...document.querySelectorAll('input')].find((i) => (i as HTMLInputElement).placeholder === 'new-slug') as HTMLInputElement;
    input.value = 'technology';
    byText('button', 'Rename').click();
    await tick(600);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toContain('rename category tech to technology (2 posts)');
    expect(files['site/content/blogs/tech/a.md']).toBeUndefined();
    expect(files['site/content/blogs/tech/b.md']).toBeUndefined();
    const a = parse(files['site/content/blogs/technology/a.md']);
    expect(a.data.category).toBe('technology');
    expect(a.data.redirects).toEqual(['/2026/11/13/blogs/tech/a/']);
    expect(parse(files['site/content/blogs/technology/b.md']).data.redirects).toEqual([]);
    expect(JSON.parse(files['site/config/redirects.json'])).toEqual([{ from: '/category/tech/', to: '/category/technology/' }]);
    expect(JSON.parse(files['site/config/categories.json'])).toEqual({ technology: { name: 'Technology', description: 'Gadgets' } });
    expect(document.body.textContent).toContain('Renamed. 2 post(s) moved');
  });

  it('changes nothing when the new name already exists', async () => {
    files['site/content/blogs/world/w.md'] = '---\ntitle: "World story"\npermalink: "w"\ncategory: "world"\ndate: 2026-11-10T09:30:00Z\nstatus: "draft"\n---\nx\n';
    await open();
    const input = [...document.querySelectorAll('input')].find((i) => (i as HTMLInputElement).placeholder === 'new-slug') as HTMLInputElement;
    input.value = 'world';
    [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Rename')[0].click();
    await tick(400);
    expect(commits).toHaveLength(0);
    expect(document.body.textContent).toContain('already exists');
  });
});
