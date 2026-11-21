// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as C from '../../src/lib/push-client.js';
import { initNotificationsPage, MESSAGES, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

// v0.62.0 (push part 5c-5): the "Send me a test notification" button, the client function and the page rules.
const API = 'https://push.test';
// A real-looking public key (65 bytes starting with 4), only so that pushConfig() accepts the address.
const KEY = Buffer.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 5 + 1) % 256)]).toString('base64url');
const cfg = { endpoint: API, vapidPublicKey: KEY };

// ------------------------------------------------------------------ the client function

function clientEnv(answer: (path: string, body: any) => { status: number; data?: any } | Promise<{ status: number; data?: any }> | 'throw', o: { permission?: string; state?: any } = {}) {
  let state: any = o.state === undefined ? { api: API, sub: 'a'.repeat(32), token: 'T'.repeat(43), prefs: {}, at: 1 } : o.state;
  const calls: { path: string; body: any }[] = [];
  const env: any = {
    secure: true,
    navigator: { serviceWorker: { getRegistration: vi.fn(async () => undefined) } },
    Notification: { permission: o.permission ?? 'granted', requestPermission: vi.fn() },
    store: { get: vi.fn(async () => state), set: vi.fn(async (v: any) => { state = v; }), del: vi.fn(async () => { state = null; }) },
    now: () => 1,
    tz: () => 'Asia/Kolkata',
    fetch: vi.fn(async (url: string, init: any) => {
      const path = url.replace(API, '');
      const body = JSON.parse(init.body);
      calls.push({ path, body });
      const a = await answer(path, body);
      if (a === 'throw') throw new Error('offline');
      return new Response(JSON.stringify(a.data ?? {}), { status: a.status });
    }),
  };
  return { env, calls };
}

describe('sendTest (client)', () => {
  it('posts the saved id and token to /test and returns ok', async () => {
    const { env, calls } = clientEnv(() => ({ status: 200, data: { ok: true } }));
    expect(await C.sendTest({ cfg, env })).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/test');
    expect(calls[0].body).toEqual({ sub: 'a'.repeat(32), token: 'T'.repeat(43) });
  });
  it('is off while config/push.json is empty, and asks the Worker nothing', async () => {
    const { env, calls } = clientEnv(() => ({ status: 200, data: { ok: true } }));
    expect(await C.sendTest({ cfg: { endpoint: '', vapidPublicKey: '' }, env })).toEqual({ ok: false, reason: 'off' });
    expect(calls).toHaveLength(0);
  });
  it('a blocked browser is "denied" and the Worker is not asked', async () => {
    const { env, calls } = clientEnv(() => ({ status: 200, data: { ok: true } }), { permission: 'denied' });
    expect(await C.sendTest({ cfg, env })).toEqual({ ok: false, reason: 'denied' });
    expect(calls).toHaveLength(0);
  });
  it('a browser that never subscribed is "not_subscribed"', async () => {
    const { env, calls } = clientEnv(() => ({ status: 200, data: { ok: true } }), { state: null });
    expect((await C.sendTest({ cfg, env })).reason).toBe('not_subscribed');
    expect(calls).toHaveLength(0);
  });
  it('one a minute: the Worker sentence comes back as "busy"', async () => {
    const { env } = clientEnv(() => ({ status: 429, data: { error: 'Please wait a minute before you send another test.' } }));
    expect(await C.sendTest({ cfg, env })).toEqual({ ok: false, reason: 'busy', error: 'Please wait a minute before you send another test.' });
  });
  it('410 (the push service dropped this browser) means turn notifications on again', async () => {
    const { env } = clientEnv(() => ({ status: 410, data: { error: 'x', reason: 'gone' } }));
    expect(await C.sendTest({ cfg, env })).toEqual({ ok: false, reason: 'resubscribe', error: 'Please turn notifications on again.' });
  });
  it('401, 403 and 404 mean turn notifications on again as well', async () => {
    for (const status of [401, 403, 404]) {
      const { env } = clientEnv(() => ({ status, data: { error: 'no' } }));
      expect((await C.sendTest({ cfg, env })).reason, String(status)).toBe('resubscribe');
    }
  });
  it('503 and 502 give the Worker sentence, or a general one', async () => {
    const a = clientEnv(() => ({ status: 503, data: { error: 'Sending is not switched on yet.' } }));
    expect(await C.sendTest({ cfg, env: a.env })).toEqual({ ok: false, reason: 'unavailable', error: 'Sending is not switched on yet.' });
    const b = clientEnv(() => ({ status: 502 }));
    const r = await C.sendTest({ cfg, env: b.env });
    expect(r.reason).toBe('unavailable');
    expect(r.error).toMatch(/try again later/i);
  });
  it('no connection is "network"', async () => {
    const { env } = clientEnv(() => 'throw');
    expect((await C.sendTest({ cfg, env })).reason).toBe('network');
  });
  it('a 200 without ok:true is not a success', async () => {
    const { env } = clientEnv(() => ({ status: 200, data: {} }));
    expect((await C.sendTest({ cfg, env })).ok).toBe(false);
  });
  it('never throws, even when the store breaks', async () => {
    const { env } = clientEnv(() => ({ status: 200, data: { ok: true } }));
    env.store.get = vi.fn(async () => { throw new Error('idb'); });
    const r = await C.sendTest({ cfg, env });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ the page

const HTML = (withButton: boolean) => `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech">
    <input type="checkbox" name="breakingAll" checked>
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option>${LIMIT_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button>
  ${withButton ? '<button data-n-test hidden>Send me a test notification</button>' : ''}
  <button data-n-off hidden></button>
  ${withButton ? '<p data-n-test-note hidden>note</p>' : ''}
</section>`;
function dom(withButton = true) { document.body.innerHTML = HTML(withButton); return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
const saved = { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true };
const on = { status: stat({ permission: 'granted', subscribed: true, hasState: true }) };
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async () => ({ ok: true, created: true, prefs: saved })),
    getPrefs: vi.fn(async () => ({ ok: true, prefs: saved })),
    savePrefs: vi.fn(async () => ({ ok: true, prefs: saved })),
    disable: vi.fn(async () => ({ ok: true })),
    sendTest: vi.fn(async () => o.sendTest ?? { ok: true }),
  };
}
const win = () => ({ navigator: { userAgent: 'Chrome' }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id) }) as any;

describe('the test button on the page', () => {
  it('shows only while notifications are on in this browser', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client(on), win: win() });
    expect($(r, '[data-n-test]').hidden).toBe(false);
    expect($(r, '[data-n-test-note]').hidden).toBe(false);

    const r2 = dom();
    await initNotificationsPage({ root: r2, cfg, client: client(), win: win() }); // a new reader
    expect($(r2, '[data-n-test]').hidden).toBe(true);
    expect($(r2, '[data-n-test-note]').hidden).toBe(true);

    const r3 = dom();
    await initNotificationsPage({ root: r3, cfg, client: client({ status: stat({ permission: 'denied', hasState: true, subscribed: true }) }), win: win() }); // blocked
    expect($(r3, '[data-n-test]').hidden).toBe(true);
  });

  it('a click asks the client once and shows the success sentence', async () => {
    const r = dom();
    const c = client(on);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect(c.sendTest).toHaveBeenCalledTimes(1);
    expect(c.sendTest).toHaveBeenCalledWith({ cfg });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.testSent);
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('0');
  });

  it('says "sending" while it waits, and locks the buttons only for that time', async () => {
    const r = dom();
    let finish: any;
    const c = client(on);
    c.sendTest = vi.fn(() => new Promise((res) => { finish = res; })) as any;
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.testSending);
    expect($(r, '[data-n-test]').disabled).toBe(true);
    expect($(r, '[data-n-save]').disabled).toBe(true);
    finish({ ok: true });
    await tick();
    expect($(r, '[data-n-test]').disabled).toBe(false);
    expect($(r, '[data-n-save]').disabled).toBe(false);
  });

  it('one tap while sending cannot start a second test', async () => {
    const r = dom();
    let finish: any;
    const c = client(on);
    c.sendTest = vi.fn(() => new Promise((res) => { finish = res; })) as any;
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    $(r, '[data-n-test]').click(); // a disabled button gets no click
    await tick();
    expect(c.sendTest).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await tick();
  });

  it('shows the Worker sentence when the minute is not over', async () => {
    const r = dom();
    const c = client({ ...on, sendTest: { ok: false, reason: 'busy', error: 'Please wait a minute before you send another test.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe('Please wait a minute before you send another test.');
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('1');
    expect($(r, '[data-n-test]').disabled).toBe(false);
  });

  it('shows "sending is not switched on" and keeps the page in the "on" state', async () => {
    const r = dom();
    const c = client({ ...on, sendTest: { ok: false, reason: 'unavailable', error: 'Sending is not switched on yet.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe('Sending is not switched on yet.');
    expect(r.getAttribute('data-state')).toBe('on');
  });

  it('when the browser is no longer known the page goes back to "turn on"', async () => {
    const r = dom();
    const c = client({ ...on, sendTest: { ok: false, reason: 'resubscribe', error: 'Please turn notifications on again.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect(r.getAttribute('data-state')).toBe('new');
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.again);
    expect($(r, '[data-n-test]').hidden).toBe(true);
    expect($(r, '[data-n-on]').hidden).toBe(false);
  });

  it('a blocked browser moves the page to the blocked state with the browser settings sentence', async () => {
    const r = dom();
    const c = client({ ...on, sendTest: { ok: false, reason: 'denied' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.denied);
  });

  it('a client that throws shows the general error and unlocks the buttons', async () => {
    const r = dom();
    const c = client(on);
    c.sendTest = vi.fn(async () => { throw new Error('boom'); }) as any;
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.error);
    expect($(r, '[data-n-test]').disabled).toBe(false);
  });

  it('the test does not save, turn on or turn off anything', async () => {
    const r = dom();
    const c = client(on);
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, '[data-n-test]').click();
    await tick();
    expect(c.savePrefs).not.toHaveBeenCalled();
    expect(c.enable).not.toHaveBeenCalled();
    expect(c.disable).not.toHaveBeenCalled();
  });

  it('a page without the button still works (older template)', async () => {
    const r = dom(false);
    const out = await initNotificationsPage({ root: r, cfg, client: client(on), win: win() });
    expect(out.state).toBe('on');
  });

  it('the sentences have no emoji and no symbol used as a picture', () => {
    for (const k of ['testSending', 'testSent'] as const) {
      expect(/\p{Extended_Pictographic}/u.test(MESSAGES[k]), k).toBe(false);
      expect(/[\u2190-\u21FF\u2713\u2714\u2715\u25CB-\u25CF]/.test(MESSAGES[k]), k).toBe(false);
    }
  });
});

describe('the template', () => {
  const astro = readFileSync(join(process.cwd(), 'src/pages/notifications.astro'), 'utf8');
  it('has the button and the note, both hidden at first', () => {
    expect(astro).toMatch(/<button[^>]*data-n-test hidden[^>]*>Send me a test notification<\/button>/);
    expect(astro).toMatch(/<p[^>]*data-n-test-note hidden/);
  });
  it('the note says what the test does and does not do', () => {
    expect(astro).toMatch(/does not use up your daily limit/);
  });
  it('the button sits with the other buttons, after Save and before Unsubscribe', () => {
    const save = astro.indexOf('data-n-save');
    const test = astro.indexOf('data-n-test hidden');
    const off = astro.indexOf('data-n-off');
    expect(save).toBeGreaterThan(-1);
    expect(test).toBeGreaterThan(save);
    expect(off).toBeGreaterThan(test);
  });
});
