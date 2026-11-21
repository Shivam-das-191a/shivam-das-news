import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pictureSet, withPictureSets, copyPath, COPY_WIDTHS, SIZES } from '../../src/lib/picture-set';
import { SRCSET_WIDTHS } from '../../public/admin/js/hosted-meta.js';
import { srcsetValue } from '../../public/admin/js/hosting-srcset.js';

const P = '/media/2026/11/city-hall-vote.webp';
const row = (o: Record<string, unknown> = {}) => ({ [P]: { width: 1600, height: 900, variants: [480, 800, 1200], ...o } });

describe('pictureSet', () => {
  it('builds the srcset: the copies narrowest first, then the main file with its true width', () => {
    const s = pictureSet(row(), P, SIZES.article)!;
    expect(s.srcset).toBe(`${copyPath(P, 480)} 480w, ${copyPath(P, 800)} 800w, ${copyPath(P, 1200)} 1200w, ${P} 1600w`);
    expect(s.sizes).toBe(SIZES.article);
  });
  it('gives the same text as the dashboard rule (srcsetValue) for the same picture', () => {
    for (const width of [500, 900, 1300, 1600, 2400]) {
      const variants = SRCSET_WIDTHS.filter((w: number) => w < width);
      const mine = pictureSet(row({ width, variants }), P, 'x');
      expect(mine ? mine.srcset : '').toBe(srcsetValue(P, { width, height: 900 }));
    }
  });
  it('keeps COPY_WIDTHS equal to the dashboard SRCSET_WIDTHS', () => {
    expect([...COPY_WIDTHS]).toEqual([...SRCSET_WIDTHS]);
  });
  it('returns null with no variants note, an empty note, or a note that is not a list', () => {
    expect(pictureSet({ [P]: { width: 1600 } }, P, 'x')).toBeNull();
    expect(pictureSet(row({ variants: [] }), P, 'x')).toBeNull();
    for (const v of ['480', 480, null, {}, true]) expect(pictureSet(row({ variants: v }), P, 'x')).toBeNull();
  });
  it('returns null when the main width is not a whole number above 0 (nothing is invented)', () => {
    for (const w of [undefined, 0, -5, 1600.5, '1600', null, NaN]) expect(pictureSet(row({ width: w }), P, 'x')).toBeNull();
  });
  it('uses only a note width that is a real copy width and narrower than the main file', () => {
    expect(pictureSet(row({ width: 900, variants: [480, 800, 1200, 999] }), P, 'x')!.srcset).toBe(`${copyPath(P, 480)} 480w, ${copyPath(P, 800)} 800w, ${P} 900w`);
    expect(pictureSet(row({ width: 480, variants: [480] }), P, 'x')).toBeNull();
  });
  it('lists a copy only when its file exists', () => {
    const has = new Set([copyPath(P, 480), copyPath(P, 1200)]);
    const s = pictureSet(row(), P, 'x', (p) => has.has(p))!;
    expect(s.srcset).toBe(`${copyPath(P, 480)} 480w, ${copyPath(P, 1200)} 1200w, ${P} 1600w`);
    expect(pictureSet(row(), P, 'x', () => false)).toBeNull();
  });
  it('returns null for a picture that is not a hosted main .webp', () => {
    const copy = copyPath(P, 480);
    for (const src of [undefined, '', 'https://cdn.test' + P, '/og-default.png', `${P}?v=2`, `${P}#a`, '/media/a.png', copy, '/media/../a.webp'])
      expect(pictureSet({ ...row(), [copy]: { width: 1600, variants: [480] } }, src as any, 'x')).toBeNull();
  });
  it('is safe with an empty, missing or odd map and does not read inherited keys', () => {
    for (const m of [{}, undefined, null, [], 'x', 3, { [P]: 'text' }, { [P]: null }]) expect(pictureSet(m, P, 'x')).toBeNull();
    expect(pictureSet(Object.create(row()), P, 'x')).toBeNull();
  });
});

describe('the pages use it (source guards)', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
  it('the three pictures get srcset and sizes from setOf', () => {
    for (const [f, sz] of [['src/components/PostCard.astro', 'SIZES.card'], ['src/pages/index.astro', 'SIZES.lead'], ['src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'SIZES.article']]) {
      const t = read(f);
      expect(t).toContain('setOf(');
      expect(t).toContain(sz);
      expect(t).toMatch(/srcset=\{\w+\?\.srcset\}\s+sizes=\{\w+\?\.sizes\}/);
    }
  });
  it('width, height and the plain src stay on every picture', () => {
    for (const f of ['src/components/PostCard.astro', 'src/pages/index.astro', 'src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro'])
      expect(read(f)).toMatch(/<img class="thumb" src=\{[^}]+\}[^>]*width="1200" height="675"/);
  });
  it('picture.ts checks that a copy file exists before it is named', () => {
    expect(read('src/lib/picture.ts')).toMatch(/existsSync\(path\.join\(process\.cwd\(\), 'public'/);
  });
});

describe('withPictureSets (pictures inside the article text)', () => {
  const map = row();
  const set = pictureSet(map, P, SIZES.body)!;
  const add = ` srcset="${set.srcset}" sizes="${set.sizes}"`;
  it('adds srcset and sizes right after src and keeps every other attribute', () => {
    const html = `<p>a</p><img src="${P}" alt="City hall" loading="lazy"><p>b</p>`;
    expect(withPictureSets(html, map, SIZES.body)).toBe(`<p>a</p><img src="${P}"${add} alt="City hall" loading="lazy"><p>b</p>`);
  });
  it('works for a self-closing tag, single quotes, upper case and several pictures', () => {
    const html = `<IMG alt="x" src='${P}' /><img src="${P}"/>`;
    const out = withPictureSets(html, map, SIZES.body);
    expect(out.match(/srcset=/g)).toHaveLength(2);
    expect(out).toContain(`src='${P}'${add}`);
  });
  it('leaves a tag that already has srcset or sizes, an unknown picture, an outside picture and a tag with no src as they are', () => {
    const same = [`<img src="${P}" srcset="a 1w">`, `<img src="${P}" sizes="100vw">`, '<img src="/media/2026/11/other.webp">', '<img src="https://cdn.test/a.webp">', '<img alt="x">', '<p>no picture</p>'];
    for (const h of same) expect(withPictureSets(h, map, SIZES.body)).toBe(h);
  });
  it('never touches text that only shows a tag (escaped) and gives the same text back for an empty map', () => {
    const shown = `<pre>&lt;img src="${P}"&gt;</pre>`;
    expect(withPictureSets(shown, map, SIZES.body)).toBe(shown);
    const html = `<img src="${P}">`;
    expect(withPictureSets(html, {}, SIZES.body)).toBe(html);
  });
  it('names a copy only when its file exists', () => {
    const out = withPictureSets(`<img src="${P}">`, map, 'x', (p) => p === copyPath(P, 480));
    expect(out).toContain(`${copyPath(P, 480)} 480w, ${P} 1600w`);
    expect(out).not.toContain('800w');
  });
  it('is safe with empty or odd html', () => {
    for (const h of ['', undefined, null]) expect(withPictureSets(h as any, map, 'x')).toBe('');
  });
  it('the article page uses bodySets on the text and keeps the fallback', () => {
    const t = fs.readFileSync(path.join(__dirname, '../../src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro'), 'utf8');
    expect(t).toContain('plan.html ? bodySets(plan.html) : plan.html');
    expect(t).toContain('<Content />');
  });
});
