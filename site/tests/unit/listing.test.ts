import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS module served to the browser
import * as L from '../../public/admin/js/listing.js';
import { truncate } from '../../src/lib/seo';
import { slugify } from '../../src/lib/slug';
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

const ctx = { siteName: 'Shivam Das News', origin: 'https://example.test/', timeZone: 'Asia/Kolkata' };
const base = { title: 'New phone launched in India today', permalink: '', metaTitle: '', description: '', category: 'technology', date: '2026-11-13T09:30:00Z', body: '', status: 'draft' };
const x = (n: number) => 'a'.repeat(n);

describe('listing: the cut matches the real page head', () => {
  it('cut() equals truncate() of src/lib/seo.ts for many texts and lengths', () => {
    const texts = ['short', 'one two three four five six seven eight nine ten', 'word '.repeat(80), 'x'.repeat(200), 'a, b; c. d - e ' + 'word '.repeat(30), '  spaced   out   text  '];
    for (const t of texts) for (const m of [20, 60, 155, 160]) expect(L.cut(t, m)).toBe(truncate(t, m));
  });
  it('handle fallback equals slugify() of src/lib/slug.ts', () => {
    for (const t of ['New phone launched in India today', 'The Cafe of A Stop', 'Caf\u00e9 \u2013 big news!!']) expect(L.autoHandle({ title: t, permalink: '' })).toBe(slugify(t));
  });
});

describe('listing: fallbacks', () => {
  it('title falls back to the headline plus the site name, and metaTitle wins', () => {
    expect(L.listing(base, ctx).title).toBe('New phone launched in India today | Shivam Das News');
    expect(L.listing(base, ctx).auto.title).toBe(true);
    const own = L.listing({ ...base, metaTitle: 'My own title' }, ctx);
    expect(own.title).toBe('My own title');
    expect(own.auto.title).toBe(false);
  });
  it('description falls back to the first plain paragraph, cut to 155 at a word end', () => {
    const body = '## Heading\n\n' + 'The **first** [paragraph](/a/) has many words. '.repeat(12) + '\n\nSecond paragraph.';
    const l = L.listing({ ...base, body }, ctx);
    expect(l.auto.description).toBe(true);
    expect(l.description.length).toBeLessThanOrEqual(155);
    expect(l.description.endsWith('\u2026')).toBe(true);
    expect(l.description).not.toMatch(/[*#\[\]]/);
    expect(l.description.startsWith('The first paragraph')).toBe(true);
  });
  it('a summary is used before the body, and an own description wins', () => {
    expect(L.listing({ ...base, summary: 'From the summary.', body: 'From the body.' }, ctx).description).toBe('From the summary.');
    const own = L.listing({ ...base, description: 'Typed by the owner.', body: 'From the body.' }, ctx);
    expect(own.description).toBe('Typed by the owner.');
    expect(own.auto.description).toBe(false);
  });
  it('a short paragraph is not cut and gets no ellipsis', () => {
    expect(L.listing({ ...base, body: 'Only this.' }, ctx).description).toBe('Only this.');
  });
  it('handle is the permalink, or the slug of the headline', () => {
    expect(L.listing(base, ctx).handle).toBe('new-phone-launched-india-today');
    expect(L.listing(base, ctx).auto.handle).toBe(true);
    const own = L.listing({ ...base, permalink: 'my-handle' }, ctx);
    expect(own.handle).toBe('my-handle');
    expect(own.auto.handle).toBe(false);
  });
  it('the address uses the origin without a trailing slash and the site time zone date', () => {
    expect(L.listing({ ...base, permalink: 'p' }, ctx).url).toBe('https://example.test/2026/11/13/blogs/technology/p/');
    expect(L.listing({ ...base, permalink: 'p', date: '2026-11-13T20:00:00Z' }, ctx).url).toBe('https://example.test/2026/11/14/blogs/technology/p/');
  });
  it('shown values are cut to 60 and 160 for the preview', () => {
    const l = L.listing({ ...base, metaTitle: 'word '.repeat(30), description: 'text '.repeat(60) }, ctx);
    expect(l.shown.title.length).toBeLessThanOrEqual(60);
    expect(l.shown.description.length).toBeLessThanOrEqual(160);
    expect(l.counts.title).toBeGreaterThan(60);
  });
  it('an empty post does not throw and gives an empty address', () => {
    const l = L.listing({}, {});
    expect(l.url).toBe('');
    expect(l.title).toBe('');
  });
});

describe('listing: limits (every edge)', () => {
  it('title: 60 ok, 61 warn, 70 warn, 71 stop', () => {
    expect(L.checkLimits({ title: x(60), handle: 'a' }).title).toBe('ok');
    expect(L.checkLimits({ title: x(61), handle: 'a' }).title).toBe('warn');
    expect(L.checkLimits({ title: x(70), handle: 'a' }).title).toBe('warn');
    expect(L.checkLimits({ title: x(71), handle: 'a' }).title).toBe('stop');
  });
  it('description: 160 ok, 161 warn, 320 warn, 321 stop', () => {
    expect(L.checkLimits({ description: x(160), handle: 'a' }).description).toBe('ok');
    expect(L.checkLimits({ description: x(161), handle: 'a' }).description).toBe('warn');
    expect(L.checkLimits({ description: x(320), handle: 'a' }).description).toBe('warn');
    expect(L.checkLimits({ description: x(321), handle: 'a' }).description).toBe('stop');
  });
  it('handle: empty, 120 and 121 characters, bad characters, odd hyphens', () => {
    expect(L.checkLimits({ handle: '' }).handle).toBe('stop');
    expect(L.checkLimits({ handle: x(120) }).handle).toBe('ok');
    expect(L.checkLimits({ handle: x(121) }).handle).toBe('stop');
    expect(L.checkLimits({ handle: 'Has Space' }).handle).toBe('stop');
    expect(L.checkLimits({ handle: 'under_score' }).handle).toBe('stop');
    expect(L.checkLimits({ handle: 'good-handle-2' }).handle).toBe('ok');
    expect(L.checkLimits({ handle: '-lead' }).handle).toBe('warn');
    expect(L.checkLimits({ handle: 'double--hyphen' }).handle).toBe('warn');
  });
  it('every problem has a plain note, and a clean listing has none', () => {
    expect(L.checkLimits({ title: x(71), description: x(321), handle: '' }).notes).toHaveLength(3);
    expect(L.checkLimits({ title: 'Fine', description: 'Fine.', handle: 'fine' }).notes).toEqual([]);
  });
  it('spaces are counted after they are collapsed', () => {
    expect(L.checkLimits({ title: '  ' + x(60) + '   ', handle: 'a' }).title).toBe('ok');
  });
});

describe('listing: hard errors', () => {
  it('an empty title is an error', () => {
    expect(L.hardErrors({ ...base, title: '   ' }, { timeZone: 'Asia/Kolkata' })).toContain('The title is empty.');
  });
  it('a handle used in the same category on the same date is an error; another category, date or the post itself is not', () => {
    const tz = { timeZone: 'Asia/Kolkata' };
    const mine = { ...base, permalink: 'dup', title: 'Mine' };
    const other = { id: 'o1', permalink: 'dup', category: 'technology', date: '2026-11-13T10:00:00Z' };
    expect(L.hardErrors(mine, { ...tz, others: [other], selfId: 'me' }).join(' ')).toMatch(/already used/);
    expect(L.hardErrors(mine, { ...tz, others: [{ ...other, category: 'sports' }], selfId: 'me' })).toEqual([]);
    expect(L.hardErrors(mine, { ...tz, others: [{ ...other, date: '2026-11-14T10:00:00Z' }], selfId: 'me' })).toEqual([]);
    expect(L.hardErrors(mine, { ...tz, others: [{ ...other, id: 'me' }], selfId: 'me' })).toEqual([]);
  });
  it('the day is the day in the site time zone, not in UTC', () => {
    const mine = { ...base, permalink: 'dup', title: 'Mine', date: '2026-11-13T20:00:00Z' };
    const other = { id: 'o1', permalink: 'dup', category: 'technology', date: '2026-11-14T01:00:00Z' };
    expect(L.hardErrors(mine, { timeZone: 'Asia/Kolkata', others: [other] }).join(' ')).toMatch(/already used/);
    expect(L.hardErrors(mine, { timeZone: 'UTC', others: [other] })).toEqual([]);
  });
  it('an emoji in the title, meta title or description is an error; plain symbols are not', () => {
    const tz = { timeZone: 'Asia/Kolkata' };
    const emoji = String.fromCodePoint(0x1f525);
    expect(L.hardErrors({ ...base, title: 'Big news ' + emoji }, tz).join(' ')).toMatch(/title/);
    expect(L.hardErrors({ ...base, metaTitle: 'Big ' + emoji }, tz).join(' ')).toMatch(/title/);
    expect(L.hardErrors({ ...base, description: 'Read ' + emoji }, tz).join(' ')).toMatch(/description/);
    expect(L.hardErrors({ ...base, title: 'Brand\u2122 \u00a9 news \u20b9 5 \u2013 ok' }, tz)).toEqual([]);
  });
  it('a featured image under 1200 px is an error; unknown width or no image is not', () => {
    const tz = { timeZone: 'Asia/Kolkata' };
    expect(L.hardErrors({ ...base, image: '/media/a.webp', imageWidth: 1199 }, tz).join(' ')).toMatch(/1199/);
    expect(L.hardErrors({ ...base, image: '/media/a.webp', imageWidth: 1200 }, tz)).toEqual([]);
    expect(L.hardErrors({ ...base, image: '/media/a.webp' }, tz)).toEqual([]);
    expect(L.hardErrors({ ...base, imageWidth: 100 }, tz)).toEqual([]);
  });
  it('a clean post has no hard error', () => {
    expect(L.hardErrors({ ...base, permalink: 'ok-post' }, { timeZone: 'Asia/Kolkata', others: [] })).toEqual([]);
  });
});

describe('listing: changing a handle', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const pub = { ...base, permalink: 'old-handle', status: 'published' };
  it('a post live for more than 24 hours needs the redirect and cannot switch it off', () => {
    const r = L.changeHandle(pub, 'new-handle', { now });
    expect(r).toMatchObject({ ok: true, redirect: 'required', canSwitchOff: false });
  });
  it('a post younger than 24 hours has the redirect on by default and may switch it off', () => {
    const young = { ...pub, date: '2026-11-20T00:00:00Z' };
    expect(L.changeHandle(young, 'new-handle', { now })).toMatchObject({ ok: true, redirect: 'default-on', canSwitchOff: true });
  });
  it('the edge: exactly 24 hours is still young, 24 hours and a minute is old', () => {
    expect(L.changeHandle({ ...pub, date: '2026-11-19T10:00:00Z' }, 'n', { now }).redirect).toBe('default-on');
    expect(L.changeHandle({ ...pub, date: '2026-11-19T09:59:00Z' }, 'n', { now }).redirect).toBe('required');
  });
  it('a draft needs no redirect, and an unchanged handle needs none', () => {
    expect(L.changeHandle({ ...pub, status: 'draft' }, 'new-handle', { now }).redirect).toBe('none');
    expect(L.changeHandle(pub, 'old-handle', { now })).toMatchObject({ changed: false, redirect: 'none' });
  });
  it('the new handle is never empty, never invalid and never the handle of another live post', () => {
    expect(L.changeHandle(pub, '  ', { now }).ok).toBe(false);
    expect(L.changeHandle(pub, 'Bad Handle', { now }).ok).toBe(false);
    const others = [{ id: 'o1', permalink: 'taken', category: 'technology', status: 'published' }];
    expect(L.changeHandle(pub, 'taken', { now, others, selfId: 'me' })).toMatchObject({ ok: false });
    expect(L.changeHandle(pub, 'taken', { now, others: [{ ...others[0], status: 'draft' }], selfId: 'me' }).ok).toBe(true);
    expect(L.changeHandle(pub, 'taken', { now, others: [{ ...others[0], id: 'me' }], selfId: 'me' }).ok).toBe(true);
  });
});

describe('listing: hide from search engines', () => {
  it('on: noindex,follow and removed from the sitemaps, the news sitemap and push announce', () => {
    expect(L.hideFromSearch(base, true)).toEqual({ robots: 'noindex,follow', inSitemaps: false, inNewsSitemap: false, inPushAnnounce: false, pushReason: 'noindex', warnBreaking: false });
  });
  it('off: index,follow and everything stays in', () => {
    expect(L.hideFromSearch(base, false)).toMatchObject({ robots: 'index,follow', inSitemaps: true, inNewsSitemap: true, inPushAnnounce: true, pushReason: null, warnBreaking: false });
  });
  it('the red note shows only when hiding a breaking or featured post', () => {
    expect(L.hideFromSearch({ ...base, breaking: true }, true).warnBreaking).toBe(true);
    expect(L.hideFromSearch({ ...base, featured: true }, true).warnBreaking).toBe(true);
    expect(L.hideFromSearch({ ...base, breaking: true }, false).warnBreaking).toBe(false);
  });
});

describe('listing.js is a pure file', () => {
  const src = readFileSync(new URL('../../public/admin/js/listing.js', import.meta.url), 'utf8');
  it('uses no network, storage, document or window', () => {
    expect(src).not.toMatch(/\b(fetch|localStorage|sessionStorage|indexedDB|document|window|XMLHttpRequest)\b/);
  });
  it('has no emoji or symbol glyphs', () => {
    expect(findEmoji(src)).toEqual([]);
  });
});
