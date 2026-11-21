// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { initNotificationsPage, readForm, fillForm, hasChoice, parseKeywordText, keywordText, keywordProblem, MESSAGES, MAX_KEYWORDS, LEVEL_CHOICES, LIMIT_CHOICES } from '../../src/lib/notifications-page.js';

// v0.58.0 (push part 5c-1): the two keyword boxes of /notifications/.
const HTML = `<section data-notify data-state="loading">
  <p data-n-msg></p>
  <div data-n-ios hidden></div>
  <form data-n-form hidden>
    <input type="checkbox" name="category" value="tech">
    <input type="checkbox" name="breakingAll" checked>
    <textarea name="keywords"></textarea><textarea name="muted"></textarea>
    ${LEVEL_CHOICES.map(([v]) => `<input type="radio" name="level" value="${v}">`).join('')}
    <select name="dailyLimit"><option value="">auto</option>${LIMIT_CHOICES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>
  </form>
  <button data-n-on hidden></button><button data-n-save hidden></button><button data-n-off hidden></button>
</section>`;
function dom() { document.body.innerHTML = HTML; return document.querySelector('[data-notify]') as HTMLElement; }
const $ = (r: HTMLElement, s: string) => r.querySelector(s) as any;
const tick = () => new Promise((r) => setTimeout(r, 0));
const cfg = { endpoint: 'https://push.test', vapidPublicKey: 'k' };
const stat = (o: any = {}) => ({ enabled: true, supported: true, permission: 'default', subscribed: false, hasState: false, ...o });
const saved = { categories: ['tech'], level: 'balanced', dailyLimit: null, breakingAll: true, keywords: ['iPhone 17'], muted: ['cricket'] };
function client(o: any = {}) {
  return {
    status: vi.fn(async () => o.status ?? stat()),
    enable: vi.fn(async () => o.enable ?? { ok: true, created: true, prefs: saved }),
    getPrefs: vi.fn(async () => o.getPrefs ?? { ok: true, prefs: saved }),
    savePrefs: vi.fn(async () => o.savePrefs ?? { ok: true, prefs: saved }),
    disable: vi.fn(async () => ({ ok: true })),
  };
}
const win = () => ({ navigator: { userAgent: 'Chrome' }, setTimeout: (f: any, ms: number) => setTimeout(f, ms), clearTimeout: (id: any) => clearTimeout(id) }) as any;

describe('parseKeywordText', () => {
  it('splits on lines and commas, trims, drops empty parts', () => {
    expect(parseKeywordText('  iPhone 17 \n\n Tesla,  Mars rover ;')).toEqual(['iPhone 17', 'Tesla', 'Mars rover']);
  });
  it('keeps the same keyword once, whatever the letter case, and the first spelling', () => {
    expect(parseKeywordText('NASA\nnasa, Nasa')).toEqual(['NASA']);
  });
  it('collapses inner spaces and copes with odd input', () => {
    expect(parseKeywordText('a   b')).toEqual(['a b']);
    expect(parseKeywordText('')).toEqual([]);
    expect(parseKeywordText(undefined as any)).toEqual([]);
  });
  it('writes a list back as one per line', () => {
    expect(keywordText(['a', 'b'])).toBe('a\nb');
    expect(keywordText(undefined as any)).toBe('');
    expect(keywordText([1, 'x'] as any)).toBe('x');
  });
});

describe('keywordProblem', () => {
  it('accepts normal lists', () => {
    expect(keywordProblem({ keywords: ['a'], muted: ['b'] })).toBeNull();
    expect(keywordProblem({})).toBeNull();
  });
  it('refuses more than the limit in each list', () => {
    const many = Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => 'w' + i);
    expect(keywordProblem({ keywords: many, muted: [] })).toBe(MESSAGES.tooManyFollow);
    expect(keywordProblem({ keywords: [], muted: many })).toBe(MESSAGES.tooManyMute);
    expect(keywordProblem({ keywords: many.slice(0, MAX_KEYWORDS), muted: many.slice(0, MAX_KEYWORDS).map((x) => x + 'z') })).toBeNull();
  });
  it('refuses the same word in both lists, in any letter case', () => {
    expect(keywordProblem({ keywords: ['Tesla'], muted: ['tesla'] })).toBe(MESSAGES.sameWord);
  });
  it('uses the same limit as the Worker', async () => {
    const lib = await import('../../../workers/push/lib.js');
    expect(MAX_KEYWORDS).toBe(lib.MAX_TERMS);
  });
});

describe('form helpers with the boxes', () => {
  it('reads and fills both boxes', () => {
    const r = dom();
    fillForm(r, { categories: [], level: 'balanced', dailyLimit: null, breakingAll: true, keywords: ['iPhone 17', 'Tesla'], muted: ['cricket'] } as any);
    expect($(r, 'textarea[name="keywords"]').value).toBe('iPhone 17\nTesla');
    expect(readForm(r)).toMatchObject({ keywords: ['iPhone 17', 'Tesla'], muted: ['cricket'] });
  });
  it('fillForm leaves a box alone when the saved choices have no list', () => {
    const r = dom();
    $(r, 'textarea[name="keywords"]').value = 'keep me';
    fillForm(r, { categories: [], level: 'balanced', dailyLimit: null, breakingAll: true } as any);
    expect($(r, 'textarea[name="keywords"]').value).toBe('keep me');
  });
  it('readForm sends no keyword fields when the page has no boxes', () => {
    document.body.innerHTML = '<section><input type="checkbox" name="breakingAll" checked></section>';
    const out = readForm(document.querySelector('section') as HTMLElement);
    expect('keywords' in out).toBe(false);
    expect('muted' in out).toBe(false);
  });
  it('a keyword alone is a choice', () => {
    expect(hasChoice({ categories: [], breakingAll: false, keywords: ['x'] } as any)).toBe(true);
    expect(hasChoice({ categories: [], breakingAll: false, keywords: [] } as any)).toBe(false);
    expect(hasChoice({ categories: [], breakingAll: false } as any)).toBe(false);
  });
});

describe('the page with the boxes', () => {
  it('a subscribed reader sees the saved keywords', async () => {
    const r = dom();
    await initNotificationsPage({ root: r, cfg, client: client({ status: stat({ subscribed: true, hasState: true }) }), win: win() });
    expect($(r, 'textarea[name="keywords"]').value).toBe('iPhone 17');
    expect($(r, 'textarea[name="muted"]').value).toBe('cricket');
  });
  it('turn on sends the keywords; a keyword alone is enough', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'input[name="breakingAll"]').checked = false;
    $(r, 'textarea[name="keywords"]').value = 'Mars rover, NASA';
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).toHaveBeenCalledTimes(1);
    expect(c.enable.mock.calls[0][0].prefs).toMatchObject({ categories: [], breakingAll: false, keywords: ['Mars rover', 'NASA'], muted: [] });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.created);
  });
  it('save sends both lists', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'textarea[name="muted"]').value = 'cricket\nlottery';
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs.mock.calls[0][0].prefs).toMatchObject({ keywords: ['iPhone 17'], muted: ['cricket', 'lottery'] });
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.saved);
  });
  it('the same word in both boxes: a message and nothing is sent', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }) });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'textarea[name="muted"]').value = 'IPHONE 17';
    $(r, '[data-n-save]').click();
    await tick();
    expect(c.savePrefs).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.sameWord);
    expect($(r, '[data-n-msg]').getAttribute('data-bad')).toBe('1');
    expect($(r, '[data-n-save]').disabled).toBe(false);
  });
  it('too many keywords: a message and nothing is sent', async () => {
    const r = dom();
    const c = client();
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'textarea[name="keywords"]').value = Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => 'word' + i).join('\n');
    $(r, '[data-n-on]').click();
    await tick();
    expect(c.enable).not.toHaveBeenCalled();
    expect($(r, '[data-n-msg]').textContent).toBe(MESSAGES.tooManyFollow);
  });
  it('the Worker refusing a word shows the Worker sentence and keeps what the reader typed', async () => {
    const r = dom();
    const c = client({ status: stat({ subscribed: true, hasState: true }), savePrefs: { ok: false, reason: 'invalid', field: 'keywords', error: 'Please use at most 4 words.' } });
    await initNotificationsPage({ root: r, cfg, client: c, win: win() });
    $(r, 'textarea[name="keywords"]').value = 'one two three four five';
    $(r, '[data-n-save]').click();
    await tick();
    expect($(r, '[data-n-msg]').textContent).toBe('Please use at most 4 words.');
    expect($(r, 'textarea[name="keywords"]').value).toBe('one two three four five');
  });
});
