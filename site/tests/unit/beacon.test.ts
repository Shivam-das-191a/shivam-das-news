import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS rules of the Worker
import { cleanBeacon, MAX_BODY } from '../../../workers/analytics/lib.js';
import { beaconPlan } from '../../src/lib/beacon';

// The browser file is plain text that the build puts into article pages. Here the very same text is run against a fake window.
const beaconClient: any = new Function(readFileSync('src/lib/beacon-client.js', 'utf8') + '\nreturn beaconClient;')();
const EP = 'https://an.test/collect';
const STAMP_EP = 'https://an.test/stamp';
const STAMP = '1800000000000.' + 'a'.repeat(64);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function win(o: { pageType?: string | null; beacon?: any; session?: Map<string, string> | 'broken'; visible?: boolean; stamp?: (n: number) => Promise<any>; search?: string } = {}) {
  const sent: { url: string; body: any }[] = [];
  const fetched: any[] = [];
  const stamps: { url: string; init: any }[] = []; // v0.74.0: the GET /stamp calls are kept apart so `fetched` holds only messages
  const listeners: Record<string, any> = {};
  const docListeners: Record<string, any> = {};
  const store = o.session instanceof Map ? o.session : new Map<string, string>();
  const doc: any = {
    body: { getAttribute: () => (o.pageType === undefined ? 'article' : o.pageType), scrollHeight: 2000 },
    documentElement: { scrollHeight: 2000, scrollTop: 0 },
    visibilityState: o.visible === false ? 'hidden' : 'visible',
    referrer: 'https://www.google.com/search?q=x',
    addEventListener: (e: string, f: any) => { docListeners[e] = f; },
  };
  let timer: any = null;
  const w: any = {
    document: doc,
    location: { pathname: '/2026/11/14/blogs/world/a-story/', ...(o.search === undefined ? {} : { search: o.search }) },
    pageYOffset: 0, innerHeight: 500,
    Intl,
    crypto: { getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } },
    sessionStorage: o.session === 'broken'
      ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
      : { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => void store.set(k, v) },
    navigator: o.beacon === undefined ? { sendBeacon: (url: string, body: string) => { sent.push({ url, body: JSON.parse(body) }); return true; } } : o.beacon,
    fetch: (url: string, init: any) => {
      if (url === STAMP_EP) { stamps.push({ url, init }); return o.stamp ? o.stamp(stamps.length) : Promise.resolve({ ok: true, json: async () => ({ stamp: STAMP }) }); }
      fetched.push({ url, init });
      return Promise.resolve({ ok: true });
    },
    setInterval: (f: any) => { timer = f; return 1; },
    clearInterval: () => { timer = null; },
    addEventListener: (e: string, f: any) => { listeners[e] = f; },
  };
  const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); }; // the stamp answer comes on a later turn
  return { w, doc, sent, fetched, stamps, flush, listeners, docListeners, store, ticks: (n: number) => { for (let i = 0; i < n; i++) timer && timer(); }, hasTimer: () => timer !== null };
}

describe('analytics beacon in the browser', () => {
  it('does nothing on a page that is not an article, or with an empty endpoint', () => {
    for (const type of ['home', 'category', 'tag', 'author', 'page', 'search', '404', null]) {
      const x = win({ pageType: type });
      expect(beaconClient(x.w, { endpoint: EP })).toBeNull();
      expect(Object.keys(x.listeners).length + (x.hasTimer() ? 1 : 0)).toBe(0);
    }
    const y = win();
    expect(beaconClient(y.w, { endpoint: '' })).toBeNull();
    expect(beaconClient(y.w, null)).toBeNull();
    expect(y.sent.length + y.fetched.length).toBe(0);
  });

  it('sends nothing before 5 reader seconds have passed (v0.78.0), then one message that the Worker accepts', async () => {
    const x = win();
    const b = beaconClient(x.w, { endpoint: EP });
    await x.flush();
    await x.flush();
    expect(x.sent.length).toBe(0);
    x.ticks(4);
    expect(x.sent.length).toBe(0);
    x.ticks(1);
    expect(x.sent.length).toBe(1);
    const m = x.sent[0];
    expect(m.url).toBe(EP);
    expect(JSON.stringify(m.body).length).toBeLessThanOrEqual(MAX_BODY);
    expect(m.body).toMatchObject({ path: '/2026/11/14/blogs/world/a-story/', read: 5, ref: 'https://www.google.com/search?q=x', stamp: STAMP });
    const r = cleanBeacon(m.body, { userAgent: CHROME, country: 'IN', siteHost: 'news.test', now: Date.now() });
    expect(r.ok).toBe(true);
    expect(r.event.referrer_host).toBe('google.com');
    expect(r.event.url).toBe('/2026/11/14/blogs/world/a-story/');
    expect(b.sid).toMatch(/^[a-f0-9]{24}$/);
    expect(b.pv).not.toBe(b.sid);
  });

  it('counts only visible, active seconds (BUGS N4) and sends again every 30 read seconds', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(30);
    expect(x.sent.map((s) => s.body.read)).toEqual([5, 30]);
    x.ticks(100); // no touch for 100 seconds: nothing more is counted
    x.listeners.pagehide();
    expect(x.sent[x.sent.length - 1].body.read).toBe(30);
    x.listeners.pointerdown(); // the reader is back
    x.ticks(1);
    x.doc.visibilityState = 'hidden'; // tab in the background: not counted even with a touch
    x.listeners.pointerdown();
    x.ticks(50);
    x.listeners.pagehide();
    expect(x.sent[x.sent.length - 1].body.read).toBe(31);
    x.doc.visibilityState = 'visible';
    x.listeners.pointerdown();
    x.ticks(1);
    x.listeners.pagehide();
    expect(x.sent[x.sent.length - 1].body.read).toBe(32);
  });

  it('stops counting at 3600 seconds', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    for (let i = 0; i < 4000; i++) { if (i % 20 === 0) x.listeners.pointerdown(); x.ticks(1); }
    x.listeners.pagehide();
    expect(x.sent[x.sent.length - 1].body.read).toBe(3600);
  });

  it('keeps the same session id for the tab and a new page view id for every page', async () => {
    const store = new Map<string, string>();
    const a = beaconClient(win({ session: store }).w, { endpoint: EP });
    const b = beaconClient(win({ session: store }).w, { endpoint: EP });
    expect(a.sid).toBe(b.sid);
    expect(a.pv).not.toBe(b.pv);
    const c = beaconClient(win({ session: 'broken' }).w, { endpoint: EP });
    expect(c.sid).toMatch(/^[a-f0-9]{24}$/);
  });

  it('sends the deepest scroll point and the leave message once, not twice with the same numbers', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(5);
    x.w.pageYOffset = 1500; // 1500 + 500 of 2000 = 100 %
    x.listeners.pagehide();
    x.listeners.pagehide();
    expect(x.sent.length).toBe(2);
    expect(x.sent[1].body.scroll).toBe(100);
    x.w.pageYOffset = 0; // scrolling back up never lowers the depth
    x.ticks(1);
    x.listeners.pagehide();
    expect(x.sent[x.sent.length - 1].body.scroll).toBe(100);
  });

  it('leaves when the tab is hidden, and falls back to fetch with keepalive when sendBeacon is missing', async () => {
    const x = win({ beacon: {} });
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(6);
    x.doc.visibilityState = 'hidden';
    x.docListeners.visibilitychange();
    expect(x.sent.length).toBe(0);
    expect(x.fetched.length).toBe(2);
    expect(x.fetched[0].init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } });
  });

  it('never throws when the browser parts are broken', async () => {
    const x = win({ beacon: { sendBeacon() { throw new Error('no'); } } });
    x.w.fetch = () => { throw new Error('no'); };
    x.w.Intl = undefined;
    x.w.crypto = undefined;
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    expect(() => { x.ticks(3); x.listeners.pagehide(); }).not.toThrow();
  });
});

describe('the stamp in the beacon (v0.74.0)', () => {
  it('asks for a stamp when the page starts with one plain GET (no cookies) and puts it in every message', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    expect(x.stamps).toHaveLength(1);
    expect(x.stamps[0].init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'cors' });
    expect(x.stamps[0].init.body).toBeUndefined();
    x.ticks(30);
    expect(x.sent.length).toBe(2);
    expect(x.sent.every((m) => m.body.stamp === STAMP)).toBe(true);
    expect(x.stamps).toHaveLength(1); // one stamp for the whole page view
    expect(Object.keys(x.sent[0].body).sort()).toEqual(['acted', 'path', 'pv', 'read', 'ref', 'scroll', 'sid', 'stamp', 'tz', 'webdriver']);
  });
  it('sends nothing before the stamp arrives, then sends the newest numbers at once', async () => {
    let release: any;
    const x = win({ stamp: () => new Promise((r) => { release = () => r({ ok: true, json: async () => ({ stamp: STAMP }) }); }) });
    beaconClient(x.w, { endpoint: EP });
    x.ticks(5);
    expect(x.sent.length + x.fetched.length).toBe(0);
    release();
    await x.flush();
    expect(x.sent.length).toBe(1);
    expect(x.sent[0].body).toMatchObject({ read: 5, stamp: STAMP });
  });
  it('does not send an empty first message when the stamp comes before the first reader second', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    expect(x.sent.length).toBe(0);
  });
  it('without a stamp it sends nothing at all, and asks again only 3 times in all', async () => {
    const x = win({ stamp: () => Promise.resolve({ ok: false, json: async () => ({ error: 'off' }) }) });
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    for (let i = 0; i < 40; i++) { x.ticks(1); await x.flush(); }
    x.listeners.pagehide();
    expect(x.sent.length + x.fetched.length).toBe(0);
    expect(x.stamps).toHaveLength(3);
  });
  it('a network error on the stamp is silent and the next tick tries again', async () => {
    let n = 0;
    const x = win({ stamp: () => (++n === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, json: async () => ({ stamp: STAMP }) })) });
    expect(() => beaconClient(x.w, { endpoint: EP })).not.toThrow();
    await x.flush();
    x.ticks(5);
    await x.flush();
    expect(x.stamps).toHaveLength(2);
    expect(x.sent.length).toBe(1);
  });
  it('the stamp address is the collect address with /stamp at the end', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: 'https://an.test/collect' });
    await x.flush();
    expect(x.stamps[0].url).toBe('https://an.test/stamp');
  });
  it('cuts a long referrer to 300 characters so the message stays small', async () => {
    const x = win();
    x.doc.referrer = 'https://www.google.com/search?q=' + 'a'.repeat(2000);
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(5);
    expect(x.sent[0].body.ref).toHaveLength(300);
    expect(JSON.stringify(x.sent[0].body).length).toBeLessThanOrEqual(MAX_BODY + 128);
  });
});

describe('analytics settings check', () => {
  it('is off for the shipped file and for an empty or missing endpoint', () => {
    expect(beaconPlan(JSON.parse(readFileSync('tests/fixtures/shipped/config/analytics.json', 'utf8')))).toBeNull();
    expect(beaconPlan({ endpoint: '  ' })).toBeNull();
    expect(beaconPlan(null)).toBeNull();
    expect(beaconPlan(undefined)).toBeNull();
  });
  it('accepts a clean https address that ends with /collect', () => {
    expect(beaconPlan({ endpoint: 'https://news-analytics.me.workers.dev/collect' })).toEqual({ endpoint: 'https://news-analytics.me.workers.dev/collect' });
  });
  it('stops the build with a plain message for a bad address', () => {
    for (const e of ['http://an.test/collect', 'an.test/collect', 'https://an.test/other', 'https://an.test/', 'https://a b.test/collect', 'https://localhost/collect']) {
      expect(() => beaconPlan({ endpoint: e })).toThrow(/analytics\.json/);
    }
  });
});

describe('the acted and webdriver flags in the beacon (v0.76.0)', () => {
  const ready = async (o: Parameters<typeof win>[0] = {}) => { const x = win(o); beaconClient(x.w, { endpoint: EP }); await x.flush(); return x; };
  const real = (type: string) => ({ type, isTrusted: true });
  const last = (x: ReturnType<typeof win>) => x.sent[x.sent.length - 1].body;

  it('starts with acted 0 and webdriver 0 and sends both as numbers', async () => {
    const x = await ready();
    x.ticks(5);
    expect(last(x).acted).toBe(0);
    expect(last(x).webdriver).toBe(0);
    expect(typeof last(x).acted).toBe('number');
    expect(JSON.stringify(last(x)).length).toBeLessThanOrEqual(MAX_BODY);
  });
  it('a real pointer press, key press or touch sets acted to 1', async () => {
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      const x = await ready();
      x.ticks(5);
      expect(last(x).acted).toBe(0);
      x.listeners[type](real(type));
      x.ticks(30);
      expect(last(x).acted).toBe(1);
    }
  });
  it('a made-up event (isTrusted false) does not set acted, but still counts as a sign of life for read time (as before)', async () => {
    const x = await ready();
    x.ticks(1);
    x.listeners.pointerdown({ type: 'pointerdown', isTrusted: false });
    x.listeners.keydown({ type: 'keydown', isTrusted: false });
    x.ticks(29);
    expect(last(x).acted).toBe(0);
    expect(last(x).read).toBe(30);
  });
  it('mouse movement alone does not set acted (it needs a press, a key, a touch or a scroll)', async () => {
    const x = await ready();
    x.ticks(1);
    x.listeners.mousemove(real('mousemove'));
    x.ticks(29);
    expect(last(x).acted).toBe(0);
  });
  it('a scroll sets acted only from 20 percent of the way down (the first screen is not a scroll)', async () => {
    const x = await ready();
    x.ticks(1);
    x.listeners.scroll(real('scroll')); // top of the page
    x.w.pageYOffset = 290; // 290 of 1500 is 19 percent
    x.listeners.scroll(real('scroll'));
    x.ticks(29);
    expect(last(x).acted).toBe(0);
    x.w.pageYOffset = 300; // 20 percent
    x.listeners.scroll(real('scroll'));
    x.ticks(30);
    expect(last(x).acted).toBe(1);
  });
  it('acted never goes back to 0 and a change of acted alone is sent when the page is left', async () => {
    const x = await ready();
    x.ticks(5);
    const before = x.sent.length;
    x.listeners.pointerdown(real('pointerdown')); // read and scroll are the same as in the last message
    x.listeners.pagehide();
    expect(x.sent.length).toBe(before + 1);
    expect(last(x).acted).toBe(1);
    x.listeners.pagehide();
    expect(x.sent.length).toBe(before + 1); // nothing new to say
    x.ticks(30);
    expect(last(x).acted).toBe(1);
  });
  it('webdriver is 1 only when navigator.webdriver is exactly true', async () => {
    const mk = (webdriver: unknown) => ({ webdriver, sendBeacon: (_u: string, b: string) => { return !!b; } });
    for (const [value, expected] of [[true, 1], [false, 0], [undefined, 0], ['true', 0], [1, 0]] as const) {
      const sent: any[] = [];
      const x = win({ beacon: { webdriver: value, sendBeacon: (_u: string, b: string) => { sent.push(JSON.parse(b)); return true; } } });
      beaconClient(x.w, { endpoint: EP });
      await x.flush();
      x.ticks(5);
      expect(sent[0].webdriver).toBe(expected);
    }
    expect(mk(true).webdriver).toBe(true);
  });
  it('a navigator that throws on webdriver does not stop the beacon', async () => {
    const nav: any = { sendBeacon: () => true };
    Object.defineProperty(nav, 'webdriver', { get() { throw new Error('no'); } });
    const x = win({ beacon: nav });
    expect(() => beaconClient(x.w, { endpoint: EP })).not.toThrow();
  });
  it('sets no cookie and writes nothing new to storage for the flags', async () => {
    const x = await ready();
    x.listeners.pointerdown(real('pointerdown'));
    x.ticks(30);
    expect(x.doc.cookie).toBeUndefined();
    expect([...x.store.keys()]).toEqual(['anSid']);
  });
  it('the browser file has no fingerprint code (no canvas, audio or font probing) and still sets no cookie', () => {
    const src = readFileSync('src/lib/beacon-client.js', 'utf8');
    expect(src).not.toMatch(/canvas|AudioContext|OfflineAudio|getContext|measureText|document\.fonts|document\.cookie/);
  });
});

describe('the 5-second rule in the beacon (v0.78.0, bot protection Part 4b-2)', () => {
  it('a page left before 5 reader seconds sends nothing, not even on leaving', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(4);
    x.listeners.pagehide();
    x.doc.visibilityState = 'hidden';
    x.docListeners.visibilitychange();
    expect(x.sent.length).toBe(0);
    expect(x.fetched.length).toBe(0);
  });
  it('a background tab never reaches 5 seconds, so it sends nothing (no background tab hits)', async () => {
    const x = win({ visible: false });
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.listeners.pointerdown();
    x.ticks(60);
    x.listeners.pagehide();
    expect(x.sent.length).toBe(0);
  });
  it('exactly 5 reader seconds is enough: one message with read 5 and nothing more until the 30th', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(5);
    expect(x.sent.map((m) => m.body.read)).toEqual([5]);
  });
  it('a stamp that arrives late (after 5 seconds) makes the first message go out at once, with read 5 or more', async () => {
    let release: any;
    const x = win({ stamp: () => new Promise((res) => { release = () => res({ ok: true, json: async () => ({ stamp: STAMP }) }); }) });
    beaconClient(x.w, { endpoint: EP });
    x.ticks(7);
    expect(x.sent.length).toBe(0);
    release();
    await x.flush();
    expect(x.sent.length).toBe(1);
    expect(x.sent[0].body.read).toBe(7);
  });
  it('a stamp that arrives before 5 seconds sends nothing yet', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(3);
    expect(x.sent.length).toBe(0);
  });
  it('every message the Worker gets has read of at least 5 (the rule is in the page, the Worker still accepts any read)', async () => {
    const x = win();
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(30);
    x.listeners.pointerdown(); // the reader is still there
    x.ticks(5);
    x.listeners.pagehide();
    for (const m of x.sent) expect(m.body.read).toBeGreaterThanOrEqual(5);
    expect(x.sent.map((m) => m.body.read)).toEqual([5, 30, 35]);
  });
});

// v0.97.0 (push part 7e-3): a push notification link ends with ?pn=1, and only then the message carries `pn: 1`.
describe('push notification mark in the beacon (v0.97.0)', () => {
  const run = async (search?: string) => {
    const x = win(search === undefined ? {} : { search });
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(30);
    return x.sent.map((m) => m.body);
  };
  it('sends pn 1 on every message when the address has ?pn=1, and nothing else changes', async () => {
    const bodies = await run('?pn=1');
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(b.pn).toBe(1);
      expect(Object.keys(b).sort()).toEqual(['acted', 'path', 'pn', 'pv', 'read', 'ref', 'scroll', 'sid', 'stamp', 'tz', 'webdriver']);
      expect(b.path).toBe('/2026/11/14/blogs/world/a-story/'); // the page address in the data has no query part
    }
  });
  it('finds pn=1 between other parameters too', async () => {
    for (const q of ['?utm=a&pn=1', '?pn=1&utm=a', '?a=1&pn=1&b=2']) expect((await run(q))[0].pn).toBe(1);
  });
  it('sends no pn for no query, other values, other names or no search property at all', async () => {
    for (const q of [undefined, '', '?pn=0', '?pn=10', '?pn=', '?xpn=1', '?pn=1x', '?a=pn=1', '?PN=1']) {
      const b = (await run(q))[0];
      expect('pn' in b, String(q)).toBe(false);
      expect(Object.keys(b).sort()).toEqual(['acted', 'path', 'pv', 'read', 'ref', 'scroll', 'sid', 'stamp', 'tz', 'webdriver']);
    }
  });
  it('a broken location object does not stop the beacon', async () => {
    const x = win();
    Object.defineProperty(x.w.location, 'search', { get() { throw new Error('blocked'); } });
    beaconClient(x.w, { endpoint: EP });
    await x.flush();
    x.ticks(30);
    expect(x.sent.length).toBeGreaterThan(0);
    expect('pn' in x.sent[0].body).toBe(false);
  });
});
