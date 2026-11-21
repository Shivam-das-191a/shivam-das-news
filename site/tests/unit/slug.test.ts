import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from '../../src/lib/slug';

describe('slugify', () => {
  it('lowercases, strips accents and stop words', () => {
    expect(slugify('The Café of the Future')).toBe('cafe-future');
  });
  it('cuts at a word boundary under 60 chars', () => {
    const s = slugify('word '.repeat(30));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
  it('adds -2, -3 for site-wide duplicates', () => {
    expect(uniqueSlug('a', new Set(['a', 'a-2']))).toBe('a-3');
  });
});
