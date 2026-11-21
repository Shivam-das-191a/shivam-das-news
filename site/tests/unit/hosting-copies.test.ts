import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { addCopiesToRun } from '../../public/admin/js/hosting-copies.js';
// @ts-ignore plain JS module
import { buildHostingCommit, commitHosting } from '../../public/admin/js/hosting-commit.js';
// @ts-ignore plain JS module
import { savePostWithHosting } from '../../public/admin/js/hosting-pipeline.js';
// @ts-ignore plain JS module
import { makeVariantMaker, makeVariants } from '../../public/admin/js/hosting-optimize.js';
// @ts-ignore plain JS module
import { srcsetValue } from '../../public/admin/js/hosting-srcset.js';

afterEach(() => { vi.unstubAllGlobals(); });

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const enc = (s: string) => new TextEncoder().encode(s);
const webp = (...extra: number[]) => Uint8Array.from([...enc('RIFF'), 0, 0, 0, 0, ...enc('WEBP'), ...extra]);
const SRC = '/media/2026/11/a.webp';
const PATH = 'site/public/media/2026/11/a.webp';
const row = (width = 1600, height = 900) => ({ alt: 'x', sourceUrl: 'https://other.com/a.jpg', sourceHost: 'other.com', sha256: 'a'.repeat(64), width, height, bytes: 20, hostedAt: '2026-11-17T01:02:03Z' });
const file = (s = SRC, p = PATH, b = webp(1)) => ({ src: s, path: p, bytes: b });
const run = (files: any[] = [file()], map: any = { [SRC]: row() }) => ({ changed: true, post: { handle: 'phone-launch', title: 'Delhi hosts the big phone launch', body: 'NEW BODY' }, files, map, items: files.map((f) => ({ url: 'u', status: 'hosted', src: f.src })) });
const maker = () => vi.fn(async (m: any) => {
  const out: any[] = [];
  for (const w of [480, 800, 1200, 1600].filter((x) => x < m.width)) out.push({ width: w, height: Math.max(1, Math.round((m.height * w) / m.width)), path: m.path.replace(/\.webp$/, `.${w}w.webp`), bytes: webp(w & 255, w >> 8) });
  return out;
});

describe('addCopiesToRun: the copies join the run', () => {
  it('adds each copy right after its picture and notes the widths in the media row', async () => {
    const mk = maker();
    const { run: out, copies } = await addCopiesToRun(run(), mk);
    expect(out.files.map((f: any) => f.path)).toEqual([PATH, 'site/public/media/2026/11/a.480w.webp', 'site/public/media/2026/11/a.800w.webp', 'site/public/media/2026/11/a.1200w.webp']);
    expect(out.files.slice(1).map((f: any) => [f.src, f.variant])).toEqual([[SRC, 480], [SRC, 800], [SRC, 1200]]);
    expect(out.map[SRC].variants).toEqual([480, 800, 1200]);
    expect(out.map[SRC]).toMatchObject({ alt: 'x', width: 1600, height: 900, sha256: 'a'.repeat(64) }); // the other keys stay
    expect(copies).toEqual([{ src: SRC, status: 'made', widths: [480, 800, 1200] }]);
    expect(mk).toHaveBeenCalledWith({ path: SRC, bytes: webp(1), width: 1600, height: 900 });
  });
  it('does not change the input run, its files, its map or its bytes', async () => {
    const r = run();
    const before = JSON.stringify({ ...r, files: r.files.map((f) => ({ ...f, bytes: Array.from(f.bytes) })) });
    const out = (await addCopiesToRun(r, maker())).run;
    expect(out).not.toBe(r);
    expect(JSON.stringify({ ...r, files: r.files.map((f) => ({ ...f, bytes: Array.from(f.bytes) })) })).toBe(before);
    expect(r.map[SRC]).not.toHaveProperty('variants');
    expect(out.post).toBe(r.post);
    expect(out.items).toBe(r.items);
  });
  it('works for several pictures, each with its own sizes', async () => {
    const B = '/media/2026/11/b.webp';
    const r = run([file(), file(B, 'site/public/media/2026/11/b.webp', webp(2))], { [SRC]: row(1600, 900), [B]: row(1000, 500) });
    const out = await addCopiesToRun(r, maker());
    expect(out.run.files.map((f: any) => f.path)).toEqual([PATH, 'site/public/media/2026/11/a.480w.webp', 'site/public/media/2026/11/a.800w.webp', 'site/public/media/2026/11/a.1200w.webp', 'site/public/media/2026/11/b.webp', 'site/public/media/2026/11/b.480w.webp', 'site/public/media/2026/11/b.800w.webp']);
    expect(out.run.map[B].variants).toEqual([480, 800]);
    expect(out.copies.map((c: any) => [c.src, c.status])).toEqual([[SRC, 'made'], [B, 'made']]);
  });
  it('a GIF and a picture of 480 pixels or less get no copy and the maker is not called', async () => {
    const mk = maker();
    const G = '/media/2026/11/spin.gif';
    const S = '/media/2026/11/small.webp';
    const r = run([file(G, 'site/public/media/2026/11/spin.gif', enc('GIF89a....')), file(S, 'site/public/media/2026/11/small.webp')], { [G]: row(300, 200), [S]: row(480, 300) });
    const out = await addCopiesToRun(r, mk);
    expect(mk).not.toHaveBeenCalled();
    expect(out.run.files).toHaveLength(2);
    expect(out.copies).toEqual([{ src: G, status: 'none', widths: [], reason: 'cannot' }, { src: S, status: 'none', widths: [], reason: 'small' }]);
    expect(out.run.map[G]).not.toHaveProperty('variants');
    expect(out.run.map[S]).not.toHaveProperty('variants');
  });
  it('a .webp outside /media/ and a copy name get no copy (cannot) and the maker is not called', async () => {
    const mk = maker();
    const O1 = '/other/b.webp';
    const C1 = '/media/2026/11/a.480w.webp';
    const r = run([file(O1, 'site/other/b.webp'), file(C1, 'site/public/media/2026/11/a.480w.webp')], { [O1]: row(), [C1]: row() });
    const out = await addCopiesToRun(r, mk);
    expect(mk).not.toHaveBeenCalled();
    expect(out.copies.map((c: any) => [c.status, c.reason])).toEqual([['none', 'cannot'], ['none', 'cannot']]);
    expect(out.run.files).toHaveLength(2);
  });
  it('a failed maker means no copy and no variants for that picture; the next picture is still done', async () => {
    const B = '/media/2026/11/b.webp';
    const mk = vi.fn(async (m: any) => { if (m.path === SRC) throw new Error('canvas gone'); return maker()(m); });
    const r = run([file(), file(B, 'site/public/media/2026/11/b.webp', webp(2))], { [SRC]: row(), [B]: row() });
    const out = await addCopiesToRun(r, mk);
    expect(out.copies[0]).toEqual({ src: SRC, status: 'failed', widths: [], message: 'canvas gone' });
    expect(out.copies[1].status).toBe('made');
    expect(out.run.map[SRC]).not.toHaveProperty('variants');
    expect(out.run.files.filter((f: any) => f.src === SRC)).toHaveLength(1);
    expect(out.run.map[B].variants).toEqual([480, 800, 1200]);
  });
  it('a copy that does not match the plan means no copy for that picture', async () => {
    const good = await maker()({ path: SRC, width: 1600, height: 900 });
    const bad: Record<string, (g: any[]) => any> = {
      'too few': (g) => g.slice(1),
      'too many': (g) => [...g, g[0]],
      'not an array': () => null,
      'wrong width': (g) => g.map((c, i) => (i === 1 ? { ...c, width: 801 } : c)),
      'wrong height': (g) => g.map((c, i) => (i === 0 ? { ...c, height: 1 } : c)),
      'wrong path': (g) => g.map((c, i) => (i === 2 ? { ...c, path: '/media/2026/11/other.1200w.webp' } : c)),
      'wrong order': (g) => [g[1], g[0], g[2]],
    };
    for (const [name, f] of Object.entries(bad)) {
      const out = await addCopiesToRun(run(), async () => f(good));
      expect(out.copies[0], name).toMatchObject({ status: 'failed', message: 'The copies do not match the plan, so none was saved.' });
      expect(out.run.files, name).toHaveLength(1);
      expect(out.run.map[SRC], name).not.toHaveProperty('variants');
    }
  });
  it('a copy that is empty or not WebP means no copy for that picture', async () => {
    const good = await maker()({ path: SRC, width: 1600, height: 900 });
    for (const badBytes of [new Uint8Array(0), enc('RIFF....WEBX'), [1, 2, 3], null]) {
      const out = await addCopiesToRun(run(), async () => good.map((c: any, i: number) => (i === 1 ? { ...c, bytes: badBytes } : c)));
      expect(out.copies[0]).toMatchObject({ status: 'failed', message: 'The 800 pixel copy is not a WebP file, so none was saved.' });
      expect(out.run.files).toHaveLength(1);
    }
  });
  it('a picture whose size is not in the media row gets a plain sentence, never a guess', async () => {
    const mk = maker();
    const out = await addCopiesToRun(run([file()], { [SRC]: { alt: 'x' } }), mk);
    expect(out.copies[0]).toMatchObject({ status: 'failed', message: 'The size of the picture is not known, so no smaller copies were made.' });
    expect(mk).not.toHaveBeenCalled();
  });
  it('the message of an error is one plain line of at most 200 characters', async () => {
    const out = await addCopiesToRun(run(), async () => { throw new Error('a'.repeat(500)); });
    expect(out.copies[0].message).toHaveLength(200);
    const out2 = await addCopiesToRun(run(), async () => { throw undefined; });
    expect(out2.copies[0].message).toBe('The copies could not be made.');
  });
  it('gives the run back unchanged when there is nothing to do', async () => {
    const mk = maker();
    const none = { changed: false, post: {}, files: [], map: {} };
    expect(await addCopiesToRun(none, mk)).toEqual({ run: none, copies: [] });
    const unchanged = { ...run(), changed: false };
    expect((await addCopiesToRun(unchanged, mk)).run).toBe(unchanged);
    const noFiles = run([]);
    expect((await addCopiesToRun(noFiles, mk)).run).toBe(noFiles);
    for (const bad of [null, undefined, 'x', 5]) expect(await addCopiesToRun(bad as any, mk)).toEqual({ run: bad, copies: [] });
    const r = run();
    expect((await addCopiesToRun(r, undefined as any)).run).toBe(r); // no maker means off
    expect((await addCopiesToRun(r, 'x' as any)).copies).toEqual([]);
    expect(mk).not.toHaveBeenCalled();
  });
  it('a file without src, path or bytes is skipped and kept as it is', async () => {
    const odd = { path: 'site/public/media/2026/11/x.webp' };
    const out = await addCopiesToRun(run([odd as any, file()]), maker());
    expect(out.run.files[0]).toBe(odd);
    expect(out.copies).toHaveLength(1);
  });
  it('never throws, even when the map is wrong', async () => {
    const out = await addCopiesToRun({ changed: true, files: [file()], map: null } as any, maker());
    expect(out.copies[0].status).toBe('failed');
  });
  it('the notes and the copies agree with srcsetValue of the page part (4c-5)', async () => {
    const out = await addCopiesToRun(run(), maker());
    const widths = out.run.map[SRC].variants;
    expect(srcsetValue(SRC, { width: 1600, height: 900 }).split(', ').slice(0, -1).map((s: string) => Number(s.split(' ')[1].slice(0, -1)))).toEqual(widths);
  });
});

const O = { postPath: 'site/content/blogs/entertainment/phone-launch.md', mediaPath: 'site/config/media.json', mediaDir: 'site/public/media/', serializePost: (p: any) => `POST:${p.body}` };

describe('buildHostingCommit with copies: one commit, all or nothing both ways', () => {
  it('lists the picture, its copies, then the post and the media file; counts only the picture', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    const b = buildHostingCommit(r, O);
    expect(b.files.map((f: any) => f.path)).toEqual([PATH, 'site/public/media/2026/11/a.480w.webp', 'site/public/media/2026/11/a.800w.webp', 'site/public/media/2026/11/a.1200w.webp', O.postPath, O.mediaPath]);
    expect(b.counts).toEqual({ pictures: 1, reused: 0, post: true, media: true, copies: 3 });
    expect(b.message).toBe('admin: host 1 picture for phone-launch');
    expect(b.bytes).toBe(webp(1).length + webp(480 & 255, 1).length + webp(800 & 255, 3).length + webp(1200 & 255, 4).length);
    expect(JSON.parse(b.files[5].text)[SRC].variants).toEqual([480, 800, 1200]);
    expect(b.files.every((f: any) => ('bytes' in f) !== ('text' in f))).toBe(true);
    expect(b.files.every((f: any) => !('variant' in f) && !('src' in f))).toBe(true);
  });
  it('a run without copies gives exactly what it gave before (no copies key)', () => {
    const b = buildHostingCommit(run(), O);
    expect(b.counts).toEqual({ pictures: 1, reused: 0, post: true, media: true });
  });
  it('refuses a copy that the media row does not list', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    r.map = { [SRC]: { ...r.map[SRC], variants: [480, 800] } };
    expect(() => buildHostingCommit(r, O)).toThrow('is not noted in the media file');
    r.map = { [SRC]: { ...row() } };
    expect(() => buildHostingCommit(r, O)).toThrow('is not noted in the media file');
  });
  it('refuses a width noted in the media row whose copy is not in the commit', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    r.files = r.files.filter((f: any) => f.variant !== 800);
    expect(() => buildHostingCommit(r, O)).toThrow('The 800 pixel copy of site/public/media/2026/11/a.webp is noted but missing.');
  });
  it('refuses notes that are not widths', () => {
    for (const v of ['480', [0], [1.5], [480, 'x'], { a: 1 }]) {
      const r = run([file()], { [SRC]: { ...row(), variants: v } });
      expect(() => buildHostingCommit(r, O), JSON.stringify(v)).toThrow('The copies noted for site/public/media/2026/11/a.webp are not valid.');
    }
  });
  it('refuses a copy of a picture that is not in this commit, a copy with a bad width or a bad name', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    const stray = { ...r, files: [...r.files, { src: '/media/2026/11/zzz.webp', path: 'site/public/media/2026/11/zzz.480w.webp', bytes: webp(1), variant: 480 }], map: { ...r.map, '/media/2026/11/zzz.webp': row() } };
    expect(() => buildHostingCommit(stray, O)).toThrow('has no picture in this commit');
    for (const w of [0, -480, 480.5, null, '480']) {
      const bad = { ...r, files: r.files.map((f: any) => (f.variant === 480 ? { ...f, variant: w } : f)) };
      expect(() => buildHostingCommit(bad, O), String(w)).toThrow('has no valid width');
    }
    const named = { ...r, files: r.files.map((f: any) => (f.variant === 480 ? { ...f, path: 'site/public/media/2026/11/other.480w.webp' } : f)) };
    expect(() => buildHostingCommit(named, O)).toThrow('is not named after its picture');
  });
  it('keeps the old checks: a copy path outside the media folder, used twice or empty is refused', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    expect(() => buildHostingCommit({ ...r, files: r.files.map((f: any) => (f.variant === 480 ? { ...f, path: 'site/other/a.480w.webp' } : f)) }, O)).toThrow('is outside site/public/media/');
    expect(() => buildHostingCommit({ ...r, files: [...r.files, r.files[1]] }, O)).toThrow('is used twice in one commit');
    expect(() => buildHostingCommit({ ...r, files: r.files.map((f: any) => (f.variant === 480 ? { ...f, bytes: new Uint8Array(0) } : f)) }, O)).toThrow('is empty');
  });
  it('commitHosting sends the copies in the same single commit', async () => {
    const r = (await addCopiesToRun(run(), maker())).run;
    const gh = { commitFiles: vi.fn(async () => 'SHA1') };
    const res = await commitHosting(gh, r, O);
    expect(gh.commitFiles).toHaveBeenCalledTimes(1);
    expect(res.sha).toBe('SHA1');
    expect(gh.commitFiles.mock.calls[0][0]).toHaveLength(6);
  });
});

// the pipeline
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' as string };
const NOW = new Date('2026-11-17T01:02:03.456Z');
const A = 'https://other.com/a.jpg';
const jpg = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(tag)]);
const optimize = vi.fn(async () => ({ bytes: webp(7, 7), ext: 'webp' as const, width: 1600, height: 900 }));
function service(table: Record<string, Uint8Array>) {
  return vi.fn(async (urls: string[]) => ({ ok: true, results: urls.map((url) => ({ url, ok: true, kind: 'jpg', size: table[url].length, data: btoa(String.fromCharCode(...table[url])) })) }));
}
function fakeGh() {
  const commits: { files: any[]; message: string }[] = [];
  const gh = { getText: vi.fn(async () => ({ text: '{}', sha: 's' })), commitFiles: vi.fn(async (files: any[], message: string) => { commits.push({ files, message }); return 'C-' + commits.length; }) };
  return { gh, commits };
}
const deps = (gh: any, extra: any = {}) => ({ gh, postPath: O.postPath, mediaPath: O.mediaPath, serializePost: O.serializePost, fetchPictures: service({ [A]: jpg(1) }), optimize, ownHosts: OWN, now: NOW, ...extra });
const body = `![First picture of the launch](${A})`;

describe('the pipeline with the optional dep makeVariants', () => {
  it('without the dep nothing changes: no copy, copies is an empty list', async () => {
    const { gh, commits } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body }, deps(gh));
    expect(r.status).toBe('saved');
    expect(r.copies).toEqual([]);
    expect(commits[0].files).toHaveLength(3);
    expect(r.commit.counts).toEqual({ pictures: 1, reused: 0, post: true, media: true });
  });
  it('with the dep the copies are in the ONE commit and the media row lists the widths', async () => {
    const { gh, commits } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body }, deps(gh, { makeVariants: maker() }));
    expect(r.status).toBe('saved');
    expect(commits).toHaveLength(1);
    const paths = commits[0].files.map((f: any) => f.path);
    expect(paths).toHaveLength(6);
    expect(paths[0]).toMatch(/^site\/public\/media\/2026\/11\/.+\.webp$/);
    expect(paths.slice(1, 4)).toEqual([0, 1, 2].map((i) => paths[0].replace(/\.webp$/, `.${[480, 800, 1200][i]}w.webp`)));
    expect(paths.slice(4)).toEqual([O.postPath, O.mediaPath]);
    const media = JSON.parse(commits[0].files[5].text);
    expect(Object.values(media)[0]).toMatchObject({ width: 1600, variants: [480, 800, 1200] });
    expect(r.copies).toEqual([{ src: Object.keys(media)[0], status: 'made', widths: [480, 800, 1200] }]);
    expect(r.commit.counts).toEqual({ pictures: 1, reused: 0, post: true, media: true, copies: 3 });
    expect(r.commit.message).toBe('admin: host 1 picture for phone-launch');
    expect(r.next.map[Object.keys(media)[0]].variants).toEqual([480, 800, 1200]);
  });
  it('a failed copy still saves the picture and the post, and says so in one plain sentence', async () => {
    const { gh, commits } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body }, deps(gh, { makeVariants: async () => { throw new Error('no canvas'); } }));
    expect(r.status).toBe('saved');
    expect(commits[0].files).toHaveLength(3);
    expect(r.copies[0]).toMatchObject({ status: 'failed', message: 'no canvas' });
    expect(r.message).toBe('Saved in one commit. All 1 picture is on your site. 1 picture has no smaller copies.');
    expect(Object.values(JSON.parse(commits[0].files[2].text))[0]).not.toHaveProperty('variants');
  });
  it('a preview makes no copy and never calls the maker', async () => {
    const { gh, commits } = fakeGh();
    const mk = maker();
    const r = await savePostWithHosting({ ...POST, body }, deps(gh, { makeVariants: mk, dryRun: true }));
    expect(r.status).toBe('preview');
    expect(mk).not.toHaveBeenCalled();
    expect(r.copies).toEqual([]);
    expect(commits).toHaveLength(0);
  });
  it('a failed commit changes nothing and next starts from the post as it was', async () => {
    const { gh } = fakeGh();
    gh.commitFiles = vi.fn(async () => { throw new Error('GitHub 409'); });
    const post = { ...POST, body };
    const r = await savePostWithHosting(post, deps(gh, { makeVariants: maker() }));
    expect(r.status).toBe('error');
    expect(r.next.post.body).toBe(body);
    expect(r.copies[0].status).toBe('made');
  });
  it('nothing to host means the maker is not called', async () => {
    const { gh } = fakeGh();
    const mk = maker();
    const r = await savePostWithHosting({ ...POST, body: 'No pictures here.' }, deps(gh, { makeVariants: mk }));
    expect(r.status).toBe('nothing');
    expect(mk).not.toHaveBeenCalled();
    expect(r.copies).toEqual([]);
  });
  it('works with the real makeVariantMaker and a fake canvas', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1600, height: 900, close: () => {} }));
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toBlob: (cb: any) => cb({ type: 'image/webp', arrayBuffer: async () => webp(9).buffer }) }) });
    const { gh, commits } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body }, deps(gh, { makeVariants: makeVariantMaker() }));
    expect(r.status).toBe('saved');
    expect(commits[0].files).toHaveLength(6);
    expect(r.copies[0].widths).toEqual([480, 800, 1200]);
  });
  it('makeVariants and the copies module agree on the paths', async () => {
    const list = await makeVariants({ path: SRC, bytes: webp(1), width: 1600, height: 900 }, { resize: async () => webp(2) });
    const out = await addCopiesToRun(run(), makeVariantMaker({ resize: async () => webp(2) }));
    expect(out.run.files.slice(1).map((f: any) => f.path.replace('site/public', ''))).toEqual(list.map((v: any) => v.path));
  });
});

describe('source rules (4c-3)', () => {
  const s = src('public/admin/js/hosting-copies.js');
  it('imports only hosting-srcset.js, media-meta.js and hosting-optimize.js', () => {
    expect([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort()).toEqual(['./hosting-optimize.js', './hosting-srcset.js', './media-meta.js']);
  });
  it('does not fetch, store, eval or touch the page', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.', 'Date.now', 'Math.random']) expect(s).not.toContain(w);
  });
  it('is imported only by hosting-pipeline.js; only hosting-setup.js names the maker (Part 4c-4e, behind the imageCopies switch, off by default); the other dashboard files do not', () => {
    for (const f of readdirSync(new URL('../../public/admin/js/', import.meta.url))) {
      if (f === 'hosting-copies.js') continue;
      const t = src('public/admin/js/' + f);
      if (f === 'hosting-pipeline.js') continue;
      expect(t, f).not.toContain('hosting-copies');
    }
    expect(src('public/admin/js/hosting-setup.js')).toContain('if (copiesEnabled(cfg)) deps.makeVariants = makeVariantMaker(');
    for (const f of ['hosting-save.js', 'hosting-hook.js', 'hosting-flow.js', 'app.js']) {
      expect(src('public/admin/js/' + f), f).not.toContain('makeVariants');
      expect(src('public/admin/js/' + f), f).not.toContain('makeVariantMaker');
    }
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(src('tests/unit/hosting-copies.test.ts')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
