import { describe, it, expect } from 'vitest';
import { mediaKey, mediaEntry, pictureAlt, pictureCaption } from '../../src/lib/media-alt';

const P = '/media/2026/11/city-hall.webp';
const map = { [P]: { alt: 'City hall at dawn', caption: 'The main hall.', credit: 'Staff photo' } };

describe('mediaKey', () => {
  it('keeps a local /media/ path and drops a query or hash', () => {
    expect(mediaKey(P)).toBe(P);
    expect(mediaKey(`${P}?v=2`)).toBe(P);
    expect(mediaKey(`${P}#x`)).toBe(P);
  });
  it('returns an empty key for outside addresses, other folders, empty values and "..".', () => {
    for (const v of ['https://cdn.test/media/a.webp', '/og-default.png', '', undefined, '/media/../secret.webp', 'media/a.webp'])
      expect(mediaKey(v as any)).toBe('');
  });
});

describe('mediaEntry', () => {
  it('reads the three fields and trims them', () => {
    expect(mediaEntry({ [P]: { alt: '  A   b ', caption: ' c ', credit: ' d ' } }, P)).toEqual({ alt: 'A b', caption: 'c', credit: 'd' });
  });
  it('ignores other keys, empty values and wrong types', () => {
    expect(mediaEntry({ [P]: { alt: '', caption: 5, credit: null, extra: 'x' } }, P)).toEqual({});
    expect(mediaEntry({ [P]: 'text' }, P)).toEqual({});
  });
  it('is safe with an empty, missing or odd map', () => {
    for (const m of [{}, undefined, null, [], 'x', 3]) expect(mediaEntry(m, P)).toEqual({});
  });
  it('does not read inherited keys', () => {
    expect(mediaEntry({}, '/media/constructor')).toEqual({});
    expect(mediaEntry(JSON.parse('{"__proto__":{"alt":"bad"}}'), '/media/x.webp')).toEqual({});
  });
  it('finds the entry when the post address has a query', () => {
    expect(mediaEntry(map, `${P}?w=800`).alt).toBe('City hall at dawn');
  });
});

describe('pictureAlt', () => {
  it('the post value wins', () => expect(pictureAlt(map, P, 'Post alt')).toBe('Post alt'));
  it('uses the stored alt when the post has none or only spaces', () => {
    expect(pictureAlt(map, P, undefined)).toBe('City hall at dawn');
    expect(pictureAlt(map, P, '   ')).toBe('City hall at dawn');
  });
  it('is an empty string when nothing is known', () => {
    expect(pictureAlt({}, P, '')).toBe('');
    expect(pictureAlt(map, 'https://cdn.test/a.webp', undefined)).toBe('');
  });
});

describe('pictureCaption', () => {
  it('gives the stored caption and credit', () => {
    expect(pictureCaption(map, P, '')).toEqual({ caption: 'The main hall.', credit: 'Staff photo' });
  });
  it('the post credit wins over the stored credit', () => {
    expect(pictureCaption(map, P, 'Agency')).toEqual({ caption: 'The main hall.', credit: 'Agency' });
  });
  it('keeps the old behaviour with an empty map: only the post credit', () => {
    expect(pictureCaption({}, P, 'Agency')).toEqual({ caption: '', credit: 'Agency' });
    expect(pictureCaption({}, P, '')).toEqual({ caption: '', credit: '' });
  });
});
