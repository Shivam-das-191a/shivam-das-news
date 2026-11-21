// Push service worker (v0.54.0, Phase 9 part 4; PLAN 31.9, 31.8; BUGS P16).
// It does four things and nothing else: show a pushed notification, open the story when it is tapped,
// note a close, and note a tap on "Less like this". It has no fetch handler, no cache and no page code, so it can never change how the site loads.
// SW_VERSION changes whenever this file changes (BUGS P16): the browser sees a new file, the new worker takes over at once (skipWaiting, claim).
// The notification text only ever comes from the push message made by the Worker (workers/push/lib.js buildPayload):
// { v: 1, title, body, url (with ?pn=1), tag, breaking, renotify, image? }. Anything that does not look like that is not trusted:
// an address that is not on this site is replaced by the home page, an unreadable message shows a plain notice (a browser requires every push to show something).
// Taps are reported to the push Worker at POST <api>/feedback { sub, token, event: 'open' | 'close' | 'less', tag }.
// That route is built in part 8 (learning, PLAN 31.8); until then the Worker answers 404 and this file ignores the answer on purpose.
// The page saves { api, sub, token } in IndexedDB ("news-push", store "state", key "main"; see src/lib/push-client.js); nothing else is read or kept here.

const SW_VERSION = '1';
const DB_NAME = 'news-push';
const STORE_NAME = 'state';
const STATE_KEY = 'main';
const ORIGIN = self.location.origin;
const ICON = '/icon-192.png';
const BADGE = '/badge-96.png';
const TITLE_MAX = 100;
const BODY_MAX = 240;
const TAG_MAX = 80;
const URL_MAX = 1000;
const REPORT_TIMEOUT_MS = 8000; // a slow Worker must not keep this worker alive

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** An address on this site (same origin, https or the local test origin), or null. Never an address on another site. */
function ownUrl(value) {
  if (typeof value !== 'string' || !value || value.length > URL_MAX) return null;
  try {
    const u = new URL(value, ORIGIN);
    return u.origin === ORIGIN ? u.href : null;
  } catch {
    return null;
  }
}

const imageUrl = (value) => {
  if (typeof value !== 'string' || value.length > URL_MAX) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

/** Reads the push message. Returns the clean fields or null when it is not a message of this site's Worker. */
function readMessage(event) {
  let d = null;
  try {
    d = event.data ? event.data.json() : null;
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  const title = text(d.title, TITLE_MAX);
  const url = ownUrl(d.url);
  if (!title || !url) return null;
  const tag = text(d.tag, TAG_MAX);
  return { title, body: text(d.body, BODY_MAX), url, tag, renotify: d.renotify === true, image: imageUrl(d.image) };
}

self.addEventListener('push', (event) => {
  const m = readMessage(event);
  if (!m) {
    // Not a readable message: show one plain notice, because a browser requires every push to show something.
    event.waitUntil(self.registration.showNotification(self.location.hostname, { body: 'Open the site for the latest news.', icon: ICON, badge: BADGE, tag: 'site', data: { url: ORIGIN + '/?pn=1', tag: '' }, lang: 'en' }));
    return;
  }
  const options = {
    body: m.body,
    icon: ICON,
    badge: BADGE,
    data: { url: m.url, tag: m.tag },
    actions: [
      { action: 'open', title: 'Read now' },
      { action: 'less', title: 'Less like this' },
    ],
    lang: 'en',
  };
  if (m.image) options.image = m.image;
  if (m.tag) {
    options.tag = m.tag; // the same story replaces the earlier notification (PLAN 31.7)
    if (m.renotify) options.renotify = true; // a replaced breaking alert still alerts; renotify without a tag is an error in browsers
  }
  event.waitUntil(self.registration.showNotification(m.title, options));
});

/** Reads { api, sub, token } saved by the page. Resolves to null when there is nothing or anything goes wrong. */
function readState() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE_NAME)) open.result.createObjectStore(STORE_NAME);
      };
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const get = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY);
          get.onsuccess = () => {
            db.close();
            resolve(get.result || null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/** Tells the push Worker what the reader did. Never throws, never waits for an answer that matters, sends no text of the story. */
async function report(kind, tag) {
  try {
    const s = await readState();
    if (!s || typeof s.api !== 'string' || !/^https:\/\/[^\s]+$/.test(s.api) || !s.sub || !s.token) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REPORT_TIMEOUT_MS);
    try {
      await fetch(s.api.replace(/\/+$/, '') + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub: s.sub, token: s.token, event: kind, tag: typeof tag === 'string' ? tag : '' }),
        keepalive: true,
        credentials: 'omit',
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* a failed report is lost on purpose: nothing may stop the reader from reading */
  }
}

const sameStory = (a, b) => {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname;
  } catch {
    return false;
  }
};

async function openStory(url) {
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (sameStory(c.url, url) && typeof c.focus === 'function') return c.focus(); // the story is already open: show that tab
    }
    if (self.clients.openWindow) return await self.clients.openWindow(url);
  } catch {
    /* some browsers refuse to open a window; nothing more can be done */
  }
  return undefined;
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  n.close();
  const data = n.data || {};
  if (event.action === 'less') {
    event.waitUntil(report('less', data.tag)); // "Less like this" does not open the page
    return;
  }
  const url = ownUrl(data.url) || ORIGIN + '/?pn=1';
  event.waitUntil(Promise.all([openStory(url), report('open', data.tag)]));
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  event.waitUntil(report('close', data.tag));
});
