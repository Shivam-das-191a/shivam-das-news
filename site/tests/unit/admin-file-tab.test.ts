// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';

const PATH = 'site/content/blogs/technology/older-story.md';
const base = { title: 'An older story about phones', permalink: 'older-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(60), image: '/media/a.webp', imageAlt: 'alt', status: 'published', redirects: [] };
const draft = { ...base, status: 'draft', permalink: 'a-draft', title: 'A draft story' };
const mk = (): Record<string, string> => ({
  [PATH]: stringify(base, '## Body\ntext'),
  'site/content/blogs/technology/a-draft.md': stringify(draft, '## Body\ntext'),
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
});
let files = mk();
let roles: Record<string, string> = {};
const puts: { path: string; body: any }[] = [];

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles });
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
const raw = () => find('textarea[data-file="text"]') as HTMLTextAreaElement;
const typeRaw = (v: string) => { raw().value = v; raw().dispatchEvent(new Event('input', { bubbles: true })); };
const saveBtn = () => find('button[data-file="save"]') as HTMLButtonElement | null;

async function open(path: string) {
  vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
  vi.stubGlobal('confirm', () => true);
  const { boot } = await import('../../public/admin/js/app.js');
  await boot(document.getElementById('app')!);
  await tick(200);
  location.hash = '#/post/' + encodeURIComponent(path);
  await tick(300);
}

describe('File tab in the post editor (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; files = mk(); roles = {}; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });

  it('has a Form tab and a File tab, the form first', async () => {
    await open(PATH);
    expect(find('button[data-tab="form"]').getAttribute('aria-pressed')).toBe('true');
    expect(find('button[data-tab="file"]').getAttribute('aria-pressed')).toBe('false');
    expect((find('[data-tab-panel="file"]') as HTMLElement).hidden).toBe(true);
    expect((find('[data-tab-panel="form"]') as HTMLElement).hidden).toBe(false);
  });

  it('the File button shows the raw file and hides the form', async () => {
    await open(PATH);
    find('button[data-tab="file"]').click();
    expect((find('[data-tab-panel="file"]') as HTMLElement).hidden).toBe(false);
    expect((find('[data-tab-panel="form"]') as HTMLElement).hidden).toBe(true);
    expect(raw().value).toMatch(/^---\ntitle: "An older story about phones"/);
    expect(raw().value).toContain('## Body\ntext');
    find('button[data-tab="form"]').click();
    expect((find('[data-tab-panel="form"]') as HTMLElement).hidden).toBe(false);
  });

  it('an admin can type in the file and Save file starts off', async () => {
    await open(PATH);
    expect(raw().hasAttribute('readonly')).toBe(false);
    expect(saveBtn()!.disabled).toBe(true);
    typeRaw(raw().value + '\nmore text');
    expect(saveBtn()!.disabled).toBe(false);
    typeRaw(stringify(base, '## Body\ntext'));
    expect(saveBtn()!.disabled).toBe(true);
  });

  it('a writer sees the file read-only with no Save file button', async () => {
    roles = { owner: 'author' };
    await open('site/content/blogs/technology/a-draft.md');
    expect(raw().hasAttribute('readonly')).toBe(true);
    expect(saveBtn()).toBeNull();
    expect(document.body.textContent).toContain('read-only for your role');
  });

  it('an editor sees the file read-only too', async () => {
    roles = { owner: 'editor' };
    await open(PATH);
    expect(raw().hasAttribute('readonly')).toBe(true);
    expect(saveBtn()).toBeNull();
  });

  it('a new post shows the file but cannot save it', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/new';
    await tick(300);
    expect(raw().hasAttribute('readonly')).toBe(true);
    expect(saveBtn()).toBeNull();
    expect(document.body.textContent).toContain('Save the post from the form first');
  });

  it('saves a good change as one commit on the same file with the old sha', async () => {
    await open(PATH);
    typeRaw(stringify({ ...base, description: 'y'.repeat(70) }, '## Body\nchanged text'));
    saveBtn()!.click();
    await tick(400);
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe(PATH);
    expect(puts[0].body.sha).toBe('sha-' + PATH);
    expect(puts[0].body.message).toBe('admin: edit file: older-story');
    const saved = decodeText(puts[0].body.content);
    expect(saved).toContain('changed text');
    expect(saved).toContain('y'.repeat(70));
  });

  it('writes the file in the clean order, not the order that was typed', async () => {
    await open(PATH);
    typeRaw(`---\nstatus: "published"\ntitle: "An older story about phones"\npermalink: "older-story"\ncategory: "technology"\ndate: 2026-11-12T09:00:00Z\nauthor: "shivam-das"\ndescription: "${'z'.repeat(60)}"\nimage: "/media/a.webp"\nimageAlt: "alt"\n---\n## Body\ntext\n`);
    saveBtn()!.click();
    await tick(400);
    expect(decodeText(puts[0].body.content)).toMatch(/^---\ntitle: "An older story about phones"\npermalink:/);
  });

  it('refuses a file with no front matter and sends nothing', async () => {
    await open(PATH);
    typeRaw('just some text');
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(find('[data-file="msg"]').textContent).toContain('start with a line of three dashes');
  });

  it('refuses a new handle on a live post and sends nothing', async () => {
    await open(PATH);
    typeRaw(stringify({ ...base, permalink: 'renamed' }, '## Body\ntext'));
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(find('[data-file="msg"]').textContent).toContain('handle of a live post');
  });

  it('runs the same content check as the form (a description over 160 characters is refused)', async () => {
    await open(PATH);
    typeRaw(stringify({ ...base, description: 'd'.repeat(161) }, '## Body\ntext'));
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(find('[data-file="msg"]').textContent).toContain('Meta description is over 160 characters');
  });

  it('refuses a notification text with an emoji, like the form', async () => {
    await open(PATH);
    typeRaw(stringify({ ...base, pushTitle: 'Big news \u{1F600}' }, '## Body\ntext'));
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(find('[data-file="msg"]').textContent).toContain('must not contain emoji');
  });

  it('refuses a handle that another post already uses', async () => {
    await open('site/content/blogs/technology/a-draft.md');
    typeRaw(stringify({ ...draft, permalink: 'older-story' }, '## Body\ntext'));
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
  });

  it('refuses to save while the form has unsaved changes', async () => {
    await open(PATH);
    const t = find('input[placeholder^="Headline"]') as HTMLInputElement;
    t.value = 'A changed headline'; t.dispatchEvent(new Event('input', { bubbles: true }));
    typeRaw(stringify({ ...base, description: 'q'.repeat(70) }, '## Body\ntext'));
    saveBtn()!.click();
    await tick(200);
    expect(puts).toHaveLength(0);
    expect(find('[data-file="msg"]').textContent).toContain('not saved');
  });

  it('checks the role again at save: a role that lost the right sends nothing', async () => {
    await open(PATH);
    typeRaw(stringify({ ...base, description: 'w'.repeat(70) }, '## Body\ntext'));
    // the same screen, but the person is an editor by the time of the click
    roles = { owner: 'editor' };
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    await tick(300);
    location.hash = '#/post/' + encodeURIComponent(PATH);
    await tick(300);
    expect(saveBtn()).toBeNull();
    expect(puts).toHaveLength(0);
  });

  it('the form buttons still save as before (no change to Update post)', async () => {
    await open(PATH);
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent!.trim() === 'Update post') as HTMLElement;
    expect(b).toBeTruthy();
    b.click();
    await tick(400);
    expect(puts).toHaveLength(1);
    expect(puts[0].body.message).toBe('admin: publish: older-story');
  });
});
