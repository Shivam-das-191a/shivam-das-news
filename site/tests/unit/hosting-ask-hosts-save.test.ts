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
import { DEFAULT_AGENCY_HOSTS, needsConfirm } from '../../public/admin/js/hosted-meta.js';
// @ts-ignore
import { customAskHosts, hostingSettingsFromText, readImagesForSave } from '../../public/admin/js/images-setting.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const OTHER = 'https://photos.other.com/a.jpg';
const GETTY = 'https://media.gettyimages.com/b.jpg';
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
const run = (w: any, pic: string, o: any = {}) => runHostingSave({ cfg: CFG, gh: w.gh, next, body: `![A picture](${pic})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, ...o });

describe('customAskHosts: only valid website names', () => {
  it('keeps valid names, lower case, no repeat', () => { expect(customAskHosts(['Photos.Other.com', 'photos.other.com', 'agency.example'])).toEqual(['photos.other.com', 'agency.example']); });
  it('drops bad entries and keeps the good ones', () => { expect(customAskHosts(['', 5, null, 'bad name', 'https://x.com/a', 'ok.example'])).toEqual(['ok.example']); });
  it.each([undefined, null, 5, 'a.com', {}, [], [''], [5], ['bad name'], ['http://a.com']])('%j gives undefined', (v: any) => { expect(customAskHosts(v)).toBeUndefined(); });
  it('at most 200 names, and the input is not changed', () => {
    const many = Array.from({ length: 250 }, (_, i) => `h${i}.example`);
    const copy = [...many];
    expect(customAskHosts(many)!.length).toBe(200);
    expect(many).toEqual(copy);
  });
});

describe('the settings reader gives askHosts (Part 7y)', () => {
  it('a list with a valid name is given as askHosts', () => {
    expect(hostingSettingsFromText('{ "askHosts": ["Agency.example", "x"] }')).toEqual({ on: true, quality: undefined, askHosts: ['agency.example', 'x'] });
  });
  it('no key askHosts for an empty, missing or wrong list', () => {
    for (const t of ['{}', '{ "askHosts": [] }', '{ "askHosts": "a.com" }', '{ "askHosts": [5] }', '{ "askHosts": null }', '[]', '{oops', '']) {
      expect(Object.prototype.hasOwnProperty.call(hostingSettingsFromText(t), 'askHosts')).toBe(false);
    }
  });
  it('the order and the hosts both come from one read', async () => {
    const gh: any = { getText: vi.fn(async () => ({ text: '{ "nameOrder": ["caption", "alt", "handle"], "askHosts": ["a.example"] }', sha: 's' })) };
    expect(await readImagesForSave(gh, { contentRoot: 'site' })).toEqual({ on: true, quality: undefined, nameOrder: ['caption', 'alt', 'handle'], askHosts: ['a.example'] });
    expect(gh.getText).toHaveBeenCalledTimes(1);
  });
});

describe('hostingSetup adds askHosts to the agency list (Part 7y)', () => {
  const base = (o: any = {}) => ({ cfg: CFG, gh: world('{}').gh, postPath: NEW_PATH, serializePost: () => 'x', ...o });
  it('without askHosts nothing changes: no list in deps, so the starting list is used', () => {
    expect(hostingSetup(base()).deps).not.toHaveProperty('agencyHosts');
    for (const v of [undefined, [], [5], 'a.com', ['bad name']]) expect(hostingSetup(base({ askHosts: v })).deps).not.toHaveProperty('agencyHosts');
  });
  it('askHosts is added to the starting list and removes nothing', () => {
    const d = hostingSetup(base({ askHosts: ['agency.example'] })).deps;
    expect(d.agencyHosts).toEqual([...DEFAULT_AGENCY_HOSTS, 'agency.example']);
  });
  it('askHosts is added to the list of the dashboard setting', () => {
    const d = hostingSetup(base({ cfg: { ...CFG, agencyHosts: ['Getty.com'] }, askHosts: ['agency.example', 'getty.com'] })).deps;
    expect(d.agencyHosts).toEqual(['getty.com', 'agency.example']);
  });
  it('a host that is already on the list is not repeated', () => {
    const d = hostingSetup(base({ askHosts: ['reuters.com', 'agency.example'] })).deps;
    expect(d.agencyHosts.filter((h: string) => h === 'reuters.com').length).toBe(1);
    expect(d.agencyHosts).toContain('agency.example');
  });
  it('the starting list itself is never changed', () => {
    const copy = [...DEFAULT_AGENCY_HOSTS];
    hostingSetup(base({ askHosts: ['agency.example'] }));
    expect(DEFAULT_AGENCY_HOSTS).toEqual(copy);
  });
  it('the list makes needsConfirm say yes for the new website and for its sub names', () => {
    const d = hostingSetup(base({ askHosts: ['other.com'] })).deps;
    expect(needsConfirm(OTHER, { agencyHosts: d.agencyHosts })).toBe(true);
    expect(needsConfirm('https://x.other.com/a.jpg', { agencyHosts: d.agencyHosts })).toBe(true);
    expect(needsConfirm('https://elsewhere.org/a.jpg', { agencyHosts: d.agencyHosts })).toBe(false);
    expect(needsConfirm(GETTY, { agencyHosts: d.agencyHosts })).toBe(true);
  });
  it('startHostingSave gives askHosts to the setup', () => {
    const w = world('{}');
    const s = startHostingSave({ cfg: CFG, gh: w.gh, next, body: `![One](${OTHER})`, orig: null, newPath: NEW_PATH, tree: [], fetch: w.fetchFn, optimizeDeps: { prepare: w.prepare }, askHosts: ['other.com'] });
    expect(s.use).toBe(true);
    expect(s.deps.agencyHosts).toContain('other.com');
  });
});

describe('the Save waits for the writer on the websites of askHosts (Part 7y)', () => {
  it('without askHosts an ordinary website is hosted as before', async () => {
    const w = world('{}');
    const r = await run(w, OTHER);
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
    expect(hostedCount(w)).toBe(1);
  });
  it('with the website in askHosts the picture is NOT fetched and NOT hosted', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    const r = await run(w, OTHER);
    expect(fetchedUrls(w)).toEqual([]);
    expect(hostedCount(w)).toBe(0);
    expect(r.action).not.toBe('saved');
  });
  it('a sub name of the listed website waits too', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    await run(w, 'https://deep.photos.other.com/c.jpg');
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('another website is still hosted', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    const r = await run(w, 'https://fine.example.org/d.jpg');
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual(['https://fine.example.org/d.jpg']);
  });
  it('the built-in agency list still waits when askHosts is set', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    await run(w, GETTY);
    expect(fetchedUrls(w)).toEqual([]);
  });
  it('an empty, wrong or missing askHosts changes nothing', async () => {
    for (const t of ['{ "askHosts": [] }', '{ "askHosts": "other.com" }', '{ "askHosts": [5, "bad name"] }', '{oops', 'missing']) {
      const w = world(t);
      const r = await run(w, OTHER);
      expect(r.action).toBe('saved');
      expect(fetchedUrls(w)).toEqual([OTHER]);
    }
  });
  it('a list given by the caller wins over the file', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    const r = await run(w, OTHER, { askHosts: ['nothing.example'] });
    expect(r.action).toBe('saved');
    expect(fetchedUrls(w)).toEqual([OTHER]);
  });
  it('the file is read once', async () => {
    const w = world('{ "askHosts": ["other.com"], "nameOrder": ["oldName", "alt", "handle"] }');
    await run(w, 'https://fine.example.org/d.jpg');
    expect(w.gh.getText.mock.calls.filter((c: any[]) => c[0] === IMG).length).toBe(1);
  });
  it('with "enabled": false nothing is read for pictures and nothing is hosted', async () => {
    const w = world('{ "enabled": false, "askHosts": ["other.com"] }');
    const r = await run(w, 'https://fine.example.org/d.jpg');
    expect(r.action).toBe('normal');
    expect(r.reason).toBe('off');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });
  it('no token is shown in any message', async () => {
    const w = world('{ "askHosts": ["other.com"] }');
    const r = await run(w, OTHER);
    expect(JSON.stringify({ a: r.action, m: r.message })).not.toContain(TOKEN);
  });
});

describe('the files carry askHosts (Part 7y)', () => {
  it('the hook, the save and the setup pass askHosts on', () => {
    expect(src('public/admin/js/hosting-hook.js')).toContain('fromFile.askHosts');
    expect(src('public/admin/js/hosting-save.js')).toContain('askHosts: o.askHosts');
    expect(src('public/admin/js/hosting-setup.js')).toContain('customAskHosts(o.askHosts)');
  });
});
