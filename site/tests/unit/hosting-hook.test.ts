// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { runHostingSave, hostingOutcome, editorFieldsFrom, openCount, origFrom, freshOrig, STOP_MESSAGE } from '../../public/admin/js/hosting-hook.js';
// @ts-ignore
import { parse } from '../../public/admin/js/frontmatter.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];

const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const A = 'https://other.com/a.jpg';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const jpeg = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(tag)]);
const optimizeDeps = { prepare: vi.fn(async () => ({ bytes: jpeg(9).slice(0, 20), width: 1600, height: 900, ext: 'webp' })) };
const mkNext = (extra: any = {}) => ({ title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], robots: 'index,follow', canonical: '', ...extra });

/** A fake picture service (through the Worker call) and a fake GitHub. `table` can change between runs. */
function world(table: Record<string, Uint8Array | string> = {}, opts: { failCommit?: boolean } = {}) {
  const fetchFn = vi.fn(async (_url: string, init: any) => {
    const urls = JSON.parse(init.body).urls as string[];
    return new Response(JSON.stringify({ results: urls.map((u) => { const v = table[u]; if (v === undefined) return { url: u, ok: false, reason: 'network' }; if (typeof v === 'string') return { url: u, ok: false, reason: v }; return { url: u, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...v)), size: v.length }; }) }));
  });
  let media = '{}';
  const commits: { files: any[]; message: string }[] = [];
  const gh: any = {
    token: TOKEN,
    getText: vi.fn(async (path: string) => { if (path === 'site/config/media.json') return { text: media, sha: 's' }; if (path === NEW_PATH) return { text: 'x', sha: 'FILE-SHA' }; const e: any = new Error('not found'); e.status = 404; throw e; }),
    commitFiles: vi.fn(async (files: any[], message: string) => {
      if (opts.failCommit) throw new Error(`GitHub 500: boom ${TOKEN}`);
      commits.push({ files, message });
      const m = files.find((f: any) => f.path === 'site/config/media.json'); if (m) media = m.text;
      return 'C-' + commits.length;
    }),
  };
  return { fetchFn, gh, commits, table };
}
const run = (w: any, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next: mkNext(), body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps, ...o });
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('editorFieldsFrom', () => {
  it('keeps only the four fields and only when they are text', () => {
    expect(editorFieldsFrom({ body: 'b', image: '/media/a.webp', imageAlt: 'x', ogImage: '', title: 'T', handle: 'h', date: 'd' })).toEqual({ body: 'b', image: '/media/a.webp', imageAlt: 'x', ogImage: '' });
    expect(editorFieldsFrom({ body: 5, image: null, imageAlt: undefined, ogImage: {} })).toEqual({});
  });
  it('never throws and gives an empty object for anything that is not an object', () => {
    for (const bad of [undefined, null, 5, 'x', []]) expect(editorFieldsFrom(bad as any)).toEqual({});
  });
});

describe('openCount', () => {
  it('counts the rows that still offer retry, confirm or replace', () => {
    const list = { rows: [{ action: 'none' }, { action: 'retry' }, { action: 'confirm' }, { action: 'replace' }, { action: 'other' }, null, 5] };
    expect(openCount(list)).toBe(3);
  });
  it('gives 0 for a list with no rows and for bad input', () => {
    for (const bad of [undefined, null, 5, 'x', {}, { rows: 'x' }, { rows: [] }]) expect(openCount(bad as any)).toBe(0);
  });
});

describe('hostingOutcome', () => {
  it('a Save that hosting does not touch goes on as before, with no message', () => {
    for (const reason of ['off', 'archived', 'no_pictures']) expect(hostingOutcome({ use: false, reason, message: 'ignored' }, null)).toEqual({ action: 'normal', reason, message: '' });
  });
  it('a setup problem or a moved post goes on as before, with its plain sentence', () => {
    expect(hostingOutcome({ use: false, reason: 'setup', message: 'There is no connection to GitHub.' }, null)).toMatchObject({ action: 'normal', message: 'There is no connection to GitHub.' });
    expect(hostingOutcome({ use: false, reason: 'moved', message: 'Save again after the move.' }, null)).toMatchObject({ action: 'normal', message: 'Save again after the move.' });
  });
  it('a first run that failed stops the Save', () => {
    expect(hostingOutcome({ use: true }, null)).toEqual({ action: 'stop', reason: 'error', message: STOP_MESSAGE });
  });
  it('saved means the flow already wrote the post, and says how many pictures still need the writer', () => {
    const r = hostingOutcome({ use: true }, { status: 'saved', message: 'Saved in one commit.', list: { rows: [{ action: 'none' }, { action: 'retry' }] } });
    expect(r).toEqual({ action: 'saved', reason: 'saved', open: 1, message: 'Saved in one commit.' });
  });
  it('nothing to change lets the normal Save write the post', () => {
    expect(hostingOutcome({ use: true }, { status: 'nothing', message: 'Nothing to save. 1 failed.' })).toEqual({ action: 'normal', reason: 'nothing', message: 'Nothing to save. 1 failed.' });
  });
  it('error, preview and unknown statuses stop the Save', () => {
    for (const status of ['error', 'preview', 'weird', undefined]) expect(hostingOutcome({ use: true }, { status })).toMatchObject({ action: 'stop', message: STOP_MESSAGE });
  });
  it('garbage never throws and never writes: it goes on as before', () => {
    for (const bad of [undefined, null, 5, 'x', []]) expect(hostingOutcome(bad as any, bad as any)).toMatchObject({ action: 'normal' });
  });
});

describe('runHostingSave: when hosting does not apply', () => {
  it('off: no Worker call, no commit, no list, Save goes on as before', async () => {
    const w = world(); const mount = vi.fn();
    const r = await run(w, { cfg: { ...CFG, imagesUrl: '' }, mount });
    expect(r).toMatchObject({ action: 'normal', reason: 'off', message: '' });
    expect(w.fetchFn).not.toHaveBeenCalled(); expect(w.gh.commitFiles).not.toHaveBeenCalled(); expect(mount).not.toHaveBeenCalled();
  });
  it('a post with no outside picture does not call the Worker', async () => {
    const w = world();
    const r = await run(w, { body: 'Only text and ![own](/media/2026/11/a.webp)' });
    expect(r).toMatchObject({ action: 'normal', reason: 'no_pictures' });
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('an archived post is not hosted', async () => {
    const w = world({ [A]: jpeg(1) });
    expect(await run(w, { next: mkNext({ status: 'archived' }) })).toMatchObject({ action: 'normal', reason: 'archived' });
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('a post that moves to a new address goes on as before and says why', async () => {
    const w = world({ [A]: jpeg(1) });
    const r = await run(w, { orig: { path: 'site/content/blogs/old/phone-launch.md', sha: 'x' } });
    expect(r).toMatchObject({ action: 'normal', reason: 'moved' });
    expect(r.message).toMatch(/Save again/);
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('a setup problem gives one plain sentence without the token or the service address', async () => {
    const r = await run(world(), { cfg: { ...CFG, imagesUrl: 'http://secret-host.example' }, gh: null });
    expect(r.action).toBe('normal');
    expect(JSON.stringify(r)).not.toMatch(/secret-host|ghp_/);
  });
});

describe('runHostingSave: one picture is hosted', () => {
  it('makes ONE commit with the post, tells the editor the new addresses and shows the list', async () => {
    const w = world({ [A]: jpeg(1) });
    const mount = vi.fn(); const onSaved = vi.fn();
    const r = await run(w, { mount, onSaved });
    expect(r).toMatchObject({ action: 'saved', reason: 'saved', open: 0 });
    expect(w.commits).toHaveLength(1);
    const post = w.commits[0].files.find((f: any) => f.path === NEW_PATH);
    expect(post).toBeTruthy();
    const saved = parse(post.text);
    expect(saved.body).not.toContain(A);
    expect(saved.body).toMatch(/\/media\//);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
    expect(onSaved).toHaveBeenCalledTimes(1);
    const arg = onSaved.mock.calls[0][0];
    expect(arg.fields.body.trim()).toBe(saved.body.trim());
    expect(arg.open).toBe(0);
    expect(r.flow).toBeTruthy();
  });
  it('keeps every other field of the editor in the saved file', async () => {
    const w = world({ [A]: jpeg(1) });
    await run(w, { next: mkNext({ tags: ['phones', 'delhi'], description: 'Keep this text.' }) });
    const saved = parse(w.commits[0].files.find((f: any) => f.path === NEW_PATH).text);
    expect(saved.data.tags).toEqual(['phones', 'delhi']);
    expect(saved.data.description).toBe('Keep this text.');
    expect(saved.data.status).toBe('draft');
  });
  it('never changes the editor next or orig, and puts no token or address in the answer', async () => {
    const w = world({ [A]: jpeg(1) });
    const next = mkNext(); const orig = { path: NEW_PATH, sha: 'old', permalink: 'phone-launch' };
    const n0 = JSON.stringify(next), o0 = JSON.stringify(orig);
    const r = await run(w, { next, orig });
    expect(JSON.stringify(next)).toBe(n0); expect(JSON.stringify(orig)).toBe(o0);
    expect(JSON.stringify({ ...r, flow: undefined })).not.toMatch(/ghp_|workers\.dev/);
  });
  it('a mount or an onSaved that throws can not undo the save', async () => {
    const w = world({ [A]: jpeg(1) });
    const r = await run(w, { mount: () => { throw new Error('mount'); }, onSaved: () => { throw new Error('cb'); } });
    expect(r.action).toBe('saved');
    expect(w.commits).toHaveLength(1);
  });
});

describe('runHostingSave: a picture that fails', () => {
  it('when nothing can be saved the normal Save goes on, the list stays, and no commit was made', async () => {
    const w = world({});
    const mount = vi.fn();
    const r = await run(w, { mount });
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('nothing');
    expect(w.commits).toHaveLength(0);
    expect(mount).toHaveBeenCalledTimes(1);
  });
  it('a later Retry that works tells the editor through onSaved', async () => {
    const w = world({});
    const mount = vi.fn(); const onSaved = vi.fn();
    const r = await run(w, { mount, onSaved, canEdit: true });
    expect(onSaved).not.toHaveBeenCalled();
    w.table[A] = jpeg(2);
    const el = mount.mock.calls[0][0] as HTMLElement;
    const retry = qa(el, 'retry-all')[0] || [...el.querySelectorAll('button')].find((b) => /retry/i.test(b.textContent || ''));
    if (!retry) throw new Error('no retry button: ' + el.innerHTML.slice(0, 300));
    retry.click();
    await tick(120);
    expect(r.flow).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0].fields.body).toMatch(/\/media\//);
    expect(w.commits).toHaveLength(1);
  });
});

describe('runHostingSave: a commit that fails', () => {
  it('stops the Save, writes nothing, and shows no token', async () => {
    const w = world({ [A]: jpeg(1) }, { failCommit: true });
    const onSaved = vi.fn(); const mount = vi.fn();
    const r = await run(w, { onSaved, mount });
    expect(r).toMatchObject({ action: 'stop', message: STOP_MESSAGE });
    expect(onSaved).not.toHaveBeenCalled();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(JSON.stringify({ ...r, flow: undefined })).not.toContain(TOKEN);
    expect((mount.mock.calls[0][0] as HTMLElement).textContent).not.toContain(TOKEN);
  });
});

describe('runHostingSave: bad input', () => {
  it('never throws', async () => {
    for (const bad of [undefined, null, 5, 'x', [], { cfg: 5 }]) await expect(runHostingSave(bad as any)).resolves.toMatchObject({ action: 'normal' });
  });
});

describe('origFrom and freshOrig', () => {
  it('origFrom has the same keys that app.js builds when it opens a post', () => {
    const next = mkNext({ canonical: 'https://x.test/a' });
    expect(origFrom(next, NEW_PATH, 'S1')).toEqual({ category: 'entertainment', permalink: 'phone-launch', date: next.date, status: 'draft', robots: 'index,follow', canonical: 'https://x.test/a', path: NEW_PATH, sha: 'S1' });
  });
  it('freshOrig reads the sha that GitHub holds now and does not change next', async () => {
    const w = world(); const next = mkNext(); const copy = JSON.stringify(next);
    const o = await freshOrig(w.gh, next, NEW_PATH);
    expect(o).toMatchObject({ path: NEW_PATH, sha: 'FILE-SHA', permalink: 'phone-launch' });
    expect(JSON.stringify(next)).toBe(copy);
  });
  it('gives null when the file can not be read or the input is bad, and never throws', async () => {
    const w = world();
    expect(await freshOrig(w.gh, mkNext(), 'site/content/missing.md')).toBeNull();
    for (const [gh, path] of [[null, NEW_PATH], [{}, NEW_PATH], [w.gh, ''], [w.gh, 5], [{ getText: async () => ({ sha: '' }) }, NEW_PATH], [{ getText: async () => null }, NEW_PATH]] as any[]) expect(await freshOrig(gh, mkNext(), path)).toBeNull();
  });
});

describe('hosting-hook.js source', () => {
  const s = src('public/admin/js/hosting-hook.js');
  it('does not fetch, store, eval or touch the page by itself', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.']) expect(s).not.toContain(w);
  });
  it('is imported by app.js (since 0.101.55) and still not by main.js', () => {
    expect(src('public/admin/js/app.js')).toContain("from './hosting-hook.js'");
    expect(src('public/admin/js/main.js')).not.toContain('hosting-hook');
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
