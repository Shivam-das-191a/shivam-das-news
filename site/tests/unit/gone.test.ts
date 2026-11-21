import { describe, it, expect } from 'vitest';
import { buildGone, MAX_GONE } from '../../src/lib/gone';

describe('buildGone', () => {
  it('keeps archived addresses, sorted, in one path form', () => {
    const r = buildGone(['/2026/11/12/blogs/tech/b', '/2026/11/12/blogs/tech/a/'], new Set(), new Set());
    expect(r.paths).toEqual(['/2026/11/12/blogs/tech/a/', '/2026/11/12/blogs/tech/b/']);
    expect(r.problems).toEqual([]);
  });
  it('a live page wins over gone', () => {
    const r = buildGone(['/x/'], new Set(['/x/']), new Set());
    expect(r.paths).toEqual([]);
    expect(r.problems[0]).toContain('live page');
  });
  it('a redirect wins over gone', () => {
    const r = buildGone(['/x/'], new Set(), new Set(['/x/']));
    expect(r.paths).toEqual([]);
    expect(r.problems[0]).toContain('redirect');
  });
  it('drops duplicates, bad paths and rules over 100 characters', () => {
    const r = buildGone(['/a/', '/a/', 'nope', '/' + 'x'.repeat(120) + '/'], new Set(), new Set());
    expect(r.paths).toEqual(['/a/']);
    expect(r.problems.length).toBe(2);
  });
  it('caps at the Cloudflare rule limit and says so', () => {
    const many = Array.from({ length: MAX_GONE + 5 }, (_, i) => `/p/${String(i).padStart(3, '0')}/`);
    const r = buildGone(many, new Set(), new Set());
    expect(r.paths.length).toBe(MAX_GONE);
    expect(r.problems[0]).toContain('5 will answer 404');
  });
});
