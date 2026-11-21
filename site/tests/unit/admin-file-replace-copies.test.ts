// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { toBase64 } from '../../public/admin/js/github.js';
// @ts-ignore
import { stringify } from '../../public/admin/js/frontmatter.js';

// Phase 3c Part 4c-4d (v0.101.64): replacing a picture that has smaller copies removes the copies and the `variants` note in the SAME commit.

describe('the real dashboard: Replace in the Files screen (Part 4c-4d)', () => {
  const OLD = '/media/2026/11/img-5678.webp';
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

  const O480 = OLD.replace('.webp', '.480w.webp'); const O800 = OLD.replace('.webp', '.800w.webp');
  const NEWBYTES = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)), new Array(60).fill(9)));
  const replace = async () => {
    const input = document.querySelector('[data-f="replace-input"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ name: 'fresh.webp', arrayBuffer: async () => NEWBYTES.buffer.slice(0) }], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true })); await tick(50);
    (document.querySelector('[data-f="replace-yes"]') as HTMLElement)?.click(); await tick(400);
  };

  it('a picture with two copies: ONE commit writes the new bytes, deletes both copies and drops the variants note', async () => {
    files['site/public' + O480] = bytes; files['site/public' + O800] = bytes;
    files['site/config/media.json'] = JSON.stringify({ [OLD]: { alt: 'Council votes', variants: [480, 800] } }, null, 2) + '\n';
    await open(); await replace();
    expect(commits).toHaveLength(1); expect(patches).toBe(1);
    expect(commits[0].message).toBe('admin: replace file img-5678.webp and remove 2 old smaller copies');
    const t = treeBodies[0].tree as any[];
    const by = (x: string) => t.find((e) => e.path === x);
    expect(by('site/public' + OLD)).toMatchObject({ sha: 'blob-new' });
    expect(by('site/public' + O480)).toMatchObject({ sha: null });
    expect(by('site/public' + O800)).toMatchObject({ sha: null });
    expect(JSON.parse(by('site/config/media.json').content)).toEqual({ [OLD]: { alt: 'Council votes' } });
    expect(document.querySelector('[data-f="replaced"]')!.textContent).toContain('and removed its 2 old smaller copies');
  });
  it('a picture without copies: one new file in the commit, no delete, no media.json write, the old message', async () => {
    await open(); await replace();
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe('admin: replace file img-5678.webp');
    const t = treeBodies[0].tree as any[];
    expect(t).toHaveLength(1);
    expect(t[0].path).toBe('site/public' + OLD);
  });
  it('a copy of ANOTHER picture is never deleted', async () => {
    const OTHER = '/media/2026/10/senate-hearing.480w.webp';
    // the other picture comes first in the list, so the grid (newest last in the list, shown first) opens the picture under test
    files = { ['site/public/media/2026/10/senate-hearing.webp']: bytes, ['site/public' + OTHER]: bytes, ...files, ['site/public' + O480]: bytes };
    await open(); await replace();
    const t = treeBodies[0].tree as any[];
    expect(t.find((e) => e.path === 'site/public' + OTHER)).toBeUndefined();
    expect(t.find((e) => e.path === 'site/public' + O480)).toMatchObject({ sha: null });
    expect(t.find((e) => e.path === 'site/public' + OLD)).toMatchObject({ sha: 'blob-new' });
  });
});
