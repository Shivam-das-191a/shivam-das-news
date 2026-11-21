// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
import { stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain JS modules served to the browser
import { listingBox, previewParts, isHidden } from '../../public/admin/js/listing-box.js';
// @ts-ignore
import { listing } from '../../public/admin/js/listing.js';
// @ts-ignore
import { can } from '../../public/admin/js/roles.js';
// @ts-ignore
import { nextRedirects } from '../../public/admin/js/redirects.js';

const q = (root: ParentNode, k: string) => root.querySelector(`[data-l="${k}"]`) as HTMLElement;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

function make(over: any = {}, opts: any = {}) {
  const d: any = { title: 'New phone launched in India today', metaTitle: '', description: '', permalink: '', category: 'technology', date: '2026-11-13T09:30:00Z', ...over };
  const inputs = { title: document.createElement('input'), description: document.createElement('textarea'), handle: document.createElement('input') };
  inputs.title.value = d.metaTitle; inputs.description.value = d.description; inputs.handle.value = d.permalink;
  inputs.title.addEventListener('input', (e: any) => { d.metaTitle = e.target.value; });
  inputs.description.addEventListener('input', (e: any) => { d.description = e.target.value; });
  inputs.handle.addEventListener('input', (e: any) => { d.permalink = e.target.value; });
  let body = over.body ?? 'The first paragraph of the story.';
  const onReset = vi.fn((k: string) => { if (k === 'title') { d.metaTitle = ''; inputs.title.value = ''; } if (k === 'description') { d.description = ''; inputs.description.value = ''; } if (k === 'handle') { d.permalink = ''; inputs.handle.value = ''; } });
  const box = listingBox({ d, getBody: () => body, inputs, ctx: () => ({ siteName: 'Shivam Das News', origin: 'https://example.test', timeZone: 'Asia/Kolkata' }), others: () => opts.others || [], selfId: 'me', readOnly: opts.readOnly, startOpen: opts.startOpen, onReset, handleIsAuto: opts.handleIsAuto, orig: opts.orig, canHide: opts.canHide, onHide: opts.onHide, now: () => new Date('2026-11-20T10:00:00Z') });
  document.body.replaceChildren(box.el);
  return { d, inputs, box, onReset, setBody: (b: string) => { body = b; } };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('previewParts (pure)', () => {
  const l = listing({ title: 'A headline', category: 'tech', permalink: 'a-headline', date: '2026-11-13T09:30:00Z', description: 'Short.' }, { siteName: 'S', origin: 'https://x.test', timeZone: 'Asia/Kolkata' });
  it('mobile shows the host, desktop shows the last two parts of the path as a trail', () => {
    expect(previewParts(l, 'mobile', 'x.test').crumb).toBe('x.test');
    expect(previewParts(l, 'desktop', 'x.test').crumb).toBe('x.test \u203a tech \u203a a-headline');
  });
  it('empty values get the placeholder texts', () => {
    const p = previewParts(listing({}, {}), 'mobile', '');
    expect(p.title).toBe('Headline');
    expect(p.description).toBe('Meta description appears here.');
  });
});

describe('Search engine listing box (jsdom)', () => {
  it('shows the preview with the automatic title, description and handle, and marks them auto', () => {
    const { box } = make();
    expect(q(box.el, 'title').textContent).toBe('New phone launched in India today | Shivam Das News');
    expect(q(box.el, 'desc').textContent).toBe('The first paragraph of the story.');
    expect(q(box.el, 'crumb').textContent).toBe('example.test');
    for (const k of ['title', 'description', 'handle']) expect((q(box.el, 'auto-' + k) as HTMLElement).hidden).toBe(false);
    expect(q(box.el, 'prefix').textContent).toBe('https://example.test/2026/11/13/blogs/technology/');
  });
  it('typing updates the preview and the counters at once, and the auto label goes away', () => {
    const { box, inputs } = make();
    type(inputs.title, 'My own title');
    type(inputs.description, 'A description typed by the owner.');
    expect(q(box.el, 'title').textContent).toBe('My own title');
    expect(q(box.el, 'desc').textContent).toBe('A description typed by the owner.');
    expect(q(box.el, 'count-title').textContent).toBe('12/60');
    expect((q(box.el, 'auto-title') as HTMLElement).hidden).toBe(true);
    expect((q(box.el, 'reset-title') as HTMLElement).hidden).toBe(false);
  });
  it('counters turn to warn above 60 and stop above 70, with a plain note', () => {
    const { box, inputs } = make();
    type(inputs.title, 'a'.repeat(61));
    expect(q(box.el, 'count-title').className).toContain('warn');
    expect(box.el.textContent).toContain('Google usually cuts after 60');
    type(inputs.title, 'a'.repeat(71));
    expect(q(box.el, 'count-title').className).toContain('stop');
    expect(box.el.textContent).toContain('the limit is 70');
    type(inputs.title, 'a'.repeat(60));
    expect(q(box.el, 'count-title').className).toBe('counter ok');
    expect(box.el.querySelectorAll('[data-l="note"]').length).toBe(0);
  });
  it('the preview is cut at 60 and 160 characters', () => {
    const { box, inputs } = make();
    type(inputs.title, 'word '.repeat(30));
    type(inputs.description, 'text '.repeat(60));
    expect(q(box.el, 'title').textContent!.length).toBeLessThanOrEqual(60);
    expect(q(box.el, 'desc').textContent!.length).toBeLessThanOrEqual(160);
  });
  it('Edit opens and closes the three fields (they stay in the page either way)', () => {
    const { box, inputs } = make();
    const panel = q(box.el, 'panel');
    expect(panel.hidden).toBe(true);
    expect(panel.contains(inputs.title) && panel.contains(inputs.description) && panel.contains(inputs.handle)).toBe(true);
    q(box.el, 'edit').click();
    expect(panel.hidden).toBe(false);
    expect(q(box.el, 'edit').getAttribute('aria-expanded')).toBe('true');
    expect(q(box.el, 'edit').textContent).toBe('Close');
    q(box.el, 'edit').click();
    expect(panel.hidden).toBe(true);
  });
  it('startOpen opens it for a new post', () => {
    expect(q(make({}, { startOpen: true }).box.el, 'panel').hidden).toBe(false);
  });
  it('Mobile and Desktop switch the preview and the pressed state', () => {
    const { box } = make({ permalink: 'my-handle' });
    q(box.el, 'mode-desktop').click();
    expect(q(box.el, 'crumb').textContent).toBe('example.test \u203a technology \u203a my-handle');
    expect(q(box.el, 'mode-desktop').getAttribute('aria-pressed')).toBe('true');
    expect(q(box.el, 'mode-mobile').getAttribute('aria-pressed')).toBe('false');
    q(box.el, 'mode-mobile').click();
    expect(q(box.el, 'crumb').textContent).toBe('example.test');
  });
  it('Reset to auto asks the editor to clear the value and the box shows the automatic one again', () => {
    const { box, inputs, onReset } = make({ metaTitle: 'Typed title' });
    expect(q(box.el, 'title').textContent).toBe('Typed title');
    q(box.el, 'reset-title').click();
    expect(onReset).toHaveBeenCalledWith('title');
    expect(inputs.title.value).toBe('');
    expect(q(box.el, 'title').textContent).toBe('New phone launched in India today | Shivam Das News');
  });
  it('the handle is auto while the editor says it still follows the headline', () => {
    const { box } = make({ permalink: 'from-title' }, { handleIsAuto: () => true });
    expect((q(box.el, 'auto-handle') as HTMLElement).hidden).toBe(false);
    const own = make({ permalink: 'from-title' }, { handleIsAuto: () => false });
    expect((q(own.box.el, 'auto-handle') as HTMLElement).hidden).toBe(true);
  });
  it('a read-only box has no Reset to auto', () => {
    const { box } = make({ metaTitle: 'Typed' }, { readOnly: true });
    expect((q(box.el, 'reset-title') as HTMLElement).hidden).toBe(true);
  });
  it('shows red errors: an emoji in the title and a handle already used the same day in the same category', () => {
    const { box, inputs } = make({ permalink: 'dup' }, { others: [{ id: 'o1', permalink: 'dup', category: 'technology', date: '2026-11-13T10:00:00Z' }] });
    expect(box.el.textContent).toContain('already used in this category on this date');
    type(inputs.title, 'Big news ' + String.fromCodePoint(0x1f525));
    expect(box.el.textContent).toContain('must not contain emoji');
    expect(box.el.querySelectorAll('[data-l="error"]').length).toBe(2);
  });
  it('the automatic description follows the body when the body changes', () => {
    const { box, setBody } = make();
    setBody('## Heading\n\nSecond version of the first paragraph.');
    box.refresh();
    expect(q(box.el, 'desc').textContent).toBe('Second version of the first paragraph.');
  });
  it('text from a post is shown as text, never as HTML', () => {
    const { box, inputs } = make();
    type(inputs.title, '<img src=x onerror=alert(1)>');
    expect(box.el.querySelector('img')).toBeNull();
    expect(q(box.el, 'title').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});


describe('nextRedirects: the 301 switch', () => {
  const prev = { status: 'published', category: 'technology', permalink: 'old-handle', date: '2026-11-12T09:00:00Z' };
  const next = { category: 'technology', permalink: 'new-handle', date: '2026-11-12T09:00:00Z', redirects: [] as string[] };
  it('keeps the old address by default and when keepOld is true', () => {
    expect(nextRedirects(prev, next, 'Asia/Kolkata')).toEqual(['/2026/11/12/blogs/technology/old-handle/']);
    expect(nextRedirects(prev, next, 'Asia/Kolkata', { keepOld: true })).toEqual(['/2026/11/12/blogs/technology/old-handle/']);
  });
  it('adds nothing only when keepOld is false, and still removes a loop', () => {
    expect(nextRedirects(prev, next, 'Asia/Kolkata', { keepOld: false })).toEqual([]);
    expect(nextRedirects(prev, { ...next, redirects: ['/2026/11/12/blogs/technology/new-handle/'] }, 'Asia/Kolkata', { keepOld: false })).toEqual([]);
    expect(nextRedirects(prev, { ...next, redirects: ['/old/one/'] }, 'Asia/Kolkata', { keepOld: false })).toEqual(['/old/one/']);
  });
  it('a draft never adds one', () => {
    expect(nextRedirects({ ...prev, status: 'draft' }, next, 'Asia/Kolkata')).toEqual([]);
  });
});

describe('the 301 question in the box (jsdom)', () => {
  const live = (date: string, status = 'published') => ({ status, permalink: 'old-handle', category: 'technology', date });
  const post = (date: string) => ({ permalink: 'old-handle', date });
  const rb = (box: any) => q(box.el, 'redirect-box') as HTMLElement;
  const cb = (box: any) => q(box.el, 'redirect') as HTMLInputElement;
  it('nothing is asked while the handle is unchanged, or for a new post', () => {
    expect(rb(make(post('2026-11-12T09:00:00Z'), { orig: live('2026-11-12T09:00:00Z') }).box).hidden).toBe(true);
    expect(rb(make({ permalink: 'x' }).box).hidden).toBe(true);
  });
  it('a post live for more than 24 hours: the redirect is required and the box is locked on', () => {
    const { box, inputs } = make(post('2026-11-12T09:00:00Z'), { orig: live('2026-11-12T09:00:00Z') });
    type(inputs.handle, 'new-handle');
    expect(rb(box).hidden).toBe(false);
    expect(cb(box).checked).toBe(true);
    expect(cb(box).disabled).toBe(true);
    expect(q(box.el, 'redirect-text').textContent).toContain('cannot be switched off');
    expect(box.keepRedirect()).toBe(true);
  });
  it('a post younger than 24 hours: on by default, can be switched off, and back on', () => {
    const { box, inputs } = make(post('2026-11-20T00:00:00Z'), { orig: live('2026-11-20T00:00:00Z') });
    type(inputs.handle, 'new-handle');
    expect(rb(box).hidden).toBe(false);
    expect(cb(box).checked).toBe(true);
    expect(cb(box).disabled).toBe(false);
    expect(box.keepRedirect()).toBe(true);
    cb(box).checked = false; cb(box).dispatchEvent(new Event('change', { bubbles: true }));
    expect(box.keepRedirect()).toBe(false);
    type(inputs.description, 'Another edit keeps the choice.');
    expect(box.keepRedirect()).toBe(false);
    cb(box).checked = true; cb(box).dispatchEvent(new Event('change', { bubbles: true }));
    expect(box.keepRedirect()).toBe(true);
  });
  it('the edge: exactly 24 hours can switch it off, 24 hours and a minute cannot', () => {
    const a = make(post('2026-11-19T10:00:00Z'), { orig: live('2026-11-19T10:00:00Z') });
    type(a.inputs.handle, 'n');
    expect(cb(a.box).disabled).toBe(false);
    const b = make(post('2026-11-19T09:59:00Z'), { orig: live('2026-11-19T09:59:00Z') });
    type(b.inputs.handle, 'n');
    expect(cb(b.box).disabled).toBe(true);
  });
  it('a draft is never asked, and going back to the old handle hides the question and resets the choice', () => {
    const d = make(post('2026-11-12T09:00:00Z'), { orig: live('2026-11-12T09:00:00Z', 'draft') });
    type(d.inputs.handle, 'new-handle');
    expect(rb(d.box).hidden).toBe(true);
    const y = make(post('2026-11-20T00:00:00Z'), { orig: live('2026-11-20T00:00:00Z') });
    type(y.inputs.handle, 'new-handle');
    cb(y.box).checked = false; cb(y.box).dispatchEvent(new Event('change', { bubbles: true }));
    type(y.inputs.handle, 'old-handle');
    expect(rb(y.box).hidden).toBe(true);
    expect(y.box.keepRedirect()).toBe(true);
  });
  it('an empty or invalid new handle, or one owned by another live post, shows a red note and no question', () => {
    const others = [{ id: 'o1', permalink: 'taken', category: 'technology', date: '2026-11-01T00:00:00Z', status: 'published' }];
    const a = make(post('2026-11-12T09:00:00Z'), { orig: live('2026-11-12T09:00:00Z'), others });
    type(a.inputs.handle, 'taken');
    expect(rb(a.box).hidden).toBe(true);
    expect(a.box.el.textContent).toContain('belongs to another live post');
    type(a.inputs.handle, 'Bad Handle');
    expect(rb(a.box).hidden).toBe(true);
    expect(a.box.el.querySelectorAll('[data-l="error"]').length).toBeGreaterThan(0);
  });
  it('a read-only box cannot change the choice', () => {
    const { box, inputs } = make(post('2026-11-20T00:00:00Z'), { orig: live('2026-11-20T00:00:00Z'), readOnly: true });
    type(inputs.handle, 'new-handle');
    expect(cb(box).disabled).toBe(true);
  });
});

// The same box inside the real editor.
const existing = stringify({ title: 'An older story about phones', permalink: 'older-story', category: 'technology', tags: [], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'x'.repeat(120), image: '/media/a.webp', imageAlt: 'A', status: 'published' }, 'Body.\n');
const files: Record<string, string> = {
  'site/content/blogs/technology/older-story.md': existing,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das' }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
};
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') { const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); const body = JSON.parse(init.body); puts.push({ path, body }); files[path] = decodeText(body.content); return json({ content: { sha: 'new-sha' } }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'DELETE') return json({});
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const youngDate = new Date(Date.now() - 2 * 3600000).toISOString().replace(/\.\d+Z$/, 'Z');
files['site/content/blogs/technology/young-story.md'] = stringify({ title: 'A young story about phones', permalink: 'young-story', category: 'technology', tags: [], date: youngDate, author: 'shivam-das', description: 'y'.repeat(120), image: '/media/a.webp', imageAlt: 'A', status: 'published' }, 'Body.\n');
const puts: { path: string; body: any }[] = [];
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe('the box inside the post editor (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });
  it('a new post shows the box open, the old Google card is gone, and typing a title fills the preview and the handle', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/new';
    await tick(250);
    expect(document.body.textContent).toContain('Search engine listing');
    expect(q(document.body, 'panel').hidden).toBe(false);
    expect([...document.querySelectorAll('h2')].some((e) => e.textContent === 'Google')).toBe(false);
    type(document.querySelector('input[placeholder^="Headline"]'), 'Brand new phone launched today');
    expect(q(document.body, 'title').textContent).toBe('Brand new phone launched today | Shivam Das News');
    expect((document.querySelector('input[placeholder="auto from title"]') as HTMLInputElement).value).toBe('brand-new-phone-launched-today');
    await tick(300);
    expect(q(document.body, 'count-handle').textContent).toBe('30');
  });
  it('an existing post shows the box closed with its own values, and Reset to auto on the handle follows the headline', async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/' + encodeURIComponent('site/content/blogs/technology/older-story.md');
    await tick(300);
    expect(q(document.body, 'panel').hidden).toBe(true);
    expect(q(document.body, 'desc').textContent).toBe('x'.repeat(120));
    expect(q(document.body, 'crumb').textContent).not.toBe('');
    q(document.body, 'reset-handle').click();
    expect((document.querySelector('input[placeholder="auto from title"]') as HTMLInputElement).value).toBe('older-story-about-phones');
  });
  const open = async (file: string) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/post/' + encodeURIComponent('site/content/blogs/technology/' + file);
    await tick(300);
  };
  const button = (t: string) => [...document.querySelectorAll('button')].find((e) => e.textContent!.trim() === t) as HTMLElement;
  it('an old live post: a new handle asks nothing to switch off and the saved file keeps the old address as a redirect', async () => {
    puts.length = 0;
    await open('older-story.md');
    type(document.querySelector('input[placeholder="auto from title"]'), 'older-story-renamed');
    expect((q(document.body, 'redirect-box') as HTMLElement).hidden).toBe(false);
    expect((q(document.body, 'redirect') as HTMLInputElement).disabled).toBe(true);
    vi.stubGlobal('confirm', () => true);
    button('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).toContain('/2026/11/12/blogs/technology/older-story/');
  });
  it('a young live post: switching the 301 off saves the post with no redirect; leaving it on keeps one', async () => {
    puts.length = 0;
    await open('young-story.md');
    type(document.querySelector('input[placeholder="auto from title"]'), 'young-story-renamed');
    const c = q(document.body, 'redirect') as HTMLInputElement;
    expect(c.disabled).toBe(false);
    c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true }));
    button('Update post').click();
    await tick(300);
    expect(puts[0].path).toBe('site/content/blogs/technology/young-story-renamed.md');
    expect(decodeText(puts[0].body.content)).not.toContain('/blogs/technology/young-story/');
    puts.length = 0;
    files['site/content/blogs/technology/young-story.md'] = existing.replace('older-story', 'young-story').replace(/date: .*/, 'date: ' + youngDate);
    document.body.innerHTML = '<div id="app"></div>'; location.hash = '';
    await open('young-story.md');
    type(document.querySelector('input[placeholder="auto from title"]'), 'young-story-kept');
    button('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).toContain('/blogs/technology/young-story/');
  });
});

// Phase 3b Part 4: the "Hide this page from search engines" switch (PLAN 33.2, LOGICS 21 hideFromSearch).
describe('isHidden and the role (pure)', () => {
  it('any robots value with noindex is hidden, anything else is not', () => {
    for (const r of ['noindex,follow', 'noindex,nofollow', 'NOINDEX, follow']) expect(isHidden(r)).toBe(true);
    for (const r of ['index,follow', 'index,nofollow', '', undefined, null]) expect(isHidden(r as any)).toBe(false);
  });
  it('only admins and editors may switch noindex; a writer may not', () => {
    expect(can('admin', 'post:noindex')).toBe(true);
    expect(can('editor', 'post:noindex')).toBe(true);
    expect(can('author', 'post:noindex')).toBe(false);
    expect(can(null, 'post:noindex')).toBe(false);
  });
});

describe('the hide switch in the box (jsdom)', () => {
  const sw = (box: any) => q(box.el, 'hide') as HTMLInputElement;
  const tickIt = (el: HTMLInputElement, on: boolean) => { el.checked = on; el.dispatchEvent(new Event('change', { bubbles: true })); };
  it('is off for a normal post: no note, no warning', () => {
    const { box } = make({ robots: 'index,follow' });
    expect(sw(box).checked).toBe(false);
    expect((q(box.el, 'hide-info') as HTMLElement).hidden).toBe(true);
    expect((q(box.el, 'hide-warn') as HTMLElement).hidden).toBe(true);
    expect(box.isHidden()).toBe(false);
  });
  it('is on for a post that already has noindex, and says what it removes', () => {
    const { box } = make({ robots: 'noindex,follow' });
    expect(sw(box).checked).toBe(true);
    const info = q(box.el, 'hide-info') as HTMLElement;
    expect(info.hidden).toBe(false);
    for (const w of ['sitemaps', 'news sitemap', 'push notifications']) expect(info.textContent).toContain(w);
  });
  it('ticking it calls onHide(true) and the box follows d.robots; un-ticking calls onHide(false)', () => {
    let boxRef: any;
    const calls: boolean[] = [];
    const onHide = (on: boolean) => { calls.push(on); (boxRef.d).robots = on ? 'noindex,follow' : 'index,follow'; };
    const m = make({ robots: 'index,follow' }, { onHide });
    boxRef = m;
    tickIt(sw(m.box), true);
    expect(calls).toEqual([true]);
    expect((q(m.box.el, 'hide-info') as HTMLElement).hidden).toBe(false);
    tickIt(sw(m.box), false);
    expect(calls).toEqual([true, false]);
    expect((q(m.box.el, 'hide-info') as HTMLElement).hidden).toBe(true);
  });
  it('shows the red note only when the post is hidden AND Breaking or Featured', () => {
    for (const flag of ['breaking', 'featured']) {
      const { box } = make({ robots: 'noindex,follow', [flag]: true });
      const w = q(box.el, 'hide-warn') as HTMLElement;
      expect(w.hidden).toBe(false);
      expect(w.textContent).toContain('Breaking or Featured');
    }
    const plain = make({ robots: 'noindex,follow' });
    expect((q(plain.box.el, 'hide-warn') as HTMLElement).hidden).toBe(true);
    const live = make({ robots: 'index,follow', breaking: true });
    expect((q(live.box.el, 'hide-warn') as HTMLElement).hidden).toBe(true);
  });
  it('the note appears at once when Breaking is switched on later (refresh)', () => {
    const { box, d } = make({ robots: 'noindex,follow' });
    expect((q(box.el, 'hide-warn') as HTMLElement).hidden).toBe(true);
    d.breaking = true; box.refresh();
    expect((q(box.el, 'hide-warn') as HTMLElement).hidden).toBe(false);
  });
  it('a role that may not switch noindex sees it locked with the reason; a read only post is locked too', () => {
    const w = make({ robots: 'index,follow' }, { canHide: false });
    expect(sw(w.box).disabled).toBe(true);
    expect((q(w.box.el, 'hide-info') as HTMLElement).textContent).toBe('Only editors and admins can change this.');
    const r = make({ robots: 'index,follow' }, { readOnly: true });
    expect(sw(r.box).disabled).toBe(true);
    const ok = make({ robots: 'index,follow' }, { canHide: true });
    expect(sw(ok.box).disabled).toBe(false);
  });
  it('the text is a text node: a tag in a value is never turned into HTML', () => {
    const { box } = make({ robots: 'noindex,follow', title: '<img src=x onerror=alert(1)>' });
    expect(box.el.querySelector('img')).toBeNull();
  });
});

describe('the hide switch inside the post editor (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; sessionStorage.setItem('adm.token', 'tok'); localStorage.clear(); location.hash = ''; });
  const openAs = async (file: string, role?: string) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => {
      if (role && new URL(String(u), 'http://localhost').pathname === '/admin/config.json') return Promise.resolve(new Response(JSON.stringify({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: { owner: role } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return api(String(u), i);
    }));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = file ? '#/post/' + encodeURIComponent('site/content/blogs/technology/' + file) : '#/post/new';
    await tick(300);
  };
  const robots = () => document.querySelector('select option[value="noindex,follow"]')!.parentElement as HTMLSelectElement;
  const btn = (t: string) => [...document.querySelectorAll('button')].find((e) => e.textContent!.trim() === t) as HTMLElement;
  it('ticking the switch sets the Robots list to noindex,follow and saves robots "noindex,follow"; un-ticking brings index,follow back', async () => {
    puts.length = 0;
    await openAs('older-story.md');
    const c = q(document.body, 'hide') as HTMLInputElement;
    expect(c.checked).toBe(false);
    c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    expect(robots().value).toBe('noindex,follow');
    expect((q(document.body, 'hide-info') as HTMLElement).hidden).toBe(false);
    vi.stubGlobal('confirm', () => true);
    btn('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).toContain('robots: "noindex,follow"');
    puts.length = 0;
    c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true }));
    expect(robots().value).toBe('index,follow');
    btn('Update post').click();
    await tick(300);
    expect(decodeText(puts[0].body.content)).not.toContain('noindex');
  });
  it('changing the Robots list by hand moves the switch', async () => {
    await openAs('older-story.md');
    const sel = robots();
    sel.value = 'noindex,nofollow'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect((q(document.body, 'hide') as HTMLInputElement).checked).toBe(true);
    sel.value = 'index,follow'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect((q(document.body, 'hide') as HTMLInputElement).checked).toBe(false);
  });
  it('Breaking plus hidden shows the red note in the editor', async () => {
    await openAs('older-story.md');
    const c = q(document.body, 'hide') as HTMLInputElement;
    c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    const breaking = [...document.querySelectorAll('label.pill')].find((l) => l.textContent!.trim() === 'Breaking')!.querySelector('input') as HTMLInputElement;
    breaking.checked = true; breaking.dispatchEvent(new Event('change', { bubbles: true }));
    expect((q(document.body, 'hide-warn') as HTMLElement).hidden).toBe(false);
  });
  it('a writer (author role) cannot use the switch or the Robots list on a new post', async () => {
    await openAs('', 'author');
    expect((q(document.body, 'hide') as HTMLInputElement).disabled).toBe(true);
    expect(robots().disabled).toBe(true);
  });
  it('a writer cannot sneak noindex in through a restored draft: Save is refused and nothing is written', async () => {
    puts.length = 0;
    localStorage.setItem('adm.draft.new', JSON.stringify({ d: { title: 'Sneaky story', robots: 'noindex,follow' }, body: 'Some body text.' }));
    vi.stubGlobal('confirm', () => true);
    await openAs('', 'author');
    btn('Save draft').click();
    await tick(300);
    expect(puts.length).toBe(0);
    expect(document.body.textContent).toContain('Only editors and admins can change what search engines may list.');
  });
  it('an editor can save a restored noindex draft (same text, role allowed)', async () => {
    puts.length = 0;
    localStorage.setItem('adm.draft.new', JSON.stringify({ d: { title: 'Allowed story', category: 'technology', robots: 'noindex,follow' }, body: 'Some body text.' }));
    vi.stubGlobal('confirm', () => true);
    await openAs('', 'editor');
    btn('Save draft').click();
    await tick(300);
    expect(puts.length).toBeGreaterThan(0);
    expect(decodeText(puts[0].body.content)).toContain('robots: "noindex,follow"');
  });
});

