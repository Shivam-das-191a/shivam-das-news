import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { RIGHTS_NOTICE, SRCSET_WIDTHS, DEFAULT_AGENCY_HOSTS, sourceHostOf, isAgencyHost, needsConfirm, autoAlt, imgAttributes, recordHosted, autoAltFiles } from '../../public/admin/js/hosted-meta.js';
// @ts-ignore plain JS module
import { ALT_WARN, mediaErrors, altFor } from '../../public/admin/js/media-meta.js';
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

const HASH = 'a'.repeat(64);
const PATH = '/media/2026/11/new-phone-launch-event-delhi.webp';
const INFO = { sourceUrl: 'https://www.Other.com/wp-content/IMG_1.jpg?w=900', sha256: HASH, width: 1600, height: 900, bytes: 84210, hostedAt: '2026-11-16T10:00:00.456Z', alt: '', auto: false };

describe('autoAlt', () => {
  it('keeps the alt text of the writer as it is, and spaces are tidied', () => {
    expect(autoAlt({ alt: '  A   crowd at the venue ', caption: 'Other', heading: 'H' }, { title: 'T' })).toEqual({ alt: 'A crowd at the venue', auto: false, source: 'alt' });
  });
  it('uses the caption, then the nearest heading, then the post title, and marks it auto', () => {
    expect(autoAlt({ caption: 'Crowd outside', heading: 'Vote count' }, { title: 'Title' })).toEqual({ alt: 'Crowd outside', auto: true, source: 'caption' });
    expect(autoAlt({ caption: '  ', heading: 'Vote count' }, { title: 'Title' })).toEqual({ alt: 'Vote count', auto: true, source: 'heading' });
    expect(autoAlt({ heading: '' }, { title: 'Delhi hosts the big phone launch' })).toEqual({ alt: 'Delhi hosts the big phone launch', auto: true, source: 'title' });
  });
  it('invents nothing: with no text at all the alt stays empty and is not marked auto', () => {
    expect(autoAlt({}, {})).toEqual({ alt: '', auto: false, source: '' });
    expect(autoAlt(undefined as any, undefined as any)).toEqual({ alt: '', auto: false, source: '' });
    expect(autoAlt({ caption: '***', heading: '<br>' }, { title: ' ' })).toEqual({ alt: '', auto: false, source: '' });
  });
  it('removes tags, Markdown marks, links and emoji', () => {
    expect(autoAlt({ caption: '**Crowd** at the [venue](https://x.com/a) <b>today</b> \u{1F389}' }, {}).alt).toBe('Crowd at the venue today');
    expect(findEmoji(autoAlt({ heading: '## Party time \u{1F38A}️' }, {}).alt)).toEqual([]);
  });
  it('cuts at a word end to 125 characters and the result passes the Files screen check', () => {
    const long = 'word '.repeat(60).trim();
    const r = autoAlt({ caption: long }, {});
    expect(r.alt.length).toBeLessThanOrEqual(ALT_WARN);
    expect(r.alt.endsWith('word')).toBe(true);
    expect(mediaErrors({ alt: r.alt })).toEqual([]);
    expect(autoAlt({ caption: 'a'.repeat(125) }, {}).alt).toHaveLength(125);
    expect(autoAlt({ caption: 'a'.repeat(126) }, {}).alt).toHaveLength(125);
    expect(autoAlt({ caption: `${'ab '.repeat(41)}end` }, {}).alt.length).toBeLessThanOrEqual(125);
  });
  it('a long writer alt text is never cut', () => {
    const own = 'x '.repeat(100).trim();
    expect(autoAlt({ alt: own }, {}).alt).toBe(own);
  });
});

describe('imgAttributes', () => {
  it('always writes width and height; the first picture is high priority, the others lazy', () => {
    expect(imgAttributes({ width: 1600, height: 900 }, 0)).toEqual({ width: 1600, height: 900, fetchpriority: 'high', srcsetWidths: [480, 800, 1200, 1600] });
    expect(imgAttributes({ width: 1600, height: 900 }, 1)).toEqual({ width: 1600, height: 900, loading: 'lazy', srcsetWidths: [480, 800, 1200, 1600] });
    expect(imgAttributes({ width: 1600, height: 900 })).toHaveProperty('fetchpriority', 'high');
    expect('loading' in imgAttributes({ width: 10, height: 10 }, 0)).toBe(false);
    expect('fetchpriority' in imgAttributes({ width: 10, height: 10 }, 5)).toBe(false);
  });
  it('lists only the srcset widths the file is wide enough for (edges 479, 480, 799, 800, 1599, 1600, 2400)', () => {
    const w = (n: number) => imgAttributes({ width: n, height: 10 }, 1).srcsetWidths;
    expect(w(479)).toEqual([]);
    expect(w(480)).toEqual([480]);
    expect(w(799)).toEqual([480]);
    expect(w(800)).toEqual([480, 800]);
    expect(w(1199)).toEqual([480, 800]);
    expect(w(1599)).toEqual([480, 800, 1200]);
    expect(w(1600)).toEqual([480, 800, 1200, 1600]);
    expect(w(2400)).toEqual([480, 800, 1200, 1600]);
    expect(SRCSET_WIDTHS).toEqual([480, 800, 1200, 1600]);
  });
  it('throws a plain message when the size is not known', () => {
    for (const bad of [{}, { width: 100 }, { height: 100 }, { width: 0, height: 5 }, { width: 5.5, height: 5 }, { width: '100', height: 5 }, { width: -3, height: 5 }]) expect(() => imgAttributes(bad as any, 0)).toThrow(/size is not known/);
    expect(() => imgAttributes(undefined as any, 0)).toThrow(/size is not known/);
  });
});

describe('agency hosts and the rights notice', () => {
  it('the notice is the exact sentence of the plan', () => {
    expect(RIGHTS_NOTICE).toBe('Hosting a picture here does not give you the right to publish it. Check the licence and add the credit.');
  });
  it('the starting list names Getty, Shutterstock, Alamy and the wire agencies', () => {
    for (const h of ['gettyimages.com', 'shutterstock.com', 'alamy.com', 'reuters.com', 'apimages.com', 'afp.com']) expect(DEFAULT_AGENCY_HOSTS).toContain(h);
  });
  it('matches a listed host, its sub names, with or without www and an address, in any letter case', () => {
    for (const u of ['gettyimages.com', 'https://media.gettyimages.com/id/1/photo.jpg', 'https://WWW.Shutterstock.com/a.jpg', 'image.shutterstock.com', 'https://a.b.reuters.com/x']) expect(isAgencyHost(u), u).toBe(true);
  });
  it('does not match a different host that only ends the same way or contains the name', () => {
    for (const u of ['https://notgettyimages.com/a.jpg', 'https://gettyimages.com.evil.net/a.jpg', 'https://other.com/gettyimages.com/a.jpg', 'https://example.org', '', 'not a url !!']) expect(isAgencyHost(u), u).toBe(false);
  });
  it('uses the list the owner gives instead of the starting list', () => {
    expect(isAgencyHost('https://media.gettyimages.com/a.jpg', ['stock.example'])).toBe(false);
    expect(isAgencyHost('https://cdn.stock.example/a.jpg', ['Stock.Example', 'https://other-agency.com/'])).toBe(true);
    expect(isAgencyHost('https://other-agency.com/a.jpg', ['https://www.other-agency.com/'])).toBe(true);
    expect(isAgencyHost('https://media.gettyimages.com/a.jpg', [])).toBe(false);
  });
  it('needsConfirm: an agency picture is held until the writer confirms the address or the host', () => {
    const u = 'https://media.gettyimages.com/id/1/photo.jpg?s=612';
    expect(needsConfirm(u)).toBe(true);
    expect(needsConfirm('https://other.com/a.jpg')).toBe(false);
    expect(needsConfirm(u, { confirmed: [u] })).toBe(false);
    expect(needsConfirm(u, { confirmed: [`${u}#frag`] })).toBe(false);
    expect(needsConfirm(u, { confirmed: ['https://media.gettyimages.com/id/2/other.jpg'] })).toBe(true);
    expect(needsConfirm(u, { confirmed: ['media.gettyimages.com'] })).toBe(false);
    expect(needsConfirm(u, { confirmed: ['https://media.gettyimages.com/'] })).toBe(true);
    expect(needsConfirm(u, { confirmed: ['', null as any] })).toBe(true);
    expect(needsConfirm(u, { confirmed: ['other.com', 'cdn.shutterstock.com'] })).toBe(true);
    expect(needsConfirm(u, { agencyHosts: [] })).toBe(false);
  });
  it('sourceHostOf gives a clean host', () => {
    expect(sourceHostOf('https://WWW.Other.com./a.jpg')).toBe('other.com');
    expect(sourceHostOf('nonsense !!')).toBe('');
  });
});

describe('recordHosted', () => {
  it('writes the row of the plan: source, host, hash, size, time, no empty keys, no autoAlt when the alt is the writer\'s', () => {
    const map = recordHosted({}, PATH, { ...INFO, alt: 'New phone launch event in Delhi', auto: false, credit: 'Photo: A. Roy' });
    expect(map).toEqual({ [PATH]: { alt: 'New phone launch event in Delhi', credit: 'Photo: A. Roy', sourceUrl: INFO.sourceUrl, sourceHost: 'other.com', sha256: HASH, width: 1600, height: 900, bytes: 84210, hostedAt: '2026-11-16T10:00:00Z' } });
    expect('autoAlt' in map[PATH]).toBe(false);
  });
  it('marks autoAlt true only while an automatic alt text waits for review', () => {
    const a = recordHosted({}, PATH, { ...INFO, alt: 'Vote count', auto: true });
    expect(a[PATH].autoAlt).toBe(true);
    expect(altFor(a, PATH)).toBe('Vote count');
    expect('autoAlt' in recordHosted({}, PATH, { ...INFO, alt: '', auto: true })[PATH]).toBe(false);
    expect('alt' in recordHosted({}, PATH, INFO)[PATH]).toBe(false);
  });
  it('lowercases the hash and writes the time as UTC seconds from a Date or text', () => {
    expect(recordHosted({}, PATH, { ...INFO, sha256: 'ABCDEF0123'.padEnd(64, 'F') })[PATH].sha256).toBe('abcdef0123'.padEnd(64, 'f'));
    expect(recordHosted({}, PATH, { ...INFO, hostedAt: new Date('2026-11-16T10:00:00.999Z') })[PATH].hostedAt).toBe('2026-11-16T10:00:00Z');
    expect(recordHosted({}, PATH, { ...INFO, hostedAt: '2026-11-16T15:30:00+05:30' })[PATH].hostedAt).toBe('2026-11-16T10:00:00Z');
  });
  it('keeps other files and other keys of the same file, and clears an old autoAlt flag when the new alt is the writer\'s', () => {
    const before = { '/media/2026/10/other.webp': { alt: 'keep me' }, [PATH]: { alt: 'old', autoAlt: true, note: 'other screen' } };
    const after = recordHosted(before, PATH, { ...INFO, alt: 'Better alt', auto: false });
    expect(after['/media/2026/10/other.webp']).toEqual({ alt: 'keep me' });
    expect(after[PATH].note).toBe('other screen');
    expect('autoAlt' in after[PATH]).toBe(false);
    expect(after[PATH].alt).toBe('Better alt');
  });
  it('does not change its input and returns a new map', () => {
    const before = { [PATH]: { alt: 'x' } };
    const snap = JSON.stringify(before);
    const after = recordHosted(before, PATH, INFO);
    expect(JSON.stringify(before)).toBe(snap);
    expect(after).not.toBe(before);
  });
  it.each([
    ['an address that is not http(s)', { sourceUrl: 'ftp://other.com/a.jpg' }, /outside address/],
    ['an empty address', { sourceUrl: '' }, /outside address/],
    ['a short hash', { sha256: 'abc' }, /hash/],
    ['a hash with a wrong letter', { sha256: 'g'.repeat(64) }, /hash/],
    ['no width', { width: undefined }, /whole numbers/],
    ['a zero height', { height: 0 }, /whole numbers/],
    ['a fractional size', { bytes: 10.5 }, /whole numbers/],
    ['a bad time', { hostedAt: 'yesterday' }, /valid date/],
    ['a missing time', { hostedAt: undefined }, /valid date/],
    ['an alt text over the limit', { alt: 'x'.repeat(301) }, /alt text/],
    ['a credit with an emoji', { credit: 'Photo \u{1F4F7}' }, /emoji/],
  ])('refuses %s with a plain message', (_n, patch, re) => {
    expect(() => recordHosted({}, PATH, { ...INFO, ...patch } as any)).toThrow(re as RegExp);
  });
  it('refuses a path that is not under /media/', () => {
    expect(() => recordHosted({}, '/other/a.webp', INFO)).toThrow(/not a file under \/media\//);
  });
});

describe('autoAltFiles', () => {
  it('lists the files whose alt text still waits for review, in the order of the map', () => {
    const map = { '/media/a.webp': { alt: 'A', autoAlt: true }, '/media/b.webp': { alt: 'B' }, '/media/c.webp': { alt: 'C', autoAlt: true }, '/media/d.webp': { autoAlt: true }, '/media/e.webp': { alt: 'E', autoAlt: false } };
    expect(autoAltFiles(map)).toEqual([{ path: '/media/a.webp', alt: 'A' }, { path: '/media/c.webp', alt: 'C' }]);
    expect(autoAltFiles({})).toEqual([]);
    expect(autoAltFiles(undefined as any)).toEqual([]);
    expect(autoAltFiles(null as any)).toEqual([]);
  });
});
