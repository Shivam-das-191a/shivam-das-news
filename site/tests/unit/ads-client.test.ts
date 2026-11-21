import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The browser file is plain text that the build puts into article pages. Here the very same text is run against a fake window.
const adsClient: any = new Function(readFileSync('src/lib/ads-client.js', 'utf8') + '\nreturn adsClient;')();

const cfg = { geoUrl: 'https://geo.test/geo', popunder: 'https://ads.test/pop.js', socialBar: 'https://ads.test/bar.js', timeoutMs: 40, idleMs: 100000, hideAll: false, hidePopunder: false };
const answer = (ads: unknown, ok = true, consent = false) => () => Promise.resolve({ ok, json: () => Promise.resolve({ ads, consent }) });

function win(o: { pageType?: string | null; fetch?: any; session?: Map<string, string> | 'broken' } = {}) {
  const added: any[] = [];
  const calls: any[] = [];
  const listeners: Record<string, any> = {};
  const store = o.session instanceof Map ? o.session : new Map<string, string>();
  const w: any = {
    document: {
      body: { getAttribute: () => (o.pageType === undefined ? 'article' : o.pageType), appendChild: (s: any) => added.push(s) },
      createElement: () => ({ attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }),
    },
    sessionStorage: o.session === 'broken'
      ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
      : { getItem: (k: string) => (store.has(k) ? store.get(k)! : null), setItem: (k: string, v: string) => void store.set(k, v) },
    fetch: o.fetch === undefined ? answer(true) : o.fetch,
    setTimeout: (f: any, ms: number) => setTimeout(f, ms),
    addEventListener: (e: string, f: any) => { listeners[e] = f; },
    removeEventListener: (e: string) => { delete listeners[e]; },
  };
  const spy = w.fetch;
  if (typeof spy === 'function') w.fetch = (...a: any[]) => { calls.push(a); return spy(...a); };
  return { w, added, calls, listeners, store };
}

describe('ad loader in the browser', () => {
  it('adds nothing on a page that is not an article (PLAN 29.1)', async () => {
    for (const type of ['home', 'category', 'tag', 'author', 'page', 'search', '404', null]) {
      const x = win({ pageType: type });
      const run = adsClient(x.w, cfg);
      expect(await run()).toEqual([]);
      expect(x.calls.length).toBe(0);
      expect(x.added.length).toBe(0);
      expect(Object.keys(x.listeners).length).toBe(0);
    }
  });

  it('adds nothing when the post hides all ads', async () => {
    const x = win();
    expect(await adsClient(x.w, { ...cfg, hideAll: true })()).toEqual([]);
    expect(x.calls.length + x.added.length).toBe(0);
  });

  it('waits: nothing happens until the first real event (no idle timer, v0.81.0)', () => {
    const x = win();
    adsClient(x.w, cfg);
    expect(x.calls.length).toBe(0);
    expect(x.added.length).toBe(0);
    expect(Object.keys(x.listeners).sort()).toEqual(['keydown', 'pointerdown', 'scroll', 'touchstart']);
  });

  it('asks the Worker without cookies and without cache, and adds the social bar when ads are on', async () => {
    const x = win();
    const run = adsClient(x.w, cfg);
    expect(await run()).toEqual(['socialBar']);
    expect(x.calls[0][0]).toBe(cfg.geoUrl);
    expect(x.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit', mode: 'cors' });
    expect(x.added[0].src).toBe(cfg.socialBar);
    expect(x.added[0].attrs['data-ad-format']).toBe('socialBar');
  });

  it('adds nothing when the Worker says ads are off (India), says something else, or answers with an error (BUGS A1)', async () => {
    for (const f of [answer(false), answer('true'), answer(undefined), answer(true, false), () => Promise.reject(new Error('cors')), () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }), () => { throw new Error('sync'); }]) {
      const x = win({ fetch: f });
      expect(await adsClient(x.w, cfg)()).toEqual([]);
      expect(x.added.length).toBe(0);
    }
  });

  it('adds nothing when there is no fetch, or the Worker is too slow', async () => {
    const a = win({ fetch: null });
    expect(await adsClient(a.w, cfg)()).toEqual([]);
    const b = win({ fetch: () => new Promise(() => {}) });
    expect(await adsClient(b.w, cfg)()).toEqual([]);
    expect(b.added.length).toBe(0);
  });

  it('runs only once, even when called again', async () => {
    const x = win();
    const run = adsClient(x.w, cfg);
    await Promise.all([run(), run(), run()]);
    expect(x.calls.length).toBe(1);
    expect(x.added.length).toBe(1);
    expect(Object.keys(x.listeners).length).toBe(0);
  });

  it('popunder: not on the 1st article view, once on the 2nd, never again in the same session (BUGS A3)', async () => {
    const session = new Map<string, string>();
    const first = win({ session });
    expect(await adsClient(first.w, cfg)()).toEqual(['socialBar']);
    const second = win({ session });
    expect(await adsClient(second.w, cfg)()).toEqual(['socialBar', 'popunder']);
    expect(second.added.map((s: any) => s.attrs['data-ad-format'])).toEqual(['socialBar', 'popunder']);
    const third = win({ session });
    expect(await adsClient(third.w, cfg)()).toEqual(['socialBar']);
  });

  it('popunder: never when the post hides it, never when storage is blocked', async () => {
    const session = new Map<string, string>([['adViews', '5']]);
    const a = win({ session });
    expect(await adsClient(a.w, { ...cfg, hidePopunder: true })()).toEqual(['socialBar']);
    const b = win({ session: 'broken' });
    expect(await adsClient(b.w, cfg)()).toEqual(['socialBar']);
  });

  it('works with only one format filled in', async () => {
    const session = new Map<string, string>([['adViews', '1']]);
    const x = win({ session });
    expect(await adsClient(x.w, { ...cfg, socialBar: '' })()).toEqual(['popunder']);
  });
});

// v0.22.0: a fake article with paragraphs, so the native banner can be placed and checked.
function articleWin(o: { paragraphs?: number; bottoms?: number[]; innerHeight?: number; noRect?: boolean; noContent?: boolean; contentBottom?: number; session?: Map<string, string> } = {}) {
  const n = o.paragraphs ?? 6;
  const inserted: any[] = [];
  const el = (tag: string): any => ({ tag, attrs: {} as Record<string, string>, children: [] as any[], textContent: '', setAttribute(k: string, v: string) { this.attrs[k] = v; }, appendChild(c: any) { this.children.push(c); } });
  const parent: any = { insertBefore: (box: any, ref: any) => inserted.push({ box, ref }) };
  const paras = Array.from({ length: n }, (_, i) => ({ id: i + 1, parentNode: parent, nextSibling: { after: i + 1 }, ...(o.noRect ? {} : { getBoundingClientRect: () => ({ bottom: (o.bottoms ?? [])[i] ?? 5000 }) }) }));
  const added: any[] = [];
  const x = win({ session: o.session });
  x.w.innerHeight = o.innerHeight ?? 800;
  x.w.document.createElement = (tag: string) => el(tag);
  x.w.document.body.appendChild = (s: any) => added.push(s);
  x.w.document.addEventListener = () => {};
  x.w.document.removeEventListener = () => {};
  x.w.document.querySelectorAll = (sel: string) => (sel === '.content > p' ? paras : []);
  const content: any = { parentNode: parent, nextSibling: { after: 'content' }, ...(o.noRect ? {} : { getBoundingClientRect: () => ({ bottom: o.contentBottom ?? 6000 }) }) };
  x.w.document.querySelector = (sel: string) => (sel === '.content' && !o.noContent ? content : null);
  return { ...x, added, inserted, paras };
}
const nb = { script: 'https://ads.test/native.js', containerId: 'container-1a2b3c', afterParagraph: 3 };
const ncfg = { ...cfg, popunder: '', socialBar: '', nativeBanner: nb };

describe('native banner in the browser (v0.22.0)', () => {
  it('adds one labelled box after paragraph 3 and then its script, when ads are on', async () => {
    const x = articleWin();
    expect(await adsClient(x.w, ncfg)()).toEqual(['nativeBanner']);
    expect(x.inserted).toHaveLength(1);
    expect(x.inserted[0].ref).toEqual({ after: 3 });
    const box = x.inserted[0].box;
    expect(box.attrs['data-ad-slot']).toBe('native');
    expect(box.attrs.style).toContain('min-height:250px');
    expect(box.children[0].textContent).toBe('Advertisement');
    expect(box.children[1].attrs.id).toBe('container-1a2b3c');
    expect(x.added).toHaveLength(1);
    expect(x.added[0].src).toBe(nb.script);
    expect(x.added[0].attrs['data-ad-format']).toBe('nativeBanner');
    expect(x.added[0].attrs['data-cfasync']).toBe('false');
  });

  it('uses the paragraph number from the settings', async () => {
    const x = articleWin({ paragraphs: 9 });
    await adsClient(x.w, { ...ncfg, nativeBanner: { ...nb, afterParagraph: 6 } })();
    expect(x.inserted[0].ref).toEqual({ after: 6 });
  });

  it('adds nothing when the article is too short: never at the very end', async () => {
    for (const paragraphs of [0, 1, 3]) {
      const x = articleWin({ paragraphs });
      expect(await adsClient(x.w, ncfg)()).toEqual([]);
      expect(x.inserted).toHaveLength(0);
      expect(x.added).toHaveLength(0);
    }
    const four = articleWin({ paragraphs: 4 });
    expect(await adsClient(four.w, ncfg)()).toEqual(['nativeBanner']);
  });

  it('adds nothing when the place is already on screen or above it, so nothing moves under the reader (BUGS A2)', async () => {
    const above = articleWin({ bottoms: [100, 200, 300, 400, 500, 600], innerHeight: 800 });
    expect(await adsClient(above.w, ncfg)()).toEqual([]);
    expect(above.inserted).toHaveLength(0);
    expect(above.added).toHaveLength(0);
    const edge = articleWin({ bottoms: [0, 0, 800], innerHeight: 800 });
    expect(await adsClient(edge.w, ncfg)()).toEqual([]);
    const below = articleWin({ bottoms: [0, 0, 801], innerHeight: 800 });
    expect(await adsClient(below.w, ncfg)()).toEqual(['nativeBanner']);
  });

  it('adds nothing when the browser cannot measure the place, or has no querySelectorAll', async () => {
    const a = articleWin({ noRect: true });
    expect(await adsClient(a.w, ncfg)()).toEqual([]);
    const b = articleWin();
    delete b.w.document.querySelectorAll;
    expect(await adsClient(b.w, ncfg)()).toEqual([]);
    expect(b.added).toHaveLength(0);
  });

  it('adds nothing when the Worker says ads are off (India) or fails (BUGS A1)', async () => {
    for (const f of [answer(false), answer(true, false), () => Promise.reject(new Error('cors'))]) {
      const x = articleWin();
      x.w.fetch = f;
      expect(await adsClient(x.w, ncfg)()).toEqual([]);
      expect(x.inserted).toHaveLength(0);
      expect(x.added).toHaveLength(0);
    }
  });

  it('adds nothing when the post hides all ads, or on a page that is not an article', async () => {
    const a = articleWin();
    expect(await adsClient(a.w, { ...ncfg, hideAll: true })()).toEqual([]);
    expect(a.inserted.length + a.added.length).toBe(0);
    const b = articleWin();
    b.w.document.body.getAttribute = () => 'category';
    expect(await adsClient(b.w, ncfg)()).toEqual([]);
    expect(b.inserted.length + b.added.length).toBe(0);
  });

  it('adds nothing for a half-filled native banner, and an old config without one still works', async () => {
    for (const bad of [{ script: nb.script, containerId: '', afterParagraph: 3 }, { script: '', containerId: 'x', afterParagraph: 3 }, null]) {
      const x = articleWin();
      expect(await adsClient(x.w, { ...ncfg, nativeBanner: bad })()).toEqual([]);
      expect(x.inserted).toHaveLength(0);
    }
    const old = win();
    expect(await adsClient(old.w, cfg)()).toEqual(['socialBar']);
  });

  it('works together with the social bar and the popunder, in this order', async () => {
    const session = new Map<string, string>([['adViews', '1']]);
    const x = articleWin({ session });
    expect(await adsClient(x.w, { ...cfg, nativeBanner: nb })()).toEqual(['socialBar', 'nativeBanner', 'popunder']);
    expect(x.added.map((s: any) => s.attrs['data-ad-format'])).toEqual(['socialBar', 'nativeBanner', 'popunder']);
  });
});

describe('smartlink in the browser (v0.55.0): one click on an article picture, one time', () => {
  const link = 'https://ads.test/smart-abc';
  const scfg = { ...cfg, popunder: '', socialBar: '', nativeBanner: null, smartlink: link };
  const img = (inside = true) => ({ tagName: 'IMG', closest: (sel: string) => (inside && sel === '.content, .hero' ? {} : null) });
  function clickable(o: { session?: Map<string, string> } = {}) {
    const x = articleWin(o);
    const handlers: Record<string, any> = {};
    const opened: any[] = [];
    x.w.document.addEventListener = (e: string, f: any) => { handlers[e] = f; };
    x.w.document.removeEventListener = (e: string) => { delete handlers[e]; };
    x.w.open = (...a: any[]) => { opened.push(a); };
    return { ...x, handlers, opened };
  }

  it('adds no text link and no script, only a click listener', async () => {
    const x = clickable();
    expect(await adsClient(x.w, scfg)()).toEqual(['smartlink']);
    expect(x.inserted).toHaveLength(0);
    expect(x.added).toHaveLength(0);
    expect(typeof x.handlers.click).toBe('function');
    expect(x.opened).toHaveLength(0);
  });

  it('opens the address in a new tab on the first click on a picture, and never again', async () => {
    const x = clickable();
    await adsClient(x.w, scfg)();
    const click = x.handlers.click;
    click({ target: img() });
    expect(x.opened).toEqual([[link, '_blank', 'noopener,noreferrer']]);
    expect(x.handlers.click).toBeUndefined();
    click({ target: img() });
    expect(x.opened).toHaveLength(1);
    expect(x.store.get('adSmartDone')).toBe('1');
  });

  it('ignores clicks that are not on a picture inside the article', async () => {
    const x = clickable();
    await adsClient(x.w, scfg)();
    x.handlers.click({ target: { tagName: 'A' } });
    x.handlers.click({ target: img(false) });
    x.handlers.click({});
    x.handlers.click(undefined);
    expect(x.opened).toHaveLength(0);
  });

  it('does nothing when it already opened once in this session', async () => {
    const x = clickable({ session: new Map([['adSmartDone', '1']]) });
    expect(await adsClient(x.w, scfg)()).toEqual([]);
    expect(x.handlers.click).toBeUndefined();
  });

  it('adds nothing when ads are off (India), the check fails, the post hides ads, or it is not an article', async () => {
    for (const f of [answer(false), answer(true, false), () => Promise.reject(new Error('cors'))]) {
      const x = clickable();
      x.w.fetch = f;
      expect(await adsClient(x.w, scfg)()).toEqual([]);
      expect(x.handlers.click).toBeUndefined();
    }
    const a = clickable();
    expect(await adsClient(a.w, { ...scfg, hideAll: true })()).toEqual([]);
    const b = clickable();
    b.w.document.body.getAttribute = () => 'page';
    expect(await adsClient(b.w, scfg)()).toEqual([]);
    expect(a.handlers.click).toBeUndefined();
    expect(b.handlers.click).toBeUndefined();
  });

  it('adds nothing with an empty address or a page that cannot listen, and an old config without one still works', async () => {
    const x = clickable();
    expect(await adsClient(x.w, { ...scfg, smartlink: '' })()).toEqual([]);
    const y = clickable();
    delete y.w.document.addEventListener;
    expect(await adsClient(y.w, scfg)()).toEqual([]);
    const old = win();
    expect(await adsClient(old.w, cfg)()).toEqual(['socialBar']);
  });

  it('works with the other formats, in this order: social bar, native banner, smartlink, popunder', async () => {
    const session = new Map<string, string>([['adViews', '1']]);
    const x = clickable({ session });
    expect(await adsClient(x.w, { ...cfg, nativeBanner: nb, smartlink: link })()).toEqual(['socialBar', 'nativeBanner', 'smartlink', 'popunder']);
    expect(x.inserted).toHaveLength(1);
  });
});

describe('AdSense unit in the browser (v0.24.0)', () => {
  const as = { client: 'ca-pub-1234567890123456', slot: '1234567890', afterParagraph: 5 };
  const acfg = { ...cfg, popunder: '', socialBar: '', nativeBanner: null, smartlink: '', adsense: as };

  it('adds one labelled box with the AdSense tag after paragraph 5, then Google\'s script, then asks for the ad', async () => {
    const x = articleWin({ paragraphs: 8 });
    expect(await adsClient(x.w, acfg)()).toEqual(['adsense']);
    expect(x.inserted).toHaveLength(1);
    expect(x.inserted[0].ref).toEqual({ after: 5 });
    const box = x.inserted[0].box;
    expect(box.attrs['data-ad-slot']).toBe('adsense');
    expect(box.attrs.style).toContain('min-height:280px');
    expect(box.children[0].textContent).toBe('Advertisement');
    const ins = box.children[1];
    expect(ins.tag).toBe('ins');
    expect(ins.attrs.class).toBe('adsbygoogle');
    expect(ins.attrs['data-ad-client']).toBe(as.client);
    expect(ins.attrs['data-ad-slot']).toBe(as.slot);
    expect(x.added).toHaveLength(1);
    expect(x.added[0].src).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
    expect(x.added[0].attrs['data-ad-format']).toBe('adsense');
    expect(x.added[0].attrs.crossorigin).toBe('anonymous');
    expect(x.w.adsbygoogle).toHaveLength(1);
  });

  it('uses the paragraph number from the settings', async () => {
    const x = articleWin({ paragraphs: 9 });
    await adsClient(x.w, { ...acfg, adsense: { ...as, afterParagraph: 7 } })();
    expect(x.inserted[0].ref).toEqual({ after: 7 });
  });

  it('adds nothing when the article is too short: never at the very end', async () => {
    const x = articleWin({ paragraphs: 5 });
    expect(await adsClient(x.w, acfg)()).toEqual([]);
    expect(x.inserted).toHaveLength(0);
    expect(x.added).toHaveLength(0);
  });

  it('adds nothing when the place is already on screen, or the page cannot be measured (BUGS A2)', async () => {
    const seen = articleWin({ paragraphs: 8, bottoms: [0, 0, 0, 0, 500], innerHeight: 800 });
    expect(await adsClient(seen.w, acfg)()).toEqual([]);
    const edge = articleWin({ paragraphs: 8, bottoms: [0, 0, 0, 0, 800], innerHeight: 800 });
    expect(await adsClient(edge.w, acfg)()).toEqual([]);
    const blind = articleWin({ paragraphs: 8, noRect: true });
    expect(await adsClient(blind.w, acfg)()).toEqual([]);
    const plain = articleWin({ paragraphs: 8 });
    delete plain.w.document.querySelectorAll;
    expect(await adsClient(plain.w, acfg)()).toEqual([]);
    expect(seen.added.length + edge.added.length + blind.added.length + plain.added.length).toBe(0);
  });

  it('adds nothing when ads are off (India), the check fails, the post hides ads, or it is not an article', async () => {
    for (const f of [answer(false), answer(true, false), () => Promise.reject(new Error('cors'))]) {
      const x = articleWin({ paragraphs: 8 });
      x.w.fetch = f;
      expect(await adsClient(x.w, acfg)()).toEqual([]);
      expect(x.inserted).toHaveLength(0);
      expect(x.w.adsbygoogle).toBeUndefined();
    }
    const a = articleWin({ paragraphs: 8 });
    expect(await adsClient(a.w, { ...acfg, hideAll: true })()).toEqual([]);
    const b = articleWin({ paragraphs: 8 });
    b.w.document.body.getAttribute = () => 'page';
    expect(await adsClient(b.w, acfg)()).toEqual([]);
    expect(a.inserted.length + b.inserted.length + a.added.length + b.added.length).toBe(0);
  });

  it('adds nothing for an empty or half-filled unit, and an old config without one still works', async () => {
    for (const bad of [null, undefined, { client: '', slot: '1234567890', afterParagraph: 5 }, { client: as.client, slot: '', afterParagraph: 5 }]) {
      const x = articleWin({ paragraphs: 8 });
      expect(await adsClient(x.w, { ...acfg, adsense: bad })()).toEqual([]);
      expect(x.inserted).toHaveLength(0);
    }
    const old = win();
    expect(await adsClient(old.w, cfg)()).toEqual(['socialBar']);
  });

  it('a failing ad queue does not stop the other formats', async () => {
    const x = articleWin({ paragraphs: 8 });
    Object.defineProperty(x.w, 'adsbygoogle', { get() { throw new Error('blocked'); }, configurable: true });
    expect(await adsClient(x.w, { ...acfg, smartlink: 'https://ads.test/smart-abc' })()).toEqual(['adsense', 'smartlink']);
  });

  it('works with the other formats, in this order: social bar, native banner, AdSense, smartlink, popunder', async () => {
    const session = new Map<string, string>([['adViews', '1']]);
    const x = articleWin({ paragraphs: 9, session });
    const all = { ...cfg, nativeBanner: nb, adsense: as, smartlink: 'https://ads.test/smart-abc' };
    expect(await adsClient(x.w, all)()).toEqual(['socialBar', 'nativeBanner', 'adsense', 'smartlink', 'popunder']);
    expect(x.added.map((s: any) => s.attrs['data-ad-format'])).toEqual(['socialBar', 'nativeBanner', 'adsense', 'popunder']);
    expect(x.inserted).toHaveLength(2);
  });
});

describe('ad code can enter article pages only (PLAN 29.1, BUGS H1, H2)', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk('src').filter((f) => /\.(astro|ts|js)$/.test(f)).map((f) => f.replace(/\\/g, '/'));
  // Only real import lines count, not words in comments.
  const importers = (needle: RegExp) => files.filter((f) => readFileSync(f, 'utf8').split('\n').some((l) => /^\s*import\b/.test(l) && needle.test(l))).sort();

  it('only the article template imports the AdLoader component', () => {
    expect(importers(/AdLoader\.astro/)).toEqual(['src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro']);
  });

  it('only the AdLoader component imports the browser file and the loader settings', () => {
    expect(importers(/ads-client/)).toEqual(['src/components/AdLoader.astro']);
    expect(importers(/ad-loader\.json/)).toEqual(['src/components/AdLoader.astro']);
    expect(importers(/ad-loader'/)).toEqual(['src/components/AdLoader.astro']);
  });

  it('the shared layout, header and footer never mention ad scripts', () => {
    for (const f of ['src/layouts/Base.astro', 'src/components/Header.astro', 'src/components/Footer.astro']) expect(readFileSync(f, 'utf8')).not.toMatch(/adsterra|adsClient|data-ad-loader|googlesyndication|AdLoader/i);
  });
});
