// @vitest-environment jsdom
// Phase 3c Part 3c-8c-2 (v0.101.55): the hook in save() of the editor (app.js), tested in the browser model with a fake GitHub and a fake picture service.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';

vi.mock('../../public/admin/js/image.js', async (orig) => ({
  ...(await orig<any>()),
  prepareImage: vi.fn(async () => ({ bytes: Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4, 5, 6, 7, 8]), ext: 'webp', width: 1600, height: 900 })),
}));

const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const OUTSIDE = 'https://other.com/a.jpg';
let imagesUrl = EP;
let workerMode: 'ok' | 'fail' = 'ok';
let failTree = false;
const failUrls = new Set<string>();
const OUTSIDE2 = 'https://other.com/b.jpg';
const files: Record<string, string> = {};
const puts: { path: string; body: any }[] = [];
const commits: { message: string; tree: any[] }[] = [];
const workerCalls: string[][] = [];
const seen: string[] = [];

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  seen.push(String(init.body || '') + ' ' + u.pathname);
  if (u.origin === EP) {
    const urls = JSON.parse(init.body).urls as string[];
    workerCalls.push(urls);
    return json({ results: urls.map((x) => (workerMode === 'ok' && !failUrls.has(x) ? { url: x, ok: true, kind: 'jpg', data: btoa('abcdefghij'), size: 10 } : { url: x, ok: false, reason: 'network' })) });
  }
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {}, ...(imagesUrl ? { imagesUrl } : {}) });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees') && init.method === 'POST') {
    if (failTree) return json({ message: 'boom ' + TOKEN }, 500);
    const tree = JSON.parse(init.body).tree;
    for (const e of tree) if (typeof e.content === 'string') files[e.path] = e.content;
    commits.push({ message: '', tree });
    return json({ sha: 'T2' });
  }
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname === '/repos/o/r/git/ref/heads/main') return json({ object: { sha: 'P1' } });
  if (u.pathname === '/repos/o/r/git/commits/P1') return json({ tree: { sha: 'T1' } });
  if (u.pathname === '/repos/o/r/git/blobs' && init.method === 'POST') return json({ sha: 'B' + commits.length });
  if (u.pathname === '/repos/o/r/git/commits' && init.method === 'POST') { commits[commits.length - 1].message = JSON.parse(init.body).message; return json({ sha: 'C2' }); }
  if (u.pathname === '/repos/o/r/git/refs/heads/main' && init.method === 'PATCH') return json({});
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') {
    const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
    const body = JSON.parse(init.body); puts.push({ path, body });
    files[path] = decodeText(body.content);
    return json({ content: { sha: 'new-sha' } });
  }
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] !== undefined ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const find = (sel: string) => document.querySelector(sel) as HTMLElement;
const byText = (tag: string, text: string) => [...document.querySelectorAll(tag)].find((e) => e.textContent!.trim() === text) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const toasts = () => document.body.textContent || '';

async function openNewPost(body: string) {
  vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
  vi.stubGlobal('confirm', () => true);
  const { boot } = await import('../../public/admin/js/app.js');
  await boot(document.getElementById('app')!);
  await tick(200);
  location.hash = '#/post/new';
  await tick(200);
  type(find('input[placeholder^="Headline"]'), 'Phone launch in Delhi today');
  type(find('input[placeholder="technology"]'), 'technology');
  type(find('textarea[maxlength="200"]'), 'The new phone launched today with a faster chip, a brighter screen and a lower price for buyers in India.');
  type(find('textarea.body'), body);
  await tick(500);
}

describe('the pictures hook in the editor Save (app.js)', () => {
  beforeEach(() => {
    vi.resetModules(); localStorage.clear(); sessionStorage.clear(); document.querySelectorAll('.toast').forEach((e) => e.remove());
    document.body.innerHTML = '<div id="app"></div>';
    sessionStorage.setItem('adm.token', TOKEN); location.hash = '';
    puts.length = 0; commits.length = 0; workerCalls.length = 0; seen.length = 0;
    imagesUrl = EP; workerMode = 'ok'; failTree = false; failUrls.clear();
    for (const k of Object.keys(files)) delete files[k];
    files['site/content/authors/shivam-das.json'] = JSON.stringify({ name: 'Shivam Das', bio: '' });
    files['site/config/site.json'] = JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' });
  });

  it('OFF (no imagesUrl): Save works as before, no call to the picture service, one normal write', async () => {
    imagesUrl = '';
    await openNewPost(`## Details\n![One](${OUTSIDE})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(400);
    expect(workerCalls).toHaveLength(0);
    expect(commits).toHaveLength(0);
    expect(puts).toHaveLength(1);
    expect(decodeText(puts[0].body.content)).toContain(OUTSIDE);
  });

  it('ON, no outside picture: no call to the picture service, one normal write', async () => {
    await openNewPost('## Details\n' + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(400);
    expect(workerCalls).toHaveLength(0);
    expect(commits).toHaveLength(0);
    expect(puts).toHaveLength(1);
  });

  it('ON, one outside picture: ONE commit with the post and the picture, NO second write of the post, and the editor shows the new address', async () => {
    await openNewPost(`## Details\n![One](${OUTSIDE})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(900);
    expect(workerCalls).toEqual([[OUTSIDE]]);
    expect(commits).toHaveLength(1);
    expect(puts).toHaveLength(0);
    const paths = commits[0].tree.map((e: any) => e.path);
    const postPath = paths.find((p: string) => p.startsWith('site/content/blogs/technology/') && p.endsWith('.md'));
    expect(postPath).toBeTruthy();
    expect(paths).toContain('site/config/media.json');
    expect(paths.some((p: string) => p.startsWith('site/public/media/'))).toBe(true);
    const post = commits[0].tree.find((e: any) => e.path === postPath).content as string;
    expect(post).toContain('/media/');
    expect(post).not.toContain(OUTSIDE);
    const ta = find('textarea.body') as HTMLTextAreaElement;
    expect(ta.value).toContain('/media/');
    expect(ta.value).not.toContain(OUTSIDE);
    expect(toasts()).not.toContain(TOKEN);
  });

  it('ON, the commit fails: Save stops, nothing is written by the normal Save, and no token is shown', async () => {
    failTree = true;
    await openNewPost(`## Details\n![One](${OUTSIDE})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(900);
    expect(puts).toHaveLength(0);
    expect(commits).toHaveLength(0);
    expect(toasts()).toContain('the post was not saved');
    expect(toasts()).not.toContain(TOKEN);
    expect(find('[data-hosting="box"]').hasChildNodes()).toBe(true);
    expect((find('textarea.body') as HTMLTextAreaElement).value).toContain(OUTSIDE);
  });

  it('ON, every picture fails: the normal Save still writes the post once and the list stays for Retry', async () => {
    workerMode = 'fail';
    await openNewPost(`## Details\n![One](${OUTSIDE})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(900);
    expect(commits).toHaveLength(0);
    expect(puts).toHaveLength(1);
    expect(location.hash).toBe('#/post/new');
    expect(find('[data-hosting="box"]').hasChildNodes()).toBe(true);
  });

  it('Retry after a failed picture: one commit, the editor shows the new address, the list goes and the next Save does not clash', async () => {
    workerMode = 'fail';
    await openNewPost(`## Details\n![One](${OUTSIDE})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(900);
    expect(puts).toHaveLength(1);
    workerMode = 'ok';
    const retry = [...find('[data-hosting="box"]').querySelectorAll('button')].find((b) => b.textContent!.trim().startsWith('Retry')) as HTMLElement;
    expect(retry).toBeTruthy();
    retry.click();
    await tick(1200);
    expect(commits).toHaveLength(1);
    expect(puts).toHaveLength(1);
    expect(find('[data-hosting="box"]').hasChildNodes()).toBe(false);
    expect((find('textarea.body') as HTMLTextAreaElement).value).toContain('/media/');
    expect(toasts()).not.toContain(TOKEN);
  });

  it('one picture works and one fails: ONE commit, the editor shows the new address of the first and keeps the second, the list stays, and the next Save uses the fresh file address', async () => {
    failUrls.add(OUTSIDE2);
    await openNewPost(`## Details\n![One](${OUTSIDE})\n![Two](${OUTSIDE2})\n` + 'word '.repeat(120));
    byText('button', 'Save draft').click();
    await tick(1200);
    expect(commits).toHaveLength(1);
    expect(puts).toHaveLength(0);
    const ta = find('textarea.body') as HTMLTextAreaElement;
    expect(ta.value).toContain('/media/');
    expect(ta.value).not.toContain(OUTSIDE + ')');
    expect(ta.value).toContain(OUTSIDE2);
    expect(location.hash).toBe('#/post/new');
    expect(find('[data-hosting="box"]').hasChildNodes()).toBe(true);
    byText('button', 'Save draft').click();
    await tick(1200);
    expect(puts).toHaveLength(1);
    expect(puts[0].body.sha).toMatch(/^sha-site\/content\/blogs\/technology\//);
  });
});

describe('the wiring in app.js (text)', () => {
  it('app.js imports only runHostingSave and freshOrig, and the box sits in the form', async () => {
    const { readFileSync } = await import('node:fs');
    const s = readFileSync('public/admin/js/app.js', 'utf8');
    expect(s).toContain("import { runHostingSave, freshOrig } from './hosting-hook.js';");
    expect(s).toContain("data-hosting");
    expect(s.match(/runHostingSave\(/g)).toHaveLength(1);
    expect(s).toContain('canEdit: !readOnly');
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
