import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { savePostWithHosting, plainMessage, MEDIA_DIR } from '../../public/admin/js/hosting-pipeline.js';
// @ts-ignore plain JS module
import { confirmFor } from '../../public/admin/js/hosting-result.js';
// @ts-ignore plain JS module
import { GitHub, toBase64 as b64 } from '../../public/admin/js/github.js';
// @ts-ignore plain JS module
import { findExternal } from '../../public/admin/js/hotlink.js';

afterEach(() => { vi.unstubAllGlobals(); });

const enc = (s: string) => new TextEncoder().encode(s);
const pic = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(tag)]);
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' as string };
const NOW = new Date('2026-11-17T01:02:03.456Z');
const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg', G = 'https://media.gettyimages.com/g.jpg';
const optimize = vi.fn(async (bytes: Uint8Array) => ({ bytes: bytes.slice(0, 20), ext: 'webp' as const, width: 1600, height: 900 }));
const POST_PATH = 'site/content/blogs/entertainment/phone-launch.md', MEDIA_PATH = 'site/config/media.json';
const serializePost = (p: any) => `POST:${p.body}`;

/** A fake picture service: address -> bytes (ok) or a reason word. */
function service(table: Record<string, Uint8Array | string>) {
  const calls: string[][] = [];
  const fn = vi.fn(async (urls: string[]) => {
    calls.push(urls);
    return { ok: true, results: urls.map((url) => { const v = table[url]; if (v === undefined) return { url, ok: false, reason: 'network' }; if (typeof v === 'string') return { url, ok: false, reason: v }; return { url, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...v)), size: v.length }; }) };
  });
  return { fn, calls };
}

/** A fake GitHub object: `reads` are the answers of getText in order (a string of text, or an Error); the last one repeats. */
function fakeGh(o: { reads?: (string | Error)[]; commit?: Error } = {}) {
  const reads = o.reads ?? ['{}'];
  const log = { getText: [] as string[], commits: [] as { files: any[]; message: string }[] };
  const gh = {
    getText: vi.fn(async (path: string) => { log.getText.push(path); const r = reads[Math.min(log.getText.length - 1, reads.length - 1)]; if (r instanceof Error) throw r; return { text: r, sha: 's' }; }),
    commitFiles: vi.fn(async (files: any[], message: string) => { log.commits.push({ files, message }); if (o.commit) throw o.commit; return 'C-' + log.commits.length; }),
  };
  return { gh, log };
}
const deps = (svc: any, gh: any, extra: any = {}) => ({ gh, postPath: POST_PATH, mediaPath: MEDIA_PATH, serializePost, fetchPictures: svc.fn, optimize, ownHosts: OWN, now: NOW, ...extra });
const notFound = () => Object.assign(new Error('GitHub 404: Not Found'), { status: 404 });

describe('a save: one commit with the pictures, the post and the media file', () => {
  it('hosts the pictures and makes ONE commit in the order pictures, post, media', async () => {
    const svc = service({ [A]: pic(1), [B]: pic(2) });
    const { gh, log } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![First picture of the launch](${A})\n\n![Second picture here](${B})` }, deps(svc, gh));
    expect(r.ok).toBe(true);
    expect(r.status).toBe('saved');
    expect(log.commits).toHaveLength(1);
    const paths = log.commits[0].files.map((f: any) => f.path);
    expect(paths).toHaveLength(4);
    expect(paths[0]).toMatch(/^site\/public\/media\/2026\/11\/.+\.webp$/);
    expect(paths[1]).toMatch(/^site\/public\/media\/2026\/11\/.+\.webp$/);
    expect(paths.slice(2)).toEqual([POST_PATH, MEDIA_PATH]);
    expect(log.commits[0].message).toBe('admin: host 2 pictures for phone-launch');
    expect(r.commit).toMatchObject({ sha: 'C-1', message: 'admin: host 2 pictures for phone-launch', counts: { pictures: 2, reused: 0, post: true, media: true } });
    expect(r.message).toBe('Saved in one commit. All 2 pictures are on your site.');
    expect(r.list.counts).toMatchObject({ total: 2, hosted: 2 });
    expect(findExternal(r.next.post, OWN)).toEqual([]);
    expect(Object.keys(r.next.map)).toHaveLength(2);
    const postFile = log.commits[0].files[2];
    expect(postFile.text).toBe(`POST:${r.run.post.body}`);
    expect(findExternal({ body: postFile.text.slice(5) }, OWN)).toEqual([]);
  });
  it('the media file in the commit holds the new rows', async () => {
    const { gh, log } = fakeGh();
    await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh));
    const media = JSON.parse(log.commits[0].files[2].text);
    expect(Object.keys(media)).toHaveLength(1);
    expect(Object.values(media)[0]).toMatchObject({ sourceUrl: A, width: 1600, height: 900, bytes: 20 });
  });
  it('reads the media file from the path it was given, before the run and again before the commit', async () => {
    const { gh, log } = fakeGh();
    await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh));
    expect(log.getText).toEqual([MEDIA_PATH, MEDIA_PATH]);
  });
  it('the folder of the pictures can be set, and a picture outside it stops the save before anything is written', async () => {
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh, { mediaDir: 'elsewhere/' }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/is outside elsewhere\/\.$/);
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });
  it('the pictures stay inside site/public/media/ (an extra check of the commit)', () => { expect(MEDIA_DIR).toBe('site/public/media/'); });
  it('the settings that belong to hostPost are passed on: a picture of the own host is not fetched', async () => {
    const own = 'https://shivam-das-news.pages.dev/media/2026/10/old.webp';
    const svc = service({ [A]: pic(1) });
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![Own](${own}) ![One](${A})` }, deps(svc, gh));
    expect(svc.calls).toEqual([[A]]);
    expect(r.list.counts.total).toBe(1);
  });
});

describe('a post that changes only a little', () => {
  it('a picture that is already hosted is reused: the post is saved alone, the media file is neither read again nor written', async () => {
    const first = fakeGh();
    const svc1 = service({ [A]: pic(1) });
    const r1 = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(svc1, first.gh));
    const media = first.log.commits[0].files[2].text;
    const { gh, log } = fakeGh({ reads: [media] });
    const svc2 = service({});
    const r2 = await savePostWithHosting({ ...POST, handle: 'second-story', body: `Again: ![One](${A})` }, deps(svc2, gh));
    expect(r1.status).toBe('saved');
    expect(r2.status).toBe('saved');
    expect(svc2.calls).toEqual([]);
    expect(log.getText).toHaveLength(1);
    expect(log.commits[0].files.map((f: any) => f.path)).toEqual([POST_PATH]);
    expect(log.commits[0].message).toBe('admin: use 1 hosted picture in second-story');
  });
  it('a post with no outside pictures: nothing to save, no commit, the media file is read once', async () => {
    const { gh, log } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: 'Only text.' }, deps(service({}), gh));
    expect(r).toMatchObject({ ok: true, status: 'nothing', commit: null, message: 'Nothing to save. There are no outside pictures in this post.' });
    expect(gh.commitFiles).not.toHaveBeenCalled();
    expect(log.getText).toHaveLength(1);
    expect(r.next.post).toEqual({ ...POST, body: 'Only text.' });
  });
  it('every picture failed: nothing changed, nothing saved, the list offers Retry', async () => {
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: 'timeout' }), gh));
    expect(r).toMatchObject({ ok: true, status: 'nothing', commit: null, message: 'Nothing to save. 1 picture: 1 failed.' });
    expect(r.list.retry).toEqual([A]);
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });
  it('one picture hosted and one failed: the post is saved with the hosted one, the failed one stays as written', async () => {
    const { gh, log } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A}) ![Two](${B})` }, deps(service({ [A]: pic(1), [B]: 'timeout' }), gh));
    expect(r.status).toBe('saved');
    expect(r.message).toBe('Saved in one commit. 2 pictures: 1 hosted, 1 failed.');
    const text = log.commits[0].files.find((f: any) => f.path === POST_PATH).text;
    expect(text).toContain(B);
    expect(text).not.toContain(A);
    expect(r.list.retry).toEqual([B]);
  });
});

describe('preview (dryRun): the same run, nothing written', () => {
  it('downloads, builds the list and writes nothing', async () => {
    const svc = service({ [A]: pic(1) });
    const { gh, log } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(svc, gh, { dryRun: true }));
    expect(r).toMatchObject({ ok: true, status: 'preview', commit: null, message: 'Preview only, nothing was saved. All 1 picture is on your site.' });
    expect(svc.calls).toEqual([[A]]);
    expect(gh.commitFiles).not.toHaveBeenCalled();
    expect(log.getText).toHaveLength(1);
    expect(r.run.files).toHaveLength(1);
  });
  it('the next run of a preview starts from the post as it was, because nothing was saved', async () => {
    const post = { ...POST, body: `![One](${A})` };
    const r = await savePostWithHosting(post, deps(service({ [A]: pic(1) }), fakeGh().gh, { dryRun: true }));
    expect(r.next.post).toEqual(post);
    expect(r.next.map).toEqual({});
  });
  it('any value that is not empty means preview; only an empty value saves (a stray value never makes a real save)', async () => {
    for (const v of [true, 1, 'yes', 'false']) {
      const { gh } = fakeGh();
      const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh, { dryRun: v }));
      expect(r.status, String(v)).toBe('preview');
      expect(gh.commitFiles).not.toHaveBeenCalled();
    }
    for (const v of [false, 0, '', null, undefined]) {
      const { gh } = fakeGh();
      const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh, { dryRun: v }));
      expect(r.status, String(v)).toBe('saved');
    }
  });
  it('needs no way to save: no commit function, no paths', async () => {
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, { gh: { getText: async () => ({ text: '{}' }) }, fetchPictures: service({ [A]: pic(1) }).fn, optimize, ownHosts: OWN, now: NOW, dryRun: true });
    expect(r.status).toBe('preview');
  });
  it('needs a way to read the media file', async () => {
    const svc = service({});
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, { fetchPictures: svc.fn, optimize, dryRun: true });
    expect(r).toMatchObject({ ok: false, status: 'error', message: 'There is no way to read the media file.' });
    expect(svc.fn).not.toHaveBeenCalled();
  });
});

describe('the setup is checked before any picture is fetched', () => {
  const body = `![One](${A})`;
  const cases: [string, (g: any) => any, string][] = [
    ['no GitHub connection', () => ({ gh: null }), 'There is no connection to GitHub.'],
    ['a GitHub object without commitFiles', () => ({ gh: { getText: async () => ({ text: '{}' }) } }), 'There is no connection to GitHub.'],
    ['a GitHub object that cannot read and no readMap', (g: any) => ({ gh: { commitFiles: g.commitFiles } }), 'There is no connection to GitHub.'],
    ['no post path', () => ({ postPath: '' }), 'The dashboard is not set up to save pictures.'],
    ['no media path', () => ({ mediaPath: undefined }), 'The dashboard is not set up to save pictures.'],
    ['no way to write the post', () => ({ serializePost: undefined }), 'The dashboard is not set up to save pictures.'],
  ];
  for (const [name, patch, text] of cases) {
    it(`${name}: error, no download, no read, no commit`, async () => {
      const svc = service({ [A]: pic(1) });
      const { gh, log } = fakeGh();
      const r = await savePostWithHosting({ ...POST, body }, { ...deps(svc, gh), ...patch(gh) });
      expect(r).toMatchObject({ ok: false, status: 'error', message: text, commit: null });
      expect(svc.fn).not.toHaveBeenCalled();
      expect(gh.commitFiles).not.toHaveBeenCalled();
      expect(r.next.post).toEqual({ ...POST, body });
      void log;
    });
  }
  it('a post with outside pictures but no valid date: a plain error before any download', async () => {
    const svc = service({ [A]: pic(1) });
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, date: '', body }, deps(svc, gh));
    expect(r.ok).toBe(false);
    expect(r.status).toBe('error');
    expect(r.message.length).toBeGreaterThan(10);
    expect(svc.fn).not.toHaveBeenCalled();
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });
});

describe('the media file', () => {
  const body = `![One](${A})`;
  it('a missing file (404) is an empty map', async () => {
    const { gh, log } = fakeGh({ reads: [notFound()] });
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh));
    expect(r.status).toBe('saved');
    expect(Object.keys(JSON.parse(log.commits[0].files[2].text))).toHaveLength(1);
  });
  it('an empty file is an empty map', async () => {
    const { gh } = fakeGh({ reads: ['   \n'] });
    expect((await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh))).status).toBe('saved');
  });
  for (const [name, text] of [['text that is not JSON', 'not json'], ['an array', '[]'], ['a number', '5'], ['null', 'null']] as const) {
    it(`${name}: error, no download, no commit`, async () => {
      const svc = service({ [A]: pic(1) });
      const { gh } = fakeGh({ reads: [text] });
      const r = await savePostWithHosting({ ...POST, body }, deps(svc, gh));
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/^The media file is not valid( JSON)?\. Nothing was changed\.$/);
      expect(svc.fn).not.toHaveBeenCalled();
      expect(gh.commitFiles).not.toHaveBeenCalled();
    });
  }
  it('another kind of read error stops the save with its plain message', async () => {
    const { gh } = fakeGh({ reads: [Object.assign(new Error('GitHub 500: Server Error'), { status: 500 })] });
    const svc = service({ [A]: pic(1) });
    const r = await savePostWithHosting({ ...POST, body }, deps(svc, gh));
    expect(r).toMatchObject({ ok: false, status: 'error', message: 'GitHub 500: Server Error' });
    expect(svc.fn).not.toHaveBeenCalled();
  });
  it('the readMap of the deps is used instead of GitHub, and must give an object', async () => {
    const { gh } = fakeGh();
    const readMap = vi.fn(async () => ({}));
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh, { readMap }));
    expect(r.status).toBe('saved');
    expect(readMap).toHaveBeenCalledTimes(2);
    expect(gh.getText).not.toHaveBeenCalled();
    const bad = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh, { readMap: async () => [] }));
    expect(bad).toMatchObject({ ok: false, message: 'The media file is not valid. Nothing was changed.' });
  });
});

describe('a save made by someone else while the pictures were fetched', () => {
  const body = `![One](${A})`;
  const row = { alt: 'x', sourceUrl: 'https://else.com/z.jpg', sourceHost: 'else.com', sha256: 'f'.repeat(64), width: 10, height: 10, bytes: 20, hostedAt: '2026-11-17T00:00:00Z' };
  it('their new row is kept and ours is added to it', async () => {
    const theirs = JSON.stringify({ '/media/2026/11/theirs.webp': row });
    const { gh, log } = fakeGh({ reads: ['{}', theirs] });
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh));
    expect(r.status).toBe('saved');
    const media = JSON.parse(log.commits[0].files[2].text);
    expect(Object.keys(media)).toHaveLength(2);
    expect(media['/media/2026/11/theirs.webp']).toEqual(row);
    expect(r.next.map).toEqual(media);
  });
  it('the same picture name taken meanwhile: nothing is written and the post stays as it was', async () => {
    const first = fakeGh();
    const probe = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), first.gh, { dryRun: true }));
    const key = Object.keys(probe.run.map)[0];
    const { gh } = fakeGh({ reads: ['{}', JSON.stringify({ [key]: row })] });
    const post = { ...POST, body };
    const r = await savePostWithHosting(post, deps(service({ [A]: pic(1) }), gh));
    expect(r.ok).toBe(false);
    expect(r.status).toBe('error');
    expect(r.message).toBe(`Someone else just saved a picture with the same name (${key}). Nothing was changed. Press Save again.`);
    expect(gh.commitFiles).not.toHaveBeenCalled();
    expect(r.next.post).toEqual(post);
  });
  it('the second read fails: nothing is written', async () => {
    const { gh } = fakeGh({ reads: ['{}', Object.assign(new Error('GitHub 502: Bad Gateway'), { status: 502 })] });
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh));
    expect(r).toMatchObject({ ok: false, status: 'error', message: 'GitHub 502: Bad Gateway' });
    expect(gh.commitFiles).not.toHaveBeenCalled();
  });
  it('the second read is a missing file: our rows alone are written', async () => {
    const { gh, log } = fakeGh({ reads: ['{}', notFound()] });
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh));
    expect(r.status).toBe('saved');
    expect(Object.keys(JSON.parse(log.commits[0].files[2].text))).toHaveLength(1);
  });
});

describe('a commit that fails changes nothing', () => {
  const body = `![One](${A})`;
  it('the plain sentence is returned, and the next run starts from the post as it was', async () => {
    const { gh } = fakeGh({ commit: new Error('Someone else saved at the same moment, so nothing was changed. Try again.') });
    const post = { ...POST, body };
    const r = await savePostWithHosting(post, deps(service({ [A]: pic(1) }), gh));
    expect(r).toMatchObject({ ok: false, status: 'error', message: 'Someone else saved at the same moment, so nothing was changed. Try again.', commit: null });
    expect(r.next.post).toEqual(post);
    expect(r.next.map).toEqual({});
    expect(r.run.files).toHaveLength(1);
    expect(r.list.counts.hosted).toBe(1);
  });
  it('a token in an error message never reaches the screen', async () => {
    const { gh } = fakeGh({ commit: new Error('GitHub 401: bad token ghp_abcdefghijklmnop1234567890 for github_pat_11ABCDEFG_0123456789abcdef') });
    const r = await savePostWithHosting({ ...POST, body }, deps(service({ [A]: pic(1) }), gh));
    expect(r.message).toBe('GitHub 401: bad token [hidden] for [hidden]');
    expect(JSON.stringify(r.message)).not.toContain('ghp_');
  });
});

describe('Retry and Confirm through the pipeline', () => {
  it('Retry: after a save the next call fetches only the picture that failed, and the commit keeps both rows', async () => {
    const post = { ...POST, body: `![One](${A}) ![Two](${B})` };
    const one = fakeGh();
    const r1 = await savePostWithHosting(post, deps(service({ [A]: pic(1), [B]: 'timeout' }), one.gh));
    expect(r1.list.retry).toEqual([B]);
    const savedMedia = one.log.commits[0].files.find((f: any) => f.path === MEDIA_PATH).text;
    const svc2 = service({ [B]: pic(2) });
    const two = fakeGh({ reads: [savedMedia] });
    const r2 = await savePostWithHosting(r1.next.post, deps(svc2, two.gh));
    expect(svc2.calls).toEqual([[B]]);
    expect(r2.status).toBe('saved');
    expect(Object.keys(JSON.parse(two.log.commits[0].files.find((f: any) => f.path === MEDIA_PATH).text))).toHaveLength(2);
    expect(r2.message).toBe('Saved in one commit. All 1 picture is on your site.');
    expect(findExternal(r2.next.post, OWN)).toEqual([]);
  });
  it('Confirm: an agency picture waits, is confirmed, and is hosted by the next call', async () => {
    const post = { ...POST, body: `![One](${A}) ![Agency](${G})` };
    const one = fakeGh();
    const svc1 = service({ [A]: pic(1), [G]: pic(3) });
    const r1 = await savePostWithHosting(post, deps(svc1, one.gh));
    expect(svc1.calls).toEqual([[A]]);
    expect(r1.list.confirm).toEqual([G]);
    expect(r1.message).toBe('Saved in one commit. 2 pictures: 1 hosted, 1 waiting for your confirmation.');
    const media = one.log.commits[0].files.find((f: any) => f.path === MEDIA_PATH).text;
    const svc2 = service({ [G]: pic(3) });
    const two = fakeGh({ reads: [media] });
    const r2 = await savePostWithHosting(r1.next.post, deps(svc2, two.gh, { confirmed: confirmFor(r1.list, []) }));
    expect(svc2.calls).toEqual([[G]]);
    expect(r2.status).toBe('saved');
    expect(r2.list.counts.hosted).toBe(1);
  });
});

describe('it never throws', () => {
  it('bad input gives an error result, not an exception', async () => {
    for (const [p, d] of [[undefined, undefined], [null, null], [{}, {}], [5, 'x'], [{ ...POST, body: `![One](${A})` }, { gh: {} }]] as any[]) {
      const r = await savePostWithHosting(p, d);
      expect(typeof r.ok).toBe('boolean');
      expect(typeof r.message).toBe('string');
      expect(r.list).toBeTruthy();
      expect(r.next).toBeTruthy();
    }
  });
  it('an exception inside fetchPictures becomes failed pictures, not a crash', async () => {
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps({ fn: async () => { throw new Error('boom'); } }, gh));
    expect(r.ok).toBe(true);
    expect(r.list.counts.failed).toBe(1);
  });
  it('an exception inside optimize becomes a failed picture, not a crash', async () => {
    const { gh } = fakeGh();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, { ...deps(service({ [A]: pic(1) }), gh), optimize: async () => { throw new Error('boom'); } });
    expect(r.ok).toBe(true);
    expect(r.list.rows[0]).toMatchObject({ status: 'failed', reason: 'optimize_failed', action: 'retry' });
  });
});

describe('plainMessage', () => {
  it('gives the message of an error as one line', () => { expect(plainMessage(new Error('a\n  b   c'))).toBe('a b c'); });
  it('hides classic tokens, fine grained tokens and any long secret looking run', () => {
    expect(plainMessage(new Error('x ghp_abc123 y gho_zzz999 z ghs_q1 w ghu_q2 v ghr_q3'))).toBe('x [hidden] y [hidden] z [hidden] w [hidden] v [hidden]');
    expect(plainMessage(new Error('github_pat_11AAAA_bbbb'))).toBe('[hidden]');
    expect(plainMessage(new Error('key ' + 'a'.repeat(32)))).toBe('key [hidden]');
    expect(plainMessage(new Error('key ' + 'a'.repeat(31)))).toBe('key ' + 'a'.repeat(31));
  });
  it('is cut at 200 characters', () => { expect(plainMessage(new Error('a '.repeat(300)))).toHaveLength(200); expect(plainMessage(new Error('a'.repeat(30)))).toHaveLength(30); });
  it('a missing message or a thing that is not an error gives the general sentence', () => {
    for (const e of [undefined, null, {}, { message: '' }, { message: '   ' }, 5, 'x'] as any[]) expect(plainMessage(e)).toBe('Something went wrong. Nothing was changed.');
  });
});

describe('through the real GitHub client with a fake network', () => {
  function network(o: { media?: string | null; patchStatus?: number } = {}) {
    const calls: { method: string; url: string; body: any }[] = [];
    let blob = 0;
    vi.stubGlobal('fetch', async (url: string, opts: any = {}) => {
      const path = url.replace('https://api.github.com', '');
      const method = opts.method || 'GET';
      const body = opts.body ? JSON.parse(opts.body) : null;
      calls.push({ method, url: path, body });
      const reply = (json: any, status = 200) => ({ ok: status < 400, status, statusText: 'Error', json: async () => json });
      if (method === 'GET' && /\/contents\/site\/config\/media\.json\?ref=main$/.test(path)) return o.media === null ? reply({ message: 'Not Found' }, 404) : reply({ content: b64(o.media ?? '{}'), sha: 'm1' });
      if (/\/git\/ref\/heads\/main$/.test(path)) return reply({ object: { sha: 'P1' } });
      if (/\/git\/commits\/P1$/.test(path)) return reply({ tree: { sha: 'T1' } });
      if (method === 'POST' && /\/git\/blobs$/.test(path)) return reply({ sha: `blob-${++blob}` });
      if (method === 'POST' && /\/git\/trees$/.test(path)) return reply({ sha: 'T2' });
      if (method === 'POST' && /\/git\/commits$/.test(path)) return reply({ sha: 'C2' });
      if (method === 'PATCH' && /\/git\/refs\/heads\/main$/.test(path)) return reply({ message: 'Update is not a fast forward' }, o.patchStatus ?? 200);
      return reply({ message: 'unexpected ' + method + ' ' + path }, 404);
    });
    return { gh: new GitHub({ token: 'ghp_abcdefghijklmnop1234', repo: 'me/site', branch: 'main' }), calls };
  }
  it('reads config/media.json, saves the pictures, the post and the media file in ONE commit and moves the branch once', async () => {
    const { gh, calls } = network({ media: null });
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh));
    expect(r.status).toBe('saved');
    expect(r.commit!.sha).toBe('C2');
    expect(calls.filter((c) => c.method === 'GET' && /media\.json/.test(c.url))).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'POST' && /\/git\/blobs$/.test(c.url))).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'POST' && /\/git\/commits$/.test(c.url))).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    expect(calls.some((c) => c.method === 'PUT' || c.method === 'DELETE')).toBe(false);
    const tree = calls.find((c) => /\/git\/trees$/.test(c.url))!.body.tree;
    expect(tree.map((e: any) => e.path).slice(1)).toEqual([POST_PATH, MEDIA_PATH]);
  });
  it('somebody else saved at the same moment: a plain sentence, nothing changed, the token is not shown', async () => {
    const { gh } = network({ patchStatus: 422 });
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh));
    expect(r).toMatchObject({ ok: false, status: 'error', message: 'Someone else saved at the same moment, so nothing was changed. Try again.' });
    expect(JSON.stringify(r.message)).not.toContain('ghp_');
  });
  it('a preview makes no write request at all', async () => {
    const { gh, calls } = network();
    const r = await savePostWithHosting({ ...POST, body: `![One](${A})` }, deps(service({ [A]: pic(1) }), gh, { dryRun: true }));
    expect(r.status).toBe('preview');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
});
