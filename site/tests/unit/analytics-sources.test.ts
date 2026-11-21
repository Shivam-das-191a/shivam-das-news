import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS Worker code
import { sourceName, groupSources, statsPlan } from '../../../workers/analytics/lib.js';

describe('source names (v0.38.0)', () => {
  it('no referrer is Direct', () => {
    for (const h of ['', '   ', null, undefined]) expect(sourceName(h as any)).toBe('Direct');
  });
  it('Google in every country, and Google News apart', () => {
    for (const h of ['google.com', 'google.co.in', 'google.com.au', 'google.de', 'm.google.com', 'search.google.com']) expect(sourceName(h)).toBe('Google');
    expect(sourceName('news.google.com')).toBe('Google News');
  });
  it('lookalike hosts are not Google or Facebook', () => {
    for (const h of ['notgoogle.com', 'google.com.evil.com', 'evilfacebook.com', 'facebook.com.evil.org', 'x.com.evil.org']) expect(sourceName(h)).toBe(h);
  });
  it('social and search sites', () => {
    const t: Record<string, string> = {
      'facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'lm.facebook.com': 'Facebook', 'fb.me': 'Facebook',
      'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram',
      'x.com': 'X', 't.co': 'X', 'twitter.com': 'X', 'mobile.twitter.com': 'X',
      'wa.me': 'WhatsApp', 'web.whatsapp.com': 'WhatsApp',
      't.me': 'Telegram', 'web.telegram.org': 'Telegram',
      'youtube.com': 'YouTube', 'm.youtube.com': 'YouTube', 'youtu.be': 'YouTube',
      'reddit.com': 'Reddit', 'old.reddit.com': 'Reddit', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn', 'pinterest.com': 'Pinterest',
      'bing.com': 'Bing', 'duckduckgo.com': 'DuckDuckGo', 'search.yahoo.com': 'Yahoo', 'yandex.ru': 'Yandex', 'baidu.com': 'Baidu', 'ecosia.org': 'Ecosia',
    };
    for (const [h, n] of Object.entries(t)) expect(sourceName(h), h).toBe(n);
  });
  it('an unknown host stays as it is, in lower case', () => {
    expect(sourceName('example.org')).toBe('example.org');
    expect(sourceName('Blog.Example.ORG')).toBe('blog.example.org');
  });
});

describe('groupSources', () => {
  it('adds hosts with the same name, keeps direct, sorts by views then name', () => {
    const out = groupSources([
      { k: 'google.com', views: 3, read_seconds: 30 },
      { k: 'google.co.in', views: 2, read_seconds: 70 },
      { k: '', views: 5, read_seconds: 50 },
      { k: 't.co', views: 1, read_seconds: 10 },
      { k: 'twitter.com', views: 1, read_seconds: 20 },
      { k: 'a.example.org', views: 1, read_seconds: 0 },
    ]);
    expect(out).toEqual([
      { key: 'Direct', views: 5, avgRead: 10 },
      { key: 'Google', views: 5, avgRead: 20 },
      { key: 'X', views: 2, avgRead: 15 },
      { key: 'a.example.org', views: 1, avgRead: 0 },
    ]);
  });
  it('keeps only the top 10 names', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ k: `site${String(i).padStart(2, '0')}.org`, views: 100 - i, read_seconds: 0 }));
    const out = groupSources(rows);
    expect(out).toHaveLength(10);
    expect(out[0].key).toBe('site00.org');
    expect(out[9].key).toBe('site09.org');
  });
  it('bad or empty input gives an empty list, bad numbers count as zero', () => {
    expect(groupSources(null as any)).toEqual([]);
    expect(groupSources([])).toEqual([]);
    expect(groupSources([{ k: 'bing.com', views: 'x', read_seconds: null }])).toEqual([{ key: 'Bing', views: 0, avgRead: 0 }]);
  });
});

describe('sources query', () => {
  it('does not drop direct visits and has numbers only in the values', () => {
    for (const r of ['5m', '1h', '24h', '7d', 'life']) {
      const q = (statsPlan(r, 1_700_000_000) as any).sources;
      expect(q.sql).not.toMatch(/!= ''/);
      expect(q.sql).toMatch(/LIMIT 200$/);
      expect(q.values.every((v: unknown) => typeof v === 'number')).toBe(true);
    }
  });
});
