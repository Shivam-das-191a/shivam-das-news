import { describe, it, expect } from 'vitest';
import { readLinks, cleanLink, writeLinks, MAX_LINKS } from '../../public/admin/js/link-list.js';

describe('link-list', () => {
  it('reads a list and ignores bad files and bad rows', () => {
    expect(readLinks('[]')).toEqual([]);
    expect(readLinks('not json')).toEqual([]);
    expect(readLinks('{"a":1}')).toEqual([]);
    expect(readLinks('[{"keyword":" solar   power ","url":"/category/energy/"},{"keyword":5},null]')).toEqual([{ keyword: 'solar power', url: '/category/energy/' }]);
  });

  it('accepts a clean keyword and normalises the address', () => {
    expect(cleanLink('  solar   power ', '/category/energy', [])).toEqual({ keyword: 'solar power', url: '/category/energy/' });
    expect(cleanLink("Women's cup", 'https://news.test/tag/cricket/', [])).toEqual({ keyword: "Women's cup", url: '/tag/cricket/' });
  });

  it('rejects short keywords, odd characters, bad addresses and other sites', () => {
    expect(() => cleanLink('abc', '/x/', [])).toThrow('at least 4');
    expect(() => cleanLink('solar & wind', '/x/', [])).toThrow('letters, numbers');
    expect(() => cleanLink('ভারত খবর', '/x/', [])).toThrow('letters, numbers');
    expect(() => cleanLink('solar power', 'energy', [])).toThrow('not a usable address');
    expect(() => cleanLink('solar power', '//evil.test/x/', [])).toThrow('not a usable address');
    expect(() => cleanLink('solar power', '', [])).toThrow('not a usable address');
  });

  it('rejects a repeated keyword in any letter case, and a full list', () => {
    const cur = [{ keyword: 'Solar Power', url: '/a/' }];
    expect(() => cleanLink('solar power', '/b/', cur)).toThrow('already in the list');
    expect(() => cleanLink('wind farm', '/b/', Array.from({ length: MAX_LINKS }, (_, i) => ({ keyword: 'k' + i + 'xxxx', url: '/a/' })))).toThrow('full');
  });

  it('writes pretty JSON with a final newline that readLinks reads back', () => {
    const list = [{ keyword: 'solar power', url: '/category/energy/' }];
    const t = writeLinks(list);
    expect(t.endsWith('\n')).toBe(true);
    expect(readLinks(t)).toEqual(list);
  });
});
