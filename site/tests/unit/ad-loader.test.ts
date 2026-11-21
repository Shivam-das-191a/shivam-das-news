import { describe, it, expect } from 'vitest';
import { adLoaderPlan, cleanHttpsUrl, cleanContainerId, cleanAfterParagraph, cleanAdsenseSlot, cleanConsentText, cleanConsentLabel } from '../../src/lib/ad-loader';

const GEO = 'https://news-geo.test.workers.dev/geo';
const POP = 'https://ads.example-network.test/pop.js';
const BAR = 'https://ads.example-network.test/bar.js';
const NAT = 'https://ads.example-network.test/native.js';

describe('ad loader settings', () => {
  it('adds nothing with the default file (compliance mode, empty values)', () => {
    expect(adLoaderPlan({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '' } })).toBeNull();
    expect(adLoaderPlan({})).toBeNull();
  });

  it('stays off in compliance mode even when scripts are filled in (BUGS A6)', () => {
    expect(adLoaderPlan({ complianceMode: true, geoUrl: GEO, adsterra: { popunder: POP } })).toBeNull();
    expect(adLoaderPlan({ geoUrl: GEO, adsterra: { popunder: POP } })).toBeNull();
  });

  it('is off when compliance mode is off but no script is set', () => {
    expect(adLoaderPlan({ complianceMode: false, geoUrl: GEO })).toBeNull();
  });

  it('gives a plan only when compliance mode is explicitly false and a script and the geo address exist', () => {
    const p = adLoaderPlan({ complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP, socialBar: BAR } });
    expect(p).toEqual({ geoUrl: GEO, popunder: POP, socialBar: BAR, nativeBanner: null, smartlink: '', adsense: null, consentDays: 180, timeoutMs: 3000, idleMs: 4000 });
    expect(adLoaderPlan({ complianceMode: false, geoUrl: GEO, adsterra: { socialBar: BAR } })?.popunder).toBe('');
  });

  it('refuses a script without the country check (BUGS A1)', () => {
    expect(() => adLoaderPlan({ complianceMode: false, adsterra: { popunder: POP } })).toThrow('geoUrl is empty');
  });

  it('refuses bad addresses with a plain message, also in compliance mode', () => {
    for (const bad of ['http://a.test/x.js', 'ftp://a.test/x', 'a.test/x.js', 'https://localhost/x', 'https://a.test/x y.js', 'https://a.test/"x', 'https://u:p@a.test/x.js', 'javascript:alert(1)'])
      expect(() => cleanHttpsUrl(bad, 'x')).toThrow('not valid');
    expect(() => adLoaderPlan({ complianceMode: true, geoUrl: 'http://a.test/geo' })).toThrow('geoUrl');
  });

  it('cleans an address and treats empty as empty', () => {
    expect(cleanHttpsUrl('  ', 'x')).toBe('');
    expect(cleanHttpsUrl(undefined, 'x')).toBe('');
    expect(cleanHttpsUrl(' https://a.test/geo ', 'x')).toBe('https://a.test/geo');
  });
});

describe('native banner settings (v0.22.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO };

  it('is off when the native banner is empty, whatever else is set', () => {
    expect(adLoaderPlan({ ...on, adsterra: { nativeBanner: { script: '', containerId: '', afterParagraph: 3 } } })).toBeNull();
    expect(adLoaderPlan({ ...on, adsterra: { popunder: POP, nativeBanner: {} } })?.nativeBanner).toBeNull();
  });

  it('gives the native banner in the plan, with 3 as the default paragraph', () => {
    const p = adLoaderPlan({ ...on, adsterra: { nativeBanner: { script: NAT, containerId: 'container-1a2b3c' } } });
    expect(p?.nativeBanner).toEqual({ script: NAT, containerId: 'container-1a2b3c', afterParagraph: 3 });
    expect(adLoaderPlan({ ...on, adsterra: { nativeBanner: { script: NAT, containerId: 'box', afterParagraph: '5' } } })?.nativeBanner?.afterParagraph).toBe(5);
  });

  it('stays off in compliance mode (BUGS A6), and refuses a native banner without the country check (BUGS A1)', () => {
    expect(adLoaderPlan({ complianceMode: true, geoUrl: GEO, adsterra: { nativeBanner: { script: NAT, containerId: 'box' } } })).toBeNull();
    expect(() => adLoaderPlan({ complianceMode: false, adsterra: { nativeBanner: { script: NAT, containerId: 'box' } } })).toThrow('geoUrl is empty');
  });

  it('needs the script and the container id together, also in compliance mode', () => {
    expect(() => adLoaderPlan({ complianceMode: true, adsterra: { nativeBanner: { script: NAT } } })).toThrow('needs both');
    expect(() => adLoaderPlan({ ...on, adsterra: { nativeBanner: { containerId: 'box' } } })).toThrow('needs both');
  });

  it('refuses unsafe container ids and bad paragraph numbers with a plain message', () => {
    for (const bad of ['1abc', 'a b', 'a\"b', 'a<b', '-a', 'a'.repeat(81), 'a.b', "a'b"]) expect(() => cleanContainerId(bad)).toThrow('not valid');
    for (const good of ['', ' ', 'container-1a2b3c', 'A_b-9']) expect(() => cleanContainerId(good)).not.toThrow();
    for (const bad of ['0', '21', '2.5', 'x', '-1', '1e1x']) expect(() => cleanAfterParagraph(bad)).toThrow('whole number from 1 to 20');
    expect([cleanAfterParagraph(undefined), cleanAfterParagraph(''), cleanAfterParagraph(' 7 '), cleanAfterParagraph(20), cleanAfterParagraph(1)]).toEqual([3, 3, 7, 20, 1]);
  });

  it('refuses a native script that is not a clean https address', () => {
    expect(() => adLoaderPlan({ ...on, adsterra: { nativeBanner: { script: 'http://a.test/n.js', containerId: 'box' } } })).toThrow('not valid');
  });
});

describe('smartlink settings (v0.23.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO };
  const SMART = 'https://ads.example-network.test/smart-abc';

  it('is empty by default and does not make a plan alone in compliance mode (BUGS A6)', () => {
    expect(adLoaderPlan({ ...on, adsterra: { popunder: POP } })?.smartlink).toBe('');
    expect(adLoaderPlan({ complianceMode: true, geoUrl: GEO, adsterra: { smartlink: SMART } })).toBeNull();
  });

  it('gives a plan with only the smartlink, and keeps the other formats off', () => {
    const p = adLoaderPlan({ ...on, adsterra: { smartlink: ` ${SMART} ` } });
    expect(p).toEqual({ geoUrl: GEO, popunder: '', socialBar: '', nativeBanner: null, smartlink: SMART, adsense: null, consentDays: 180, timeoutMs: 3000, idleMs: 4000 });
  });

  it('refuses a smartlink without the country check (BUGS A1) and a bad address', () => {
    expect(() => adLoaderPlan({ complianceMode: false, adsterra: { smartlink: SMART } })).toThrow('geoUrl is empty');
    for (const bad of ['http://a.test/s', 'a.test/s', 'javascript:alert(1)', 'https://a.test/s x', 'https://u:p@a.test/s'])
      expect(() => adLoaderPlan({ ...on, adsterra: { smartlink: bad } })).toThrow('adsterra.smartlink');
  });
});


describe('AdSense unit settings (v0.24.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO };
  const PUB = 'ca-pub-1234567890123456';

  it('is empty by default: no slot means no unit, with or without a publisher id', () => {
    expect(adLoaderPlan({ ...on, adsterra: { popunder: POP } })?.adsense).toBeNull();
    expect(adLoaderPlan({ ...on, adsterra: { popunder: POP }, adsense: { slot: '', afterParagraph: 5 } }, PUB)?.adsense).toBeNull();
    expect(adLoaderPlan({ ...on, adsense: { slot: '' } }, PUB)).toBeNull();
  });

  it('gives the unit in the plan: ca-pub id from ads.json, the slot, and 5 as the default paragraph', () => {
    expect(adLoaderPlan({ ...on, adsense: { slot: ' 1234567890 ' } }, PUB)).toEqual({ geoUrl: GEO, popunder: '', socialBar: '', nativeBanner: null, smartlink: '', adsense: { client: PUB, slot: '1234567890', afterParagraph: 5 }, consentDays: 180, timeoutMs: 3000, idleMs: 4000 });
    expect(adLoaderPlan({ ...on, adsense: { slot: '1234567890', afterParagraph: '8' } }, 'pub-1234567890123456')?.adsense).toEqual({ client: PUB, slot: '1234567890', afterParagraph: 8 });
  });

  it('stays off in compliance mode (BUGS A6) and refuses a unit without the country check (BUGS A1)', () => {
    expect(adLoaderPlan({ complianceMode: true, geoUrl: GEO, adsense: { slot: '1234567890' } }, PUB)).toBeNull();
    expect(adLoaderPlan({ geoUrl: GEO, adsense: { slot: '1234567890' } }, PUB)).toBeNull();
    expect(() => adLoaderPlan({ complianceMode: false, adsense: { slot: '1234567890' } }, PUB)).toThrow('geoUrl is empty');
  });

  it('refuses a slot without the AdSense id in ads.json, also in compliance mode', () => {
    expect(() => adLoaderPlan({ complianceMode: true, adsense: { slot: '1234567890' } })).toThrow('no adsensePublisherId');
    expect(() => adLoaderPlan({ ...on, adsense: { slot: '1234567890' } }, '')).toThrow('no adsensePublisherId');
    expect(() => adLoaderPlan({ ...on, adsense: { slot: '1234567890' } }, 'not-an-id')).toThrow('not valid');
  });

  it('refuses a bad slot and a bad paragraph number with a plain message', () => {
    for (const bad of ['12345', 'abc', '12 34 56 78', '123456789012345678901', '12345678a0', '-1234567', '1234567.8']) expect(() => cleanAdsenseSlot(bad)).toThrow('not valid');
    for (const good of ['', ' ', '123456', '1234567890', '12345678901234567890']) expect(() => cleanAdsenseSlot(good)).not.toThrow();
    expect(() => adLoaderPlan({ ...on, adsense: { slot: '1234567890', afterParagraph: 0 } }, PUB)).toThrow('adsense.afterParagraph');
    expect(() => adLoaderPlan({ ...on, adsense: { slot: '1234567890', afterParagraph: 21 } }, PUB)).toThrow('whole number from 1 to 20');
    expect([cleanAfterParagraph(undefined, 5), cleanAfterParagraph('', 5), cleanAfterParagraph(' 7 ', 5)]).toEqual([5, 5, 7]);
  });

  it('refuses the same paragraph number for the native banner and the AdSense unit', () => {
    const nb = { script: NAT, containerId: 'box', afterParagraph: 5 };
    expect(() => adLoaderPlan({ ...on, adsterra: { nativeBanner: nb }, adsense: { slot: '1234567890', afterParagraph: 5 } }, PUB)).toThrow('same paragraph number');
    expect(() => adLoaderPlan({ ...on, adsterra: { nativeBanner: { ...nb, afterParagraph: 3 } }, adsense: { slot: '1234567890' } }, PUB)).not.toThrow();
  });
});

describe('consent days (v0.28.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } };
  it('is 180 when empty, and goes into the plan as a number from 30 to 365', () => {
    expect(adLoaderPlan(on)?.consentDays).toBe(180);
    expect(adLoaderPlan({ ...on, consentDays: '' })?.consentDays).toBe(180);
    expect(adLoaderPlan({ ...on, consentDays: 30 })?.consentDays).toBe(30);
    expect(adLoaderPlan({ ...on, consentDays: ' 365 ' })?.consentDays).toBe(365);
  });
  it('refuses a bad number with a plain message, also in compliance mode', () => {
    for (const v of [29, 366, 0, -3, 45.5, 'abc']) {
      expect(() => adLoaderPlan({ ...on, consentDays: v })).toThrow('whole number from 30 to 365');
      expect(() => adLoaderPlan({ complianceMode: true, consentDays: v })).toThrow('consentDays');
    }
  });
  it('is in the shipped file as 180', async () => {
    const shipped = JSON.parse((await import('node:fs')).readFileSync('config/ad-loader.json', 'utf8'));
    expect(shipped.consentDays).toBe(180);
  });
});

describe('consent text (v0.30.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } };
  const T = 'We show ads from partners next to this article. Please choose.';
  it('is empty by default and is then left out of the plan', () => {
    expect(cleanConsentText(undefined)).toBe('');
    expect(cleanConsentText('  ')).toBe('');
    expect('consentText' in (adLoaderPlan(on) as object)).toBe(false);
  });
  it('goes into the plan, trimmed, when it is 20 to 300 characters', () => {
    expect(adLoaderPlan({ ...on, consentText: `  ${T} ` })?.consentText).toBe(T);
    expect(cleanConsentText('x'.repeat(20))).toHaveLength(20);
    expect(cleanConsentText('x'.repeat(300))).toHaveLength(300);
  });
  it('refuses a bad text with a plain message, also in compliance mode', () => {
    for (const v of ['short', 'x'.repeat(301), `${T} <b>`, `${T}\nsecond line`]) {
      expect(() => adLoaderPlan({ ...on, consentText: v })).toThrow('consentText');
      expect(() => adLoaderPlan({ complianceMode: true, consentText: v })).toThrow('consentText');
    }
  });
  it('is in the shipped file as an empty text', async () => {
    const shipped = JSON.parse((await import('node:fs')).readFileSync('config/ad-loader.json', 'utf8'));
    expect(shipped.consentText).toBe('');
  });
});

describe('consent button words (v0.31.0)', () => {
  const on = { complianceMode: false, geoUrl: GEO, adsterra: { popunder: POP } };
  it('are empty by default and are then left out of the plan', () => {
    expect(cleanConsentLabel(undefined)).toBe('');
    expect(cleanConsentLabel(' ')).toBe('');
    const p = adLoaderPlan(on) as object;
    for (const k of ['consentAccept', 'consentDecline', 'consentChoices']) expect(k in p).toBe(false);
  });
  it('go into the plan, trimmed, when they are 2 to 24 characters', () => {
    const p = adLoaderPlan({ ...on, consentAccept: ' Agree ', consentDecline: 'Refuse' });
    expect(p?.consentAccept).toBe('Agree');
    expect(p?.consentDecline).toBe('Refuse');
    expect(p && 'consentChoices' in p).toBe(false);
    expect(cleanConsentLabel('x'.repeat(2))).toHaveLength(2);
    expect(cleanConsentLabel('x'.repeat(24))).toHaveLength(24);
  });
  it('are refused with a plain message that names the setting, also in compliance mode', () => {
    for (const [key, v] of [['consentAccept', 'x'], ['consentDecline', 'x'.repeat(25)], ['consentChoices', 'a<b'], ['consentAccept', 'a\nb']]) {
      expect(() => adLoaderPlan({ ...on, [key]: v })).toThrow(key);
      expect(() => adLoaderPlan({ complianceMode: true, [key]: v })).toThrow(key);
    }
  });
  it('are in the shipped file as empty words', async () => {
    const shipped = JSON.parse((await import('node:fs')).readFileSync('config/ad-loader.json', 'utf8'));
    expect([shipped.consentAccept, shipped.consentDecline, shipped.consentChoices]).toEqual(['', '', '']);
  });
});
