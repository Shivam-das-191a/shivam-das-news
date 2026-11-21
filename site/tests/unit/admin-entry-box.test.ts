// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { entryBox } from '../../public/admin/js/listing-box.js';
// @ts-ignore
import { entryListing } from '../../public/admin/js/listing.js';
import { listingHead } from '../../src/lib/seo';

const q = (root: ParentNode, k: string) => root.querySelector(`[data-l="${k}"]`) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const CTX = { siteName: 'Shivam Das News', origin: 'https://example.test', path: '/category/cinema/' };

function make(over: any = {}, opts: any = {}) {
  const e: any = { title: 'Cinema', description: 'All cinema news', metaTitle: '', metaDescription: '', ...over };
  const inputs = { metaTitle: document.createElement('input'), metaDescription: document.createElement('textarea') };
  inputs.metaTitle.value = e.metaTitle; inputs.metaDescription.value = e.metaDescription;
  const box = entryBox({
    inputs, readOnly: opts.readOnly, startOpen: opts.startOpen,
    getEntry: () => ({ ...e, metaTitle: inputs.metaTitle.value, metaDescription: inputs.metaDescription.value }),
    ctx: () => ({ ...CTX, ...(opts.ctx || {}) }),
    onReset: (k: string) => { (k === 'title' ? inputs.metaTitle : inputs.metaDescription).value = ''; },
  });
  inputs.metaTitle.addEventListener('input', () => box.refresh());
  inputs.metaDescription.addEventListener('input', () => box.refresh());
  document.body.replaceChildren(box.el);
  return { e, inputs, box };
}
beforeEach(() => { document.body.innerHTML = ''; });

describe('entryListing (pure)', () => {
  it('falls back to the name with the site name and to the visible description', () => {
    const l = entryListing({ title: 'Cinema', description: 'All cinema news' }, CTX);
    expect(l.title).toBe('Cinema | Shivam Das News');
    expect(l.description).toBe('All cinema news');
    expect(l.auto).toEqual({ title: true, description: true });
    expect(l.url).toBe('https://example.test/category/cinema/');
  });
  it('uses the own values as typed and clears the auto flags', () => {
    const l = entryListing({ title: 'Cinema', description: 'x', metaTitle: 'Film news', metaDescription: 'Fresh film stories' }, CTX);
    expect(l.title).toBe('Film news');
    expect(l.description).toBe('Fresh film stories');
    expect(l.auto).toEqual({ title: false, description: false });
  });
  it('levels, notes and red errors use the limits 60/70 and 160/320', () => {
    expect(entryListing({ metaTitle: 'a'.repeat(61) }, CTX).levels.title).toBe('warn');
    expect(entryListing({ metaTitle: 'a'.repeat(61) }, CTX).notes).toHaveLength(1);
    expect(entryListing({ metaTitle: 'a'.repeat(71) }, CTX).levels.title).toBe('stop');
    expect(entryListing({ metaTitle: 'a'.repeat(71) }, CTX).errors).toHaveLength(1);
    expect(entryListing({ metaDescription: 'b'.repeat(161) }, CTX).levels.description).toBe('warn');
    expect(entryListing({ metaDescription: 'b'.repeat(321) }, CTX).errors).toHaveLength(1);
  });
  it('works with nothing and without a site name', () => {
    const l = entryListing(undefined, undefined);
    expect(l.title).toBe(''); expect(l.url).toBe('');
    expect(entryListing({ title: 'Cinema' }, {}).title).toBe('Cinema');
  });
  it('shows the same head values as the page (listingHead) when the own title is used', () => {
    const e = { title: 'Cinema', description: 'visible', metaTitle: 'Film news', metaDescription: 'Search text' };
    const head = listingHead({ title: e.title, description: e.description, metaTitle: e.metaTitle, metaDescription: e.metaDescription });
    const l = entryListing(e, CTX);
    expect(l.title).toBe(head.title);
    expect(l.description).toBe(head.description);
  });
});

describe('entryBox (screen)', () => {
  it('draws the preview, the closed panel and the mobile crumb', () => {
    const { box } = make();
    expect(q(box.el, 'title').textContent).toBe('Cinema | Shivam Das News');
    expect(q(box.el, 'desc').textContent).toBe('All cinema news');
    expect(q(box.el, 'crumb').textContent).toBe('example.test');
    expect(q(box.el, 'panel').hidden).toBe(true);
    expect(box.isOpen()).toBe(false);
  });
  it('Edit opens and closes the panel', () => {
    const { box } = make();
    q(box.el, 'edit').click();
    expect(q(box.el, 'panel').hidden).toBe(false);
    expect(q(box.el, 'edit').textContent).toBe('Close');
    q(box.el, 'edit').click();
    expect(q(box.el, 'panel').hidden).toBe(true);
  });
  it('the preview follows typing and the auto tags and counters follow too', () => {
    const { box, inputs } = make({}, { startOpen: true });
    expect(q(box.el, 'auto-title').hidden).toBe(false);
    type(inputs.metaTitle, 'Film news and reviews');
    expect(q(box.el, 'title').textContent).toBe('Film news and reviews');
    expect(q(box.el, 'auto-title').hidden).toBe(true);
    expect(q(box.el, 'count-title').textContent).toBe('21/60');
    type(inputs.metaDescription, 'Fresh film stories');
    expect(q(box.el, 'desc').textContent).toBe('Fresh film stories');
    expect(q(box.el, 'count-description').textContent).toBe('18/160');
  });
  it('Reset to auto asks the screen to clear and the preview falls back', () => {
    const { box, inputs } = make({ metaTitle: 'Own title' }, { startOpen: true });
    expect(q(box.el, 'reset-title').hidden).toBe(false);
    q(box.el, 'reset-title').click();
    expect(inputs.metaTitle.value).toBe('');
    expect(q(box.el, 'title').textContent).toBe('Cinema | Shivam Das News');
    expect(q(box.el, 'reset-title').hidden).toBe(true);
  });
  it('the mode switch changes the crumb to the desktop trail', () => {
    const { box } = make();
    q(box.el, 'mode-desktop').click();
    expect(q(box.el, 'crumb').textContent).toBe('example.test \u203a category \u203a cinema');
    expect(q(box.el, 'mode-desktop').getAttribute('aria-pressed')).toBe('true');
    q(box.el, 'mode-mobile').click();
    expect(q(box.el, 'crumb').textContent).toBe('example.test');
  });
  it('shows warnings in the list and a red error for a title over 70', () => {
    const { box, inputs } = make({}, { startOpen: true });
    type(inputs.metaTitle, 'a'.repeat(65));
    expect(q(box.el, 'notes').querySelectorAll('li.warn')).toHaveLength(1);
    type(inputs.metaTitle, 'a'.repeat(75));
    expect(q(box.el, 'notes').querySelectorAll('li.stop')).toHaveLength(1);
    expect(q(box.el, 'count-title').className).toContain('stop');
    type(inputs.metaTitle, 'short');
    expect(q(box.el, 'notes').children).toHaveLength(0);
  });
  it('a role that may not edit sees the reset buttons disabled and hidden', () => {
    const { box } = make({ metaTitle: 'Own' }, { readOnly: true });
    expect((q(box.el, 'reset-title') as HTMLButtonElement).disabled).toBe(true);
    expect(q(box.el, 'reset-title').hidden).toBe(true);
  });
  it('text goes in as text, never as HTML', () => {
    const { box, inputs } = make({ title: '<img src=x onerror=alert(1)>' });
    type(inputs.metaDescription, '<script>alert(1)</script>');
    expect(box.el.querySelector('img')).toBeNull();
    expect(box.el.querySelector('script')).toBeNull();
    expect(q(box.el, 'desc').textContent).toBe('<script>alert(1)</script>');
  });
  it('an empty entry shows the placeholder texts', () => {
    const { box } = make({ title: '', description: '' });
    expect(q(box.el, 'title').textContent).toBe('Title');
    expect(q(box.el, 'desc').textContent).toBe('Search description appears here.');
  });
  it('the post box is unchanged: the old export is still there', async () => {
    const m: any = await import('../../public/admin/js/listing-box.js');
    expect(typeof m.listingBox).toBe('function');
    expect(typeof m.previewParts).toBe('function');
  });
});

describe('wiring in the dashboard', () => {
  const a = src('public/admin/js/app.js');
  it('imports the box and draws it on both screens', () => {
    expect(a).toContain("import { listingBox, entryBox } from './listing-box.js';");
    expect(a.match(/= entryListingBox\(\{/g)?.length).toBe(2);
    expect(a).toContain('seo.box.el');
  });
  it('categories and authors save the two search fields through mergeEntry', () => {
    expect(a).toMatch(/mergeEntry\(S\.cats\[s\], \{[^}]*metaTitle: inputs\[s\]\.seo\.metaTitle\.value\.trim\(\)/);
    expect(a).toMatch(/mergeEntry\(stored, \{[^}]*metaTitle: seo\.inputs\.metaTitle\.value\.trim\(\)/);
  });
  it('both screens lock the fields for a role that may not save', () => {
    expect(a).toContain("readOnly: !can(S.role, 'authors')");
    expect(a).toContain("readOnly: !can(S.role, 'categories')");
  });
  it('the box paths match the real page addresses', () => {
    expect(a).toContain('`/category/${s}/`');
    expect(a).toContain('`/author/${a.slug || slugify(f.slug.value)}/`');
  });
});
