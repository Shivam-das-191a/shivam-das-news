import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { planReplace, mapWithoutVariants } from '../../public/admin/js/file-replace.js';

// Phase 3c Part 4c-4d (v0.101.64): the commit list of a replace, and the media note.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const A480 = '/media/2026/11/city-hall-vote.480w.webp';
const A800 = '/media/2026/11/city-hall-vote.800w.webp';
const B = '/media/2026/10/senate-hearing.webp';
const B480 = '/media/2026/10/senate-hearing.480w.webp';
const BYTES = new Uint8Array([1, 2, 3]);
const o = (x: any = {}) => ({ sitePaths: [A, A480, A800, B, B480], pub: 'site/public', ...x });

describe('planReplace', () => {
  it('the new bytes first at the same repository path, then each copy as a delete, narrowest first', () => {
    const p = planReplace(A, BYTES, o());
    expect(p.copies).toEqual([A480, A800]);
    expect(p.entries).toEqual([{ path: 'site/public' + A, bytes: BYTES }, { path: 'site/public' + A480, delete: true }, { path: 'site/public' + A800, delete: true }]);
  });
  it('a picture without copies: only the new bytes', () => {
    const p = planReplace(B, BYTES, o({ sitePaths: [A, B] }));
    expect(p.copies).toEqual([]);
    expect(p.entries).toEqual([{ path: 'site/public' + B, bytes: BYTES }]);
  });
  it('a copy of another picture is never listed', () => {
    expect(JSON.stringify(planReplace(A, BYTES, o()).entries)).not.toContain('senate');
  });
  it('a copy that does not exist now is never invented', () => {
    expect(planReplace(A, BYTES, o({ sitePaths: [A, A800] })).copies).toEqual([A800]);
  });
  it('a JPEG and a GIF have no copies', () => {
    const J = '/media/2026/11/photo.jpg';
    expect(planReplace(J, BYTES, o({ sitePaths: [J, '/media/2026/11/photo.480w.webp'] })).copies).toEqual([]);
  });
  it('throws a plain sentence for a path that is not a picture or is already gone', () => {
    expect(() => planReplace('/icon.png', BYTES, o())).toThrow('is not a file under /media/');
    expect(() => planReplace('/media/2026/11/gone.webp', BYTES, o())).toThrow('That file is already gone. Refresh the page.');
  });
  it('the prefix may be empty', () => {
    expect(planReplace(A, BYTES, o({ pub: undefined })).entries[0].path).toBe(A);
  });
  it('does not change its input', () => {
    const x = o(); const before = JSON.stringify(x);
    planReplace(A, BYTES, x);
    expect(JSON.stringify(x)).toBe(before);
  });
});

describe('mapWithoutVariants', () => {
  it('drops the variants note and keeps the rest of the entry', () => {
    const m = { [A]: { alt: 'Hall', variants: [480, 800] }, [B]: { alt: 'Hearing', variants: [480] } };
    const r = mapWithoutVariants(m, A);
    expect(r).toEqual({ map: { [A]: { alt: 'Hall' }, [B]: { alt: 'Hearing', variants: [480] } }, changed: true });
    expect(m[A]).toEqual({ alt: 'Hall', variants: [480, 800] }); // the input is not changed
  });
  it('an entry that held only the note goes too', () => {
    expect(mapWithoutVariants({ [A]: { variants: [480] } }, A)).toEqual({ map: {}, changed: true });
  });
  it('no entry or no note: nothing changes', () => {
    expect(mapWithoutVariants({ [A]: { alt: 'x' } }, A).changed).toBe(false);
    expect(mapWithoutVariants({}, A).changed).toBe(false);
    expect(mapWithoutVariants(null, A)).toEqual({ map: {}, changed: false });
    expect(mapWithoutVariants([] as any, A).changed).toBe(false);
  });
  it('the key order of the other entries stays', () => {
    const r = mapWithoutVariants({ [B]: { alt: 'b' }, [A]: { alt: 'a', variants: [480] } }, A);
    expect(Object.keys(r.map)).toEqual([B, A]);
  });
});

describe('file-replace.js source', () => {
  const s = src('public/admin/js/file-replace.js');
  it('is plain: no storage, no network, no clock, no markup writing', () => {
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'fetch(', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.', 'Date.now', 'Math.random']) expect(s).not.toContain(w);
  });
  it('imports only media-meta.js and hosting-srcset.js and never names makeVariants', () => {
    expect([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort()).toEqual(['./hosting-srcset.js', './media-meta.js']);
    expect(s).not.toContain('makeVariants');
  });
});
