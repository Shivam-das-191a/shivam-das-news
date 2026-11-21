import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// v0.25.0: the consent gate of the ad loader. The very same browser text that goes into article pages runs inside a real (jsdom) page.
const adsClient: any = new Function(readFileSync('src/lib/ads-client.js', 'utf8') + '\nreturn adsClient;')();
const cfg = { geoUrl: 'https://geo.test/geo', popunder: '', socialBar: 'https://ads.test/bar.js', timeoutMs: 200, idleMs: 100000, hideAll: false, hidePopunder: false };

function page(o: { answer?: any; saved?: string; brokenStorage?: boolean; savedDaysAgo?: number; consentDays?: number; rawSaved?: string; fail?: boolean; adsense?: boolean; below?: boolean; smartlink?: string; consentText?: any; words?: Record<string, any> } = {}) {
  const dom = new JSDOM('<!doctype html><body data-page-type="article"><main><div class="content"><p>One</p></div></main></body>', { url: 'https://news.test/a/', pretendToBeVisual: true });
  const w: any = dom.window;
  const calls: any[] = [];
  w.fetch = (...a: any[]) => { calls.push(a); return o.fail ? Promise.reject(new Error('cors')) : Promise.resolve({ ok: true, json: () => Promise.resolve(o.answer) }); };
  if (o.brokenStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
  else if (o.rawSaved) w.localStorage.setItem('adConsent', o.rawSaved);
  else if (o.saved) w.localStorage.setItem('adConsent', o.saved + '|' + (Date.now() - (o.savedDaysAgo ?? 0) * 86400000));
  if (o.below) w.HTMLElement.prototype.getBoundingClientRect = () => ({ bottom: 5000, top: 4000, left: 0, right: 100, width: 100, height: 100 });
  const counter = { reloads: 0 };
  // The page object is wrapped so that a reload can be counted (jsdom cannot reload).
  const proxy = new Proxy(w, { get(target: any, key: string) { if (key === 'location') return { reload: () => { counter.reloads++; } }; const v = target[key]; return typeof v === 'function' ? v.bind(target) : v; } });
  const run = adsClient(proxy, { ...cfg, ...(o.smartlink ? { smartlink: o.smartlink } : {}), ...(o.consentDays !== undefined ? { consentDays: o.consentDays } : {}), ...(o.consentText !== undefined ? { consentText: o.consentText } : {}), ...(o.words ?? {}), ...(o.adsense ? { adsense: { client: 'ca-pub-1234567890', slot: '1234567890', afterParagraph: 1 } } : {}) });
  const scripts = () => Array.from(w.document.querySelectorAll('script[data-ad-format]')).map((s: any) => s.getAttribute('data-ad-format'));
  const bar = () => w.document.querySelector('[data-ad-consent]');
  const click = (label: string) => (Array.from(w.document.querySelectorAll('[data-ad-consent] button')).find((b: any) => b.textContent === label) as any).click();
  const link = () => w.document.querySelector('[data-ad-choices] button');
  return { w, run, scripts, bar, click, calls, link, counter };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

describe('consent gate in the browser (v0.25.0)', () => {
  it('shows no bar and adds the ad at once where no consent is needed', async () => {
    const x = page({ answer: { ads: true, consent: false } });
    expect(await x.run()).toEqual(['socialBar']);
    expect(x.bar()).toBeNull();
    expect(x.scripts()).toEqual(['socialBar']);
  });

  it('asks first where consent is needed, and adds no ad before the click', async () => {
    const x = page({ answer: { ads: true, consent: true } });
    const done = x.run();
    await tick();
    expect(x.bar()).not.toBeNull();
    expect(x.bar().getAttribute('role')).toBe('dialog');
    expect(x.scripts()).toEqual([]);
    expect(x.bar().textContent).toContain('Accept');
    expect(x.bar().textContent).toContain('No thanks');
    x.click('Accept');
    expect(await done).toEqual(['socialBar']);
    expect(x.bar()).toBeNull();
    expect(x.scripts()).toEqual(['socialBar']);
    expect(x.w.localStorage.getItem('adConsent')).toMatch(/^yes\|\d{13}$/);
  });

  it('adds nothing after "No thanks", saves the no, and never asks again', async () => {
    const x = page({ answer: { ads: true, consent: true } });
    const done = x.run();
    await tick();
    x.click('No thanks');
    expect(await done).toEqual([]);
    expect(x.scripts()).toEqual([]);
    expect(x.bar()).toBeNull();
    expect(x.w.localStorage.getItem('adConsent')).toMatch(/^no\|\d{13}$/);
    const y = page({ answer: { ads: true, consent: true }, saved: 'no' });
    expect(await y.run()).toEqual([]);
    expect(y.bar()).toBeNull();
  });

  it('uses a saved yes without asking again', async () => {
    const x = page({ answer: { ads: true, consent: true }, saved: 'yes' });
    expect(await x.run()).toEqual(['socialBar']);
    expect(x.bar()).toBeNull();
  });

  it('treats a missing consent field as "consent needed" (an old Worker never skips the question)', async () => {
    const x = page({ answer: { ads: true } });
    const done = x.run();
    await tick();
    expect(x.bar()).not.toBeNull();
    expect(x.scripts()).toEqual([]);
    x.click('No thanks');
    expect(await done).toEqual([]);
  });

  it('never shows the bar when ads are off, the Worker fails or the answer is not exact', async () => {
    for (const o of [{ answer: { ads: false, consent: true } }, { answer: { ads: 'true', consent: true } }, { answer: undefined }, { fail: true }]) {
      const x = page(o as any);
      expect(await x.run()).toEqual([]);
      expect(x.bar()).toBeNull();
      expect(x.scripts()).toEqual([]);
    }
  });

  it('asks again each time when the storage is blocked, and still adds nothing before the click', async () => {
    const x = page({ answer: { ads: true, consent: true }, brokenStorage: true });
    const done = x.run();
    await tick();
    expect(x.bar()).not.toBeNull();
    expect(x.scripts()).toEqual([]);
    x.click('Accept');
    expect(await done).toEqual(['socialBar']);
  });

  it('keeps AdSense away from readers who had to consent, but not from the others', () => {
    const src = readFileSync('src/lib/ads-client.js', 'utf8');
    expect(src).toContain('if (!limited && putAdsense(cfg.adsense))');
    expect(src).toContain('place(true)');
    expect(src).toContain('place(false)');
  });

  it('keeps the bar fixed to the bottom so it never pushes the text, with buttons of 44 px', async () => {
    const x = page({ answer: { ads: true, consent: true } });
    x.run();
    await tick();
    expect(x.bar().getAttribute('style')).toContain('position:fixed');
    const buttons = Array.from(x.w.document.querySelectorAll('[data-ad-consent] button')) as any[];
    expect(buttons.length).toBe(2);
    for (const b of buttons) expect(b.getAttribute('style')).toContain('min-height:44px');
  });

  it('does nothing on a page that is not an article', async () => {
    const dom = new JSDOM('<!doctype html><body data-page-type="home"></body>', { url: 'https://news.test/' });
    const w: any = dom.window;
    w.fetch = () => { throw new Error('must not be called'); };
    expect(await adsClient(w, cfg)()).toEqual([]);
    expect(w.document.querySelector('[data-ad-consent]')).toBeNull();
  });

  describe('Ad choices button (v0.26.0)', () => {
    it('is added for a reader who had to consent, after Accept and after No thanks', async () => {
      for (const label of ['Accept', 'No thanks']) {
        const x = page({ answer: { ads: true, consent: true }, below: true });
        const done = x.run();
        await tick();
        expect(x.link()).toBeNull();
        x.click(label);
        await done;
        expect(x.link()).not.toBeNull();
        expect(x.link().textContent).toBe('Ad choices');
        expect(x.link().getAttribute('style')).toContain('min-height:44px');
      }
    });

    it('is added for a reader with a saved yes or a saved no', async () => {
      for (const saved of ['yes', 'no']) {
        const x = page({ answer: { ads: true, consent: true }, saved, below: true });
        await x.run();
        expect(x.link()).not.toBeNull();
        expect(x.bar()).toBeNull();
      }
    });

    it('is not added where no consent is needed, where ads are off, or on a failed Worker', async () => {
      for (const o of [{ answer: { ads: true, consent: false } }, { answer: { ads: false, consent: true } }, { fail: true }]) {
        const x = page({ ...(o as any), below: true });
        await x.run();
        expect(x.link()).toBeNull();
      }
    });

    it('is not added when the end of the text is already on screen or above it (nothing may move under the reader)', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'yes' });
      await x.run();
      expect(x.link()).toBeNull();
    });

    it('stands right after the article text (the smartlink has no line any more), and only once', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'yes', below: true, smartlink: 'https://ads.test/link' });
      expect(await x.run()).toEqual(['socialBar', 'smartlink']);
      const kids = Array.from(x.w.document.querySelector('main').children).map((e: any) => e.getAttribute('data-ad-slot') || (e.hasAttribute('data-ad-choices') ? 'choices' : e.className));
      expect(kids).toEqual(['content', 'choices']);
      expect(x.w.document.querySelectorAll('[data-ad-choices]').length).toBe(1);
    });

    it('opens the bar again; the same answer reloads nothing', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'yes', below: true });
      await x.run();
      x.link().click();
      expect(x.bar()).not.toBeNull();
      x.link().click();
      expect(x.w.document.querySelectorAll('[data-ad-consent]').length).toBe(1);
      x.click('Accept');
      await tick();
      expect(x.counter.reloads).toBe(0);
      expect(x.w.localStorage.getItem('adConsent')).toMatch(/^yes\|\d{13}$/);
      expect(x.bar()).toBeNull();
    });

    it('reloads the page when a yes becomes a no, so the added ads disappear', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'yes', below: true });
      await x.run();
      x.link().click();
      x.click('No thanks');
      await tick();
      expect(x.counter.reloads).toBe(1);
      expect(x.w.localStorage.getItem('adConsent')).toMatch(/^no\|\d{13}$/);
    });

    it('reloads the page when a no becomes a yes, so the ads are added', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'no', below: true });
      expect(await x.run()).toEqual([]);
      x.link().click();
      x.click('Accept');
      await tick();
      expect(x.counter.reloads).toBe(1);
      expect(x.w.localStorage.getItem('adConsent')).toMatch(/^yes\|\d{13}$/);
    });
  });

  describe('the saved answer expires (v0.27.0)', () => {
    it('is still valid after 179 days: a saved yes adds the ad, a saved no adds nothing, no bar', async () => {
      const a = page({ answer: { ads: true, consent: true }, saved: 'yes', savedDaysAgo: 179 });
      expect(await a.run()).toEqual(['socialBar']);
      expect(a.bar()).toBeNull();
      const b = page({ answer: { ads: true, consent: true }, saved: 'no', savedDaysAgo: 179 });
      expect(await b.run()).toEqual([]);
      expect(b.bar()).toBeNull();
    });

    it('asks again after 181 days, for a yes and for a no, and adds nothing before the click', async () => {
      for (const saved of ['yes', 'no']) {
        const x = page({ answer: { ads: true, consent: true }, saved, savedDaysAgo: 181 });
        const done = x.run();
        await tick();
        expect(x.bar()).not.toBeNull();
        expect(x.scripts()).toEqual([]);
        x.click('No thanks');
        expect(await done).toEqual([]);
        expect(x.w.localStorage.getItem('adConsent')).toMatch(/^no\|\d{13}$/);
      }
    });

    it('asks again for an old value without a time, a time in the future, and broken texts', async () => {
      const future = 'yes|' + (Date.now() + 5 * 86400000);
      for (const rawSaved of ['yes', 'no', future, 'yes|abc', 'maybe|1731585600000', 'yes|1731585600000|1', '']) {
        const x = page({ answer: { ads: true, consent: true }, rawSaved });
        const done = x.run();
        await tick();
        expect(x.bar()).not.toBeNull();
        expect(x.scripts()).toEqual([]);
        x.click('No thanks');
        await done;
      }
    });

    it('a new answer is saved with the time of now, so the 180 days start again', async () => {
      const x = page({ answer: { ads: true, consent: true }, saved: 'yes', savedDaysAgo: 200 });
      const done = x.run();
      await tick();
      const before = Date.now();
      x.click('Accept');
      await done;
      const [word, time] = String(x.w.localStorage.getItem('adConsent')).split('|');
      expect(word).toBe('yes');
      expect(Number(time)).toBeGreaterThanOrEqual(before - 5);
      expect(Number(time)).toBeLessThanOrEqual(Date.now());
    });

    it('uses `consentDays` from the settings when it is a positive number, and 180 otherwise', async () => {
      const short = page({ answer: { ads: true, consent: true }, saved: 'yes', savedDaysAgo: 40, consentDays: 30 });
      const done = short.run();
      await tick();
      expect(short.bar()).not.toBeNull();
      short.click('No thanks');
      await done;
      const long = page({ answer: { ads: true, consent: true }, saved: 'yes', savedDaysAgo: 40, consentDays: 365 });
      expect(await long.run()).toEqual(['socialBar']);
      for (const bad of [0, -5, Number.NaN]) {
        const x = page({ answer: { ads: true, consent: true }, saved: 'yes', savedDaysAgo: 100, consentDays: bad });
        expect(await x.run()).toEqual(['socialBar']);
      }
    });
  });
});

describe('consent bar text (v0.30.0)', () => {
  const DEFAULT_START = 'We would like to show ads from our partners';
  const OWN = 'We show ads from partners next to this article. Please choose.';
  it('shows the built-in sentence when no text is set, or the text is empty or odd', async () => {
    for (const t of [undefined, '', '   ', 5, null, 'x'.repeat(301)]) {
      const x = page({ answer: { ads: true, consent: true }, consentText: t });
      const done = x.run();
      await tick();
      expect(x.bar().querySelector('p').textContent.startsWith(DEFAULT_START)).toBe(true);
      x.click('No thanks');
      await done;
    }
  });
  it('shows the owner\'s own text, as plain text and not as HTML', async () => {
    const x = page({ answer: { ads: true, consent: true }, consentText: ` ${OWN} ` });
    const done = x.run();
    await tick();
    expect(x.bar().querySelector('p').textContent).toBe(OWN);
    x.click('Accept');
    expect(await done).toEqual(['socialBar']);
    const y = page({ answer: { ads: true, consent: true }, consentText: 'Ads <b>next</b> to this article, click a button' });
    const d2 = y.run();
    await tick();
    expect(y.bar().querySelector('p').children.length).toBe(0);
    y.click('No thanks');
    await d2;
  });
});

describe('consent button words (v0.31.0)', () => {
  const buttons = (x: any) => Array.from(x.w.document.querySelectorAll('[data-ad-consent] button')).map((b: any) => b.textContent);
  it('shows the built-in words when none are set, or they are empty or odd', async () => {
    for (const words of [undefined, { consentAccept: '', consentDecline: ' ' }, { consentAccept: 5, consentDecline: 'x', consentChoices: 'y'.repeat(25) }]) {
      const x = page({ answer: { ads: true, consent: true }, below: true, words });
      const done = x.run();
      await tick();
      expect(buttons(x)).toEqual(['Accept', 'No thanks']);
      x.click('Accept');
      await done;
      expect(x.link().textContent).toBe('Ad choices');
    }
  });
  it('shows the owner\'s own words on the bar and on the Ad choices button, as plain text', async () => {
    const x = page({ answer: { ads: true, consent: true }, below: true, words: { consentAccept: ' Agree ', consentDecline: 'Refuse', consentChoices: 'Ad settings' } });
    const done = x.run();
    await tick();
    expect(buttons(x)).toEqual(['Agree', 'Refuse']);
    x.click('Agree');
    expect(await done).toEqual(['socialBar']);
    expect(x.link().textContent).toBe('Ad settings');
    const y = page({ answer: { ads: true, consent: true }, words: { consentAccept: 'Go <b>now</b>' } });
    const d2 = y.run();
    await tick();
    expect(buttons(y)[0]).toBe('Go <b>now</b>');
    expect(y.bar().querySelectorAll('button b').length).toBe(0);
    y.click('No thanks');
    await d2;
  });
});
