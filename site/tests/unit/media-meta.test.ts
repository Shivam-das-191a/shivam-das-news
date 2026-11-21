import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error plain browser module
import { ALT_WARN, ALT_STOP, CAPTION_STOP, CREDIT_STOP, isMediaPath, mediaErrors, mergeMedia, altFor, featuredIn, readableName, imageChecks, usedIn, missingAlt, mergeAltBulk } from '../../public/admin/js/media-meta.js';
// @ts-expect-error plain script module
import { checkMedia } from '../../scripts/validate-content-lib.mjs';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const P = '/media/2026/11/city-hall-vote.webp';

describe('isMediaPath', () => {
  it('accepts a picture under /media/', () => {
    expect(isMediaPath(P)).toBe(true);
    expect(isMediaPath('/media/a.JPG')).toBe(true);
  });
  it('refuses other places, "..", queries, spaces and other file types', () => {
    for (const bad of ['/og-default.png', 'media/a.webp', '/media/../x.webp', '/media/a.webp?x=1', '/media/a b.webp', '/media/a.pdf', '', undefined, null])
      expect(isMediaPath(bad as any)).toBe(false);
  });
});

describe('mediaErrors', () => {
  it('passes empty and normal values, and the exact limits', () => {
    expect(mediaErrors({})).toEqual([]);
    expect(mediaErrors(undefined)).toEqual([]);
    expect(mediaErrors({ alt: 'a'.repeat(ALT_STOP), caption: 'b'.repeat(CAPTION_STOP), credit: 'c'.repeat(CREDIT_STOP) })).toEqual([]);
  });
  it('stops each field over its limit', () => {
    expect(mediaErrors({ alt: 'a'.repeat(ALT_STOP + 1) })).toHaveLength(1);
    expect(mediaErrors({ caption: 'b'.repeat(CAPTION_STOP + 1) })).toHaveLength(1);
    expect(mediaErrors({ credit: 'c'.repeat(CREDIT_STOP + 1) })).toHaveLength(1);
    expect(mediaErrors({ alt: 'a'.repeat(301), caption: 'b'.repeat(301), credit: 'c'.repeat(121) })).toHaveLength(3);
  });
  it('stops an emoji in any field but allows the copyright sign', () => {
    expect(mediaErrors({ alt: 'Crowd \u{1F600}' })).toHaveLength(1);
    expect(mediaErrors({ credit: 'Photo \u{1F4F7}' })).toHaveLength(1);
    expect(mediaErrors({ credit: 'Photo \u00A9 AP' })).toEqual([]);
  });
});

describe('mergeMedia', () => {
  it('adds an entry and does not change the input', () => {
    const prev = { '/media/x.webp': { alt: 'x' } };
    const out = mergeMedia(prev, P, { alt: 'Council votes', caption: '', credit: 'Staff' });
    expect(out).toEqual({ '/media/x.webp': { alt: 'x' }, [P]: { alt: 'Council votes', credit: 'Staff' } });
    expect(prev).toEqual({ '/media/x.webp': { alt: 'x' } });
  });
  it('removes emptied keys and removes an entry left empty', () => {
    expect(mergeMedia({ [P]: { alt: 'a', caption: 'c' } }, P, { alt: '' })).toEqual({ [P]: { caption: 'c' } });
    expect(mergeMedia({ [P]: { alt: 'a' } }, P, { alt: '   ', caption: '' })).toEqual({});
  });
  it('keeps keys the screen does not own and cleans spaces', () => {
    expect(mergeMedia({ [P]: { sha256: 'abc', alt: 'a' } }, P, { alt: '  two   words ' })).toEqual({ [P]: { sha256: 'abc', alt: 'two words' } });
  });
  it('works without a stored map and refuses a bad path', () => {
    expect(mergeMedia(undefined, P, { alt: 'a' })).toEqual({ [P]: { alt: 'a' } });
    expect(mergeMedia(null, P, {})).toEqual({});
    expect(() => mergeMedia({}, '/not/media.webp', { alt: 'a' })).toThrow();
  });
});

describe('altFor', () => {
  it('the post value wins, then the stored one', () => {
    expect(altFor({ [P]: { alt: 'stored' } }, P, 'in the post')).toBe('in the post');
    expect(altFor({ [P]: { alt: 'stored' } }, P, '  ')).toBe('stored');
    expect(altFor({}, P)).toBe('');
    expect(altFor(undefined, P)).toBe('');
  });
});

describe('readableName', () => {
  it('refuses camera, phone and screenshot names', () => {
    for (const n of ['IMG_1234.jpg', 'img-1234.webp', 'DSC00012.JPG', 'PXL_20261117_093000.jpg', '/media/2026/11/IMG_0001.webp', 'screenshot-2026.png', 'image.webp', 'untitled.png', '1234.jpg', '20261117-093000.jpg', 'ab.png', 'photo-5521.webp'])
      expect(readableName(n), n).toBe(false);
  });
  it('accepts a name that says what the picture shows', () => {
    for (const n of ['city-hall-vote.webp', '/media/2026/11/senate-budget-hearing.webp', 'img-of-the-year-award.webp', 'photo-booth-line.webp'])
      expect(readableName(n), n).toBe(true);
  });
});

describe('imageChecks', () => {
  const codes = (i: any) => imageChecks(i).map((c: any) => c.code);
  it('a good picture has no warning', () => {
    expect(codes({ path: P, alt: 'Council members vote', width: 1600, bytes: 120 * 1024, featured: true })).toEqual([]);
  });
  it('warns about missing and long alt text', () => {
    expect(codes({ path: P })).toContain('alt');
    expect(codes({ path: P, alt: 'a'.repeat(ALT_WARN) })).not.toContain('alt-long');
    expect(codes({ path: P, alt: 'a'.repeat(ALT_WARN + 1) })).toContain('alt-long');
  });
  it('warns about the file name, the width of a featured image, the format and the size', () => {
    expect(codes({ path: '/media/IMG_1234.webp', alt: 'x' })).toContain('name');
    expect(codes({ path: P, alt: 'x', width: 800, featured: true })).toContain('width');
    expect(codes({ path: P, alt: 'x', width: 800, featured: false })).not.toContain('width');
    expect(codes({ path: '/media/city-hall.jpg', alt: 'x' })).toContain('format');
    expect(codes({ path: '/media/logo.svg', alt: 'x' })).not.toContain('format');
    expect(codes({ path: P, alt: 'x', bytes: 400 * 1024 })).toContain('size');
  });
  it('skips the width and size checks when they are unknown', () => {
    expect(codes({ path: P, alt: 'x', featured: true })).toEqual([]);
  });
  it('works with no input', () => {
    expect(() => imageChecks()).not.toThrow();
  });
});

describe('usedIn', () => {
  const items = [
    { file: 'a.md', text: `---\nimage: ${P}\n---\nBody` },
    { file: 'b.md', text: `![x](${P})` },
    { file: 'c.md', text: `<img src="${P}" alt="">` },
    { file: 'd.md', text: `![x](${P.replace('.webp', '.webp2')})` },
    { file: 'e.md', text: `![x](${P.replace('vote', 'vote-2')})` },
    { file: 'f.md', text: 'nothing here' },
  ];
  it('finds the content files that show the picture, in all three forms', () => {
    expect(usedIn(P, items)).toEqual(['a.md', 'b.md', 'c.md']);
  });
  it('does not count a longer name that only starts the same', () => {
    expect(usedIn(P, items)).not.toContain('d.md');
    expect(usedIn(P, items)).not.toContain('e.md');
  });
  it('handles a bad path and no items', () => {
    expect(usedIn('/x.webp', items)).toEqual([]);
    expect(usedIn(P)).toEqual([]);
  });
});

describe('featuredIn', () => {
  const items = [
    { file: 'a.md', text: `---\ntitle: A\nimage: ${P}\n---\nBody` },
    { file: 'b.md', text: `---\nimage: "${P}"\n---\n` },
    { file: 'c.md', text: `---\nimage: '${P}'   \n---\n` },
    { file: 'd.md', text: `Body only ![x](${P})` },
    { file: 'e.md', text: `---\nimage: ${P}2\n---\n` },
    { file: 'f.md', text: `---\nogImage: ${P}\n---\n` },
    { file: 'g.md', text: `---\nimage: ${P.replace('city-hall-vote', 'cityXhallXvote')}\n---\n` },
    { file: 'h.md', text: `---\ntitle: see the image: ${P}\n---\n` },
  ];
  it('finds the files whose front matter image is this picture, quoted or not', () => {
    expect(featuredIn(P, items)).toEqual(['a.md', 'b.md', 'c.md']);
  });
  it('ignores a picture only in the body, a longer name, another field and a name that differs in a dot or hyphen', () => {
    const r = featuredIn(P, items);
    for (const f of ['d.md', 'e.md', 'f.md', 'g.md', 'h.md']) expect(r).not.toContain(f);
  });
  it('handles a bad path and no items', () => {
    expect(featuredIn('/x.webp', items)).toEqual([]);
    expect(featuredIn(P)).toEqual([]);
  });
});

describe('missingAlt', () => {
  it('lists files with no stored alt text', () => {
    const map = { '/media/a.webp': { alt: 'a' }, '/media/b.webp': { caption: 'only a caption' } };
    expect(missingAlt(['/media/a.webp', '/media/b.webp', '/media/c.webp', '/bad.webp'], map)).toEqual(['/media/b.webp', '/media/c.webp']);
    expect(missingAlt(['/media/a.webp'], undefined)).toEqual(['/media/a.webp']);
  });
});

describe('checkMedia (config/media.json)', () => {
  it('the shipped file is an empty object that passes', () => {
    expect(JSON.parse(src('config/media.json'))).toEqual({});
    expect(checkMedia({})).toEqual([]);
  });
  it('passes full, partial and extra-key entries', () => {
    expect(checkMedia({ [P]: { alt: 'a', caption: 'c', credit: 'AP' } })).toEqual([]);
    expect(checkMedia({ [P]: { alt: 'a' } })).toEqual([]);
    expect(checkMedia({ [P]: { sha256: 'abc' } })).toEqual([]);
  });
  it('stops a root that is not an object, a bad path and a non-object entry', () => {
    expect(checkMedia([])).toHaveLength(1);
    expect(checkMedia(null)).toHaveLength(1);
    expect(checkMedia({ '/other/a.webp': {} }).join(' ')).toMatch(/under \/media\//);
    expect(checkMedia({ '/media/../a.webp': {} })).toHaveLength(1);
    expect(checkMedia({ [P]: 'text' }).join(' ')).toMatch(/must be an object/);
  });
  it('stops too long text, wrong type and emoji', () => {
    expect(checkMedia({ [P]: { alt: 'a'.repeat(301) } })).toHaveLength(1);
    expect(checkMedia({ [P]: { caption: 'b'.repeat(301) } })).toHaveLength(1);
    expect(checkMedia({ [P]: { credit: 'c'.repeat(121) } })).toHaveLength(1);
    expect(checkMedia({ [P]: { alt: 5 } })).toHaveLength(1);
    expect(checkMedia({ [P]: { alt: 'Fire \u{1F525}' } }).length).toBeGreaterThan(0);
  });
  it('the limits in the dashboard rules and in the content check agree', () => {
    const lib = src('scripts/validate-content-lib.mjs');
    expect(lib).toContain(`alt: ${ALT_STOP}, caption: ${CAPTION_STOP}, credit: ${CREDIT_STOP}`);
  });
  it('the content check script (real run) fails on a bad config/media.json and passes on a good one', () => {
    const d = mkdtempSync(join(tmpdir(), 'mm-'));
    for (const x of ['content/blogs', 'content/pages', 'content/authors', 'config']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const run = () => spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8' });
    writeFileSync(join(d, 'config/media.json'), JSON.stringify({ [P]: { alt: 'Council votes' } }));
    expect(run().status).toBe(0);
    writeFileSync(join(d, 'config/media.json'), JSON.stringify({ [P]: { alt: 'a'.repeat(301) } }));
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/media.json:');
  });
});

describe('mergeAltBulk (Part 8a)', () => {
  const A = '/media/2026/11/a.webp';
  const B = '/media/2026/11/b.webp';
  it('sets the alt text of each filled row and keeps every other entry and key', () => {
    const base = { [B]: { caption: 'Cap', credit: 'Staff' }, '/media/x.webp': { alt: 'old', extra: 1 } };
    const r = mergeAltBulk(base, [{ path: A, alt: ' New   alt ' }, { path: B, alt: 'Second' }]);
    expect(r.errors).toEqual([]);
    expect(r.changed).toEqual([A, B]);
    expect(r.map[A]).toEqual({ alt: 'New alt' });
    expect(r.map[B]).toEqual({ caption: 'Cap', credit: 'Staff', alt: 'Second' });
    expect(r.map['/media/x.webp']).toEqual({ alt: 'old', extra: 1 });
    expect(base[B]).toEqual({ caption: 'Cap', credit: 'Staff' });
  });
  it('skips empty rows and rows that do not change anything', () => {
    const r = mergeAltBulk({ [A]: { alt: 'Same' } }, [{ path: A, alt: ' Same ' }, { path: B, alt: '   ' }, { path: B, alt: '' }]);
    expect(r.changed).toEqual([]);
    expect(r.map).toEqual({ [A]: { alt: 'Same' } });
  });
  it('the first row of a path wins', () => {
    expect(mergeAltBulk({}, [{ path: A, alt: 'First' }, { path: A, alt: 'Second' }]).map[A].alt).toBe('First');
  });
  it('is all or nothing: one error and the map comes back unchanged', () => {
    const base = { [B]: { alt: 'keep' } };
    const r = mergeAltBulk(base, [{ path: A, alt: 'Fine' }, { path: B, alt: 'a'.repeat(301) }]);
    expect(r.changed).toEqual([]);
    expect(r.map).toBe(base);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].path).toBe(B);
  });
  it('refuses a path outside /media/ and an alt text with emoji', () => {
    expect(mergeAltBulk({}, [{ path: '/other/a.webp', alt: 'x' }]).errors[0].message).toContain('not a file under /media/');
    expect(mergeAltBulk({}, [{ path: '/media/../a.webp', alt: 'x' }]).errors).toHaveLength(1);
    expect(mergeAltBulk({}, [{ path: A, alt: 'Smile \u{1F600}' }]).errors[0].message).toMatch(/emoji/);
  });
  it('is safe with an odd map or odd rows', () => {
    for (const m of [undefined, null, [], 'x']) expect(mergeAltBulk(m as any, [{ path: A, alt: 'x' }]).map[A]).toEqual({ alt: 'x' });
    expect(mergeAltBulk({}, undefined as any)).toEqual({ map: {}, changed: [], errors: [] });
    expect(mergeAltBulk({}, [null, undefined, 5] as any)).toEqual({ map: {}, changed: [], errors: [] });
  });
});
