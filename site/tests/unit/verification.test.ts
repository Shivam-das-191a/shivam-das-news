import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { verificationCodes, MAX_CODES } from '../../src/lib/verification';

const A = 'zcb1sDXPTidVPfpxDjMVAHe6IdNRzUnmMSeUb8fMLpQ';
const B = 'BNUiiRhkIa4oM-UJ5sogZgIWmlyQr0Xu1fQVAXSkDFY';

describe('verificationCodes', () => {
  it('keeps one code given as text', () => {
    expect(verificationCodes(A)).toEqual([A]);
  });
  it('keeps two codes given as a list, in order', () => {
    expect(verificationCodes([A, B])).toEqual([A, B]);
  });
  it('splits text with commas, spaces, semicolons or new lines (what the dashboard Settings screen saves)', () => {
    expect(verificationCodes(`${A},${B}`)).toEqual([A, B]);
    expect(verificationCodes(`${A}, ${B}`)).toEqual([A, B]);
    expect(verificationCodes(`${A}\n${B}`)).toEqual([A, B]);
    expect(verificationCodes(`${A}; ${B}`)).toEqual([A, B]);
  });
  it('round trip: a list shown in the dashboard as text and saved again gives the same list', () => {
    const shown = String([A, B]); // what an input shows for a list
    expect(verificationCodes(shown)).toEqual([A, B]);
  });
  it('takes the content part when a whole meta tag was pasted, one or two tags', () => {
    expect(verificationCodes(`<meta name="google-site-verification" content="${A}" />`)).toEqual([A]);
    expect(verificationCodes(`<meta name='google-site-verification' content='${B}'>`)).toEqual([B]);
  });
  it('removes repeats', () => {
    expect(verificationCodes([A, A, ` ${A} `])).toEqual([A]);
  });
  it('gives an empty list for empty, missing or wrong types', () => {
    for (const v of ['', '   ', undefined, null, 5, {}, true, [], [''], [1, 2]]) expect(verificationCodes(v)).toEqual([]);
  });
  it('drops anything that could break out of the tag or is too short or too long', () => {
    for (const bad of ['short', '"><script>alert(1)</script>', 'abc def"ghi', `${A}"onload="x`, 'x'.repeat(201), 'a<b>cdefghijkl']) {
      expect(verificationCodes(bad).some((c) => /["'<>]/.test(c))).toBe(false);
    }
    expect(verificationCodes('"><script>alert(1)</script>')).toEqual([]);
    expect(verificationCodes('x'.repeat(201))).toEqual([]);
    expect(verificationCodes('short')).toEqual([]);
  });
  it('keeps the good codes and drops the bad ones next to them', () => {
    expect(verificationCodes([A, '"><b>', B])).toEqual([A, B]);
  });
  it('keeps at most MAX_CODES codes', () => {
    const many = Array.from({ length: MAX_CODES + 3 }, (_, i) => `code-number-${i}-abcdefghij`);
    expect(verificationCodes(many)).toHaveLength(MAX_CODES);
  });
});

describe('the page head uses the helper', () => {
  const base = readFileSync(new URL('../../src/layouts/Base.astro', import.meta.url), 'utf8');
  it('writes one tag for each code and never the raw config value', () => {
    expect(base).toContain("import { verificationCodes } from '../lib/verification'");
    expect(base).toContain('googleCodes.map');
    expect(base).toContain('bingCodes.map');
    expect(base).toContain('yandexCodes.map');
    expect(base).not.toMatch(/content=\{v\.(google|bing|yandex)\}/);
  });
});
