import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fakeIdb } from './helpers/fake-idb';

const SW_PATH = new URL('../../public/push-sw.js', import.meta.url);
const SW_SOURCE = readFileSync(SW_PATH, 'utf8');
const ORIGIN = 'https://news.test';
const API = 'https://push.test';
const STATE = { api: API, sub: 'a'.repeat(32), token: 'T'.repeat(43), prefs: {}, at: 1 };

/** Runs public/push-sw.js with a made-up service worker scope. Returns the handlers and the fakes it used. */
function loadWorker(o: { state?: any; idb?: any; fetchImpl?: any; clients?: any[]; openWindow?: any } = {}) {
  const handlers: Record<string, (e: any) => void> = {};
  const idbFake = o.idb ?? fakeIdb();
  if (o.state !== undefined && o.state !== null) {
    // the page saved its state before: put it where the worker looks
    const stores = new Map([['state', new Map([['main', structuredClone(o.state)]])]]);
    idbFake.dbs.set('news-push', stores);
  }
  const fetchMock = vi.fn(o.fetchImpl ?? (async () => new Response('{}', { status: 404 })));
  const showNotification = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const skipWaiting = vi.fn();
  const openWindow = o.openWindow ?? vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => o.clients ?? []);
  const self = {
    location: { origin: ORIGIN, hostname: 'news.test' },
    addEventListener: (name: string, fn: (e: any) => void) => {
      handlers[name] = fn;
    },
    skipWaiting,
    clients: { claim, matchAll, openWindow },
    registration: { showNotification },
  };
  new Function('self', 'indexedDB', 'fetch', SW_SOURCE)(self, idbFake.idb, fetchMock);
  return { handlers, fetchMock, showNotification, claim, skipWaiting, openWindow, matchAll, idb: idbFake };
}

/** An event: waitUntil collects what the worker promises to finish. */
function makeEvent(extra: any = {}) {
  const promises: Promise<any>[] = [];
  const e: any = { waitUntil: (p: Promise<any>) => void promises.push(Promise.resolve(p)), ...extra };
  e.done = () => Promise.all(promises);
  e.promises = promises;
  return e;
}
const pushEvent = (data: any, raw = false) =>
  makeEvent({
    data: data === null ? null : { json: () => (raw ? JSON.parse(data) : data) },
  });
const message = (extra: any = {}) => ({ v: 1, title: 'Parliament passes the bill', body: 'The vote ended late on Saturday.', url: `${ORIGIN}/2026/11/15/blogs/world/vote/?pn=1`, tag: 'vote-bill', breaking: false, renotify: false, ...extra });
const notification = (data: any) => ({ close: vi.fn(), data });

async function receive(w: ReturnType<typeof loadWorker>, data: any, raw = false) {
  const e = pushEvent(data, raw);
  w.handlers.push(e);
  await e.done();
  return w.showNotification.mock.calls[w.showNotification.mock.calls.length - 1] as any[];
}

describe('what the worker handles (BUGS P16)', () => {
  it('only push, click, close, install and activate; no fetch handler, no cache', () => {
    const w = loadWorker();
    expect(Object.keys(w.handlers).sort()).toEqual(['activate', 'install', 'notificationclick', 'notificationclose', 'push']);
    expect(SW_SOURCE).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(SW_SOURCE).not.toMatch(/caches\.|importScripts|pushManager|getSubscription/);
  });

  it('a new version takes over at once: skipWaiting on install, claim on activate', async () => {
    const w = loadWorker();
    w.handlers.install(makeEvent());
    expect(w.skipWaiting).toHaveBeenCalledTimes(1);
    const e = makeEvent();
    w.handlers.activate(e);
    await e.done();
    expect(w.claim).toHaveBeenCalledTimes(1);
  });

  it('carries a version marker that changes when the file changes', () => {
    expect(SW_SOURCE).toMatch(/const SW_VERSION = '\d+';/);
  });

  it('the images it names exist', () => {
    const pub = (n: string) => new URL(`../../public/${n}`, import.meta.url);
    expect(existsSync(pub('icon-192.png'))).toBe(true);
    expect(existsSync(pub('badge-96.png'))).toBe(true);
    expect(SW_SOURCE).toContain("'/icon-192.png'");
    expect(SW_SOURCE).toContain("'/badge-96.png'");
  });
});

describe('showing a notification (PLAN 31.9)', () => {
  it('shows title, body, icon, badge, the two buttons and the story address', async () => {
    const w = loadWorker();
    const [title, o] = await receive(w, message());
    expect(title).toBe('Parliament passes the bill');
    expect(o.body).toBe('The vote ended late on Saturday.');
    expect(o.icon).toBe('/icon-192.png');
    expect(o.badge).toBe('/badge-96.png');
    expect(o.lang).toBe('en');
    expect(o.actions).toEqual([
      { action: 'open', title: 'Read now' },
      { action: 'less', title: 'Less like this' },
    ]);
    expect(o.data).toEqual({ url: `${ORIGIN}/2026/11/15/blogs/world/vote/?pn=1`, tag: 'vote-bill' });
    expect(o.tag).toBe('vote-bill');
    expect(o.renotify).toBeUndefined(); // a replaced normal story does not make a new sound
    expect(o.image).toBeUndefined();
    expect(o.requireInteraction).toBeUndefined();
  });

  it('breaking news renotifies, so a replaced alert still alerts', async () => {
    const w = loadWorker();
    const [, o] = await receive(w, message({ breaking: true, renotify: true }));
    expect(o.tag).toBe('vote-bill');
    expect(o.renotify).toBe(true);
  });

  it('never sets renotify without a tag (browsers throw an error for that)', async () => {
    const w = loadWorker();
    const [, o] = await receive(w, message({ tag: '', renotify: true }));
    expect(o.tag).toBeUndefined();
    expect(o.renotify).toBeUndefined();
    const [, p] = await receive(w, message({ tag: undefined, renotify: true }));
    expect(p.renotify).toBeUndefined();
  });

  it('adds the image only when it is an https address', async () => {
    const w = loadWorker();
    expect((await receive(w, message({ image: 'https://news.test/media/a.webp' })))[1].image).toBe('https://news.test/media/a.webp');
    expect((await receive(w, message({ image: 'http://news.test/media/a.webp' })))[1].image).toBeUndefined();
    expect((await receive(w, message({ image: 'javascript:alert(1)' })))[1].image).toBeUndefined();
    expect((await receive(w, message({ image: 'https://x.test/' + 'a'.repeat(1100) })))[1].image).toBeUndefined();
    expect((await receive(w, message({ image: 5 })))[1].image).toBeUndefined();
  });

  it('cleans and cuts the text, so a wrong message cannot flood the screen', async () => {
    const w = loadWorker();
    const [title, o] = await receive(w, message({ title: `  A\u0000 title \n with   spaces ${'x'.repeat(300)}`, body: 'b'.repeat(500), tag: 't'.repeat(200) }));
    expect(title.length).toBeLessThanOrEqual(100);
    expect(title.startsWith('A title with spaces ')).toBe(true);
    expect(o.body.length).toBeLessThanOrEqual(240);
    expect(o.tag.length).toBeLessThanOrEqual(80);
  });

  it('accepts a story address given as a path on this site', async () => {
    const w = loadWorker();
    const [, o] = await receive(w, message({ url: '/2026/11/15/blogs/world/vote/?pn=1' }));
    expect(o.data.url).toBe(`${ORIGIN}/2026/11/15/blogs/world/vote/?pn=1`);
  });

  const plain = (call: any[]) => {
    const [title, o] = call;
    expect(title).toBe('news.test');
    expect(o.body).toBe('Open the site for the latest news.');
    expect(o.data).toEqual({ url: `${ORIGIN}/?pn=1`, tag: '' });
    expect(o.actions).toBeUndefined();
    expect(o.renotify).toBeUndefined();
  };

  it('a message that is not ours shows one plain notice (a browser requires every push to show something)', async () => {
    const w = loadWorker();
    plain(await receive(w, message({ url: 'https://evil.test/phish/' }))); // an address on another site
    plain(await receive(w, message({ url: 'https://' })));
    plain(await receive(w, message({ v: 2 })));
    plain(await receive(w, message({ title: '   ' })));
    plain(await receive(w, message({ title: undefined })));
    plain(await receive(w, 'this is {not json', true));
    plain(await receive(w, null));
    plain(await receive(w, [1, 2, 3]));
    plain(await receive(w, 'text'));
    expect(w.showNotification).toHaveBeenCalledTimes(9);
  });

  it('every push shows exactly one notification', async () => {
    const w = loadWorker();
    await receive(w, message());
    expect(w.showNotification).toHaveBeenCalledTimes(1);
  });
});

describe('a tap on the notification', () => {
  it('opens the story and tells the Worker "open"', async () => {
    const w = loadWorker({ state: STATE });
    const n = notification({ url: `${ORIGIN}/2026/11/15/blogs/world/vote/?pn=1`, tag: 'vote-bill' });
    const e = makeEvent({ notification: n, action: '' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(n.close).toHaveBeenCalledTimes(1);
    expect(w.openWindow).toHaveBeenCalledWith(`${ORIGIN}/2026/11/15/blogs/world/vote/?pn=1`);
    expect(w.fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = w.fetchMock.mock.calls[0] as any[];
    expect(url).toBe(`${API}/feedback`);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body)).toEqual({ sub: STATE.sub, token: STATE.token, event: 'open', tag: 'vote-bill' });
  });

  it('the button "Read now" does the same as a tap on the notification', async () => {
    const w = loadWorker({ state: STATE });
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: 'open' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(w.openWindow).toHaveBeenCalledWith(`${ORIGIN}/a/?pn=1`);
    expect(JSON.parse((w.fetchMock.mock.calls[0] as any[])[1].body).event).toBe('open');
  });

  it('"Less like this" opens nothing and tells the Worker "less"', async () => {
    const w = loadWorker({ state: STATE });
    const n = notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'sports-final' });
    const e = makeEvent({ notification: n, action: 'less' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(n.close).toHaveBeenCalledTimes(1);
    expect(w.openWindow).not.toHaveBeenCalled();
    expect(w.matchAll).not.toHaveBeenCalled();
    expect(JSON.parse((w.fetchMock.mock.calls[0] as any[])[1].body)).toEqual({ sub: STATE.sub, token: STATE.token, event: 'less', tag: 'sports-final' });
  });

  it('shows the tab that already has the story open instead of opening a second one (the ?pn=1 part does not matter)', async () => {
    const focus = vi.fn(async () => undefined);
    const other = { url: `${ORIGIN}/other/`, focus: vi.fn() };
    const w = loadWorker({ state: STATE, clients: [other, { url: `${ORIGIN}/a/`, focus }] });
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: '' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(other.focus).not.toHaveBeenCalled();
    expect(w.openWindow).not.toHaveBeenCalled();
  });

  it('opens a new tab when only other pages are open', async () => {
    const w = loadWorker({ state: STATE, clients: [{ url: `${ORIGIN}/other/`, focus: vi.fn() }] });
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: '' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(w.openWindow).toHaveBeenCalledWith(`${ORIGIN}/a/?pn=1`);
  });

  it('a stored address on another site is never opened: the home page opens instead', async () => {
    const w = loadWorker({ state: STATE });
    for (const url of ['https://evil.test/x', undefined, 42, 'https://', 'javascript:alert(1)']) {
      w.openWindow.mockClear();
      const e = makeEvent({ notification: notification({ url, tag: 'x' }), action: '' });
      w.handlers.notificationclick(e);
      await e.done();
      expect(w.openWindow).toHaveBeenCalledWith(`${ORIGIN}/?pn=1`);
    }
  });

  it('a notification without data still opens the home page', async () => {
    const w = loadWorker({ state: STATE });
    const e = makeEvent({ notification: { close: vi.fn(), data: null }, action: '' });
    w.handlers.notificationclick(e);
    await e.done();
    expect(w.openWindow).toHaveBeenCalledWith(`${ORIGIN}/?pn=1`);
  });

  it('opening the story does not wait for the report, and a refused window does not break the tap', async () => {
    let signal: any;
    const w = loadWorker({
      state: STATE,
      fetchImpl: (_u: string, init: any) => {
        signal = init.signal;
        return new Promise(() => {}); // a Worker that never answers
      },
      openWindow: vi.fn(async () => {
        throw new Error('blocked');
      }),
    });
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: '' });
    w.handlers.notificationclick(e);
    await new Promise((r) => setTimeout(r, 30));
    expect(w.openWindow).toHaveBeenCalledTimes(1); // opened while the report was still waiting
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('a report that gets no answer is given up after 8 seconds', async () => {
    vi.useFakeTimers();
    try {
      const w = loadWorker({
        state: STATE,
        fetchImpl: (_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
      });
      const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: 'less' });
      w.handlers.notificationclick(e);
      let finished = false;
      e.done().then(() => (finished = true));
      await vi.advanceTimersByTimeAsync(7900);
      expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(finished).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a close', () => {
  it('tells the Worker "close" and opens nothing', async () => {
    const w = loadWorker({ state: STATE });
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'story-1' }) });
    w.handlers.notificationclose(e);
    await e.done();
    expect(w.openWindow).not.toHaveBeenCalled();
    expect(JSON.parse((w.fetchMock.mock.calls[0] as any[])[1].body)).toEqual({ sub: STATE.sub, token: STATE.token, event: 'close', tag: 'story-1' });
  });

  it('handles a notification without data', async () => {
    const w = loadWorker({ state: STATE });
    const e = makeEvent({ notification: { data: undefined } });
    w.handlers.notificationclose(e);
    await e.done();
    expect(JSON.parse((w.fetchMock.mock.calls[0] as any[])[1].body).tag).toBe('');
  });
});

describe('reports are best effort and private', () => {
  const tap = async (w: ReturnType<typeof loadWorker>) => {
    const e = makeEvent({ notification: notification({ url: `${ORIGIN}/a/?pn=1`, tag: 'x' }), action: 'less' });
    w.handlers.notificationclick(e);
    await e.done();
  };

  it('nothing is sent when the page never saved its state, or the state is incomplete', async () => {
    for (const state of [undefined, { api: API }, { api: API, sub: 's' }, { sub: 's', token: 't' }]) {
      const w = loadWorker({ state });
      await tap(w);
      expect(w.fetchMock).not.toHaveBeenCalled();
    }
  });

  it('nothing is sent to an address that is not https', async () => {
    for (const api of ['http://push.test', 'ftp://push.test', 'push.test', 'https://bad host']) {
      const w = loadWorker({ state: { ...STATE, api } });
      await tap(w);
      expect(w.fetchMock).not.toHaveBeenCalled();
    }
  });

  it('a slash at the end of the address is removed', async () => {
    const w = loadWorker({ state: { ...STATE, api: `${API}/` } });
    await tap(w);
    expect((w.fetchMock.mock.calls[0] as any[])[0]).toBe(`${API}/feedback`);
  });

  it('a failing network, a 404 answer or a blocked database never makes the tap fail', async () => {
    const down = loadWorker({ state: STATE, fetchImpl: async () => { throw new TypeError('offline'); } });
    await tap(down);
    const notFound = loadWorker({ state: STATE });
    await tap(notFound);
    const blocked = loadWorker({ state: STATE, idb: fakeIdb({ failOpen: true }) });
    await tap(blocked);
    expect(blocked.fetchMock).not.toHaveBeenCalled();
    expect(down.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('only the id, the token, the kind and the thread tag are sent: no text of the story, no endpoint, no address of the reader', async () => {
    const w = loadWorker({ state: STATE });
    await tap(w);
    const body = JSON.parse((w.fetchMock.mock.calls[0] as any[])[1].body);
    expect(Object.keys(body).sort()).toEqual(['event', 'sub', 'tag', 'token']);
    expect(['open', 'close', 'less']).toContain(body.event);
  });
});

describe('the notification badge file', () => {
  it('exists as a 96 by 96 PNG that is white with the mark in the transparency', async () => {
    const sharp = (await import('sharp')).default;
    const file = readFileSync(new URL('../../public/badge-96.png', import.meta.url));
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([96, 96, 4]);
    let clear = 0;
    let solid = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) expect([data[i], data[i + 1], data[i + 2]]).toEqual([255, 255, 255]);
      if (data[i + 3] === 0) clear++;
      if (data[i + 3] === 255) solid++;
    }
    expect(clear).toBeGreaterThan(96 * 96 * 0.2); // a background
    expect(solid).toBeGreaterThan(96 * 96 * 0.1); // a mark
  });

  it('the generator finds the mark on a dark or a light background alike', async () => {
    const sharp = (await import('sharp')).default;
    // @ts-ignore plain JS script
    const { makeBadge, BADGE_SIZE } = await import('../../scripts/badge-lib.mjs');
    expect(BADGE_SIZE).toBe(96);
    for (const [bg, fg] of [[{ r: 10, g: 40, b: 120 }, { r: 255, g: 255, b: 255 }], [{ r: 250, g: 250, b: 250 }, { r: 20, g: 20, b: 20 }]]) {
      const logo = await sharp({ create: { width: 256, height: 256, channels: 3, background: bg } })
        .composite([{ input: await sharp({ create: { width: 120, height: 120, channels: 3, background: fg } }).png().toBuffer(), gravity: 'center' }])
        .png()
        .toBuffer();
      const png = await makeBadge(logo);
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      const a = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
      expect(a(48, 48)).toBe(255); // the middle is the mark
      expect(a(2, 2)).toBe(0); // the corners are background
      expect(a(93, 93)).toBe(0);
      expect(info.width).toBe(96);
    }
  });
});

describe('the headers file', () => {
  it('serves the worker file without a long cache, so an update is seen at once (BUGS P16)', () => {
    const h = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    const block = /\/push-sw\.js\n((?:  .+\n?)+)/.exec(h);
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/Cache-Control: no-cache/);
  });
});
