import { describe, it, expect } from 'vitest';
import { planLinks, readNext, type PlanPost } from '../../src/lib/linking';
import { findOrphans } from '../../src/lib/orphans';

const mk = (id: string, o: { cat?: string; date?: string; tags?: string[]; kw?: string; title?: string; body?: string; html?: string; auto?: boolean } = {}): PlanPost => ({
  id,
  url: `/2026/11/10/blogs/${o.cat ?? 'tech'}/${id}/`,
  body: o.body ?? '',
  rendered: o.html === undefined ? undefined : { html: o.html },
  data: { title: o.title ?? `Story ${id}`, category: o.cat ?? 'tech', tags: o.tags ?? [], focusKeyword: o.kw ?? '', date: new Date(o.date ?? '2026-11-10T00:00:00Z'), autoLinks: o.auto ?? true },
});
const ctx = { tags: [], categories: [], manual: [], now: new Date('2026-11-14T00:00:00Z') };

describe('readNext', () => {
  const a = mk('a', { date: '2026-11-01T00:00:00Z' });
  const b = mk('b', { date: '2026-11-05T00:00:00Z' });
  const c = mk('c', { date: '2026-11-09T00:00:00Z' });
  const other = mk('o', { cat: 'sport', date: '2026-11-04T00:00:00Z' });
  it('is the nearest older story of the same category', () => {
    expect(readNext(c, [a, b, c, other], new Set())?.id).toBe('b');
    expect(readNext(b, [a, b, c, other], new Set())?.id).toBe('a');
  });
  it('falls back to the nearest newer story when nothing is older', () => {
    expect(readNext(a, [a, b, c, other], new Set())?.id).toBe('b');
  });
  it('skips excluded stories, other categories and itself', () => {
    expect(readNext(c, [a, b, c], new Set([b.url]))?.id).toBe('a');
    expect(readNext(other, [a, b, c, other], new Set())).toBeNull();
    expect(readNext(a, [a], new Set())).toBeNull();
  });
});

describe('planLinks', () => {
  it('puts auto links in the text and keeps them out of Related stories and Read next', () => {
    const words = 'Filler words go here. '.repeat(80);
    const target = mk('t', { kw: 'solar power', title: 'Solar power boom', date: '2026-11-08T00:00:00Z' });
    const cur = mk('cur', { html: `<p>Solar power is big. ${words}</p>`, body: `Solar power is big. ${words}`, date: '2026-11-09T00:00:00Z' });
    const p = planLinks(cur, [cur, target], ctx);
    expect(p.html).toContain(`<a href="${target.url}">Solar power</a>`);
    expect(p.autoUsed).toEqual([target.url]);
    expect(p.related.map((x) => x.id)).toEqual([]);
    expect(p.next).toBeNull();
    expect(p.out).toEqual([target.url]);
  });
  it('respects autoLinks: false', () => {
    const target = mk('t', { kw: 'solar power', date: '2026-11-08T00:00:00Z' });
    const html = '<p>Solar power ' + 'word '.repeat(600) + '</p>';
    const cur = mk('cur', { html, body: html, auto: false });
    expect(planLinks(cur, [cur, target], ctx).autoUsed).toEqual([]);
  });
  it('counts a hand-made link, Related and Read next as outgoing links', () => {
    const hand = mk('h');
    const rel = mk('r', { tags: ['x'] });
    const nxt = mk('n', { date: '2026-11-01T00:00:00Z' });
    const cur = mk('cur', { tags: ['x'], body: `See [it](${hand.url}).`, html: `<p>See <a href="${hand.url}">it</a>.</p>` });
    const p = planLinks(cur, [cur, hand, rel, nxt], ctx);
    expect(p.out).toContain(hand.url);
    expect(p.out).toContain(rel.url);
    expect(p.related.some((x) => x.id === 'h')).toBe(false);
  });
  it('works when the rendered text is not available', () => {
    const cur = mk('cur', { body: 'text' });
    expect(planLinks(cur, [cur], ctx).html).toBeUndefined();
  });
});

describe('findOrphans', () => {
  it('lists articles that no other article links to', () => {
    const e = new Map([['/a/', ['/b/']], ['/b/', ['/a/']], ['/c/', ['/a/']]]);
    expect(findOrphans(e)).toEqual(['/c/']);
  });
  it('ignores self links and reports nothing for one article or none', () => {
    expect(findOrphans(new Map([['/a/', ['/a/']]]))).toEqual([]);
    expect(findOrphans(new Map())).toEqual([]);
    expect(findOrphans(new Map([['/a/', ['/a/']], ['/b/', []]]))).toEqual(['/a/', '/b/']);
  });
});
