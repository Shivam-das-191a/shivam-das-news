// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toBase64, decodeText } from '../../public/admin/js/github.js';
// @ts-ignore plain JS dashboard code
import { PUSH_CHOICES, pushValue, cutWords, pushPreview, pushCount, cleanPush, pushNote } from '../../public/admin/js/push-fields.js';
// @ts-ignore plain JS dashboard code
import { PUSH_TITLE_MAX, PUSH_BODY_MAX } from '../../public/admin/js/validate.js';
// @ts-ignore plain JS dashboard code
import { parse } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain JS Worker code
import { cutText, TITLE_MAX, BODY_MAX } from '../../../workers/push/lib.js';
// @ts-expect-error plain .mjs helper
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('push editor rules (v0.96.0, part 7e-2)', () => {
  it('has the three choices, auto first, and each has a help text', () => {
    expect(PUSH_CHOICES.map((c: any) => c.value)).toEqual(['auto', 'off', 'force']);
    expect(PUSH_CHOICES.every((c: any) => c.label && c.help)).toBe(true);
  });
  it('pushValue falls back to auto for a missing or unknown value', () => {
    expect(pushValue({})).toBe('auto');
    expect(pushValue(undefined)).toBe('auto');
    expect(pushValue({ push: 'banana' })).toBe('auto');
    expect(pushValue({ push: 'off' })).toBe('off');
    expect(pushValue({ push: 'force' })).toBe('force');
  });
  it('cutWords gives the same answer as the Worker cutText on many texts and limits', () => {
    const texts = ['', 'short', 'a '.repeat(80), 'word '.repeat(60), 'x'.repeat(200), 'Hello,   world;  this is   a test.\n\nNew line here, and more words follow after it ok', 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen'];
    for (const t of texts) for (const m of [10, 25, TITLE_MAX, BODY_MAX]) expect(cutWords(t, m)).toBe(cutText(t, m));
  });
  it('uses the same limits as the Worker', () => {
    expect(PUSH_TITLE_MAX).toBe(TITLE_MAX);
    expect(PUSH_BODY_MAX).toBe(BODY_MAX);
  });
  it('preview: own text wins, otherwise headline and description, always inside the limits', () => {
    expect(pushPreview({ title: 'Big headline', description: 'Plain description' })).toEqual({ title: 'Big headline', body: 'Plain description', ownTitle: false, ownBody: false });
    const own = pushPreview({ title: 'Big headline', description: 'Plain', pushTitle: 'Short one', pushBody: 'Own body' });
    expect(own).toEqual({ title: 'Short one', body: 'Own body', ownTitle: true, ownBody: true });
    const long = pushPreview({ title: 'w '.repeat(100), description: 'd '.repeat(200) });
    expect([...long.title].length).toBeLessThanOrEqual(TITLE_MAX);
    expect([...long.body].length).toBeLessThanOrEqual(BODY_MAX);
    expect(pushPreview({}).title).toBe('Headline');
  });
  it('counter text counts characters, not bytes', () => {
    expect(pushCount('abc', 70)).toBe('3/70');
    expect(pushCount(undefined, 120)).toBe('0/120');
    expect(pushCount('\u0995\u0996\u0997', 70)).toBe('3/70');
  });
  it('cleanPush leaves auto and empty texts out and does not change the input', () => {
    const d = { title: 'T', push: 'auto', pushTitle: '   ', pushBody: '' };
    const c = cleanPush(d);
    expect('push' in c).toBe(false);
    expect('pushTitle' in c).toBe(false);
    expect('pushBody' in c).toBe(false);
    expect(d.push).toBe('auto');
    expect(cleanPush({ push: 'bad' }).push).toBeUndefined();
    expect(cleanPush({ push: 'off', pushTitle: '  Hi  ', pushBody: 'Body' })).toEqual({ push: 'off', pushTitle: 'Hi', pushBody: 'Body' });
  });
  it('notes: off, force on a draft, force on a noindex page, and nothing for auto', () => {
    expect(pushNote({ push: 'off' }, 'published')).toContain('will not send');
    expect(pushNote({ push: 'force' }, 'draft')).toContain('after the story is published');
    expect(pushNote({ push: 'force', robots: 'noindex,follow' }, 'published')).toContain('noindex');
    expect(pushNote({ push: 'force' }, 'published')).toBe('');
    expect(pushNote({}, 'draft')).toBe('');
  });
  it('the file has no emoji and no external import', () => {
    const src = read('../../public/admin/js/push-fields.js');
    expect(findEmoji(src)).toEqual([]);
    expect([...src.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1])).toEqual(['./validate.js']);
  });
});

const existing = '---\ntitle: "An older story about phones"\npermalink: "older-story"\ncategory: "technology"\ntags: []\ndate: 2026-11-12T09:00:00Z\nauthor: "shivam-das"\ndescription: "' + 'x'.repeat(60) + '"\nimage: "/media/a.webp"\nimageAlt: "alt"\npush: "off"\npushTitle: "Own title"\nstatus: "published"\nredirects: []\n---\n## Body\ntext\n';
const files: Record<string, string> = {
  'site/content/blogs/technology/older-story.md': existing,
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true, defaultAuthor: 'shivam-das' }),
};
const puts: { path: string; body: any }[] = [];
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  if (u.pathname.startsWith('/repos/o/r/contents/') && init.method === 'PUT') {
    const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
    const body = JSON.parse(init.body); puts.push({ path, body });
    files[path] = decodeText(body.content);
    return json({ content: { sha: 'new-sha' } });
  }
  if (u.pathname.startsWith('/repos/o/r/contents/')) { const p = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', '')); return files[p] ? json({ content: toBase64(files[p]), sha: 'sha-' + p }) : json({ message: 'Not Found' }, 404); }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const q = (sel: string) => document.querySelector(`[data-push="${sel}"]`) as any;
const type = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const pick = (el: any, v: string) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };

describe('Notifications box in the post editor (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; localStorage.clear(); sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });
  const open = async (hash: string) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    vi.stubGlobal('confirm', () => true);
    vi.resetModules();
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = hash;
    await tick(300);
  };

  it('a new post shows Auto, empty boxes, counters at zero and a preview from the headline', async () => {
    await open('#/post/new');
    expect(q('mode').value).toBe('auto');
    expect(q('title').value).toBe('');
    expect(q('title-count').textContent).toBe(`0/${PUSH_TITLE_MAX}`);
    expect(q('body-count').textContent).toBe(`0/${PUSH_BODY_MAX}`);
    expect(q('pv-title').textContent).toBe('Headline');
    expect(q('help').textContent).toContain('system scores');
  });

  it('typing updates the counters and the preview, and the limits are on the boxes', async () => {
    await open('#/post/new');
    expect(q('title').getAttribute('maxlength')).toBe(String(PUSH_TITLE_MAX));
    expect(q('body').getAttribute('maxlength')).toBe(String(PUSH_BODY_MAX));
    type(q('title'), 'Own title here');
    type(q('body'), 'Own body text');
    await tick(400);
    expect(q('title-count').textContent).toBe(`14/${PUSH_TITLE_MAX}`);
    expect(q('pv-title').textContent).toBe('Own title here');
    expect(q('pv-body').textContent).toBe('Own body text');
  });

  it('choosing Off shows the note and the help text', async () => {
    await open('#/post/new');
    pick(q('mode'), 'off');
    await tick(400);
    expect(q('note').textContent).toContain('will not send');
    expect(q('help').textContent).toContain('No notification');
  });

  it('an old post with push off and an own title opens with those values', async () => {
    await open('#/post/' + encodeURIComponent('site/content/blogs/technology/older-story.md'));
    expect(q('mode').value).toBe('off');
    expect(q('title').value).toBe('Own title');
    expect(q('pv-title').textContent).toBe('Own title');
  });

  it('saving writes the fields; choosing Auto again and clearing the texts removes them from the file', async () => {
    const path = 'site/content/blogs/technology/older-story.md';
    await open('#/post/' + encodeURIComponent(path));
    pick(q('mode'), 'force');
    type(q('body'), 'A body written by the editor');
    await tick(300);
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Update post') as HTMLElement;
    save.click();
    await tick(600);
    let data = parse(files[path]).data;
    expect(data.push).toBe('force');
    expect(data.pushTitle).toBe('Own title');
    expect(data.pushBody).toBe('A body written by the editor');

    pick(q('mode'), 'auto');
    type(q('title'), '');
    type(q('body'), '');
    await tick(300);
    ([...document.querySelectorAll('button')].find((b) => b.textContent === 'Update post') as HTMLElement).click();
    await tick(600);
    data = parse(files[path]).data;
    expect('push' in data).toBe(false);
    expect('pushTitle' in data).toBe(false);
    expect('pushBody' in data).toBe(false);
    expect(files[path]).not.toContain('push');
  });

  it('a notification text with an emoji stops the save with a clear message', async () => {
    const path = 'site/content/blogs/technology/older-story.md';
    await open('#/post/' + encodeURIComponent(path));
    const before = files[path];
    type(q('title'), 'Big news \u{1F525}');
    await tick(300);
    ([...document.querySelectorAll('button')].find((b) => b.textContent === 'Update post') as HTMLElement).click();
    await tick(600);
    expect(document.body.textContent).toContain('must not contain emoji');
    expect(files[path]).toBe(before);
  });
});

describe('docs and files (v0.96.0)', () => {
  it('the editor file imports the helper and uses cleanPush before saving', () => {
    const app = read('../../public/admin/js/app.js');
    expect(app).toContain("from './push-fields.js'");
    expect(app).toContain('{ ...cleanPush(d), status }');
  });
  it('the package version is 0.96.0 or newer (a test that needs the exact number breaks at every release)', () => {
    const v = JSON.parse(read('../../package.json')).version.split('.').map(Number);
    expect(v[0] > 0 || v[1] >= 96).toBe(true);
  });
});
