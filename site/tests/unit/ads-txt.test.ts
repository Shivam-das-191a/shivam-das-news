import { describe, it, expect } from 'vitest';
import { buildAdsTxt, cleanLine, cleanPublisherId, GOOGLE_CERT } from '../../src/lib/ads-txt';

describe('ads.txt', () => {
  it('is empty when nothing is configured (no fake lines)', () => {
    expect(buildAdsTxt({})).toEqual({ text: '', lines: [] });
    expect(buildAdsTxt({ adsensePublisherId: '', extraLines: [] }).text).toBe('');
  });

  it('writes the AdSense line from ca-pub or pub ids, in any letter case', () => {
    const want = `google.com, pub-1234567890123456, DIRECT, ${GOOGLE_CERT}\n`;
    expect(buildAdsTxt({ adsensePublisherId: 'ca-pub-1234567890123456' }).text).toBe(want);
    expect(buildAdsTxt({ adsensePublisherId: ' PUB-1234567890123456 ' }).text).toBe(want);
  });

  it('refuses a publisher id that is not an AdSense id', () => {
    for (const bad of ['1234', 'pub-12', 'ca-pub-abc1234567890123', 'google.com']) expect(() => cleanPublisherId(bad)).toThrow('not valid');
  });

  it('cleans extra lines: lower-case domain, upper-case relationship, optional certification id', () => {
    expect(cleanLine('  Adnetwork.COM ,  12345 , reseller ')).toBe('adnetwork.com, 12345, RESELLER');
    expect(cleanLine('adnetwork.com, 12345, DIRECT, ABCDEF123456')).toBe('adnetwork.com, 12345, DIRECT, abcdef123456');
  });

  it('refuses broken extra lines with a plain message', () => {
    for (const bad of ['', 'adnetwork.com, 12345', 'nodomain, 12345, DIRECT', 'adnetwork.com, 12 34, DIRECT', 'adnetwork.com, 12345, PARTNER', 'adnetwork.com, 12345, DIRECT, xyz', 'a.com, 1, DIRECT, abcdef, extra', '<script>x</script>']) expect(() => cleanLine(bad)).toThrow('not valid');
  });

  it('puts AdSense first, keeps the order of your lines and writes a repeated line once', () => {
    const r = buildAdsTxt({ adsensePublisherId: 'pub-1234567890123456', extraLines: ['b.com, 2, DIRECT', 'A.com, 1, RESELLER', 'b.com, 2, direct'] });
    expect(r.lines).toEqual([`google.com, pub-1234567890123456, DIRECT, ${GOOGLE_CERT}`, 'b.com, 2, DIRECT', 'a.com, 1, RESELLER']);
    expect(r.text.endsWith('\n')).toBe(true);
  });
});
