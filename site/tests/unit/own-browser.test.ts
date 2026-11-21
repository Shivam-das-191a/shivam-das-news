import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// v0.84.0 (BOT_PROTECTION Part 5c): the "my own browser" switch. The browser files are plain text that the build puts into pages.
// Here the very same text is run against a fake window.
const ownBrowserSwitch: any = new Function(readFileSync('src/lib/own-browser.js', 'utf8') + '\nreturn ownBrowserSwitch;')();
const adsClient: any = new Function(readFileSync('src/lib/ads-client.js', 'utf8') + '\nreturn adsClient;')();
const beaconClient: any = new Function(readFileSync('src/lib/beacon-client.js', 'utf8') + '\nreturn beaconClient;')();

type Opts = { search?: string; hash?: string; mark?: string | null; storage?: 'ok' | 'broken' | 'missing'; history?: boolean };

function win(o: Opts = {}) {
  const store = new Map<string, string>();
  if (o.mark !== undefined && o.mark !== null) store.set('ownBrowser', o.mark);
  const replaced: string[] = [];
  const listeners: string[] = [];
  const fetched: string[] = [];
  const timers: number[] = [];
  const added: unknown[] = [];
  const w: any = {
    location: { pathname: '/2026/11/14/blogs/world/a-story/', search: o.search ?? '', hash: o.hash ?? '' },
    document: {
      body: { getAttribute: () => 'article', scrollHeight: 2000, appendChild: (s: unknown) => added.push(s) },
      documentElement: { scrollHeight: 2000, scrollTop: 0 },
      visibilityState: 'visible',
      referrer: '',
      createElement: () => ({ setAttribute() {} }),
      addEventListener() {},
    },
    pageYOffset: 0, innerHeight: 500, Intl,
    crypto: { getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    navigator: { sendBeacon: () => true },
    fetch: (u: string) => { fetched.push(u); return Promise.resolve({ ok: true, json: async () => ({ ads: false, stamp: '' }) }); },
    setTimeout: (f: any, ms: number) => setTimeout(f, ms),
    setInterval: () => { timers.push(1); return 1; },
    clearInterval() {},
    addEventListener: (e: string) => { listeners.push(e); },
    removeEventListener() {},
  };
  if (o.storage === 'broken') w.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  else if (o.storage !== 'missing') w.localStorage = { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  if (o.history !== false) w.history = { replaceState: (_s: unknown, _t: string, url: string) => { replaced.push(url); } };
  return { w, store, replaced, listeners, fetched, timers, added };
}

const adsCfg = { geoUrl: 'https://geo.test/geo', socialBar: 'https://ads.test/bar.js', timeoutMs: 40, hideAll: false, hidePopunder: false };
const beaconCfg = { endpoint: 'https://an.test/collect' };

describe('the switch: ?own-browser=on and ?own-browser=off', () => {
  it('on: marks the browser and cuts the word from the address bar', () => {
    const x = win({ search: '?own-browser=on' });
    expect(ownBrowserSwitch(x.w)).toBe('on');
    expect(x.store.get('ownBrowser')).toBe('1');
    expect(x.replaced).toEqual(['/2026/11/14/blogs/world/a-story/']);
  });

  it('off: removes the mark', () => {
    const x = win({ search: '?own-browser=off', mark: '1' });
    expect(ownBrowserSwitch(x.w)).toBe('off');
    expect(x.store.has('ownBrowser')).toBe(false);
  });

  it('keeps the other words of the address and the hash', () => {
    const x = win({ search: '?a=1&own-browser=on&b=2', hash: '#top' });
    expect(ownBrowserSwitch(x.w)).toBe('on');
    expect(x.replaced).toEqual(['/2026/11/14/blogs/world/a-story/?a=1&b=2#top']);
  });

  it('does nothing without the word, with another value, or with a longer word', () => {
    for (const search of ['', '?a=1', '?own-browser=maybe', '?own-browser=', '?xown-browser=on', '?own-browser-x=on', '?own-browser=onn']) {
      const x = win({ search });
      expect(ownBrowserSwitch(x.w)).toBeNull();
      expect(x.store.size).toBe(0);
      expect(x.replaced.length).toBe(0);
    }
  });

  it('a blocked storage never throws and gives null', () => {
    const x = win({ search: '?own-browser=on', storage: 'broken' });
    expect(ownBrowserSwitch(x.w)).toBeNull();
    const y = win({ search: '?own-browser=on', storage: 'missing' });
    expect(ownBrowserSwitch(y.w)).toBeNull();
  });

  it('a window without history still switches on', () => {
    const x = win({ search: '?own-browser=on', history: false });
    expect(ownBrowserSwitch(x.w)).toBe('on');
    expect(x.store.get('ownBrowser')).toBe('1');
  });
});

describe('the ad loader in the owner\'s own browser', () => {
  it('loads nothing, asks nobody, adds no listener', async () => {
    const x = win({ mark: '1' });
    const run = adsClient(x.w, adsCfg);
    expect(await run()).toEqual([]);
    expect(x.fetched.length).toBe(0);
    expect(x.added.length).toBe(0);
    expect(x.listeners.length).toBe(0);
  });

  it('any other mark, no mark, or a blocked storage works as before (listens for a real event)', () => {
    for (const o of [{ mark: '0' }, { mark: '' }, {}, { storage: 'broken' as const }, { storage: 'missing' as const }]) {
      const x = win(o);
      adsClient(x.w, adsCfg);
      expect(x.listeners.sort()).toEqual(['keydown', 'pointerdown', 'scroll', 'touchstart']);
      expect(x.fetched.length).toBe(0);
    }
  });
});

describe('the analytics beacon in the owner\'s own browser', () => {
  it('counts no visit: no stamp request, no timer, no listener, nothing returned', () => {
    const x = win({ mark: '1' });
    expect(beaconClient(x.w, beaconCfg)).toBeNull();
    expect(x.fetched.length).toBe(0);
    expect(x.timers.length).toBe(0);
    expect(x.listeners.length).toBe(0);
  });

  it('any other mark, no mark, or a blocked storage works as before (starts counting)', () => {
    for (const o of [{ mark: '0' }, {}, { storage: 'broken' as const }, { storage: 'missing' as const }]) {
      const x = win(o);
      const b = beaconClient(x.w, beaconCfg);
      expect(b === null).toBe(false);
      expect(x.timers.length).toBe(1);
      expect(x.fetched.length).toBe(1);
      b.stop();
    }
  });
});

describe('the switch is only a mark in the browser', () => {
  it('own-browser.js sets no cookie and sends nothing over the network', () => {
    const text = readFileSync('src/lib/own-browser.js', 'utf8');
    expect(text).not.toMatch(/document\.cookie|fetch\(|sendBeacon|XMLHttpRequest|new Image/);
  });

  it('only Base.astro puts the switch into pages, and it is written before the page head slot', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toContain("import ownBrowserSrc from '../lib/own-browser.js?raw'");
    expect(base).toContain('ownBrowserSwitch(window)');
    expect(base.indexOf('ownBrowserSwitch(window)')).toBeLessThan(base.indexOf('<slot name="head" />'));
  });

  it('both clients read the same key as the switch writes', () => {
    for (const f of ['src/lib/ads-client.js', 'src/lib/beacon-client.js']) expect(readFileSync(f, 'utf8')).toContain("getItem('ownBrowser') === '1'");
    expect(readFileSync('src/lib/own-browser.js', 'utf8')).toContain("setItem('ownBrowser', '1')");
  });
});
