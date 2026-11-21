// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { runHostingSave } from '../../public/admin/js/hosting-hook.js';
// @ts-ignore
// @ts-ignore
import { hostingSettingsFromText, readImagesForSave } from '../../public/admin/js/images-setting.js';

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

const OFF_TEXTS = ['{ "enabled": false }', '{"enabled":false,"quality":70}', '{\n  "hardBlock": false,\n  "enabled": false\n}'];
const ON_TEXTS = ['{ "enabled": true }', '{}', '{ "quality": 70 }', '[]', '{oops', '', '   ', '{ "enabled": "false" }', '{ "enabled": 0 }', '{ "enabled": null }', '{ "enabled": [false] }', 'null', '"x"', '{ "Enabled": false }'];

describe('hostingSettingsFromText: only a real "enabled": false switches hosting off', () => {
  it.each(OFF_TEXTS)('%s gives on = false', (t: string) => { expect(hostingSettingsFromText(t).on).toBe(false); });
  it.each(ON_TEXTS)('%j keeps on = true', (t: string) => { expect(hostingSettingsFromText(t).on).toBe(true); });
  it('not a text keeps on = true and no quality', () => {
    for (const x of [undefined, null, 5, {}, [], true]) expect(hostingSettingsFromText(x as any)).toEqual({ on: true, quality: undefined });
  });
  it('gives the quality the same careful way as before', () => {
    expect(hostingSettingsFromText('{ "quality": 70 }')).toEqual({ on: true, quality: 70 });
    expect(hostingSettingsFromText('{ "enabled": false, "quality": 70 }')).toEqual({ on: false, quality: 70 });
    for (const t of ['{ "quality": 0 }', '{ "quality": 101 }', '{ "quality": "70" }', '{ "quality": 70.5 }']) expect(hostingSettingsFromText(t).quality).toBeUndefined();
  });
});

describe('readImagesForSave: one read, never throws', () => {
  it('reads the file at the path of the content root with one getText call', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "enabled": false, "quality": 60 }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: false, quality: 60 });
    expect(gh.getText).toHaveBeenCalledTimes(1);
    expect(gh.getText).toHaveBeenCalledWith('site/config/images.json');
  });
  it('no client, no getText, a 404 or a GitHub error all give the safe answer', async () => {
    const safe = { on: true, quality: undefined };
    expect(await readImagesForSave(null as any, {})).toEqual(safe);
    expect(await readImagesForSave({} as any, {})).toEqual(safe);
    expect(await readImagesForSave({ getText: async () => { throw new Error('GitHub 500'); } } as any, {})).toEqual(safe);
    expect(await readImagesForSave({ getText: async () => null } as any, {})).toEqual(safe);
    expect(await readImagesForSave({ getText: async () => ({ text: 5 }) } as any, {})).toEqual(safe);
  });
});

describe('the Save and the switch "enabled" (Part 7w)', () => {
  it('"enabled": false stops the pictures flow: the Save goes on as before, nothing is fetched or committed, the file is read once', async () => {
    for (const t of OFF_TEXTS) {
      const w = world(t);
      const r = await run(w);
      expect(r.action).toBe('normal');
      expect(r.reason).toBe('off');
      expect(r.message).toBe('');
      expect(r.flow).toBeUndefined();
      expect(w.fetchFn).not.toHaveBeenCalled();
      expect(w.prepare).not.toHaveBeenCalled();
      expect(w.commits).toHaveLength(0);
      expect(readImages(w)).toBe(1);
    }
  });
  it('"enabled": true, the shipped file, and every kind of missing or broken file leave hosting on', async () => {
    for (const t of ['{ "enabled": true }', src('config/images.json'), ...ON_TEXTS.filter((x) => x !== '{ "enabled": true }'), 'missing', 'boom']) {
      const w = world(t);
      const r = await run(w);
      expect(r.action, t).toBe('saved');
      expect(w.commits, t).toHaveLength(1);
      expect(JSON.stringify([r.message, w.commits])).not.toContain(TOKEN);
    }
  });
  it('the quality still works next to the switch', async () => {
    const w = world('{ "enabled": true, "quality": 70 }');
    await run(w);
    expect(w.prepare.mock.calls[0][2]).toBe(70);
  });
  it('a caller that gives its own quality skips the file, as in Part 7k (the dashboard never does this)', async () => {
    const w = world('{ "enabled": false }');
    const r = await run(w, { quality: 60 });
    expect(r.action).toBe('saved');
    expect(readImages(w)).toBe(0);
  });
  it('when hosting is not set up at all (no imagesUrl), the file is not read and nothing changes', async () => {
    const w = world('{ "enabled": false }');
    const r = await run(w, { cfg: { ...CFG, imagesUrl: '' } });
    expect(r.action).toBe('normal');
    expect(readImages(w)).toBe(0);
  });
  it('the post body is never changed by the off switch', async () => {
    const w = world('{ "enabled": false }');
    const body = `![One](${A})`;
    const r = await run(w, { body });
    expect(r.action).toBe('normal');
    expect(w.commits).toHaveLength(0);
  });
  it('the outcome has the same shape as the other normal outcomes', async () => {
    const off = await run(world('{ "enabled": false }'));
    expect(Object.keys(off).sort()).toEqual(['action', 'message', 'reason']);
  });
});

describe('the files', () => {
  it('images-setting.js and hosting-hook.js have no emoji and no token word in the new code', () => {
    for (const f of ['public/admin/js/images-setting.js', 'public/admin/js/hosting-hook.js']) expect(/[^\x00-\x7F]/.test(src(f)), f).toBe(false);
  });
  it('the dashboard still gives no quality of its own to runHostingSave', () => {
    const app = src('public/admin/js/app.js');
    const call = app.slice(app.indexOf('await runHostingSave({'), app.indexOf('await runHostingSave({') + 300);
    expect(call).not.toContain('quality');
  });
  it('the Picture settings screen says that Off stops the Save from hosting pictures', () => {
    expect(src('public/admin/js/images-screen.js')).toContain('Off stops it from hosting pictures');
  });
});
