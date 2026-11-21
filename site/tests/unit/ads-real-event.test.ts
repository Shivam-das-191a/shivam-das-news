import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// v0.81.0 (BOT_PROTECTION Part 5a): no ad loads until ONE REAL event of the reader (press, key, touch or scroll).
// The idle time does not start the loader any more, and an event made up by a script (isTrusted false) is ignored.
const source = readFileSync('src/lib/ads-client.js', 'utf8');
const adsClient: any = new Function(source + '\nreturn adsClient;')();
const cfg = { geoUrl: 'https://geo.test/geo', popunder: '', socialBar: 'https://ads.test/bar.js', timeoutMs: 40, idleMs: 10, hideAll: false, hidePopunder: false };
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));

function win() {
  const added: any[] = [];
  const calls: any[] = [];
  const listeners: Record<string, any> = {};
  const w: any = {
    document: {
      body: { getAttribute: () => 'article', appendChild: (s: any) => added.push(s) },
      createElement: () => ({ attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }),
    },
    sessionStorage: { getItem: () => null, setItem: () => undefined },
    fetch: (...a: any[]) => { calls.push(a); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ads: true, consent: false }) }); },
    setTimeout: (f: any, ms: number) => setTimeout(f, ms),
    addEventListener: (e: string, f: any) => { listeners[e] = f; },
    removeEventListener: (e: string) => { delete listeners[e]; },
  };
  return { w, added, calls, listeners };
}

describe('the ad loader waits for one real event (v0.81.0)', () => {
  it('the idle time alone loads nothing: after the old 4 second wait (here 10 ms) there is no request and no ad', async () => {
    const x = win();
    adsClient(x.w, cfg);
    await wait(120);
    expect(x.calls.length).toBe(0);
    expect(x.added.length).toBe(0);
  });
  it('the source has no timer that starts the loader', () => {
    expect(source).not.toMatch(/setTimeout\(\s*run\b/);
  });
  it('a real event (isTrusted true) starts it, once, and the listeners are removed', async () => {
    const x = win();
    adsClient(x.w, cfg);
    x.listeners.scroll({ isTrusted: true });
    await wait();
    expect(x.calls.length).toBe(1);
    expect(x.added.map((a) => a.src)).toEqual([cfg.socialBar]);
    expect(Object.keys(x.listeners)).toEqual([]);
  });
  it('each of the four events works', async () => {
    for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
      const x = win();
      adsClient(x.w, cfg);
      x.listeners[name]({ isTrusted: true });
      await wait();
      expect(x.calls.length).toBe(1);
    }
  });
  it('an event made up by a script (isTrusted false) is ignored and the loader keeps waiting', async () => {
    const x = win();
    adsClient(x.w, cfg);
    for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart']) x.listeners[name]({ isTrusted: false });
    await wait();
    expect(x.calls.length).toBe(0);
    expect(x.added.length).toBe(0);
    expect(Object.keys(x.listeners).sort()).toEqual(['keydown', 'pointerdown', 'scroll', 'touchstart']);
  });
  it('a made-up event first and a real one after it still starts the loader', async () => {
    const x = win();
    adsClient(x.w, cfg);
    x.listeners.keydown({ isTrusted: false });
    x.listeners.pointerdown({ isTrusted: true });
    await wait();
    expect(x.added.length).toBe(1);
  });
  it('a call with no event object counts (the loader itself is called, as the tests and older callers do)', async () => {
    const x = win();
    adsClient(x.w, cfg);
    x.listeners.touchstart();
    await wait();
    expect(x.calls.length).toBe(1);
  });
  it('two real events in a row start the loader only once', async () => {
    const x = win();
    adsClient(x.w, cfg);
    x.listeners.scroll({ isTrusted: true });
    const again = x.listeners.pointerdown; // already removed after the first event
    expect(again).toBeUndefined();
    await wait();
    expect(x.calls.length).toBe(1);
  });
  it('a page that is not an article still adds nothing and listens to nothing', async () => {
    const x = win();
    x.w.document.body.getAttribute = () => 'home';
    adsClient(x.w, cfg);
    expect(Object.keys(x.listeners)).toEqual([]);
    await wait(60);
    expect(x.calls.length + x.added.length).toBe(0);
  });
});
