// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';

// Phase 3c Part 4c-4a (v0.101.61): the Files screen hides the smaller copies and does not let a picture with copies be renamed or replaced yet.
// Part 4c-4b (v0.101.62): a picture with copies CAN be deleted; the copies go with it.
// Part 4c-4c (v0.101.63): a picture with copies CAN be renamed; the copies are renamed with it. 
// Part 4c-4d (v0.101.64): a picture with copies CAN be replaced; the old copies are removed in the same commit (they would still show the old picture).
const text = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const A480 = '/media/2026/11/city-hall-vote.480w.webp';
const A800 = '/media/2026/11/city-hall-vote.800w.webp';
const B = '/media/2026/10/senate-hearing.webp';
const J = '/media/2026/11/IMG_1234.jpg';
const f = (path: string, kb = 50) => ({ path, bytes: kb * 1024 });
const WITH = [f(A, 300), f(A480, 40), f(A800, 90), f(B, 80), f(J, 900)];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const tiles = (s: any) => qa(s.el, 'tile').map((t) => t.dataset.path);
const tile = (s: any, path: string) => qa(s.el, 'tile').find((t) => t.dataset.path === path);
const make = (files: any[], o: any = {}) => filesScreen({
  files, map: {}, items: [], deleteItems: [], sizes: {}, canEdit: true,
  canDelete: true, onDelete: vi.fn(async () => ({})),
  canReplace: true, onReplace: vi.fn(async () => {}),
  canRename: true, onRename: vi.fn(async () => ({})), ...o,
});
beforeEach(() => { document.body.innerHTML = ''; });

describe('copies are hidden', () => {
  it('shows only the main pictures when the main picture is in the list', () => {
    const s = make(WITH);
    expect(tiles(s)).toEqual([A, B, J]);
  });
  it('the count line counts pictures, not copies, and says how many copies are hidden', () => {
    const s = make(WITH);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text, 2 smaller copies hidden');
  });
  it('says "copy" for one copy', () => {
    const s = make([f(A, 300), f(A480, 40)]);
    expect(q(s.el, 'count').textContent).toBe('1 of 1 files, 1 without alt text, 1 smaller copy hidden');
  });
  it('a list without copies looks exactly as before (no hidden note)', () => {
    const s = make([f(A), f(B), f(J)]);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text');
    expect(tiles(s)).toEqual([A, B, J]);
  });
  it('a copy whose main picture is missing stays visible', () => {
    const s = make([f(A480, 40), f(B)]);
    expect(tiles(s)).toEqual([A480, B]);
    expect(q(s.el, 'count').textContent).toBe('2 of 2 files, 2 without alt text');
  });
  it('the search finds the main picture, and a search for "480w" finds nothing', () => {
    const s = make(WITH);
    const box = q(s.el, 'search');
    box.value = '480w'; box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tiles(s)).toEqual([]);
    expect(q(s.el, 'none').textContent).toBe('No file matches.');
    box.value = 'city-hall'; box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tiles(s)).toEqual([A]);
  });
  it('a copy never counts as a file without alt text', () => {
    const s = make(WITH, { map: { [A]: { alt: 'City hall vote' }, [B]: { alt: 'Senate' }, [J]: { alt: 'Photo' } } });
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 0 without alt text, 2 smaller copies hidden');
  });
  it('select() of a hidden copy shows "not found" and does not open an editor', () => {
    const s = make(WITH);
    s.select(A480);
    expect(q(s.el, 'editor').textContent).toContain('That file was not found.');
  });
  it('the input list of the caller is not changed', () => {
    const list = WITH.slice();
    make(list);
    expect(list).toHaveLength(5);
  });
});

describe('a picture with copies: details and nothing locked', () => {
  it('a picture without copies is NOT locked (delete, rename and replace work as before)', () => {
    const s = make(WITH);
    s.select(B);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete"]')).not.toBeNull();
    expect(q(s.el, 'rename-box').querySelector('[data-f="rename-input"]')).not.toBeNull();
    expect(q(s.el, 'replace-box').querySelector('[data-f="replace-input"]')).not.toBeNull();
    expect(q(s.el, 'delete-box').querySelector('[data-f="copies-locked"]')).toBeNull();
  });
  it('a JPEG never has copies, so it is not locked', () => {
    const s = make(WITH);
    s.select(J);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete"]')).not.toBeNull();
  });
  it('a picture that has only a stray copy of ANOTHER picture is not locked', () => {
    const s = make([...WITH, f('/media/2026/11/other.480w.webp', 10)]);
    s.select(B);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete"]')).not.toBeNull();
  });
  it('a role that cannot delete still sees the role sentence for a picture without copies', () => {
    const s = make(WITH, { canDelete: false });
    s.select(B);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete-locked"]')).not.toBeNull();
  });
  it('the details (alt text, caption, credit) of a picture with copies can still be saved', async () => {
    const onSave = vi.fn(async (_p: string, fields: any) => ({ [A]: fields }));
    const s = make(WITH, { onSave });
    s.select(A);
    const alt = q(s.el, 'alt'); alt.value = 'City hall vote'; alt.dispatchEvent(new Event('input', { bubbles: true }));
    await s.save();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe(A);
  });
});

describe('the source file', () => {
  const src = text('public/admin/js/files-screen.js');
  it('imports the two rules from hosting-srcset.js and writes no HTML from names', () => {
    expect(src).toContain("from './hosting-srcset.js'");
    expect(src).not.toMatch(/innerHTML/);
  });
  it('names makeVariants only in hosting-setup.js (the imageCopies switch, off by default), not in the Files screen or the other dashboard files', () => {
    for (const p of ['public/admin/js/hosting-save.js', 'public/admin/js/hosting-hook.js', 'public/admin/js/hosting-flow.js', 'public/admin/js/app.js', 'public/admin/js/files-screen.js']) {
      expect(text(p)).not.toMatch(/makeVariants/);
    }
  });
});

describe('delete takes the copies along (Part 4c-4b)', () => {
  const FIND = (t: string) => t;
  it('a picture with copies has a Delete button (it is not locked)', () => {
    const s = make(WITH);
    s.select(A);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete"]')).not.toBeNull();
    expect(q(s.el, 'delete-box').querySelector('[data-f="copies-locked"]')).toBeNull();
  });
  it('the question names the copies', () => {
    const s = make(WITH);
    s.select(A);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toBe('Delete city-hall-vote.webp for good? The file, its 2 smaller copies and its alt text, caption and credit are removed in one commit.');
  });
  it('the question is the old one for a picture without copies', () => {
    const s = make(WITH);
    s.select(B);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toBe('Delete senate-hearing.webp for good? The file and its alt text, caption and credit are removed in one commit.');
  });
  it('one copy says "its 1 smaller copy"', () => {
    const s = make([f(A, 300), f(A480, 40)]);
    s.select(A);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toContain('its 1 smaller copy and');
  });
  it('Yes calls onDelete once with the main path only, then the picture leaves the grid and the hidden count goes down', async () => {
    const onDelete = vi.fn(async () => ({}));
    const s = make(WITH, { onDelete });
    s.select(A);
    q(s.el, 'delete').click();
    q(s.el, 'delete-yes').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(A);
    expect(tiles(s)).toEqual([B, J]);
    expect(q(s.el, 'count').textContent).toBe('2 of 2 files, 2 without alt text');
    expect(q(s.el, 'deleted').textContent).toBe('Deleted city-hall-vote.webp and its 2 smaller copies.');
  });
  it('a copy of ANOTHER picture stays hidden and counted after a delete', async () => {
    const s = make([...WITH, f('/media/2026/10/senate-hearing.480w.webp', 10)]);
    s.select(A);
    q(s.el, 'delete').click();
    q(s.el, 'delete-yes').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q(s.el, 'count').textContent).toBe('2 of 2 files, 2 without alt text, 1 smaller copy hidden');
  });
  it('deleting a picture without copies says nothing about copies', async () => {
    const s = make(WITH);
    s.select(B);
    q(s.el, 'delete').click();
    q(s.el, 'delete-yes').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q(s.el, 'deleted').textContent).toBe('Deleted senate-hearing.webp.');
    expect(q(s.el, 'count').textContent).toBe('2 of 2 files, 2 without alt text, 2 smaller copies hidden');
  });
  it('a failed delete keeps the picture, the copies and the count', async () => {
    const onDelete = vi.fn(async () => { throw new Error('GitHub said no.'); });
    const s = make(WITH, { onDelete });
    s.select(A);
    q(s.el, 'delete').click();
    q(s.el, 'delete-yes').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q(s.el, 'delete-error').textContent).toBe('GitHub said no.');
    expect(tiles(s)).toEqual([A, B, J]);
    expect(q(s.el, 'count').textContent).toContain('2 smaller copies hidden');
  });
  it('a picture that a post uses is still refused, with its list, copies or not', () => {
    const items = [{ file: 'content/blogs/news/vote.md', text: `---\nimage: ${A}\n---\nBody` }];
    const s = make(WITH, { items, deleteItems: items });
    s.select(A);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete-refused"]')).not.toBeNull();
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete"]')).toBeNull();
  });
  it('the role sentence still comes first for a role that cannot delete', () => {
    const s = make(WITH, { canDelete: false });
    s.select(A);
    expect(q(s.el, 'delete-box').querySelector('[data-f="delete-locked"]')).not.toBeNull();
    void FIND;
  });
});

describe('rename takes the copies along (Part 4c-4c)', () => {
  const NEW = '/media/2026/11/council-vote.webp';
  const fresh = () => WITH.map((x) => ({ ...x })); // the screen changes the path of a renamed file, so each test gets its own objects
  const go = async (s: any, name = 'council-vote') => {
    q(s.el, 'rename-input').value = name;
    q(s.el, 'rename-go').click();
    q(s.el, 'rename-yes').click();
    await new Promise((r) => setTimeout(r, 0));
  };
  it('a picture with copies has a rename input (it is not locked)', () => {
    const s = make(fresh());
    s.select(A);
    expect(q(s.el, 'rename-box').querySelector('[data-f="rename-input"]')).not.toBeNull();
    expect(q(s.el, 'rename-box').querySelector('[data-f="copies-locked"]')).toBeNull();
  });
  it('the question names the copies', () => {
    const s = make(fresh());
    s.select(A);
    q(s.el, 'rename-input').value = 'council-vote';
    q(s.el, 'rename-go').click();
    expect(q(s.el, 'rename-ask').textContent).toContain('Rename city-hall-vote.webp to council-vote.webp? Its 2 smaller copies are renamed with it. ');
  });
  it('one copy says "Its 1 smaller copy is renamed"', () => {
    const s = make([f(A, 300), f(A480, 40)]);
    s.select(A);
    q(s.el, 'rename-input').value = 'council-vote';
    q(s.el, 'rename-go').click();
    expect(q(s.el, 'rename-ask').textContent).toContain('Its 1 smaller copy is renamed with it. ');
  });
  it('the question for a picture without copies is the old one', () => {
    const s = make(fresh());
    s.select(B);
    q(s.el, 'rename-input').value = 'senate-vote';
    q(s.el, 'rename-go').click();
    expect(q(s.el, 'rename-ask').textContent).not.toContain('smaller');
  });
  it('Yes calls onRename once with the main path only; the grid shows the new name; the hidden count stays', async () => {
    const onRename = vi.fn(async () => ({ newPath: NEW }));
    const s = make(fresh(), { onRename });
    s.select(A);
    await go(s);
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(A, 'council-vote');
    expect(tiles(s)).toEqual([NEW, B, J]);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text, 2 smaller copies hidden');
    expect(q(s.el, 'renamed').textContent).toContain('Renamed city-hall-vote.webp to council-vote.webp and its 2 smaller copies.');
  });
  it('renaming a picture without copies says nothing about copies', async () => {
    const s = make(fresh(), { onRename: vi.fn(async () => ({ newPath: '/media/2026/10/senate-vote.webp' })) });
    s.select(B);
    await go(s, 'senate-vote');
    expect(q(s.el, 'renamed').textContent).not.toContain('smaller');
  });
  it('after the rename the copies belong to the new name: Delete names them and Rename names them again', async () => {
    const s = make(fresh(), { onRename: vi.fn(async () => ({ newPath: NEW })) });
    s.select(A);
    await go(s);
    s.select(NEW);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toContain('its 2 smaller copies and');
    s.select(NEW);
    q(s.el, 'rename-input').value = 'council-vote-2';
    q(s.el, 'rename-go').click();
    expect(q(s.el, 'rename-ask').textContent).toContain('Its 2 smaller copies are renamed with it. ');
  });
  it('a failed rename keeps the name, the copies and the count', async () => {
    const s = make(fresh(), { onRename: vi.fn(async () => { throw new Error('No luck.'); }) });
    s.select(A);
    await go(s);
    expect(tiles(s)).toEqual([A, B, J]);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text, 2 smaller copies hidden');
    expect(q(s.el, 'rename-error').textContent).toBe('No luck.');
    expect(q(s.el, 'rename-box').querySelector('[data-f="copies-locked"]')).toBeNull();
  });
  it('a copy of ANOTHER picture does not move', async () => {
    const OTHER480 = '/media/2026/10/senate-hearing.480w.webp';
    const s = make([...fresh(), f(OTHER480, 10)], { onRename: vi.fn(async () => ({ newPath: NEW })) });
    s.select(A);
    await go(s);
    s.select(B);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).toContain('its 1 smaller copy and');
  });
});

describe('replace removes the old copies (Part 4c-4d)', () => {
  const WEBP = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, ...new Array(52).fill(0)]);
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const fresh = () => WITH.map((x) => ({ ...x }));
  const pick = async (s: any) => {
    const input = q(s.el, 'replace-input');
    Object.defineProperty(input, 'files', { value: [{ name: 'fresh.webp', arrayBuffer: async () => WEBP.buffer.slice(0) }], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  };
  const go = async (s: any) => { await pick(s); q(s.el, 'replace-yes').click(); await flush(); };
  it('a picture with copies has a file chooser (it is not locked)', () => {
    const s = make(fresh());
    s.select(A);
    expect(q(s.el, 'replace-box').querySelector('[data-f="replace-input"]')).not.toBeNull();
    expect(q(s.el, 'replace-box').querySelector('[data-f="copies-locked"]')).toBeNull();
  });
  it('the question names the copies and says why they go', async () => {
    const s = make(fresh());
    s.select(A);
    await pick(s);
    expect(q(s.el, 'replace-ask').textContent).toContain('Its 2 smaller copies are removed in the same commit, because they would still show the old picture.');
  });
  it('one copy says "Its 1 smaller copy is removed ... because it would"', async () => {
    const s = make([f(A, 300), f(A480, 40)]);
    s.select(A);
    await pick(s);
    expect(q(s.el, 'replace-ask').textContent).toContain('Its 1 smaller copy is removed in the same commit, because it would still show the old picture.');
  });
  it('the question for a picture without copies is the old one', async () => {
    const s = make(fresh());
    s.select(B);
    await pick(s);
    expect(q(s.el, 'replace-ask').textContent).not.toContain('smaller');
  });
  it('Yes calls onReplace once with the main path; the hidden count goes down to nothing; the answer names the copies', async () => {
    const onReplace = vi.fn(async () => ({ map: null, removed: [A480, A800] }));
    const s = make(fresh(), { onReplace });
    s.select(A);
    await go(s);
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onReplace.mock.calls[0][0]).toBe(A);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text');
    expect(q(s.el, 'replaced').textContent).toBe('Replaced city-hall-vote.webp and removed its 2 old smaller copies. The address stays the same.');
  });
  it('after the replace the picture has no copies: a second Delete names none', async () => {
    const s = make(fresh(), { onReplace: vi.fn(async () => ({ map: null })) });
    s.select(A);
    await go(s);
    s.select(A);
    q(s.el, 'delete').click();
    expect(q(s.el, 'delete-ask').textContent).not.toContain('smaller');
  });
  it('replacing a picture without copies says nothing about copies', async () => {
    const s = make(fresh());
    s.select(B);
    await go(s);
    expect(q(s.el, 'replaced').textContent).toBe('Replaced senate-hearing.webp. The address stays the same.');
  });
  it('a failed replace keeps the copies and the count', async () => {
    const s = make(fresh(), { onReplace: vi.fn(async () => { throw new Error('No luck.'); }) });
    s.select(A);
    await go(s);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text, 2 smaller copies hidden');
    expect(q(s.el, 'replace-error').textContent).toBe('No luck.');
  });
  it('a copy of ANOTHER picture stays hidden and counted', async () => {
    const s = make([...fresh(), f('/media/2026/10/senate-hearing.480w.webp', 10)], { onReplace: vi.fn(async () => ({ map: null })) });
    s.select(A);
    await go(s);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 3 without alt text, 1 smaller copy hidden');
  });
});
