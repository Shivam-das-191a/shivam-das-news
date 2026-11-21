// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { initNotificationsPage, topicHref, readTopic, applyTopic, parseKeywordText, MESSAGES, MAX_KEYWORDS, MAX_KEYWORD_LENGTH, MAX_KEYWORD_WORDS, LEVEL_CHOICES } from '../../src/lib/notifications-page.js';
import { MAX_KEYWORD_LENGTH as WORKER_LEN, MAX_KEYWORD_WORDS as WORKER_WORDS, cleanKeyword } from '../../../workers/push/lib.js';
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p><div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech"><input type="checkbox" name="category" value="sports">
    <input type="checkbox" name="breakingAll" checked>
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option></select>
    <textarea name="keywords"></textarea><textarea name="muted"></textarea>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom() { document.body.innerHTML = HTML; return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
const SAVED = { categories: ['sports'], level: 'important', dailyLimit: 2, breakingAll: false, keywords: ['election'], muted: ['cricket'] };
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async (a: any) => ({ ok: true, created: true, prefs: a.prefs })),
    getPrefs: vi.fn(async () => o.getPrefs ?? { ok: true, prefs: SAVED }),
    savePrefs: vi.fn(async (a: any) => ({ ok: true, prefs: a.prefs })),
    disable: vi.fn(async () => ({ ok: true })),
  };
}
const win = (search: string, extra: any = {}) => ({ navigator: { userAgent: 'Chrome' }, location: { search }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id), ...extra }) as any;

describe('topicHref (the link of the article bell button)', () => {
  it('carries the category and the focus keyword', () => {
    expect(topicHref('tech', 'iPhone 17')).toBe('/notifications/?cat=tech&kw=iPhone+17');
  });
  it('leaves out a missing or unusable part, and gives the plain page when nothing is left', () => {
    expect(topicHref('tech', '')).toBe('/notifications/?cat=tech');
    expect(topicHref('tech', undefined)).toBe('/notifications/?cat=tech');
    expect(topicHref('', 'election')).toBe('/notifications/?kw=election');
    expect(topicHref('Tech News', 'a'.repeat(41))).toBe('/notifications/');
    expect(topicHref(undefined, undefined)).toBe('/notifications/');
  });
  it('drops a keyword the Worker would refuse (other characters, too long, too many words)', () => {
    expect(topicHref('tech', 'चुनाव')).toBe('/notifications/?cat=tech');
    expect(topicHref('tech', 'a b c d e')).toBe('/notifications/?cat=tech');
    expect(topicHref('tech', 'x<y')).toBe('/notifications/?cat=tech');
  });
  it('tidies spaces in the keyword and encodes the rest safely', () => {
    expect(topicHref('tech', '  Prime   Minister  ')).toBe('/notifications/?cat=tech&kw=Prime+Minister');
    expect(topicHref('tech', "Modi's plan")).toContain('kw=Modi%27s+plan');
  });
  it('uses the same limits as the Worker', () => {
    expect(MAX_KEYWORD_LENGTH).toBe(WORKER_LEN);
    expect(MAX_KEYWORD_WORDS).toBe(WORKER_WORDS);
    for (const k of ['iPhone 17', 'election results', "Modi's plan", 'Covid-19']) {
      expect(topicHref('tech', k)).toContain('kw=');
      expect(cleanKeyword(k).ok).toBe(true);
    }
  });
});

describe('readTopic', () => {
  it('reads the category and the keyword', () => {
    expect(readTopic('?cat=tech&kw=iPhone%2017')).toEqual({ category: 'tech', keyword: 'iPhone 17' });
    expect(readTopic('cat=tech')).toEqual({ category: 'tech', keyword: '' });
  });
  it('gives null when there is nothing usable', () => {
    for (const s of ['', '?', '?x=1', '?cat=', '?cat=Tech', '?cat=a/b', '?cat=<b>', `?kw=${'a'.repeat(41)}`, undefined, null]) expect(readTopic(s as any)).toBeNull();
  });
  it('ignores a bad part and keeps the good one', () => {
    expect(readTopic('?cat=../x&kw=election')).toEqual({ category: '', keyword: 'election' });
    expect(readTopic('?cat=tech&kw=%3Cscript%3E')).toEqual({ category: 'tech', keyword: '' });
  });
  it('round trips with topicHref', () => {
    const href = topicHref('world-news', 'Gaza ceasefire');
    expect(readTopic(href.split('?')[1])).toEqual({ category: 'world-news', keyword: 'Gaza ceasefire' });
  });
});

describe('applyTopic', () => {
  it('ticks the category and adds the keyword', () => {
    const r = dom();
    expect(applyTopic(r, { category: 'tech', keyword: 'iPhone 17' })).toEqual({ category: true, keyword: true });
    expect($(r, 'input[value="tech"]').checked).toBe(true);
    expect($(r, 'input[value="sports"]').checked).toBe(false);
    expect($(r, 'textarea[name="keywords"]').value).toBe('iPhone 17');
  });
  it('ignores a category the site does not have', () => {
    const r = dom();
    expect(applyTopic(r, { category: 'nothing', keyword: '' })).toEqual({ category: false, keyword: false });
    expect(r.querySelectorAll('input[name="category"]:checked').length).toBe(0);
  });
  it('keeps the keywords already there and adds one after them', () => {
    const r = dom();
    $(r, 'textarea[name="keywords"]').value = 'election\nbudget';
    expect(applyTopic(r, { category: '', keyword: 'Gaza' }).keyword).toBe(true);
    expect(parseKeywordText($(r, 'textarea[name="keywords"]').value)).toEqual(['election', 'budget', 'Gaza']);
  });
  it('does not add a keyword twice, in any letter case', () => {
    const r = dom();
    $(r, 'textarea[name="keywords"]').value = 'Election';
    expect(applyTopic(r, { category: '', keyword: 'election' }).keyword).toBe(false);
    expect($(r, 'textarea[name="keywords"]').value).toBe('Election');
  });
  it('does not follow a word the reader muted', () => {
    const r = dom();
    $(r, 'textarea[name="muted"]').value = 'cricket';
    expect(applyTopic(r, { category: '', keyword: 'Cricket' }).keyword).toBe(false);
    expect($(r, 'textarea[name="keywords"]').value).toBe('');
  });
  it('does not go over the keyword limit', () => {
    const r = dom();
    $(r, 'textarea[name="keywords"]').value = Array.from({ length: MAX_KEYWORDS }, (_, i) => `word${i}x`).join('\n');
    expect(applyTopic(r, { category: '', keyword: 'extra' }).keyword).toBe(false);
    expect(parseKeywordText($(r, 'textarea[name="keywords"]').value).length).toBe(MAX_KEYWORDS);
  });
  it('is safe on a page without the keyword box and on a bad topic', () => {
    document.body.innerHTML = '<section data-notify><input type="checkbox" name="category" value="tech"></section>';
    const r = document.querySelector('[data-notify]') as HTMLElement;
    expect(applyTopic(r, { category: 'tech', keyword: 'election' })).toEqual({ category: true, keyword: false });
    expect(applyTopic(r, null as any)).toEqual({ category: false, keyword: false });
  });
});

describe('the page with a topic in the address', () => {
  it('a new reader: the topic is filled in, nothing is turned on or sent', async () => {
    const r = dom(); const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win('?cat=tech&kw=iPhone%2017') });
    expect($(r, 'input[value="tech"]').checked).toBe(true);
    expect($(r, 'textarea[name="keywords"]').value).toBe('iPhone 17');
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.topicNew);
    expect(c.enable).not.toHaveBeenCalled(); expect(c.savePrefs).not.toHaveBeenCalled(); expect(c.disable).not.toHaveBeenCalled();
    expect($(r, '[data-n-on]').hidden).toBe(false);
  });
  it('a new reader presses the button: the topic is sent with the turn-on call', async () => {
    const r = dom(); const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win('?cat=tech&kw=election') });
    $(r, '[data-n-on]').click(); await tick();
    expect(c.enable).toHaveBeenCalledTimes(1);
    const prefs = c.enable.mock.calls[0][0].prefs;
    expect(prefs.categories).toEqual(['tech']);
    expect(prefs.keywords).toEqual(['election']);
  });
  it('a reader who is on: the saved choices stay, the topic is added, nothing is saved until Save', async () => {
    const r = dom(); const c = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r, cfg, client: c, win: win('?cat=tech&kw=iPhone%2017') });
    expect($(r, 'input[value="sports"]').checked).toBe(true);
    expect($(r, 'input[value="tech"]').checked).toBe(true);
    expect(parseKeywordText($(r, 'textarea[name="keywords"]').value)).toEqual(['election', 'iPhone 17']);
    expect($(r, 'textarea[name="muted"]').value).toBe('cricket');
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.topicOn);
    expect(c.savePrefs).not.toHaveBeenCalled();
    $(r, '[data-n-save]').click(); await tick();
    expect(c.savePrefs).toHaveBeenCalledTimes(1);
    expect(c.savePrefs.mock.calls[0][0].prefs.categories.sort()).toEqual(['sports', 'tech']);
  });
  it('a topic the reader already follows changes nothing and keeps the normal message', async () => {
    const r = dom(); const c = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r, cfg, client: c, win: win('?cat=sports&kw=Election') });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.on);
    expect($(r, 'textarea[name="keywords"]').value).toBe('election');
  });
  it('no topic, a bad topic or no location: the form is as before', async () => {
    for (const w of [win(''), win('?cat=nothing'), win('?cat=<x>&kw=%3Cb%3E'), win('', { location: undefined })]) {
      const r = dom();
      await initNotificationsPage({ root: r, cfg, client: client(), win: w });
      expect(r.querySelectorAll('input[name="category"]:checked').length).toBe(0);
      expect($(r, 'textarea[name="keywords"]').value).toBe('');
      expect($(r, '[data-n-msg]').textContent).not.toBe(MESSAGES.topicNew);
    }
  });
  it('blocked, unsupported and off: no topic is filled in', async () => {
    for (const s of [stat({ permission: 'denied' }), stat({ supported: false }), stat({ enabled: false })]) {
      const r = dom();
      await initNotificationsPage({ root: r, cfg, client: client({ status: s }), win: win('?cat=tech&kw=election') });
      expect($(r, 'input[value="tech"]').checked).toBe(false);
      expect($(r, 'textarea[name="keywords"]').value).toBe('');
    }
  });
  it('a failed load of the saved choices keeps its error message and fills nothing', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }), getPrefs: { ok: false, error: 'Busy.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win('?cat=tech&kw=election') });
    expect($(r, '[data-n-msg]').textContent).toBe('Busy.');
    expect($(r, 'input[value="tech"]').checked).toBe(false);
  });
  it('the new sentences have no emoji', () => {
    expect(findEmoji(MESSAGES.topicNew + MESSAGES.topicOn)).toEqual([]);
  });
});

describe('the bell button in the article', () => {
  const comp = readFileSync('src/components/AlertsLink.astro', 'utf8');
  const article = readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8');
  const css = readFileSync('src/styles/global.css', 'utf8');
  it('renders only while push is switched on, as one plain link with the SVG bell', () => {
    expect(comp).toContain('pushConfig(cfg).enabled');
    expect(comp).toMatch(/\{on && \(/);
    expect(comp).toContain('<Icon name="bell"');
    expect(comp).toContain('Get alerts for this topic');
    expect(comp).toContain('topicHref(category, focus)');
    expect(comp).not.toMatch(/<script|AdLoader|adsClient/);
  });
  it('is placed inside the article with the category and the focus keyword', () => {
    expect(article).toContain("import AlertsLink from");
    expect(article).toMatch(/<AlertsLink category=\{d\.category\} focus=\{d\.focusKeyword\} \/>/);
    const a = article.indexOf('<article'), b = article.indexOf('</article>'), at = article.indexOf('<AlertsLink');
    expect(at).toBeGreaterThan(a); expect(at).toBeLessThan(b);
  });
  it('is left out of search and of print', () => {
    expect(comp).toContain('data-pagefind-ignore');
    expect(css).toMatch(/@media print\{\.alerts-link\{display:none\}\}/);
  });
  it('the config ships empty, so nothing shows', () => {
    expect(JSON.parse(readFileSync('tests/fixtures/shipped/config/push.json', 'utf8'))).toEqual({ endpoint: '', vapidPublicKey: '' });
  });
});
