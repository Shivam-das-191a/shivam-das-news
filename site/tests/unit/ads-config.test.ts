import { describe, it, expect } from 'vitest';
import * as js from '../../public/admin/js/ads-config.js';
import * as ts from '../../src/lib/ads-txt';

const cases: any[] = [
  {},
  { adsensePublisherId: 'ca-pub-1234567890123456' },
  { adsensePublisherId: ' PUB-1234567890123456 ', extraLines: ['Ads.Test, 99, reseller', 'ads.test, 99, RESELLER', 'b.com, 2, DIRECT, ABCDEF123456'] },
  { adsensePublisherId: 'oops' },
  { extraLines: ['nodomain, 1, DIRECT'] },
  { extraLines: ['a.com, 1, PARTNER'] },
  { extraLines: ['a.com, 1, DIRECT, xyz'] },
  { extraLines: ['a.com, 1'] },
];

describe('ads-config (dashboard) stays in step with ads-txt (build)', () => {
  it('gives the same file, or both refuse, for every case', () => {
    for (const c of cases) {
      let a: any, b: any;
      try { a = js.buildAdsTxt(c).text; } catch { a = 'ERROR'; }
      try { b = ts.buildAdsTxt(c).text; } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
  });
  it('uses the same Google certification id', () => { expect(js.GOOGLE_CERT).toBe(ts.GOOGLE_CERT); });
});

describe('ads-config form helpers', () => {
  it('reads the file, and a broken file gives the empty config', () => {
    expect(js.readAds('{"adsensePublisherId":"ca-pub-1234567890123456","extraLines":["a.com, 1, DIRECT",5]}')).toEqual({ adsensePublisherId: 'ca-pub-1234567890123456', extraLines: ['a.com, 1, DIRECT'] });
    expect(js.readAds('nope')).toEqual({ adsensePublisherId: '', extraLines: [] });
    expect(js.readAds('[]')).toEqual({ adsensePublisherId: '', extraLines: [] });
  });
  it('turns the two form values into a checked config', () => {
    expect(js.configFromForm(' pub-1234567890123456 ', ' A.com, 1, reseller \n\n b.com, 2, DIRECT ')).toEqual({ adsensePublisherId: 'ca-pub-1234567890123456', extraLines: ['a.com, 1, RESELLER', 'b.com, 2, DIRECT'] });
    expect(js.configFromForm('', '')).toEqual({ adsensePublisherId: '', extraLines: [] });
  });
  it('refuses bad values with a plain message', () => {
    expect(() => js.configFromForm('abc', '')).toThrow('not valid');
    expect(() => js.configFromForm('', 'a.com, 1')).toThrow('not valid');
  });
  it('writes pretty JSON with a final newline', () => {
    const t = js.writeAds({ adsensePublisherId: '', extraLines: [] });
    expect(t.endsWith('\n')).toBe(true);
    expect(JSON.parse(t)).toEqual({ adsensePublisherId: '', extraLines: [] });
  });
});
