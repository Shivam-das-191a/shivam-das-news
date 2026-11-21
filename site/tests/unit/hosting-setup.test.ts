import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { hostingSetup, hostingEnabled, mediaPathOf, copiesEnabled } from '../../public/admin/js/hosting-setup.js';
// @ts-ignore
import { savePostWithHosting } from '../../public/admin/js/hosting-pipeline.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TOKEN = 'ghp_abcdefghijklmnop1234';
const EP = 'https://news-images.name.workers.dev';
const CFG = { repo: 'a/b', branch: 'main', contentRoot: 'site', siteUrl: 'https://shivam-das-news.pages.dev', imagesUrl: EP };
const serializePost = (p: any) => `POST:${p.body}`;
const gh = (extra: any = {}) => ({ token: TOKEN, commitFiles: vi.fn(async () => ({ sha: 'abc' })), getText: vi.fn(async () => { const e: any = new Error('x'); e.status = 404; throw e; }), ...extra });
const base = (extra: any = {}) => ({ cfg: CFG, gh: gh(), postPath: 'site/content/blogs/entertainment/a.md', serializePost, ...extra });

describe('hostingEnabled', () => {
  it('is true only for a valid https address', () => {
    expect(hostingEnabled(CFG)).toBe(true);
    expect(hostingEnabled({ imagesUrl: EP + '/fetch' })).toBe(true);
    for (const bad of [undefined, null, {}, { imagesUrl: '' }, { imagesUrl: '   ' }, { imagesUrl: 'http://x.workers.dev' }, { imagesUrl: 'not a url' }, { imagesUrl: 5 }, { imagesUrl: 'https://u:p@x.dev' }, 'text', []]) expect(hostingEnabled(bad as any)).toBe(false);
  });
});

describe('mediaPathOf', () => {
  it('follows contentRoot and falls back to site', () => {
    expect(mediaPathOf({ contentRoot: 'site' })).toBe('site/config/media.json');
    expect(mediaPathOf({ contentRoot: '/site/' })).toBe('site/config/media.json');
    expect(mediaPathOf({ contentRoot: 'web/site' })).toBe('web/site/config/media.json');
    expect(mediaPathOf({ contentRoot: '' })).toBe('config/media.json');
    expect(mediaPathOf({})).toBe('site/config/media.json');
    expect(mediaPathOf(null as any)).toBe('site/config/media.json');
  });
});

describe('hostingSetup: off and plain failures', () => {
  it('a missing or empty imagesUrl means OFF', () => {
    for (const cfg of [{ ...CFG, imagesUrl: '' }, { ...CFG, imagesUrl: '  ' }, { repo: 'a/b' }, {}]) {
      const r = hostingSetup(base({ cfg }));
      expect(r.ok).toBe(false);
      expect(r.off).toBe(true);
      expect(r.message).toMatch(/switched off/);
    }
  });
  it('a bad address is a plain sentence, not off, and the address is not in it', () => {
    for (const bad of ['http://secret-host.example/x', 'not a url', 'https://u:p@secret-host.example', 'https://secret-host.example/other']) {
      const r = hostingSetup(base({ cfg: { ...CFG, imagesUrl: bad } }));
      expect(r.ok).toBe(false);
      expect(r.off).toBe(false);
      expect(r.message).not.toMatch(/secret-host/);
    }
  });
  it('no GitHub client, a half client, no post path or no serializer are plain sentences', () => {
    for (const x of [{ gh: null }, { gh: {} }, { gh: { commitFiles() {} } }, { gh: { getText() {} } }]) {
      expect(hostingSetup(base(x))).toMatchObject({ ok: false, off: false, message: 'There is no connection to GitHub.' });
    }
    for (const x of [{ postPath: '' }, { postPath: '   ' }, { postPath: undefined }, { serializePost: undefined }, { serializePost: 'no' }]) {
      expect(hostingSetup(base(x))).toMatchObject({ ok: false, off: false, message: 'The dashboard is not set up to save pictures.' });
    }
  });
  it('never throws on garbage', () => {
    for (const g of [undefined, null, 5, 'x', [], { cfg: 5 }, { cfg: [], gh: [] }, { cfg: { imagesUrl: {} } }, { cfg: { get imagesUrl() { throw new Error('boom'); } } }]) {
      expect(() => hostingSetup(g as any)).not.toThrow();
      expect(hostingSetup(g as any).ok).toBe(false);
    }
  });
});

describe('hostingSetup: the deps', () => {
  it('gives exactly what savePostWithHosting reads', () => {
    const r = hostingSetup(base());
    expect(r.ok).toBe(true);
    const d = r.deps;
    expect(Object.keys(d).sort()).toEqual(['existing', 'fetchPictures', 'gh', 'mediaPath', 'optimize', 'ownHosts', 'postPath', 'serializePost'].sort());
    expect(d.mediaPath).toBe('site/config/media.json');
    expect(d.postPath).toBe('site/content/blogs/entertainment/a.md');
    expect(typeof d.fetchPictures).toBe('function');
    expect(typeof d.optimize).toBe('function');
    expect(d.ownHosts).toEqual(['shivam-das-news.pages.dev']);
    expect(d.existing).toEqual([]);
    expect(d).not.toHaveProperty('token');
    expect(d).not.toHaveProperty('dryRun');
    expect(d).not.toHaveProperty('confirmed');
  });
  it('ownHosts: the site name plus the extra names, clean, lower case, no repeat', () => {
    const r = hostingSetup(base({ cfg: { ...CFG, ownHosts: ['News.Example.com', 'https://www2.example.com/x', 'shivam-das-news.pages.dev', '', 5, null, 'news.example.com.'] } }));
    expect(r.deps.ownHosts).toEqual(['shivam-das-news.pages.dev', 'news.example.com', 'www2.example.com']);
  });
  it('a list of names is cut at 200', () => {
    const many = Array.from({ length: 500 }, (_, i) => `h${i}.example.com`);
    const r = hostingSetup(base({ cfg: { ...CFG, blockHosts: many } }));
    expect(r.deps.blockHosts).toHaveLength(200);
    expect(r.deps.blockHosts[0]).toBe('h0.example.com');
  });
  it('ownHosts is empty when the config has neither, and a bad siteUrl is ignored', () => {
    expect(hostingSetup(base({ cfg: { imagesUrl: EP } })).deps.ownHosts).toEqual([]);
    expect(hostingSetup(base({ cfg: { imagesUrl: EP, siteUrl: 'nonsense' } })).deps.ownHosts).toEqual([]);
  });
  it('agencyHosts and blockHosts are passed only when the config has a list', () => {
    const none = hostingSetup(base()).deps;
    expect(none).not.toHaveProperty('agencyHosts');
    expect(none).not.toHaveProperty('blockHosts');
    const some = hostingSetup(base({ cfg: { ...CFG, agencyHosts: ['Getty.com', 'getty.com', 7], blockHosts: ['Bad.example'] } })).deps;
    expect(some.agencyHosts).toEqual(['getty.com']);
    expect(some.blockHosts).toEqual(['bad.example']);
    expect(hostingSetup(base({ cfg: { ...CFG, agencyHosts: 'getty.com', blockHosts: {} } })).deps).not.toHaveProperty('agencyHosts');
  });
  it('existing keeps only strings; contentRoot changes the media path', () => {
    const r = hostingSetup(base({ cfg: { ...CFG, contentRoot: 'web' }, existing: ['/media/a.webp', 5, null, '/media/b.webp'] }));
    expect(r.deps.existing).toEqual(['/media/a.webp', '/media/b.webp']);
    expect(r.deps.mediaPath).toBe('web/config/media.json');
    expect(hostingSetup(base({ existing: 'no' as any })).deps.existing).toEqual([]);
  });
  it('does not change the config it was given', () => {
    const cfg = JSON.parse(JSON.stringify({ ...CFG, ownHosts: ['A.com'], agencyHosts: ['B.com'] }));
    const copy = JSON.parse(JSON.stringify(cfg));
    hostingSetup(base({ cfg }));
    expect(cfg).toEqual(copy);
  });
});

describe('hostingSetup: the token', () => {
  it('goes only to the Worker call, as a Bearer header, to the exact /fetch address', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const { deps } = hostingSetup(base({ fetch: f }));
    await deps.fetchPictures(['https://other.com/a.jpg']);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe(EP + '/fetch');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.credentials).toBe('omit');
  });
  it('a failed call gives a plain sentence without the token or the address', async () => {
    const f = vi.fn(async () => { throw new Error(`down ${EP} ${TOKEN}`); });
    const { deps } = hostingSetup(base({ fetch: f }));
    const r = await deps.fetchPictures(['https://other.com/a.jpg']);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).not.toContain('workers.dev');
  });
  it('a bad token shape is refused before any call', async () => {
    const f = vi.fn();
    const { deps } = hostingSetup(base({ gh: gh({ token: 'x y' }), fetch: f as any }));
    const r = await deps.fetchPictures(['https://other.com/a.jpg']);
    expect(r).toMatchObject({ ok: false, reason: 'sign_in' });
    expect(f).not.toHaveBeenCalled();
  });
  it('no message of a failed setup holds the token', () => {
    for (const x of [{ cfg: { ...CFG, imagesUrl: 'http://x' } }, { postPath: '' }, { gh: { token: TOKEN } }]) {
      expect(JSON.stringify(hostingSetup(base(x)))).not.toContain(TOKEN);
    }
  });
});

describe('hostingSetup: joined to the real pipeline', () => {
  const OLD = 'https://other.com/a.jpg';
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
  const post = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: `![A phone](${OLD})` };

  it('a preview with the setup deps fetches through the Worker address and writes nothing', async () => {
    const f = vi.fn(async (_u: string, init: any) => {
      const urls = JSON.parse(init.body).urls as string[];
      return new Response(JSON.stringify({ results: urls.map((url) => ({ url, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...jpeg)), size: jpeg.length })) }), { status: 200 });
    });
    const g = gh();
    const optimizeDeps = { prepare: vi.fn(async () => ({ bytes: jpeg.slice(0, 20), width: 1600, height: 900, ext: 'webp' })), makeBlob: (b: any) => new Blob([b]) };
    const s = hostingSetup({ ...base({ gh: g, fetch: f }), optimizeDeps });
    expect(s.ok).toBe(true);
    const r = await savePostWithHosting(post, { ...s.deps, dryRun: true });
    expect(f).toHaveBeenCalled();
    expect((f.mock.calls[0] as any)[0]).toBe(EP + '/fetch');
    expect(g.commitFiles).not.toHaveBeenCalled();
    expect(r.status).toBe('preview');
    expect(r.run.items.map((i: any) => i.status)).toEqual(['hosted']);
    expect(r.commit).toBeNull();
  });
  it('a post without outside pictures asks the Worker nothing', async () => {
    const f = vi.fn();
    const s = hostingSetup(base({ fetch: f as any }));
    const r = await savePostWithHosting({ ...post, body: 'Only text.' }, { ...s.deps, dryRun: true });
    expect(f).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.commit).toBeNull();
  });
});

describe('hosting-setup.js source', () => {
  const s = src('public/admin/js/hosting-setup.js');
  it('does not fetch, store, eval or touch the page by itself', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.']) expect(s).not.toContain(w);
  });
  it('is not imported by any other file yet', () => {
    for (const p of ['public/admin/js/app.js', 'public/admin/js/main.js', 'public/admin/js/hosting-flow.js', 'public/admin/js/hosting-screen.js']) expect(src(p)).not.toContain('hosting-setup');
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('the copies switch imageCopies (Part 4c-4e)', () => {
  const webp = (n = 1) => Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, ...new Array(20).fill(n)]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(7)]);
  const OLD = 'https://other.com/a.jpg';
  const post = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: `![A phone](${OLD})` };
  const worker = () => vi.fn(async (_u: string, init: any) => {
    const urls = JSON.parse(init.body).urls as string[];
    return new Response(JSON.stringify({ results: urls.map((url) => ({ url, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...jpeg)), size: jpeg.length })) }), { status: 200 });
  });
  const run = async (cfg: any, width = 1600) => {
    const g = gh();
    const resize = vi.fn(async () => webp(2));
    const optimizeDeps = { prepare: vi.fn(async () => ({ bytes: webp(1), width, height: Math.round(width * 0.5625), ext: 'webp' })), makeBlob: (b: any) => new Blob([b]) };
    const s = hostingSetup({ ...base({ cfg, gh: g, fetch: worker() as any }), optimizeDeps, copyDeps: { resize } });
    expect(s.ok).toBe(true);
    const r = await savePostWithHosting(post, s.deps);
    const entries: any[] = (g.commitFiles.mock.calls[0] as any)?.[0] ?? [];
    return { s, r, entries, resize };
  };

  it('is off when the key is missing or false: no makeVariants in the deps', () => {
    for (const cfg of [CFG, { ...CFG, imageCopies: false }]) {
      const r = hostingSetup(base({ cfg }));
      expect(r.ok).toBe(true);
      expect(r.deps).not.toHaveProperty('makeVariants');
    }
  });
  it('only the value true switches it on', () => {
    for (const bad of ['true', 'on', 'yes', 1, 0, null, undefined, {}, [], [true], false]) {
      expect(copiesEnabled({ ...CFG, imageCopies: bad }), String(bad)).toBe(false);
      expect(hostingSetup(base({ cfg: { ...CFG, imageCopies: bad } })).deps, String(bad)).not.toHaveProperty('makeVariants');
    }
    expect(copiesEnabled({ ...CFG, imageCopies: true })).toBe(true);
    expect(typeof hostingSetup(base({ cfg: { ...CFG, imageCopies: true } })).deps.makeVariants).toBe('function');
  });
  it('copiesEnabled never throws on garbage', () => {
    for (const bad of [undefined, null, 5, 'x', []]) expect(copiesEnabled(bad as any)).toBe(false);
  });
  it('it needs imagesUrl as well: without it the whole feature is off', () => {
    const r = hostingSetup(base({ cfg: { ...CFG, imagesUrl: '', imageCopies: true } }));
    expect(r.ok).toBe(false);
    expect(r.off).toBe(true);
  });
  it('the other deps are the same with the switch on, plus makeVariants', () => {
    const on = hostingSetup(base({ cfg: { ...CFG, imageCopies: true } })).deps;
    expect(Object.keys(on).sort()).toEqual(['existing', 'fetchPictures', 'gh', 'makeVariants', 'mediaPath', 'optimize', 'ownHosts', 'postPath', 'serializePost'].sort());
  });
  it('joined to the real pipeline, switch OFF: the commit holds the picture and no copy', async () => {
    const { r, entries, resize } = await run(CFG);
    expect(r.ok).toBe(true);
    expect(r.copies).toEqual([]);
    expect(resize).not.toHaveBeenCalled();
    expect(entries.some((e) => /\.\d+w\.webp$/.test(e.path))).toBe(false);
  });
  it('joined to the real pipeline, switch ON: the commit holds the picture and its copies (1600 wide gives 480, 800, 1200)', async () => {
    const { r, entries, resize } = await run({ ...CFG, imageCopies: true });
    expect(r.ok).toBe(true);
    expect(r.copies.map((c: any) => [c.status, c.widths])).toEqual([['made', [480, 800, 1200]]]);
    expect(resize).toHaveBeenCalledTimes(3);
    const copies = entries.filter((e) => /\.\d+w\.webp$/.test(e.path)).map((e) => e.path.match(/\.(\d+)w\.webp$/)[1]);
    expect(copies.sort()).toEqual(['1200', '480', '800']);
  });
  it('a picture of 480 pixels or less gets no copy even with the switch on', async () => {
    const { r, entries } = await run({ ...CFG, imageCopies: true }, 480);
    expect(r.ok).toBe(true);
    expect(entries.some((e) => /\.\d+w\.webp$/.test(e.path))).toBe(false);
  });
  it('a preview never makes copies, even with the switch on', async () => {
    const g = gh(); const resize = vi.fn(async () => webp(2));
    const optimizeDeps = { prepare: async () => ({ bytes: webp(1), width: 1600, height: 900, ext: 'webp' }), makeBlob: (b: any) => new Blob([b]) };
    const s = hostingSetup({ ...base({ cfg: { ...CFG, imageCopies: true }, gh: g, fetch: worker() as any }), optimizeDeps, copyDeps: { resize } });
    const r = await savePostWithHosting(post, { ...s.deps, dryRun: true });
    expect(r.status).toBe('preview');
    expect(resize).not.toHaveBeenCalled();
    expect(g.commitFiles).not.toHaveBeenCalled();
  });
  it('the real admin/config.json has the switch, and it is false (off until the owner turns it on)', () => {
    const j = JSON.parse(src('public/admin/config.json'));
    expect(j.imageCopies).toBe(false);
  });
  it('the source names the maker only behind the switch', () => {
    const s = src('public/admin/js/hosting-setup.js');
    expect((s.match(/makeVariantMaker\(/g) || []).length).toBe(1);
    expect(s).toContain('if (copiesEnabled(cfg)) deps.makeVariants = makeVariantMaker(');
  });
});
