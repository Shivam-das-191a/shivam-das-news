import { describe, it, expect } from 'vitest';
import { relatedPosts, relatedScore, keywords, type RelPost } from '../../src/lib/related';

const now = new Date('2026-11-14T00:00:00Z');
const mk = (id: string, o: Partial<RelPost['data']> = {}, body = ''): RelPost => ({ id, url: `/2026/11/10/blogs/${o.category ?? 'tech'}/${id}/`, body, data: { title: id.replace(/-/g, ' '), category: 'tech', tags: [], focusKeyword: '', date: new Date('2026-11-10T00:00:00Z'), ...o } });

describe('keywords', () => {
  it('drops short and filler words', () => {
    expect(keywords('The new phone is a big hit')).toEqual(['phone', 'big', 'hit']);
  });
});

describe('relatedPosts', () => {
  it('never returns the post itself', () => {
    const a = mk('phone-launch');
    expect(relatedPosts(a, [a], now)).toEqual([]);
  });
  it('shared tags beat the same category', () => {
    const cur = mk('phone-launch', { tags: ['Phones'] });
    const sameCat = mk('chip-news');
    const sameTag = mk('sport-day', { category: 'sports', tags: ['phones'] });
    expect(relatedPosts(cur, [sameCat, sameTag], now).map((p) => p.id)).toEqual(['sport-day', 'chip-news']);
  });
  it('a post with nothing in common is not related, even if it is new', () => {
    const cur = mk('phone-launch', { category: 'tech' });
    const other = mk('cricket-final', { category: 'sports', date: new Date('2026-11-13T23:00:00Z') });
    expect(relatedScore(cur, other, now).relevant).toBe(false);
    expect(relatedPosts(cur, [other], now)).toEqual([]);
  });
  it('keyword overlap alone makes a post related', () => {
    const cur = mk('first', { category: 'tech', focusKeyword: 'solar battery' });
    const other = mk('home-solar-prices', { category: 'money' });
    expect(relatedPosts(cur, [other], now).map((p) => p.id)).toEqual(['home-solar-prices']);
  });
  it('skips posts the body already links to', () => {
    const linked = mk('chip-news');
    const cur = mk('phone-launch', {}, `Read [more](${linked.url}).`);
    expect(relatedPosts(cur, [linked, mk('other-story')], now).map((p) => p.id)).toEqual(['other-story']);
  });
  it('limits the list and prefers newer posts on equal scores', () => {
    const cur = mk('phone-launch');
    const list = ['a-1', 'a-2', 'a-3', 'a-4', 'a-5'].map((id, i) => mk(id, { date: new Date(Date.UTC(2026, 10, 1 + i)) }));
    const got = relatedPosts(cur, list, now, 3).map((p) => p.id);
    expect(got).toEqual(['a-5', 'a-4', 'a-3']);
  });
});
