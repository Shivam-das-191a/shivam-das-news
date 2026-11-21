import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { planHosting, summarize, rewriteUrls, rewritePost, STATUS } from '../../public/admin/js/hosting-plan.js';
// @ts-ignore plain JS module
import { findExternal } from '../../public/admin/js/hotlink.js';

const OWN = ['shivam-das-news.pages.dev'];
const A = 'https://other.com/a.jpg';
const by = (plan: any) => plan.items.map((i: any) => [i.url, i.status]);

describe('planHosting', () => {
  it('says fetch for a normal outside picture and gives the address to fetch (no #fragment)', () => {
    const p = planHosting({ body: '![x](https://other.com/a.jpg#top)' }, { ownHosts: OWN });
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ status: 'fetch', url: A + '#top', fetchUrl: A, where: 'markdown' });
    expect(p.counts).toEqual({ total: 1, fetch: 1, reuse: 0, needs_confirm: 0, refused: 0 });
  });
  it('keeps the alt text, the heading, the place and the order of findExternal', () => {
    const post = { image: 'https://other.com/f.jpg', imageAlt: 'Front', body: '## Votes\n\n![Count](https://other.com/b.jpg)' };
    const p = planHosting(post, { ownHosts: OWN });
    expect(p.items.map((i: any) => [i.where, i.alt, i.heading])).toEqual([['image', 'Front', ''], ['markdown', 'Count', 'Votes']]);
    expect(p.items.map((i: any) => i.url)).toEqual(findExternal(post, OWN).map((i: any) => i.url));
  });
  it('refuses an address that may not be fetched, with the reason word and a sentence', () => {
    const body = ['![a](http://other.com/a.jpg)', '![b](https://localhost/b.jpg)', '![c](https://u:p@other.com/c.jpg)', '![d](https://other.com:8443/d.jpg)', '![e](https://10.0.0.1/e.jpg)'].join('\n');
    const p = planHosting({ body }, { ownHosts: OWN });
    expect(p.items.map((i: any) => [i.status, i.reason])).toEqual([['refused', 'not_https'], ['refused', 'private_host'], ['refused', 'credentials'], ['refused', 'bad_port'], ['refused', 'private_host']]);
    expect(p.items.every((i: any) => typeof i.text === 'string' && i.text.length > 0 && !('fetchUrl' in i))).toBe(true);
    expect(p.counts.refused).toBe(5);
  });
  it('refuses a host the owner blocked', () => {
    const p = planHosting({ body: `![x](${A})` }, { ownHosts: OWN, blockHosts: ['other.com'] });
    expect(p.items[0]).toMatchObject({ status: 'refused', reason: 'blocked_host' });
  });
  it('holds an agency picture until the writer confirms the address or the host', () => {
    const g = 'https://media.gettyimages.com/id/1/photo.jpg';
    expect(planHosting({ body: `![x](${g})` }, { ownHosts: OWN }).items[0].status).toBe('needs_confirm');
    expect(planHosting({ body: `![x](${g})` }, { ownHosts: OWN, confirmed: [g] }).items[0].status).toBe('fetch');
    expect(planHosting({ body: `![x](${g})` }, { ownHosts: OWN, confirmed: ['media.gettyimages.com'] }).items[0].status).toBe('fetch');
    expect(planHosting({ body: `![x](${g})` }, { ownHosts: OWN, agencyHosts: [] }).items[0].status).toBe('fetch');
  });
  it('the agency rule comes before reuse (the order of LOGICS 22), the refusal before both', () => {
    const g = 'https://media.gettyimages.com/id/1/photo.jpg';
    const map = { '/media/2026/11/g.webp': { sourceUrl: g } };
    expect(planHosting({ body: `![x](${g})` }, { ownHosts: OWN, map }).items[0].status).toBe('needs_confirm');
    const h = 'http://media.gettyimages.com/id/1/photo.jpg';
    expect(planHosting({ body: `![x](${h})` }, { ownHosts: OWN, map: { '/media/a.webp': { sourceUrl: h } } }).items[0].status).toBe('refused');
  });
  it('reuses a file we already have for the same address; a different query string is a different picture', () => {
    const map = { '/media/2026/11/a.webp': { sourceUrl: 'https://other.com/a.jpg?w=900' } };
    const p = planHosting({ body: '![x](https://other.com/a.jpg?w=900#t)\n![y](https://other.com/a.jpg?w=400)' }, { ownHosts: OWN, map });
    expect(p.items.map((i: any) => [i.status, i.path])).toEqual([['reuse', '/media/2026/11/a.webp'], ['fetch', undefined]]);
    expect(p.counts).toMatchObject({ reuse: 1, fetch: 1 });
  });
  it('lists a picture once even when it is used twice, and skips our own host, relative and data pictures', () => {
    const body = `![a](${A})\n![b](${A})\n![c](/media/x.webp)\n![d](https://shivam-das-news.pages.dev/media/y.webp)\n![e](data:image/png;base64,AAAA)`;
    expect(by(planHosting({ body }, { ownHosts: OWN }))).toEqual([[A, 'fetch']]);
  });
  it('an empty post gives an empty plan; the counts add up', () => {
    expect(planHosting({}, {})).toEqual({ items: [], counts: { total: 0, fetch: 0, reuse: 0, needs_confirm: 0, refused: 0 } });
    expect(planHosting(undefined as any, undefined as any).items).toEqual([]);
    const p = planHosting({ body: `![a](${A})\n![b](http://x.com/b.jpg)\n![c](https://media.gettyimages.com/c.jpg)\n![d](https://other.com/d.jpg)` }, { ownHosts: OWN, map: { '/media/d.webp': { sourceUrl: 'https://other.com/d.jpg' } } });
    expect(p.counts).toEqual({ total: 4, fetch: 1, reuse: 1, needs_confirm: 1, refused: 1 });
    expect(STATUS).toEqual(['fetch', 'reuse', 'needs_confirm', 'refused']);
  });
  it('does not change the post or the map', () => {
    const post = { body: `![a](${A})` };
    const map = { '/media/a.webp': { sourceUrl: A } };
    const snap = JSON.stringify([post, map]);
    planHosting(post, { ownHosts: OWN, map });
    expect(JSON.stringify([post, map])).toBe(snap);
  });
});

describe('summarize', () => {
  it('counts every status and lists the failed addresses for Retry', () => {
    const r = summarize([{ url: 'u1', status: 'hosted' }, { url: 'u2', status: 'failed' }, { url: 'u3', status: 'reuse' }, { url: 'u4', status: 'failed' }, { url: 'u5', status: 'needs_confirm' }, { url: 'u6', status: 'refused' }, { url: 'u7', status: 'unknown' }, null as any]);
    expect(r.counts).toEqual({ total: 8, fetch: 0, reuse: 1, needs_confirm: 1, refused: 1, hosted: 1, failed: 2 });
    expect(r.retry).toEqual(['u2', 'u4']);
    expect(summarize([])).toEqual({ counts: { total: 0, fetch: 0, reuse: 0, needs_confirm: 0, refused: 0, hosted: 0, failed: 0 }, retry: [] });
    expect(summarize(undefined as any).retry).toEqual([]);
  });
});

describe('rewriteUrls', () => {
  const R = { [A]: '/media/2026/11/a.webp' };
  it('changes a Markdown picture, an img src, a srcset, a bare address and every place of the same address', () => {
    const text = `![x](${A} "t")\n<img src="${A}" srcset="${A} 480w, ${A} 800w">\nplain ${A}.\n![y](<${A}>)`;
    const r = rewriteUrls(text, R);
    expect(r.count).toBe(6);
    expect(r.text).toBe('![x](/media/2026/11/a.webp "t")\n<img src="/media/2026/11/a.webp" srcset="/media/2026/11/a.webp 480w, /media/2026/11/a.webp 800w">\nplain /media/2026/11/a.webp.\n![y](</media/2026/11/a.webp>)');
  });
  it('leaves a longer address that starts the same way, and an address that only contains the name', () => {
    const text = `![x](${A}?w=400)\n![y](${A}#frag)\n![z](https://other.com/a.jpg2)\n![w](https://evil.other.com/a.jpg)\n![v](xhttps://other.com/a.jpg)`;
    const r = rewriteUrls(text, R);
    expect(r.text).toBe(`![x](${A}?w=400)\n![y](${A}#frag)\n![z](https://other.com/a.jpg2)\n![w](https://evil.other.com/a.jpg)\n![v](xhttps://other.com/a.jpg)`);
    expect(r.count).toBe(0);
  });
  it('when both the short and the long address are in the list, each gets its own file', () => {
    const r = rewriteUrls(`![a](${A})\n![b](${A}?w=400)`, { [A]: '/media/a.webp', [`${A}?w=400`]: '/media/a-2.webp' });
    expect(r.text).toBe('![a](/media/a.webp)\n![b](/media/a-2.webp)');
    expect(r.count).toBe(2);
  });
  it('an address that contains another address (a proxy address) is replaced once, as the longer one', () => {
    const inner = 'https://y.com/p.jpg';
    const outer = `https://cdn.com/fetch/${inner}`;
    const r = rewriteUrls(`![a](${outer})\n![b](${inner})`, { [inner]: '/media/inner.webp', [outer]: '/media/outer.webp' });
    expect(r.text).toBe('![a](/media/outer.webp)\n![b](/media/inner.webp)');
    expect(r.count).toBe(2);
  });
  it('does not touch an address written inside a code block or inline code', () => {
    const text = `\`![x](${A})\`\n\n\`\`\`md\n![y](${A})\n\`\`\`\n\n![z](${A})`;
    const r = rewriteUrls(text, R);
    expect(r.count).toBe(1);
    expect(r.text).toBe(`\`![x](${A})\`\n\n\`\`\`md\n![y](${A})\n\`\`\`\n\n![z](/media/2026/11/a.webp)`);
  });
  it('finds the &amp; form and the // form that findExternal also reads', () => {
    const q = 'https://other.com/a.jpg?x=1&y=2';
    const text = '<img src="https://other.com/a.jpg?x=1&amp;y=2">\n<img src="//other.com/a.jpg?x=1&y=2">\n![z](https://other.com/a.jpg?x=1&y=2)';
    const r = rewriteUrls(text, { [q]: '/media/a.webp' });
    expect(r.text).toBe('<img src="/media/a.webp">\n<img src="/media/a.webp">\n![z](/media/a.webp)');
    expect(r.count).toBe(3);
  });
  it('a // address is not found inside an https:// address of another picture', () => {
    const r = rewriteUrls('![a](https://other.com/a.jpg)', { 'https://other.com/a.jpg': '/media/a.webp' });
    expect(r.text).toBe('![a](/media/a.webp)');
    expect(r.count).toBe(1);
  });
  it('accepts a Map, ignores empty entries, and does not change an empty text', () => {
    expect(rewriteUrls(`![a](${A})`, new Map([[A, '/media/a.webp']])).text).toBe('![a](/media/a.webp)');
    expect(rewriteUrls(`![a](${A})`, { [A]: '', '': '/x' } as any)).toEqual({ text: `![a](${A})`, count: 0 });
    expect(rewriteUrls('', R)).toEqual({ text: '', count: 0 });
    expect(rewriteUrls(undefined as any, R)).toEqual({ text: '', count: 0 });
    expect(rewriteUrls('text', undefined as any)).toEqual({ text: 'text', count: 0 });
  });
});

describe('rewritePost', () => {
  const post = { title: 'T', date: '2026-11-16', image: 'https://other.com/f.jpg', ogImage: '//other.com/og.jpg', body: '![a](https://other.com/a.jpg)\n\ntext' };
  const repl = { 'https://other.com/f.jpg': '/media/2026/11/f.webp', 'https://other.com/og.jpg': '/media/2026/11/og.webp', 'https://other.com/a.jpg': '/media/2026/11/a.webp' };
  it('rewrites the body, image and ogImage and keeps the other fields', () => {
    const r = rewritePost(post, repl);
    expect(r.count).toBe(3);
    expect(r.post).toEqual({ title: 'T', date: '2026-11-16', image: '/media/2026/11/f.webp', ogImage: '/media/2026/11/og.webp', body: '![a](/media/2026/11/a.webp)\n\ntext' });
  });
  it('does not change the input', () => {
    const snap = JSON.stringify(post);
    rewritePost(post, repl);
    expect(JSON.stringify(post)).toBe(snap);
  });
  it('a failed picture stays as it was: only the addresses in the list change', () => {
    const r = rewritePost(post, { 'https://other.com/a.jpg': '/media/2026/11/a.webp' });
    expect(r.post.image).toBe('https://other.com/f.jpg');
    expect(r.post.ogImage).toBe('//other.com/og.jpg');
    expect(r.post.body).toContain('/media/2026/11/a.webp');
    expect(r.count).toBe(1);
  });
  it('a post without body or image fields stays without them', () => {
    expect(rewritePost({ title: 'T' }, repl)).toEqual({ post: { title: 'T' }, count: 0 });
    expect(rewritePost({}, repl).post).toEqual({});
    expect(rewritePost(undefined as any, repl).count).toBe(0);
  });
  it('after the rewrite nothing is left to host (plan, host, rewrite, plan again)', () => {
    const first = planHosting(post, { ownHosts: OWN });
    const map: Record<string, string> = {};
    first.items.forEach((i: any, n: number) => { map[i.url] = `/media/2026/11/p${n}.webp`; });
    const done = rewritePost(post, map).post;
    expect(planHosting(done, { ownHosts: OWN }).items).toEqual([]);
  });
});
