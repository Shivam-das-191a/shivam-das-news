// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';
// @ts-ignore
import { pictureKind, replaceCheck, REPLACE_MAX_BYTES, SIZE_WARN_BYTES } from '../../public/admin/js/media-meta.js';
// @ts-ignore
import { can } from '../../public/admin/js/roles.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));
const pad = (a: number[], n = 64) => new Uint8Array([...a, ...new Array(Math.max(0, n - a.length)).fill(0)]);
const WEBP = pad([...txt('RIFF'), 0, 0, 0, 0, ...txt('WEBP')]);
const PNG = pad([0x89, ...txt('PNG'), 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad(txt('GIF89a'));
const AVIF = pad([0, 0, 0, 0x1c, ...txt('ftypavif')]);
const SVG = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
const big = (head: Uint8Array, n: number) => { const o = new Uint8Array(n); o.set(head); return o; };

const A = '/media/2026/11/city-hall-vote.webp';
const J = '/media/2026/11/photo.jpeg';
const FILES = [{ path: A, bytes: 120 * 1024 }, { path: J, bytes: 90 * 1024 }];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const flush = () => new Promise((r) => setTimeout(r, 0));
const make = (o: any = {}) => filesScreen({ files: FILES.map((f) => ({ ...f })), map: {}, items: [], sizes: {}, canEdit: true, canReplace: true, canDelete: false, onSave: async () => ({}), onReplace: async () => undefined, ...o });
const pick = async (s: any, bytes: Uint8Array, name = 'new.webp') => {
  const input = q(s.el, 'replace-input');
  Object.defineProperty(input, 'files', { value: [{ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('pictureKind (what the first bytes say)', () => {
  it('knows the six kinds', () => {
    expect([WEBP, PNG, JPG, GIF, AVIF, SVG].map(pictureKind)).toEqual(['webp', 'png', 'jpg', 'gif', 'avif', 'svg']);
  });
  it('does not guess from empty, short, text or other bytes', () => {
    for (const b of [new Uint8Array(0), new Uint8Array([1, 2, 3]), new TextEncoder().encode('hello world'), new TextEncoder().encode('<html><body>x</body></html>'), null as any, 'RIFF' as any]) expect(pictureKind(b)).toBe('');
  });
  it('RIFF without WEBP is not a webp', () => {
    expect(pictureKind(pad([...txt('RIFF'), 0, 0, 0, 0, ...txt('WAVE')]))).toBe('');
  });
});

describe('replaceCheck (the rules)', () => {
  it('the same kind passes', () => {
    expect(replaceCheck(A, { name: 'a.webp', bytes: WEBP })).toEqual({ ok: true, errors: [], warnings: [] });
  });
  it('jpeg and jpg are the same kind', () => {
    expect(replaceCheck(J, { name: 'a.jpg', bytes: JPG }).ok).toBe(true);
    expect(replaceCheck('/media/a.JPG', { name: 'a.jpg', bytes: JPG }).ok).toBe(true);
  });
  it('a different kind is refused by its bytes, not by its name', () => {
    const r = replaceCheck(A, { name: 'fake.webp', bytes: PNG });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('ends in .webp');
    expect(r.errors[0]).toContain('PNG');
  });
  it('a file that is not a picture is refused', () => {
    expect(replaceCheck(A, { name: 'a.webp', bytes: new TextEncoder().encode('<html></html>') }).errors[0]).toContain('does not look like a picture');
  });
  it('an empty or missing file is refused', () => {
    expect(replaceCheck(A, { name: 'a', bytes: new Uint8Array(0) }).errors).toEqual(['The chosen file is empty.']);
    expect(replaceCheck(A, {} as any).ok).toBe(false);
    expect(replaceCheck(A, undefined as any).ok).toBe(false);
  });
  it('over the limit is refused, over the budget only warns', () => {
    expect(replaceCheck(A, { name: 'a', bytes: big(WEBP, REPLACE_MAX_BYTES + 1) }).ok).toBe(false);
    const w = replaceCheck(A, { name: 'a', bytes: big(WEBP, SIZE_WARN_BYTES + 1) });
    expect(w.ok).toBe(true);
    expect(w.warnings[0]).toContain('slow');
    expect(replaceCheck(A, { name: 'a', bytes: big(WEBP, REPLACE_MAX_BYTES) }).ok).toBe(true);
  });
  it('anything that is not a file under /media/ is refused', () => {
    for (const p of ['/icon-512.png', '/media/../x.webp', '/media/a.webp?x=1', '', undefined]) expect(replaceCheck(p as any, { name: 'a', bytes: WEBP }).ok).toBe(false);
  });
});

describe('the Replace part of the Files screen', () => {
  it('shows a file chooser that accepts only the same extension', () => {
    const s = make(); s.select(A);
    expect(q(s.el, 'replace-input').getAttribute('accept')).toBe('.webp');
    expect(q(s.el, 'replace-yes')).toBeNull();
  });
  it('choosing a good file shows its name and size and asks once; nothing is sent yet', async () => {
    const onReplace = vi.fn(async () => undefined);
    const s = make({ onReplace }); s.select(A);
    await pick(s, big(WEBP, 50 * 1024), 'fresh.webp');
    expect(q(s.el, 'replace-info').textContent).toBe('fresh.webp \u00B7 50 KB');
    expect(q(s.el, 'replace-ask').textContent).toContain(A);
    expect(q(s.el, 'replace-yes')).not.toBeNull();
    expect(onReplace).not.toHaveBeenCalled();
  });
  it('a file of another kind shows the red line and no Yes button', async () => {
    const s = make(); s.select(A);
    await pick(s, PNG, 'x.png');
    expect(q(s.el, 'replace-errors').textContent).toContain('PNG');
    expect(q(s.el, 'replace-yes')).toBeNull();
    expect(q(s.el, 'replace-cancel').textContent).toBe('Choose another file');
  });
  it('a big file shows a warning but may still be replaced', async () => {
    const s = make(); s.select(A);
    await pick(s, big(WEBP, 400 * 1024));
    expect(q(s.el, 'replace-warnings').textContent).toContain('slow');
    expect(q(s.el, 'replace-yes')).not.toBeNull();
  });
  it('Cancel goes back to the chooser and sends nothing', async () => {
    const onReplace = vi.fn(async () => undefined);
    const s = make({ onReplace }); s.select(A);
    await pick(s, WEBP); q(s.el, 'replace-cancel').click();
    expect(q(s.el, 'replace-input')).not.toBeNull();
    expect(onReplace).not.toHaveBeenCalled();
  });
  it('Yes calls onReplace once with the path and the bytes, then shows the new size', async () => {
    const onReplace = vi.fn(async () => undefined);
    const s = make({ onReplace }); s.select(A);
    const bytes = big(WEBP, 40 * 1024);
    await pick(s, bytes, 'fresh.webp');
    q(s.el, 'replace-yes').click(); await flush();
    expect(onReplace).toHaveBeenCalledTimes(1);
    const [path, file] = onReplace.mock.calls[0] as any;
    expect(path).toBe(A);
    expect(file.name).toBe('fresh.webp');
    expect(file.bytes.length).toBe(40 * 1024);
    expect(q(s.el, 'replaced').textContent).toBe('Replaced city-hall-vote.webp. The address stays the same.');
    expect(q(s.el, 'meta').textContent).toContain('40 KB');
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([A, J]);
  });
  it('a failed replace shows the message and changes nothing', async () => {
    const s = make({ onReplace: async () => { throw new Error('Someone else saved at the same moment, so nothing was changed. Try again.'); } }); s.select(A);
    await pick(s, WEBP); q(s.el, 'replace-yes').click(); await flush();
    expect(q(s.el, 'replace-error').textContent).toContain('Someone else saved');
    expect(q(s.el, 'replaced')).toBeNull();
    expect(q(s.el, 'meta').textContent).toContain('120 KB');
  });
  it('a role without the right sees no chooser and a plain sentence', () => {
    const s = make({ canReplace: false }); s.select(A);
    expect(q(s.el, 'replace-input')).toBeNull();
    expect(q(s.el, 'replace-locked').textContent).toBe('Only an editor or an admin can replace a file.');
  });
  it('without onReplace there is no chooser even when the role may replace', () => {
    const s = make({ onReplace: undefined }); s.select(A);
    expect(q(s.el, 'replace-input')).toBeNull();
  });
  it('a file name is shown as text, never as HTML', async () => {
    const s = make(); s.select(A);
    await pick(s, WEBP, '<b>bold</b>.webp');
    expect(s.el.querySelector('b')).toBeNull();
    expect(q(s.el, 'replace-info').textContent).toContain('<b>bold</b>.webp');
  });
  it('a replace does not touch the delete part or the details', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ onSave, map: { [A]: { alt: 'Council votes' } } }); s.select(A);
    await pick(s, WEBP); q(s.el, 'replace-yes').click(); await flush();
    expect(onSave).not.toHaveBeenCalled();
    expect(s.map()).toEqual({ [A]: { alt: 'Council votes' } });
    expect(q(s.el, 'alt').value).toBe('Council votes');
  });
});

describe('roles and app.js', () => {
  const app = src('public/admin/js/app.js');
  const handler = () => { const a = app.indexOf('onReplace: async (path, file)'); return app.slice(a, app.indexOf("toast('Replaced.')", a)); };
  it('only an editor and an admin hold media:replace', () => {
    expect(can('admin', 'media:replace')).toBe(true);
    expect(can('editor', 'media:replace')).toBe(true);
    expect(can('author', 'media:replace')).toBe(false);
    expect(can(null, 'media:replace')).toBe(false);
  });
  it('the screen is given canReplace and onReplace', () => {
    expect(app).toContain("canReplace: can(S.role, 'media:replace')");
    expect(app).toContain('onReplace: async (path, file)');
  });
  it('onReplace checks the role first, before it reads or writes anything', () => {
    const b = handler();
    expect(b.indexOf("can(S.role, 'media:replace')")).toBeGreaterThan(-1);
    expect(b.indexOf("can(S.role, 'media:replace')")).toBeLessThan(b.indexOf('S.gh.tree()'));
    expect(b.indexOf("can(S.role, 'media:replace')")).toBeLessThan(b.indexOf('commitFiles'));
  });
  it('onReplace checks the file again before it commits', () => {
    const b = handler();
    expect(b).toMatch(/if \(!chk\.ok\) throw new Error/);
    expect(b.indexOf('replaceCheck(')).toBeLessThan(b.indexOf('commitFiles'));
  });
  it('one commit writes the new bytes at the SAME repository path; only the old smaller copies of this picture can be deleted with it (Part 4c-4d)', () => {
    const b = handler();
    expect((b.match(/commitFiles\(/g) || []).length).toBe(1);
    expect(b).toContain('const repoPath = P().pub + path;');
    expect(b).toContain('planReplace(path, file.bytes,');
    expect(b).toContain('[...plan.entries]');
    expect(b).not.toContain('delete: true'); // the deletes come from planReplace, never from this handler
    expect(b).toContain('admin: replace file');
  });
  it('a file that is gone is reported, not created', () => {
    expect(handler()).toContain("S.tree.some((t) => t.path === repoPath)");
  });
  it('the preview shows the new picture at once', () => {
    expect(handler()).toContain('S.previews.set(path');
  });
});
