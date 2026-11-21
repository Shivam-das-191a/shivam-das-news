import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker code
import { cleanId, cleanCountry, isBot, deviceOf, browserOf, cleanPath, referrerHost, cleanTimeZone, cleanInt, parseBody, cleanBeacon, eventValues, UPSERT_SQL, MAX_BODY, MAX_READ_SECONDS } from '../../../workers/analytics/lib.js';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const msg = { sid: 'abcd1234efgh', pv: 'pv-0001-xyz', path: '/2026/11/13/blogs/world/a-story/', tz: 'Asia/Kolkata', ref: 'https://www.google.com/', read: 42, scroll: 80 };
const ctx = { userAgent: CHROME, country: 'us', siteHost: 'news.test', now: 1_700_000_123_456 };

describe('analytics: bots, devices, browsers (BUGS N2)', () => {
  it('treats crawlers, tools and empty user agents as bots', () => {
    for (const ua of [GOOGLEBOT, 'curl/8.4.0', 'python-requests/2.31', 'Mozilla/5.0 HeadlessChrome/120', 'Lighthouse', '', undefined, null, 'x', 'okhttp/4.12.0', 'Mozilla/5.0 (compatible; bingbot/2.0)']) expect(isBot(ua)).toBe(true);
  });
  it('keeps real browsers', () => {
    for (const ua of [CHROME, IPHONE, ANDROID_PHONE, ANDROID_TABLET, SAMSUNG, EDGE, FIREFOX]) expect(isBot(ua)).toBe(false);
  });
  it('tells mobile, tablet and desktop apart', () => {
    expect(deviceOf(CHROME)).toBe('desktop');
    expect(deviceOf(IPHONE)).toBe('mobile');
    expect(deviceOf(ANDROID_PHONE)).toBe('mobile');
    expect(deviceOf(ANDROID_TABLET)).toBe('tablet');
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablet');
    expect(deviceOf('')).toBe('desktop');
  });
  it('names the browser, with Edge and Samsung Internet before Chrome', () => {
    expect(browserOf(CHROME)).toBe('Chrome');
    expect(browserOf(EDGE)).toBe('Edge');
    expect(browserOf(SAMSUNG)).toBe('Samsung Internet');
    expect(browserOf(FIREFOX)).toBe('Firefox');
    expect(browserOf(IPHONE)).toBe('Safari');
    expect(browserOf('Mozilla/5.0 (Linux; Android 9) UCBrowser/13.4 Mobile Safari/537.36')).toBe('UC Browser');
    expect(browserOf('Mozilla/5.0 OPR/115.0 Chrome/130')).toBe('Opera');
    expect(browserOf('something odd')).toBe('Other');
  });
});

describe('analytics: cleaning single values', () => {
  it('accepts ids of 8 to 64 safe characters only', () => {
    expect(cleanId('abcd1234')).toBe('abcd1234');
    expect(cleanId('a'.repeat(64))).toHaveLength(64);
    for (const v of ['short', 'a'.repeat(65), 'has space 123', 'bad/slash1', '', undefined, null, 12345678]) expect(cleanId(v)).toBe(v === 12345678 ? '12345678' : '');
  });
  it('takes two letters as a country, and unknown or Tor as nothing', () => {
    expect(cleanCountry('us')).toBe('US');
    for (const v of ['XX', 'T1', 'USA', '', undefined, 'U', '1a']) expect(cleanCountry(v)).toBe('');
  });
  it('keeps the path only: no query, no hash, no unsafe text', () => {
    expect(cleanPath('/a/b/?utm=1#top')).toBe('/a/b/');
    expect(cleanPath('/')).toBe('/');
    for (const v of ['a/b', '//evil.test/x', '/a b', '/a"b', '/<x>', '/' + 'a'.repeat(300), '', undefined, 'https://x.test/a']) expect(cleanPath(v)).toBe('');
  });
  it('turns a referrer into a host, and the site itself or a bad value into nothing', () => {
    expect(referrerHost('https://www.google.com/search?q=x', 'news.test')).toBe('google.com');
    expect(referrerHost('http://T.CO/abc', 'news.test')).toBe('t.co');
    expect(referrerHost('https://news.test/other/', 'news.test')).toBe('');
    expect(referrerHost('https://www.news.test/', 'news.test')).toBe('');
    for (const v of ['', undefined, 'not a url', 'android-app://com.google.android.googlequicksearchbox', 'javascript:alert(1)', 'https://localhost/x']) expect(referrerHost(v, 'news.test')).toBe('');
  });
  it('takes time zone names only', () => {
    for (const v of ['Asia/Kolkata', 'UTC', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5']) expect(cleanTimeZone(v)).toBe(v);
    for (const v of ['', 'x y', '<b>', 'a'.repeat(41), '/Asia', undefined, '1/2']) expect(cleanTimeZone(v)).toBe('');
  });
  it('clamps numbers and turns junk into the lowest value', () => {
    expect(cleanInt(42.9, 0, 100)).toBe(42);
    expect(cleanInt(-5, 0, 100)).toBe(0);
    expect(cleanInt(5000, 0, 100)).toBe(100);
    for (const v of ['abc', undefined, null, NaN, Infinity]) expect(cleanInt(v, 0, 100)).toBe(0);
    expect(cleanInt('7', 0, 100)).toBe(7);
  });
  it('reads the body only when it is small JSON object text', () => {
    expect(parseBody('{"a":1}')).toEqual({ a: 1 });
    for (const v of ['', 'nope', '[1]', '"x"', 'null', undefined, '{"a":"' + 'x'.repeat(MAX_BODY) + '"}']) expect(parseBody(v)).toBeNull();
  });
});

describe('analytics: one checked event', () => {
  it('builds the event from the message and the edge, with the Worker clock in seconds', () => {
    const r = cleanBeacon(msg, ctx);
    expect(r).toEqual({ ok: true, event: { ts: 1_700_000_123, session_id: 'abcd1234efgh', pv_id: 'pv-0001-xyz', url: '/2026/11/13/blogs/world/a-story/', country: 'US', tz: 'Asia/Kolkata', referrer_host: 'google.com', device: 'desktop', browser: 'Chrome', read_seconds: 42, scroll_pct: 80, acted: 0, webdriver: 0, dc: 0 } });
  });
  it('ignores a time sent by the browser (BUGS N3)', () => {
    const r: any = cleanBeacon({ ...msg, ts: 5, now: 5 }, ctx);
    expect(r.event.ts).toBe(1_700_000_123);
  });
  it('caps read time and scroll depth (BUGS N4)', () => {
    const r: any = cleanBeacon({ ...msg, read: 999999, scroll: 250 }, ctx);
    expect(r.event.read_seconds).toBe(MAX_READ_SECONDS);
    expect(r.event.scroll_pct).toBe(100);
    const z: any = cleanBeacon({ ...msg, read: -3, scroll: 'x' }, ctx);
    expect(z.event.read_seconds).toBe(0);
    expect(z.event.scroll_pct).toBe(0);
  });
  it('refuses bots first, then a bad body, bad ids and a bad path', () => {
    expect(cleanBeacon(msg, { ...ctx, userAgent: GOOGLEBOT })).toEqual({ ok: false, reason: 'bot' });
    expect(cleanBeacon(msg, { ...ctx, userAgent: '' })).toEqual({ ok: false, reason: 'bot' });
    for (const b of [null, undefined, 'x', [1]]) expect(cleanBeacon(b, ctx)).toEqual({ ok: false, reason: 'bad-body' });
    expect(cleanBeacon({ ...msg, sid: 'x' }, ctx)).toEqual({ ok: false, reason: 'bad-id' });
    expect(cleanBeacon({ ...msg, pv: undefined }, ctx)).toEqual({ ok: false, reason: 'bad-id' });
    expect(cleanBeacon({ ...msg, path: 'https://x.test/' }, ctx)).toEqual({ ok: false, reason: 'bad-path' });
  });
  it('keeps a missing country, time zone and referrer as empty text', () => {
    const r: any = cleanBeacon({ sid: msg.sid, pv: msg.pv, path: '/' }, { userAgent: IPHONE, now: 1000 });
    expect(r.event).toEqual({ ts: 1, session_id: msg.sid, pv_id: msg.pv, url: '/', country: '', tz: '', referrer_host: '', device: 'mobile', browser: 'Safari', read_seconds: 0, scroll_pct: 0, acted: 0, webdriver: 0, dc: 0 });
  });
  it('never carries the user agent text or an IP address', () => {
    const r: any = cleanBeacon({ ...msg, ip: '1.2.3.4', ua: 'x' }, ctx);
    expect(Object.keys(r.event).sort()).toEqual(['acted', 'browser', 'country', 'dc', 'device', 'pv_id', 'read_seconds', 'referrer_host', 'scroll_pct', 'session_id', 'ts', 'tz', 'url', 'webdriver']);
  });
});

describe('analytics: the D1 files', () => {
  const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');
  it('the schema has the events table and both rollup tables, and can run twice', () => {
    for (const t of ['events', 'rollup_hourly', 'rollup_daily']) expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${t} `);
    expect(schema).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(schema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS events_page_view ON events (session_id, pv_id)');
  });
  it('the schema has no column for an IP address or a user agent text', () => {
    expect(schema).not.toMatch(/\n\s+(ip|ip_address|user_agent|ua)\s/i);
  });
  it('the upsert has as many places as the event has values, and updates the same page view (BUGS N1)', () => {
    const e = (cleanBeacon(msg, ctx) as any).event;
    const places = UPSERT_SQL.match(/\?\d+/g) ?? [];
    expect(new Set(places).size).toBe(eventValues(e).length);
    expect(UPSERT_SQL).toContain('ON CONFLICT (session_id, pv_id) DO UPDATE');
    expect(eventValues(e)).toHaveLength(14);
  });
});

describe('analytics: the acted and webdriver flags (v0.76.0)', () => {
  it('only the number 1 counts; missing, text, true, 2 and negative numbers are 0', () => {
    const ev = (extra: object) => (cleanBeacon({ ...msg, ...extra }, ctx) as any).event;
    expect([ev({}).acted, ev({}).webdriver]).toEqual([0, 0]);
    expect([ev({ acted: 1, webdriver: 1 }).acted, ev({ acted: 1, webdriver: 1 }).webdriver]).toEqual([1, 1]);
    for (const bad of ['1', true, 2, -1, 0.5, null, [1]]) {
      expect(ev({ acted: bad, webdriver: bad }).acted).toBe(0);
      expect(ev({ acted: bad, webdriver: bad }).webdriver).toBe(0);
    }
  });
  it('eventValues puts the two flags before dc and accepts an event made before v0.76.0 (no flags: 0 and 0)', () => {
    const e = (cleanBeacon({ ...msg, acted: 1 }, ctx) as any).event;
    expect(eventValues(e).slice(-3, -1)).toEqual([1, 0]);
    const old: any = { ...e };
    delete old.acted;
    delete old.webdriver;
    expect(eventValues(old).slice(-3, -1)).toEqual([0, 0]);
  });
  it('the upsert only raises the flags (MAX), so a later message cannot take an action back', () => {
    expect(UPSERT_SQL).toContain('acted = MAX(acted, excluded.acted)');
    expect(UPSERT_SQL).toContain('webdriver = MAX(webdriver, excluded.webdriver)');
  });
});
