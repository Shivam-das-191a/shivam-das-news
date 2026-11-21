import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { buildHostingCommit, commitHosting } from '../../public/admin/js/hosting-commit.js';
// @ts-ignore plain JS module
import { hostPost } from '../../public/admin/js/hosting-run.js';
// @ts-ignore plain JS module
import { GitHub } from '../../public/admin/js/github.js';
// @ts-ignore plain JS module
import { stringify, parse } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain JS Worker code
import { toBase64 } from '../../../workers/images/lib.js';

afterEach(() => { vi.unstubAllGlobals(); });

const O = { postPath: 'site/content/blogs/entertainment/phone-launch.md', mediaPath: 'site/config/media.json', mediaDir: 'site/public/media/', serializePost: (p: any) => `POST:${p.body}` };
const bytes = (n: number) => new Uint8Array(20).fill(n);
const row = { alt: 'x', sourceUrl: 'https://other.com/a.jpg', sourceHost: 'other.com', sha256: 'a'.repeat(64), width: 10, height: 10, bytes: 20, hostedAt: '2026-11-17T01:02:03Z' };
const run = (extra: any = {}) => ({
  changed: true,
  post: { handle: 'phone-launch', title: 'Delhi hosts the big phone launch', body: 'NEW BODY' },
  files: [{ src: '/media/2026/11/a.webp', path: 'site/public/media/2026/11/a.webp', bytes: bytes(1) }, { src: '/media/2026/11/b.webp', path: 'site/public/media/2026/11/b.webp', bytes: bytes(2) }],
  map: { '/media/2026/11/a.webp': row, '/media/2026/11/b.webp': row, '/media/2026/10/old.webp': row },
  items: [{ url: 'u1', status: 'hosted' }, { url: 'u2', status: 'hosted' }, { url: 'u3', status: 'reuse' }, { url: 'u4', status: 'failed' }],
  ...extra,
});

describe('buildHostingCommit: the pictures, the post and the media file in one list', () => {
  it('lists the pictures, then the post, then config/media.json', () => {
    const b = buildHostingCommit(run(), O);
    expect(b.files.map((f: any) => f.path)).toEqual(['site/public/media/2026/11/a.webp', 'site/public/media/2026/11/b.webp', O.postPath, O.mediaPath]);
    expect(b.files[0]).toEqual({ path: 'site/public/media/2026/11/a.webp', bytes: bytes(1) });
    expect(b.files[2]).toEqual({ path: O.postPath, text: 'POST:NEW BODY' });
    expect(b.files[3].path).toBe(O.mediaPath);
    expect(b.files[3].text).toBe(JSON.stringify(run().map, null, 2) + '\n');
    expect(b.files[3].text.endsWith('}\n')).toBe(true);
    expect(b.files.every((f: any) => ('bytes' in f) !== ('text' in f))).toBe(true);
  });
  it('counts, size and message', () => {
    const b = buildHostingCommit(run(), O);
    expect(b.counts).toEqual({ pictures: 2, reused: 1, post: true, media: true });
    expect(b.bytes).toBe(40);
    expect(b.message).toBe('admin: host 2 pictures for phone-launch');
  });
  it('one picture says picture, and the title is used when there is no handle', () => {
    const one = run({ files: [run().files[0]], post: { title: 'Delhi   hosts\nthe big phone launch', body: 'b' } });
    expect(buildHostingCommit(one, O).message).toBe('admin: host 1 picture for Delhi hosts the big phone launch');
    expect(buildHostingCommit(run({ files: [run().files[0]], post: { body: 'b' } }), O).message).toBe('admin: host 1 picture for a post');
  });
  it('a long title is cut so the message stays one short line', () => {
    const m = buildHostingCommit(run({ post: { title: 'x'.repeat(300), body: 'b' } }), O).message;
    expect(m).toBe(`admin: host 2 pictures for ${'x'.repeat(50)}`);
    expect(m).not.toMatch(/\n/);
  });
  it('a run that only reuses pictures saves the post alone, without a new media file', () => {
    const b = buildHostingCommit(run({ files: [], items: [{ status: 'reuse' }, { status: 'reuse' }] }), O);
    expect(b.files.map((f: any) => f.path)).toEqual([O.postPath]);
    expect(b.counts).toEqual({ pictures: 0, reused: 2, post: true, media: false });
    expect(b.message).toBe('admin: use 2 hosted pictures in phone-launch');
    expect(buildHostingCommit(run({ files: [], items: [{ status: 'reuse' }] }), O).message).toBe('admin: use 1 hosted picture in phone-launch');
  });
  it('gives null (no empty commit) when nothing changed or there is no run', () => {
    expect(buildHostingCommit(run({ changed: false }), O)).toBeNull();
    expect(buildHostingCommit(null as any, O)).toBeNull();
    expect(buildHostingCommit(undefined as any, O)).toBeNull();
    expect(buildHostingCommit({} as any, O)).toBeNull();
  });
  it('does not change the run it was given', () => {
    const r = run();
    const snap = JSON.stringify([r.post, r.map, r.items, r.files.map((f: any) => [f.src, f.path, Array.from(f.bytes)])]);
    buildHostingCommit(r, O);
    expect(JSON.stringify([r.post, r.map, r.items, r.files.map((f: any) => [f.src, f.path, Array.from(f.bytes)])])).toBe(snap);
  });
});

describe('buildHostingCommit: refusals, each with a plain sentence', () => {
  it('refuses a bad post path or media path', () => {
    for (const p of ['', undefined, null, 42, '/abs/post.md', 'site/../x.md', 'site//x.md', 'a\\b.md', './x.md', 'site/x\u0000.md', 'site/' + 'a'.repeat(400) + '.md'])
      expect(() => buildHostingCommit(run(), { ...O, postPath: p })).toThrow('The path of the post file is not valid.');
    for (const p of ['', undefined, '/abs.json', 'site/../media.json'])
      expect(() => buildHostingCommit(run(), { ...O, mediaPath: p })).toThrow('The path of the media file is not valid.');
  });
  it('refuses the same file for the post and the media map', () => {
    expect(() => buildHostingCommit(run(), { ...O, mediaPath: O.postPath })).toThrow('two different files');
  });
  it('refuses a missing serializePost, an empty post text, a throwing serializePost', () => {
    expect(() => buildHostingCommit(run(), { ...O, serializePost: undefined })).toThrow('There is no way to write the post file.');
    for (const t of ['', '  \n', undefined, null, 5]) expect(() => buildHostingCommit(run(), { ...O, serializePost: () => t })).toThrow('The post file would be empty.');
    expect(() => buildHostingCommit(run(), { ...O, serializePost: () => { throw new Error('bad post'); } })).toThrow('bad post');
  });
  it('refuses a picture with a bad path, outside the media folder, used twice, empty, or on the post path', () => {
    const f = run().files[0];
    expect(() => buildHostingCommit(run({ files: [{ ...f, path: '../a.webp' }] }), O)).toThrow('has a path that is not valid');
    expect(() => buildHostingCommit(run({ files: [null] }), O)).toThrow('has a path that is not valid');
    expect(() => buildHostingCommit(run({ files: [{ ...f, path: 'site/content/a.webp' }] }), O)).toThrow('is outside site/public/media/');
    expect(() => buildHostingCommit(run({ files: [f, { ...f }] }), O)).toThrow('is used twice');
    expect(() => buildHostingCommit(run({ files: [{ ...f, path: O.postPath }] }), { ...O, mediaDir: undefined })).toThrow('is used twice');
    expect(() => buildHostingCommit(run({ files: [{ ...f, path: O.mediaPath }] }), { ...O, mediaDir: undefined })).toThrow('is used twice');
    for (const b of [new Uint8Array(0), [1, 2], null, undefined, 'abc']) expect(() => buildHostingCommit(run({ files: [{ ...f, bytes: b }] }), O)).toThrow('is empty');
  });
  it('refuses a picture without its media row, and a bad media map', () => {
    const f = run().files[0];
    expect(() => buildHostingCommit(run({ files: [{ ...f, src: '/media/2026/11/other.webp' }] }), O)).toThrow('has no media row');
    expect(() => buildHostingCommit(run({ files: [{ ...f, src: undefined }] }), O)).toThrow('has no media row');
    for (const m of [null, undefined, [], 'x']) expect(() => buildHostingCommit(run({ map: m }), O)).toThrow('The media map is not valid.');
  });
  it('mediaDir is optional', () => {
    expect(buildHostingCommit(run({ files: [{ ...run().files[0], path: 'other/a.webp' }] }), { ...O, mediaDir: undefined }).files[0].path).toBe('other/a.webp');
  });
});

/** A fake GitHub: records every request; `fail` makes a matching request fail. */
function fakeGitHub(fail: { match: RegExp; status?: number } | null = null) {
  const calls: { method: string; url: string; body: any }[] = [];
  let blob = 0;
  vi.stubGlobal('fetch', async (url: string, opts: any = {}) => {
    const path = url.replace('https://api.github.com', '');
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method, url: path, body });
    const reply = (json: any, status = 200) => ({ ok: status < 400, status, statusText: 'Error', json: async () => json });
    if (fail && fail.match.test(`${method} ${path}`)) return reply({ message: 'refused' }, fail.status ?? 500);
    if (/\/git\/ref\/heads\/main$/.test(path)) return reply({ object: { sha: 'P1' } });
    if (/\/git\/commits\/P1$/.test(path)) return reply({ tree: { sha: 'T1' } });
    if (method === 'POST' && /\/git\/blobs$/.test(path)) return reply({ sha: `blob-${++blob}` });
    if (method === 'POST' && /\/git\/trees$/.test(path)) return reply({ sha: 'T2' });
    if (method === 'POST' && /\/git\/commits$/.test(path)) return reply({ sha: 'C2' });
    if (method === 'PATCH' && /\/git\/refs\/heads\/main$/.test(path)) return reply({});
    return reply({ message: 'unexpected ' + method + ' ' + path }, 404);
  });
  return { gh: new GitHub({ token: 't', repo: 'me/site', branch: 'main' }), calls };
}

describe('commitHosting: through the real GitHub client with a fake network', () => {
  it('saves the pictures, the post and the media map in ONE commit and moves the branch once', async () => {
    const { gh, calls } = fakeGitHub();
    const r = await commitHosting(gh, run(), O);
    expect(r.sha).toBe('C2');
    expect(r.message).toBe('admin: host 2 pictures for phone-launch');
    expect(calls.filter((c) => c.method === 'POST' && /\/git\/blobs$/.test(c.url))).toHaveLength(2); // the pictures
    const trees = calls.filter((c) => c.method === 'POST' && /\/git\/trees$/.test(c.url));
    expect(trees).toHaveLength(1);
    expect(trees[0].body.base_tree).toBe('T1');
    expect(trees[0].body.tree.map((e: any) => e.path)).toEqual(['site/public/media/2026/11/a.webp', 'site/public/media/2026/11/b.webp', O.postPath, O.mediaPath]);
    expect(trees[0].body.tree.slice(0, 2).every((e: any) => /^blob-/.test(e.sha))).toBe(true);
    expect(trees[0].body.tree.slice(2).map((e: any) => e.content)).toEqual(['POST:NEW BODY', JSON.stringify(run().map, null, 2) + '\n']);
    const commits = calls.filter((c) => c.method === 'POST' && /\/git\/commits$/.test(c.url));
    expect(commits).toHaveLength(1);
    expect(commits[0].body).toEqual({ message: 'admin: host 2 pictures for phone-launch', tree: 'T2', parents: ['P1'] });
    const moves = calls.filter((c) => c.method === 'PATCH');
    expect(moves).toHaveLength(1);
    expect(moves[0].body).toEqual({ sha: 'C2', force: false });
    expect(calls.some((c) => c.method === 'PUT' || c.method === 'DELETE')).toBe(false);
  });
  it('sends the picture bytes as base64 of the hosted file', async () => {
    const { gh, calls } = fakeGitHub();
    await commitHosting(gh, run(), O);
    const blobs = calls.filter((c) => /\/git\/blobs$/.test(c.url));
    expect(blobs.map((b) => b.body)).toEqual([{ content: toBase64(bytes(1)), encoding: 'base64' }, { content: toBase64(bytes(2)), encoding: 'base64' }]);
  });
  it('a nothing-to-save run does not touch the network at all', async () => {
    const { gh, calls } = fakeGitHub();
    expect(await commitHosting(gh, run({ changed: false }), O)).toBeNull();
    expect(calls).toEqual([]);
  });
  it('a bad file stops before any request', async () => {
    const { gh, calls } = fakeGitHub();
    await expect(commitHosting(gh, run({ files: [{ ...run().files[0], bytes: new Uint8Array(0) }] }), O)).rejects.toThrow('is empty');
    expect(calls).toEqual([]);
  });
  it('a picture upload that fails changes nothing: the branch is not moved', async () => {
    const { gh, calls } = fakeGitHub({ match: /^POST .*\/git\/blobs$/ });
    await expect(commitHosting(gh, run(), O)).rejects.toThrow('GitHub 500');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(calls.some((c) => /\/git\/commits$/.test(c.url) && c.method === 'POST')).toBe(false);
  });
  it('somebody else saved at the same moment: a plain sentence, one try, no force', async () => {
    const { gh, calls } = fakeGitHub({ match: /^PATCH /, status: 422 });
    await expect(commitHosting(gh, run(), O)).rejects.toThrow('Someone else saved at the same moment, so nothing was changed. Try again.');
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    expect(calls.find((c) => c.method === 'PATCH')!.body.force).toBe(false);
  });
  it('refuses without a connection to GitHub', async () => {
    for (const g of [null, undefined, {}, { commitFiles: 5 }]) await expect(commitHosting(g as any, run(), O)).rejects.toThrow('There is no connection to GitHub.');
  });
});

describe('the whole way: hostPost, then the commit, with the real post writer', () => {
  const OWN = ['shivam-das-news.pages.dev'];
  const NOW = new Date('2026-11-17T01:02:03.456Z');
  it('the post file in the commit points at the new picture and the media map has its row', async () => {
    const A = 'https://other.com/wp/IMG_1234.jpg';
    const original = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46, ...new Array(30).fill(3)]);
    const post: any = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: `![New phone launch event in Delhi](${A})` };
    const r = await hostPost(post, {
      fetchPictures: async (urls: string[]) => ({ ok: true, results: urls.map((url) => ({ url, ok: true, kind: 'jpg', size: original.length, data: toBase64(original) })) }),
      optimize: async (b: Uint8Array) => ({ bytes: b.slice(0, 20), ext: 'webp', width: 1600, height: 900 }),
      ownHosts: OWN, now: NOW,
    });
    const { gh, calls } = fakeGitHub();
    const out = await commitHosting(gh, r, { postPath: O.postPath, mediaPath: O.mediaPath, mediaDir: O.mediaDir, serializePost: (p: any) => stringify({ title: p.title, date: p.date }, p.body) });
    const tree = calls.find((c) => /\/git\/trees$/.test(c.url))!.body.tree;
    expect(tree.map((e: any) => e.path)).toEqual(['site/public/media/2026/11/new-phone-launch-event-delhi.webp', O.postPath, O.mediaPath]);
    const postFile = parse(tree[1].content);
    expect(postFile.body.trim()).toBe('![New phone launch event in Delhi](/media/2026/11/new-phone-launch-event-delhi.webp)');
    const mediaFile = JSON.parse(tree[2].content);
    expect(mediaFile['/media/2026/11/new-phone-launch-event-delhi.webp']).toMatchObject({ sourceUrl: A, width: 1600, height: 900, bytes: 20 });
    expect(out!.message).toBe('admin: host 1 picture for phone-launch');
  });
  it('a run where every picture failed changes nothing and makes no commit', async () => {
    const A = 'https://other.com/gone.jpg';
    const r = await hostPost({ title: 'T', handle: 'h', date: '2026-11-16T10:00:00+05:30', body: `![A gone picture](${A})` }, {
      fetchPictures: async (urls: string[]) => ({ ok: true, results: urls.map((url) => ({ url, ok: false, reason: 'not_found' })) }),
      optimize: async () => { throw new Error('never'); }, ownHosts: OWN, now: NOW,
    });
    const { gh, calls } = fakeGitHub();
    expect(await commitHosting(gh, r, O)).toBeNull();
    expect(calls).toEqual([]);
  });
});
