import { describe, it, expect } from 'vitest';
import * as js from '../../public/admin/js/ad-loader-config.js';
import * as ts from '../../src/lib/ad-loader';

const GEO = 'https://news-geo.test.workers.dev/geo';
const POP = 'https://ads.test-network.dev/pop.js';
const BAR = 'https://ads.test-network.dev/bar.js';
const NAT = 'https://ads.test-network.dev/native.js';
const SMART = 'https://ads.test-network.dev/smart-abc';
const NB = { script: '', containerId: '', afterParagraph: 3 };
const ASD = { slot: '', afterParagraph: 5 };
const DAYS = 180;
const PUB = 'ca-pub-1234567890123456';

const cases: any[] = [
  {},
  { complianceMode: true },
  { complianceMode: true, geoUrl: GEO, adsterra: { popunder: POP } },
  { complianceMode: false },
  { complianceMode: false, geoUrl: GEO },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: BAR } },
  { complianceMode: false, geoUrl: GEO, adsterra: { socialBar: BAR } },
  { complianceMode: false, adsterra: { popunder: POP } },
  { complianceMode: false, geoUrl: 'http://a.test/geo', adsterra: { popunder: POP } },
  { geoUrl: 'a.test/geo' },
  { geoUrl: 'https://localhost/geo' },
  { geoUrl: 'https://a.test/geo y' },
  { geoUrl: 'https://u:p@a.test/geo' },
  { complianceMode: true, adsterra: { popunder: 'javascript:alert(1)' } },
  { complianceMode: false, geoUrl: ` ${GEO} `, adsterra: { popunder: ` ${POP} ` } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'container-1a2b3c' } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 7 } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: '12' } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 0 } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 21 } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 2.5 } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { containerId: 'box' } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: '1bad id' } } },
  { complianceMode: false, adsterra: { nativeBanner: { script: NAT, containerId: 'box' } } },
  { complianceMode: true, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box' } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: 'http://a.test/n.js', containerId: 'box' } } },
  { complianceMode: false, geoUrl: GEO, adsterra: { smartlink: SMART } },
  { complianceMode: false, geoUrl: GEO, adsterra: { smartlink: ` ${SMART} `, popunder: POP } },
  { complianceMode: false, adsterra: { smartlink: SMART } },
  { complianceMode: true, geoUrl: GEO, adsterra: { smartlink: SMART } },
  { complianceMode: false, geoUrl: GEO, adsterra: { smartlink: 'http://a.test/s' } },
  { complianceMode: true, adsterra: { smartlink: 'a.test/s' } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: '1234567890' } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: '1234567890', afterParagraph: 8 } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: '1234567890', afterParagraph: 0 } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: '1234567890', afterParagraph: '21' } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: 'abc' } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: '12345' } },
  { complianceMode: false, geoUrl: GEO, adsense: { slot: ' 1234567890 ' }, adsterra: { popunder: POP } },
  { complianceMode: false, adsense: { slot: '1234567890' } },
  { complianceMode: true, geoUrl: GEO, adsense: { slot: '1234567890' } },
  { complianceMode: true, adsense: { slot: '' } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 5 } }, adsense: { slot: '1234567890', afterParagraph: 5 } },
  { complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 3 } }, adsense: { slot: '1234567890' } },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 30 },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 365 },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: '90' },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 29 },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 366 },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 45.5 },
  { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 'abc' },
  { complianceMode: true, consentDays: 0 },
];
const pubIds: any[] = [undefined, '', PUB, 'pub-1234567890123456', 'not-an-id'];

describe('ad-loader-config (dashboard) stays in step with ad-loader (build)', () => {
  it('gives the same plan, or both refuse, for every case', () => {
    for (const c of cases) {
      let a: any, b: any;
      for (const pub of pubIds) {
        try { a = js.adLoaderPlan(c, pub); } catch { a = 'ERROR'; }
        try { b = ts.adLoaderPlan(c, pub); } catch { b = 'ERROR'; }
        expect(a).toEqual(b);
      }
    }
  });
  it('accepts and refuses the same AdSense slots and paragraph numbers with the AdSense default', () => {
    for (const v of [undefined, null, '', ' ', '1234567890', ' 1234567890 ', '123456', '12345', 'abc', '12 34', 1234567890, '123456789012345678901']) {
      let a: any, b: any;
      try { a = js.cleanAdsenseSlot(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanAdsenseSlot(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
    for (const v of [undefined, null, '', ' ', '1', '5', '20', 20, '21', 0, 'x']) {
      let a: any, b: any;
      try { a = js.cleanAfterParagraph(v, 5); } catch { a = 'ERROR'; }
      try { b = ts.cleanAfterParagraph(v, 5); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
  });
  it('accepts and refuses the same consent days (v0.28.0)', () => {
    for (const v of [undefined, null, '', ' ', '30', 30, '180', 365, '365', '29', 29, 366, 0, -1, '45.5', 45.5, 'x', NaN]) {
      let a: any, b: any;
      try { a = js.cleanConsentDays(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanConsentDays(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
    expect(js.cleanConsentDays('')).toBe(180);
    expect(js.cleanConsentDays(' 90 ')).toBe(90);
    expect(() => js.cleanConsentDays('29')).toThrow('from 30 to 365');
  });
  it('accepts and refuses the same container ids and paragraph numbers', () => {
    for (const v of ['', ' ', 'box', 'container-1a2b3c', '1abc', 'a b', 'a\"b', '-a', 'a'.repeat(81)]) {
      let a: any, b: any;
      try { a = js.cleanContainerId(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanContainerId(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
    for (const v of [undefined, null, '', ' ', '1', '3', '20', 20, '21', 0, '0', '2.5', 'x', -1, NaN]) {
      let a: any, b: any;
      try { a = js.cleanAfterParagraph(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanAfterParagraph(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
  });
  it('accepts and refuses the same single addresses', () => {
    for (const v of ['', ' ', 'https://a.test/x.js', 'http://a.test/x.js', 'ftp://a.test/x', 'x', 'https://a', 'https://a.test/"', 'https://u@a.test/x.js']) {
      let a: any, b: any;
      try { a = js.cleanHttpsUrl(v, 'x'); } catch { a = 'ERROR'; }
      try { b = ts.cleanHttpsUrl(v, 'x'); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
  });
});

describe('ad-loader-config form helpers', () => {
  it('reads the file; a broken or odd file gives the safe default (compliance mode ON)', () => {
    const safe = { complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: NB }, adsense: ASD, consentDays: DAYS };
    expect(js.readLoader('nope')).toEqual(safe);
    expect(js.readLoader('[]')).toEqual(safe);
    expect(js.readLoader('null')).toEqual(safe);
    expect(js.readLoader('{"complianceMode":"no"}')).toEqual(safe);
    expect(js.readLoader(JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: 5 } }))).toEqual({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: '', smartlink: '', nativeBanner: NB }, adsense: ASD, consentDays: DAYS });
  });

  it('reads consentDays; a missing, odd or out-of-range value gives 180 (v0.28.0)', () => {
    expect(js.readLoader(JSON.stringify({ consentDays: 90 })).consentDays).toBe(90);
    for (const v of [undefined, '90', 29, 366, 45.5, null, 'x']) expect(js.readLoader(JSON.stringify({ consentDays: v })).consentDays).toBe(180);
    expect(js.readLoader('nope').consentDays).toBe(180);
  });

  it('turns the form days into the checked config, and refuses a bad number (v0.28.0)', () => {
    expect(js.configFromForm({ complianceMode: true, consentDays: '60' }).consentDays).toBe(60);
    expect(js.configFromForm({ complianceMode: true, consentDays: '' }).consentDays).toBe(180);
    expect(js.configFromForm({ complianceMode: true }).consentDays).toBe(180);
    expect(() => js.configFromForm({ complianceMode: true, consentDays: '10' })).toThrow('whole number from 30 to 365');
  });

  it('says in the sentence how many days the answer is kept (v0.28.0)', () => {
    const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP }, consentDays: 90 };
    expect(js.describePlan(on)).toContain('kept 90 days');
    expect(js.describePlan({ ...on, consentDays: undefined })).toContain('kept 180 days');
  });

  it('reads the smartlink; an old file without one gives an empty smartlink', () => {
    expect(js.readLoader(JSON.stringify({ adsterra: { smartlink: SMART } })).adsterra.smartlink).toBe(SMART);
    expect(js.readLoader(JSON.stringify({ adsterra: { smartlink: 5 } })).adsterra.smartlink).toBe('');
    expect(js.readLoader(JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } })).adsterra.smartlink).toBe('');
  });

  it('reads an old file without a native banner, and a bad stored native banner, as the safe default', () => {
    expect(js.readLoader(JSON.stringify({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } })).adsterra.nativeBanner).toEqual(NB);
    expect(js.readLoader(JSON.stringify({ adsterra: { nativeBanner: 'x' } })).adsterra.nativeBanner).toEqual(NB);
    expect(js.readLoader(JSON.stringify({ adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 99 } } })).adsterra.nativeBanner).toEqual({ script: NAT, containerId: 'box', afterParagraph: 3 });
    expect(js.readLoader(JSON.stringify({ adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 6 } } })).adsterra.nativeBanner).toEqual({ script: NAT, containerId: 'box', afterParagraph: 6 });
  });

  it('turns the form values into a checked config', () => {
    expect(js.configFromForm({ complianceMode: false, geoUrl: ` ${GEO} `, popunder: POP, socialBar: '' })).toEqual({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: '', smartlink: '', nativeBanner: NB }, adsense: ASD, consentDays: DAYS });
    expect(js.configFromForm({ complianceMode: true, geoUrl: '', popunder: '', socialBar: '' })).toEqual({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: NB }, adsense: ASD, consentDays: DAYS });
    expect(js.configFromForm({ complianceMode: false, geoUrl: GEO, smartlink: ` ${SMART} ` }).adsterra.smartlink).toBe(SMART);
    expect(js.configFromForm({ complianceMode: false, geoUrl: GEO, nativeScript: ` ${NAT} `, nativeContainer: ' container-1a2b3c ', nativeAfter: '5' }).adsterra.nativeBanner).toEqual({ script: NAT, containerId: 'container-1a2b3c', afterParagraph: 5 });
  });

  it('refuses bad values with a plain message', () => {
    expect(() => js.configFromForm({ complianceMode: true, geoUrl: 'http://a.test/geo' })).toThrow('must start with https://');
    expect(() => js.configFromForm({ complianceMode: false, geoUrl: GEO, popunder: 'x y' })).toThrow('not valid');
    expect(() => js.configFromForm({ complianceMode: false, geoUrl: '', popunder: POP })).toThrow('geo address is empty');
    expect(() => js.configFromForm({ complianceMode: true, nativeScript: NAT })).toThrow('needs both');
    expect(() => js.configFromForm({ complianceMode: true, nativeContainer: 'box' })).toThrow('needs both');
    expect(() => js.configFromForm({ complianceMode: true, nativeScript: NAT, nativeContainer: 'a b' })).toThrow('container id');
    expect(() => js.configFromForm({ complianceMode: true, nativeAfter: '0' })).toThrow('whole number from 1 to 20');
    expect(() => js.configFromForm({ complianceMode: true, smartlink: 'http://a.test/s' })).toThrow('smartlink address');
    expect(() => js.configFromForm({ complianceMode: false, geoUrl: '', smartlink: SMART })).toThrow('geo address is empty');
  });

  it('describes in one sentence what the file would do', () => {
    expect(js.describePlan({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: NB } })).toContain('OFF: compliance mode is on');
    expect(js.describePlan({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: NB } })).toContain('OFF: no script address');
    const nat = js.describePlan({ complianceMode: false, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: 4 } } });
    expect(nat).toContain('native banner (after paragraph 4');
    expect(nat).not.toContain('popunder');
    const sm = js.describePlan({ complianceMode: false, geoUrl: GEO, adsterra: { smartlink: SMART } });
    expect(sm).toContain('smartlink (opens one time when a reader clicks a picture');
    expect(sm).not.toContain('popunder');
    const on = js.describePlan({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: BAR } });
    expect(on).toContain('ON for article pages only');
    expect(on).toContain('social bar and popunder');
    expect(on).toContain('India is off');
  });

  it('writes pretty JSON with a final newline', () => {
    const cfg = { complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: NB } };
    const t = js.writeLoader(cfg);
    expect(t.endsWith('\n')).toBe(true);
    expect(JSON.parse(t)).toEqual(cfg);
  });
});

describe('ad-loader-config AdSense unit (v0.24.0)', () => {
  it('reads the unit; an old file without one, or a bad stored one, gives the safe default', () => {
    expect(js.readLoader(JSON.stringify({ adsense: { slot: '1234567890', afterParagraph: 8 } })).adsense).toEqual({ slot: '1234567890', afterParagraph: 8 });
    expect(js.readLoader(JSON.stringify({ complianceMode: false, geoUrl: GEO })).adsense).toEqual(ASD);
    expect(js.readLoader(JSON.stringify({ adsense: 'x' })).adsense).toEqual(ASD);
    expect(js.readLoader(JSON.stringify({ adsense: { slot: 5, afterParagraph: 99 } })).adsense).toEqual(ASD);
  });

  it('turns the form values into a checked config, with the AdSense id from the Ads screen', () => {
    const c = js.configFromForm({ complianceMode: false, geoUrl: GEO, adsenseSlot: ' 1234567890 ', adsenseAfter: '7' }, PUB);
    expect(c.adsense).toEqual({ slot: '1234567890', afterParagraph: 7 });
    expect(js.configFromForm({ complianceMode: true, adsenseSlot: '', adsenseAfter: '' }).adsense).toEqual(ASD);
  });

  it('refuses bad values with a plain message', () => {
    expect(() => js.configFromForm({ complianceMode: true, adsenseSlot: '1234567890' })).toThrow('no AdSense id yet');
    expect(() => js.configFromForm({ complianceMode: true, adsenseSlot: 'abc' }, PUB)).toThrow('AdSense slot');
    expect(() => js.configFromForm({ complianceMode: true, adsenseSlot: '1234567890', adsenseAfter: '0' }, PUB)).toThrow('whole number from 1 to 20');
    expect(() => js.configFromForm({ complianceMode: false, geoUrl: '', adsenseSlot: '1234567890' }, PUB)).toThrow('geo address is empty');
    expect(() => js.configFromForm({ complianceMode: true, nativeScript: NAT, nativeContainer: 'box', nativeAfter: '5', adsenseSlot: '1234567890', adsenseAfter: '5' }, PUB)).toThrow('same paragraph number');
  });

  it('describes the unit in one sentence', () => {
    const cfg = js.configFromForm({ complianceMode: false, geoUrl: GEO, adsenseSlot: '1234567890', adsenseAfter: '6' }, PUB);
    expect(js.describePlan(cfg, PUB)).toContain('AdSense unit (after paragraph 6');
    expect(js.describePlan({ ...cfg, complianceMode: true }, PUB)).toContain('OFF: compliance mode is on');
  });
});

describe('ad-loader-config consent text (v0.30.0)', () => {
  const T = 'We show ads from partners next to this article. Please choose.';
  const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } };
  it('accepts and refuses the same texts in the build and in the dashboard', () => {
    for (const v of [undefined, null, '', ' ', T, ` ${T} `, 'short', 'x'.repeat(20), 'x'.repeat(19), 'x'.repeat(300), 'x'.repeat(301), `${T} <b>`, `${T}\nmore`]) {
      let a: any, b: any;
      try { a = js.cleanConsentText(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanConsentText(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
    expect(js.cleanConsentText(` ${T} `)).toBe(T);
    expect(() => js.cleanConsentText('short')).toThrow('20 to 300');
  });
  it('gives the same plan in the build and in the dashboard', () => {
    expect(js.adLoaderPlan({ ...on, consentText: T })).toEqual(ts.adLoaderPlan({ ...on, consentText: T }));
    expect(js.adLoaderPlan(on)).toEqual(ts.adLoaderPlan(on));
  });
  it('reads, keeps and writes the text only when it is valid (empty stays out of the file)', () => {
    expect(js.readLoader(JSON.stringify({ consentText: T })).consentText).toBe(T);
    expect('consentText' in js.readLoader(JSON.stringify({ consentText: 'bad <' }))).toBe(false);
    expect('consentText' in js.readLoader('{}')).toBe(false);
    expect(js.configFromForm({ complianceMode: true, consentText: ` ${T} ` }).consentText).toBe(T);
    expect('consentText' in js.configFromForm({ complianceMode: true, consentText: '' })).toBe(false);
    expect(() => js.configFromForm({ complianceMode: true, consentText: 'tiny' })).toThrow('20 to 300');
  });
  it('says so in the plain sentence only when a text is set', () => {
    expect(js.describePlan({ ...on, consentText: T })).toContain('shows your own text');
    expect(js.describePlan(on)).not.toContain('your own text');
  });
});

describe('ad-loader-config consent button words (v0.31.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } };
  it('accepts and refuses the same words in the build and in the dashboard', () => {
    for (const v of [undefined, null, '', ' ', 'OK', 'Yes please', 'x', 'x'.repeat(24), 'x'.repeat(25), 'a<b', 'a\nb', '  Agree  ']) {
      let a: any, b: any;
      try { a = js.cleanConsentLabel(v); } catch { a = 'ERROR'; }
      try { b = ts.cleanConsentLabel(v); } catch { b = 'ERROR'; }
      expect(a).toBe(b);
    }
    expect(js.cleanConsentLabel('  Agree ')).toBe('Agree');
    expect(() => js.cleanConsentLabel('x')).toThrow('2 to 24');
  });
  it('gives the same plan in the build and in the dashboard', () => {
    const c = { ...on, consentAccept: 'Agree', consentDecline: 'Refuse' };
    expect(js.adLoaderPlan(c)).toEqual(ts.adLoaderPlan(c));
  });
  it('reads, keeps and writes only the valid words (empty ones stay out of the file)', () => {
    const r: any = js.readLoader(JSON.stringify({ consentAccept: 'Agree', consentDecline: '<', consentChoices: '' }));
    expect(r.consentAccept).toBe('Agree');
    expect('consentDecline' in r).toBe(false);
    expect('consentChoices' in r).toBe(false);
    expect('consentAccept' in js.readLoader('{}')).toBe(false);
    const f: any = js.configFromForm({ complianceMode: true, consentAccept: ' Agree ', consentChoices: 'Settings' });
    expect(f.consentAccept).toBe('Agree');
    expect(f.consentChoices).toBe('Settings');
    expect('consentDecline' in f).toBe(false);
    expect('consentAccept' in js.configFromForm({ complianceMode: true })).toBe(false);
    expect(() => js.configFromForm({ complianceMode: true, consentDecline: 'x' })).toThrow('2 to 24');
  });
  it('says so in the plain sentence only when a word is set', () => {
    expect(js.describePlan({ ...on, consentAccept: 'Agree' })).toContain('your own button words');
    expect(js.describePlan(on)).not.toContain('button words');
  });
});
