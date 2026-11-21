import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { listMediaFiles, mediaUrls } from '../../src/lib/media-live';
import { buildRedirects } from '../../src/lib/redirects';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

describe('mediaUrls', () => {
  it('turns a path inside public/media into the served address', () => {
    expect(mediaUrls(['2026/11/a.webp', 'b.JPG', 'x/y/z.svg'])).toEqual(['/media/2026/11/a.webp', '/media/b.JPG', '/media/x/y/z.svg']);
  });
  it('keeps pictures only', () => {
    expect(mediaUrls(['a.webp', 'notes.txt', 'page.html', 'a.webp.bak', 'doc.pdf'])).toEqual(['/media/a.webp']);
  });
  it('skips dot files, dot folders and ".."', () => {
    expect(mediaUrls(['.gitkeep', '.hidden/a.webp', '2026/../a.webp', './a.webp'])).toEqual([]);
  });
  it('skips names that could never be a redirect address', () => {
    expect(mediaUrls(['a b.webp', 'a:b.webp', 'a*b.webp', 'a?b.webp', 'a#b.webp'])).toEqual([]);
  });
  it('accepts Windows separators and a leading slash', () => {
    expect(mediaUrls(['2026\\11\\a.webp', '/2026/11/b.webp'])).toEqual(['/media/2026/11/a.webp', '/media/2026/11/b.webp']);
  });
  it('does not fail on odd input', () => {
    expect(mediaUrls(['', undefined as any, null as any, 5 as any])).toEqual([]);
    expect(mediaUrls([])).toEqual([]);
  });
});

describe('listMediaFiles', () => {
  it('lists files in all folders, sorted, relative, without dot files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'media-live-'));
    try {
      mkdirSync(join(dir, '2026/11'), { recursive: true });
      mkdirSync(join(dir, '2025/01'), { recursive: true });
      writeFileSync(join(dir, '2026/11/b.webp'), 'x');
      writeFileSync(join(dir, '2025/01/a.png'), 'x');
      writeFileSync(join(dir, '.gitkeep'), '');
      expect(listMediaFiles(dir)).toEqual(['2025/01/a.png', '2026/11/b.webp']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('a missing folder gives an empty list', () => {
    expect(listMediaFiles(join(tmpdir(), 'no-such-folder-' + Date.now()))).toEqual([]);
  });
});

describe('the redirect builder with pictures as live addresses', () => {
  const live = (more: string[] = []) => new Set<string>(['/', '/a/', ...mediaUrls(['2026/11/new.webp', ...more])]);
  it('a renamed picture keeps a 301 from the old address to the new one', () => {
    const r = buildRedirects([{ from: '/media/2026/11/old.webp', to: '/media/2026/11/new.webp' }], live());
    expect(r.map).toEqual({ '/media/2026/11/old.webp': '/media/2026/11/new.webp' });
    expect(r.problems).toEqual([]);
  });
  it('without the picture in the live set the redirect is dropped (the old behaviour)', () => {
    const r = buildRedirects([{ from: '/media/2026/11/old.webp', to: '/media/2026/11/new.webp' }], new Set(['/']));
    expect(r.map).toEqual({});
    expect(r.problems[0]).toContain('not a live page');
  });
  it('an old address whose file still exists is not redirected (a live file wins)', () => {
    const r = buildRedirects([{ from: '/media/2026/11/old.webp', to: '/media/2026/11/new.webp' }], live(['2026/11/old.webp']));
    expect(r.map).toEqual({});
    expect(r.problems[0]).toContain('live page');
  });
  it('a chain old to middle to new collapses to old to new', () => {
    const r = buildRedirects([{ from: '/media/o.webp', to: '/media/2026/11/mid.webp' }, { from: '/media/2026/11/mid.webp', to: '/media/2026/11/new.webp' }], live());
    expect(r.map['/media/o.webp']).toBe('/media/2026/11/new.webp');
    expect(r.map['/media/2026/11/mid.webp']).toBe('/media/2026/11/new.webp');
  });
});

describe('the build helper', () => {
  const page = src('src/pages/redirects-map.json.ts');
  it('adds the pictures to the live addresses', () => {
    expect(page).toContain("mediaUrls(listMediaFiles(join(process.cwd(), 'public/media')))");
    expect(page.indexOf('mediaUrls(')).toBeLessThan(page.indexOf('buildRedirects('));
    expect(page).toContain("from '../lib/media-live'");
  });
});
