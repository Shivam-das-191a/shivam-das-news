// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { initNotificationsPage, readForm, fillForm, hasChoice, isIos, MESSAGES, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech"><input type="checkbox" name="category" value="sports">
    <input type="checkbox" name="breakingAll" checked>
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option>${LIMIT_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom() { document.body.innerHTML = HTML; return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async () => o.enable ?? { ok: true, created: true, prefs: { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true } }),
    getPrefs: vi.fn(async () => o.getPrefs ?? { ok: true, prefs: { categories: ['sports'], level: 'important', dailyLimit: 2, breakingAll: false } }),
    savePrefs: vi.fn(async () => o.savePrefs ?? { ok: true, prefs: { categories: ['tech'], level: 'everything', dailyLimit: 8, breakingAll: true } }),
    disable: vi.fn(async () => o.disable ?? { ok: true, serverRemoved: true }),
  };
}
const win = (extra: any = {}) => ({ navigator: { userAgent: 'Chrome' }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id), ...extra }) as any;
const vis = (r: HTMLElement) => ({ form: !$(r, '[data-n-form]').hidden, on: !$(r, '[data-n-on]').hidden, save: !$(r, '[data-n-save]').hidden, off: !$(r, '[data-n-off]').hidden, ios: !$(r, '[data-n-ios]').hidden });

describe('form helpers', () => {
  it('reads and fills the choices', () => {
    const r = dom();
    fillForm(r, { categories: ['sports'], level: 'everything', dailyLimit: 4, breakingAll: false });
    expect(readForm(r)).toEqual({ categories: ['sports'], level: 'everything', dailyLimit: 4, breakingAll: false });
    fillForm(r, { categories: [], level: 'balanced', dailyLimit: null, breakingAll: true });
    expect(readForm(r)).toEqual({ categories: [], level: 'balanced', dailyLimit: null, breakingAll: true });
    fillForm(r, null as any);
  });
  it('needs a category or breaking news', () => {
    expect(hasChoice({ categories: [], breakingAll: false } as any)).toBe(false);
    expect(hasChoice({ categories: [], breakingAll: true } as any)).toBe(true);
    expect(hasChoice({ categories: ['a'], breakingAll: false } as any)).toBe(true);
  });
  it('knows iPhone and iPad (also an iPad that says it is a Mac)', () => {
    expect(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: 'Chrome Android' })).toBe(false);
    expect(isIos(undefined)).toBeFalsy();
  });
});

describe('the page states', () => {
  it('off: one plain sentence, nothing to press', async () => {
    const r = dom();
    const c = client({ status: stat({ enabled: false }) });
    expect((await initNotificationsPage({ root: r, cfg, client: c, win: win() })).state).toBe('off');
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.off);
    expect(vis(r)).toEqual({ form: false, on: false, save: false, off: false, ios: false });
  });
  it('a browser without push: a plain message', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ supported: false }) }), win: win() });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.unsupported);
    expect(vis(r).form).toBe(false);
  });
  it('an iPhone tab: the Home Screen steps, no form', async () => {
    const r = dom();
    const w = win({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } });
    const out = await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ supported: false }) }), win: w });
    expect(out.state).toBe('ios');
    expect(vis(r)).toEqual({ form: false, on: false, save: false, off: false, ios: true });
  });
  it('blocked by the browser: a message, no turn-on button; the unsubscribe button stays when this browser has a record', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ permission: 'denied' }) }), win: win() });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.denied);
    expect(vis(r)).toEqual({ form: false, on: false, save: false, off: false, ios: false });
    const r2 = dom();
    await initNotificationsPage({ root: r2, cfg, client: client({ status: stat({ permission: 'denied', hasState: true }) }), win: win() });
    expect(vis(r2).off).toBe(true);
  });
  it('new reader: the form with Balanced chosen and the turn-on button', async () => {
    const r = dom();
    const c = client();
    expect((await initNotificationsPage({ root: r, cfg, client: c, win: win() })).state).toBe('new');
    expect(vis(r)).toEqual({ form: true, on: true, save: false, off: false, ios: false });
    expect(readForm(r).level).toBe('balanced');
    expect(c.getPrefs).not.toHaveBeenCalled();
  });
  it('subscribed reader: saved choices are filled in, save and unsubscribe are shown', async () => {
    const r = dom();
    const out = await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ subscribed: true, hasState: true }) }), win: win() });
    expect(out.state).toBe('on');
    expect(readForm(r)).toEqual({ categories: ['sports'], level: 'important', dailyLimit: 2, breakingAll: false });
    expect(vis(r)).toEqual({ form: true, on: false, save: true, off: true, ios: false });
  });
  it('subscribed but the Worker says subscribe again: back to the turn-on form with a message', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ subscribed: true, hasState: true }), getPrefs: { ok: false, reason: 'resubscribe' } }), win: win() });
    expect(vis(r).on).toBe(true);
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.again);
  });
});

describe('the buttons', () => {
  it('turn on sends the choices and then shows save and unsubscribe', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[value="tech"]').checked = true;
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).toHaveBeenCalledWith({ cfg, prefs: { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true } });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.created);
    expect(vis(r)).toEqual({ form: true, on: false, save: true, off: true, ios: false });
    expect($(r, '[data-n-on]').disabled).toBe(false);
  });
  it('turn on without any choice does not call the client', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="breakingAll"]').checked = false;
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.needChoice);
  });
  it('the browser answer No or no answer gives a plain message and stays on the form', async () => {
    for (const [reason, text, state] of [['denied', MESSAGES.denied, 'blocked'], ['dismissed', MESSAGES.dismissed, 'new']] as const) {
      const r = dom();
      await initNotificationsPage({ root: r, cfg, client: client({ enable: { ok: false, reason } }), win: win() });
      $(r, '[data-n-on]').click();
      await tick();
      expect($(r, '[data-n-msg]').textContent).toBe(text);
      expect(r.getAttribute('data-state')).toBe(state);
    }
  });
  it('the Worker may refuse a choice: its sentence is shown as it is', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ enable: { ok: false, reason: 'invalid', error: 'The daily limit must be 1, 2, 4 or 8.' } }), win: win() });
    $(r, '[data-n-on]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe('The daily limit must be 1, 2, 4 or 8.');
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('1');
  });
  it('a thrown error never leaves the buttons locked', async () => {
    const r = dom();
    const c = client();
    c.enable.mockRejectedValueOnce(new Error('boom'));
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-on]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.error);
    expect($(r, '[data-n-on]').disabled).toBe(false);
  });
  it('save sends the choices and shows what the Worker really saved', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    // a subscribed reader
    const r2 = dom();
    const c2 = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r2, cfg, client: c2, win: win() });
    $(r2, '[data-n-save]').click();
    await tick();
    expect(c2.savePrefs).toHaveBeenCalledWith({ cfg, prefs: { categories: ['sports'], level: 'important', dailyLimit: 2, breakingAll: false } });
    expect($(r2, '[data-n-msg]').textContent).toBe(MESSAGES.saved);
    expect(readForm(r2).level).toBe('everything');
    expect(c.savePrefs).not.toHaveBeenCalled();
  });
  it('unsubscribe needs a second press, then deletes and returns to the turn-on form', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-off]').click();
    await tick();
    expect(c.disable).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.confirmOff);
    $(r, '[data-n-off]').click();
    await tick();
    expect(c.disable).toHaveBeenCalledTimes(1);
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.removed);
    expect(vis(r)).toEqual({ form: true, on: true, save: false, off: false, ios: false });
  });
  it('a failed unsubscribe keeps everything and says so', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }), disable: { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-off]').click(); await tick();
    $(r, '[data-n-off]').click(); await tick();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.error);
    expect(vis(r).off).toBe(true);
  });
});

describe('the page and the header', () => {
  const page = readFileSync('src/pages/notifications.astro', 'utf8');
  const header = readFileSync('src/components/Header.astro', 'utf8');
  it('is noindex, a utility page, and loads its script only when push is on', () => {
    expect(page).toContain('robots="noindex,follow"');
    expect(page).toContain('pageType="notifications"');
    expect(page).toMatch(/\{conf\.enabled && \(\s*<script>/);
  });
  it('has no ad code and no beacon', () => {
    expect(page).not.toMatch(/AdLoader|Beacon|adsClient/);
  });
  it('shows the bell link in the header only when push is on', () => {
    expect(header).toContain('{push && <a class="btn" href="/notifications/" aria-label="Notifications"><Icon name="bell"');
  });
  it('offers every alert level and daily limit the Worker accepts', () => {
    expect(LEVEL_CHOICES.map((x) => x[0])).toEqual(['breaking_only', 'important', 'balanced', 'everything']);
    expect(LIMIT_CHOICES).toEqual([1, 2, 4, 8]);
  });
});
