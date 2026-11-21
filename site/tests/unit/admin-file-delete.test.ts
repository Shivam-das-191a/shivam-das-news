// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';
// @ts-ignore
import { deleteCheck, removeMedia } from '../../public/admin/js/media-meta.js';
// @ts-ignore
import { can } from '../../public/admin/js/roles.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const B = '/media/2026/11/IMG_1234.jpg';
const C = '/media/2026/10/senate-hearing.webp';
const FILES = [{ path: A, bytes: 1000 }, { path: B, bytes: 1000 }, { path: C, bytes: 1000 }];
const ITEMS = [{ file: 'content/blogs/news/vote.md', text: `---\ntitle: Vote\nimage: ${A}\n---\nBody` }];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const make = (o: any = {}) => filesScreen({ files: FILES, map: {}, items: ITEMS, sizes: {}, canEdit: true, canDelete: true, onSave: async () => ({}), onDelete: async () => undefined, ...o });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = ''; });

describe('deleteCheck and removeMedia (the rules)', () => {
  it('a file no one names may be deleted', () => {
    expect(deleteCheck(B, ITEMS)).toEqual({ ok: true, usedBy: [], reason: '' });
  });
  it('a used file is refused, with the list of files', () => {
    const r = deleteCheck(A, ITEMS);
    expect(r.ok).toBe(false);
    expect(r.usedBy).toEqual(['content/blogs/news/vote.md']);
    expect(r.reason).toContain('used in 1 place');
  });
  it('counts places in plural and a longer name that only starts the same does not count', () => {
    const items = [{ file: 'a.md', text: A }, { file: 'b.json', text: A }, { file: 'c.md', text: A + '.bak' }];
    expect(deleteCheck(A, items).usedBy).toEqual(['a.md', 'b.json']);
    expect(deleteCheck(A, items).reason).toContain('2 places');
  });
  it('anything that is not a file under /media/ is refused', () => {
    for (const p of ['/icon-512.png', '/media/../config/site.json', '/media/a.webp?x=1', '', undefined]) expect(deleteCheck(p as any, []).ok).toBe(false);
  });
  it('removeMedia drops one entry and does not change the input', () => {
    const map = { [A]: { alt: 'x' }, [C]: { alt: 'y' } };
    const out = removeMedia(map, A);
    expect(out).toEqual({ [C]: { alt: 'y' } });
    expect(map[A]).toEqual({ alt: 'x' });
    expect(removeMedia(null, A)).toEqual({});
  });
});

describe('the Delete part of the Files screen', () => {
  it('a used file shows the refusal and the list, and no delete button', () => {
    const s = make(); s.select(A);
    expect(q(s.el, 'delete-refused').textContent).toContain('cannot be deleted');
    expect(qa(s.el, 'delete-used').map((u) => u.textContent).join()).toContain('content/blogs/news/vote.md');
    expect(q(s.el, 'delete')).toBeNull();
  });
  it('the refusal also counts files outside posts and pages (deleteItems)', () => {
    const s = make({ deleteItems: [{ file: 'content/authors/shivam-das.json', text: `{"photo":"${B}"}` }] });
    s.select(B);
    expect(q(s.el, 'delete-used').textContent).toContain('content/authors/shivam-das.json');
    expect(q(s.el, 'delete')).toBeNull();
  });
  it('an unused file asks twice: Delete file, then Yes', () => {
    const onDelete = vi.fn(async () => undefined);
    const s = make({ onDelete }); s.select(B);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toContain('IMG_1234.jpg');
    expect(onDelete).not.toHaveBeenCalled();
  });
  it('Cancel goes back and deletes nothing', () => {
    const onDelete = vi.fn(async () => undefined);
    const s = make({ onDelete }); s.select(B);
    q(s.el, 'delete').click(); q(s.el, 'delete-cancel').click();
    expect(q(s.el, 'delete')).not.toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(qa(s.el, 'tile')).toHaveLength(3);
  });
  it('Yes calls onDelete once with the path, then the file leaves the grid', async () => {
    const onDelete = vi.fn(async () => ({ [C]: { alt: 'y' } }));
    const s = make({ onDelete, map: { [B]: { alt: 'x' }, [C]: { alt: 'y' } } }); s.select(B);
    q(s.el, 'delete').click(); q(s.el, 'delete-yes').click(); await flush();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(B);
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([A, C]);
    expect(q(s.el, 'deleted').textContent).toBe('Deleted IMG_1234.jpg.');
    expect(q(s.el, 'count').textContent).toBe('2 of 2 files, 1 without alt text');
    expect(s.map()).toEqual({ [C]: { alt: 'y' } });
  });
  it('when onDelete returns nothing the entry is still removed from the map', async () => {
    const s = make({ map: { [B]: { alt: 'x' } } }); s.select(B);
    q(s.el, 'delete').click(); q(s.el, 'delete-yes').click(); await flush();
    expect(s.map()).toEqual({});
  });
  it('a failed delete shows the message and changes nothing', async () => {
    const s = make({ onDelete: async () => { throw new Error('Someone else saved at the same moment, so nothing was changed. Try again.'); } }); s.select(B);
    q(s.el, 'delete').click(); q(s.el, 'delete-yes').click(); await flush();
    expect(q(s.el, 'delete-error').textContent).toContain('Someone else saved');
    expect(qa(s.el, 'tile')).toHaveLength(3);
    expect(q(s.el, 'delete')).not.toBeNull();
  });
  it('a role without the delete right sees no button and a plain sentence', () => {
    const s = make({ canDelete: false }); s.select(B);
    expect(q(s.el, 'delete')).toBeNull();
    expect(q(s.el, 'delete-locked').textContent).toBe('Only an editor or an admin can delete a file.');
  });
  it('without onDelete there is no button even when the role may delete', () => {
    const s = make({ onDelete: undefined }); s.select(B);
    expect(q(s.el, 'delete')).toBeNull();
    expect(q(s.el, 'delete-locked')).not.toBeNull();
  });
  it('a script cannot get a delete through a locked screen', async () => {
    const onDelete = vi.fn(async () => undefined);
    const s = make({ canDelete: false, onDelete }); s.select(B);
    q(s.el, 'delete-yes')?.click(); await flush();
    expect(onDelete).not.toHaveBeenCalled();
  });
  it('a file name in the question is text, never HTML', () => {
    const s = make({ files: [{ path: '/media/a<b>bold.webp', bytes: 1 }], items: [] }); s.select('/media/a<b>bold.webp');
    q(s.el, 'delete').click();
    expect(s.el.querySelector('b')).toBeNull();
    expect(q(s.el, 'delete-ask').textContent).toContain('a<b>bold.webp');
  });
});

describe('roles and app.js', () => {
  it('only an editor and an admin hold media:delete (PLAN 33.5)', () => {
    expect(can('admin', 'media:delete')).toBe(true);
    expect(can('editor', 'media:delete')).toBe(true);
    expect(can('author', 'media:delete')).toBe(false);
    expect(can('author', 'media')).toBe(true);
    expect(can(null, 'media:delete')).toBe(false);
  });
  const app = src('public/admin/js/app.js');
  const handler = () => { const a = app.indexOf('onDelete: async (path)'); return app.slice(a, app.indexOf('return next;', a)); };
  it('the screen is given canDelete and onDelete', () => {
    expect(app).toContain("canDelete: can(S.role, 'media:delete')");
    expect(app).toContain('onDelete: async (path)');
  });
  it('onDelete checks the role again, before it reads or writes anything', () => {
    const body = handler();
    expect(body.indexOf("can(S.role, 'media:delete')")).toBeGreaterThan(-1);
    expect(body.indexOf("can(S.role, 'media:delete')")).toBeLessThan(body.indexOf('S.gh.tree()'));
    expect(body.indexOf("can(S.role, 'media:delete')")).toBeLessThan(body.indexOf('commitFiles'));
  });
  it('onDelete reads the content again and checks the use before it commits', () => {
    const body = handler();
    expect(body.indexOf('deleteCheck(')).toBeGreaterThan(-1);
    expect(body.indexOf('deleteCheck(')).toBeLessThan(body.indexOf('commitFiles'));
    expect(body).toContain('loadPosts(false)');
    expect(body).toMatch(/if \(!chk\.ok\) throw new Error/);
  });
  it('the picture and its media.json entry go in ONE commit', () => {
    const body = handler();
    expect((body.match(/commitFiles\(/g) || []).length).toBe(1);
    expect(body).toContain('planDelete(path,');
    expect(body).toContain('...plan.deletes');
    expect(body).toContain('mapWithout(next, [path, ...plan.copies])');
    expect(body).toContain('admin: delete file');
  });
  it('config/media.json is not in the list that blocks a delete, authors and config are', () => {
    const fn = app.slice(app.indexOf('async function otherItems()'), app.indexOf('// ---------- files (v0.101.28'));
    expect(fn).toContain('P().mediaMeta');
    expect(fn).toContain('P().authors');
    expect(fn).toContain("'config'");
  });
  it('after the commit the next Save gets the new sha of config/media.json', () => {
    const body = handler();
    expect(body.indexOf('commitFiles')).toBeLessThan(body.indexOf('sha = (await S.gh.getText(P().mediaMeta)).sha'));
  });
});
