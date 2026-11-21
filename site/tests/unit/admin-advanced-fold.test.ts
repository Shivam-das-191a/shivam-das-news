// @vitest-environment jsdom
// Phase 3b Part 5b (v0.101.22): the Advanced fold of the Search engine listing box (PLAN 33.2).
// The rules were built and tested in Part 5a (listing.js, share.test.ts); here only the screen is tested.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain JS modules served to the browser
import { listingBox, safePreviewSrc } from '../../public/admin/js/listing-box.js';

const q = (root: ParentNode, k: string) => root.querySelector(`[data-l="${k}"]`) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const change = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };

function makeBox(over: any = {}, opts: any = {}) {
  const d: any = { title: 'New phone launched today', metaTitle: '', description: 'A short description of the story.', permalink: 'new-phone', category: 'technology', date: '2026-11-13T09:30:00Z', image: '/media/phone.webp', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', schemaType: 'NewsArticle', ...over };
  const mk = (tag: string, key: string) => { const e: any = document.createElement(tag); e.value = d[key] ?? ''; e.addEventListener('input', (ev: any) => { d[key] = ev.target.value; }); return e; };
  const inputs: any = { title: mk('input', 'metaTitle'), description: mk('textarea', 'description'), handle: mk('input', 'permalink'), ogTitle: mk('input', 'ogTitle'), ogDescription: mk('textarea', 'ogDescription'), ogImage: mk('input', 'ogImage'), canonical: mk('input', 'canonical') };
  const sel: any = document.createElement('select');
  for (const t of ['NewsArticle', 'Article', 'BlogPosting']) { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.append(o); }
  sel.value = d.schemaType;
  sel.addEventListener('change', (ev: any) => { d.schemaType = ev.target.value; });
  inputs.schemaType = sel;
  if (opts.noAdvanced) { delete inputs.ogTitle; delete inputs.ogDescription; delete inputs.ogImage; delete inputs.canonical; delete inputs.schemaType; }
  const onReset = vi.fn((k: string) => { if (k === 'ogTitle') { d.ogTitle = ''; inputs.ogTitle.value = ''; } if (k === 'ogDescription') { d.ogDescription = ''; inputs.ogDescription.value = ''; } if (k === 'ogImage') { d.ogImage = ''; inputs.ogImage.value = ''; } });
  const box = listingBox({ d, getBody: () => 'The first paragraph.', inputs, ctx: () => ({ siteName: 'Shivam Das News', origin: 'https://example.test', timeZone: 'Asia/Kolkata' }), others: () => [], selfId: 'x', readOnly: opts.readOnly, startOpen: false, handleIsAuto: () => false, orig: null, onReset, canCanonical: opts.canCanonical, previewSrc: opts.previewSrc });
  document.body.replaceChildren(box.el);
  return { d, inputs, box, onReset };
}
const notes = () => [...document.querySelectorAll('[data-l="notes"] li')].map((e) => e.textContent);

beforeEach(() => { document.body.innerHTML = ''; });

describe('safePreviewSrc (pure)', () => {
  it('allows a site path, http(s) and a dashboard preview', () => {
    expect(safePreviewSrc('/media/a.webp')).toBe('/media/a.webp');
    expect(safePreviewSrc('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(safePreviewSrc('blob:https://x.test/abc')).toBe('blob:https://x.test/abc');
    expect(safePreviewSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });
  it('refuses a script address, a protocol-relative address, other data, and nothing', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '//evil.test/a.png', 'data:text/html,<b>x</b>', 'media/a.webp', '', null, undefined]) expect(safePreviewSrc(bad as any)).toBe('');
  });
});

describe('checkCanonical with a relative own address (regression found while building Part 5b)', () => {
  it('does not throw when the own address is only a path (no site address known)', async () => {
    // @ts-ignore
    const { checkCanonical } = await import('../../public/admin/js/listing.js');
    expect(() => checkCanonical('https://other.test/a/', { selfUrl: '/2026/11/13/blogs/technology/x/', origin: '' })).not.toThrow();
    const r = checkCanonical('https://other.test/a/', { selfUrl: '/2026/11/13/blogs/technology/x/', origin: '' });
    expect(r.level).toBe('warn');
  });
});

describe('the Advanced fold (jsdom)', () => {
  it('a box made without the share inputs has no Advanced button (older screens keep working)', () => {
    const { box } = makeBox({}, { noAdvanced: true });
    expect(q(box.el, 'adv-toggle')).toBeNull();
    expect(q(box.el, 'adv')).toBeNull();
  });
  it('starts closed; the button opens and closes it and keeps aria-expanded true to the state', () => {
    const { box } = makeBox();
    const btn = q(box.el, 'adv-toggle');
    expect((q(box.el, 'adv') as HTMLElement).hidden).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    expect((q(box.el, 'adv') as HTMLElement).hidden).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(box.isAdvancedOpen()).toBe(true);
    btn.click();
    expect((q(box.el, 'adv') as HTMLElement).hidden).toBe(true);
  });
  it('shows the fallbacks (headline, description, featured image) and marks all three auto', () => {
    const { box } = makeBox();
    expect(q(box.el, 'share-title').textContent).toBe('New phone launched today');
    expect(q(box.el, 'share-desc').textContent).toBe('A short description of the story.');
    expect(q(box.el, 'share-host').textContent).toBe('example.test');
    expect(q(box.el, 'share-img').getAttribute('src')).toBe('https://example.test/media/phone.webp');
    for (const k of ['ogTitle', 'ogDescription', 'ogImage']) expect((q(box.el, 'auto-' + k) as HTMLElement).hidden).toBe(false);
    expect((q(box.el, 'use-featured') as HTMLElement).hidden).toBe(true);
  });
  it('typing a share title updates the card and the counter at once and the auto tag goes away', () => {
    const { box, inputs } = makeBox();
    type(inputs.ogTitle, 'A different share headline');
    expect(q(box.el, 'share-title').textContent).toBe('A different share headline');
    expect(q(box.el, 'count-ogTitle').textContent).toBe('26/60');
    expect((q(box.el, 'auto-ogTitle') as HTMLElement).hidden).toBe(true);
    expect((q(box.el, 'reset-ogTitle') as HTMLElement).hidden).toBe(false);
  });
  it('Reset to auto on the share title and description asks the editor to clear them', () => {
    const { box, inputs, onReset } = makeBox({ ogTitle: 'Own title', ogDescription: 'Own description' });
    q(box.el, 'reset-ogTitle').click();
    q(box.el, 'reset-ogDescription').click();
    expect(onReset.mock.calls.map((c: any) => c[0])).toEqual(['ogTitle', 'ogDescription']);
    expect(inputs.ogTitle.value).toBe('');
    expect(q(box.el, 'share-title').textContent).toBe('New phone launched today');
  });
  it('"Use the featured image" shows only with an own share picture, and clears it', () => {
    const { box, inputs, onReset } = makeBox({ ogImage: '/media/share.webp' });
    expect(q(box.el, 'share-img').getAttribute('src')).toBe('https://example.test/media/share.webp');
    const use = q(box.el, 'use-featured') as HTMLElement;
    expect(use.hidden).toBe(false);
    use.click();
    expect(onReset).toHaveBeenCalledWith('ogImage');
    expect(inputs.ogImage.value).toBe('');
    expect(q(box.el, 'share-img').getAttribute('src')).toBe('https://example.test/media/phone.webp');
    expect(use.hidden).toBe(true);
  });
  it('no picture at all shows the placeholder and says the site default is used', () => {
    const { box } = makeBox({ image: '' });
    expect((q(box.el, 'share-img') as HTMLElement).hidden).toBe(true);
    expect((q(box.el, 'share-noimg') as HTMLElement).hidden).toBe(false);
    expect(q(box.el, 'share-note').textContent).toContain('site default picture');
    expect(notes().join(' ')).not.toContain('No share picture');
  });
  it('the preview picture comes from previewSrc (a picture not saved yet) and never from a script address', () => {
    const { box, inputs } = makeBox({}, { previewSrc: (u: string) => (u === '/media/phone.webp' ? 'blob:https://example.test/new' : u) });
    expect(q(box.el, 'share-img').getAttribute('src')).toBe('blob:https://example.test/new');
    type(inputs.ogImage, 'javascript:alert(1)');
    expect(q(box.el, 'share-img').hasAttribute('src')).toBe(false);
    expect((q(box.el, 'share-img') as HTMLElement).hidden).toBe(true);
    expect(notes().join(' ')).toContain('The share picture must start with /');
  });
  it('a share title of 65 characters is a warning; 71 is a red error', () => {
    const { box, inputs } = makeBox();
    type(inputs.ogTitle, 'a'.repeat(65));
    expect(q(box.el, 'count-ogTitle').className).toContain('warn');
    expect([...box.el.querySelectorAll('[data-l="note"]')].some((e) => /apps usually cut after 60/.test(e.textContent || ''))).toBe(true);
    type(inputs.ogTitle, 'a'.repeat(71));
    expect(q(box.el, 'count-ogTitle').className).toContain('stop');
    expect([...box.el.querySelectorAll('[data-l="error"]')].some((e) => /Share title is 71 characters; the limit is 70/.test(e.textContent || ''))).toBe(true);
  });
  it('a share description over 320 characters and an emoji in the share text are red errors', () => {
    const { box, inputs } = makeBox();
    type(inputs.ogDescription, 'b'.repeat(321));
    expect(notes().join(' ')).toContain('limit is 320');
    type(inputs.ogDescription, 'fine text');
    type(inputs.ogTitle, 'Big news \u{1F525}');
    expect(notes().join(' ')).toContain('emoji');
  });
  it('the canonical: empty says nothing; another website and the own address are warnings; not an address is red', () => {
    const { box, inputs } = makeBox();
    expect(q(box.el, 'canon-info').textContent).toBe('');
    type(inputs.canonical, 'https://other.test/original/');
    expect(q(box.el, 'canon-info').textContent).toContain('another website');
    expect(notes().join(' ')).toContain('another website');
    type(inputs.canonical, 'https://example.test/2026/11/13/blogs/technology/new-phone/');
    expect(q(box.el, 'canon-info').textContent).toContain('own address');
    type(inputs.canonical, 'not an address');
    expect([...box.el.querySelectorAll('[data-l="error"]')].length).toBeGreaterThan(0);
    expect(q(box.el, 'canon-info').textContent).toBe('');
  });
  it('a role that may not change the canonical sees it locked with the reason; a read only post is locked too', () => {
    const a = makeBox({}, { canCanonical: false });
    expect(a.inputs.canonical.disabled).toBe(true);
    expect(q(a.box.el, 'canon-info').textContent).toBe('Only editors and admins can change this.');
    const b = makeBox({}, { readOnly: true });
    expect(b.inputs.canonical.disabled).toBe(true);
    expect((q(b.box.el, 'use-featured') as HTMLButtonElement).disabled).toBe(true);
    const c = makeBox();
    expect(c.inputs.canonical.disabled).toBe(false);
  });
  it('a schema type outside the three is a red error; the three are fine', () => {
    const { box, inputs } = makeBox();
    change(inputs.schemaType, 'Article');
    expect(notes()).toEqual([]);
    inputs.schemaType.add(new Option('Weird', 'Weird'));
    change(inputs.schemaType, 'Weird');
    expect(notes().join(' ')).toContain('Schema type must be one of');
  });
  it('the texts are text nodes: a tag in the share title never becomes HTML', () => {
    const { box, inputs } = makeBox();
    type(inputs.ogTitle, '<img src=x onerror=alert(1)>');
    expect(q(box.el, 'share-title').querySelector('img')).toBeNull();
    expect(q(box.el, 'share-title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(box.el.querySelectorAll('img').length).toBe(1);
  });
});

// ---------- inside the post editor ----------
const files: Record<string, string> = {
  'site/content/blogs/technology/older-story.md': stringify({ title: 'An older story about phones', permalink: 'older-story', category: 'technology', tags: [], date: '2026-10-01T09:00:00Z', author: 'shivam-das', description: 'd'.repeat(120), image: '/media/a.webp', imageAlt: 'A', status: 'published' }, 'Body text.\n'),
  'site/content/blogs/technology/copy-story.md': stringify({ title: 'A copied story about phones', permalink: 'copy-story', category: 'technology', tags: [], date: '2026-10-02T09:00:00Z', author: 'shivam-das', description: 'd'.repeat(120), canonical: 'https://other.test/original/', status: 'draft' }, 'Body text.\n'),
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das' }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
};
const puts: { path: string; body: any }[] = [];
function api(url: string, init: any = {}, role?: string) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: role ? { owner: role } : {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') { const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); const body = JSON.parse(init.body); puts.push({ path, body }); files[path] = decodeText(body.content); return json({ content: { sha: 'new-sha' } }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'DELETE') return json({});
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const btn = (t: string) => [...document.querySelectorAll('button')].find((e) => e.textContent!.trim() === t) as HTMLElement;

describe('the Advanced fold inside the post editor (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; sessionStorage.setItem('adm.token', 'tok'); localStorage.clear(); location.hash = ''; puts.length = 0; vi.stubGlobal('confirm', () => true); });
  const openAs = async (file: string, role?: string) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i, role)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = file ? '#/post/' + encodeURIComponent('site/content/blogs/technology/' + file) : '#/post/new';
    await tick(300);
  };
  it('shows the fold closed, and the canonical and the schema type are in it only once (not in Details any more)', async () => {
    await openAs('older-story.md');
    expect((q(document.body, 'adv') as HTMLElement).hidden).toBe(true);
    expect(document.querySelectorAll('input[placeholder="leave empty for the default"]').length).toBe(1);
    expect(q(document.body, 'adv').contains(document.querySelector('input[placeholder="leave empty for the default"]'))).toBe(true);
    expect([...document.querySelectorAll('label')].filter((l) => l.textContent!.trim() === 'Schema type').length).toBe(1);
    expect(document.querySelector('select option[value="BlogPosting"]')!.closest('[data-l="adv"]')).not.toBeNull();
  });
  it('saves a typed share title, description and picture as front matter and leaves empty ones out', async () => {
    await openAs('older-story.md');
    q(document.body, 'adv-toggle').click();
    type(document.querySelector('input[placeholder="empty means the page title"]'), 'Share headline');
    type(document.querySelector('textarea[placeholder="empty means the meta description"]'), 'Share text for apps.');
    btn('Update post').click();
    await tick(300);
    const text = decodeText(puts[0].body.content);
    expect(text).toContain('ogTitle: "Share headline"');
    expect(text).toContain('ogDescription: "Share text for apps."');
    expect(text).not.toContain('ogImage');
    expect(text).not.toContain('canonical');
  });
  it('"Use the featured image" empties the share picture so the file no longer holds it', async () => {
    await openAs('older-story.md');
    q(document.body, 'adv-toggle').click();
    type(document.querySelector('input[placeholder="empty means the featured image"]'), '/media/share.webp');
    expect((q(document.body, 'share-img') as HTMLElement).getAttribute('src')).toBe('/media/share.webp');
    q(document.body, 'use-featured').click();
    expect((document.querySelector('input[placeholder="empty means the featured image"]') as HTMLInputElement).value).toBe('');
    btn('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).not.toContain('ogImage');
  });
  it('an admin can save a canonical address', async () => {
    await openAs('older-story.md');
    type(document.querySelector('input[placeholder="leave empty for the default"]'), 'https://other.test/original/');
    btn('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).toContain('canonical: "https://other.test/original/"');
  });
  it('a writer sees the canonical locked; a restored draft with a canonical is refused and nothing is written', async () => {
    localStorage.setItem('adm.draft.new', JSON.stringify({ d: { title: 'Sneaky story', canonical: 'https://other.test/x/' }, body: 'Some body text.' }));
    await openAs('', 'author');
    expect((document.querySelector('input[placeholder="leave empty for the default"]') as HTMLInputElement).disabled).toBe(true);
    expect(q(document.body, 'canon-info').textContent).toBe('Only editors and admins can change this.');
    btn('Save draft').click();
    await tick(300);
    expect(puts.length).toBe(0);
    expect(document.body.textContent).toContain('Only editors and admins can change the canonical address.');
  });
  it('an editor can save a draft that has a canonical', async () => {
    localStorage.setItem('adm.draft.new', JSON.stringify({ d: { title: 'Allowed story', category: 'technology', canonical: 'https://other.test/x/' }, body: 'Some body text.' }));
    await openAs('', 'editor');
    btn('Save draft').click();
    await tick(300);
    expect(puts.length).toBeGreaterThan(0);
    expect(decodeText(puts[0].body.content)).toContain('canonical: "https://other.test/x/"');
  });
  it('an existing canonical that a writer leaves alone does not block a save', async () => {
    await openAs('copy-story.md', 'author');
    btn('Save draft').click();
    await tick(300);
    expect(puts.length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Only editors and admins can change the canonical address.');
  });
});
