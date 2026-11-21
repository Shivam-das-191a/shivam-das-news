// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { runHostingSave } from '../../public/admin/js/hosting-hook.js';
// @ts-ignore
import { hostingSetup } from '../../public/admin/js/hosting-setup.js';
// @ts-ignore
import { startHostingSave } from '../../public/admin/js/hosting-save.js';
// @ts-ignore
import { savePostWithHosting } from '../../public/admin/js/hosting-pipeline.js';
// @ts-ignore
import { needsConfirm } from '../../public/admin/js/hosted-meta.js';
// @ts-ignore
import { planHosting } from '../../public/admin/js/hosting-plan.js';
// @ts-ignore
import { hostingSettingsFromText, readImagesForSave } from '../../public/admin/js/images-setting.js';
// @ts-ignore
import { ASK_FIRST_TEXT } from '../../public/admin/js/hosting-run.js';

// Phase 3c Part 7z (PLAN 34.10, automatic or ask first): the setting `askFirst` of config/images.json now changes the Save of the editor.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const OTHER = 'https://photos.other.com/a.jpg';
const GETTY = 'https://media.gettyimages.com/b.jpg';
const OWN = 'https://shivam-das-news.pages.dev/media/2026/11/x.webp';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const IMG = 'site/config/images.json';
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
const next = { title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], robots: 'index,follow', canonical: '' };

function world(images: string, media = '{}') {
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
      if (path === 'site/config/media.json') return { text: media, sha: 'm' };
      if (path === NEW_PATH) return { text: 'x', sha: 'F' };
      const e: any = new Error('not found'); e.status = 404; throw e;
    }),
    commitFiles: vi.fn(async (files: any[], message: string) => { commits.push({ files, message }); return 'C1'; }),
  };
  const prepare = vi.fn(async () => ({ bytes: jpeg.slice(0, 20), width: 1600, height: 900, ext: 'webp' }));
  return { fetchFn, gh, commits, prepare };
}
const hostedCount = (w: any) => (w.commits[0] ? w.commits[0].files.filter((f: any) => String(f.path).includes('/media/')).length : 0);
const fetchedUrls = (w: any): string[] => w.fetchFn.mock.calls.flatMap((c: any[]) => JSON.parse(c[1].body).urls);
const run = (w: any, body: string, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next, body, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, ...o });
const pic = (u: string) => `![A picture](${u})`;

describe('needsConfirm with askAll (Part 7z)', () => {
  it('askAll true: any readable website waits', () => {
    expect(needsConfirm(OTHER, { askAll: true })).toBe(true);
    expect(needsConfirm('https://x.y.example.org/c.png', { askAll: true })).toBe(true);
  });
  it('askAll true: an address that cannot be read does not wait', () => {
    for (const u of ['', 'not an address', undefined, null]) expect(needsConfirm(u as any, { askAll: true })).toBe(false);
  });
  it('askAll true: a confirmed address or a confirmed website no longer waits', () => {
    expect(needsConfirm(OTHER, { askAll: true, confirmed: [OTHER] })).toBe(false);
    expect(needsConfirm(OTHER, { askAll: true, confirmed: ['photos.other.com'] })).toBe(false);
    expect(needsConfirm(OTHER, { askAll: true, confirmed: ['https://photos.other.com/other.jpg'] })).toBe(true);
  });
  it('without askAll nothing changes: only the agency list waits', () => {
    expect(needsConfirm(OTHER, {})).toBe(false);
    expect(needsConfirm(GETTY, {})).toBe(true);
    expect(needsConfirm(OTHER)).toBe(false);
  });
  it.each([false, 'true', 1, 'on', null, undefined, {}])('askAll %j is not the value true: nothing changes', (v: any) => {
    expect(needsConfirm(OTHER, { askAll: v })).toBe(false);
    expect(needsConfirm(GETTY, { askAll: v })).toBe(true);
  });
});

describe('planHosting with askAll (Part 7z)', () => {
  const post = (body: string) => ({ body, image: '', imageAlt: '', ogImage: '' });
  it('a picture that would be fetched waits, and the item says it waits only because of ask first', () => {
    const p = planHosting(post(pic(OTHER)), { ownHosts: [], askAll: true });
    expect(p.items[0].status).toBe('needs_confirm');
    expect(p.items[0].askFirst).toBe(true);
    expect(p.counts.needs_confirm).toBe(1);
    expect(p.counts.fetch).toBe(0);
  });
  it('without askAll the same picture is fetched', () => {
    const p = planHosting(post(pic(OTHER)), { ownHosts: [] });
    expect(p.items[0].status).toBe('fetch');
    expect(p.items[0]).not.toHaveProperty('askFirst');
  });
  it('an agency picture waits as before and is not marked as ask first', () => {
    const p = planHosting(post(pic(GETTY)), { ownHosts: [], askAll: true });
    expect(p.items[0].status).toBe('needs_confirm');
    expect(p.items[0]).not.toHaveProperty('askFirst');
  });
  it('a picture that is already hosted is reused, not asked again', () => {
    const map = { '/media/2026/11/a.webp': { sourceUrl: OTHER } };
    const p = planHosting(post(pic(OTHER)), { ownHosts: [], askAll: true, map });
    expect(p.items[0].status).toBe('reuse');
  });
  it('a refused address stays refused', () => {
    const p = planHosting(post(pic('http://photos.other.com/a.jpg')), { ownHosts: [], askAll: true });
    expect(p.items[0].status).toBe('refused');
  });
  it('a confirmed picture is fetched', () => {
    const p = planHosting(post(pic(OTHER)), { ownHosts: [], askAll: true, confirmed: [OTHER] });
    expect(p.items[0].status).toBe('fetch');
  });
  it('our own pictures are not outside pictures, so nothing waits', () => {
    const p = planHosting(post(pic(OWN)), { ownHosts: ['shivam-das-news.pages.dev'], askAll: true });
    expect(p.counts.total).toBe(0);
  });
  it('two pictures: each one is decided alone', () => {
    const map = { '/media/2026/11/a.webp': { sourceUrl: OTHER } };
    const p = planHosting(post(`${pic(OTHER)}\n\n${pic('https://fine.example.org/d.jpg')}`), { ownHosts: [], askAll: true, map });
    expect(p.items.map((i: any) => i.status)).toEqual(['reuse', 'needs_confirm']);
  });
  it('askAll that is not the value true changes nothing', () => {
    for (const v of [false, 'true', 1, null, undefined]) expect(planHosting(post(pic(OTHER)), { ownHosts: [], askAll: v }).items[0].status).toBe('fetch');
  });
});

describe('the settings reader gives askFirst (Part 7z)', () => {
  it('only the real value true is given', () => {
    expect(hostingSettingsFromText('{ "askFirst": true }')).toEqual({ on: true, quality: undefined, askFirst: true });
  });
  it('false, text, numbers, null and a missing key leave the key out', () => {
    for (const t of ['{ "askFirst": false }', '{ "askFirst": "true" }', '{ "askFirst": 1 }', '{ "askFirst": null }', '{}', '[]', '{oops', '']) {
      expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(t), 'askFirst')).toBe(false);
    }
  });
  it('the shipped file gives no askFirst', () => {
    expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(src('config/images.json')), 'askFirst')).toBe(false);
  });
  it('all the keys come from one read', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "askFirst": true, "askHosts": ["a.example"], "nameOrder": ["caption", "alt", "handle"] }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: true, quality: undefined, nameOrder: ['caption', 'alt', 'handle'], askHosts: ['a.example'], askFirst: true });
    expect(gh.getText).toHaveBeenCalledTimes(1);
  });
});

describe('hostingSetup gives askAll to deps (Part 7z)', () => {
  const base = (o: any = {}) => ({ cfg: CFG, gh: world('{}').gh, postPath: NEW_PATH, serializePost: () => 'x', ...o });
  it('askFirst true gives askAll true', () => { expect(hostingSetup(base({ askFirst: true })).deps.askAll).toBe(true); });
  it.each([undefined, false, 'true', 1, 'on', null, {}])('askFirst %j gives no askAll', (v: any) => {
    expect(hostingSetup(base({ askFirst: v })).deps).not.toHaveProperty('askAll');
  });
  it('the agency list is not touched by askFirst', () => {
    expect(hostingSetup(base({ askFirst: true })).deps).not.toHaveProperty('agencyHosts');
    expect(hostingSetup(base({ askFirst: true, askHosts: ['x.example'] })).deps.agencyHosts).toContain('x.example');
  });
  it('startHostingSave gives askFirst to the setup', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: pic(OTHER), orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, askFirst: true });
    expect(s.use).toBe(true);
    expect(s.deps.askAll).toBe(true);
  });
});

describe('the Save waits for the writer when the file says askFirst (Part 7z)', () => {
  it('without askFirst an ordinary website is hosted as before', async () => {
    const w = world('{}');
    const r = await run(w, pic(OTHER));
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
    expect(hostedCount(w)).toBe(1);
  });
  it('with "askFirst": true the picture is NOT fetched and NOT hosted', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(OTHER));
    expect(fetchedUrls(w)).toEqual([]);
    expect(hostedCount(w)).toBe(0);
    expect(w.commits.length).toBe(0);
    expect(r.action).not.toBe('saved');
  });
  it('the writer sees the ask first sentence, not the agency one', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(OTHER));
    expect(r.flow.el.textContent).toContain(ASK_FIRST_TEXT);
    expect(r.flow.el.textContent).not.toContain('picture agency');
  });
  it('an agency picture still says it is from a picture agency', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(GETTY));
    expect(fetchedUrls(w)).toEqual([]);
    expect(r.flow.el.textContent).toContain('picture agency');
  });
  it('every outside picture waits, also from several websites', async () => {
    const w = world('{ "askFirst": true }');
    await run(w, `${pic(OTHER)}\n\n${pic('https://fine.example.org/d.jpg')}\n\n${pic(GETTY)}`);
    expect(fetchedUrls(w)).toEqual([]);
    expect(hostedCount(w)).toBe(0);
  });
  it('"askFirst": false, text, a number, null or a bad file changes nothing', async () => {
    for (const t of ['{ "askFirst": false }', '{ "askFirst": "true" }', '{ "askFirst": 1 }', '{ "askFirst": null }', '{oops', 'missing']) {
      const w = world(t);
      const r = await run(w, pic(OTHER));
      expect(r.action).toBe('saved');
      expect(fetchedUrls(w)).toEqual([OTHER]);
    }
  });
  it('a value given by the caller wins over the file', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(OTHER), { askFirst: false });
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
    const w2 = world('{}');
    await run(w2, pic(OTHER), { askFirst: true });
    expect(fetchedUrls(w2)).toEqual([]);
  });
  it('a picture that is already hosted is still reused (no fetch, no question)', async () => {
    const w = world('{ "askFirst": true }', JSON.stringify({ '/media/2026/11/a.webp': { sourceUrl: OTHER, alt: '' } }));
    await run(w, pic(OTHER));
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('our own pictures never wait and need no hosting', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(OWN));
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('no_pictures');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('askFirst and askHosts together: all pictures wait', async () => {
    const w = world('{ "askFirst": true, "askHosts": ["other.com"] }');
    await run(w, `${pic(OTHER)}\n\n${pic('https://fine.example.org/d.jpg')}`);
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('the file is read once', async () => {
    const w = world('{ "askFirst": true }');
    await run(w, pic(OTHER));
    expect(w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length).toBe(1);
  });
  it('with "enabled": false the switch still wins first and nothing waits', async () => {
    const w = world('{ "enabled": false, "askFirst": true }');
    const r = await run(w, pic(OTHER));
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('off');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('no token or service address appears in the list the writer sees', async () => {
    const w = world('{ "askFirst": true }');
    const r = await run(w, pic(OTHER));
    expect(r.flow.el.textContent).not.toContain(TOKEN);
    expect(r.flow.el.textContent).not.toContain('workers.dev');
  });
});

describe('after the writer confirms, the picture is hosted (Part 7z)', () => {
  it('the same run with the address confirmed fetches and hosts it', async () => {
    const w = world('{ "askFirst": true }');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: pic(OTHER), orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, askFirst: true });
    const post = { title: next.title, focusKeyword: next.focusKeyword, handle: next.permalink, date: next.date, body: pic(OTHER), image: '', imageAlt: '', ogImage: '' };
    const first = await savePostWithHosting(post, s.deps);
    expect(first.status).toBe('nothing');
    expect(fetchedUrls(w)).toEqual([]);
    const second = await savePostWithHosting(post, { ...s.deps, confirmed: [OTHER] });
    expect(second.status).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
    expect(hostedCount(w)).toBe(1);
  });
  it('confirming the website once covers its other pictures in the same post', async () => {
    const w = world('{ "askFirst": true }');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: pic(OTHER), orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, askFirst: true });
    const post = { title: next.title, focusKeyword: next.focusKeyword, handle: next.permalink, date: next.date, body: `${pic(OTHER)}\n\n${pic('https://photos.other.com/b.jpg')}`, image: '', imageAlt: '', ogImage: '' };
    const r = await savePostWithHosting(post, { ...s.deps, confirmed: ['photos.other.com'] });
    expect(r.status).toBe('saved');
    expect(fetchedUrls(w).sort()).toEqual([OTHER, 'https://photos.other.com/b.jpg'].sort());
  });
});

describe('the files say the truth about askFirst (Part 7z)', () => {
  it('the shipped value is still false and nothing is switched on by this part', () => {
    expect(JSON.parse(src('config/images.json')).askFirst).toBe(false);
  });
  it('the hook, the save and the setup name askFirst; the pipeline passes askAll', () => {
    for (const f of ['hosting-hook', 'hosting-save', 'hosting-setup']) expect(src(`public/admin/js/${f}.js`)).toContain('askFirst');
    expect(src('public/admin/js/hosting-pipeline.js')).toMatch(/'askAll'/);
    expect(src('public/admin/js/hosting-run.js')).toContain('askAll: deps.askAll');
  });
});
