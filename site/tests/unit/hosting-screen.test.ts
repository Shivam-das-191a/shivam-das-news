// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { hostingScreen } from '../../public/admin/js/hosting-screen.js';
// @ts-ignore
import { buildResultList } from '../../public/admin/js/hosting-result.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const flush = () => new Promise((r) => setTimeout(r, 0));

const U1 = 'https://cdn.example.com/a.jpg';
const U2 = 'https://slow.example.org/b.png';
const U3 = 'https://agency.example.net/c.jpg';
const U4 = 'https://bad.example.io/d.gif';
const U5 = 'https://gone.example.io/e.jpg';

const hosted = { status: 'hosted', url: U1, src: '/media/2026/11/a.webp', autoAlt: true };
const retryable = { status: 'failed', url: U2, reason: 'timeout' };
const waiting = { status: 'needs_confirm', url: U3 };
const refused = { status: 'refused', url: U4, reason: 'not_image' };
const fixable = { status: 'failed', url: U5, reason: 'too_big_for_anything' };
const run = (items: any[], changed = true) => ({ items, changed });

const make = (items: any[], o: any = {}) => hostingScreen({ run: run(items), onRetry: vi.fn(), onConfirm: vi.fn(), ...o });

beforeEach(() => { document.body.innerHTML = ''; });

describe('the headline and the notices', () => {
  it('shows the headline of the list', () => {
    const s = make([hosted, retryable]);
    expect(q(s.el, 'headline').textContent).toBe(buildResultList(run([hosted, retryable])).headline);
  });
  it('an empty run shows the empty sentence, no rows and no buttons', () => {
    const s = make([]);
    expect(q(s.el, 'headline').textContent).toBe('There are no outside pictures in this post.');
    expect(qa(s.el, 'row')).toHaveLength(0);
    expect(s.el.querySelectorAll('button')).toHaveLength(0);
    expect(q(s.el, 'rows').hidden).toBe(true);
    expect(q(s.el, 'bar').hidden).toBe(true);
  });
  it('shows the rights notice when a picture was hosted or waits', () => {
    expect(q(make([hosted]).el, 'notice').hidden).toBe(false);
    expect(q(make([waiting]).el, 'notice').hidden).toBe(false);
    expect(q(make([hosted]).el, 'notice').textContent.length).toBeGreaterThan(10);
  });
  it('hides the rights notice when nothing was hosted and nothing waits', () => {
    expect(q(make([retryable]).el, 'notice').hidden).toBe(true);
  });
  it('says how many pictures have an alt text written for the writer', () => {
    const one = q(make([hosted]).el, 'alt-note');
    expect(one.hidden).toBe(false);
    expect(one.textContent).toBe('1 picture has alt text that was written for you. Please read it and correct it.');
    const two = q(make([hosted, { ...hosted, url: 'https://cdn.example.com/z.jpg' }]).el, 'alt-note');
    expect(two.textContent).toBe('2 pictures have alt text that was written for you. Please read it and correct it.');
  });
  it('hides the alt note when no alt text was written', () => {
    expect(q(make([{ ...hosted, autoAlt: false }]).el, 'alt-note').hidden).toBe(true);
  });
});

describe('the rows', () => {
  it('draws one row for each picture, in the order of the post', () => {
    const s = make([hosted, retryable, waiting, refused]);
    expect(qa(s.el, 'row').map((r) => r.dataset.n)).toEqual(['1', '2', '3', '4']);
    expect(qa(s.el, 'row').map((r) => r.dataset.status)).toEqual(['hosted', 'failed', 'needs_confirm', 'refused']);
  });
  it('shows the label, the short address and the sentence of each row', () => {
    const s = make([hosted]);
    const row = qa(s.el, 'row')[0];
    expect(q(row, 'label').textContent).toBe('Hosted');
    expect(q(row, 'url').textContent).toBe('cdn.example.com/a.jpg');
    expect(q(row, 'url').title).toBe(U1);
    expect(q(row, 'text').textContent).toContain('/media/2026/11/a.webp');
  });
  it('writes the tone of each row', () => {
    const s = make([hosted, waiting, retryable]);
    expect(qa(s.el, 'row').map((r) => r.dataset.tone)).toEqual(['good', 'warn', 'bad']);
    expect(qa(s.el, 'row')[0].className).toContain('good');
  });
  it('shows the hint under a row that has one', () => {
    const s = make([refused]);
    expect(q(qa(s.el, 'row')[0], 'hint').textContent).toBe('Use another picture, or remove this one.');
  });
  it('a row without a hint has no hint line', () => {
    expect(q(qa(make([{ ...hosted, autoAlt: false }]).el, 'row')[0], 'hint')).toBeNull();
  });
  it('an unknown status is drawn as failed with no Retry', () => {
    const s = make([{ status: 'weird', url: U1 }]);
    const row = qa(s.el, 'row')[0];
    expect(row.dataset.status).toBe('failed');
    expect(q(row, 'retry-one')).toBeNull();
  });
  it('a tone outside the known words is written as bad', () => {
    const list = buildResultList(run([hosted]));
    list.rows[0].tone = 'x" onclick="boom';
    const s = hostingScreen({ list });
    expect(qa(s.el, 'row')[0].dataset.tone).toBe('bad');
    expect(qa(s.el, 'row')[0].getAttribute('onclick')).toBeNull();
  });
});

describe('which buttons a row gets', () => {
  it('a failed picture that can be tried again has Retry', () => {
    const row = qa(make([retryable]).el, 'row')[0];
    expect(q(row, 'retry-one').textContent).toBe('Retry');
    expect(q(row, 'confirm-one')).toBeNull();
  });
  it('a picture that waits has Confirm and Confirm all from the host', () => {
    const row = qa(make([waiting]).el, 'row')[0];
    expect(q(row, 'confirm-one').textContent).toBe('Confirm');
    expect(q(row, 'confirm-host').textContent).toBe('Confirm all from agency.example.net');
    expect(q(row, 'retry-one')).toBeNull();
  });
  it('a picture whose address has no host name has no Confirm all from the host', () => {
    const row = qa(make([{ status: 'needs_confirm', url: 'not a web address' }]).el, 'row')[0];
    expect(q(row, 'confirm-one')).not.toBeNull();
    expect(q(row, 'confirm-host')).toBeNull();
  });
  it('a refused picture has no Retry and no Confirm', () => {
    const row = qa(make([refused]).el, 'row')[0];
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });
  it('a failed picture that waiting cannot fix has no Retry', () => {
    const row = qa(make([fixable]).el, 'row')[0];
    expect(row.dataset.action).toBe('replace');
    expect(q(row, 'retry-one')).toBeNull();
  });
  it('a picture to replace has Show in post only when onReplace is given', () => {
    expect(q(qa(make([refused]).el, 'row')[0], 'replace-one')).toBeNull();
    expect(q(qa(make([refused], { onReplace: vi.fn() }).el, 'row')[0], 'replace-one').textContent).toBe('Show in post');
  });
  it('hosted and reused pictures have no button', () => {
    const s = make([hosted, { status: 'reuse', url: U2, src: '/media/x.webp', by: 'sha256' }]);
    expect(s.el.querySelectorAll('.hosting-row button')).toHaveLength(0);
  });
  it('canEdit false draws no button at all, even in the bar', () => {
    const s = make([retryable, waiting, refused], { canEdit: false, onReplace: vi.fn() });
    expect(s.el.querySelectorAll('button')).toHaveLength(0);
    expect(qa(s.el, 'row')).toHaveLength(3);
  });
});

describe('the bar above the list', () => {
  it('counts the pictures for Retry and for Confirm', () => {
    const s = make([retryable, { ...retryable, url: 'https://slow.example.org/other.png' }, waiting]);
    expect(q(s.el, 'retry-all').textContent).toBe('Retry 2 pictures');
    expect(q(s.el, 'confirm-all').textContent).toBe('Confirm 1 picture');
  });
  it('has no Retry all when nothing can be tried again', () => {
    expect(q(make([waiting]).el, 'retry-all')).toBeNull();
  });
  it('has no Confirm all when nothing waits', () => {
    expect(q(make([retryable]).el, 'confirm-all')).toBeNull();
  });
  it('the same address twice is counted once', () => {
    const s = make([retryable, retryable]);
    expect(q(s.el, 'retry-all').textContent).toBe('Retry 1 picture');
  });
});

describe('the buttons call the functions', () => {
  it('Retry on a row sends only its address', async () => {
    const onRetry = vi.fn();
    const s = make([retryable, { ...retryable, url: 'https://slow.example.org/other.png' }], { onRetry });
    q(qa(s.el, 'row')[1], 'retry-one').click();
    await flush();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({ urls: ['https://slow.example.org/other.png'] });
  });
  it('Retry all sends every address that can be tried again', async () => {
    const onRetry = vi.fn();
    const s = make([retryable, hosted, { ...retryable, url: 'https://slow.example.org/other.png' }], { onRetry });
    q(s.el, 'retry-all').click();
    await flush();
    expect(onRetry).toHaveBeenCalledWith({ urls: [U2, 'https://slow.example.org/other.png'] });
  });
  it('Confirm on a row confirms one address and not the whole host', async () => {
    const onConfirm = vi.fn();
    const s = make([waiting], { onConfirm });
    q(s.el, 'confirm-one').click();
    await flush();
    expect(onConfirm).toHaveBeenCalledWith({ urls: [U3], wholeHost: false });
  });
  it('Confirm all from the host sends wholeHost true', async () => {
    const onConfirm = vi.fn();
    const s = make([waiting], { onConfirm });
    q(s.el, 'confirm-host').click();
    await flush();
    expect(onConfirm).toHaveBeenCalledWith({ urls: [U3], wholeHost: true });
  });
  it('Confirm in the bar sends every waiting address', async () => {
    const onConfirm = vi.fn();
    const s = make([waiting, { ...waiting, url: 'https://agency.example.net/d.jpg' }], { onConfirm });
    q(s.el, 'confirm-all').click();
    await flush();
    expect(onConfirm).toHaveBeenCalledWith({ urls: [U3, 'https://agency.example.net/d.jpg'], wholeHost: false });
  });
  it('Show in post calls onReplace with the address', () => {
    const onReplace = vi.fn();
    const s = make([refused], { onReplace });
    q(s.el, 'replace-one').click();
    expect(onReplace).toHaveBeenCalledWith({ url: U4 });
  });
  it('a missing callback does nothing and does not throw', async () => {
    const s = hostingScreen({ run: run([retryable]) });
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').hidden).toBe(true);
  });
});

describe('one job at a time', () => {
  it('disables every button while a job runs and enables them after', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const s = make([retryable, waiting], { onRetry });
    q(s.el, 'retry-one').click();
    await flush();
    expect([...s.el.querySelectorAll('button')].every((b: any) => b.disabled)).toBe(true);
    done();
    await flush();
    expect([...s.el.querySelectorAll('button')].some((b: any) => b.disabled)).toBe(false);
  });
  it('a second click while a job runs sends nothing', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const s = make([retryable], { onRetry });
    const b = q(s.el, 'retry-one');
    b.click(); b.click();
    q(s.el, 'retry-all').click();
    await flush();
    expect(onRetry).toHaveBeenCalledTimes(1);
    done();
  });
  it('Confirm cannot start while Retry runs', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const onConfirm = vi.fn();
    const s = make([retryable, waiting], { onRetry, onConfirm });
    q(s.el, 'retry-one').click();
    q(s.el, 'confirm-one').click();
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    done();
  });
  it('Show in post does nothing while a job runs', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const onReplace = vi.fn();
    const s = make([retryable, refused], { onRetry, onReplace });
    q(s.el, 'retry-one').click();
    q(s.el, 'replace-one').click();
    expect(onReplace).not.toHaveBeenCalled();
    done();
  });
  it('the guard holds even if a button is switched on by hand while a job runs', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const onConfirm = vi.fn();
    const s = make([retryable, waiting], { onRetry, onConfirm });
    q(s.el, 'retry-one').click();
    await flush();
    const c = q(s.el, 'confirm-one');
    c.disabled = false;
    c.click();
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    done();
  });
  it('Show in post does nothing while a job runs, even on a button switched on by hand', async () => {
    let done: any;
    const onRetry = vi.fn(() => new Promise((r) => { done = r; }));
    const onReplace = vi.fn();
    const s = make([retryable, refused], { onRetry, onReplace });
    q(s.el, 'retry-one').click();
    await flush();
    const b = q(s.el, 'replace-one');
    b.disabled = false;
    b.click();
    expect(onReplace).not.toHaveBeenCalled();
    done();
  });
  it('setBusy(true) disables the buttons and setBusy(false) enables them', () => {
    const s = make([retryable]);
    s.setBusy(true);
    expect(q(s.el, 'retry-one').disabled).toBe(true);
    s.setBusy(false);
    expect(q(s.el, 'retry-one').disabled).toBe(false);
  });
});

describe('what a job answers', () => {
  it('a new list from the job redraws the screen', async () => {
    const next = buildResultList(run([{ ...retryable, status: 'hosted', src: '/media/2026/11/b.webp' }]));
    const s = make([retryable], { onRetry: async () => ({ list: next }) });
    q(s.el, 'retry-one').click();
    await flush();
    expect(qa(s.el, 'row')[0].dataset.status).toBe('hosted');
    expect(q(s.el, 'retry-all')).toBeNull();
    expect([...s.el.querySelectorAll('button')].some((b: any) => b.disabled)).toBe(false);
  });
  it('a new run from the job is turned into a list', async () => {
    const s = make([retryable], { onRetry: async () => ({ run: run([hosted]) }) });
    q(s.el, 'retry-one').click();
    await flush();
    expect(qa(s.el, 'row')[0].dataset.status).toBe('hosted');
  });
  it('a message from the job is shown as one plain sentence', async () => {
    const s = make([retryable], { onRetry: async () => ({ message: 'Saved in one commit.' }) });
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').textContent).toBe('Saved in one commit.');
    expect(q(s.el, 'status').hidden).toBe(false);
  });
  it('a job that throws shows a plain sentence, keeps the list and enables the buttons', async () => {
    const s = make([retryable], { onRetry: async () => { throw new Error('GitHub said no.'); } });
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').textContent).toBe('GitHub said no.');
    expect(q(s.el, 'status').className).toBe('bad');
    expect(qa(s.el, 'row')).toHaveLength(1);
    expect(q(s.el, 'retry-one').disabled).toBe(false);
  });
  it('a token in an error is never shown', async () => {
    const token = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const s = make([retryable], { onRetry: async () => { throw new Error(`Bad credentials ${token}`); } });
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').textContent).not.toContain(token);
    expect(s.el.textContent).not.toContain(token);
  });
  it('a token in a message is never shown', async () => {
    const token = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const s = make([retryable], { onRetry: async () => ({ message: `Done ${token}` }) });
    q(s.el, 'retry-one').click();
    await flush();
    expect(s.el.textContent).not.toContain(token);
  });
  it('the status is cleared when the next job starts', async () => {
    let n = 0;
    const s = make([retryable], { onRetry: async () => { n++; if (n === 1) throw new Error('First failure.'); } });
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').textContent).toBe('First failure.');
    q(s.el, 'retry-one').click();
    await flush();
    expect(q(s.el, 'status').hidden).toBe(true);
  });
});

describe('say()', () => {
  it('shows one sentence, as a bad one when asked', () => {
    const s = make([hosted]);
    s.say('Saved.');
    expect(q(s.el, 'status').textContent).toBe('Saved.');
    expect(q(s.el, 'status').hidden).toBe(false);
    expect(q(s.el, 'status').className).toBe('');
    s.say('Broken.', true);
    expect(q(s.el, 'status').className).toBe('bad');
  });
  it('an empty message hides the status', () => {
    const s = make([hosted]);
    s.say('x');
    s.say('');
    expect(q(s.el, 'status').hidden).toBe(true);
    expect(q(s.el, 'status').textContent).toBe('');
  });
  it('a token is hidden and tags are text', () => {
    const token = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const s = make([hosted]);
    s.say(`Bad ${token} <b>x</b>`);
    expect(s.el.textContent).not.toContain(token);
    expect(s.el.querySelector('b')).toBeNull();
  });
});

describe('update and the input', () => {
  it('update draws a new run and clears the status', async () => {
    const s = make([retryable], { onRetry: async () => { throw new Error('Nope.'); } });
    q(s.el, 'retry-one').click();
    await flush();
    s.update(run([hosted, hosted]));
    expect(qa(s.el, 'row')).toHaveLength(2);
    expect(q(s.el, 'status').hidden).toBe(true);
  });
  it('update accepts a list that is already built', () => {
    const s = make([retryable]);
    s.update(buildResultList(run([waiting])));
    expect(qa(s.el, 'row')[0].dataset.status).toBe('needs_confirm');
  });
  it('bad input gives the empty list and never throws', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { items: 'no' }]) {
      const s = hostingScreen({ run: bad as any });
      expect(q(s.el, 'headline').textContent).toBe('There are no outside pictures in this post.');
      expect(() => s.update(bad as any)).not.toThrow();
    }
    expect(() => hostingScreen()).not.toThrow();
    expect(() => hostingScreen(null as any)).not.toThrow();
  });
});

describe('text, never HTML', () => {
  const evil = 'https://evil.example.com/<img src=x onerror=alert(1)>.jpg';
  it('an address with tags is shown as text', () => {
    const s = make([{ status: 'failed', url: evil, reason: 'timeout' }]);
    expect(s.el.querySelector('img')).toBeNull();
    expect(q(s.el, 'url').textContent).toContain('<img src=x');
  });
  it('a sentence with tags is shown as text', () => {
    const s = make([{ status: 'failed', url: U2, reason: 'timeout', text: '<b>bold</b><script>x()</script>' }]);
    expect(s.el.querySelector('b')).toBeNull();
    expect(s.el.querySelector('script')).toBeNull();
    expect(q(s.el, 'text').textContent).toBe('<b>bold</b><script>x()</script>');
  });
  it('the host name on the button is shown as text', () => {
    const s = make([{ status: 'needs_confirm', url: 'https://a.example.com/x.jpg' }]);
    expect(s.el.querySelector('button img')).toBeNull();
  });
  it('the whole screen has no link, no picture and no form', () => {
    const s = make([hosted, retryable, waiting, refused]);
    expect(s.el.querySelectorAll('a, img, form, iframe, script')).toHaveLength(0);
  });
});

describe('the source of the screen', () => {
  const code = src('public/admin/js/hosting-screen.js');
  it('uses no innerHTML, no network, no storage and no token', () => {
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|Authorization|Bearer|eval\s*\(|new Function/);
  });
  it('has no emoji', () => {
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
