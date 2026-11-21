import { describe, it, expect } from 'vitest';
import { absUrl, truncate, xmlEscape } from '../../src/lib/seo';

describe('seo helpers', () => {
  it('builds absolute urls', () => {
    expect(absUrl('/a/', 'https://x.test')).toBe('https://x.test/a/');
    expect(absUrl('https://cdn.test/i.webp', 'https://x.test')).toBe('https://cdn.test/i.webp');
  });
  it('truncates at a word boundary only when needed', () => {
    expect(truncate('short text', 50)).toBe('short text');
    const t = truncate('one two three four five six seven eight nine ten', 20);
    expect(t.length).toBeLessThanOrEqual(20);
    expect(t.endsWith('\u2026')).toBe(true);
  });
  it('escapes xml', () => {
    expect(xmlEscape('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
  });
});
