import { describe, it, expect } from 'vitest';
import { strictKey, looseKey, oldPathOf, matchTitles, mergeLifetime, checkEntries, bloggerSnippet, decodeEntities } from '../../src/lib/title-match.js';

const BLOG = 'shivam-das-news-usa';
const old = (title: string, path: string) => ({ title, url: `https://${BLOG}.blogspot.com${path}`, path });
const nu = (title: string, url: string, before: string[] = []) => ({ title, url, before });

describe('strictKey', () => {
  it('ignores entities, non-breaking spaces, extra spaces and Unicode form', () => {
    expect(strictKey('Tom &amp; Jerry&#39;s  big\u00A0day ')).toBe("Tom & Jerry's big day");
    expect(strictKey('Cafe\u0301')).toBe(strictKey('Caf\u00E9'));
  });
  it('decodes once only', () => { expect(decodeEntities('&amp;#39;')).toBe('&#39;'); });
  it('keeps case, punctuation and letters apart', () => {
    expect(strictKey('Big News')).not.toBe(strictKey('big news'));
    expect(strictKey('Big News.')).not.toBe(strictKey('Big News'));
    expect(strictKey('It\u2019s here')).not.toBe(strictKey("It's here"));
  });
  it('keeps Bengali joiners and marks', () => {
    expect(strictKey('\u09B0\u09CD\u200C\u09A8')).toContain('\u200C');
  });
});

describe('looseKey (reports only)', () => {
  it('joins case, quote style and punctuation', () => {
    expect(looseKey('It\u2019s HERE!')).toBe(looseKey("it's here"));
  });
  it('does not strip Bengali vowel signs', () => {
    expect(looseKey('\u0995\u09BF')).toBe('\u0995\u09BF');
  });
});

describe('oldPathOf', () => {
  it('accepts any country form and drops the query', () => {
    expect(oldPathOf(`http://${BLOG}.blogspot.com/2024/05/a-b.html?m=1`, BLOG)).toBe('/2024/05/a-b.html');
    expect(oldPathOf(`https://${BLOG}.blogspot.in/2024/05/a-b.html`, BLOG)).toBe('/2024/05/a-b.html');
    expect(oldPathOf(`https://${BLOG}.blogspot.co.uk/p/about.html`, BLOG)).toBe('/p/about.html');
  });
  it('refuses another blog, another shape, a lookalike host and junk', () => {
    expect(oldPathOf('https://other.blogspot.com/2024/05/a.html', BLOG)).toBeNull();
    expect(oldPathOf(`https://${BLOG}.blogspot.com/search/label/x`, BLOG)).toBeNull();
    expect(oldPathOf(`https://${BLOG}.blogspot.com.evil.site/2024/05/a.html`, BLOG)).toBeNull();
    expect(oldPathOf('not a url', BLOG)).toBeNull();
  });
});

describe('matchTitles', () => {
  it('pairs exact titles one to one', () => {
    const r = matchTitles([old('Rain hits Kolkata', '/2024/05/rain.html')], [nu('Rain hits Kolkata', '/2026/11/13/blogs/city/rain-kolkata/')]);
    expect(r.pairs).toHaveLength(1);
    expect(r.pairs[0]).toMatchObject({ from: '/2024/05/rain.html', to: '/2026/11/13/blogs/city/rain-kolkata/' });
  });
  it('pairs titles that differ only by entities or spaces', () => {
    const r = matchTitles([old('A &amp; B  news', '/2024/05/ab.html')], [nu('A & B news', '/2026/11/13/blogs/x/ab/')]);
    expect(r.pairs).toHaveLength(1);
  });
  it('never pairs a title that differs by one letter, case or mark; lists it as a near match', () => {
    const r = matchTitles([old('Big News', '/2024/05/a.html'), old('It\u2019s here', '/2024/05/b.html')], [nu('big news', '/2026/11/13/blogs/x/a/'), nu("It's here", '/2026/11/13/blogs/x/b/')]);
    expect(r.pairs).toHaveLength(0);
    expect(r.near).toHaveLength(2);
  });
  it('skips a title used twice on either side (ambiguous)', () => {
    const r = matchTitles(
      [old('Same', '/2024/05/s1.html'), old('Same', '/2024/06/s2.html'), old('Solo', '/2024/07/solo.html')],
      [nu('Same', '/2026/11/13/blogs/x/same/'), nu('Solo', '/2026/11/13/blogs/x/solo/'), nu('Solo', '/2026/11/14/blogs/x/solo-2/')]);
    expect(r.pairs).toHaveLength(0);
    expect(r.ambiguous).toHaveLength(2);
  });
  it('lists posts that exist on one side only and never redirects them', () => {
    const r = matchTitles([old('Only old', '/2024/05/o.html')], [nu('Only new', '/2026/11/13/blogs/x/n/')]);
    expect(r.pairs).toHaveLength(0);
    expect(r.onlyOld).toHaveLength(1);
    expect(r.onlyNew).toHaveLength(1);
  });
});

describe('mergeLifetime', () => {
  const pair = (to: string, history: string[] = []) => ({ from: '/2024/05/a.html', to, title: 'A', oldUrl: 'x', history });
  it('adds a new pair with the first-seen date', () => {
    const r = mergeLifetime([], [pair('/n1/')], '2026-11-15');
    expect(r.entries).toEqual([{ from: '/2024/05/a.html', to: '/n1/', title: 'A', since: '2026-11-15' }]);
  });
  it('keeps an entry whose pair is gone (old post deleted, title edited): lifetime', () => {
    const ex = [{ from: '/2024/05/a.html', to: '/n1/', title: 'A', since: '2026-11-15' }];
    expect(mergeLifetime(ex, [], '2026-12-01').entries).toEqual(ex);
  });
  it('follows the same post to its new address', () => {
    const ex = [{ from: '/2024/05/a.html', to: '/n1/', title: 'A', since: '2026-11-15' }];
    const r = mergeLifetime(ex, [pair('/n2/', ['/n1/'])], '2026-12-01');
    expect(r.entries[0].to).toBe('/n2/');
    expect(r.entries[0].since).toBe('2026-11-15');
    expect(r.moved).toHaveLength(1);
  });
  it('never repoints to a different post: reports a conflict', () => {
    const ex = [{ from: '/2024/05/a.html', to: '/n1/', title: 'A', since: '2026-11-15' }];
    const r = mergeLifetime(ex, [pair('/other/')], '2026-12-01');
    expect(r.entries[0].to).toBe('/n1/');
    expect(r.conflicts).toEqual([{ from: '/2024/05/a.html', kept: '/n1/', seen: '/other/' }]);
  });
  it('is stable: running twice gives the same list', () => {
    const a = mergeLifetime([], [pair('/n1/')], '2026-11-15');
    const b = mergeLifetime(a.entries, [pair('/n1/')], '2027-01-01');
    expect(b.entries).toEqual(a.entries);
    expect(b.added).toHaveLength(0);
  });
});

describe('checkEntries and bloggerSnippet', () => {
  it('rejects a target that is a full address, a protocol-relative one or has a placeholder', () => {
    const e = (to: string) => ({ from: '/2024/05/a.html', to, title: 'A', since: 'x' });
    expect(checkEntries([e('/ok/')])).toEqual([]);
    expect(checkEntries([e('https://evil.site/')])).toHaveLength(1);
    expect(checkEntries([e('//evil.site/')])).toHaveLength(1);
    expect(checkEntries([e('/a:b/')])).toHaveLength(1);
  });
  it('writes a map the Blogger theme can use and cannot be broken out of', () => {
    const s = bloggerSnippet([{ from: '/2024/05/a.html', to: '/n1/', title: '</script>', since: 'x' }], 'https://www.shivam-das.online/');
    expect(s).toContain('"/2024/05/a.html":"/n1/"');
    expect(s).toContain('https://www.shivam-das.online');
    expect(s).not.toContain('</script>"');
    expect(() => bloggerSnippet([], 'http://x.test')).toThrow();
  });
  it('the snippet really redirects (run in a fake page)', () => {
    const s = bloggerSnippet([{ from: '/2024/05/a.html', to: '/n1/', title: 'A', since: 'x' }], 'https://www.shivam-das.online');
    const code = s.replace('<script>', '').replace('</script>', '');
    const calls: string[] = [];
    new Function('location', code)({ pathname: '/2024/05/a.html', replace: (u: string) => calls.push(u) });
    new Function('location', code)({ pathname: '/2024/05/zzz.html', replace: (u: string) => calls.push(u) });
    expect(calls).toEqual(['https://www.shivam-das.online/n1/']);
  });
});
