// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { initNotificationsPage, readForm, fillForm, quietProblem, syncQuiet, MESSAGES, QUIET_DEFAULT, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

// v0.59.0 (push part 5c-2): quiet hours and "breaking news in quiet hours" on /notifications/.
const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech">
    <input type="checkbox" name="breakingAll" checked>
    <input type="checkbox" name="quietOn" checked>
    <input type="time" name="quietStart" value="22:00"><input type="time" name="quietEnd" value="07:00">
    <input type="checkbox" name="breakingInQuiet">
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
const saved = { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true, quiet: { start: '23:30', end: '06:15' }, breakingInQuiet: true };
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

describe('quietProblem', () => {
  it('accepts off, not sent and a good pair', () => {
    expect(quietProblem({})).toBeNull();
    expect(quietProblem({ quiet: null })).toBeNull();
    expect(quietProblem({ quiet: { start: '22:00', end: '07:00' } })).toBeNull();
    expect(quietProblem({ quiet: { start: '00:00', end: '23:59' } })).toBeNull();
  });
  it('refuses the same time twice', () => {
    expect(quietProblem({ quiet: { start: '08:00', end: '08:00' } })).toBe(MESSAGES.quietSame);
  });
  it('refuses an empty or wrong time', () => {
    expect(quietProblem({ quiet: { start: '', end: '07:00' } })).toBe(MESSAGES.quietMissing);
    expect(quietProblem({ quiet: { start: '22:00', end: '25:00' } })).toBe(MESSAGES.quietMissing);
    expect(quietProblem({ quiet: 'x' } as any)).toBe(MESSAGES.quietMissing);
  });
  it('the default matches the Worker default', async () => {
    const w = await import('../../../workers/push/prefs.js');
    expect(w.parseClock(QUIET_DEFAULT.start)).toBe(w.DEFAULT_QUIET.start);
    expect(w.parseClock(QUIET_DEFAULT.end)).toBe(w.DEFAULT_QUIET.end);
  });
});

describe('form helpers', () => {
  it('reads the default as quiet 22:00 to 07:00, breaking not allowed', () => {
    const r = dom();
    expect(readForm(r)).toMatchObject({ quiet: { start: '22:00', end: '07:00' }, breakingInQuiet: false });
  });
  it('quiet hours off is null', () => {
    const r = dom();
    $(r, 'input[name="quietOn"]').checked = false;
    expect(readForm(r).quiet).toBeNull();
  });
  it('fills times and the breaking choice from the saved choices', () => {
    const r = dom();
    fillForm(r, saved as any);
    expect($(r, 'input[name="quietStart"]').value).toBe('23:30');
    expect($(r, 'input[name="quietEnd"]').value).toBe('06:15');
    expect($(r, 'input[name="breakingInQuiet"]').checked).toBe(true);
    expect($(r, 'input[name="quietOn"]').checked).toBe(true);
  });
  it('saved quiet null switches it off and greys the times; the times keep their last value', () => {
    const r = dom();
    fillForm(r, { ...saved, quiet: null } as any);
    expect($(r, 'input[name="quietOn"]').checked).toBe(false);
    expect($(r, 'input[name="quietStart"]').disabled).toBe(true);
    expect($(r, 'input[name="quietStart"]').value).toBe('22:00');
    $(r, 'input[name="quietOn"]').checked = true;
    syncQuiet(r);
    expect($(r, 'input[name="quietStart"]').disabled).toBe(false);
  });
  it('saved choices without a quiet field leave the boxes alone', () => {
    const r = dom();
    $(r, 'input[name="quietStart"]').value = '21:00';
    fillForm(r, { categories: [], level: 'balanced', dailyLimit: null, breakingAll: true } as any);
    expect($(r, 'input[name="quietStart"]').value).toBe('21:00');
    expect($(r, 'input[name="quietOn"]').checked).toBe(true);
  });
  it('a page without the boxes sends no quiet fields and does not break', () => {
    document.body.innerHTML = '<section><input type="checkbox" name="breakingAll" checked></section>';
    const root = document.querySelector('section') as HTMLElement;
    const out = readForm(root);
    expect('quiet' in out).toBe(false);
    expect('breakingInQuiet' in out).toBe(false);
    expect(() => syncQuiet(root)).not.toThrow();
  });
});

describe('the page', () => {
  it('shows the saved quiet hours', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(sub), win: win() });
    expect($(r, 'input[name="quietStart"]').value).toBe('23:30');
    expect($(r, 'input[name="breakingInQuiet"]').checked).toBe(true);
  });
  it('the checkbox greys and un-greys the two times', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(), win: win() });
    const box = $(r, 'input[name="quietOn"]');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect($(r, 'input[name="quietEnd"]').disabled).toBe(true);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect($(r, 'input[name="quietEnd"]').disabled).toBe(false);
  });
  it('turn on sends the quiet hours', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="quietStart"]').value = '21:00';
    $(r, 'input[name="breakingInQuiet"]').checked = true;
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable.mock.calls[0][0].prefs).toMatchObject({ quiet: { start: '21:00', end: '07:00' }, breakingInQuiet: true });
  });
  it('save with quiet hours off sends null', async () => {
    const r = dom();
    const c = client(sub);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    const box = $(r, 'input[name="quietOn"]');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs.mock.calls[0][0].prefs.quiet).toBeNull();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.saved);
  });
  it('the same time twice: a message and nothing is sent', async () => {
    const r = dom();
    const c = client(sub);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="quietStart"]').value = '06:15'; // the saved end time is 06:15
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.quietSame);
    expect($(r, '[data-n-save]').disabled).toBe(false);
  });
  it('an empty time: a message and nothing is sent', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="quietEnd"]').value = '';
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.quietMissing);
  });
  it('the Worker refusing the quiet hours shows its sentence and keeps the times', async () => {
    const r = dom();
    const c = client({ ...sub, savePrefs: { ok: false, reason: 'invalid', field: 'quiet', error: 'Please write quiet hours as HH:MM, for example 22:00.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="quietStart"]').value = '20:00';
    $(r, '[data-n-save]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toContain('HH:MM');
    expect($(r, 'input[name="quietStart"]').value).toBe('20:00');
  });
});
