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
    for (const t of pending!.tree) files[t.path] = t.sha ? 'BINARY:' + blobs[t.sha] : t.content;
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

const body = '&lt;p&gt;One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.&lt;/p&gt;&lt;img src="https://img.test/a.jpg" alt="Pic"/&gt;';
const K = 'http://schemas.google.com/g/2005#kind', L = 'http://www.blogger.com/atom/ns#', T = 'http://schemas.google.com/blogger/2008/kind#';
const ent = (kind: string, title: string, label: string, href: string) => `<entry><category scheme="${K}" term="${T}${kind}"/>${label ? `<category scheme="${L}" term="${label}"/>` : ''}<published>2020-05-01T10:00:00.000-07:00</published><title type="text">${title}</title><content type="html">${body}</content><link rel="alternate" type="text/html" href="${href}"/></entry>`;
const XML = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${ent('post', 'Old Blogger story', 'World', 'https://old.blogspot.com/2020/05/old-blogger-story.html')}${ent('post', 'A story with no label', '', 'https://old.blogspot.com/2020/05/no-label.html')}${ent('page', 'About us', '', 'https://old.blogspot.com/p/about.html')}</feed>`;

async function openWithFile(fetchImage?: any) {
  vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
  const { boot, setImageFetcher } = await import('../../public/admin/js/app.js');
  setImageFetcher(fetchImage || (async () => { throw new Error('HTTP 403'); }));
  await boot(document.getElementById('app')!);
  location.hash = '#/import';
  await tick(300);
  const input = find('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [{ text: async () => XML }], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await tick(300);
}

describe('Import save (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; reset(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });

  it('saves posts and pages in ONE commit, with redirects, and skips a post without a category', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWithFile();
    expect(document.body.textContent).toContain('Save to the site');
    expect(commits).toHaveLength(0);
    byText('button', 'Save 3 item(s)').click();
    await tick(500);
    expect(commits).toHaveLength(1);
    const paths = commits[0].paths.sort();
    expect(paths).toEqual(['site/config/redirects.json', 'site/content/blogs/world/old-blogger-story.md', 'site/content/pages/about-2.md']);
    expect(commits[0].message).toContain('admin: import 3 file(s)');
    expect(parse(files['site/content/blogs/world/old-blogger-story.md']).data.redirects).toEqual(['/2020/05/old-blogger-story.html']);
    expect(JSON.parse(files['site/config/redirects.json'])).toEqual([{ from: '/p/about.html', to: '/2020/05/01/pages/about-2/' }]);
    const t = document.body.textContent!;
    expect(t).toContain('1 post(s) and 1 page(s) saved');
    expect(t).toContain('A story with no label: No category');
  });

  it('saves the post without a category as a draft when a category is typed', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWithFile();
    type(find('input[placeholder="for example news"]'), 'news');
    byText('button', 'Save 3 item(s)').click();
    await tick(500);
    const d = parse(files['site/content/blogs/news/no-label.md']).data;
    expect(d.status).toBe('draft');
    expect(d.redirects).toEqual(['/2020/05/no-label.html']);
  });

  it('writes nothing when the editor says no, and explains a failed save', async () => {
    vi.stubGlobal('confirm', () => false);
    await openWithFile();
    byText('button', 'Save 3 item(s)').click();
    await tick(400);
    expect(commits).toHaveLength(0);
    vi.stubGlobal('confirm', () => true);
    failPatch = true;
    byText('button', 'Save 3 item(s)').click();
    await tick(400);
    expect(commits).toHaveLength(0);
    expect(document.body.textContent).toContain('Someone else saved');
  });

  it('downloads the images first, saves them to the media library and rewrites the posts', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWithFile(async () => ({ bytes: new Uint8Array([1, 2, 3]), ext: 'webp', width: 1600 }));
    byText('button', 'Save 3 item(s)').click();
    await tick(600);
    expect(commits).toHaveLength(2);
    expect(commits[0].message).toBe('admin: import 1 image(s)');
    expect(commits[0].paths).toEqual(['site/public/media/imported/a.webp']);
    expect(files['site/public/media/imported/a.webp']).toBe('BINARY:AQID');
    const post = files['site/content/blogs/world/old-blogger-story.md'];
    expect(parse(post).data.image).toBe('/media/imported/a.webp');
    expect(post).toContain('![Pic](/media/imported/a.webp)');
    expect(post).not.toContain('img.test');
    expect(document.body.textContent).toContain('1 image(s) saved to the media library.');
  });

  it('keeps the old address when a download fails, and says so', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWithFile();
    byText('button', 'Save 3 item(s)').click();
    await tick(600);
    expect(commits).toHaveLength(1);
    expect(parse(files['site/content/blogs/world/old-blogger-story.md']).data.image).toBe('https://img.test/a.jpg');
    expect(document.body.textContent).toContain('1 could not be downloaded');
    expect(document.body.textContent).toContain('HTTP 403');
  });

  it('turns a published post into a draft when its featured image is too small', async () => {
    vi.stubGlobal('confirm', () => true);
    await openWithFile(async () => ({ bytes: new Uint8Array([1]), ext: 'webp', width: 800 }));
    byText('button', 'Save 3 item(s)').click();
    await tick(600);
    expect(parse(files['site/content/blogs/world/old-blogger-story.md']).data.status).toBe('draft');
    expect(files['site/config/redirects.json']).toBeDefined();
  });
});
