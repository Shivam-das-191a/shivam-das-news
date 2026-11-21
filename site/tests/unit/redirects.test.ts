import { describe, it, expect } from 'vitest';
import { buildRedirects, normalizePath, toRedirectsFile } from '../../src/lib/redirects';

const live = new Set(['/2026/11/13/blogs/tech/c/', '/2026/11/13/blogs/tech/z/']);

describe('normalizePath', () => {
  it('gives one form', () => {
    expect(normalizePath('/a/b')).toBe('/a/b/');
    expect(normalizePath('https://news.test/a/b/?x=1#h')).toBe('/a/b/');
    expect(normalizePath('a/b')).toBeNull();
    expect(normalizePath('/a b/')).toBeNull();
    expect(normalizePath('/a/:id/')).toBeNull();
    expect(normalizePath('')).toBeNull();
  });
});

describe('buildRedirects', () => {
  it('points an old URL at the live URL', () => {
    const r = buildRedirects([{ from: '/old/a/', to: '/2026/11/13/blogs/tech/c/' }], live);
    expect(r.map).toEqual({ '/old/a/': '/2026/11/13/blogs/tech/c/' });
    expect(r.problems).toEqual([]);
  });
  it('collapses a chain A to B to C into A to C (U3)', () => {
    const r = buildRedirects([{ from: '/a/', to: '/b/' }, { from: '/b/', to: '/2026/11/13/blogs/tech/c/' }], live);
    expect(r.map['/a/']).toBe('/2026/11/13/blogs/tech/c/');
    expect(r.map['/b/']).toBe('/2026/11/13/blogs/tech/c/');
  });
  it('drops a source that is a live page, so there is no loop (U4)', () => {
    const r = buildRedirects([{ from: '/2026/11/13/blogs/tech/z/', to: '/2026/11/13/blogs/tech/c/' }], live);
    expect(r.map).toEqual({});
    expect(r.problems[0]).toContain('live page');
  });
  it('drops a loop and a dead end, and reports them', () => {
    const r = buildRedirects([{ from: '/a/', to: '/b/' }, { from: '/b/', to: '/a/' }, { from: '/x/', to: '/gone/' }], live);
    expect(r.map).toEqual({});
    expect(r.problems.length).toBe(3);
  });
  it('keeps the first claim when two posts claim one old URL', () => {
    const r = buildRedirects([{ from: '/a/', to: '/2026/11/13/blogs/tech/c/' }, { from: '/a/', to: '/2026/11/13/blogs/tech/z/' }], live);
    expect(r.map['/a/']).toBe('/2026/11/13/blogs/tech/c/');
    expect(r.problems[0]).toContain('conflict');
  });
  it('ignores unusable paths', () => {
    const r = buildRedirects([{ from: 'nope', to: '/2026/11/13/blogs/tech/c/' }], live);
    expect(r.map).toEqual({});
    expect(r.problems.length).toBe(1);
  });
});

describe('toRedirectsFile', () => {
  it('writes sorted 301 lines', () => {
    expect(toRedirectsFile({ '/b/': '/z/', '/a/': '/z/' })).toBe('/a/ /z/ 301\n/b/ /z/ 301\n');
    expect(toRedirectsFile({})).toBe('');
  });
});
