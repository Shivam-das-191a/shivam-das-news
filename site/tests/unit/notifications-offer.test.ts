// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { initNotificationsPage, offerText, offerDone, OFFER_LAST, categoryName, offerItems, renderOffer, MESSAGES } from '../../src/lib/notifications-page.js';

// v0.101.0 (Phase 9 part 8c-2): the offer "You tapped Less like this for Sports 3 times. Remove Sports?" with a one-tap button (PLAN 31.8).
const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech" data-name="Technology">
    <input type="checkbox" name="category" value="sports" data-name="Sports">
    <input type="checkbox" name="category" value="world">
    <input type="checkbox" name="breakingAll">
    <input type="radio" name="level" value="balanced">
    <select name="dailyLimit"><option value="">auto</option></select>
  </form>
  <div data-n-suggest hidden><ul data-n-suggest-list></ul></div>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom() {
  document.body.innerHTML = HTML;
  return document.querySelector('[data-notify]') as HTMLElement;
}
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'granted', subscribed: true, hasState: true, ...o });
const PREFS = { categories: ['tech', 'sports'], level: 'balanced', dailyLimit: null, breakingAll: false, keywords: [] };
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async () => o.enable ?? { ok: true, created: true, prefs: PREFS }),
    getPrefs: vi.fn(async () => o.getPrefs ?? { ok: true, prefs: PREFS, suggestRemove: [{ category: 'sports', count: 3 }] }),
    savePrefs: vi.fn(async () => o.savePrefs ?? { ok: true, prefs: { ...PREFS, categories: ['tech'] } }),
    disable: vi.fn(async () => o.disable ?? { ok: true, serverRemoved: true }),
  };
}
const win = () => ({ navigator: { userAgent: 'Chrome' }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id) }) as any;
const lines = (r: HTMLElement) => [...r.querySelectorAll('[data-n-suggest-list] li')];

describe('the words', () => {
  it('say what the plan says', () => {
    expect(offerText('Sports', 3)).toBe('You tapped Less like this for Sports 3 times. Remove Sports?');
    expect(offerDone('Sports')).toContain('Sports is removed');
    expect(OFFER_LAST).toContain('last choice');
  });
  it('have no emoji and no symbol used as an icon', () => {
    for (const t of [offerText('Sports', 4), offerDone('Sports'), OFFER_LAST]) expect(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/u.test(t)).toBe(false);
  });
});

describe('the helpers', () => {
  it('shows the name of the page, or the id when the page has none', () => {
    const r = dom();
    expect(categoryName(r, 'tech')).toBe('Technology');
    expect(categoryName(r, 'world')).toBe('world');
    expect(categoryName(r, 'nothing-here')).toBe('nothing-here');
  });
  it('keeps only followed categories that the page knows, with 3 taps or more, once each', () => {
    const r = dom();
    const offer = [
      { category: 'sports', count: 3 },
      { category: 'sports', count: 9 },
      { category: 'tech', count: 2 },
      { category: 'world', count: 5 }, // not followed
      { category: 'gone', count: 5 }, // not on this page
      { category: 7, count: 5 },
      null,
    ];
    expect(offerItems(r, offer, { categories: ['sports', 'tech', 'gone'] })).toEqual([{ category: 'sports', count: 3 }]);
    expect(offerItems(r, offer, null)).toEqual([]);
    expect(offerItems(r, null as any, PREFS)).toEqual([]);
  });
  it('writes text only, never HTML', () => {
    const r = dom();
    $(r, 'input[value="sports"]').setAttribute('data-name', '<img src=x onerror=alert(1)>');
    r.setAttribute('data-state', 'on');
    expect(renderOffer(r, [{ category: 'sports', count: 3 }])).toBe(1);
    expect(r.querySelector('[data-n-suggest-list] img')).toBeNull();
    expect($(r, '[data-n-suggest-list] span').textContent).toContain('<img');
    expect($(r, '[data-n-suggest]').hidden).toBe(false);
  });
  it('an empty list empties and hides the box; a box that is not there is no problem', () => {
    const r = dom();
    r.setAttribute('data-state', 'on');
    renderOffer(r, [{ category: 'sports', count: 3 }]);
    expect(renderOffer(r, [])).toBe(0);
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
    document.body.innerHTML = '<section data-notify></section>';
    expect(renderOffer(document.querySelector('[data-notify]') as HTMLElement, [{ category: 'a', count: 3 }])).toBe(0);
  });
});

describe('the page', () => {
  it('shows one line and one button for the offered category', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(), win: win() });
    expect(lines(r)).toHaveLength(1);
    expect(lines(r)[0].textContent).toContain('You tapped Less like this for Sports 3 times. Remove Sports?');
    const b = $(r, '[data-n-remove="sports"]');
    expect(b.textContent).toBe('Remove Sports');
    expect($(r, '[data-n-suggest]').hidden).toBe(false);
  });
  it('shows nothing when the Worker gives no offer', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ getPrefs: { ok: true, prefs: PREFS } }), win: win() });
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
  });
  it('shows nothing for a reader who is not subscribed yet', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ subscribed: false, hasState: false }) }), win: win() });
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
  });
  it('one tap saves only the saved categories without this one', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-remove="sports"]').click();
    await tick();
    expect(c.savePrefs).toHaveBeenCalledTimes(1);
    expect(c.savePrefs).toHaveBeenCalledWith({ cfg, prefs: { categories: ['tech'] } });
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
    expect($(r, 'input[value="sports"]').checked).toBe(false);
    expect($(r, '[data-n-msg]').textContent).toBe(offerDone('Sports'));
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('0');
  });
  it('does not save other edits that are still in the form, and does not lose them', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[value="world"]').checked = true; // typed, not saved
    $(r, '[data-n-remove="sports"]').click();
    await tick();
    expect(c.savePrefs.mock.calls[0][0].prefs).toEqual({ categories: ['tech'] });
    expect($(r, 'input[value="world"]').checked).toBe(true);
  });
  it('does not remove the last choice, and says why', async () => {
    const r = dom();
    const only = { ...PREFS, categories: ['sports'] };
    const c = client({ getPrefs: { ok: true, prefs: only, suggestRemove: [{ category: 'sports', count: 4 }] } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-remove="sports"]').click();
    await tick();
    expect(c.savePrefs).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(OFFER_LAST);
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('1');
    expect(lines(r)).toHaveLength(1);
  });
  it('the last category may go when a keyword or breaking news stays', async () => {
    for (const extra of [{ keywords: ['election'] }, { breakingAll: true }]) {
      const r = dom();
      const only = { ...PREFS, categories: ['sports'], ...extra };
      const c = client({ getPrefs: { ok: true, prefs: only, suggestRemove: [{ category: 'sports', count: 3 }] }, savePrefs: { ok: true, prefs: { ...only, categories: [] } } });
      await initNotificationsPage({ root: r, cfg, client: c, win: win() });
      $(r, '[data-n-remove="sports"]').click();
      await tick();
      expect(c.savePrefs).toHaveBeenCalledWith({ cfg, prefs: { categories: [] } });
      expect(lines(r)).toHaveLength(0);
    }
  });
  it('a failed save keeps the offer and shows the error', async () => {
    const r = dom();
    const c = client({ savePrefs: { ok: false, reason: 'error', error: 'Something went wrong. Please try again.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-remove="sports"]').click();
    await tick();
    expect(lines(r)).toHaveLength(1);
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.error);
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('1');
    expect($(r, 'input[value="sports"]').checked).toBe(true);
  });
  it('a reader who must turn notifications on again gets the form for that, and no offer', async () => {
    const r = dom();
    const c = client({ savePrefs: { ok: false, reason: 'resubscribe', error: 'x' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-remove="sports"]').click();
    await tick();
    expect(r.getAttribute('data-state')).toBe('new');
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
  });
  it('the buttons are not pressable twice at once', async () => {
    const r = dom();
    let release: any;
    const c = client();
    c.savePrefs = vi.fn(() => new Promise((res) => { release = () => res({ ok: true, prefs: { ...PREFS, categories: ['tech'] } }); })) as any;
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    const b = $(r, '[data-n-remove="sports"]');
    b.click();
    b.click();
    await tick();
    expect(c.savePrefs).toHaveBeenCalledTimes(1);
    release();
    await tick();
  });
  it('after Save without the category the offer for it is gone', async () => {
    const r = dom();
    const c = client({ savePrefs: { ok: true, prefs: { ...PREFS, categories: ['tech'] } } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[value="sports"]').checked = false;
    $(r, '[data-n-save]').click();
    await tick();
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
  });
  it('an offer for a category the page does not know is not shown', async () => {
    const r = dom();
    const c = client({ getPrefs: { ok: true, prefs: { ...PREFS, categories: ['tech', 'old-one'] }, suggestRemove: [{ category: 'old-one', count: 5 }] } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    expect(lines(r)).toHaveLength(0);
  });
  it('turning notifications off clears the offer', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-off]').click();
    await tick();
    $(r, '[data-n-off]').click();
    await tick();
    expect(r.getAttribute('data-state')).toBe('new');
    expect(lines(r)).toHaveLength(0);
    expect($(r, '[data-n-suggest]').hidden).toBe(true);
  });
});

describe('the page file', () => {
  const astro = readFileSync('src/pages/notifications.astro', 'utf8');
  it('has the offer box, the list and the name of every category on its tick box', () => {
    expect(astro).toContain('data-n-suggest');
    expect(astro).toContain('data-n-suggest-list');
    expect(astro).toMatch(/name="category" value=\{c\} data-name=\{catName\(c\)\}/);
  });
  it('the box starts hidden and says that nothing is removed by itself', () => {
    expect(astro).toMatch(/data-n-suggest hidden/);
    expect(astro).toContain('Nothing is removed by itself');
  });
});
