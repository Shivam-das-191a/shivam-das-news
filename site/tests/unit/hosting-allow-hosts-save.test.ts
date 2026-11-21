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
import { customAllowHosts, hostingSettingsFromText, readImagesForSave } from '../../public/admin/js/images-setting.js';

// Phase 3c Part 7ab (PLAN 34.10, the allow list): the setting `allowHosts` of config/images.json now changes the Save of the editor.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const CDN = 'https://cdn.own-partner.com/a.jpg';
const FINE = 'https://fine.example.org/d.jpg';
const GETTY = 'https://gettyimages.com/b.jpg';
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

describe('customAllowHosts: only valid website names (Part 7ab)', () => {
  it('keeps valid names, lower case, no repeat', () => { expect(customAllowHosts(['CDN.own-partner.com', 'cdn.own-partner.com', 'ok.example'])).toEqual(['cdn.own-partner.com', 'ok.example']); });
  it('drops bad entries and keeps the good ones', () => { expect(customAllowHosts(['', 5, null, 'bad name', 'https://x.com/a', 'ok.example'])).toEqual(['ok.example']); });
  it.each([undefined, null, 5, 'a.com', {}, [], [''], [5], ['bad name'], ['http://a.com']])('%j gives undefined', (v: any) => { expect(customAllowHosts(v)).toBeUndefined(); });
  it('at most 200 names, and the input is not changed', () => {
    const many = Array.from({ length: 250 }, (_, i) => `h${i}.example`);
    const copy = [...many];
    expect(customAllowHosts(many)!.length).toBe(200);
    expect(many).toEqual(copy);
  });
});

describe('the settings reader gives allowHosts (Part 7ab)', () => {
  it('a list with a valid name is given as allowHosts', () => {
    expect(hostingSettingsFromText('{ "allowHosts": ["Cdn.example", "x"] }')).toEqual({ on: true, quality: undefined, allowHosts: ['cdn.example', 'x'] });
  });
  it('no key allowHosts for an empty, missing or wrong list', () => {
    for (const t of ['{}', '{ "allowHosts": [] }', '{ "allowHosts": "a.com" }', '{ "allowHosts": [5] }', '{ "allowHosts": null }', '[]', '{oops', '']) {
      expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(t), 'allowHosts')).toBe(false);
    }
  });
  it('the shipped file gives no allowHosts', () => {
    expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(src('config/images.json')), 'allowHosts')).toBe(false);
  });
  it('all the keys come from one read', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "allowHosts": ["c.example"], "blockHosts": ["b.example"], "askHosts": ["a.example"] }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: true, quality: undefined, askHosts: ['a.example'], blockHosts: ['b.example'], allowHosts: ['c.example'] });
    expect(gh.getText).toHaveBeenCalledTimes(1);
  });
});

describe('hostingSetup adds allowHosts to our own websites (Part 7ab)', () => {
  const base = (o: any = {}) => ({ cfg: CFG, gh: world('{}').gh, postPath: NEW_PATH, serializePost: () => 'x', ...o });
  const OWN0 = ['shivam-das-news.pages.dev'];
  it('without allowHosts nothing changes: only the site itself is ours', () => {
    expect(hostingSetup(base()).deps.ownHosts).toEqual(OWN0);
    for (const v of [undefined, [], [5], 'a.com', ['bad name']]) expect(hostingSetup(base({ allowHosts: v })).deps.ownHosts).toEqual(OWN0);
  });
  it('allowHosts is added after the site and the dashboard own websites', () => {
    expect(hostingSetup(base({ allowHosts: ['cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
    expect(hostingSetup(base({ cfg: { ...CFG, ownHosts: ['Old.example'] }, allowHosts: ['cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'old.example', 'cdn.own-partner.com']);
  });
  it('a name that is already ours is not repeated', () => {
    expect(hostingSetup(base({ allowHosts: ['shivam-das-news.pages.dev', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
  });
  it('a name of the agency starting list is ignored, with its sub names and parent names', () => {
    for (const h of ['gettyimages.com', 'media.gettyimages.com', 'com.gettyimages.com']) expect(hostingSetup(base({ allowHosts: [h] })).deps.ownHosts).toEqual(OWN0);
    expect(hostingSetup(base({ allowHosts: ['reuters.com', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
  });
  it('a name of the agency list of the dashboard or of askHosts is ignored too', () => {
    expect(hostingSetup(base({ cfg: { ...CFG, agencyHosts: ['agency.example'] }, allowHosts: ['agency.example', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
    expect(hostingSetup(base({ askHosts: ['ask.example'], allowHosts: ['ask.example', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
  });
  it('a name of the block list (dashboard or file) is ignored', () => {
    expect(hostingSetup(base({ cfg: { ...CFG, blockHosts: ['bad.example'] }, allowHosts: ['bad.example', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
    expect(hostingSetup(base({ blockHosts: ['bad.example'], allowHosts: ['sub.bad.example', 'cdn.own-partner.com'] })).deps.ownHosts).toEqual([...OWN0, 'cdn.own-partner.com']);
  });
  it('the agency list and the block list are not touched by allowHosts', () => {
    const d = hostingSetup(base({ allowHosts: ['cdn.own-partner.com'] })).deps;
    expect(d).not.toHaveProperty('agencyHosts');
    expect(d).not.toHaveProperty('blockHosts');
  });
  it('startHostingSave gives allowHosts to the setup', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: pic(FINE), orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, allowHosts: ['cdn.own-partner.com'] });
    expect(s.use).toBe(true);
    expect(s.deps.ownHosts).toContain('cdn.own-partner.com');
  });
});

describe('the Save counts the websites of allowHosts as ours (Part 7ab)', () => {
  it('without allowHosts an ordinary website is hosted as before', async () => {
    const w = world('{}');
    const r = await run(w, pic(CDN));
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([CDN]);
  });
  it('with the website in allowHosts the picture is NOT fetched and NOT hosted, and the Save goes on as before', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, pic(CDN));
    expect(fetchedUrls(w)).toEqual([]);
    expect(w.commits.length).toBe(0);
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('no_pictures');
  });
  it('another website in the same post is still hosted', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, `${pic(CDN)}\n\n${pic(FINE)}`);
    expect(fetchedUrls(w)).toEqual([FINE]);
    expect(hostedCount(w)).toBe(1);
    expect(r.action).toBe('saved');
  });
  it('the www name is the same website', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"] }');
    await run(w, pic('https://www.cdn.own-partner.com/z.jpg'));
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('a sub name is still checked and hosted (the exact name rule)', async () => {
    const w = world('{ "allowHosts": ["own-partner.com"] }');
    await run(w, pic(CDN));
    expect(fetchedUrls(w)).toEqual([CDN]);
  });
  it('an agency website in allowHosts still waits for the writer', async () => {
    const w = world('{ "allowHosts": ["gettyimages.com"] }');
    const r = await run(w, pic(GETTY));
    expect(fetchedUrls(w)).toEqual([]);
    expect(r.flow.el.textContent).toContain('picture agency');
  });
  it('a website in blockHosts and allowHosts is still refused', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"], "blockHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, pic(CDN));
    expect(fetchedUrls(w)).toEqual([]);
    expect(r.flow.el.textContent).toContain('The owner blocked this host.');
  });
  it('askFirst does not ask for pictures of allowHosts, but asks for the others', async () => {
    const w = world('{ "askFirst": true, "allowHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, `${pic(CDN)}\n\n${pic(FINE)}`);
    expect(fetchedUrls(w)).toEqual([]);
    expect(r.flow.el.textContent).toContain('ask first');
    expect(r.flow.el.textContent).not.toContain('own-partner');
  });
  it('an empty, wrong or missing allowHosts changes nothing', async () => {
    for (const t of ['{ "allowHosts": [] }', '{ "allowHosts": "cdn.own-partner.com" }', '{ "allowHosts": [5, "bad name"] }', '{oops', 'missing']) {
      const w = world(t);
      const r = await run(w, pic(CDN));
      expect(r.action).toBe('saved');
      expect(fetchedUrls(w)).toEqual([CDN]);
    }
  });
  it('a list given by the caller wins over the file', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, pic(CDN), { allowHosts: ['nothing.example'] });
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([CDN]);
  });
  it('the file is read once', async () => {
    const w = world('{ "allowHosts": ["cdn.own-partner.com"] }');
    await run(w, pic(FINE));
    expect(w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length).toBe(1);
  });
  it('with "enabled": false the switch still wins first', async () => {
    const w = world('{ "enabled": false, "allowHosts": ["cdn.own-partner.com"] }');
    const r = await run(w, pic(FINE));
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('off');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
});

describe('the files say the truth about allowHosts (Part 7ab)', () => {
  it('the shipped list is still empty', () => { expect(JSON.parse(src('config/images.json')).allowHosts).toEqual([]); });
  it('the hook, the save and the setup name allowHosts', () => {
    for (const f of ['hosting-hook', 'hosting-save', 'hosting-setup']) expect(src(`public/admin/js/${f}.js`)).toContain('allowHosts');
  });
});
