// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { entryBox } from '../../public/admin/js/listing-box.js';
// @ts-ignore
import { entryListing, entryErrors } from '../../public/admin/js/listing.js';
import { homeHead } from '../../src/lib/seo';

const q = (root: ParentNode, k: string) => root.querySelector(`[data-l="${k}"]`) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const SITE = { siteName: 'Shivam Das News', tagline: 'U.S. news and in-depth analysis', description: 'Breaking U.S. news.' };

describe('homeHead (the page head of the home page)', () => {
  it('uses site name - tagline when homeTitle is empty', () => {
    expect(homeHead(SITE)).toEqual({ fullTitle: 'Shivam Das News - U.S. news and in-depth analysis', description: 'Breaking U.S. news.' });
  });
  it('uses the site name alone without a tagline', () => {
    expect(homeHead({ siteName: 'Shivam Das News' }).fullTitle).toBe('Shivam Das News');
    expect(homeHead({ siteName: 'Shivam Das News', tagline: '   ' }).fullTitle).toBe('Shivam Das News');
  });
  it('uses homeTitle as the whole title, as typed', () => {
    expect(homeHead({ ...SITE, homeTitle: 'Film and TV news from the U.S.' }).fullTitle).toBe('Film and TV news from the U.S.');
  });
  it('treats a blank homeTitle as empty and cleans spaces', () => {
    expect(homeHead({ ...SITE, homeTitle: '   ' }).fullTitle).toBe('Shivam Das News - U.S. news and in-depth analysis');
    expect(homeHead({ ...SITE, homeTitle: ' Two   words ' }).fullTitle).toBe('Two words');
  });
  it('gives an empty description when the site has none', () => {
    expect(homeHead({ siteName: 'X' }).description).toBe('');
  });
});

describe('entryListing with an automatic title of its own (home page)', () => {
  const ctx = { siteName: 'Shivam Das News', origin: 'https://example.test', path: '/', autoTitle: 'Shivam Das News - U.S. news' };
  it('uses ctx.autoTitle when the own title is empty', () => {
    const l = entryListing({ title: 'Shivam Das News', metaTitle: '', metaDescription: 'D' }, ctx);
    expect(l.title).toBe('Shivam Das News - U.S. news');
    expect(l.auto.title).toBe(true);
  });
  it('the own title wins over ctx.autoTitle', () => {
    expect(entryListing({ metaTitle: 'Own' }, ctx).title).toBe('Own');
  });
  it('an empty autoTitle gives an empty title, not the name | site rule', () => {
    expect(entryListing({ title: 'Name' }, { ...ctx, autoTitle: '' }).title).toBe('');
  });
  it('without autoTitle the rule of categories and authors is unchanged', () => {
    expect(entryListing({ title: 'Cinema' }, { siteName: 'S' }).title).toBe('Cinema | S');
  });
  it('the site name given with the home path builds the home address', () => {
    expect(entryListing({}, ctx).url).toBe('https://example.test/');
  });
});

describe('the box with hints', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  function make(hints?: any) {
    const inputs = { metaTitle: document.createElement('input'), metaDescription: document.createElement('textarea') };
    const box = entryBox({ inputs, hints, startOpen: true, getEntry: () => ({ title: 'Shivam Das News', description: '', metaTitle: inputs.metaTitle.value, metaDescription: inputs.metaDescription.value }), ctx: () => ({ siteName: 'Shivam Das News', origin: 'https://example.test', path: '/', autoTitle: 'Shivam Das News - tagline' }), onReset: () => {} });
    inputs.metaTitle.addEventListener('input', () => box.refresh());
    document.body.replaceChildren(box.el);
    return { box, inputs };
  }
  it('shows the home hints instead of the default ones', () => {
    const { box } = make({ title: 'HOME TITLE HINT', description: 'HOME DESC HINT' });
    const text = box.el.textContent;
    expect(text).toContain('HOME TITLE HINT');
    expect(text).toContain('HOME DESC HINT');
    expect(text).not.toContain('Empty means the name and the site name');
  });
  it('keeps the default hints when none are given', () => {
    const { box } = make();
    expect(box.el.textContent).toContain('Empty means the name and the site name');
  });
  it('the preview shows the automatic home title and follows the typed title', () => {
    const { box, inputs } = make();
    expect(q(box.el, 'title').textContent).toBe('Shivam Das News - tagline');
    expect(q(box.el, 'auto-title').hidden).toBe(false);
    type(inputs.metaTitle, 'Film and TV news');
    expect(q(box.el, 'title').textContent).toBe('Film and TV news');
    expect(q(box.el, 'auto-title').hidden).toBe(true);
  });
});

describe('wiring', () => {
  it('the home page takes its head from homeHead', () => {
    const i = src('src/pages/index.astro');
    expect(i).toContain("import { homeHead } from '../lib/seo';");
    expect(i).toContain('fullTitle={head.fullTitle}');
    expect(i).toContain('description={head.description}');
    expect(i).not.toContain('site.tagline ?');
  });
  it('the Settings screen draws the home box, saves homeTitle and checks the limits', () => {
    const a = src('public/admin/js/app.js');
    expect(a).toContain('const homeBox = entryBox({');
    expect(a).toContain('homeBox.el,');
    expect(a).toContain('if (home) next.homeTitle = home; else delete next.homeTitle;');
    expect(a).toContain('entryErrors({ metaTitle: next.homeTitle, metaDescription: next.description })');
    expect(a).toContain("homeTitle: t('homeTitle'");
  });
  it('the limits for the home page are the ones of every entry', () => {
    expect(entryErrors({ metaTitle: 'a'.repeat(71) })).toHaveLength(1);
    expect(entryErrors({ metaDescription: 'b'.repeat(321) })).toHaveLength(1);
  });
});
