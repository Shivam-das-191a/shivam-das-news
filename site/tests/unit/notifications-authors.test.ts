// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initNotificationsPage, readForm, fillForm, isAuthorSlug, MIN_AUTHORS, MAX_AUTHORS, MESSAGES, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

// v0.61.0 (push part 5c-4): the Authors block of /notifications/.
const HTML = (withAuthors: boolean) => `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech">
    <input type="checkbox" name="breakingAll" checked>
    ${withAuthors ? '<fieldset data-n-authors><input type="checkbox" name="author" value="ana-roy"><input type="checkbox" name="author" value="shivam-das"></fieldset>' : ''}
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option>${LIMIT_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom(withAuthors = true) { document.body.innerHTML = HTML(withAuthors); return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
const saved = { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true, authors: ['ana-roy'] };
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async () => o.enable ?? { ok: true, created: true, prefs: saved }),
    getPrefs: vi.fn(async () => o.getPrefs ?? { ok: true, prefs: saved }),
    savePrefs: vi.fn(async () => o.savePrefs ?? { ok: true, prefs: saved }),
    disable: vi.fn(async () => ({ ok: true })),
  };
}
const win = () => ({ navigator: { userAgent: 'Chrome' }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id) }) as any;
const sub = { status: stat({ subscribed: true, hasState: true }) };

describe('author ids', () => {
  it('the page accepts the same ids as the Worker', async () => {
    const w = await import('../../../workers/push/prefs.js');
    expect(MAX_AUTHORS).toBe(w.MAX_AUTHORS);
    const base = w.defaultPrefs('IN', []);
    for (const id of ['shivam-das', 'ana', 'a1-b2', 'x'.repeat(60), 'Ana', 'ana_roy', 'ana--roy', '-ana', 'ana-', '', 'x'.repeat(61), 'ana roy']) {
      // The page lists an id only when the Worker accepts it and stores it exactly as written (the Worker would lower-case "Ana", and the tick would then never match).
      const r = w.cleanPrefs({ authors: [id], breakingAll: true }, base);
      const same = r.ok === true && r.prefs.authors[0] === id;
      expect(isAuthorSlug(id), id).toBe(same);
    }
    expect(isAuthorSlug(undefined as any)).toBe(false);
    expect(isAuthorSlug(5 as any)).toBe(false);
  });
  it('the block needs at least two authors', () => {
    expect(MIN_AUTHORS).toBe(2);
  });
});

describe('the form', () => {
  it('reads the chosen authors', () => {
    const r = dom();
    $(r, 'input[value="ana-roy"]').checked = true;
    expect(readForm(r).authors).toEqual(['ana-roy']);
    $(r, 'input[value="shivam-das"]').checked = true;
    expect(readForm(r).authors).toEqual(['ana-roy', 'shivam-das']);
  });
  it('no author ticked sends an empty list (the reader removed them all)', () => {
    expect(readForm(dom()).authors).toEqual([]);
  });
  it('a page without the Authors block sends no authors field', () => {
    expect('authors' in readForm(dom(false))).toBe(false);
  });
  it('fills the saved authors, and leaves the ticks alone when the Worker sends no list', () => {
    const r = dom();
    fillForm(r, saved as any);
    expect($(r, 'input[value="ana-roy"]').checked).toBe(true);
    expect($(r, 'input[value="shivam-das"]').checked).toBe(false);
    fillForm(r, { ...saved, authors: undefined } as any);
    expect($(r, 'input[value="ana-roy"]').checked).toBe(true);
    fillForm(r, { ...saved, authors: ['shivam-das', 'gone-author'] } as any);
    expect($(r, 'input[value="ana-roy"]').checked).toBe(false);
    expect($(r, 'input[value="shivam-das"]').checked).toBe(true);
  });
  it('a page without the block ignores saved authors', () => {
    expect(() => fillForm(dom(false), saved as any)).not.toThrow();
  });
});

describe('the page', () => {
  it('shows the saved authors to a subscribed reader', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(sub), win: win() });
    expect($(r, 'input[value="ana-roy"]').checked).toBe(true);
  });
  it('turn on sends the chosen authors', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[value="shivam-das"]').checked = true;
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable.mock.calls[0][0].prefs.authors).toEqual(['shivam-das']);
  });
  it('save sends the changed authors; removing all sends an empty list', async () => {
    const r = dom();
    const c = client(sub);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[value="ana-roy"]').checked = false;
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs.mock.calls[0][0].prefs.authors).toEqual([]);
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.saved);
  });
  it('an author alone is not a choice (the Worker needs a category, keyword or breaking news)', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="breakingAll"]').checked = false;
    $(r, 'input[value="ana-roy"]').checked = true;
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.needChoice);
  });
  it('the template shows the block only from two authors with valid ids', () => {
    const t = readFileSync(join(process.cwd(), 'src/pages/notifications.astro'), 'utf8');
    expect(t).toContain('showAuthors = authors.length >= MIN_AUTHORS');
    expect(t).toContain('.filter(isAuthorSlug)');
    expect(t).toContain('data-n-authors');
  });
});
