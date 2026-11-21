import { describe, it, expect } from 'vitest';
import { activeCategories } from '../../src/lib/active';

const now = new Date('2026-11-13T12:00:00Z');
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('active categories (7 day window)', () => {
  it('keeps categories with a post in the window', () => {
    const r = activeCategories([{ category: 'tech', date: day(2) }, { category: 'sports', date: day(9) }], now, 7);
    expect(r).toEqual(['tech']);
  });
  it('returns none when everything is old (menu falls back to Latest)', () => {
    expect(activeCategories([{ category: 'tech', date: day(30) }], now, 7)).toEqual([]);
  });
  it('ignores future-dated posts', () => {
    expect(activeCategories([{ category: 'tech', date: new Date(now.getTime() + 1000) }], now, 7)).toEqual([]);
  });
});
