import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listingHead } from '../../src/lib/seo';
import { tagMetaTitle, tagMetaDescription } from '../../src/lib/tags';
// @ts-expect-error plain script module
import { checkPage, checkTags } from '../../scripts/validate-content-lib.mjs';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const page = (extra = '') => `---\ntitle: About Us\npermalink: about-us\ndate: 2026-01-01\nstatus: published\n${extra}---\nBody\n`;

describe('static page search fields (v0.101.26, Part 6d)', () => {
  it('the schema accepts metaTitle (70) and metaDescription (320), both empty by default', () => {
    const cfg = src('src/content.config.ts');
    expect(cfg).toMatch(/metaTitle: z\.string\(\)\.max\(70\)\.default\(''\)/);
    expect(cfg).toMatch(/metaDescription: z\.string\(\)\.max\(320\)\.default\(''\)/);
    // the pages collection holds them, not only the blogs one
    const pagesBlock = cfg.slice(cfg.indexOf('const pages = '), cfg.indexOf('const authors = '));
    expect(pagesBlock).toContain('metaTitle');
    expect(pagesBlock).toContain('metaDescription');
  });
  it('the page route uses listingHead and keeps the JSON-LD description as it was', () => {
    const route = src('src/pages/[year]/[month]/[day]/pages/[slug].astro');
    expect(route).toContain('listingHead(');
    expect(route).toContain('title={head.title} description={head.description}');
    expect(route).toContain('page.data.title, page.url, page.data.description)');
  });
  it('an empty page behaves exactly as before', () => {
    expect(listingHead({ title: 'About Us', description: 'Who we are', metaTitle: '', metaDescription: '' })).toEqual({ title: 'About Us', description: 'Who we are' });
  });
  it('the content check passes normal and empty values', () => {
    expect(checkPage({ text: page() }).errors).toEqual([]);
    expect(checkPage({ text: page('metaTitle: About the newsroom\nmetaDescription: Who runs the site\n') }).errors).toEqual([]);
    expect(checkPage({ text: page(`metaTitle: ${'a'.repeat(70)}\nmetaDescription: ${'b'.repeat(320)}\n`) }).errors).toEqual([]);
  });
  it('the content check stops a title over 70 and a description over 320', () => {
    expect(checkPage({ text: page(`metaTitle: ${'a'.repeat(71)}\n`) }).errors.join(' ')).toMatch(/metaTitle/);
    expect(checkPage({ text: page(`metaDescription: ${'b'.repeat(321)}\n`) }).errors.join(' ')).toMatch(/metaDescription/);
  });
  it('the content check stops an emoji in the search fields', () => {
    expect(checkPage({ text: page('metaTitle: Hello \u{1F600}\n') }).errors.length).toBeGreaterThan(0);
  });
  it('the numbers in the script and in the schema agree', () => {
    const lib = src('scripts/validate-content-lib.mjs');
    expect(lib).toContain('<= 70');
    expect(lib).toContain('<= 320');
  });
});

describe('tag search fields (v0.101.26, Part 6d)', () => {
  it('the shipped config/tags.json is an empty object and gives empty values', () => {
    expect(JSON.parse(src('config/tags.json'))).toEqual({});
    expect(tagMetaTitle('anything')).toBe('');
    expect(tagMetaDescription('anything')).toBe('');
  });
  it('the tag route passes the two fields to the listing', () => {
    const route = src('src/pages/tag/[tag]/[...rest].astro');
    expect(route).toContain('metaTitle={tagMetaTitle(slug)}');
    expect(route).toContain('metaDescription={tagMetaDescription(slug)}');
    expect(route).toContain("from '../../../lib/tags'");
  });
  it('an empty tag falls back to the tag name; a filled one wins; page number after page 1', () => {
    expect(listingHead({ title: 'Elections' }).title).toBe('Elections');
    expect(listingHead({ title: 'Elections', metaTitle: 'Election news' }).title).toBe('Election news');
    expect(listingHead({ title: 'Elections', metaTitle: 'Election news', page: 2 }).title).toBe('Election news - Page 2');
  });
  it('thin tag pages stay noindex (Bug S7 is untouched)', () => {
    expect(src('src/pages/tag/[tag]/[...rest].astro')).toContain("robots={thin ? 'noindex,follow' : undefined}");
  });
});

describe('checkTags (config/tags.json)', () => {
  it('passes empty, partial and full entries', () => {
    expect(checkTags({})).toEqual([]);
    expect(checkTags({ elections: { metaTitle: 'Election news' } })).toEqual([]);
    expect(checkTags({ elections: { metaTitle: 'a'.repeat(70), metaDescription: 'b'.repeat(320) } })).toEqual([]);
  });
  it('stops a root that is not an object', () => {
    expect(checkTags([])).toHaveLength(1);
    expect(checkTags(null)).toHaveLength(1);
    expect(checkTags('x')).toHaveLength(1);
  });
  it('stops a bad slug, a non-object entry and an unknown key', () => {
    expect(checkTags({ 'Bad Slug': {} }).join(' ')).toMatch(/tag slug/);
    expect(checkTags({ ok: 'text' }).join(' ')).toMatch(/must be an object/);
    expect(checkTags({ ok: { title: 'x' } }).join(' ')).toMatch(/unknown key/);
  });
  it('stops too long text, wrong type and emoji', () => {
    expect(checkTags({ ok: { metaTitle: 'a'.repeat(71) } })).toHaveLength(1);
    expect(checkTags({ ok: { metaDescription: 'b'.repeat(321) } })).toHaveLength(1);
    expect(checkTags({ ok: { metaTitle: 5 } })).toHaveLength(1);
    expect(checkTags({ ok: { metaDescription: 'Fire \u{1F525}' } }).length).toBeGreaterThan(0);
  });
  it('allows the copyright sign', () => {
    expect(checkTags({ ok: { metaTitle: 'News \u00A9 team' } })).toEqual([]);
  });
  it('the content check script (real run) fails on a bad config/tags.json and passes on a good one', () => {
    const d = mkdtempSync(join(tmpdir(), 'pt-'));
    for (const x of ['content/blogs', 'content/pages', 'content/authors', 'config']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const run = () => spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8' });
    writeFileSync(join(d, 'config/tags.json'), JSON.stringify({ elections: { metaTitle: 'Election news' } }));
    expect(run().status).toBe(0);
    writeFileSync(join(d, 'config/tags.json'), JSON.stringify({ elections: { metaTitle: 'a'.repeat(71) } }));
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/tags.json:');
  });
});
