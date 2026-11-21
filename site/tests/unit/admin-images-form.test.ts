// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { toBase64 } from '../../public/admin/js/github.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

const files: Record<string, string> = {
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
};
let imagesText: string | undefined;
let roles: Record<string, string> = {};
let imagesDelay = 0;
const writes: string[] = [];
const puts: { path: string; body: any }[] = [];
let putStatus = 0; // when set, a PUT answers with this status

function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (init.method && init.method !== 'GET') writes.push(`${init.method} ${u.pathname}`);
  if (init.method === 'PUT' && u.pathname === '/repos/o/r/contents/site/config/images.json') {
    const body = JSON.parse(init.body);
    puts.push({ path: 'site/config/images.json', body: { ...body, text: Buffer.from(body.content, 'base64').toString('utf8') } });
    if (putStatus) return json({ message: 'GitHub says: token ghp_SECRET' }, putStatus);
    imagesText = Buffer.from(body.content, 'base64').toString('utf8');
    return json({ content: { sha: 'new-sha' } });
  }
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  const all = () => ({ ...files, ...(imagesText !== undefined ? { 'site/config/images.json': imagesText } : {}) });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(all()).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(all()[p]) }); }
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/')) {
    const found = all()[path];
    const answer = () => (found !== undefined ? json({ content: toBase64(found), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404));
    return path === 'site/config/images.json' && imagesDelay ? new Promise((r) => setTimeout(() => r(answer()), imagesDelay)) : answer();
  }
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const texts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent!.trim());
const valueOf = (key: string) => (document.querySelector(`[data-key="${key}"] [data-f="value"]`) as HTMLElement | null)?.textContent;

const ctl = (key: string) => document.querySelector(`[data-f="images-form"] [data-key="${key}"]`) as any;
const typeIn = (key: string, value: string) => { const c = ctl(key); c.value = value; c.dispatchEvent(new Event('input', { bubbles: true })); };
const changes = () => texts('[data-f="images-form"] [data-f="changes"] li');
const errors = () => texts('[data-f="images-form"] [data-f="errors"] li');
const fileText = () => document.querySelector('[data-f="images-form"] [data-f="filetext"]')!.textContent!;

describe('The picture settings form on the Picture settings screen (jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    writes.length = 0; puts.length = 0; putStatus = 0; imagesText = undefined; roles = {}; imagesDelay = 0;
    sessionStorage.setItem('adm.token', 'tok'); location.hash = '';
  });
  const open = async (hash = '#/images', wait = 400) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = hash;
    await tick(wait);
  };

  it('shows the form under the read only screen, once, with eleven controls filled from the file', async () => {
    imagesText = JSON.stringify({ quality: 70, maxWidth: 1200, blockHosts: ['bad.example.com'], askFirst: true });
    await open();
    const main = document.querySelector('main')!;
    const order = [...main.children].map((e) => e.getAttribute('data-f') || e.tagName.toLowerCase());
    expect(order.indexOf('images-screen')).toBeGreaterThan(-1);
    expect(order.indexOf('images-form')).toBeGreaterThan(order.indexOf('images-screen'));
    expect(texts('main h2')).toContain('Try a change');
    expect(document.querySelectorAll('[data-f="images-form"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-f="images-form"] [data-key]:is(input, select, textarea)')).toHaveLength(11);
    expect(ctl('quality').value).toBe('70');
    expect(ctl('maxWidth').value).toBe('1200');
    expect(ctl('blockHosts').value).toBe('bad.example.com');
    expect(ctl('askFirst').checked).toBe(true);
    expect(ctl('sizeWarnKb').value).toBe('0'); // not in the file: shipped value
  });
  it('a missing or bad file: the form starts from the shipped values, and the note above says why', async () => {
    for (const bad of [undefined, '{ bad', '[1]']) {
      imagesText = bad;
      await open();
      expect(ctl('quality').value).toBe('85');
      expect((document.querySelector('[data-f="images-screen"] [data-f="note"]') as HTMLElement).hidden).toBe(false);
      expect(changes()).toEqual(['Nothing is changed.']);
    }
  });
  it('typing a good value shows the change and the new text; nothing is written to GitHub', async () => {
    imagesText = JSON.stringify({ hardBlock: false, quality: 70 });
    await open();
    typeIn('quality', '60');
    expect(changes()).toEqual(['Picture quality: 70 of 100 -> 60 of 100']);
    expect(JSON.parse(fileText()).quality).toBe(60);
    expect(errors()).toEqual([]);
    expect(writes).toEqual([]);
  });
  it('typing a wrong value shows its sentence and no text; nothing is written', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', 'abc');
    expect(errors()).toEqual(['Picture quality must be a whole number from 1 to 100 (a percent).']);
    expect(ctl('quality').getAttribute('aria-invalid')).toBe('true');
    expect(fileText()).toBe('');
    expect(writes).toEqual([]);
  });
  it('the new text keeps the keys of the file that the code does not know', async () => {
    imagesText = JSON.stringify({ quality: 70, futureSetting: { a: 1 } });
    await open();
    typeIn('quality', '65');
    expect(JSON.parse(fileText()).futureSetting).toEqual({ a: 1 });
  });
  it('the read only screen above and the form below do not change each other (the screen keeps the file values)', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    expect(valueOf('quality')).toBe('70 of 100');
  });
  it('the read only screen and the form have no button, link or form tag; the only button is Save, outside the form', async () => {
    await open();
    expect(document.querySelectorAll('[data-f="images-screen"] :is(button, a, form), [data-f="images-form"] :is(button, a, form)')).toHaveLength(0);
    expect(document.querySelectorAll('main button')).toHaveLength(1);
    expect(document.querySelectorAll('main form')).toHaveLength(0);
    expect(document.querySelector('[data-f="images-save-row"] [data-f="images-save"]')!.textContent).toBe('Save picture settings');
    expect(document.querySelector('[data-f="images-form"] [data-f="intro"]')!.textContent).toContain('press Save picture settings');
  });
  it('an editor sees no form', async () => {
    roles = { owner: 'editor' };
    await open();
    expect(document.querySelectorAll('[data-f="images-form"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('Only admins can see the picture settings.');
  });
  it('a late answer does not draw the form over another screen', async () => {
    imagesText = JSON.stringify({ quality: 60 });
    imagesDelay = 150;
    await open('#/images', 20);
    location.hash = '#/settings';
    await tick(400);
    expect(document.querySelector('h1')!.textContent).toBe('Settings');
    expect(document.querySelectorAll('[data-f="images-form"]')).toHaveLength(0);
  });
  it('opening the screen twice gives one form, not two', async () => {
    await open();
    location.hash = '#/settings'; await tick(200);
    location.hash = '#/images'; await tick(400);
    expect(document.querySelectorAll('[data-f="images-form"]')).toHaveLength(1);
  });
  it('the code of the view writes only through saveImagesSettings: no put, remove, commit or network call of its own', () => {
    const app = src('public/admin/js/app.js');
    const body = app.slice(app.indexOf('async function imagesView()'), app.indexOf('async function linksView()'));
    expect(body).toContain('imagesFormScreen({ settings, currentText, onChange');
    expect(body).toContain('saveImagesSettings(S.gh, S.cfg, r.settings, { loadedText: loaded })');
    expect(body).not.toMatch(/\.put\(|\.remove\(|\.commit|fetch\(|localStorage|sessionStorage|innerHTML/);
  });
});

describe('The Save button of the Picture settings screen (Part 7ad, jsdom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    writes.length = 0; puts.length = 0; putStatus = 0; imagesText = undefined; roles = {}; imagesDelay = 0;
    sessionStorage.setItem('adm.token', 'tok'); location.hash = '';
  });
  const open = async (wait = 400) => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/images';
    await tick(wait);
  };
  const btn = () => document.querySelector('[data-f="images-save"]') as HTMLButtonElement;
  const toastText = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent);
  const toastBad = () => document.querySelectorAll('.toast.bad').length;
  const click = async () => { btn().click(); await tick(400); };
  const FILE = 'site/config/images.json';

  it('is on the screen once, enabled while every value is right and disabled while one is wrong', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    expect(document.querySelectorAll('[data-f="images-save"]')).toHaveLength(1);
    expect(btn().disabled).toBe(false);
    typeIn('quality', 'abc');
    expect(btn().disabled).toBe(true);
    typeIn('quality', '65');
    expect(btn().disabled).toBe(false);
  });
  it('a wrong value: the disabled button writes nothing', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '999');
    await click();
    expect(puts).toHaveLength(0);
    expect(writes).toEqual([]);
  });
  it('a good change: ONE put to config/images.json with the sha, the message and the new text', async () => {
    imagesText = JSON.stringify({ quality: 70, maxWidth: 1200 });
    await open();
    typeIn('quality', '60');
    await click();
    expect(puts).toHaveLength(1);
    expect(writes).toEqual(['PUT /repos/o/r/contents/' + FILE]);
    expect(puts[0].body.sha).toBe('sha-' + FILE);
    expect(puts[0].body.branch).toBe('main');
    expect(puts[0].body.message).toBe('admin: picture settings');
    const saved = JSON.parse(puts[0].body.text);
    expect(saved.quality).toBe(60);
    expect(saved.maxWidth).toBe(1200);
    expect(puts[0].body.text.endsWith('\n')).toBe(true);
  });
  it('after a save: a good message, and the screen is drawn again from the new file', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    await click();
    expect(toastText()).toContain('Saved. The site updates in about 2 minutes.');
    expect(toastBad()).toBe(0);
    expect(valueOf('quality')).toBe('60 of 100');
    expect(ctl('quality').value).toBe('60');
    expect(changes()).toEqual(['Nothing is changed.']);
    expect(document.querySelectorAll('[data-f="images-form"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-f="images-save"]')).toHaveLength(1);
  });
  it('after a save, a second click with no new change writes nothing and says so', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    await click();
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    await click();
    expect(puts).toHaveLength(1);
    expect(toastText()).toContain('Nothing to save: the file already has these values.');
  });
  it('no change at all: no put, and the message says nothing was saved', async () => {
    imagesText = src('config/images.json');
    await open();
    await click();
    expect(puts).toHaveLength(0);
    expect(toastText()).toContain('Nothing to save: the file already has these values.');
  });
  it('a file that lacks some keys is completed with the shipped values when Save is pressed, even with no typing', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    await click();
    expect(puts).toHaveLength(1);
    const saved = JSON.parse(puts[0].body.text);
    expect(saved.quality).toBe(70);
    expect(Object.keys(saved)).toHaveLength(11);
  });
  it('a file that only differs in layout from the new text is not written again', async () => {
    imagesText = JSON.stringify({ hardBlock: false, blockHosts: [], allowHosts: [], sizeWarnKb: 0, maxWidth: 0, quality: 85, storage: 'repo', askFirst: false, askHosts: [], nameOrder: ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle'], enabled: true });
    await open();
    await click();
    expect(puts).toHaveLength(0);
  });
  it('the file was changed by someone else after the page was opened: nothing is written and the sentence says why', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    imagesText = JSON.stringify({ quality: 50 }); // someone else saved
    await click();
    expect(puts).toHaveLength(0);
    expect(toastBad()).toBe(1);
    expect(toastText().join(' ')).toContain('changed by someone else');
    expect(ctl('quality').value).toBe('60'); // what the person typed is still there
    expect(btn().disabled).toBe(false);
  });
  it('a missing file is written new, with no sha, and the note goes away', async () => {
    await open();
    expect((document.querySelector('[data-f="images-screen"] [data-f="note"]') as HTMLElement).hidden).toBe(false);
    typeIn('quality', '60');
    await click();
    expect(puts).toHaveLength(1);
    expect(puts[0].body.sha).toBeUndefined();
    expect(JSON.parse(puts[0].body.text)).toMatchObject({ quality: 60, enabled: true, storage: 'repo' });
    expect((document.querySelector('[data-f="images-screen"] [data-f="note"]') as HTMLElement).hidden).toBe(true);
  });
  it('a broken file can be repaired from the form (it is replaced, with its sha)', async () => {
    imagesText = '{ bad';
    await open();
    typeIn('quality', '60');
    await click();
    expect(puts).toHaveLength(1);
    expect(puts[0].body.sha).toBe('sha-' + FILE);
    expect(JSON.parse(puts[0].body.text).quality).toBe(60);
    expect(toastBad()).toBe(0);
  });
  it('keeps the keys of the file that the code does not know', async () => {
    imagesText = JSON.stringify({ quality: 70, futureSetting: { a: 1 } });
    await open();
    typeIn('quality', '65');
    await click();
    expect(JSON.parse(puts[0].body.text).futureSetting).toEqual({ a: 1 });
  });
  it('lists and the naming order go through the save as typed', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('blockHosts', 'Bad.Example.com\nbad.example.com');
    typeIn('nameOrder', 'heading, alt, handle');
    await click();
    const saved = JSON.parse(puts[0].body.text);
    expect(saved.blockHosts).toEqual(['bad.example.com']);
    expect(saved.nameOrder).toEqual(['heading', 'alt', 'handle']);
  });
  it('GitHub refuses with 403: a red message with a fixed sentence, nothing leaks, the typed values stay', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    putStatus = 403;
    await click();
    expect(puts).toHaveLength(1);
    expect(toastBad()).toBe(1);
    expect(toastText().join(' ')).toContain('GitHub did not allow this change');
    expect(document.body.textContent).not.toMatch(/ghp_|SECRET/);
    expect(ctl('quality').value).toBe('60');
    expect(btn().disabled).toBe(false);
  });
  it('GitHub answers 409: the message says someone saved at the same moment', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    putStatus = 409;
    await click();
    expect(toastBad()).toBe(1);
    expect(toastText().join(' ')).toContain('Someone else saved at the same moment');
  });
  it('GitHub answers 500: a fixed sentence, nothing leaks', async () => {
    imagesText = JSON.stringify({ quality: 70 });
    await open();
    typeIn('quality', '60');
    putStatus = 500;
    await click();
    expect(toastText().join(' ')).toContain('could not be saved');
    expect(document.body.textContent).not.toMatch(/ghp_|SECRET/);
  });
  it('an editor sees no Save button and nothing is written', async () => {
    roles = { owner: 'editor' };
    await open();
    expect(document.querySelectorAll('[data-f="images-save"]')).toHaveLength(0);
    expect(writes).toEqual([]);
  });
  it('opening the screen twice gives one Save button, and a late answer draws none over another screen', async () => {
    imagesText = JSON.stringify({ quality: 60 });
    imagesDelay = 150;
    await open(20);
    location.hash = '#/settings';
    await tick(400);
    expect(document.querySelectorAll('[data-f="images-save"]')).toHaveLength(0);
    imagesDelay = 0;
    location.hash = '#/images';
    await tick(400);
    expect(document.querySelectorAll('[data-f="images-save"]')).toHaveLength(1);
  });
});
