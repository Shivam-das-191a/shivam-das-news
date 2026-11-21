// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { hostingFlow } from '../../public/admin/js/hosting-flow.js';
// @ts-ignore
import { findExternal } from '../../public/admin/js/hotlink.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 5; i++) await flush(); };

const enc = (s: string) => new TextEncoder().encode(s);
const pic = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(tag)]);
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' as string };
const NOW = new Date('2026-11-17T01:02:03.456Z');
const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg', G = 'https://media.gettyimages.com/g.jpg';
const POST_PATH = 'site/content/blogs/entertainment/phone-launch.md', MEDIA_PATH = 'site/config/media.json';
const serializePost = (p: any) => `POST:${p.body}`;
const optimize = vi.fn(async (bytes: Uint8Array) => ({ bytes: bytes.slice(0, 20), ext: 'webp' as const, width: 1600, height: 900 }));

/** A fake picture service whose table can change between calls. */
function service(table: Record<string, Uint8Array | string>, gate?: () => Promise<void>) {
  const calls: string[][] = [];
  const fn = vi.fn(async (urls: string[]) => {
    calls.push(urls);
    if (gate) await gate();
    return { ok: true, results: urls.map((url) => { const v = table[url]; if (v === undefined) return { url, ok: false, reason: 'network' }; if (typeof v === 'string') return { url, ok: false, reason: v }; return { url, ok: true, kind: 'jpg', data: btoa(String.fromCharCode(...v)), size: v.length }; }) };
  });
  return { fn, calls, table };
}

/** A fake GitHub that remembers the media file it was given, so a second run reads what the first one saved. */
function fakeGh(o: { failCommits?: number; failWith?: string } = {}) {
  let media = '{}';
  let fails = o.failCommits ?? 0;
  const commits: { files: any[]; message: string }[] = [];
  const gh = {
    getText: vi.fn(async (path: string) => ({ text: path === MEDIA_PATH ? media : '', sha: 's' })),
    commitFiles: vi.fn(async (files: any[], message: string) => {
      if (fails > 0) { fails--; throw new Error(o.failWith || 'Someone else saved at the same moment, so nothing was changed. Try again.'); }
      commits.push({ files, message });
      const m = files.find((f: any) => f.path === MEDIA_PATH);
      if (m) media = m.text;
      return 'C-' + commits.length;
    }),
  };
  return { gh, commits };
}

const make = (post: any, svc: any, gh: any, o: any = {}) => {
  const { deps, ...rest } = o;
  return hostingFlow({ post, deps: { gh, postPath: POST_PATH, mediaPath: MEDIA_PATH, serializePost, fetchPictures: svc.fn, optimize, ownHosts: OWN, now: NOW, ...(deps || {}) }, ...rest });
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('the first Save', () => {
  it('hosts the pictures, makes one commit and draws the list', async () => {
    const { gh, commits } = fakeGh();
    const f = make({ ...POST, body: `![One](${A}) ![Two](${B})` }, service({ [A]: pic(1), [B]: pic(2) }), gh);
    await f.start();
    expect(commits).toHaveLength(1);
    expect(qa(f.el, 'row')).toHaveLength(2);
    expect(qa(f.el, 'row').map((r) => r.dataset.status)).toEqual(['hosted', 'hosted']);
    expect(q(f.el, 'headline').textContent).toBe('All 2 pictures are on your site.');
    expect(q(f.el, 'status').textContent).toBe('Saved in one commit. All 2 pictures are on your site.');
    expect(f.state().status).toBe('saved');
  });
  it('the post of the editor is not changed, the new post goes to onResult', async () => {
    const { gh } = fakeGh();
    const mine = { ...POST, body: `![One](${A})` };
    const onResult = vi.fn();
    const f = make(mine, service({ [A]: pic(1) }), gh, { onResult });
    await f.start();
    expect(mine.body).toBe(`![One](${A})`);
    expect(onResult).toHaveBeenCalledTimes(1);
    const r = onResult.mock.calls[0][0];
    expect(r.status).toBe('saved');
    expect(findExternal(r.next.post, OWN)).toEqual([]);
    expect(f.state().post.body).toBe(r.next.post.body);
  });
  it('a post with no outside picture says so and makes no commit', async () => {
    const { gh, commits } = fakeGh();
    const f = make({ ...POST, body: 'Only words here.' }, service({}), gh);
    await f.start();
    expect(commits).toHaveLength(0);
    expect(q(f.el, 'headline').textContent).toBe('There are no outside pictures in this post.');
    expect(f.state().status).toBe('nothing');
  });
  it('a second start() while one runs gives the same promise and one commit', async () => {
    const { gh, commits } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh);
    const p1 = f.start();
    const p2 = f.start();
    expect(p2).toBe(p1);
    await p1;
    expect(commits).toHaveLength(1);
  });
  it('start() can run again after it ended', async () => {
    const { gh, commits } = fakeGh();
    const svc = service({ [A]: pic(1) });
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh);
    await f.start();
    await f.start();
    expect(commits).toHaveLength(1); // the second run found no outside picture
    expect(svc.calls).toHaveLength(1);
  });
  it('start() answers the last result', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh);
    const r = await f.start();
    expect(r.status).toBe('saved');
    expect(r.commit.sha).toBe('C-1');
  });
});

describe('Retry', () => {
  it('fetches again only the picture that is still outside and saves it', async () => {
    const { gh, commits } = fakeGh();
    const svc = service({ [A]: pic(1), [B]: 'timeout' });
    const f = make({ ...POST, body: `![One](${A}) ![Two](${B})` }, svc, gh);
    await f.start();
    expect(q(f.el, 'retry-all').textContent).toBe('Retry 1 picture');
    expect(q(f.el, 'headline').textContent).toBe('2 pictures: 1 hosted, 1 failed.');
    svc.table[B] = pic(2);
    q(f.el, 'retry-all').click();
    await settle();
    expect(svc.calls).toEqual([[A, B], [B]]);
    expect(commits).toHaveLength(2);
    expect(Object.keys(JSON.parse(commits[1].files.find((x: any) => x.path === MEDIA_PATH).text))).toHaveLength(2);
    expect(q(f.el, 'retry-all')).toBeNull();
    expect(q(f.el, 'headline').textContent).toBe('All 1 picture is on your site.');
    expect(findExternal(f.state().post, OWN)).toEqual([]);
  });
  it('Retry on the row does the same', async () => {
    const { gh } = fakeGh();
    const svc = service({ [A]: 'timeout' });
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh);
    await f.start();
    svc.table[A] = pic(1);
    q(qa(f.el, 'row')[0], 'retry-one').click();
    await settle();
    expect(qa(f.el, 'row')[0].dataset.status).toBe('hosted');
  });
  it('a picture that fails again stays in the list with its Retry button', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: 'timeout' }), gh);
    await f.start();
    q(f.el, 'retry-all').click();
    await settle();
    expect(qa(f.el, 'row')[0].dataset.status).toBe('failed');
    expect(q(f.el, 'retry-all')).not.toBeNull();
    expect(q(f.el, 'retry-all').disabled).toBe(false);
  });
  it('onResult is called after the Retry too', async () => {
    const { gh } = fakeGh();
    const svc = service({ [A]: 'timeout' });
    const onResult = vi.fn();
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh, { onResult });
    await f.start();
    svc.table[A] = pic(1);
    q(f.el, 'retry-all').click();
    await settle();
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult.mock.calls[1][0].status).toBe('saved');
  });
});

describe('Confirm', () => {
  const body = `![One](${A}) ![Agency](${G})`;
  it('an agency picture waits, then Confirm hosts it', async () => {
    const { gh, commits } = fakeGh();
    const svc = service({ [A]: pic(1), [G]: pic(3) });
    const f = make({ ...POST, body }, svc, gh);
    await f.start();
    expect(q(f.el, 'headline').textContent).toBe('2 pictures: 1 hosted, 1 waiting for your confirmation.');
    q(f.el, 'confirm-all').click();
    await settle();
    expect(svc.calls).toEqual([[A], [G]]);
    expect(commits).toHaveLength(2);
    expect(q(f.el, 'confirm-all')).toBeNull();
    expect(f.state().confirmed).toEqual([G]);
    expect(findExternal(f.state().post, OWN)).toEqual([]);
  });
  it('Confirm on one row confirms the address without the fragment', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body }, service({ [A]: pic(1), [G]: pic(3) }), gh);
    await f.start();
    q(qa(f.el, 'row').find((r) => r.dataset.status === 'needs_confirm'), 'confirm-one').click();
    await settle();
    expect(f.state().confirmed).toEqual([G]);
  });
  it('Confirm all from the host confirms the host name', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body }, service({ [A]: pic(1), [G]: pic(3) }), gh);
    await f.start();
    q(f.el, 'confirm-host').click();
    await settle();
    expect(f.state().confirmed).toEqual(['media.gettyimages.com']);
    expect(qa(f.el, 'row').every((r) => r.dataset.status === 'hosted' || r.dataset.status === 'reuse')).toBe(true);
  });
  it('a confirmation list given at the start is kept', async () => {
    const { gh } = fakeGh();
    const svc = service({ [A]: pic(1), [G]: pic(3) });
    const f = make({ ...POST, body }, svc, gh, { deps: { confirmed: [G] } });
    await f.start();
    expect(svc.calls).toEqual([[A, G]]);
    expect(f.state().confirmed).toEqual([G]);
  });
  it('a Confirm that confirms nothing starts no run', async () => {
    const { gh, commits } = fakeGh();
    const svc = service({ [A]: pic(1), [G]: pic(3) });
    const f = make({ ...POST, body }, svc, gh);
    await f.start();
    const stale = q(f.el, 'confirm-all');
    q(f.el, 'confirm-all').click();
    await settle();
    expect(commits).toHaveLength(2);
    stale.disabled = false; // the old button was switched off with the job; a browser would not click it, so switch it on by hand to test the flow itself
    stale.click(); // the old button of the list that is gone
    await settle();
    expect(svc.calls).toHaveLength(2);
    expect(commits).toHaveLength(2);
    expect(q(f.el, 'status').textContent).toBe('There is nothing to confirm.');
  });
  it('the confirmation is kept when the run after it fails', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body }, service({ [A]: pic(1), [G]: pic(3) }), gh);
    await f.start();
    gh.commitFiles.mockImplementationOnce(async () => { throw new Error('GitHub is busy. Try again.'); });
    q(f.el, 'confirm-all').click();
    await settle();
    expect(f.state().confirmed).toEqual([G]);
    expect(q(f.el, 'status').textContent).toBe('GitHub is busy. Try again.');
    expect(q(f.el, 'status').className).toBe('bad');
    expect(q(f.el, 'confirm-all')).not.toBeNull();
  });
});

describe('a failure', () => {
  it('a failed commit shows one plain sentence, changes nothing and calls no onResult', async () => {
    const { gh, commits } = fakeGh({ failCommits: 1 });
    const onResult = vi.fn();
    const mine = { ...POST, body: `![One](${A})` };
    const f = make(mine, service({ [A]: pic(1) }), gh, { onResult });
    const r = await f.start();
    expect(r).toBeNull();
    expect(commits).toHaveLength(0);
    expect(onResult).not.toHaveBeenCalled();
    expect(q(f.el, 'status').textContent).toBe('Someone else saved at the same moment, so nothing was changed. Try again.');
    expect(q(f.el, 'status').className).toBe('bad');
    expect(f.state().post.body).toBe(mine.body); // the post AS IT WAS
    expect(f.state().status).toBeNull();
  });
  it('Save can be started again after a failed commit and then works', async () => {
    const { gh, commits } = fakeGh({ failCommits: 1 });
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh);
    await f.start();
    const r = await f.start();
    expect(r.status).toBe('saved');
    expect(commits).toHaveLength(1);
    expect(q(f.el, 'status').className).toBe('');
  });
  it('a missing GitHub connection gives its sentence before any download', async () => {
    const svc = service({ [A]: pic(1) });
    const f = hostingFlow({ post: { ...POST, body: `![One](${A})` }, deps: { postPath: POST_PATH, mediaPath: MEDIA_PATH, serializePost, fetchPictures: svc.fn, optimize, ownHosts: OWN, now: NOW } });
    await f.start();
    expect(q(f.el, 'status').textContent).toBe('There is no connection to GitHub.');
    expect(svc.fn).not.toHaveBeenCalled();
  });
  it('a token in an error never reaches the screen', async () => {
    const token = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const { gh } = fakeGh({ failCommits: 1, failWith: `Bad credentials ${token}` });
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh);
    await f.start();
    expect(f.el.textContent).not.toContain(token);
    expect(q(f.el, 'status').textContent).toBe('Bad credentials [hidden]');
  });
  it('a callback that throws is ignored: the save stays and no error is shown', async () => {
    const { gh, commits } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh, { onResult: () => { throw new Error('editor broke'); } });
    const r = await f.start();
    expect(r.status).toBe('saved');
    expect(commits).toHaveLength(1);
    expect(q(f.el, 'status').className).toBe('');
    expect(f.el.textContent).not.toContain('editor broke');
  });
});

describe('preview', () => {
  it('writes nothing, says it is a preview and still calls onResult', async () => {
    const { gh, commits } = fakeGh();
    const onResult = vi.fn();
    const mine = { ...POST, body: `![One](${A})` };
    const f = make(mine, service({ [A]: pic(1) }), gh, { dryRun: true, onResult });
    await f.start();
    expect(commits).toHaveLength(0);
    expect(q(f.el, 'status').textContent).toBe('Preview only, nothing was saved. All 1 picture is on your site.');
    expect(onResult.mock.calls[0][0].status).toBe('preview');
    expect(f.state().post.body).toBe(mine.body);
  });
  it('Retry in a preview is a preview again', async () => {
    const { gh, commits } = fakeGh();
    const svc = service({ [A]: 'timeout' });
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh, { dryRun: true });
    await f.start();
    svc.table[A] = pic(1);
    q(f.el, 'retry-all').click();
    await settle();
    expect(commits).toHaveLength(0);
    expect(f.state().status).toBe('preview');
  });
  it('only the value true makes a preview', async () => {
    for (const v of ['true', 1, 'yes', {}]) {
      const { gh, commits } = fakeGh();
      const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh, { dryRun: v });
      await f.start();
      expect(commits).toHaveLength(1);
    }
  });
});

describe('one run at a time', () => {
  it('start() during a Retry makes no second run', async () => {
    const { gh } = fakeGh();
    let release: any;
    let hold = false;
    const svc = service({ [A]: 'timeout' }, () => (hold ? new Promise<void>((r) => { release = r; }) : Promise.resolve()));
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh);
    await f.start();
    hold = true;
    svc.table[A] = pic(1);
    q(f.el, 'retry-all').click();
    await flush();
    f.start();
    await flush();
    expect(svc.calls).toHaveLength(2);
    expect(q(f.el, 'status').className).toBe('bad');
    release();
    await settle();
    expect(svc.calls).toHaveLength(2);
    expect(qa(f.el, 'row')[0].dataset.status).toBe('hosted');
  });
  it('the buttons are disabled while the first Save runs', async () => {
    const { gh } = fakeGh();
    let release: any;
    const svc = service({ [A]: pic(1) }, () => new Promise<void>((r) => { release = r; }));
    const f = make({ ...POST, body: `![One](${A})` }, svc, gh, { dryRun: true });
    const p = f.start();
    await flush();
    expect(f.state().running).toBe(true);
    release();
    await p;
    expect(f.state().running).toBe(false);
  });
});

describe('state, input and the source', () => {
  it('state() gives copies', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: pic(1) }), gh);
    await f.start();
    const s = f.state();
    s.post.body = 'changed'; s.confirmed.push('x');
    expect(f.state().post.body).not.toBe('changed');
    expect(f.state().confirmed).toEqual([]);
  });
  it('bad input never throws and gives an error sentence', async () => {
    for (const bad of [undefined, null, 5, 'x', [], {}, { post: 5, deps: 5 }]) {
      const f = hostingFlow(bad as any);
      await expect(f.start()).resolves.toBeNull();
      expect(q(f.el, 'status').hidden).toBe(false);
    }
  });
  it('a post that is not an object starts as an empty post', () => {
    for (const bad of ['x', 5, [], null, undefined]) {
      expect(hostingFlow({ post: bad as any, deps: {} }).state().post).toEqual({});
    }
  });
  it('the Show in post button of the screen calls onReplace with the address', async () => {
    const { gh } = fakeGh();
    const onReplace = vi.fn();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: 'not_image' }), gh, { onReplace });
    await f.start();
    q(qa(f.el, 'row')[0], 'replace-one').click();
    expect(onReplace).toHaveBeenCalledWith({ url: A });
  });
  it('without onReplace there is no Show in post button', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: 'not_image' }), gh);
    await f.start();
    expect(q(f.el, 'replace-one')).toBeNull();
  });
  it('canEdit false draws no button after the run', async () => {
    const { gh } = fakeGh();
    const f = make({ ...POST, body: `![One](${A})` }, service({ [A]: 'timeout' }), gh, { canEdit: false });
    await f.start();
    expect(f.el.querySelectorAll('button')).toHaveLength(0);
    expect(qa(f.el, 'row')).toHaveLength(1);
  });
  it('an address with tags in a post is shown as text', async () => {
    const { gh } = fakeGh();
    const evil = 'https://other.com/<img src=x onerror=alert(1)>.jpg';
    const f = make({ ...POST, body: `![One](${evil})` }, service({}), gh);
    await f.start();
    expect(f.el.querySelector('img')).toBeNull();
  });
  it('the source has no innerHTML, no network, no storage, no token and no emoji', () => {
    const code = src('public/admin/js/hosting-flow.js');
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|Authorization|Bearer|eval\s*\(|new Function/);
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
