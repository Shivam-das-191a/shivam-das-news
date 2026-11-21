// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { initNotificationsPage, readForm, fillForm, readPause, fillPause, digestProblem, syncDigest, formatUntil, MESSAGES, DIGEST_MODES, MORNING_HOURS, EVENING_HOURS, DIGEST_DEFAULT, PAUSE_CHOICES, hourLabel, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

// v0.60.0 (push part 5c-3): the digest and the pause on /notifications/.
const opts = (list: number[]) => list.map((h) => `<option value="${h}"${h === 8 || h === 20 ? ' selected' : ''}>${hourLabel(h)}</option>`).join('');
const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech">
    <input type="checkbox" name="breakingAll" checked>
    <select name="digestMode">${DIGEST_MODES.map(([v]) => `<option value="${v}">${v}</option>`).join('')}</select>
    <select name="digestMorning">${opts(MORNING_HOURS)}</select>
    <select name="digestEvening">${opts(EVENING_HOURS)}</select>
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option>${LIMIT_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
    <fieldset data-n-pause hidden>
      <select name="pause">${PAUSE_CHOICES.map(([v]) => `<option value="${v}">${v}</option>`).join('')}<option value="keep" hidden></option></select>
      <p data-n-pause-note></p>
    </fieldset>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom() { document.body.innerHTML = HTML; return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
const saved = { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true, digest: { mode: 'both', morning: 7, evening: 21 }, pause: { mode: 'none', until: null } };
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

describe('the lists match the Worker', () => {
  it('digest modes, hour ranges, defaults and pause words are the Worker ones', async () => {
    const w = await import('../../../workers/push/prefs.js');
    expect(DIGEST_MODES.map(([v]) => v)).toEqual(w.DIGEST_MODES);
    expect(MORNING_HOURS).toEqual(Array.from({ length: w.MORNING_RANGE[1] - w.MORNING_RANGE[0] + 1 }, (_, i) => w.MORNING_RANGE[0] + i));
    expect(EVENING_HOURS).toEqual(Array.from({ length: w.EVENING_RANGE[1] - w.EVENING_RANGE[0] + 1 }, (_, i) => w.EVENING_RANGE[0] + i));
    expect(DIGEST_DEFAULT).toEqual(w.defaultPrefs('IN', []).digest);
    expect(PAUSE_CHOICES.map(([v]) => v)).toEqual(w.PAUSE_MODES);
  });
  it('writes an hour as HH:00', () => {
    expect(hourLabel(7)).toBe('07:00');
    expect(hourLabel(21)).toBe('21:00');
  });
});

describe('digestProblem', () => {
  it('accepts not sent and good values', () => {
    expect(digestProblem({})).toBeNull();
    expect(digestProblem({ digest: { mode: 'off', morning: 8, evening: 20 } })).toBeNull();
    expect(digestProblem({ digest: { mode: 'both', morning: 4, evening: 23 } })).toBeNull();
  });
  it('refuses a wrong mode or an hour outside its list', () => {
    expect(digestProblem({ digest: { mode: 'noon', morning: 8, evening: 20 } })).toBe(MESSAGES.digestBad);
    expect(digestProblem({ digest: { mode: 'both', morning: 12, evening: 20 } })).toBe(MESSAGES.digestBad);
    expect(digestProblem({ digest: { mode: 'both', morning: 8, evening: 15 } })).toBe(MESSAGES.digestBad);
    expect(digestProblem({ digest: { mode: 'both', morning: NaN, evening: 20 } })).toBe(MESSAGES.digestBad);
    expect(digestProblem({ digest: 'x' } as any)).toBe(MESSAGES.digestBad);
  });
});

describe('digest in the form', () => {
  it('reads the default as off with 08:00 and 20:00', () => {
    const r = dom();
    expect(readForm(r).digest).toEqual({ mode: 'off', morning: 8, evening: 20 });
  });
  it('fills the saved digest and greys the hour lists it does not use', () => {
    const r = dom();
    fillForm(r, { ...saved, digest: { mode: 'morning', morning: 6, evening: 20 } } as any);
    expect(readForm(r).digest).toEqual({ mode: 'morning', morning: 6, evening: 20 });
    expect($(r, 'select[name="digestMorning"]').disabled).toBe(false);
    expect($(r, 'select[name="digestEvening"]').disabled).toBe(true);
    fillForm(r, { ...saved, digest: { mode: 'off', morning: 8, evening: 20 } } as any);
    expect($(r, 'select[name="digestMorning"]').disabled).toBe(true);
    expect($(r, 'select[name="digestEvening"]').disabled).toBe(true);
    fillForm(r, saved as any);
    expect($(r, 'select[name="digestMorning"]').disabled).toBe(false);
    expect($(r, 'select[name="digestEvening"]').disabled).toBe(false);
  });
  it('a page without the digest boxes sends no digest and does not break', () => {
    document.body.innerHTML = '<section><input type="checkbox" name="breakingAll" checked></section>';
    const root = document.querySelector('section') as HTMLElement;
    expect('digest' in readForm(root)).toBe(false);
    expect(() => syncDigest(root)).not.toThrow();
    expect(() => fillForm(root, saved as any)).not.toThrow();
  });
});

describe('the pause list', () => {
  it('reads the chosen pause; nothing for a kept timed pause or a page without the list', () => {
    const r = dom();
    expect(readPause(r)).toBe('none');
    $(r, 'select[name="pause"]').value = 'week';
    expect(readPause(r)).toBe('week');
    $(r, 'select[name="pause"]').value = 'keep';
    expect(readPause(r)).toBeUndefined();
    document.body.innerHTML = '<section></section>';
    expect(readPause(document.querySelector('section') as HTMLElement)).toBeUndefined();
  });
  it('shows a pause until the reader turns it on', () => {
    const r = dom();
    fillPause(r, { mode: 'until_on', until: null });
    expect($(r, 'select[name="pause"]').value).toBe('until_on');
    expect($(r, '[data-n-pause-note]').textContent).toBe(MESSAGES.pausedForever);
  });
  it('shows a running timed pause as "Paused until ..." and keeps it', () => {
    const r = dom();
    const until = Date.UTC(2026, 10, 18, 14, 30);
    fillPause(r, { mode: 'timed', until });
    const keep = $(r, 'option[value="keep"]');
    expect(keep.hidden).toBe(false);
    expect(keep.textContent).toContain('Paused until');
    expect(keep.textContent).toContain(formatUntil(until));
    expect($(r, 'select[name="pause"]').value).toBe('keep');
    expect(readPause(r)).toBeUndefined();
    expect($(r, '[data-n-pause-note]').textContent).toContain('Paused until');
  });
  it('no pause clears the note and hides the kept line again', () => {
    const r = dom();
    fillPause(r, { mode: 'timed', until: Date.now() + 1000 });
    fillPause(r, { mode: 'none', until: null });
    expect($(r, 'select[name="pause"]').value).toBe('none');
    expect($(r, 'option[value="keep"]').hidden).toBe(true);
    expect($(r, '[data-n-pause-note]').textContent).toBe('');
  });
  it('formatUntil gives an empty text for a wrong time', () => {
    expect(formatUntil('x')).toBe('');
    expect(formatUntil(undefined)).toBe('');
  });
});

describe('the page', () => {
  it('the pause list shows only for a subscribed reader', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(), win: win() });
    expect($(r, '[data-n-pause]').hidden).toBe(true);
    const r2 = dom();
    await initNotificationsPage({ root: r2, cfg, client: client(sub), win: win() });
    expect($(r2, '[data-n-pause]').hidden).toBe(false);
  });
  it('turn on does not send a pause; it shows the pause list afterwards', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable.mock.calls[0][0]).not.toHaveProperty('pause');
    expect($(r, '[data-n-pause]').hidden).toBe(false);
  });
  it('the digest list greys and un-greys the hour lists', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(), win: win() });
    const m = $(r, 'select[name="digestMode"]');
    m.value = 'evening';
    m.dispatchEvent(new Event('change'));
    expect($(r, 'select[name="digestMorning"]').disabled).toBe(true);
    expect($(r, 'select[name="digestEvening"]').disabled).toBe(false);
  });
  it('save sends the digest and the chosen pause', async () => {
    const r = dom();
    const c = client(sub);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'select[name="digestMorning"]').value = '9';
    $(r, 'select[name="pause"]').value = 'day';
    $(r, '[data-n-save]').click();
    await tick();
    const a = c.savePrefs.mock.calls[0][0];
    expect(a.pause).toBe('day');
    expect(a.prefs.digest).toEqual({ mode: 'both', morning: 9, evening: 21 });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.saved);
  });
  it('save shows the pause the Worker confirms and then does not send it again', async () => {
    const r = dom();
    const until = Date.now() + 86400000;
    const c = client({ ...sub, savePrefs: { ok: true, prefs: { ...saved, pause: { mode: 'timed', until } } } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'select[name="pause"]').value = 'day';
    $(r, '[data-n-save]').click();
    await tick();
    expect($(r, 'select[name="pause"]').value).toBe('keep');
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs.mock.calls[1][0]).not.toHaveProperty('pause');
  });
  it('a saved pause "until I turn it on" is shown when the page opens', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ ...sub, getPrefs: { ok: true, prefs: { ...saved, pause: { mode: 'until_on', until: null } } } }), win: win() });
    expect($(r, 'select[name="pause"]').value).toBe('until_on');
    expect($(r, '[data-n-pause-note]').textContent).toBe(MESSAGES.pausedForever);
  });
  it('a refusal by the Worker keeps what the reader chose', async () => {
    const r = dom();
    const c = client({ ...sub, savePrefs: { ok: false, reason: 'invalid', field: 'digest', error: 'The morning digest hour must be 4 to 11.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'select[name="pause"]').value = 'week';
    $(r, '[data-n-save]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe('The morning digest hour must be 4 to 11.');
    expect($(r, 'select[name="pause"]').value).toBe('week');
    expect($(r, '[data-n-save]').disabled).toBe(false);
  });
});
