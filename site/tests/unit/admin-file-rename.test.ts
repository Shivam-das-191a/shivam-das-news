// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';
// @ts-ignore
import { can } from '../../public/admin/js/roles.js';
// @ts-ignore
import { toBase64, decodeText } from '../../public/admin/js/github.js';
// @ts-ignore
import { stringify } from '../../public/admin/js/frontmatter.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/img-5678.webp';
const B = '/media/2026/11/photo.webp';
const FILES = [{ path: A, bytes: 120 * 1024 }, { path: B, bytes: 90 * 1024 }];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const flush = () => new Promise((r) => setTimeout(r, 0));
const POST = { file: 'site/content/blogs/news/a.md', text: `---\nimage: "${A}"\n---\nBody ${A}.` };
const make = (o: any = {}) => filesScreen({
  files: FILES.map((f) => ({ ...f })), map: { [A]: { alt: 'Council votes' } }, items: [{ ...POST }], sizes: {},
  canEdit: true, canReplace: false, canDelete: true, canRename: true,
  onSave: async () => ({}), onRename: async (_p: string, n: string) => ({ newPath: `/media/2026/11/${n}.webp` }), onDelete: async () => undefined, ...o,
});
const typeName = (s: any, v: string) => { const i = q(s.el, 'rename-input'); i.value = v; };
const go = async (s: any) => { q(s.el, 'rename-go').click(); await flush(); };

beforeEach(() => { document.body.innerHTML = ''; });

describe('the Rename part of the Files screen', () => {
  it('is locked without the right', () => {
    const s = make({ canRename: false }); s.select(A);
    expect(q(s.el, 'rename-locked')).toBeTruthy();
    expect(q(s.el, 'rename-input')).toBeFalsy();
  });
  it('is locked when there is no onRename', () => {
    const s = make({ onRename: undefined }); s.select(A);
    expect(q(s.el, 'rename-locked')).toBeTruthy();
  });
  it('shows an input and a button for an editor', () => {
    const s = make(); s.select(A);
    expect(q(s.el, 'rename-input')).toBeTruthy();
    expect(q(s.el, 'rename-go').textContent).toBe('Rename file');
    expect(q(s.el, 'rename-box')).toBeTruthy();
  });
  it('a bad name is refused on the screen and nothing is sent', async () => {
    const onRename = vi.fn(); const s = make({ onRename }); s.select(A);
    for (const bad of ['', 'Big Name', 'a/b', 'img-5678', 'photo']) {
      typeName(s, bad); await go(s);
      expect(q(s.el, 'rename-error')).toBeTruthy();
      expect(q(s.el, 'rename-yes')).toBeFalsy();
    }
    expect(onRename).not.toHaveBeenCalled();
  });
  it('the refused name stays in the box', async () => {
    const s = make(); s.select(A);
    typeName(s, 'Big Name'); await go(s);
    expect(q(s.el, 'rename-input').value).toBe('Big Name');
  });
  it('a good name asks one question and still sends nothing', async () => {
    const onRename = vi.fn(); const s = make({ onRename }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    const ask = q(s.el, 'rename-ask').textContent;
    expect(ask).toContain('img-5678.webp to city-hall-vote.webp');
    expect(ask).toContain('1 post or page');
    expect(ask).toContain('redirected (301)');
    expect(q(s.el, 'rename-yes')).toBeTruthy();
    expect(onRename).not.toHaveBeenCalled();
  });
  it('a name like img-1234 is allowed with a yellow warning', async () => {
    const s = make(); s.select(A);
    typeName(s, 'img-1234'); await go(s);
    expect(q(s.el, 'rename-warnings')).toBeTruthy();
    expect(q(s.el, 'rename-yes')).toBeTruthy();
  });
  it('the ending may be typed', async () => {
    const onRename = vi.fn(async () => ({ newPath: '/media/2026/11/city-hall-vote.webp' })); const s = make({ onRename }); s.select(A);
    typeName(s, 'city-hall-vote.webp'); await go(s);
    expect(q(s.el, 'rename-ask').textContent).toContain('city-hall-vote.webp?');
  });
  it('Cancel sends nothing and brings the box back with the typed name', async () => {
    const onRename = vi.fn(); const s = make({ onRename }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-cancel').click();
    expect(onRename).not.toHaveBeenCalled();
    expect(q(s.el, 'rename-input').value).toBe('city-hall-vote');
  });
  it('a name that already exists is refused (capitals do not make it new)', async () => {
    const s = make(); s.select(A);
    typeName(s, 'PHOTO'); await go(s);
    expect(q(s.el, 'rename-error')).toBeTruthy();
  });
  it('Yes calls onRename once with the path and the typed name', async () => {
    const onRename = vi.fn(async () => ({ newPath: '/media/2026/11/city-hall-vote.webp' })); const s = make({ onRename }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(A, 'city-hall-vote');
  });
  it('after Yes the file, the list, the alt text and the Used in list use the new address', async () => {
    const s = make(); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    const N = '/media/2026/11/city-hall-vote.webp';
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([N, B]);
    expect(q(s.el, 'name').textContent).toBe('city-hall-vote.webp');
    expect(q(s.el, 'renamed').textContent).toContain('img-5678.webp to city-hall-vote.webp');
    expect(Object.keys(s.map())).toEqual([N]);
    expect(s.map()[N]).toEqual({ alt: 'Council votes' });
    expect(q(s.el, 'alt').value).toBe('Council votes');
    expect(q(s.el, 'used').textContent).toContain('a.md');
  });
  it('the map given back by onRename wins over the local move', async () => {
    const N = '/media/2026/11/city-hall-vote.webp';
    const s = make({ onRename: async () => ({ newPath: N, map: { [N]: { alt: 'From the commit' } } }) }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(s.map()).toEqual({ [N]: { alt: 'From the commit' } });
  });
  it('the old name is no longer found by the search, the new one is', async () => {
    const s = make(); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(s.visible().map((f: any) => f.path)).toContain('/media/2026/11/city-hall-vote.webp');
    expect(s.visible().map((f: any) => f.path)).not.toContain(A);
  });
  it('a refused save keeps everything as it was and shows the message', async () => {
    const s = make({ onRename: async () => { throw new Error('Someone else saved at the same moment, so nothing was changed. Try again.'); } }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(q(s.el, 'rename-error').textContent).toContain('Someone else saved');
    expect(q(s.el, 'rename-input').value).toBe('city-hall-vote');
    expect(s.visible().map((f: any) => f.path)).toContain(A);
    expect(Object.keys(s.map())).toEqual([A]);
    expect(q(s.el, 'renamed')).toBeFalsy();
  });
  it('the Delete part checks the new address after a rename (the post still blocks it)', async () => {
    const s = make(); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(q(s.el, 'delete-refused')).toBeTruthy();
    expect(q(s.el, 'delete-used').textContent).toContain('a.md');
  });
  it('the opts lists are not changed by the screen', async () => {
    const items = [{ ...POST }]; const s = make({ items }); s.select(A);
    typeName(s, 'city-hall-vote'); await go(s);
    q(s.el, 'rename-yes').click(); await flush();
    expect(items[0].text).toBe(POST.text);
  });
});

describe('roles and app.js', () => {
  const app = src('public/admin/js/app.js');
  const handler = () => { const a = app.indexOf('onRename: async (path, newName)'); return app.slice(a, app.indexOf("toast('Renamed.')", a)); };
  it('only an editor and an admin hold media:rename', () => {
    expect(can('admin', 'media:rename')).toBe(true);
    expect(can('editor', 'media:rename')).toBe(true);
    expect(can('author', 'media:rename')).toBe(false);
    expect(can(null, 'media:rename')).toBe(false);
  });
  it('the screen is given canRename and onRename', () => {
    expect(app).toContain("canRename: can(S.role, 'media:rename')");
    expect(app).toContain('onRename: async (path, newName)');
  });
  it('onRename checks the role first, before it reads or writes anything', () => {
    const b = handler();
    expect(b.indexOf("can(S.role, 'media:rename')")).toBeGreaterThan(-1);
    expect(b.indexOf("can(S.role, 'media:rename')")).toBeLessThan(b.indexOf('S.gh.tree()'));
    expect(b.indexOf("can(S.role, 'media:rename')")).toBeLessThan(b.indexOf('commitFiles'));
  });
  it('everything is read again, and the rules run before the commit', () => {
    const b = handler();
    expect(b).toContain('S.posts = null');
    expect(b.indexOf('planFileRename(')).toBeGreaterThan(b.indexOf('S.gh.tree()'));
    expect(b.indexOf('planFileRename(')).toBeLessThan(b.indexOf('commitFiles'));
    expect(b).toContain('otherItems()');
    expect(b).toContain('contentItems(posts)');
  });
  it('one commit moves the bytes, deletes the old path and writes the text files', () => {
    const b = handler();
    expect((b.match(/commitFiles\(/g) || []).length).toBe(1);
    expect(b).toContain('{ path: plan.moves[0].to, bytes }');
    expect(b).toContain('{ path: plan.moves[0].from, delete: true }');
    expect(b).toContain('...plan.files');
    expect(b).toContain('admin: rename file');
  });
  it('a file that is gone is reported, not created', () => {
    expect(handler()).toContain('That file is already gone');
  });
});

// The whole path with the real app.js and a fake GitHub that understands the Git Data API.
describe('the real dashboard: Rename in the Files screen', () => {
  const OLD = '/media/2026/11/img-5678.webp';
  const NEW = '/media/2026/11/city-hall-vote.webp';
  const bytes = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)), new Array(40).fill(7)));
  const post = stringify({ title: 'A story about the council vote', permalink: 'council-vote', category: 'news', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: OLD, imageAlt: 'alt', status: 'published', redirects: [] }, `## Body\ntext ${OLD}.`);
  let files: Record<string, string | Uint8Array> = {};
  let treeBodies: any[] = []; let commits: any[] = []; let patches = 0; let blobPosts = 0;

  function api(url: string, init: any = {}) {
    const u = new URL(url, 'http://localhost');
    const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
    const p = u.pathname;
    if (p === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
    if (p === '/user') return json({ login: 'owner' });
    if (p === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
    if (p.startsWith('/repos/o/r/git/trees') && init.method === 'POST') { treeBodies.push(JSON.parse(init.body)); return json({ sha: 'tree-new' }); }
    if (p.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((x) => ({ path: x, type: 'blob', sha: 'sha-' + x + '#' + (files[x] as any).length, size: (files[x] as any).length })) });
    if (p === '/repos/o/r/git/blobs' && init.method === 'POST') { blobPosts++; return json({ sha: 'blob-new' }); }
    if (p.startsWith('/repos/o/r/git/blobs/')) { const x = decodeURIComponent(p.split('/blobs/sha-')[1]).split('#')[0]; return json({ content: toBase64(files[x]) }); }
    if (p.startsWith('/repos/o/r/git/ref/')) return json({ object: { sha: 'c0' } });
    if (p === '/repos/o/r/git/commits/c0') return json({ tree: { sha: 'tree0' } });
    if (p === '/repos/o/r/git/commits' && init.method === 'POST') { commits.push(JSON.parse(init.body)); return json({ sha: 'c1' }); }
    if (p.startsWith('/repos/o/r/git/refs/') && init.method === 'PATCH') { patches++; return json({}); }
    if (p.startsWith('/repos/o/r/contents/')) { const x = decodeURIComponent(p.replace('/repos/o/r/contents/', '')); return files[x] !== undefined ? json({ content: toBase64(files[x]), sha: 'sha-' + x }) : json({ message: 'Not Found' }, 404); }
    return json({ message: 'unhandled ' + p }, 500);
  }
  const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

  async function open() {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    (URL as any).createObjectURL = () => 'blob:preview';
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    await tick(200);
    location.hash = '#/files'; await tick(300);
    (document.querySelector('[data-f="tile"]') as HTMLElement).click(); await tick(50);
  }
  const rename = async (name: string) => {
    const i = document.querySelector('[data-f="rename-input"]') as HTMLInputElement; i.value = name;
    (document.querySelector('[data-f="rename-go"]') as HTMLElement).click(); await tick(20);
    (document.querySelector('[data-f="rename-yes"]') as HTMLElement)?.click(); await tick(400);
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'; sessionStorage.setItem('adm.token', 'tok'); location.hash = '';
    treeBodies = []; commits = []; patches = 0; blobPosts = 0;
    files = {
      'site/content/blogs/news/council-vote.md': post,
      'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
      'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
      'site/config/redirects.json': '[]\n',
      'site/config/media.json': JSON.stringify({ [OLD]: { alt: 'Council votes' } }, null, 2) + '\n',
      ['site/public' + OLD]: bytes,
    };
  });

  it('renames in ONE commit: bytes to the new path, old path deleted, post updated, one 301, alt text moved', async () => {
    await open(); await rename('city-hall-vote');
    expect(treeBodies).toHaveLength(1);
    expect(commits).toHaveLength(1);
    expect(patches).toBe(1);
    expect(blobPosts).toBe(1);
    expect(commits[0].message).toBe('admin: rename file img-5678.webp to city-hall-vote.webp');
    const t = treeBodies[0].tree as any[];
    const by = (p: string) => t.find((e) => e.path === p);
    expect(by('site/public' + NEW)).toMatchObject({ sha: 'blob-new' });
    expect(by('site/public' + OLD)).toMatchObject({ sha: null });
    expect(by('site/content/blogs/news/council-vote.md').content).toContain(`image: "${NEW}"`);
    expect(by('site/content/blogs/news/council-vote.md').content).toContain(`text ${NEW}.`);
    expect(by('site/content/blogs/news/council-vote.md').content).not.toContain('img-5678');
    expect(JSON.parse(by('site/config/redirects.json').content)).toEqual([{ from: OLD, to: NEW }]);
    expect(JSON.parse(by('site/config/media.json').content)).toEqual({ [NEW]: { alt: 'Council votes' } });
    expect(t).toHaveLength(5);
    expect(document.querySelector('[data-f="renamed"]')!.textContent).toContain('city-hall-vote.webp');
  });
  it('a refused name sends nothing at all', async () => {
    await open(); await rename('Big Name');
    expect(treeBodies).toHaveLength(0); expect(commits).toHaveLength(0); expect(patches).toBe(0);
    expect(document.querySelector('[data-f="rename-error"]')).toBeTruthy();
  });
  it('a post that names a longer file is left alone', async () => {
    files['site/content/blogs/news/council-vote.md'] = post + `\nAlso ${OLD}.bak and ${OLD}-large`;
    await open(); await rename('city-hall-vote');
    const t = treeBodies[0].tree as any[];
    const text = t.find((e) => e.path === 'site/content/blogs/news/council-vote.md').content;
    expect(text).toContain(`${OLD}.bak`); expect(text).toContain(`${OLD}-large`);
  });
  it('a file already renamed by someone else is reported and nothing is committed', async () => {
    await open();
    delete files['site/public' + OLD];
    await rename('city-hall-vote');
    expect(commits).toHaveLength(0);
    expect(document.querySelector('[data-f="rename-error"]')!.textContent).toContain('already gone');
  });
  it('when the branch moved meanwhile nothing changes and the message is shown', async () => {
    const real = api;
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => (String(u).includes('/git/refs/') && i && i.method === 'PATCH' ? Promise.resolve(new Response(JSON.stringify({ message: 'Update is not a fast forward' }), { status: 422 })) : real(String(u), i))));
    (URL as any).createObjectURL = () => 'blob:preview';
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!); await tick(200);
    location.hash = '#/files'; await tick(300);
    (document.querySelector('[data-f="tile"]') as HTMLElement).click(); await tick(50);
    await rename('city-hall-vote');
    expect(document.querySelector('[data-f="rename-error"]')!.textContent).toContain('Someone else saved');
    expect(document.querySelector('[data-f="renamed"]')).toBeFalsy();
  });
  it('Part 4c-4c: a picture with two smaller copies moves them in the SAME commit, with a 301 for each and a message that counts them', async () => {
    const O480 = OLD.replace('.webp', '.480w.webp'); const O800 = OLD.replace('.webp', '.800w.webp');
    files['site/public' + O480] = bytes; files['site/public' + O800] = bytes;
    files['site/config/media.json'] = JSON.stringify({ [OLD]: { alt: 'Council votes', variants: [480, 800] } }, null, 2) + '\n';
    await open(); await rename('city-hall-vote');
    expect(commits).toHaveLength(1); expect(patches).toBe(1); expect(blobPosts).toBe(3);
    expect(commits[0].message).toBe('admin: rename file img-5678.webp to city-hall-vote.webp and 2 smaller copies');
    const t = treeBodies[0].tree as any[];
    const by = (x: string) => t.find((e) => e.path === x);
    for (const w of ['480', '800']) {
      expect(by('site/public' + NEW.replace('.webp', `.${w}w.webp`))).toMatchObject({ sha: 'blob-new' });
      expect(by('site/public' + OLD.replace('.webp', `.${w}w.webp`))).toMatchObject({ sha: null });
    }
    expect(JSON.parse(by('site/config/redirects.json').content)).toEqual([
      { from: OLD, to: NEW }, { from: O480, to: NEW.replace('.webp', '.480w.webp') }, { from: O800, to: NEW.replace('.webp', '.800w.webp') },
    ]);
    expect(JSON.parse(by('site/config/media.json').content)).toEqual({ [NEW]: { alt: 'Council votes', variants: [480, 800] } });
    expect(document.querySelector('[data-f="renamed"]')!.textContent).toContain('and its 2 smaller copies');
  });
});
