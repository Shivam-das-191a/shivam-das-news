// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { startHostingSave, hostingPostOf, makePostSerializer, existingFromTree } from '../../public/admin/js/hosting-save.js';
// @ts-ignore
import { parse, stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore
import { findExternal } from '../../public/admin/js/hotlink.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];

const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const jpeg = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(tag)]);
// jsdom has no Blob.arrayBuffer, so the fake picture step returns fixed bytes (what the real step does is tested in hosting-optimize.test.ts)
const optimizeDeps = { prepare: vi.fn(async () => ({ bytes: jpeg(9).slice(0, 20), width: 1600, height: 900, ext: 'webp' })) };

const mkNext = (extra: any = {}) => ({ title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], ...extra });

/** A fake picture service (through the Worker call) and a fake GitHub that remembers the media file. */
function world(table: Record<string, Uint8Array | string> = {}) {
  const calls: any[] = [];
  const fetchFn = vi.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    const urls = JSON.parse(init.body).urls as string[];
    return new Response(JSON.stringify({ results: urls.map((u) => { const v = table[u]; if (v === undefined) return { url: u, ok: false, reason: 'network' }; if (typeof v === 'string') return { url: u, ok: false, reason: v }; return { url: u, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...v)), size: v.length }; }) }), { status: 200 });
  });
  let media = '{}';
  const commits: { files: any[]; message: string }[] = [];
  const gh: any = {
    token: TOKEN,
    getText: vi.fn(async (path: string) => { if (path === 'site/config/media.json') return { text: media, sha: 's' }; const e: any = new Error('not found'); e.status = 404; throw e; }),
    commitFiles: vi.fn(async (files: any[], message: string) => { commits.push({ files, message }); const m = files.find((f: any) => f.path === 'site/config/media.json'); if (m) media = m.text; return 'C-' + commits.length; }),
  };
  return { fetchFn, calls, gh, commits };
}
const run = (w: any, o: any = {}) => startHostingSave({ cfg: CFG, gh: w.gh, next: mkNext(), body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps, ...o });

describe('hostingPostOf', () => {
  it('copies only the fields the pipeline reads, and the permalink becomes the handle', () => {
    const next = mkNext({ image: A, imageAlt: 'Alt', ogImage: B });
    const copy = JSON.parse(JSON.stringify(next));
    const p = hostingPostOf(next, 'Body ![x](y)');
    expect(p).toEqual({ title: next.title, focusKeyword: 'phone launch', handle: 'phone-launch', date: next.date, body: 'Body ![x](y)', image: A, imageAlt: 'Alt', ogImage: B });
    expect(next).toEqual(copy);
  });
  it('gives empty text for missing or wrong values and never throws', () => {
    for (const bad of [undefined, null, 5, 'x', [], { title: 5, permalink: {}, date: null }]) {
      expect(() => hostingPostOf(bad as any, undefined as any)).not.toThrow();
      const p = hostingPostOf(bad as any, 7 as any);
      for (const k of ['title', 'focusKeyword', 'handle', 'date', 'body', 'image', 'imageAlt', 'ogImage']) expect(typeof p[k]).toBe('string');
    }
  });
});

describe('makePostSerializer', () => {
  it('keeps every field of the editor and takes body, image, imageAlt and ogImage from the pipeline', () => {
    const next = mkNext({ image: A, imageAlt: 'Old alt' });
    const text = makePostSerializer(next)({ body: 'New body', image: '/media/2026/11/x.webp', imageAlt: 'New alt', ogImage: '', title: 'IGNORED', handle: 'ignored' });
    const out = parse(text);
    expect(out.body.trim()).toBe('New body');
    expect(out.data.title).toBe(next.title);
    expect(out.data.permalink).toBe('phone-launch');
    expect(out.data.status).toBe('draft');
    expect(out.data.tags).toEqual(['phones']);
    expect(out.data.image).toBe('/media/2026/11/x.webp');
    expect(out.data.imageAlt).toBe('New alt');
  });
  it('a field the pipeline did not give as text keeps the editor value', () => {
    const next = mkNext({ image: A, imageAlt: 'Keep me' });
    const out = parse(makePostSerializer(next)({ body: 'b', image: undefined, imageAlt: 5 as any }));
    expect(out.data.image).toBe(A);
    expect(out.data.imageAlt).toBe('Keep me');
  });
  it('does not change the editor object and never throws', () => {
    const next = mkNext();
    const copy = JSON.parse(JSON.stringify(next));
    makePostSerializer(next)({ body: 'x', image: '/media/a.webp' });
    expect(next).toEqual(copy);
    for (const bad of [undefined, null, 5]) expect(() => makePostSerializer(bad as any)(bad as any)).not.toThrow();
  });
  it('is the same text the editor writes when nothing changed', () => {
    const next = mkNext({ image: '/media/a.webp', imageAlt: 'Alt' });
    expect(makePostSerializer(next)({ body: 'Same', image: '/media/a.webp', imageAlt: 'Alt', ogImage: '' })).toBe(stringify({ ...next, ogImage: '' }, 'Same'));
  });
});

describe('existingFromTree', () => {
  it('lists the media addresses and nothing else', () => {
    const tree = [{ path: 'site/public/media/2026/11/a.webp' }, { path: 'site/public/media/b.gif' }, { path: 'site/public/favicon.ico' }, { path: 'site/public/media/' }, { path: 'site/content/blogs/x.md' }, { path: 5 }, null, {}];
    expect(existingFromTree(tree)).toEqual(['/media/2026/11/a.webp', '/media/b.gif']);
    expect(existingFromTree([{ path: 'web/public/media/c.webp' }], 'web/public/')).toEqual(['/media/c.webp']);
  });
  it('gives an empty list for anything that is not a list', () => {
    for (const bad of [undefined, null, 5, 'x', {}]) expect(existingFromTree(bad as any)).toEqual([]);
  });
});

describe('startHostingSave: when it does not apply', () => {
  it('off: no imagesUrl, and no Worker call', () => {
    const w = world();
    const r = run(w, { cfg: { ...CFG, imagesUrl: '' } });
    expect(r).toMatchObject({ use: false, reason: 'off' });
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('setup: a bad address or no client gives one plain sentence without the address or the token', () => {
    const a = run(world(), { cfg: { ...CFG, imagesUrl: 'http://secret-host.example' } });
    expect(a).toMatchObject({ use: false, reason: 'setup' });
    expect(a.message).not.toMatch(/secret-host/);
    const b = run(world(), { gh: null });
    expect(b).toMatchObject({ use: false, reason: 'setup', message: 'There is no connection to GitHub.' });
    expect(JSON.stringify([a, b])).not.toContain(TOKEN);
  });
  it('archived posts are not hosted', () => {
    expect(run(world(), { next: mkNext({ status: 'archived' }) })).toMatchObject({ use: false, reason: 'archived' });
  });
  it('a post with no outside picture does not call the Worker', () => {
    const w = world();
    for (const body of ['Only words.', '![Own](/media/a.webp)', '![Own](https://shivam-das-news.pages.dev/media/a.webp)']) expect(run(w, { body })).toMatchObject({ use: false, reason: 'no_pictures' });
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('an outside picture in the front matter image counts', () => {
    expect(run(world(), { body: 'Words.', next: mkNext({ image: A }) }).use).toBe(true);
  });
  it('a post that moves to a new address is not hosted, with a plain sentence', () => {
    const w = world();
    const r = run(w, { orig: { path: 'site/content/blogs/other/old-name.md', sha: 'x' } });
    expect(r).toMatchObject({ use: false, reason: 'moved' });
    expect(r.message).toMatch(/Save again after the move/);
    expect(w.fetchFn).not.toHaveBeenCalled();
    expect(w.commits).toHaveLength(0);
  });
  it('the same file (an edit in place) is hosted', () => {
    expect(run(world(), { orig: { path: NEW_PATH, sha: 'x' } }).use).toBe(true);
  });
  it('never throws on garbage', () => {
    for (const g of [undefined, null, 5, 'x', [], { next: 5 }, { cfg: CFG }, { cfg: CFG, gh: 5, next: 5, body: 5, orig: 5 }]) {
      expect(() => startHostingSave(g as any)).not.toThrow();
      expect(startHostingSave(g as any).use).toBe(false);
    }
  });
});

describe('startHostingSave: the real flow', () => {
  it('the first Save makes ONE commit with the pictures, the media file and the post written by the editor serializer', async () => {
    const w = world({ [A]: jpeg(1), [B]: jpeg(2) });
    const next = mkNext({ image: B });
    const copy = JSON.parse(JSON.stringify(next));
    const onResult = vi.fn();
    const r = run(w, { next, body: `Intro ![One](${A})`, onResult, canEdit: true });
    expect(r.use).toBe(true);
    expect(w.fetchFn).not.toHaveBeenCalled(); // nothing runs until start()
    await r.flow.start();
    expect(w.commits).toHaveLength(1);
    const files = w.commits[0].files;
    const paths = files.map((f: any) => f.path);
    expect(paths).toContain(NEW_PATH);
    expect(paths).toContain('site/config/media.json');
    expect(paths.filter((p: string) => p.startsWith('site/public/media/') && p.endsWith('.webp'))).toHaveLength(2);
    const post = parse(files.find((f: any) => f.path === NEW_PATH).text);
    expect(findExternal({ body: post.body, image: post.data.image }, ['shivam-das-news.pages.dev'])).toEqual([]);
    expect(post.body).toMatch(/!\[One\]\(\/media\//);
    expect(post.data.image).toMatch(/^\/media\//);
    expect(post.data.status).toBe('draft');
    expect(post.data.title).toBe(next.title);
    expect(post.data.description).toBe(next.description);
    expect(post.data.tags).toEqual(['phones']);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].status).toBe('saved');
    expect(next).toEqual(copy);
    expect(qa(r.flow.el, 'row')).toHaveLength(2);
  });
  it('the token goes only to the Worker address', async () => {
    const w = world({ [A]: jpeg(1) });
    const r = run(w);
    await r.flow.start();
    expect(w.calls).toHaveLength(1);
    expect(w.calls[0].url).toBe(EP + '/fetch');
    expect(w.calls[0].init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(w.commits)).not.toContain(TOKEN);
    expect(r.flow.el.textContent).not.toContain(TOKEN);
  });
  it('a preview writes nothing', async () => {
    const w = world({ [A]: jpeg(1) });
    const r = run(w, { dryRun: true });
    await r.flow.start();
    expect(w.commits).toHaveLength(0);
    expect(r.flow.state().status).toBe('preview');
  });
  it('a failed picture leaves its address in the saved post, the other is hosted, and Retry hosts it after the service is back', async () => {
    const table: Record<string, any> = { [A]: jpeg(1), [B]: 'network' };
    const w = world(table);
    const r = run(w, { body: `![One](${A}) ![Two](${B})` });
    await r.flow.start();
    expect(w.commits).toHaveLength(1);
    const first = parse(w.commits[0].files.find((f: any) => f.path === NEW_PATH).text);
    expect(first.body).toContain(B);
    expect(first.body).not.toContain(A);
    expect(qa(r.flow.el, 'row').map((x: any) => x.dataset.status).sort()).toEqual(['failed', 'hosted']);
    table[B] = jpeg(2);
    q(r.flow.el, 'retry-all').click();
    for (let i = 0; i < 8; i++) await new Promise((x) => setTimeout(x, 0));
    expect(w.commits).toHaveLength(2);
    const second = parse(w.commits[1].files.find((f: any) => f.path === NEW_PATH).text);
    expect(findExternal({ body: second.body }, ['shivam-das-news.pages.dev'])).toEqual([]);
    expect(second.data.title).toBe(first.data.title);
  });
  it('canEdit false hides the buttons, and the default shows them', async () => {
    const hidden = run(world({ [A]: 'network' }), { canEdit: false });
    await hidden.flow.start();
    expect(q(hidden.flow.el, 'retry-all')).toBeNull();
    expect(qa(hidden.flow.el, 'retry-one')).toHaveLength(0);
    const shown = run(world({ [A]: 'network' }), { canEdit: true });
    await shown.flow.start();
    expect(q(shown.flow.el, 'retry-all')).not.toBeNull();
  });
  it('a picture name that is already in the repository tree gets a number, and the old file is not overwritten', async () => {
    const w = world({ [A]: jpeg(1) });
    const r = run(w, { tree: [{ path: 'site/public/media/2026/11/one-delhi-hosts-big-phone-launch.webp' }] });
    await r.flow.start();
    const paths = w.commits[0].files.map((f: any) => f.path).filter((p: string) => p.startsWith('site/public/media/'));
    expect(paths).toEqual(['site/public/media/2026/11/one-delhi-hosts-big-phone-launch-2.webp']);
  });
  it('a post that already uses hosted pictures makes no commit', async () => {
    const w = world({ [A]: jpeg(1) });
    const first = run(w);
    await first.flow.start();
    const hosted = parse(w.commits[0].files.find((f: any) => f.path === NEW_PATH).text).body;
    expect(run(w, { body: hosted }).use).toBe(false);
  });
});

describe('hosting-save.js source', () => {
  const s = src('public/admin/js/hosting-save.js');
  it('does not fetch, store, eval or touch the page by itself', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.']) expect(s).not.toContain(w);
  });
  it('is not imported by app.js or main.js yet', () => {
    for (const p of ['public/admin/js/app.js', 'public/admin/js/main.js']) expect(src(p)).not.toContain('hosting-save');
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
