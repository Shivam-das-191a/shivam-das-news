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
import { customBlockHosts, hostingSettingsFromText, readImagesForSave } from '../../public/admin/js/images-setting.js';

// Phase 3c Part 7aa (PLAN 34.10, the block list): the setting `blockHosts` of config/images.json now changes the Save of the editor.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const OTHER = 'https://photos.other.com/a.jpg';
const FINE = 'https://fine.example.org/d.jpg';
const NEW_PATH = 'site/content/blogs/entertainment/phone-launch.md';
const IMG = 'site/config/images.json';
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
const next = { title: 'Delhi hosts the big phone launch', permalink: 'phone-launch', category: 'entertainment', status: 'draft', date: '2026-11-16T10:00:00+05:30', focusKeyword: 'phone launch', description: 'A short summary of the launch.', image: '', imageAlt: '', tags: ['phones'], robots: 'index,follow', canonical: '' };

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
const hostedCount = (w: any) => (w.commits[0] ? w.commits[0].files.filter((f: any) => String(f.path).includes('/media/')).length : 0);
const fetchedUrls = (w: any): string[] => w.fetchFn.mock.calls.flatMap((c: any[]) => JSON.parse(c[1].body).urls);
const run = (w: any, body: string, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next, body, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, ...o });
const pic = (u: string) => `![A picture](${u})`;

describe('customBlockHosts: only valid website names (Part 7aa)', () => {
  it('keeps valid names, lower case, no repeat', () => { expect(customBlockHosts(['Photos.Other.com', 'photos.other.com', 'bad.example'])).toEqual(['photos.other.com', 'bad.example']); });
  it('drops bad entries and keeps the good ones', () => { expect(customBlockHosts(['', 5, null, 'bad name', 'https://x.com/a', 'ok.example'])).toEqual(['ok.example']); });
  it.each([undefined, null, 5, 'a.com', {}, [], [''], [5], ['bad name'], ['http://a.com']])('%j gives undefined', (v: any) => { expect(customBlockHosts(v)).toBeUndefined(); });
  it('at most 200 names, and the input is not changed', () => {
    const many = Array.from({ length: 250 }, (_, i) => `h${i}.example`);
    const copy = [...many];
    expect(customBlockHosts(many)!.length).toBe(200);
    expect(many).toEqual(copy);
  });
});

describe('the settings reader gives blockHosts (Part 7aa)', () => {
  it('a list with a valid name is given as blockHosts', () => {
    expect(hostingSettingsFromText('{ "blockHosts": ["Bad.example", "x"] }')).toEqual({ on: true, quality: undefined, blockHosts: ['bad.example', 'x'] });
  });
  it('no key blockHosts for an empty, missing or wrong list', () => {
    for (const t of ['{}', '{ "blockHosts": [] }', '{ "blockHosts": "a.com" }', '{ "blockHosts": [5] }', '{ "blockHosts": null }', '[]', '{oops', '']) {
      expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(t), 'blockHosts')).toBe(false);
    }
  });
  it('the shipped file gives no blockHosts', () => {
    expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(src('config/images.json')), 'blockHosts')).toBe(false);
  });
  it('all the keys come from one read', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "blockHosts": ["b.example"], "askHosts": ["a.example"], "askFirst": true }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: true, quality: undefined, askHosts: ['a.example'], blockHosts: ['b.example'], askFirst: true });
    expect(gh.getText).toHaveBeenCalledTimes(1);
  });
});

describe('hostingSetup adds blockHosts to the block list (Part 7aa)', () => {
  const base = (o: any = {}) => ({ cfg: CFG, gh: world('{}').gh, postPath: NEW_PATH, serializePost: () => 'x', ...o });
  it('without blockHosts nothing changes: no list in deps', () => {
    expect(hostingSetup(base()).deps).not.toHaveProperty('blockHosts');
    for (const v of [undefined, [], [5], 'a.com', ['bad name']]) expect(hostingSetup(base({ blockHosts: v })).deps).not.toHaveProperty('blockHosts');
  });
  it('blockHosts becomes the list when the dashboard has none', () => {
    expect(hostingSetup(base({ blockHosts: ['bad.example'] })).deps.blockHosts).toEqual(['bad.example']);
  });
  it('blockHosts is added to the list of the dashboard setting and removes nothing', () => {
    const d = hostingSetup(base({ cfg: { ...CFG, blockHosts: ['Old.example'] }, blockHosts: ['bad.example', 'old.example'] })).deps;
    expect(d.blockHosts).toEqual(['old.example', 'bad.example']);
  });
  it('the dashboard list alone is as before', () => {
    expect(hostingSetup(base({ cfg: { ...CFG, blockHosts: ['Old.example'] } })).deps.blockHosts).toEqual(['old.example']);
  });
  it('the agency list is not touched', () => {
    expect(hostingSetup(base({ blockHosts: ['bad.example'] })).deps).not.toHaveProperty('agencyHosts');
  });
  it('startHostingSave gives blockHosts to the setup', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: pic(OTHER), orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, blockHosts: ['other.com'] });
    expect(s.use).toBe(true);
    expect(s.deps.blockHosts).toEqual(['other.com']);
  });
});

describe('the Save refuses pictures from the websites of blockHosts (Part 7aa)', () => {
  it('without blockHosts an ordinary website is hosted as before', async () => {
    const w = world('{}');
    const r = await run(w, pic(OTHER));
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
    expect(hostedCount(w)).toBe(1);
  });
  it('with the website in blockHosts the picture is NOT fetched and NOT hosted', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    const r = await run(w, pic(OTHER));
    expect(fetchedUrls(w)).toEqual([]);
    expect(hostedCount(w)).toBe(0);
    expect(w.commits.length).toBe(0);
    expect(r.action).not.toBe('saved');
  });
  it('the writer reads the plain sentence of the refusal', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    const r = await run(w, pic(OTHER));
    expect(r.flow.el.textContent).toContain('The owner blocked this host.');
  });
  it('a sub name of the listed website is refused too, and so is the www name', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    await run(w, `${pic('https://deep.photos.other.com/c.jpg')}\n\n${pic('https://www.other.com/e.jpg')}`);
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('another website is still hosted, in the same post as a refused one', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    const r = await run(w, `${pic(OTHER)}\n\n${pic(FINE)}`);
    expect(fetchedUrls(w)).toEqual([FINE]);
    expect(hostedCount(w)).toBe(1);
    expect(r.action).toBe('saved');
  });
  it('a website with a similar name is not refused', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    await run(w, pic('https://notother.com/z.jpg'));
    expect(fetchedUrls(w)).toEqual(['https://notother.com/z.jpg']);
  });
  it('an empty, wrong or missing blockHosts changes nothing', async () => {
    for (const t of ['{ "blockHosts": [] }', '{ "blockHosts": "other.com" }', '{ "blockHosts": [5, "bad name"] }', '{oops', 'missing']) {
      const w = world(t);
      const r = await run(w, pic(OTHER));
      expect(r.action).toBe('saved');
      expect(fetchedUrls(w)).toEqual([OTHER]);
    }
  });
  it('a list given by the caller wins over the file', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    const r = await run(w, pic(OTHER), { blockHosts: ['nothing.example'] });
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
  });
  it('the list of the dashboard setting still works and the file adds to it', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    await run(w, `${pic(OTHER)}\n\n${pic(FINE)}`, { cfg: { ...CFG, blockHosts: ['fine.example.org'] } });
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('blockHosts beats askFirst: a blocked picture is refused, not asked', async () => {
    const w = world('{ "blockHosts": ["other.com"], "askFirst": true }');
    const r = await run(w, pic(OTHER));
    expect(r.flow.el.textContent).toContain('The owner blocked this host.');
    expect(r.flow.el.textContent).not.toContain('ask first');
  });
  it('the file is read once', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    await run(w, pic(FINE));
    expect(w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length).toBe(1);
  });
  it('with "enabled": false the switch still wins first', async () => {
    const w = world('{ "enabled": false, "blockHosts": ["other.com"] }');
    const r = await run(w, pic(FINE));
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('off');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('no token or service address appears in the list the writer sees', async () => {
    const w = world('{ "blockHosts": ["other.com"] }');
    const r = await run(w, pic(OTHER));
    expect(r.flow.el.textContent).not.toContain(TOKEN);
    expect(r.flow.el.textContent).not.toContain('workers.dev');
  });
});

describe('the files say the truth about blockHosts (Part 7aa)', () => {
  it('the shipped list is still empty', () => { expect(JSON.parse(src('config/images.json')).blockHosts).toEqual([]); });
  it('the hook, the save and the setup name blockHosts', () => {
    for (const f of ['hosting-hook', 'hosting-save', 'hosting-setup']) expect(src(`public/admin/js/${f}.js`)).toContain('blockHosts');
  });
});
