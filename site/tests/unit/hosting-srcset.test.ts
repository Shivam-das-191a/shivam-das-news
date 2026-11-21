import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
// @ts-ignore plain JS
import { parseVariant, canHaveVariants, variantPath, variantWidths, variantsFor, srcsetValue, variantsOnList, isVariantOf, withoutVariants } from '../../public/admin/js/hosting-srcset.js';
// @ts-ignore plain JS
import { SRCSET_WIDTHS, imgAttributes } from '../../public/admin/js/hosted-meta.js';
// @ts-ignore plain JS
import { seoName } from '../../public/admin/js/hotlink.js';
// @ts-ignore plain JS
import { checkNewName } from '../../public/admin/js/file-rename.js';

// Phase 3c Part 4c-1 (v0.101.58): the pure rules of the smaller copies (srcset). Nothing calls them yet.
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const P = '/media/2026/11/city-hall-vote.webp';
const at = (w: number) => `/media/2026/11/city-hall-vote.${w}w.webp`;

describe('parseVariant', () => {
  it('reads the base and the width of a copy', () => {
    expect(parseVariant(at(480))).toEqual({ base: P, width: 480 });
    expect(parseVariant(at(1600))).toEqual({ base: P, width: 1600 });
  });
  it('is null for a main picture and for every name that is not a copy', () => {
    for (const p of [P, '/media/2026/11/a.500w.webp', '/media/2026/11/a.480w.jpg', '/media/2026/11/a.480w.WEBP', '/media/2026/11/a-480w.webp', '/media/2026/11/a.480.webp', '/media/2026/11/a.0480w.webp', '/media/2026/11/a.480w.webp?x=1', '/other/a.480w.webp', '', null, undefined, 480]) {
      expect(parseVariant(p as any), String(p)).toBeNull();
    }
  });
  it('does not throw for a strange name', () => {
    expect(() => parseVariant('/media/.480w.webp')).not.toThrow();
    expect(() => parseVariant({} as any)).not.toThrow();
  });
});

describe('canHaveVariants', () => {
  it('is true for a .webp in /media/', () => expect(canHaveVariants(P)).toBe(true));
  it('is false for a GIF, JPEG, PNG, a copy, another folder and a path with ..', () => {
    for (const p of ['/media/a/b.gif', '/media/a/b.jpg', '/media/a/b.png', '/media/a/b.WEBP', at(480), '/images/a.webp', '/media/../a.webp', '', null]) expect(canHaveVariants(p as any), String(p)).toBe(false);
  });
});

describe('variantPath', () => {
  it('puts a dot and the width before the ending', () => {
    expect(variantPath(P, 480)).toBe(at(480));
    expect(variantPath(P, 1200)).toBe(at(1200));
  });
  it('refuses a width that is not in the list, with a plain message', () => {
    expect(() => variantPath(P, 500)).toThrow('480, 800, 1200, 1600');
    expect(() => variantPath(P, '480' as any)).toThrow();
  });
  it('refuses a file that cannot have copies', () => {
    expect(() => variantPath('/media/a/b.gif', 480)).toThrow('Only a .webp');
    expect(() => variantPath(at(480), 800)).toThrow('Only a .webp');
  });
  it('is the opposite of parseVariant for every width', () => {
    for (const w of SRCSET_WIDTHS) expect(parseVariant(variantPath(P, w))).toEqual({ base: P, width: w });
  });
});

describe('variantWidths', () => {
  it('uses only widths STRICTLY narrower than the picture', () => {
    const cases: [number, number[]][] = [[300, []], [480, []], [481, [480]], [800, [480]], [801, [480, 800]], [1200, [480, 800]], [1600, [480, 800, 1200]], [1601, [480, 800, 1200, 1600]], [2400, [480, 800, 1200, 1600]]];
    for (const [width, want] of cases) expect(variantWidths({ width }), String(width)).toEqual(want);
  });
  it('throws a plain message when the width is not known', () => {
    for (const bad of [undefined, {}, { width: 0 }, { width: -5 }, { width: 1.5 }, { width: '800' }]) expect(() => variantWidths(bad as any)).toThrow('not known');
  });
  it('matches imgAttributes except for a width that equals the picture', () => {
    for (const width of [300, 480, 481, 800, 1200, 1600, 2400]) {
      const info = { width, height: 900 };
      expect(variantWidths(info)).toEqual(imgAttributes(info, 1).srcsetWidths.filter((w: number) => w !== width));
    }
  });
});

describe('variantsFor', () => {
  it('plans the copies narrowest first with the height scaled and rounded', () => {
    expect(variantsFor(P, { width: 2400, height: 1350 })).toEqual([
      { width: 480, height: 270, path: at(480) },
      { width: 800, height: 450, path: at(800) },
      { width: 1200, height: 675, path: at(1200) },
      { width: 1600, height: 900, path: at(1600) },
    ]);
    expect(variantsFor(P, { width: 1000, height: 667 }).map((v: any) => v.height)).toEqual([320, 534]); // 320.2 and 533.6
  });
  it('a very flat picture never gets a height below 1', () => {
    expect(variantsFor(P, { width: 4000, height: 1 }).map((v: any) => v.height)).toEqual([1, 1, 1, 1]);
  });
  it('a narrow picture, a GIF, a JPEG and a copy give an empty list', () => {
    expect(variantsFor(P, { width: 480, height: 300 })).toEqual([]);
    expect(variantsFor('/media/a/b.gif', { width: 2000, height: 1000 })).toEqual([]);
    expect(variantsFor('/media/a/b.jpg', { width: 2000, height: 1000 })).toEqual([]);
    expect(variantsFor(at(480), { width: 2000, height: 1000 })).toEqual([]);
  });
  it('a file that cannot have copies does not need a known size', () => {
    expect(variantsFor('/media/a/b.gif', {})).toEqual([]);
  });
  it('throws a plain message when the size is not known', () => {
    expect(() => variantsFor(P, { height: 900 })).toThrow('width is not known');
    expect(() => variantsFor(P, { width: 2000 })).toThrow('height is not known');
  });
});

describe('srcsetValue', () => {
  it('lists the copies and ends with the main file at its true width', () => {
    expect(srcsetValue(P, { width: 2400, height: 1350 })).toBe(`${at(480)} 480w, ${at(800)} 800w, ${at(1200)} 1200w, ${at(1600)} 1600w, ${P} 2400w`);
  });
  it('does not make a copy as wide as the picture: the main file is that size', () => {
    expect(srcsetValue(P, { width: 1200, height: 800 })).toBe(`${at(480)} 480w, ${at(800)} 800w, ${P} 1200w`);
  });
  it('is empty when there is no copy to offer', () => {
    expect(srcsetValue(P, { width: 480, height: 300 })).toBe('');
    expect(srcsetValue('/media/a/b.gif', { width: 3000, height: 2000 })).toBe('');
  });
  it('never lists a width twice and every address is under /media/', () => {
    const v = srcsetValue(P, { width: 3000, height: 2000 });
    const widths = [...v.matchAll(/ (\d+)w/g)].map((m: any) => m[1]);
    expect(new Set(widths).size).toBe(widths.length);
    for (const part of v.split(', ')) expect(part.startsWith('/media/')).toBe(true);
  });
});

describe('lists of paths', () => {
  const LIST = [P, at(480), at(800), '/media/2026/11/other.webp', '/media/2026/11/other.480w.webp', '/media/2026/11/orphan.480w.webp', '/media/2026/10/photo.gif'];
  it('variantsOnList finds the copies that exist, narrowest first', () => {
    expect(variantsOnList(P, LIST)).toEqual([at(480), at(800)]);
    expect(variantsOnList(P, [P])).toEqual([]);
    expect(variantsOnList('/media/2026/10/photo.gif', LIST)).toEqual([]);
    expect(variantsOnList(at(480), LIST)).toEqual([]);
    expect(variantsOnList(P, undefined as any)).toEqual([]);
  });
  it('isVariantOf needs the main picture in the list', () => {
    expect(isVariantOf(at(480), LIST)).toBe(true);
    expect(isVariantOf('/media/2026/11/orphan.480w.webp', LIST)).toBe(false);
    expect(isVariantOf(P, LIST)).toBe(false);
  });
  it('withoutVariants hides the copies, keeps the order and the orphan, and does not change the input', () => {
    const copy = [...LIST];
    expect(withoutVariants(LIST)).toEqual([P, '/media/2026/11/other.webp', '/media/2026/11/orphan.480w.webp', '/media/2026/10/photo.gif']);
    expect(LIST).toEqual(copy);
    expect(withoutVariants(undefined as any)).toEqual([]);
  });
});

describe('a main picture can never be taken for a copy', () => {
  it('seoName makes only a-z, 0-9 and hyphens, so no name holds a dot', () => {
    const texts = ['photo 480w', '800w banner image of the city', 'city.480w', 'A.1200w.B', '1600w 480w 800w'];
    for (const t of texts) {
      const { name } = seoName({ alt: t }, { title: 'Delhi hosts the big phone launch', handle: 'phone-launch' }, 1);
      expect(name, t).toMatch(/^[a-z0-9-]+$/);
      expect(parseVariant(`/media/2026/11/${name}.webp`), t).toBeNull();
    }
  });
  it('the rename check refuses a typed name with a dot', () => {
    for (const t of ['city.480w', 'a.800w.webp.webp', 'x.1200w']) {
      const r = checkNewName(P, t, []);
      expect(r.ok, t).toBe(false);
      expect(r.newPath, t).toBe('');
    }
  });
});

describe('hosting-srcset.js source', () => {
  const s = src('public/admin/js/hosting-srcset.js');
  it('does not fetch, store, eval or touch the page', () => {
    expect(s).not.toMatch(/\bfetch\(/);
    for (const w of ['localStorage', 'sessionStorage', 'document.', 'window.', 'eval(', 'new Function', 'innerHTML', 'XMLHttpRequest', 'console.', 'Date.now', 'Math.random']) expect(s).not.toContain(w);
  });
  it('imports only hosted-meta.js and media-meta.js', () => {
    expect([...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort()).toEqual(['./hosted-meta.js', './media-meta.js']);
  });
  it('is imported only by hosting-optimize.js (4c-2), hosting-copies.js (4c-3) and files-screen.js (4c-4a, which hides copies and locks a picture that has copies) and file-delete.js (4c-4b, which lists the copies of a picture to delete) and file-rename.js (4c-4c, which moves the copies of a picture to the new name), and file-replace.js (4c-4d, which lists the copies of a picture to remove), so nothing changes for the reader', () => {
    for (const f of readdirSync(new URL('../../public/admin/js/', import.meta.url))) {
      if (f === 'hosting-srcset.js' || f === 'hosting-optimize.js' || f === 'hosting-copies.js' || f === 'files-screen.js' || f === 'file-delete.js' || f === 'file-rename.js' || f === 'file-replace.js') continue;
      expect(src('public/admin/js/' + f), f).not.toContain('hosting-srcset');
    }
    expect(src('public/admin/admin.css')).not.toContain('hosting-srcset');
  });
  it('has no emoji', () => {
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
