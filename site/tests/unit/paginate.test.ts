import { describe, it, expect } from 'vitest';
import { paginate, restParam, pageSuffix } from '../../src/lib/paginate';

describe('paginate', () => {
  it('splits 45 items into 3 pages of 20', () => {
    const p = paginate(Array.from({ length: 45 }, (_, i) => i), 20);
    expect(p.map((x) => x.items.length)).toEqual([20, 20, 5]);
  });
  it('always returns one page, even when empty', () => {
    expect(paginate([], 20)).toHaveLength(1);
  });
  it('page 1 has no suffix, page 2 is page/2/', () => {
    expect(restParam(1)).toBeUndefined();
    expect(restParam(2)).toBe('page/2');
    expect(pageSuffix(2)).toBe('page/2/');
  });
});
