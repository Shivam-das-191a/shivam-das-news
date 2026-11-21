import { describe, it, expect } from 'vitest';
import { langTag, countries, parseDateline, detectLocations, placeLd } from '../../src/lib/geo-schema';
import { article, SITE_LANG, webSite, collectionPage, simplePage } from '../../src/lib/schema';

const gaz = [
  { name: 'Kolkata', type: 'City' as const, country: 'IN', aliases: ['Calcutta'] },
  { name: 'West Bengal', type: 'State' as const, country: 'IN' },
];
const names = (r: ReturnType<typeof detectLocations>) => r.contentLocation.map((p) => p.name);

describe('language', () => {
  it('turns a locale into a language tag', () => {
    expect(langTag('en_US')).toBe('en-US');
    expect(langTag('en_gb')).toBe('en-GB');
    expect(langTag('en-IN')).toBe('en-IN');
    expect(langTag('')).toBe('en');
    expect(langTag(undefined)).toBe('en');
    expect(langTag('<script>')).toBe('en');
  });
  it('every schema block uses the site language', () => {
    expect(SITE_LANG).toBe('en-US');
    const s = { siteName: 'S' };
    expect((webSite(s) as any).inLanguage).toBe(SITE_LANG);
    expect((collectionPage('n', '/c/', 'd', []) as any).inLanguage).toBe(SITE_LANG);
    expect((simplePage('WebPage', 'n', '/p/', 'd') as any).inLanguage).toBe(SITE_LANG);
  });
});

describe('countries from the runtime', () => {
  it('knows real countries and no fake regions', () => {
    const { byName, names: n } = countries();
    expect(n.get('IN')).toBe('India');
    expect(byName.get('USA')).toBe('US');
    expect(byName.get('UK')).toBe('GB');
    expect([...byName.keys()].some((k) => /unknown|European Union/i.test(k))).toBe(false);
  });
});

describe('dateline', () => {
  it('reads a city before a long dash', () => {
    expect(parseDateline('KOLKATA \u2014 Heavy rain hit the city.')).toBe('Kolkata');
    expect(parseDateline('**NEW DELHI**, Nov 16 (Reuters) \u2014 The court said')).toBe('New Delhi');
  });
  it('ignores shouted headlines and plain text', () => {
    expect(parseDateline('BREAKING - the market fell')).toBeUndefined();
    expect(parseDateline('BREAKING \u2014 the market fell')).toBeUndefined();
    expect(parseDateline('The rain was heavy \u2014 very heavy.')).toBeUndefined();
    expect(parseDateline('')).toBeUndefined();
  });
});

describe('detectLocations', () => {
  it('finds a country named in the title', () => {
    const r = detectLocations({ title: 'India wins the series', tags: [], body: 'Text.' });
    expect(names(r)).toEqual(['India']);
    expect(r.source).toBe('text');
  });
  it('one passing mention in the body is not enough', () => {
    expect(names(detectLocations({ title: 'A new phone launched', tags: [], body: 'It was made in Japan and sold widely.' }))).toEqual([]);
  });
  it('a tag plus one mention is enough', () => {
    expect(names(detectLocations({ title: 'A new phone launched', tags: ['Japan'], body: 'It was made in Japan.' }))).toEqual(['Japan']);
  });
  it('ambiguous names count only as a tag', () => {
    expect(names(detectLocations({ title: 'Jordan scores 30 points', tags: [], body: 'Jordan Jordan Jordan' }))).toEqual([]);
    expect(names(detectLocations({ title: 'Talks held', tags: ['Jordan'], body: 'Text.' }))).toEqual(['Jordan']);
  });
  it('whole words only', () => {
    expect(names(detectLocations({ title: 'Indiana storm hits', tags: [], body: 'Text.' }))).toEqual([]);
  });
  it('uses the owner list with aliases, and gives a city its country', () => {
    const r = detectLocations({ title: 'Calcutta metro opens a new line', tags: [], body: 'Text.' }, gaz);
    expect(r.contentLocation).toEqual([{ type: 'City', name: 'Kolkata', country: 'IN' }]);
    expect(placeLd(r.contentLocation[0])).toEqual({ '@type': 'City', name: 'Kolkata', address: { '@type': 'PostalAddress', addressCountry: 'IN' } });
  });
  it('a dateline sets locationCreated and also counts as a location', () => {
    const r = detectLocations({ title: 'Rain hits the region', tags: [], body: 'KOLKATA \u2014 Heavy rain hit the city.' }, gaz);
    expect(r.locationCreated?.name).toBe('Kolkata');
    expect(names(r)).toContain('Kolkata');
  });
  it('the front matter wins, up to 3 names, and "none" switches it off', () => {
    const m = detectLocations({ title: 'India wins', tags: [], body: 'Text.', location: ['Kolkata', 'France'] }, gaz);
    expect(m.source).toBe('manual');
    expect(names(m)).toEqual(['Kolkata', 'France']);
    expect(m.contentLocation[1].type).toBe('Country');
    expect(detectLocations({ title: 'India wins', tags: [], body: 'Text.', location: ['none'] }).contentLocation).toEqual([]);
    expect(names(detectLocations({ title: 'x', tags: [], body: '', location: ['Some Village'] }))).toEqual(['Some Village']);
  });
  it('at most 3 places, strongest first', () => {
    const r = detectLocations({ title: 'India, France, Japan and Brazil meet', tags: ['India'], body: 'Text.' });
    expect(r.contentLocation.length).toBe(3);
    expect(names(r)[0]).toBe('India');
  });
  it('bad owner list entries are ignored, never crash', () => {
    expect(() => detectLocations({ title: 'India', tags: [], body: '' }, [null, {}, { name: '' }, { name: 5 }] as any)).not.toThrow();
  });
  it('nothing found means nothing written', () => {
    const r = detectLocations({ title: 'A quiet day', tags: [], body: 'Nothing here.' });
    expect(r).toEqual({ contentLocation: [], locationCreated: undefined, source: 'none' });
  });
});

describe('article schema', () => {
  const site = { siteName: 'S' };
  const base = {
    type: 'NewsArticle' as const, title: 'A real headline', url: '/2026/11/13/blogs/a/b/', description: 'd', image: '/m.webp',
    published: new Date('2026-11-13T09:00:00Z'), modified: new Date('2026-11-13T10:00:00Z'),
    authorName: 'A', authorUrl: '/author/a/', section: 'S', keywords: [], wordCount: 1,
  };
  it('always has the language', () => expect((article(base, site) as any).inLanguage).toBe(SITE_LANG));
  it('writes no location when none was found', () => {
    const a: any = article({ ...base, locations: [] }, site);
    expect(a).not.toHaveProperty('contentLocation');
    expect(a).not.toHaveProperty('locationCreated');
  });
  it('one place is an object, many are a list, dateline is locationCreated', () => {
    const one: any = article({ ...base, locations: [{ type: 'Country', name: 'India', country: 'IN' }] }, site);
    expect(one.contentLocation).toEqual({ '@type': 'Country', name: 'India' });
    const many: any = article({ ...base, locations: [{ type: 'Country', name: 'India' }, { type: 'Country', name: 'France' }], createdAt: { type: 'Place', name: 'Kolkata' } }, site);
    expect(Array.isArray(many.contentLocation)).toBe(true);
    expect(many.locationCreated).toEqual({ '@type': 'Place', name: 'Kolkata' });
  });
});
