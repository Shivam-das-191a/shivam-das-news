// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { runHostingSave } from '../../public/admin/js/hosting-hook.js';
// @ts-ignore
import { startHostingSave } from '../../public/admin/js/hosting-save.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const A = 'https://other.com/a.jpg';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const IMG = 'site/config/images.json';
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
const next = { title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], robots: 'index,follow', canonical: '' };

/** `images` is what config/images.json gives: a text, or 'missing' (404), or 'boom' (GitHub error). */
function world(images: string) {
  const fetchFn = vi.fn(async (_u: string, init: any) => {
    const urls = JSON.parse(init.body).urls as string[];
    return new Response(JSON.stringify({ results: urls.map((u) => ({ url: u, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...jpeg)), size: jpeg.length })) }));
  });
  const commits: any[] = [];
  const gh: any = {
    token: TOKEN,
    getText: vi.fn(async (path: string) => {
      if (path === IMG) {
        if (images === 'missing') { const e: any = new Error('not found'); e.status = 404; throw e; }
        if (images === 'boom') throw new Error(`GitHub 500 ${TOKEN}`);
        return { text: images, sha: 'i' };
      }
      if (path === 'site/config/media.json') return { text: '{}', sha: 'm' };
      if (path === NEW_PATH) return { text: 'x', sha: 'F' };
      const e: any = new Error('not found'); e.status = 404; throw e;
    }),
    commitFiles: vi.fn(async (files: any[], message: string) => { commits.push({ files, message }); return 'C1'; }),
  };
  const prepare = vi.fn(async () => ({ bytes: jpeg.slice(0, 20), width: 1600, height: 900, ext: 'webp' }));
  return { fetchFn, gh, commits, prepare };
}
const run = (w: any, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, ...o });
const readImages = (w: any) => w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length;

describe('the Save reads the picture quality of config/images.json (Part 7k)', () => {
  it('a quality in the file reaches the picture step', async () => {
    const w = world('{ "quality": 70 }');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(w.prepare).toHaveBeenCalled();
    expect(w.prepare.mock.calls[0][2]).toBe(70);
    expect(readImages(w)).toBe(1);
  });
  it('the shipped file (85) gives 85', async () => {
    const w = world(src('config/images.json'));
    await run(w);
    expect(w.prepare.mock.calls[0][2]).toBe(85);
  });
  it('a missing file leaves the picture step exactly as before (one argument)', async () => {
    const w = world('missing');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(w.prepare.mock.calls[0].length).toBe(1);
  });
  it('a bad number, bad JSON or no number leaves the picture step as before', async () => {
    for (const t of ['{ "quality": 0 }', '{ "quality": 101 }', '{ "quality": "70" }', '{ "quality": 70.5 }', '{oops', '[]', '{}']) {
      const w = world(t);
      const r = await run(w);
      expect(r.action).toBe('saved');
      expect(w.prepare.mock.calls[0].length).toBe(1);
    }
  });
  it('a GitHub error while reading the file does not stop the Save, and no token is shown', async () => {
    const w = world('boom');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(w.commits.length).toBe(1);
    expect(w.prepare.mock.calls[0].length).toBe(1);
    expect(JSON.stringify([r.message, w.commits])).not.toContain(TOKEN);
  });
  it('picture hosting OFF: the file is not read at all', async () => {
    const w = world('{ "quality": 70 }');
    const r = await run(w, { cfg: { ...CFG, imagesUrl: '' } });
    expect(r.action).toBe('normal');
    expect(readImages(w)).toBe(0);
    expect(w.prepare).not.toHaveBeenCalled();
  });
  it('a quality given by the caller wins and the file is not read', async () => {
    const w = world('{ "quality": 70 }');
    await run(w, { quality: 55 });
    expect(w.prepare.mock.calls[0][2]).toBe(55);
    expect(readImages(w)).toBe(0);
  });
  it('a quality inside optimizeDeps wins over the file', async () => {
    const w = world('{ "quality": 70 }');
    await run(w, { optimizeDeps: { prepare: w.prepare, quality: 40 } });
    expect(w.prepare.mock.calls[0][2]).toBe(40);
  });
  it('the post and the picture are still saved in ONE commit', async () => {
    const w = world('{ "quality": 60 }');
    await run(w);
    expect(w.commits.length).toBe(1);
    expect(w.commits[0].files.some((f: any) => f.path === NEW_PATH)).toBe(true);
  });
});

describe('startHostingSave passes quality on', () => {
  it('gives the number to the picture step through the setup', async () => {
    const w = world('missing');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, quality: 65 });
    expect(s.use).toBe(true);
    await s.flow.start();
    expect(w.prepare.mock.calls[0][2]).toBe(65);
  });
  it('without quality nothing changes', async () => {
    const w = world('missing');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare } });
    await s.flow.start();
    expect(w.prepare.mock.calls[0].length).toBe(1);
  });
});

describe('the source', () => {
  it('hosting-hook.js reads the setting only when hosting is on', () => {
    const t = src('public/admin/js/hosting-hook.js');
    expect(t).toContain("from './images-setting.js'");
    expect(t).toContain('hostingEnabled(rest.cfg)');
    expect(t).toContain('readImagesForSave(rest.gh, rest.cfg)'); // Part 7w: the same one read gives the quality and the switch
  });
  it('hosting-save.js passes quality to hostingSetup', () => {
    expect(src('public/admin/js/hosting-save.js')).toContain('quality: o.quality');
  });
});
