// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { filesScreen } from '../../public/admin/js/files-screen.js';
// @ts-ignore plain JS
import { mergeMedia } from '../../public/admin/js/media-meta.js';

// Phase 3c Part 4b (v0.101.57): the review marker on the Files screen for automatic alt text.
const text = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const B = '/media/2026/11/IMG_1234.jpg';
const C = '/media/2026/10/senate-hearing.webp';
const FILES = [{ path: A, bytes: 120 * 1024 }, { path: B, bytes: 900 * 1024 }, { path: C, bytes: 80 * 1024 }];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const tile = (s: any, path: string) => qa(s.el, 'tile').find((t) => t.dataset.path === path);
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const flush = () => new Promise((r) => setTimeout(r, 0));
// Like app.js: the screen's onSave merges the fields into the stored map with mergeMedia.
const make = (map: any, o: any = {}) => {
  let stored = map;
  const onSave = vi.fn(async (path: string, fields: any) => { stored = mergeMedia(stored, path, fields); return stored; });
  const s = filesScreen({ files: FILES, map, items: [], sizes: {}, canEdit: true, onSave, ...o });
  return { s, onSave, stored: () => stored };
};
const MAP = () => ({
  [A]: { alt: 'City hall vote', autoAlt: true, sourceHost: 'example.com' },
  [B]: { alt: 'Written by the editor' },
});

beforeEach(() => { document.body.innerHTML = ''; });

describe('the marker in the grid', () => {
  it('shows nothing when no file waits for a review (the count line is the old one)', () => {
    const { s } = make({ [A]: { alt: 'x' } });
    expect(qa(s.el, 'review-badge')).toHaveLength(0);
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 2 without alt text');
  });
  it('marks only the file whose alt text was written automatically, and counts it', () => {
    const { s } = make(MAP());
    expect(tile(s, A).querySelector('[data-f="review-badge"]')).not.toBeNull();
    expect(tile(s, B).querySelector('[data-f="review-badge"]')).toBeNull();
    expect(tile(s, C).querySelector('[data-f="review-badge"]')).toBeNull();
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 1 without alt text, 1 to review');
  });
  it('does not mark a file with the flag but no alt text (it shows as without alt text)', () => {
    const { s } = make({ [A]: { autoAlt: true } });
    expect(qa(s.el, 'review-badge')).toHaveLength(0);
    expect(tile(s, A).querySelector('[data-f="noalt-badge"]')).not.toBeNull();
  });
  it('does not mark a flag that is not exactly true', () => {
    const { s } = make({ [A]: { alt: 'x', autoAlt: 'true' }, [B]: { alt: 'y', autoAlt: false } });
    expect(qa(s.el, 'review-badge')).toHaveLength(0);
  });
  it('the badge is plain text (no HTML from the file name or alt text)', () => {
    const { s } = make({ [A]: { alt: '<img src=x onerror=alert(1)>', autoAlt: true } });
    expect(tile(s, A).querySelector('img[onerror]')).toBeNull();
    expect(q(s.el, 'review-badge').textContent).toBe('alt text to review');
  });
});

describe('the note in the editor', () => {
  it('shows for a file that waits for a review, and not for the others', () => {
    const { s } = make(MAP());
    s.select(A);
    expect(q(s.el, 'review-note').textContent).toMatch(/written for you/);
    s.select(B);
    expect(q(s.el, 'review-note')).toBeNull();
  });
  it('does not show to a role that cannot edit (the badge in the grid still shows)', () => {
    const { s } = make(MAP(), { canEdit: false });
    s.select(A);
    expect(q(s.el, 'review-note')).toBeNull();
    expect(tile(s, A).querySelector('[data-f="review-badge"]')).not.toBeNull();
  });
});

describe('Save clears the mark', () => {
  it('a flagged file: onSave gets autoAlt null, the mark and the note go, the alt text stays', async () => {
    const { s, onSave, stored } = make(MAP());
    s.select(A);
    await s.save();
    expect(onSave).toHaveBeenCalledWith(A, { alt: 'City hall vote', caption: '', credit: '', autoAlt: null });
    expect('autoAlt' in stored()[A]).toBe(false);
    expect(stored()[A].alt).toBe('City hall vote');
    expect(stored()[A].sourceHost).toBe('example.com');
    expect(qa(s.el, 'review-badge')).toHaveLength(0);
    expect(q(s.el, 'review-note')).toBeNull();
    expect(q(s.el, 'count').textContent).toBe('3 of 3 files, 1 without alt text');
  });
  it('the writer corrects the alt text and saves: the new text is kept and the mark goes', async () => {
    const { s, stored } = make(MAP());
    s.select(A);
    type(q(s.el, 'alt'), 'Council members vote at city hall');
    await s.save();
    expect(stored()[A].alt).toBe('Council members vote at city hall');
    expect('autoAlt' in stored()[A]).toBe(false);
  });
  it('a file with no mark: onSave gets exactly the three fields as before', async () => {
    const { s, onSave } = make(MAP());
    s.select(B);
    await s.save();
    expect(onSave).toHaveBeenCalledWith(B, { alt: 'Written by the editor', caption: '', credit: '' });
    expect(Object.keys(onSave.mock.calls[0][1])).toEqual(['alt', 'caption', 'credit']);
  });
  it('a failed save keeps the mark and shows the sentence', async () => {
    const onSave = vi.fn(async () => { throw new Error('Could not save.'); });
    const s = filesScreen({ files: FILES, map: MAP(), items: [], sizes: {}, canEdit: true, onSave });
    s.select(A);
    await s.save(); await flush();
    expect(q(s.el, 'errors').textContent).toContain('Could not save.');
    expect(tile(s, A).querySelector('[data-f="review-badge"]')).not.toBeNull();
    expect(q(s.el, 'review-note')).not.toBeNull();
  });
  it('a red error (alt over the limit) stops Save and keeps the mark', async () => {
    const { s, onSave } = make(MAP());
    s.select(A);
    type(q(s.el, 'alt'), 'a'.repeat(301));
    await s.save();
    expect(onSave).not.toHaveBeenCalled();
    expect(tile(s, A).querySelector('[data-f="review-badge"]')).not.toBeNull();
  });
});

describe('the pieces that make it work', () => {
  it('app.js still merges the fields it gets straight into mergeMedia (a null key is dropped there)', () => {
    expect(text('public/admin/js/app.js')).toContain('const next = mergeMedia(map, path, fields);');
  });
  it('mergeMedia drops a null key and keeps the keys the screen does not own', () => {
    const out = mergeMedia({ [A]: { alt: 'x', autoAlt: true, sha256: 'h' } }, A, { alt: 'x', autoAlt: null });
    expect(out[A]).toEqual({ alt: 'x', sha256: 'h' });
  });
  it('admin.css styles both classes, with colour variables only', () => {
    const css = text('public/admin/admin.css');
    const at = css.indexOf('/* Review marker of automatic alt text');
    expect(at).toBeGreaterThan(0);
    const block = css.slice(at);
    expect(block).toContain('.tile .review-badge{');
    expect(block).toContain('.review-note{');
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  it('the text of the badge (on the tile colour) and of the note (on the card colour) keeps 4.5:1, light and dark', () => {
    const css = text('public/admin/admin.css');
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const full = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
    const lum = (h: string) => { const n = parseInt(full(h).slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const vars = (line: string) => Object.fromEntries([...line.matchAll(/--([a-z]+):(#[0-9a-f]{3}(?:[0-9a-f]{3})?)(?![0-9a-f])/gi)].map((m) => [m[1], m[2]]));
    const [l0, l1] = css.split('\n');
    const light = vars(l0); const dark = { ...light, ...vars(l1) };
    expect(css.match(/\.tile \.review-badge\{[^}]*color:var\(--ink\)/)).not.toBeNull();
    expect(css.match(/\.review-note\{[^}]*background:var\(--card\)[^}]*color:var\(--ink\)/)).not.toBeNull();
    for (const [mode, v] of [['light', light], ['dark', dark]] as const) {
      expect(ratio(v.ink, v.bg), `${mode} ink on bg`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v.ink, v.card), `${mode} ink on card`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
