// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { bulkAltScreen } from '../../public/admin/js/bulk-alt.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const B = '/media/2026/11/IMG_1234.jpg';
const C = '/media/2026/10/senate-hearing.webp';
const FILES = [{ path: A, bytes: 1 }, { path: B, bytes: 1 }, { path: C, bytes: 1 }];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const field = (s: any, path: string) => qa(s.el, 'alt').find((i) => i.dataset.path === path);
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const make = (o: any = {}) => bulkAltScreen({ files: FILES, map: {}, canEdit: true, onSave: async (rows: any[]) => Object.fromEntries(rows.map((r) => [r.path, { alt: r.alt }])), ...o });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { document.body.innerHTML = ''; });

describe('the table', () => {
  it('lists only the files without alt text and counts them', () => {
    const s = make({ map: { [A]: { alt: 'Council votes' } } });
    expect(qa(s.el, 'row').map((r) => r.dataset.path)).toEqual([B, C]);
    expect(q(s.el, 'count').textContent).toBe('2 files without alt text');
  });
  it('says "1 file" for one file', () => {
    expect(q(make({ map: { [A]: { alt: 'x' }, [B]: { alt: 'y' } } }).el, 'count').textContent).toBe('1 file without alt text');
  });
  it('says so when every file has alt text', () => {
    const s = make({ map: { [A]: { alt: 'x' }, [B]: { alt: 'y' }, [C]: { alt: 'z' } } });
    expect(q(s.el, 'done').textContent).toBe('All files have alt text.');
    expect(q(s.el, 'save')).toBeNull();
  });
  it('says so when there are no files at all', () => {
    expect(q(make({ files: [] }).el, 'done').textContent).toContain('No images yet');
  });
  it('a file name is shown as text, never as HTML', () => {
    const s = make({ files: [{ path: '/media/a<b>bold.webp', bytes: 1 }] });
    expect(s.el.querySelector('b')).toBeNull();
    expect(s.el.textContent).toContain('a<b>bold.webp');
  });
  it('the counter follows every keystroke and a red line shows for a too long alt text', () => {
    const s = make();
    type(field(s, A), 'Council members vote');
    expect(qa(s.el, 'alt-count')[0].textContent).toBe('20 characters (up to 125 recommended)');
    type(field(s, A), 'a'.repeat(301));
    expect(q(s.el, 'row-error').hidden).toBe(false);
    type(field(s, A), 'short');
    expect(q(s.el, 'row-error').hidden).toBe(true);
  });
});

describe('saving', () => {
  it('sends only the filled rows, in one call, then shows what is left', async () => {
    const onSave = vi.fn(async (rows: any[]) => Object.fromEntries(rows.map((r) => [r.path, { alt: r.alt }])));
    const s = make({ onSave });
    type(field(s, A), '  Council   members vote ');
    type(field(s, C), 'The Senate hearing room');
    q(s.el, 'save').click(); await flush();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([{ path: A, alt: 'Council members vote' }, { path: C, alt: 'The Senate hearing room' }]);
    expect(qa(s.el, 'row').map((r) => r.dataset.path)).toEqual([B]);
    expect(q(s.el, 'status').textContent).toBe('Saved 2 files.');
    expect(q(s.el, 'count').textContent).toBe('1 file without alt text');
  });
  it('says "Saved 1 file." for one file', async () => {
    const s = make(); type(field(s, B), 'A phone photo of the stage'); q(s.el, 'save').click(); await flush();
    expect(q(s.el, 'status').textContent).toBe('Saved 1 file.');
  });
  it('does not call onSave when nothing is typed', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ onSave }); q(s.el, 'save').click(); await flush();
    expect(onSave).not.toHaveBeenCalled();
    expect(q(s.el, 'status').textContent).toBe('Type an alt text for at least one file.');
  });
  it('saves nothing while one row has a red error, and marks that row', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ onSave });
    type(field(s, A), 'Good alt text'); type(field(s, B), 'a'.repeat(301));
    q(s.el, 'save').click(); await flush();
    expect(onSave).not.toHaveBeenCalled();
    expect(q(s.el, 'status').textContent).toBe('Nothing was saved. Fix the red lines and try again.');
    expect(qa(s.el, 'row-error').find((e) => e.dataset.path === B).hidden).toBe(false);
    expect(qa(s.el, 'row-error').find((e) => e.dataset.path === A).hidden).toBe(true);
  });
  it('a failed save shows the message, keeps what was typed and changes nothing', async () => {
    const s = make({ onSave: async () => { throw new Error('The file changed. Reload and try again.'); } });
    type(field(s, A), 'Council members vote');
    q(s.el, 'save').click(); await flush();
    expect(q(s.el, 'errors').textContent).toContain('The file changed. Reload and try again.');
    expect(q(s.el, 'errors').hidden).toBe(false);
    expect(field(s, A).value).toBe('Council members vote');
    expect(s.map()).toEqual({});
  });
  it('a read-only role sees locked fields, no Save button and never calls onSave', async () => {
    const onSave = vi.fn(async () => ({}));
    const s = make({ canEdit: false, onSave });
    expect(qa(s.el, 'alt').every((i) => i.disabled)).toBe(true);
    expect(q(s.el, 'save')).toBeNull();
    expect(q(s.el, 'readonly').textContent).toBe('Your role cannot change file details.');
    field(s, A).value = 'Typed by a script';
    await s.save();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('wiring in the dashboard (app.js)', () => {
  const app = src('public/admin/js/app.js');
  it('has the route and a link from the Files screen', () => {
    expect(app).toContain("if (hash === '#/files/alt') return bulkAltView();");
    expect(app).toContain("href: '#/files/alt'");
  });
  it('Save checks the role and the limits again, merges all rows, and writes once with the file sha', () => {
    const fn = app.slice(app.indexOf('async function bulkAltView()'), app.indexOf('// ---------- files (v0.101.28'));
    expect(fn).toContain("if (!can(S.role, 'media')) throw new Error('Your role cannot change file details.');");
    expect(fn).toContain('mergeAltBulk(map, rows)');
    expect(fn).toMatch(/S\.gh\.put\(P\(\)\.mediaMeta, .*, sha\)/);
    expect((fn.match(/S\.gh\.put\(/g) || []).length).toBe(1);
  });
  it('the screen module never writes HTML from a text', () => {
    expect(src('public/admin/js/bulk-alt.js')).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
  });
});
