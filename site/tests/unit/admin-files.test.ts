// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const B = '/media/2026/11/IMG_1234.jpg';
const C = '/media/2026/10/senate-hearing.webp';
const FILES = [{ path: A, bytes: 120 * 1024 }, { path: B, bytes: 900 * 1024 }, { path: C, bytes: 80 * 1024 }];
const ITEMS = [
  { file: 'content/blogs/news/vote.md', text: `---\ntitle: Vote\nimage: ${A}\n---\nBody ![x](${C})` },
  { file: 'content/pages/about-us.md', text: `---\ntitle: About\n---\n<img src="${A}" alt="">` },
];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const make = (o: any = {}) => filesScreen({ files: FILES, map: {}, items: ITEMS, sizes: {}, canEdit: true, onSave: async (_p: string, f: any) => ({ ...f }), ...o });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = ''; });

describe('the grid', () => {
  it('draws one tile per file and the count line', () => {
    const s = make({ map: { [A]: { alt: 'Council votes' } } });
    expect(qa(s.el, 'tile')).toHaveLength(3);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 2 without alt text');
  });
  it('marks the files without alt text', () => {
    const s = make({ map: { [A]: { alt: 'Council votes' } } });
    const tiles = qa(s.el, 'tile');
    expect(tiles.find((t) => t.dataset.path === A).querySelector('[data-f="noalt-badge"]')).toBeNull();
    expect(tiles.find((t) => t.dataset.path === B).querySelector('[data-f="noalt-badge"]')).not.toBeNull();
  });
  it('the search box filters by file name, ignoring case', () => {
    const s = make();
    type(q(s.el, 'search'), 'SENATE');
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([C]);
    expect(q(s.el, 'count').textContent).toBe('1 of 3 files, 3 without alt text');
    type(q(s.el, 'search'), 'img_1');
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([B]);
    type(q(s.el, 'search'), 'nothing-matches');
    expect(q(s.el, 'none').textContent).toBe('No file matches.');
  });
  it('"Only files without alt text" hides the files that have it', () => {
    const s = make({ map: { [A]: { alt: 'x' }, [C]: { alt: 'y' } } });
    const box = q(s.el, 'noalt'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(qa(s.el, 'tile').map((t) => t.dataset.path)).toEqual([B]);
  });
  it('shows a plain message when there are no files', () => {
    const s = make({ files: [] });
    expect(q(s.el, 'none').textContent).toContain('No images yet');
    expect(q(s.el, 'count').textContent).toBe('0 of 0 files, 0 without alt text');
  });
  it('a file name is shown as text, never as HTML', () => {
    const s = make({ files: [{ path: '/media/a<b>bold.webp', bytes: 1000 }] });
    expect(s.el.querySelector('b')).toBeNull();
    expect(s.el.textContent).toContain('a<b>bold.webp');
  });
  it('clicking a tile opens that file in the editor', () => {
    const s = make();
    qa(s.el, 'tile').find((t) => t.dataset.path === C).click();
    expect(q(s.el, 'name').textContent).toBe('senate-hearing.webp');
    expect(qa(s.el, 'tile').find((t) => t.dataset.path === C).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the editor', () => {
  it('shows the stored details, the type, the size and the size in pixels when known', () => {
    const s = make({ map: { [A]: { alt: 'Council votes', caption: 'The vote', credit: 'Staff' } }, sizes: { [A]: { width: 1600, height: 900 } } });
    s.select(A);
    expect(q(s.el, 'alt').value).toBe('Council votes');
    expect(q(s.el, 'caption').value).toBe('The vote');
    expect(q(s.el, 'credit').value).toBe('Staff');
    expect(q(s.el, 'meta').textContent).toBe(`${A} \u00B7 WEBP \u00B7 120 KB \u00B7 1600 x 900 px`);
  });
  it('says so when the pixel size is not read yet', () => {
    const s = make(); s.select(A);
    expect(q(s.el, 'meta').textContent).toContain('size not read yet');
  });
  it('the alt counter and the checks follow every keystroke', () => {
    const s = make(); s.select(A);
    expect(q(s.el, 'checks').textContent).toContain('No alt text');
    type(q(s.el, 'alt'), 'Council members vote');
    expect(q(s.el, 'checks').textContent).not.toContain('No alt text');
    expect(q(s.el, 'alt-count').textContent).toBe('20 characters (up to 125 recommended)');
    type(q(s.el, 'alt'), 'a'.repeat(126));
    expect(q(s.el, 'checks').querySelector('[data-code="alt-long"]')).not.toBeNull();
  });
  it('warns about an unreadable name, a size over the budget and a format other than WebP', () => {
    const s = make(); s.select(B);
    const codes = [...q(s.el, 'checks').querySelectorAll('li')].map((li: any) => li.dataset.code);
    expect(codes).toEqual(expect.arrayContaining(['alt', 'name', 'format', 'size']));
  });
  it('a featured picture under 1200 px wide gets the width warning; a body picture does not', () => {
    const s = make({ sizes: { [A]: { width: 800, height: 600 }, [C]: { width: 800, height: 600 } } });
    s.select(A);
    expect(q(s.el, 'checks').querySelector('[data-code="width"]')).not.toBeNull();
    s.select(C);
    expect(q(s.el, 'checks').querySelector('[data-code="width"]')).toBeNull();
  });
  it('says "No problems found." for a good picture', () => {
    const s = make({ map: { [A]: { alt: 'Council members vote' } }, sizes: { [A]: { width: 1600, height: 900 } } });
    s.select(A);
    expect(q(s.el, 'checks').textContent).toBe('No problems found.');
  });
  it('lists where the file is used and marks the featured image', () => {
    const s = make(); s.select(A);
    const li = qa(s.el, 'used')[0].querySelectorAll('li');
    expect([...li].map((x: any) => x.textContent)).toEqual(['content/blogs/news/vote.md (featured image)', 'content/pages/about-us.md']);
  });
  it('says so when no post or page shows the file', () => {
    const s = make(); s.select(B);
    expect(q(s.el, 'used-none').textContent).toBe('No post or page shows this file yet.');
  });
  it('asks for an unknown file politely', () => {
    const s = make(); s.select('/media/nope.webp');
    expect(s.el.textContent).toContain('That file was not found.');
  });
});

describe('saving', () => {
  it('calls onSave with the three fields, then shows the new state in the grid', async () => {
    const onSave = vi.fn(async (p: string, f: any) => ({ [p]: { alt: f.alt } }));
    const s = make({ onSave }); s.select(A);
    type(q(s.el, 'alt'), 'Council members vote'); type(q(s.el, 'caption'), 'The vote'); type(q(s.el, 'credit'), 'Staff');
    q(s.el, 'save').click(); await flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(A, { alt: 'Council members vote', caption: 'The vote', credit: 'Staff' });
    expect(s.map()).toEqual({ [A]: { alt: 'Council members vote' } });
    expect(qa(s.el, 'tile').find((t) => t.dataset.path === A).querySelector('[data-f="noalt-badge"]')).toBeNull();
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 2 without alt text');
  });
  it('does not call onSave while a red error stands (alt over 300, emoji)', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ onSave }); s.select(A);
    type(q(s.el, 'alt'), 'a'.repeat(301));
    expect(q(s.el, 'errors').hidden).toBe(false);
    q(s.el, 'save').click(); await flush();
    type(q(s.el, 'alt'), 'Crowd \u{1F600}');
    q(s.el, 'save').click(); await flush();
    expect(onSave).not.toHaveBeenCalled();
    expect(q(s.el, 'errors').textContent).toContain('emoji');
  });
  it('shows the message of a failed save and keeps the old state', async () => {
    const onSave = vi.fn(async () => { throw new Error('Someone else saved at the same moment.'); });
    const s = make({ onSave }); s.select(A);
    type(q(s.el, 'alt'), 'New alt');
    q(s.el, 'save').click(); await flush();
    expect(q(s.el, 'errors').hidden).toBe(false);
    expect(q(s.el, 'errors').textContent).toBe('Someone else saved at the same moment.');
    expect(s.map()).toEqual({});
    expect(qa(s.el, 'tile').find((t) => t.dataset.path === A).querySelector('[data-f="noalt-badge"]')).not.toBeNull();
  });
  it('a role that may not edit sees locked fields, no Save button, and save() does nothing', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ onSave, canEdit: false }); s.select(A);
    expect(q(s.el, 'save')).toBeNull();
    expect(q(s.el, 'readonly').textContent).toBe('Your role cannot change file details.');
    expect(q(s.el, 'alt').disabled).toBe(true);
    expect(q(s.el, 'caption').disabled).toBe(true);
    expect(q(s.el, 'credit').disabled).toBe(true);
    await s.save();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('wiring in the dashboard (app.js)', () => {
  const app = src('public/admin/js/app.js');
  it('has the route, the menu entry for the media right, and the stored path', () => {
    expect(app).toContain("if (hash === '#/files') return filesView();");
    expect(app).toContain("['#/files', 'Files', 'media']");
    expect(app).toContain("mediaMeta: joinPath(r, 'config/media.json')");
  });
  it('Save checks the role and the limits again, merges, and writes with the file sha', () => {
    const fn = app.slice(app.indexOf('async function filesView()'), app.indexOf('// ---------- authors ----------'));
    expect(fn).toContain("if (!can(S.role, 'media')) throw new Error('Your role cannot change file details.');");
    expect(fn).toContain('mediaErrors(fields)');
    expect(fn).toContain('mergeMedia(map, path, fields)');
    expect(fn).toMatch(/S\.gh\.put\(P\(\)\.mediaMeta, .*, sha\)/);
  });
  it('the screen module never writes HTML from a text', () => {
    expect(src('public/admin/js/files-screen.js')).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
  });
});
