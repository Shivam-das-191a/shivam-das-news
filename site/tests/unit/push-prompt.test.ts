import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pushPromptPlan } from '../../src/lib/push-prompt';
import { ICONS } from '../../src/lib/svg-icons';

const pushPromptClient: any = new Function(readFileSync('src/lib/push-prompt-client.js', 'utf8') + '\nreturn pushPromptClient;')();
const KEY = 'pushPrompt';
const DAY = 86400000;
// a real-looking public key: 65 bytes, first byte 4, URL-safe base64
const GOOD_KEY = Buffer.from([4, ...Array.from({ length: 64 }, (_, i) => i + 1)]).toString('base64url');

function page(o: { pageType?: string; stored?: any; raw?: string; path?: string; top?: number; innerHeight?: number; permission?: string; noPush?: boolean; sub?: boolean; regError?: boolean; noCard?: boolean; storageBroken?: boolean } = {}) {
  const store = new Map<string, string>();
  if (o.stored !== undefined) store.set(KEY, JSON.stringify(o.stored));
  if (o.raw !== undefined) store.set(KEY, o.raw);
  const listeners: Record<string, any> = {};
  const attrs: Record<string, string | null> = { hidden: '' };
  const dismissBtn: any = { handlers: {} as any, addEventListener(e: string, f: any) { this.handlers[e] = f; } };
  const card: any = {
    getBoundingClientRect: () => ({ top: o.top ?? 5000 }),
    removeAttribute: (k: string) => { attrs[k] = null; },
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    querySelector: (s: string) => (s === '[data-push-dismiss]' ? dismissBtn : null),
  };
  const intervals: any[] = [];
  const sw = { getRegistration: () => (o.regError ? Promise.reject(new Error('x')) : Promise.resolve(o.sub ? { pushManager: { getSubscription: () => Promise.resolve({}) } } : null)) };
  const w: any = {
    document: {
      body: { getAttribute: () => (o.pageType ?? 'article') },
      querySelector: (s: string) => (s === '[data-push-prompt]' && !o.noCard ? card : null),
      documentElement: { scrollHeight: 4000 },
      visibilityState: 'visible',
    },
    localStorage: o.storageBroken ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } : { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => void store.set(k, v) },
    location: { pathname: o.path ?? '/2026/11/16/blogs/tech/a/' },
    navigator: o.noPush ? {} : { serviceWorker: sw },
    innerHeight: o.innerHeight ?? 800,
    scrollY: 0,
    addEventListener: (e: string, f: any) => { listeners[e] = f; },
    setInterval: (f: any) => { intervals.push(f); return intervals.length; },
    clearInterval: () => {},
    Notification: { permission: o.permission ?? 'default' },
  };
  if (!o.noPush) w.PushManager = {};
  return { w, store, attrs, listeners, dismissBtn, intervals, card, saved: () => JSON.parse(store.get(KEY) ?? 'null') };
}
const returning = (extra: any = {}) => ({ v: 1, reads: ['/old-1/'], dismissed: 0, last: 0, ...extra });

describe('push soft prompt plan', () => {
  it('is off while config/push.json is empty or wrong', () => {
    expect(pushPromptPlan({ endpoint: '', vapidPublicKey: '' })).toBeNull();
    expect(pushPromptPlan({ endpoint: 'http://a.test', vapidPublicKey: GOOD_KEY })).toBeNull();
    expect(pushPromptPlan({ endpoint: 'https://a.test', vapidPublicKey: 'abc' })).toBeNull();
    expect(pushPromptPlan(null)).toBeNull();
  });
  it('is on with a valid address and key', () => {
    expect(pushPromptPlan({ endpoint: 'https://push.test', vapidPublicKey: GOOD_KEY })).toEqual({ worker: '/push-sw.js' });
  });
  it('has a bell icon that uses the text colour only', () => {
    expect(ICONS.bell).toBeTruthy();
    expect(ICONS.bell).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});

describe('push soft prompt in the browser (PLAN 31.2)', () => {
  it('does nothing on a page that is not an article, or without the card', async () => {
    for (const type of ['home', 'category', 'page', 'search', '404']) {
      const x = page({ pageType: type, stored: returning() });
      expect(await pushPromptClient(x.w, {})()).toBe(false);
      expect(Object.keys(x.listeners)).toHaveLength(0);
      expect(x.store.size).toBe(1);
    }
    const y = page({ noCard: true, stored: returning() });
    expect(await pushPromptClient(y.w, {})()).toBe(false);
  });

  it('never shows on the very first visit, and remembers the visit', async () => {
    const x = page();
    expect(await pushPromptClient(x.w, {})()).toBe(false);
    expect(x.attrs.hidden).toBe('');
    expect(x.saved().reads).toEqual(['/2026/11/16/blogs/tech/a/']);
  });

  it('shows on the 2nd different article, while its place is below the screen', async () => {
    const x = page({ stored: returning() });
    expect(await pushPromptClient(x.w, {})()).toBe(true);
    expect(x.attrs.hidden).toBeNull();
    expect(x.saved().reads).toHaveLength(2);
  });

  it('does not count the same article twice', async () => {
    const x = page({ stored: returning({ reads: ['/2026/11/16/blogs/tech/a/'] }), path: '/2026/11/16/blogs/tech/a/' });
    expect(await pushPromptClient(x.w, {})()).toBe(false);
    expect(x.saved().reads).toHaveLength(1);
  });

  it('keeps at most 20 addresses', async () => {
    const reads = Array.from({ length: 20 }, (_, i) => `/r${i}/`);
    const x = page({ stored: returning({ reads }) });
    await pushPromptClient(x.w, {})();
    expect(x.saved().reads).toHaveLength(20);
    expect(x.saved().reads[19]).toBe('/2026/11/16/blogs/tech/a/');
  });

  it('shows after 45 active seconds and more than half scrolled, on a return visit', async () => {
    const x = page({ stored: returning({ reads: ['/2026/11/16/blogs/tech/a/'] }), path: '/2026/11/16/blogs/tech/a/' });
    const check = pushPromptClient(x.w, {});
    x.w.scrollY = 3000;
    x.listeners.scroll();
    for (let i = 0; i < 44; i++) x.intervals[0]();
    expect(x.attrs.hidden).toBe('');
    x.intervals[0]();
    await new Promise((r) => setTimeout(r, 5));
    expect(x.attrs.hidden).toBeNull();
    expect(await check()).toBe(false);
  });

  it('45 seconds without scrolling is not enough', async () => {
    const x = page({ stored: returning({ reads: ['/2026/11/16/blogs/tech/a/'] }), path: '/2026/11/16/blogs/tech/a/' });
    pushPromptClient(x.w, {});
    for (let i = 0; i < 60; i++) x.intervals[0]();
    await new Promise((r) => setTimeout(r, 5));
    expect(x.attrs.hidden).toBe('');
  });

  it('stays hidden when the place is already on screen (nothing may move under the reader)', async () => {
    const x = page({ stored: returning(), top: 300 });
    expect(await pushPromptClient(x.w, {})()).toBe(false);
    expect(x.attrs.hidden).toBe('');
  });

  it('stays hidden when push is not possible, the answer was No, the browser is already subscribed, or the check fails', async () => {
    for (const o of [{ noPush: true }, { permission: 'denied' }, { sub: true }, { regError: true }]) {
      const x = page({ stored: returning(), ...o });
      expect(await pushPromptClient(x.w, {})(), JSON.stringify(o)).toBe(false);
      expect(x.attrs.hidden).toBe('');
    }
  });

  it('dismissed once: hidden for 14 days, then it may come back; dismissed 3 times: never', async () => {
    const t = Date.now();
    const soon = page({ stored: returning({ dismissed: 1, last: t - 13 * DAY }) });
    expect(await pushPromptClient(soon.w, {})()).toBe(false);
    const later = page({ stored: returning({ dismissed: 1, last: t - 15 * DAY }) });
    expect(await pushPromptClient(later.w, {})()).toBe(true);
    const never = page({ stored: returning({ dismissed: 3, last: t - 400 * DAY }) });
    expect(await pushPromptClient(never.w, {})()).toBe(false);
  });

  it('the Not now button hides the card and counts the dismissal', async () => {
    const x = page({ stored: returning() });
    await pushPromptClient(x.w, {})();
    x.dismissBtn.handlers.click();
    expect(x.attrs.hidden).toBe('');
    expect(x.saved().dismissed).toBe(1);
    expect(x.saved().last).toBeGreaterThan(Date.now() - 5000);
  });

  it('blocked or damaged storage means no card', async () => {
    expect(await pushPromptClient(page({ storageBroken: true }).w, {})()).toBe(false);
    expect(await pushPromptClient(page({ raw: '{not json' }).w, {})()).toBe(false);
    expect(await pushPromptClient(page({ raw: JSON.stringify({ v: 2, reads: [], dismissed: 0 }) }).w, {})()).toBe(false);
  });

  it('never asks for the permission and never calls the network', () => {
    const text = readFileSync('src/lib/push-prompt-client.js', 'utf8');
    expect(text).not.toMatch(/requestPermission|\.subscribe\(|fetch\(|sendBeacon|XMLHttpRequest/);
  });
});

describe('push soft prompt in the article page', () => {
  const article = readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8');
  it('is used by the article template only', async () => {
    expect(article).toContain('<PushPrompt />');
    const { readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const users = walk('src').filter((f) => /\.(astro|ts|js)$/.test(f) && /import\s+PushPrompt\s+from/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(/\\/g, '/'));
    expect(users).toEqual(['src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro']);
  });
  it('the card is kept out of the search index and has no emoji text', () => {
    const c = readFileSync('src/components/PushPrompt.astro', 'utf8');
    expect(c).toContain('data-pagefind-ignore');
    expect(c).toContain('hidden');
  });
});
