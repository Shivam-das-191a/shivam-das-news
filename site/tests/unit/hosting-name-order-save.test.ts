// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { runHostingSave } from '../../public/admin/js/hosting-hook.js';
// @ts-ignore
import { seoName } from '../../public/admin/js/hotlink.js';
// @ts-ignore
import { hostingSetup } from '../../public/admin/js/hosting-setup.js';
// @ts-ignore
import { startHostingSave } from '../../public/admin/js/hosting-save.js';
// @ts-ignore
import { customNameOrder, hostingSettingsFromText, readImagesForSave, NAME_SOURCES } from '../../public/admin/js/images-setting.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const A = 'https://other.com/stadium-roof-repair-work.jpg';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const IMG = 'site/config/images.json';
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
const next = { title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], robots: 'index,follow', canonical: '' };
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch' };

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
// The picture file the Save wrote (its path), from the one commit.
const hostedPaths = (w: any): string[] => (w.commits[0] ? w.commits[0].files.map((f: any) => f.path).filter((p: string) => p.includes('/media/')) : []);
const run = (w: any, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next, body: `![Phone launch event in Delhi](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, ...o });

describe('customNameOrder: only a valid order that is not the shipped one', () => {
  it('gives the order for a valid custom order', () => {
    expect(customNameOrder(['caption', 'alt', 'handle'])).toEqual(['caption', 'alt', 'handle']);
    expect(customNameOrder(['handle'])).toEqual(['handle']);
    expect(customNameOrder(['oldName', 'alt', 'handle'])).toEqual(['oldName', 'alt', 'handle']);
  });
  it('gives undefined for the shipped order', () => { expect(customNameOrder([...NAME_SOURCES])).toBeUndefined(); });
  it.each([undefined, null, 5, 'alt', {}, [], ['alt'], ['handle', 'alt'], ['alt', 'alt', 'handle'], ['alt', 'x', 'handle'], [1, 'handle'], ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle', 'handle']])('%j gives undefined', (v: any) => { expect(customNameOrder(v)).toBeUndefined(); });
  it('returns a copy and never changes its input', () => {
    const input = ['caption', 'alt', 'handle'];
    const out = customNameOrder(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(['caption', 'alt', 'handle']);
  });
});

describe('seoName with an order (Part 7x)', () => {
  const img = { url: 'https://o.com/stadium-roof-repair-work.jpg', alt: 'New phone launch event in Delhi', caption: 'Crowd outside the venue', heading: 'Venue opens early today' };
  it('without an order, or with the shipped one, nothing changes', () => {
    const before = seoName(img, POST, 1);
    expect(before).toEqual({ name: 'new-phone-launch-event-delhi', source: 'alt' });
    expect(seoName(img, POST, 1, undefined)).toEqual(before);
    expect(seoName(img, POST, 1, [...NAME_SOURCES])).toEqual(before);
  });
  it('a wrong order is ignored', () => {
    for (const bad of [null, 5, 'caption', [], ['caption'], ['caption', 'alt'], ['caption', 'x', 'handle'], ['caption', 'caption', 'handle']]) {
      expect(seoName(img, POST, 1, bad as any)).toEqual({ name: 'new-phone-launch-event-delhi', source: 'alt' });
    }
  });
  it('the caption first', () => { expect(seoName(img, POST, 1, ['caption', 'alt', 'handle'])).toEqual({ name: 'crowd-outside-venue', source: 'caption' }); });
  it('the heading first', () => { expect(seoName(img, POST, 1, ['heading', 'handle']).source).toBe('heading'); });
  it('the focus keyword and title first', () => { expect(seoName(img, POST, 1, ['keyword', 'handle'])).toEqual({ name: 'phone-launch-delhi-hosts-big', source: 'title' }); });
  it('the old file name first', () => { expect(seoName(img, POST, 1, ['oldName', 'alt', 'handle'])).toEqual({ name: 'stadium-roof-repair-work', source: 'oldname' }); });
  it('a way that is not in the list is skipped', () => {
    const r = seoName({ url: 'https://o.com/IMG_1.jpg', alt: 'New phone launch event in Delhi' }, POST, 2, ['caption', 'handle']);
    expect(r).toEqual({ name: 'phone-launch-image-2', source: 'handle' });
  });
  it('a way that gives no words falls to the next one in the order', () => {
    expect(seoName({ url: 'https://o.com/IMG_1.jpg', alt: 'New phone launch event in Delhi' }, POST, 1, ['caption', 'alt', 'handle']).source).toBe('alt');
  });
  it('only a-z, 0-9 and hyphens, whatever the order', () => {
    for (const order of [['caption', 'alt', 'handle'], ['heading', 'handle'], ['keyword', 'oldName', 'handle']]) {
      expect(seoName({ url: 'https://o.com/a.jpg', alt: 'Ünïcode: café & CO!', caption: 'Ça va?! 2026', heading: 'Head_ing  one' }, { ...POST, title: 'Title: with SYMBOLS #1' }, 1, order).name).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('the settings reader gives the order (Part 7x)', () => {
  it('a custom order in the file is given as nameOrder', () => {
    expect(hostingSettingsFromText('{ "nameOrder": ["caption", "alt", "handle"] }')).toEqual({ on: true, quality: undefined, nameOrder: ['caption', 'alt', 'handle'] });
    expect(hostingSettingsFromText('{ "enabled": false, "quality": 70, "nameOrder": ["handle"] }')).toEqual({ on: false, quality: 70, nameOrder: ['handle'] });
  });
  it('no key nameOrder when the file has no order, the shipped order or a wrong one', () => {
    for (const t of ['{}', '{ "nameOrder": ["alt", "caption", "heading", "keyword", "oldName", "handle"] }', '{ "nameOrder": ["alt"] }', '{ "nameOrder": "alt" }', '{ "nameOrder": null }', '[]', '{oops', '']) {
      expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(t), 'nameOrder')).toBe(false);
    }
  });
  it('readImagesForSave still reads the file once', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "nameOrder": ["caption", "alt", "handle"] }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: true, quality: undefined, nameOrder: ['caption', 'alt', 'handle'] });
    expect(gh.getText).toHaveBeenCalledTimes(1);
  });
});

describe('hostingSetup and startHostingSave pass the order on (Part 7x)', () => {
  const base = () => ({ cfg: CFG, gh: world('{}').gh, postPath: NEW_PATH, serializePost: () => 'x' });
  it('a valid custom order reaches deps.nameOrder', () => {
    const r = hostingSetup({ ...base(), nameOrder: ['caption', 'alt', 'handle'] });
    expect(r.ok).toBe(true);
    expect(r.deps.nameOrder).toEqual(['caption', 'alt', 'handle']);
  });
  it('no order, the shipped order or a wrong one leaves deps without the key', () => {
    for (const v of [undefined, [...NAME_SOURCES], ['alt'], 'x', null, ['handle', 'alt']]) {
      const r = hostingSetup({ ...base(), nameOrder: v as any });
      expect(r.ok).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(r.deps, 'nameOrder')).toBe(false);
    }
  });
  it('startHostingSave gives nameOrder to the setup', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, nameOrder: ['caption', 'alt', 'handle'] });
    expect(s.use).toBe(true);
    expect(s.deps.nameOrder).toEqual(['caption', 'alt', 'handle']);
  });
  it('startHostingSave without nameOrder leaves deps as before', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${A})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare } });
    expect(Object.prototype.hasOwnProperty.call(s.deps, 'nameOrder')).toBe(false);
  });
});

describe('the Save names new pictures by the order of the file (Part 7x)', () => {
  it('the shipped order: the alt text names the picture', async () => {
    const w = world('{}');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/phone-launch-event-delhi.webp']);
  });
  it('a custom order in the file: the old file name first', async () => {
    const w = world('{ "nameOrder": ["oldName", "alt", "handle"] }');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/stadium-roof-repair-work.webp']);
  });
  it('a custom order that skips every good way gives the handle name', async () => {
    const w = world('{ "nameOrder": ["caption", "handle"] }');
    const r = await run(w);
    expect(r.action).toBe('saved');
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/phone-launch-image-1.webp']);
  });
  it('a wrong order in the file: the names are made as before', async () => {
    for (const t of ['{ "nameOrder": ["oldName", "alt"] }', '{ "nameOrder": "oldName" }', '{ "nameOrder": [] }', '{oops', '{}']) {
      const w = world(t);
      await run(w);
      expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/phone-launch-event-delhi.webp']);
    }
  });
  it('a missing file: the names are made as before', async () => {
    const w = world('missing');
    await run(w);
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/phone-launch-event-delhi.webp']);
  });
  it('an order given by the caller wins over the file', async () => {
    const w = world('{ "nameOrder": ["oldName", "alt", "handle"] }');
    await run(w, { nameOrder: ['alt', 'oldName', 'handle'] });
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/phone-launch-event-delhi.webp']);
  });
  it('the file is read once, and the order and the quality come from the same read', async () => {
    const w = world('{ "quality": 61, "nameOrder": ["oldName", "alt", "handle"] }');
    await run(w);
    expect(w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length).toBe(1);
    expect(hostedPaths(w)).toEqual(['site/public/media/2026/11/stadium-roof-repair-work.webp']);
  });
  it('with "enabled": false nothing is hosted, whatever the order', async () => {
    const w = world('{ "enabled": false, "nameOrder": ["oldName", "alt", "handle"] }');
    const r = await run(w);
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('off');
    expect(w.commits.length).toBe(0);
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('no token or address is shown in any message', async () => {
    const w = world('{ "nameOrder": ["oldName", "alt", "handle"] }');
    const r = await run(w);
    expect(JSON.stringify({ a: r.action, m: r.message })).not.toContain(TOKEN);
  });
});

describe('the files carry the order (Part 7x)', () => {
  it('the hook, the setup, the save and the run pass nameOrder on', () => {
    expect(src('public/admin/js/hosting-hook.js')).toContain('fromFile.nameOrder');
    expect(src('public/admin/js/hosting-save.js')).toContain('nameOrder: o.nameOrder');
    expect(src('public/admin/js/hosting-setup.js')).toContain('customNameOrder(o.nameOrder)');
    expect(src('public/admin/js/hosting-run.js')).toContain('deps.nameOrder');
    expect(src('public/admin/js/hosting-pipeline.js')).toMatch(/const PASS = \[[^\]]*'nameOrder'/);
  });
  it('seoName reads the order with customNameOrder', () => { expect(src('public/admin/js/hotlink.js')).toContain('customNameOrder(order)'); });
});
