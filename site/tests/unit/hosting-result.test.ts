import { describe, it, expect, vi } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { buildResultList, confirmFor, carryOver, shortUrl, RETRYABLE, LABELS, TONES, SHORT_MAX } from '../../public/admin/js/hosting-result.js';
// @ts-ignore plain JS module
import { hostPost, REASON_WORDS, explain } from '../../public/admin/js/hosting-run.js';
// @ts-ignore plain JS module
import { RIGHTS_NOTICE } from '../../public/admin/js/hosted-meta.js';
// @ts-ignore plain JS module
import { findExternal } from '../../public/admin/js/hotlink.js';

const enc = (s: string) => new TextEncoder().encode(s);
const pic = (tag: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc('JFIF'), ...new Array(30).fill(tag)]);
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const OWN = ['shivam-das-news.pages.dev'];
const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch', date: '2026-11-16T10:00:00+05:30', body: '' as string };
const NOW = new Date('2026-11-17T01:02:03.456Z');
const optimize = vi.fn(async (bytes: Uint8Array) => ({ bytes: bytes.slice(0, 20), ext: 'webp' as const, width: 1600, height: 900 }));

/** A fake picture service: address -> bytes (ok) or a reason word. Records every call. */
function service(table: Record<string, Uint8Array | string>) {
  const calls: string[][] = [];
  const fn = vi.fn(async (urls: string[]) => {
    calls.push(urls);
    return { ok: true, results: urls.map((url) => { const v = table[url]; if (v === undefined) return { url, ok: false, reason: 'network' }; if (typeof v === 'string') return { url, ok: false, reason: v }; return { url, ok: true, kind: 'jpg', data: toB64(v), size: v.length }; }) };
  });
  return { fn, calls };
}
const run = (post: any, svc: any, extra: any = {}) => hostPost(post, { fetchPictures: svc.fn, optimize, ownHosts: OWN, now: NOW, ...extra });
const it1 = (status: string, extra: any = {}) => ({ url: 'https://other.com/a.jpg', status, ...extra });

describe('rows: one for each picture, with a label, a sentence and one action', () => {
  it('a hosted picture: label, tone, new address, no action', () => {
    const l = buildResultList({ items: [it1('hosted', { src: '/media/2026/11/a.webp', where: 'markdown' })], changed: true });
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0]).toMatchObject({ n: 1, url: 'https://other.com/a.jpg', short: 'other.com/a.jpg', host: 'other.com', where: 'markdown', status: 'hosted', label: 'Hosted', tone: 'good', action: 'none', src: '/media/2026/11/a.webp', autoAlt: false, hint: '' });
    expect(l.rows[0].text).toBe('Hosted on your site as /media/2026/11/a.webp.');
  });
  it('a hosted picture with an automatic alt text asks for a review', () => {
    const l = buildResultList({ items: [it1('hosted', { src: '/media/2026/11/a.webp', autoAlt: true }), it1('hosted', { url: 'https://other.com/b.jpg', src: '/media/2026/11/b.webp', autoAlt: false })], changed: true });
    expect(l.rows[0].autoAlt).toBe(true);
    expect(l.rows[0].hint).toBe('The alt text was written for you. Please read it and correct it.');
    expect(l.rows[1].hint).toBe('');
    expect(l.autoAltCount).toBe(1);
  });
  it('a reused picture: info tone, no action, and the way it was found (address or hash)', () => {
    const l = buildResultList({ items: [it1('reuse', { src: '/media/2026/11/a.webp', by: 'url' }), it1('reuse', { url: 'https://other.com/b.jpg', path: '/media/x.webp', by: 'sha256' })], changed: true });
    expect(l.rows.map((r: any) => [r.label, r.tone, r.action, r.src, r.by])).toEqual([['Already hosted', 'info', 'none', '/media/2026/11/a.webp', 'url'], ['Already hosted', 'info', 'none', '/media/x.webp', 'sha256']]);
    expect(l.rows[0].text).toBe('This picture is already on your site. It was used again.');
    expect(l.rows[1].text).toBe('The same picture is already on your site. It was used again.');
  });
  it('a picture that waits for confirmation: warn tone, action confirm, the rights notice as hint', () => {
    const r = buildResultList({ items: [it1('needs_confirm', { url: 'https://media.gettyimages.com/x.jpg' })] }).rows[0];
    expect(r).toMatchObject({ status: 'needs_confirm', label: 'Needs confirmation', tone: 'warn', action: 'confirm', reason: 'needs_confirm', hint: RIGHTS_NOTICE, host: 'media.gettyimages.com' });
    expect(r.text).toBe(explain('needs_confirm'));
  });
  it('a refused picture: bad tone, action replace, never retry or confirm', () => {
    const r = buildResultList({ items: [it1('refused', { reason: 'not_https', text: 'Only https addresses are fetched.' })] }).rows[0];
    expect(r).toMatchObject({ status: 'refused', label: 'Refused', tone: 'bad', action: 'replace', reason: 'not_https', text: 'Only https addresses are fetched.', hint: 'Use another picture, or remove this one.' });
  });
  it('a failed picture that waiting can fix gets Retry; one that waiting cannot fix gets Replace', () => {
    const l = buildResultList({ items: [it1('failed', { reason: 'timeout', text: explain('timeout') }), it1('failed', { url: 'https://other.com/b.jpg', reason: 'not_found', text: explain('not_found') })] });
    expect(l.rows[0]).toMatchObject({ status: 'failed', label: 'Failed', tone: 'bad', action: 'retry', hint: '', text: 'The other website was too slow.' });
    expect(l.rows[1]).toMatchObject({ action: 'replace', hint: 'Waiting will not fix this. Use another picture, or remove this one.', text: 'The picture is gone from the other website.' });
  });
  it('the text of a failed picture falls back to the plain sentence of its reason word', () => {
    expect(buildResultList({ items: [it1('failed', { reason: 'rate_limited' })] }).rows[0].text).toBe(explain('rate_limited'));
    expect(buildResultList({ items: [it1('failed', { reason: 'zzz' })] }).rows[0].text).toBe('The picture could not be hosted.');
  });
  it('rows are numbered from 1 in the order of the run', () => {
    const l = buildResultList({ items: [it1('hosted', { src: '/a' }), it1('failed', { reason: 'timeout' }), it1('reuse', { src: '/b' })] });
    expect(l.rows.map((r: any) => r.n)).toEqual([1, 2, 3]);
    expect(l.rows.map((r: any) => r.status)).toEqual(['hosted', 'failed', 'reuse']);
  });
});

describe('which failures can be tried again', () => {
  it('RETRYABLE holds only real reason words of hosting-run.js', () => {
    for (const w of RETRYABLE) expect(REASON_WORDS, w).toContain(w);
  });
  it('every reason word is either retryable or shown with Replace, never both', () => {
    for (const w of REASON_WORDS.filter((x: string) => x !== 'needs_confirm')) {
      const r = buildResultList({ items: [it1('failed', { reason: w })] }).rows[0];
      expect(r.action, w).toBe(RETRYABLE.has(w) ? 'retry' : 'replace');
    }
  });
  it('the other website is gone, the picture is too big, not a picture, SVG, big GIF, no WebP: Replace', () => {
    for (const w of ['not_found', 'too_big', 'not_image', 'svg_refused', 'gif_too_big', 'unsupported_format']) expect(RETRYABLE.has(w), w).toBe(false);
  });
  it('slow site, no network, busy service, signed out, damaged data: Retry', () => {
    for (const w of ['timeout', 'network', 'rate_limited', 'sign_in', 'worker_off', 'worker_failed', 'call_too_big', 'bad_data', 'missing']) expect(RETRYABLE.has(w), w).toBe(true);
  });
  it('an unknown status is shown as failed with Replace, and a missing or broken item does not throw', () => {
    const l = buildResultList({ items: [{ url: 'https://other.com/a.jpg', status: 'weird', reason: 'timeout' }, null, undefined, 5, 'x'] as any });
    expect(l.rows).toHaveLength(5);
    expect(l.rows.every((r: any) => r.status === 'failed' && r.action === 'replace')).toBe(true);
    expect(l.retry).toEqual([]);
  });
});

describe('counts and the three address lists', () => {
  const items = [
    it1('hosted', { url: 'https://o.com/1.jpg', src: '/media/1.webp' }),
    it1('reuse', { url: 'https://o.com/2.jpg', src: '/media/2.webp', by: 'url' }),
    it1('failed', { url: 'https://o.com/3.jpg', reason: 'timeout' }),
    it1('failed', { url: 'https://o.com/4.jpg', reason: 'not_found' }),
    it1('needs_confirm', { url: 'https://media.gettyimages.com/5.jpg' }),
    it1('refused', { url: 'http://o.com/6.jpg', reason: 'not_https' }),
  ];
  const l = buildResultList({ items, changed: true });
  it('counts every group', () => {
    expect(l.counts).toEqual({ total: 6, hosted: 1, reuse: 1, failed: 2, retry: 1, replace: 1, needs_confirm: 1, refused: 1 });
  });
  it('retry holds only the failed pictures that waiting can fix', () => { expect(l.retry).toEqual(['https://o.com/3.jpg']); });
  it('confirm holds only the pictures that wait for confirmation', () => { expect(l.confirm).toEqual(['https://media.gettyimages.com/5.jpg']); });
  it('fix holds the refused picture and the failed one that waiting cannot fix', () => { expect(l.fix).toEqual(['https://o.com/4.jpg', 'http://o.com/6.jpg']); });
  it('an address is listed once even when two rows carry it', () => {
    const d = buildResultList({ items: [it1('failed', { reason: 'timeout' }), it1('failed', { reason: 'timeout' })] });
    expect(d.retry).toEqual(['https://other.com/a.jpg']);
    expect(d.counts.retry).toBe(2);
  });
  it('canSave follows `changed` exactly', () => {
    expect(buildResultList({ items, changed: true }).canSave).toBe(true);
    expect(buildResultList({ items, changed: false }).canSave).toBe(false);
    expect(buildResultList({ items }).canSave).toBe(false);
    expect(buildResultList({ items, changed: 'yes' } as any).canSave).toBe(false);
  });
});

describe('the headline and the rights notice', () => {
  const h = (items: any[]) => buildResultList({ items }).headline;
  it('no outside pictures', () => { expect(h([])).toBe('There are no outside pictures in this post.'); });
  it('all done: one picture and many pictures', () => {
    expect(h([it1('hosted', { src: '/a' })])).toBe('All 1 picture is on your site.');
    expect(h([it1('hosted', { src: '/a' }), it1('reuse', { src: '/b' })])).toBe('All 2 pictures are on your site.');
  });
  it('a mix lists each group that is not empty, in a fixed order', () => {
    expect(h([it1('failed', { reason: 'timeout' }), it1('hosted', { src: '/a' }), it1('needs_confirm'), it1('refused', { reason: 'bad_url' }), it1('reuse', { src: '/b' })]))
      .toBe('5 pictures: 1 hosted, 1 already hosted, 1 waiting for your confirmation, 1 failed, 1 refused.');
    expect(h([it1('failed', { reason: 'timeout' })])).toBe('1 picture: 1 failed.');
  });
  it('the rights notice shows when something was hosted or waits, and not otherwise', () => {
    expect(buildResultList({ items: [it1('hosted', { src: '/a' })] }).notice).toBe(RIGHTS_NOTICE);
    expect(buildResultList({ items: [it1('needs_confirm')] }).notice).toBe(RIGHTS_NOTICE);
    expect(buildResultList({ items: [it1('reuse', { src: '/a' })] }).notice).toBe('');
    expect(buildResultList({ items: [it1('failed', { reason: 'timeout' })] }).notice).toBe('');
    expect(buildResultList({ items: [] }).notice).toBe('');
  });
  it('no sentence has an emoji', () => {
    const l = buildResultList({ items: [it1('hosted', { src: '/a', autoAlt: true }), it1('failed', { reason: 'not_found' }), it1('needs_confirm'), it1('refused', { reason: 'bad_url' })], changed: true });
    const all = [l.headline, l.notice, ...l.rows.flatMap((r: any) => [r.text, r.hint, r.label])].join(' ');
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false);
  });
});

describe('empty and broken input', () => {
  it('gives an empty list, never an error', () => {
    for (const x of [undefined, null, {}, { items: null }, { items: 'no' }, 5, 'x', []] as any[]) {
      const l = buildResultList(x);
      expect(l.rows).toEqual([]);
      expect(l.counts.total).toBe(0);
      expect(l.retry).toEqual([]); expect(l.confirm).toEqual([]); expect(l.fix).toEqual([]);
      expect(l.canSave).toBe(false);
      expect(l.headline).toBe('There are no outside pictures in this post.');
    }
  });
  it('does not change the run it is given', () => {
    const r = { items: [it1('failed', { reason: 'timeout' })], changed: true };
    const copy = JSON.parse(JSON.stringify(r));
    buildResultList(r);
    expect(r).toEqual(copy);
  });
  it('LABELS and TONES cover the same five statuses', () => {
    expect(Object.keys(LABELS).sort()).toEqual(['failed', 'hosted', 'needs_confirm', 'refused', 'reuse']);
    expect(Object.keys(TONES).sort()).toEqual(Object.keys(LABELS).sort());
  });
});

describe('shortUrl', () => {
  it('drops the scheme and the fragment', () => { expect(shortUrl('https://other.com/a.jpg#x')).toBe('other.com/a.jpg'); expect(shortUrl('HTTP://other.com/a.jpg')).toBe('other.com/a.jpg'); });
  it('cuts a long address to exactly SHORT_MAX characters with three dots', () => {
    const s = shortUrl('https://other.com/' + 'a'.repeat(200));
    expect(s).toHaveLength(SHORT_MAX);
    expect(s.endsWith('...')).toBe(true);
  });
  it('keeps an address of exactly SHORT_MAX characters whole', () => {
    const u = 'other.com/' + 'a'.repeat(SHORT_MAX - 10);
    expect(shortUrl('https://' + u)).toBe(u);
  });
  it('gives an empty text for nothing', () => { expect(shortUrl(undefined)).toBe(''); expect(shortUrl(null)).toBe(''); });
  it('the full address stays in the row', () => {
    const u = 'https://other.com/' + 'a'.repeat(200);
    expect(buildResultList({ items: [{ url: u, status: 'failed', reason: 'timeout' }] }).rows[0].url).toBe(u);
  });
});

describe('confirmFor: the new `confirmed` list after Confirm', () => {
  const G1 = 'https://media.gettyimages.com/a.jpg', G2 = 'https://media.gettyimages.com/b.jpg#frag', S = 'https://www.shutterstock.com/c.jpg';
  const list = buildResultList({ items: [it1('needs_confirm', { url: G1 }), it1('needs_confirm', { url: G2 }), it1('needs_confirm', { url: S }), it1('refused', { url: 'http://x.com/z.jpg', reason: 'not_https' }), it1('failed', { url: 'https://o.com/f.jpg', reason: 'timeout' })] });
  it('confirms every waiting picture by its address (without #fragment) by default', () => {
    expect(confirmFor(list, [])).toEqual([G1, 'https://media.gettyimages.com/b.jpg', S]);
  });
  it('confirms only the addresses asked for', () => { expect(confirmFor(list, [], { urls: [S] })).toEqual([S]); });
  it('wholeHost confirms the website once, however many pictures it has', () => {
    expect(confirmFor(list, [], { wholeHost: true })).toEqual(['media.gettyimages.com', 'shutterstock.com']);
  });
  it('ignores a refused picture, a failed picture, a picture not in the list and a made up address', () => {
    expect(confirmFor(list, [], { urls: ['http://x.com/z.jpg', 'https://o.com/f.jpg', 'https://nowhere.com/q.jpg', '', 5 as any] })).toEqual([]);
  });
  it('keeps what was confirmed before and adds nothing twice', () => {
    const before = ['shutterstock.com', G1];
    expect(confirmFor(list, before)).toEqual(['shutterstock.com', G1, 'https://media.gettyimages.com/b.jpg', S]);
    expect(confirmFor(list, confirmFor(list, []))).toEqual(confirmFor(list, []));
  });
  it('does not change the list it is given', () => {
    const before = ['shutterstock.com'];
    confirmFor(list, before);
    expect(before).toEqual(['shutterstock.com']);
  });
  it('bad input gives a list, not an error', () => {
    expect(confirmFor(undefined as any, undefined as any)).toEqual([]);
    expect(confirmFor(null as any, 'x' as any)).toEqual([]);
    expect(confirmFor({ rows: 'no' } as any, [])).toEqual([]);
  });
});

describe('carryOver: where the next run starts', () => {
  it('copies the post and the map; changing the copy does not touch the run', () => {
    const r = { post: { body: 'a', title: 't' }, map: { '/media/a.webp': { alt: 'x' } } };
    const c = carryOver(r);
    expect(c).toEqual({ post: { body: 'a', title: 't' }, map: { '/media/a.webp': { alt: 'x' } } });
    c.post.body = 'changed'; c.map['/media/b.webp'] = {};
    expect(r.post.body).toBe('a');
    expect(Object.keys(r.map)).toEqual(['/media/a.webp']);
  });
  it('a run with no post or a broken map gives nulls or an empty map', () => {
    expect(carryOver(undefined)).toEqual({ post: null, map: null });
    expect(carryOver({})).toEqual({ post: null, map: null });
    expect(carryOver({ post: 'x' } as any)).toEqual({ post: null, map: null });
    expect(carryOver({ post: { body: '' }, map: [1] } as any)).toEqual({ post: { body: '' }, map: {} });
    expect(carryOver({ post: { body: '' } })).toEqual({ post: { body: '' }, map: {} });
  });
});

describe('with the real hostPost: Retry and Confirm end to end', () => {
  const A = 'https://other.com/a.jpg', B = 'https://other.com/b.jpg', G = 'https://media.gettyimages.com/g.jpg', M = 'http://other.com/m.jpg';
  const post = { ...POST, body: `![First picture of the launch](${A})\n\n![Second picture](${B})\n\n![Agency picture](${G})\n\n![Plain http](${M})` };

  it('the first run: one hosted, one failed (slow), one waiting, one refused', async () => {
    const svc = service({ [A]: pic(1), [B]: 'timeout' });
    const r = await run(post, svc);
    const l = buildResultList(r);
    expect(l.rows.map((x: any) => [x.status, x.action])).toEqual([['hosted', 'none'], ['failed', 'retry'], ['needs_confirm', 'confirm'], ['refused', 'replace']]);
    expect(l.retry).toEqual([B]);
    expect(l.confirm).toEqual([G]);
    expect(l.fix).toEqual([M]);
    expect(l.canSave).toBe(true);
    expect(l.headline).toBe('4 pictures: 1 hosted, 1 waiting for your confirmation, 1 failed, 1 refused.');
    expect(l.notice).toBe(RIGHTS_NOTICE);
    expect(svc.calls).toEqual([[A, B]]);
  });

  it('Retry: the second run asks the service only for the failed picture; the hosted one is not downloaded again', async () => {
    const r1 = await run(post, service({ [A]: pic(1), [B]: 'timeout' }));
    const start = carryOver(r1);
    const svc2 = service({ [B]: pic(2) });
    const r2 = await run(start.post, svc2, { map: start.map });
    expect(svc2.calls).toEqual([[B]]);
    const l2 = buildResultList(r2);
    expect(l2.rows.map((x: any) => x.status)).toEqual(['hosted', 'needs_confirm', 'refused']);
    expect(l2.retry).toEqual([]);
    expect(findExternal(r2.post, OWN).map((x: any) => x.url)).toEqual([G, M]);
    expect(Object.keys(r2.map)).toHaveLength(2);
    expect(r2.post.body).toContain(Object.keys(r1.map)[0]);
  });

  it('Confirm: after Confirm the agency picture is fetched; the refused one still is not', async () => {
    const r1 = await run(post, service({ [A]: pic(1), [B]: pic(2), [G]: pic(3) }));
    const l1 = buildResultList(r1);
    expect(l1.confirm).toEqual([G]);
    const confirmed = confirmFor(l1, []);
    const start = carryOver(r1);
    const svc2 = service({ [G]: pic(3) });
    const r2 = await run(start.post, svc2, { map: start.map, confirmed });
    expect(svc2.calls).toEqual([[G]]);
    const l2 = buildResultList(r2);
    expect(l2.rows.map((x: any) => x.status)).toEqual(['hosted', 'refused']);
    expect(l2.confirm).toEqual([]);
    expect(l2.fix).toEqual([M]);
  });

  it('a service that is switched off fails every picture with Retry, and the post stays as it was', async () => {
    const off = { fn: vi.fn(async () => ({ ok: false, reason: 'worker_off', text: 'x' })), calls: [] as string[][] };
    const r = await run(post, off);
    const l = buildResultList(r);
    expect(l.rows.map((x: any) => [x.status, x.reason, x.action])).toEqual([['failed', 'worker_off', 'retry'], ['failed', 'worker_off', 'retry'], ['needs_confirm', 'needs_confirm', 'confirm'], ['refused', 'not_https', 'replace']]);
    expect(l.retry).toEqual([A, B]);
    expect(l.canSave).toBe(false);
    expect(r.post.body).toBe(post.body);
  });

  it('a picture that is gone is not offered Retry', async () => {
    const r = await run({ ...POST, body: `![x](${A})` }, service({ [A]: 'not_found' }));
    const l = buildResultList(r);
    expect(l.rows[0]).toMatchObject({ status: 'failed', reason: 'not_found', action: 'replace' });
    expect(l.retry).toEqual([]);
    expect(l.fix).toEqual([A]);
  });

  it('everything hosted: the headline says so and nothing is left to do', async () => {
    const r = await run({ ...POST, body: `![One](${A}) ![Two](${B})` }, service({ [A]: pic(1), [B]: pic(2) }));
    const l = buildResultList(r);
    expect(l.headline).toBe('All 2 pictures are on your site.');
    expect([l.retry, l.confirm, l.fix]).toEqual([[], [], []]);
    expect(l.canSave).toBe(true);
  });

  it('a post with no outside pictures gives the empty headline and nothing to save', async () => {
    const r = await run({ ...POST, body: 'Only text.' }, service({}));
    const l = buildResultList(r);
    expect(l.headline).toBe('There are no outside pictures in this post.');
    expect(l.canSave).toBe(false);
  });

  it('the address of a picture is carried as written, so a screen must show it as text', async () => {
    const evil = 'https://other.com/<script>alert(1)</script>.jpg';
    const l = buildResultList({ items: [{ url: evil, status: 'failed', reason: 'not_found' }] });
    expect(l.rows[0].url).toBe(evil);
    expect(l.rows[0].text).not.toContain('<script>');
  });
});
