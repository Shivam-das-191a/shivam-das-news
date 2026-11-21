import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { listingHead } from '../../src/lib/seo';
// @ts-expect-error plain browser module
import { entryErrors, mergeEntry } from '../../public/admin/js/listing.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

describe('listingHead (category and author pages)', () => {
  it('uses the page title and description when the search fields are empty', () => {
    expect(listingHead({ title: 'Cinema', description: 'All cinema news' })).toEqual({ title: 'Cinema', description: 'All cinema news' });
  });
  it('prefers the search title and description', () => {
    expect(listingHead({ title: 'Cinema', description: 'a', metaTitle: 'Film news and reviews', metaDescription: 'Fresh film stories' }))
      .toEqual({ title: 'Film news and reviews', description: 'Fresh film stories' });
  });
  it('treats blank and spaced values as empty and cleans spaces', () => {
    expect(listingHead({ title: 'Cinema', description: 'd', metaTitle: '   ', metaDescription: '\n ' })).toEqual({ title: 'Cinema', description: 'd' });
    expect(listingHead({ title: 'A', metaTitle: ' Two   words ' }).title).toBe('Two words');
  });
  it('adds the page number only after page 1', () => {
    expect(listingHead({ title: 'Cinema', page: 1 }).title).toBe('Cinema');
    expect(listingHead({ title: 'Cinema', page: 2 }).title).toBe('Cinema - Page 2');
    expect(listingHead({ title: 'Cinema', metaTitle: 'Film news', page: 3 }).title).toBe('Film news - Page 3');
  });
  it('handles missing values', () => {
    expect(listingHead({ title: 'X' }).description).toBe('');
  });
});

describe('entryErrors', () => {
  it('passes empty and normal values', () => {
    expect(entryErrors({})).toEqual([]);
    expect(entryErrors(undefined)).toEqual([]);
    expect(entryErrors({ metaTitle: 'a'.repeat(70), metaDescription: 'b'.repeat(320) })).toEqual([]);
  });
  it('stops a title over 70 and a description over 320', () => {
    expect(entryErrors({ metaTitle: 'a'.repeat(71) })).toHaveLength(1);
    expect(entryErrors({ metaDescription: 'b'.repeat(321) })).toHaveLength(1);
    expect(entryErrors({ metaTitle: 'a'.repeat(71), metaDescription: 'b'.repeat(321) })).toHaveLength(2);
  });
  it('stops an emoji but allows the copyright sign', () => {
    expect(entryErrors({ metaTitle: 'Great \u{1F600}' })).toHaveLength(1);
    expect(entryErrors({ metaDescription: 'Fire \u{1F525}' })).toHaveLength(1);
    expect(entryErrors({ metaTitle: 'News \u00A9 team' })).toEqual([]);
  });
});

describe('mergeEntry', () => {
  it('keeps keys the screen does not own', () => {
    expect(mergeEntry({ name: 'A', metaTitle: 'T', metaDescription: 'D' }, { name: 'B', description: '' }))
      .toEqual({ name: 'B', metaTitle: 'T', metaDescription: 'D' });
  });
  it('sets filled values and removes emptied ones', () => {
    expect(mergeEntry({ name: 'A', description: 'x' }, { name: '', description: 'y' })).toEqual({ description: 'y' });
  });
  it('works without a stored entry and does not change the input', () => {
    expect(mergeEntry(undefined, { name: 'A' })).toEqual({ name: 'A' });
    expect(mergeEntry(null, { name: '' })).toEqual({});
    const prev = { name: 'A', metaTitle: 'T' };
    mergeEntry(prev, { name: 'B' });
    expect(prev).toEqual({ name: 'A', metaTitle: 'T' });
  });
});

describe('wiring', () => {
  it('the author schema accepts the two fields with the same limits', () => {
    const c = src('src/content.config.ts');
    expect(c).toMatch(/metaTitle: z\.string\(\)\.max\(70\)\.optional\(\)/);
    expect(c).toMatch(/metaDescription: z\.string\(\)\.max\(320\)\.optional\(\)/);
  });
  it('the category and author pages hand the fields to the listing', () => {
    const cat = src('src/pages/category/[category]/[...rest].astro');
    expect(cat).toContain('metaTitle={catMetaTitle(slug)}');
    expect(cat).toContain('metaDescription={catMetaDescription(slug)}');
    const au = src('src/pages/author/[author]/[...rest].astro');
    expect(au).toContain('metaTitle={metaTitle}');
    expect(au).toContain('metaDescription={metaDescription}');
    expect(src('src/components/Listing.astro')).toContain('listingHead(');
  });
  it('the dashboard saves categories and authors without losing the two fields', () => {
    const a = src('public/admin/js/app.js');
    expect(a).toContain("mergeEntry(S.cats[s]");
    expect(a).toContain('mergeEntry(stored');
    // 0.101.25: the Settings screen uses the same check for the home page, so "at least" the two of categories and authors.
    expect(a.match(/entryErrors\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(a).toContain('const bad = entryErrors(e);');
    expect(a).toContain('const bad = entryErrors(data);');
  });
});
