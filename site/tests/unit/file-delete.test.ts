import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { planDelete, mapWithout } from '../../public/admin/js/file-delete.js';

// Phase 3c Part 4c-4b (v0.101.62): the delete plan of a picture and its smaller copies.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const A = '/media/2026/11/city-hall-vote.webp';
const A480 = '/media/2026/11/city-hall-vote.480w.webp';
const A800 = '/media/2026/11/city-hall-vote.800w.webp';
const A1200 = '/media/2026/11/city-hall-vote.1200w.webp';
const B = '/media/2026/10/senate-hearing.webp';
const B480 = '/media/2026/10/senate-hearing.480w.webp';
const J = '/media/2026/11/IMG_1234.jpg';
const ALL = [A, A480, A800, B, B480, J];
const PUB = 'site/public';

describe('planDelete', () => {
  it('lists the picture first and then its copies, narrowest first, with the repository prefix', () => {
    const r = planDelete(A, { sitePaths: ALL, pub: PUB });
    expect(r.copies).toEqual([A480, A800]);
    expect(r.deletes).toEqual([
      { path: PUB + A, delete: true }, { path: PUB + A480, delete: true }, { path: PUB + A800, delete: true },
    ]);
  });
  it('the order does not depend on the order of the list', () => {
    const r = planDelete(A, { sitePaths: [A800, J, A480, A], pub: PUB });
    expect(r.copies).toEqual([A480, A800]);
  });
  it('a picture without copies gives only itself', () => {
    const r = planDelete(J, { sitePaths: ALL, pub: PUB });
    expect(r.copies).toEqual([]);
    expect(r.deletes).toEqual([{ path: PUB + J, delete: true }]);
  });
  it('never takes the copies of another picture', () => {
    const r = planDelete(B, { sitePaths: ALL, pub: PUB });
    expect(r.copies).toEqual([B480]);
    expect(r.deletes.map((d: any) => d.path)).not.toContain(PUB + A480);
  });
  it('only deletes a copy that exists now (a width that is not in the list is not invented)', () => {
    const r = planDelete(A, { sitePaths: [A, A1200], pub: PUB });
    expect(r.copies).toEqual([A1200]);
  });
  it('a stray file that only looks similar is not a copy', () => {
    const r = planDelete(A, { sitePaths: [A, '/media/2026/11/city-hall-vote.480w.webp.bak', '/media/2026/11/city-hall-vote.479w.webp', '/media/2026/11/city-hall-vote.0480w.webp'], pub: PUB });
    expect(r.copies).toEqual([]);
  });
  it('a picture that is already gone throws the plain sentence', () => {
    expect(() => planDelete(A, { sitePaths: [B], pub: PUB })).toThrow('That file is already gone. Refresh the page.');
    expect(() => planDelete(A, { pub: PUB })).toThrow('already gone');
  });
  it('a path that is not a picture under /media/ throws', () => {
    for (const p of ['/icon-512.png', '/media/../config/site.json', '/media/a.webp?x=1', '', undefined]) {
      expect(() => planDelete(p as any, { sitePaths: [p as any], pub: PUB }), String(p)).toThrow('is not a file under /media/');
    }
  });
  it('a copy as the path deletes only itself (it has no copies)', () => {
    const r = planDelete(A480, { sitePaths: ALL, pub: PUB });
    expect(r.copies).toEqual([]);
    expect(r.deletes).toEqual([{ path: PUB + A480, delete: true }]);
  });
  it('an empty prefix gives the plain site path', () => {
    expect(planDelete(J, { sitePaths: ALL }).deletes[0].path).toBe(J);
  });
  it('does not change its input', () => {
    const list = ALL.slice();
    planDelete(A, { sitePaths: list, pub: PUB });
    expect(list).toEqual(ALL);
  });
});

describe('mapWithout', () => {
  const MAP = () => ({ [A]: { alt: 'x', variants: [480, 800] }, [B]: { alt: 'y' }, [A480]: { alt: 'stray' } });
  it('removes the entries of the paths and says it changed', () => {
    const r = mapWithout(MAP(), [A, A480]);
    expect(r.map).toEqual({ [B]: { alt: 'y' } });
    expect(r.changed).toBe(true);
  });
  it('says nothing changed when no entry is named', () => {
    const r = mapWithout(MAP(), [J, A800]);
    expect(r.changed).toBe(false);
    expect(r.map).toEqual(MAP());
  });
  it('does not change the input and keeps the order of the others', () => {
    const m = MAP();
    const r = mapWithout(m, [A]);
    expect(Object.keys(m)).toEqual([A, B, A480]);
    expect(Object.keys(r.map)).toEqual([B, A480]);
  });
  it('a map that is not an object gives an empty map', () => {
    for (const bad of [null, undefined, [], 'x', 5]) expect(mapWithout(bad as any, [A])).toEqual({ map: {}, changed: false });
  });
  it('a paths value that is not a list changes nothing', () => {
    expect(mapWithout(MAP(), undefined as any).changed).toBe(false);
  });
  it('a key such as "constructor" is not treated as an entry', () => {
    expect(mapWithout({}, ['constructor', '__proto__']).changed).toBe(false);
  });
});

describe('the source and the wiring', () => {
  const s = src('public/admin/js/file-delete.js');
  it('imports only media-meta.js and hosting-srcset.js', () => {
    expect([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort()).toEqual(['./hosting-srcset.js', './media-meta.js']);
  });
  it('is pure: no network, storage, clock or HTML', () => {
    expect(s).not.toMatch(/fetch\(|localStorage|sessionStorage|Date\.now|new Date|innerHTML|document\./);
  });
  it('is imported only by app.js', () => {
    for (const f of readdirSync(new URL('../../public/admin/js/', import.meta.url))) {
      if (f === 'file-delete.js' || f === 'app.js') continue;
      expect(src('public/admin/js/' + f), f).not.toContain("from './file-delete.js'");
    }
    expect(src('public/admin/js/app.js')).toContain("from './file-delete.js'");
  });
  it('app.js puts the picture, its copies and the media entries in ONE commit and names the copies in the message', () => {
    const app = src('public/admin/js/app.js');
    const a = app.indexOf('onDelete: async (path)');
    const body = app.slice(a, app.indexOf('return next;', a));
    expect((body.match(/commitFiles\(/g) || []).length).toBe(1);
    expect(body).toContain('...plan.deletes');
    expect(body).toContain('mapWithout(next, [path, ...plan.copies])');
    expect(body).toMatch(/smaller \$\{n === 1 \? 'copy' : 'copies'\}/);
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
