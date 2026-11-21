import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker code
import * as P from '../../../workers/push/lib.js';

const {
  tokens, stem, cleanKeyword, keywordTokens, keywordIndexTerms, postFields, phraseIn, keywordHit, muteHit, postIndexTokens,
  importance, normalizeLevel, normalizeLimit, dailyCap, isEligible, scoreSubscriber, isValidZone, localMinutes, localDay, inQuietHours,
  threadKey, tagKey, deliveryDecision, hasEmoji, cutText, buildPayload,
} = P;

const NOW = Date.parse('2026-11-14T10:00:00Z'); // 15:30 in Kolkata
const MIN = 60000;

const post = (o: any = {}) => ({
  key: 'https://news.test/2026/11/14/blogs/technology/apple-launches-iphone-17/',
  url: 'https://news.test/2026/11/14/blogs/technology/apple-launches-iphone-17/',
  title: 'Apple launches iPhone 17 with a faster chip',
  description: 'The new phone adds a brighter screen and better battery life.',
  category: 'technology',
  tags: ['Apple', 'Smartphones'],
  focus: 'iPhone 17 launch',
  author: 'shivam-das',
  breaking: false,
  featured: false,
  push: 'auto',
  publishedAt: new Date(NOW - 10 * MIN).toISOString(),
  ...o,
});

const sub = (o: any = {}) => ({
  status: 'active',
  failures: 0,
  paused_until: null,
  level: 'balanced',
  learn_on: false,
  breaking_all: true,
  categories: ['technology'],
  keywords: [],
  muted: [],
  authors: [],
  topCategories: [],
  weights: {},
  ...o,
});

const kw = (s: string) => {
  const r = cleanKeyword(s);
  if (!r.ok) throw new Error(r.error);
  return r.keyword;
};

describe('tokens and light stemming (LOGICS 19)', () => {
  it('lower-cases, removes accents, drops stop words and splits on everything else', () => {
    expect(tokens('The Caf\u00E9 of  Paris, and the OTHER one!')).toEqual(['caf', 'paris', 'other', 'one']);
    expect(tokens('')).toEqual([]);
    expect(tokens(undefined)).toEqual([]);
  });
  it('joins apostrophes: "don\'t" is one word', () => {
    expect(tokens("Don't stop")).toEqual(['dont', 'stop']);
  });
  it('plural, -ing and -ed forms meet on one stem', () => {
    const same = (...w: string[]) => expect(new Set(w.map(stem)).size, w.join(',')).toBe(1);
    same('launch', 'launches', 'launching', 'launched');
    same('iphone', 'iphones');
    same('house', 'houses');
    same('speed', 'speeds');
    same('run', 'running');
    same('stop', 'stopped');
    same('pass', 'passes', 'passed');
    same('game', 'games');
  });
  it('never goes below 3 letters and leaves short words, numbers and words with digits alone', () => {
    expect(stem('bring')).toBe('bring');
    expect(stem('doing')).toBe('doing');
    expect(stem('news')).toBe('news');
    expect(stem('virus')).toBe('virus');
    expect(stem('class')).toBe('class');
    expect(stem('5g')).toBe('5g');
    expect(stem('2026')).toBe('2026');
    expect(stem('a1s')).toBe('a1s');
    for (const w of ['bees', 'seed', 'ties', 'used', 'goes']) expect(stem(w).length, w).toBeGreaterThanOrEqual(3);
  });
});

describe('cleanKeyword (page and Worker use the same one)', () => {
  it('returns the stored form and the tokens', () => {
    expect(cleanKeyword('iPhone')).toEqual({ ok: true, keyword: 'iphon', tokens: ['iphon'] });
    expect(cleanKeyword('  Bank   of England ')).toEqual({ ok: true, keyword: 'bank england', tokens: ['bank', 'england'] });
    expect(cleanKeyword('covid-19')).toEqual({ ok: true, keyword: 'covid 19', tokens: ['covid', '19'] });
    expect(cleanKeyword("Don't Stop")).toMatchObject({ ok: true, keyword: 'dont stop' });
  });
  it('lets short forms through only in capital letters (UN, EU, 5G, IT, US)', () => {
    expect(cleanKeyword('UN').ok).toBe(true);
    expect(cleanKeyword('EU summit')).toMatchObject({ ok: true, keyword: 'eu summit' });
    expect(cleanKeyword('5G')).toMatchObject({ ok: true, keyword: '5g' });
    expect(cleanKeyword('IT')).toMatchObject({ ok: true, keyword: 'it' });
    expect(cleanKeyword('US')).toMatchObject({ ok: true, keyword: 'us' });
    for (const bad of ['un', 'eu', '5g', 'ab']) expect(cleanKeyword(bad).ok, bad).toBe(false);
  });
  it('lets a number stand next to a word (iPhone 17, F-35) but not alone', () => {
    expect(cleanKeyword('iPhone 17')).toMatchObject({ ok: true, keyword: 'iphon 17' });
    expect(cleanKeyword('F-35')).toMatchObject({ ok: true, keyword: 'f 35' });
    expect(cleanKeyword('2026')).toEqual({ ok: false, error: 'Please add a word to the number.' });
    expect(cleanKeyword('17 5').ok).toBe(false);
  });
  it('refuses empty text, only stop words, too many words and too long text', () => {
    for (const bad of ['', '   ', 'the of and', 'one two three four five', 'a'.repeat(41)]) expect(cleanKeyword(bad).ok, bad).toBe(false);
    expect(cleanKeyword(5 as any).ok).toBe(false);
    expect(cleanKeyword(null as any).ok).toBe(false);
    expect(cleanKeyword('a'.repeat(40) as string).ok).toBe(true);
  });
  it('refuses a script, markup, other alphabets and symbols (BUGS P8)', () => {
    for (const bad of ['<script>alert(1)</script>', 'a; drop table', 'caf\u00E9', 'Hello \u{1F600}', 'ক্রিকেট', 'x=1', 'a_b', 'name@site.com']) {
      const r = cleanKeyword(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error, bad).toMatch(/English letters|short|specific/);
    }
  });
  it('refuses words that are too common to follow, but not when one real word comes with them', () => {
    for (const bad of ['news', 'Today', 'india', 'latest news', 'World News Today']) expect(cleanKeyword(bad).ok, bad).toBe(false);
    expect(cleanKeyword('india budget').ok).toBe(true);
    expect(cleanKeyword('news about cricket').ok).toBe(true);
  });
  it('the message is plain text for the person', () => {
    const r = cleanKeyword('news');
    expect(r.error).toBe('This word is too common to follow. Please try a more specific one.');
  });
  it('keywordTokens reads the stored form back without stemming twice', () => {
    for (const k of ['iPhone', 'launches', 'business', 'speeds', 'Bank of England', 'covid-19', 'EU summit']) {
      const r = cleanKeyword(k);
      expect(keywordTokens(r.keyword)).toEqual(r.tokens);
    }
    expect(keywordTokens('')).toEqual([]);
  });
});

describe('keyword match strength (PLAN 31.6)', () => {
  const f = postFields(post({ bodyStart: undefined, body: 'Rumours say the company will also show a folding tablet later this year.' }));
  const hit = (s: string) => keywordHit(keywordTokens(kw(s)), f);
  it('whole phrase in the title is 1', () => expect(hit('iPhone 17')).toBe(1));
  it('in the focus keyword or the tags is 0.9', () => {
    expect(hit('iPhone 17 launch')).toBe(0.9); // the words are not together in the title, but they are the focus keyword
    expect(hit('Smartphones')).toBe(0.9);
    const g = postFields(post({ title: 'Quarterly results', description: '', focus: 'chip shortage' }));
    expect(keywordHit(keywordTokens(kw('chip shortage')), g)).toBe(0.9);
  });
  it('in the description is 0.6', () => expect(hit('brighter screen')).toBe(0.6));
  it('every word somewhere in title, tags and description but not together is 0.5', () => expect(hit('battery chip')).toBe(0.5));
  it('only in the first 300 words of the text is 0.35', () => {
    expect(hit('folding tablet')).toBe(0.35);
    const long = Array.from({ length: 300 }, () => 'filler').join(' ') + ' tablet';
    expect(keywordHit(['tablet'], postFields(post({ body: long })))).toBe(0);
  });
  it('is 0 when nothing matches and for an empty phrase', () => {
    expect(hit('cricket')).toBe(0);
    expect(keywordHit([], f)).toBe(0);
  });
  it('a phrase must stay in order: "chip faster" is not "faster chip"', () => {
    expect(hit('faster chip')).toBe(1);
    expect(hit('chip faster')).toBe(0.5);
  });
  it('phraseIn needs the tokens next to each other', () => {
    expect(phraseIn(['a', 'b'], ['x', 'a', 'b', 'y'])).toBe(true);
    expect(phraseIn(['a', 'b'], ['a', 'x', 'b'])).toBe(false);
    expect(phraseIn([], ['a'])).toBe(false);
    expect(phraseIn(['a', 'b'], ['a'])).toBe(false);
  });
  it('a muted word counts only in the title, focus keyword or tags', () => {
    expect(muteHit(['iphon'], f)).toBe(1);
    expect(muteHit(['smartphon'], f)).toBe(0.9);
    expect(muteHit(['screen'], f)).toBe(0); // only in the description
  });
});

describe('the keyword index finds a reader through a stemmed word', () => {
  it('"launches" in a post finds a reader who follows "launch"', () => {
    const terms = keywordIndexTerms(kw('launch'));
    const fromPost = postIndexTokens(post({ title: 'Apple launches a new phone', focus: '', tags: [], description: '' }));
    expect(terms.some((t: string) => fromPost.includes(t))).toBe(true);
    expect(postIndexTokens(post({ title: 'Apple launched a new phone', focus: '', tags: [], description: '' }))).toContain(terms[0]);
  });
  it('each word of a phrase is a row, once', () => {
    expect(keywordIndexTerms('bank england bank')).toEqual(['bank', 'england']);
  });
  it('the index words come from the title, tags, focus keyword and description only', () => {
    const t = postIndexTokens(post({ body: 'secretword', bodyStart: 'secretword' }));
    expect(t).toContain('iphon');
    expect(t).toContain('smartphon');
    expect(t).toContain('battery');
    expect(t).not.toContain('secretword');
  });
});

describe('levels, limits and daily caps', () => {
  it('level names and limits fall back to safe defaults', () => {
    expect(normalizeLevel('important')).toBe('important');
    expect(normalizeLevel('nonsense')).toBe('balanced');
    expect(normalizeLevel(undefined)).toBe('balanced');
    expect(normalizeLimit('balanced', undefined)).toBe(4);
    expect(normalizeLimit('important', undefined)).toBe(2);
    expect(normalizeLimit('everything', undefined)).toBe(8);
    expect(normalizeLimit('breaking_only', undefined)).toBe(2);
    expect(normalizeLimit('balanced', 1)).toBe(1);
    expect(normalizeLimit('balanced', '8')).toBe(8);
    expect(normalizeLimit('balanced', 3)).toBe(4);
    expect(normalizeLimit('balanced', 100)).toBe(4);
  });
  it('breaking news gets 2 extra slots and a score of 90 or more gets 1', () => {
    expect(dailyCap(4, false, 50)).toBe(4);
    expect(dailyCap(4, true, 50)).toBe(6);
    expect(dailyCap(4, false, 90)).toBe(5);
    expect(dailyCap(4, true, 95)).toBe(7);
    expect(dailyCap(4, false, 89.99)).toBe(4);
  });
  it('importance: breaking 25, force 25, featured 12, trending 10, else 0 (highest counts)', () => {
    expect(importance({})).toBe(0);
    expect(importance({ breaking: true })).toBe(25);
    expect(importance({ push: 'force' })).toBe(25);
    expect(importance({ featured: true })).toBe(12);
    expect(importance({ trending: true })).toBe(10);
    expect(importance({ featured: true, trending: true })).toBe(12);
    expect(importance({ breaking: true, featured: true })).toBe(25);
    expect(importance(null)).toBe(0);
  });
  it('who may receive: active, not paused, fewer than 5 failures', () => {
    expect(isEligible(sub(), NOW)).toBe(true);
    expect(isEligible(sub({ status: 'paused' }), NOW)).toBe(false);
    expect(isEligible(sub({ status: 'gone' }), NOW)).toBe(false);
    expect(isEligible(sub({ failures: 5 }), NOW)).toBe(false);
    expect(isEligible(sub({ failures: 4 }), NOW)).toBe(true);
    expect(isEligible(sub({ paused_until: NOW + MIN }), NOW)).toBe(false);
    expect(isEligible(sub({ paused_until: NOW - MIN }), NOW)).toBe(true);
    expect(isEligible(null, NOW)).toBe(false);
  });
});

describe('scoreSubscriber (LOGICS 19, step 3)', () => {
  const ctx = (o: any = {}) => ({ now: NOW, recent: [], ...o });

  it('a category match on a fresh post reaches the Balanced line', () => {
    const r = scoreSubscriber(sub(), post(), ctx());
    expect(r.send).toBe(false); // 60 * 0.6 = 36 + 7 * 0.92 = 42.4, below 48
    expect(r.reason).toBe('below_level');
    const e = scoreSubscriber(sub({ level: 'everything' }), post(), ctx());
    expect(e.send).toBe(true);
    expect(e.score).toBeCloseTo(36 + 7 * (1 - 10 / 120), 1);
  });
  it('category and keyword together pass Balanced and Important', () => {
    const s = sub({ keywords: [kw('iPhone 17')] });
    const r = scoreSubscriber(s, post(), ctx());
    // explicit = min(1, 0.6 + 0.8) = 1; 60 + 7 * (1 - 10/120)
    expect(r.send).toBe(true);
    expect(r.score).toBeCloseTo(60 + 7 * (1 - 10 / 120), 1);
    expect(r.parts.explicit).toBe(1);
  });
  it('the Important line is 65 and the Everything line is 30', () => {
    const s = sub({ level: 'important', keywords: [kw('iPhone 17')] });
    const r = scoreSubscriber(s, post(), ctx());
    expect(r.score).toBeGreaterThan(65);
    expect(r.send).toBe(true);
    const late = scoreSubscriber(s, post({ publishedAt: new Date(NOW - 119 * MIN).toISOString() }), ctx());
    expect(late.score).toBeLessThan(65); // freshness is nearly 0: 60.58
    expect(late.send).toBe(false);
    const weak = sub({ level: 'everything', categories: [], keywords: [kw('brighter screen')] }); // description hit 0.6: explicit 0.48
    expect(scoreSubscriber(weak, post(), ctx()).score).toBeCloseTo(60 * 0.48 + 7 * (1 - 10 / 120), 1); // 35.2: sent
    const old = post({ publishedAt: new Date(NOW - 119 * MIN).toISOString() });
    const w = scoreSubscriber(weak, old, ctx());
    expect(w.score).toBeCloseTo(28.86, 1);
    expect(w.send).toBe(false); // below 30
    expect(scoreSubscriber(weak, { ...old, featured: true }, ctx()).send).toBe(true); // +12
  });
  it('a muted word blocks the post, even a breaking post, for that reader', () => {
    const s = sub({ muted: [kw('iPhone')], level: 'everything' });
    expect(scoreSubscriber(s, post(), ctx())).toEqual({ send: false, reason: 'muted' });
    expect(scoreSubscriber(s, post({ breaking: true }), ctx())).toEqual({ send: false, reason: 'muted' });
    expect(scoreSubscriber(sub({ muted: [kw('Smartphones')] }), post({ breaking: true }), ctx()).reason).toBe('muted'); // a tag
    expect(scoreSubscriber(sub({ muted: [kw('iPhone 17 launch')] }), post({ breaking: true }), ctx()).reason).toBe('muted'); // the focus keyword
  });
  it('a muted word that is only in the description does not block', () => {
    const s = sub({ muted: [kw('brighter screen')], level: 'everything' });
    expect(scoreSubscriber(s, post(), ctx()).send).toBe(true);
  });
  it('without a category, keyword or author match nothing is sent (the gate)', () => {
    const s = sub({ categories: ['sports'], level: 'everything', breaking_all: false });
    expect(scoreSubscriber(s, post(), ctx())).toEqual({ send: false, reason: 'no_match' });
    expect(scoreSubscriber(s, post({ breaking: true, featured: true }), ctx())).toEqual({ send: false, reason: 'no_match' });
    expect(scoreSubscriber(sub({ categories: [], level: 'everything' }), post({ featured: true, trending: true }), ctx()).reason).toBe('no_match');
  });
  it('breaking news for "any category" readers is the only way past the gate, and no number holds it back', () => {
    const s = sub({ categories: ['sports'], level: 'balanced', breaking_all: true });
    expect(scoreSubscriber(s, post(), ctx()).reason).toBe('no_match'); // not breaking
    const r = scoreSubscriber(s, post({ breaking: true }), ctx());
    expect(r.send).toBe(true);
    expect(r.score).toBeLessThan(48); // 25 + 7 * 0.92: lower than the Balanced line, still sent
    expect(r.parts.breakingAny).toBe(true);
    expect(scoreSubscriber(sub({ categories: ['sports'], level: 'important', breaking_all: true }), post({ breaking: true }), ctx()).send).toBe(true);
    expect(scoreSubscriber(sub({ categories: ['sports'], breaking_all: false }), post({ breaking: true }), ctx()).reason).toBe('no_match');
  });
  it('Breaking only: the post must be breaking, whatever the score', () => {
    const s = sub({ level: 'breaking_only', keywords: [kw('iPhone 17')] });
    expect(scoreSubscriber(s, post(), ctx())).toEqual({ send: false, reason: 'level_breaking' });
    expect(scoreSubscriber(s, post({ breaking: true }), ctx()).send).toBe(true);
  });
  it('keywords: two more matching keywords add up to 0.30, and the sum stops at 1', () => {
    const one = scoreSubscriber(sub({ categories: [], level: 'everything', keywords: [kw('brighter screen')] }), post(), ctx());
    const two = scoreSubscriber(sub({ categories: [], level: 'everything', keywords: [kw('brighter screen'), kw('battery life')] }), post(), ctx());
    expect(two.parts.explicit).toBeCloseTo(0.8 * (0.6 + 0.15), 5);
    expect(two.parts.explicit).toBeGreaterThan(one.parts.explicit);
    const many = scoreSubscriber(
      sub({ categories: [], level: 'everything', keywords: [kw('iPhone 17'), kw('brighter screen'), kw('battery life'), kw('faster chip'), kw('smartphones')] }),
      post(),
      ctx(),
    );
    expect(many.parts.explicit).toBeCloseTo(0.8, 5); // the keyword part is capped at 1, and 0.8 of it counts (no category here)
    const withCategory = scoreSubscriber(sub({ level: 'everything', keywords: [kw('iPhone 17'), kw('brighter screen')] }), post(), ctx());
    expect(withCategory.parts.explicit).toBe(1); // 0.6 + 0.8 is capped at 1
  });
  it('an author the reader follows is a match on its own', () => {
    const s = sub({ categories: [], authors: ['Shivam-Das'], level: 'everything' });
    const r = scoreSubscriber(s, post(), ctx());
    expect(r.send).toBe(true);
    expect(r.parts.explicit).toBeCloseTo(0.4, 5);
  });
  it('reading habit counts only when "learn" is on: first 1.0, second 0.6, third 0.3', () => {
    const base = { level: 'everything', topCategories: ['sports', 'technology', 'world'] };
    const off = scoreSubscriber(sub({ ...base, learn_on: false }), post(), ctx());
    const on = scoreSubscriber(sub({ ...base, learn_on: true }), post(), ctx());
    expect(off.parts.implicit).toBe(0);
    expect(on.parts.implicit).toBe(0.6);
    expect(on.score - off.score).toBeCloseTo(8 * 0.6, 1);
    expect(scoreSubscriber(sub({ level: 'everything', learn_on: true, topCategories: ['technology'] }), post(), ctx()).parts.implicit).toBe(1);
    expect(scoreSubscriber(sub({ level: 'everything', learn_on: true, topCategories: ['a', 'b', 'c', 'technology'] }), post(), ctx()).parts.implicit).toBe(0);
  });
  it('the learned weight moves the score by up to 10 points and is limited to -1 and 1', () => {
    const at = (w: number) => scoreSubscriber(sub({ level: 'everything', weights: { technology: w } }), post(), ctx()).score;
    expect(at(1) - at(0)).toBeCloseTo(10, 1);
    expect(at(-1) - at(0)).toBeCloseTo(-10, 1);
    expect(at(5)).toBe(at(1));
    expect(at(-5)).toBe(at(-1));
  });
  it('freshness falls from 1 to 0 over 120 minutes', () => {
    const at = (m: number) => scoreSubscriber(sub({ level: 'everything' }), post({ publishedAt: new Date(NOW - m * MIN).toISOString() }), ctx());
    expect(at(0).parts.fresh).toBe(1);
    expect(at(60).parts.fresh).toBe(0.5);
    expect(at(120).parts.fresh).toBe(0);
    expect(at(500).parts.fresh).toBe(0);
    expect(scoreSubscriber(sub({ level: 'everything' }), post({ publishedAt: new Date(NOW + 5 * MIN).toISOString() }), ctx()).parts.fresh).toBe(1); // a clock a little ahead
  });
  it('fatigue: 5 points for each notification in the last 3 hours (at most 20) and 10 for the same category in the last hour', () => {
    const s = sub({ level: 'everything' });
    const base = scoreSubscriber(s, post(), ctx()).score;
    const rec = (mins: number, category = 'sports') => ({ ts: NOW - mins * MIN, category });
    const two = scoreSubscriber(s, post(), ctx({ recent: [rec(30), rec(100)] }));
    expect(two.parts.fatigue).toBe(10);
    expect(base - two.score).toBeCloseTo(10, 1);
    expect(scoreSubscriber(s, post(), ctx({ recent: [rec(10, 'technology')] })).parts.fatigue).toBe(15);
    expect(scoreSubscriber(s, post(), ctx({ recent: [rec(90, 'technology')] })).parts.fatigue).toBe(5); // same category but older than an hour
    expect(scoreSubscriber(s, post(), ctx({ recent: [rec(200)] })).parts.fatigue).toBe(0); // older than 3 hours
    expect(scoreSubscriber(s, post(), ctx({ recent: [rec(1), rec(2), rec(3), rec(4), rec(5), rec(6)] })).parts.fatigue).toBe(20);
    expect(scoreSubscriber(s, post(), ctx({ recent: [rec(1, 'technology'), rec(2), rec(3), rec(4), rec(5)] })).parts.fatigue).toBe(30); // LOGICS: 20 + 10
  });
  it('the score stays between 0 and 100', () => {
    const top = scoreSubscriber(sub({ level: 'everything', learn_on: true, topCategories: ['technology'], weights: { technology: 1 }, keywords: [kw('iPhone 17')], authors: ['shivam-das'] }), post({ breaking: true }), ctx());
    expect(top.score).toBe(100);
    const low = scoreSubscriber(sub({ level: 'everything', weights: { technology: -1 } }), post({ publishedAt: new Date(NOW - 119 * MIN).toISOString() }), ctx({ recent: [1, 2, 3, 4].map((m) => ({ ts: NOW - m * MIN, category: m === 1 ? 'technology' : 'x' })) }));
    expect(low.score).toBe(0);
  });
  it('a reader who cannot receive, or a time that cannot be read, gets nothing (when unsure, do not send)', () => {
    expect(scoreSubscriber(sub({ status: 'paused' }), post(), ctx()).reason).toBe('not_eligible');
    expect(scoreSubscriber(sub(), post({ publishedAt: 'not a date' }), ctx()).reason).toBe('bad_time');
    expect(scoreSubscriber(sub(), post({ publishedAt: undefined }), ctx()).reason).toBe('bad_time');
    expect(scoreSubscriber(sub(), post(), { now: NaN, recent: [] }).reason).toBe('bad_time');
  });
  it('categories and authors match without regard to case; a post with no category matches nothing', () => {
    expect(scoreSubscriber(sub({ level: 'everything', categories: ['Technology'] }), post({ category: 'TECHNOLOGY' }), ctx()).send).toBe(true);
    expect(scoreSubscriber(sub({ level: 'everything', categories: [''] }), post({ category: '' }), ctx()).reason).toBe('no_match');
  });
  it('accepts a time as a number, a Date or a text', () => {
    for (const t of [NOW - 10 * MIN, new Date(NOW - 10 * MIN), new Date(NOW - 10 * MIN).toISOString()]) expect(scoreSubscriber(sub({ level: 'everything' }), post({ publishedAt: t }), ctx()).send).toBe(true);
  });
});

describe('time zones and quiet hours (BUGS P6)', () => {
  const at = (iso: string) => Date.parse(iso);
  it('accepts zone names and refuses offsets and rubbish', () => {
    for (const z of ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'America/Argentina/Buenos_Aires', 'UTC', 'Etc/GMT+5']) expect(isValidZone(z), z).toBe(true);
    for (const z of ['+05:30', '-0500', 'GMT+5', '', 'Nowhere/Land', 'Asia/', 'a'.repeat(80), null, 5, '../etc', 'Asia/Kolkata;x']) expect(isValidZone(z as any), String(z)).toBe(false);
  });
  it('reads the local time in the reader\'s own zone', () => {
    expect(localMinutes(at('2026-11-14T10:00:00Z'), 'Asia/Kolkata')).toBe(15 * 60 + 30);
    expect(localMinutes(at('2026-11-14T10:00:00Z'), 'UTC')).toBe(600);
    expect(localMinutes(at('2026-11-14T00:00:00Z'), 'UTC')).toBe(0); // midnight is 0, not 1440
    expect(localDay(at('2026-11-14T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-11-15');
    expect(localDay(at('2026-11-14T20:00:00Z'), 'America/New_York')).toBe('2026-11-14');
  });
  it('quiet hours across midnight (22:00 to 07:00)', () => {
    const q = (iso: string) => inQuietHours(at(iso), 'Asia/Kolkata', 22 * 60, 7 * 60);
    expect(q('2026-11-14T16:29:00Z')).toBe(false); // 21:59
    expect(q('2026-11-14T16:30:00Z')).toBe(true); // 22:00
    expect(q('2026-11-14T18:30:00Z')).toBe(true); // 00:00
    expect(q('2026-11-15T01:29:00Z')).toBe(true); // 06:59
    expect(q('2026-11-15T01:30:00Z')).toBe(false); // 07:00
    expect(q('2026-11-14T10:00:00Z')).toBe(false); // 15:30
  });
  it('quiet hours inside one day (13:00 to 14:30)', () => {
    const q = (iso: string) => inQuietHours(at(iso), 'UTC', 13 * 60, 14 * 60 + 30);
    expect(q('2026-11-14T12:59:00Z')).toBe(false);
    expect(q('2026-11-14T13:00:00Z')).toBe(true);
    expect(q('2026-11-14T14:29:00Z')).toBe(true);
    expect(q('2026-11-14T14:30:00Z')).toBe(false);
  });
  it('is right across a daylight saving change (a fixed offset would be wrong)', () => {
    // New York, clocks go forward on 2026-03-08 at 02:00 (07:00 UTC). 11:30 UTC is 07:30 EDT: outside 22:00 to 07:00.
    expect(inQuietHours(at('2026-03-08T11:30:00Z'), 'America/New_York', 22 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(at('2026-03-08T11:30:00Z'), 'Etc/GMT+5', 22 * 60, 7 * 60)).toBe(true); // the same instant with a fixed UTC-5 offset: 06:30
    // The day before the change (EST, UTC-5): 11:30 UTC is 06:30, inside.
    expect(inQuietHours(at('2026-03-07T11:30:00Z'), 'America/New_York', 22 * 60, 7 * 60)).toBe(true);
    // London, clocks go back on 2026-10-25 at 02:00 BST (01:00 UTC). 22:30 UTC on the 24th is 23:30 BST: inside; 06:30 UTC on the 25th is 06:30 GMT: inside; 07:00 UTC is 07:00 GMT: outside.
    expect(inQuietHours(at('2026-10-24T22:30:00Z'), 'Europe/London', 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(at('2026-10-25T06:30:00Z'), 'Europe/London', 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(at('2026-10-25T07:00:00Z'), 'Europe/London', 22 * 60, 7 * 60)).toBe(false);
    // 06:30 UTC on the 24th is 07:30 BST: outside (it would be inside with a fixed GMT offset).
    expect(inQuietHours(at('2026-10-24T06:30:00Z'), 'Europe/London', 22 * 60, 7 * 60)).toBe(false);
  });
  it('no quiet hours for null, a bad number, equal start and end, or a bad zone', () => {
    const t = at('2026-11-14T18:30:00Z'); // 00:00 in Kolkata
    expect(inQuietHours(t, 'Asia/Kolkata', null, null)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', 22 * 60, null)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', 1440, 60)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', -1, 60)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', 12.5, 60)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', 600, 600)).toBe(false);
    expect(inQuietHours(t, '+05:30', 22 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(t, 'Asia/Kolkata', 22 * 60, 7 * 60)).toBe(true);
  });
});

describe('story thread key', () => {
  it('uses the focus keyword, in its stemmed form, so small spelling changes meet', () => {
    expect(threadKey(post())).toBe('iphon-17-launch');
    expect(threadKey(post({ focus: 'iPhone 17 launches' }))).toBe('iphon-17-launch');
    expect(threadKey(post({ focus: '  The  iPhone-17 Launch ' }))).toBe('iphon-17-launch');
  });
  it('without a focus keyword it uses two tags: the most common ones when counts are given, else alphabetical', () => {
    const p = post({ focus: '', tags: ['Zebra', 'Apple', 'Mango'] });
    expect(threadKey(p)).toBe('appl+mango');
    expect(threadKey(p, { [tagKey('Zebra')]: 9, [tagKey('Mango')]: 5 })).toBe('zebra+mango');
    expect(threadKey(post({ focus: '', tags: ['Apple', 'apple', 'Mango'] }))).toBe('appl+mango');
  });
  it('a post with no focus and fewer than two tags gets its own key, so it never merges', () => {
    const a = threadKey(post({ focus: '', tags: ['One'], key: 'https://news.test/a/' }));
    const b = threadKey(post({ focus: '', tags: ['One'], key: 'https://news.test/b/' }));
    expect(a).not.toBe(b);
    expect(a.startsWith('post:')).toBe(true);
  });
  it('is never longer than 60 characters', () => {
    expect(threadKey(post({ focus: 'word '.repeat(60) })).length).toBeLessThanOrEqual(60);
    expect(threadKey(post({ focus: '', tags: ['x'.repeat(50), 'y'.repeat(50)] })).length).toBeLessThanOrEqual(60);
    expect(threadKey(post({ focus: '', tags: [], key: 'k'.repeat(200) })).length).toBeLessThanOrEqual(60);
  });
});

describe('deliveryDecision (LOGICS 19, step 4)', () => {
  const rs = (o: any = {}) => ({
    tz: 'Asia/Kolkata',
    quiet_start: 22 * 60,
    quiet_end: 7 * 60,
    breaking_in_quiet: 0,
    daily_limit: 4,
    level: 'balanced',
    sent_today: 0,
    sent_day: '2026-11-14',
    last_sent: null,
    digest_mode: 'off',
    ...o,
  });
  const ctx = (o: any = {}) => ({ now: NOW, recent: [], ...o });

  it('a normal case is queued with the normal time to live and urgency', () => {
    expect(deliveryDecision(rs(), post(), 70, ctx())).toEqual({ action: 'queue', update: false, thread: 'iphon-17-launch', ttl: 21600, urgency: 'normal', renotify: false });
  });
  it('breaking news is queued with 2 hours, high urgency and renotify', () => {
    expect(deliveryDecision(rs(), post({ breaking: true }), 70, ctx())).toEqual({ action: 'queue', update: false, thread: 'iphon-17-launch', ttl: 7200, urgency: 'high', renotify: true });
  });
  it('the daily limit: at the limit a normal post is dropped', () => {
    expect(deliveryDecision(rs({ sent_today: 3 }), post(), 70, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 4 }), post(), 70, ctx())).toEqual({ action: 'skip', reason: 'limit' });
  });
  it('breaking news may use 2 extra slots, a score of 90 or more 1 extra, both 3', () => {
    expect(deliveryDecision(rs({ sent_today: 5 }), post({ breaking: true }), 70, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 6 }), post({ breaking: true }), 70, ctx()).action).toBe('skip');
    expect(deliveryDecision(rs({ sent_today: 4 }), post(), 90, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 5 }), post(), 90, ctx()).action).toBe('skip');
    expect(deliveryDecision(rs({ sent_today: 6 }), post({ breaking: true }), 95, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 7 }), post({ breaking: true }), 95, ctx()).action).toBe('skip');
  });
  it('the counter belongs to one local day: a new local day starts again at 0', () => {
    expect(deliveryDecision(rs({ sent_today: 4, sent_day: '2026-11-13' }), post(), 70, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 4, sent_day: null }), post(), 70, ctx()).action).toBe('queue');
    // 20:00 UTC is already the next day in Kolkata: the day "2026-11-14" is over there
    expect(deliveryDecision(rs({ sent_today: 4, sent_day: '2026-11-14', quiet_start: null, quiet_end: null }), post(), 70, ctx({ now: Date.parse('2026-11-14T20:00:00Z') })).action).toBe('queue');
    expect(deliveryDecision(rs({ sent_today: 4, sent_day: '2026-11-15', quiet_start: null, quiet_end: null }), post(), 70, ctx({ now: Date.parse('2026-11-14T20:00:00Z') })).action).toBe('skip');
  });
  it('an odd daily limit falls back to the level default', () => {
    expect(deliveryDecision(rs({ daily_limit: 3, sent_today: 4 }), post(), 70, ctx()).action).toBe('skip');
    expect(deliveryDecision(rs({ daily_limit: 3, sent_today: 3 }), post(), 70, ctx()).action).toBe('queue');
  });
  it('minimum gap of 30 minutes: held; breaking is exempt', () => {
    const last = (m: number) => NOW - m * MIN;
    expect(deliveryDecision(rs({ last_sent: last(29) }), post(), 70, ctx())).toEqual({ action: 'hold', reason: 'gap', max: 5, hours: 6 });
    expect(deliveryDecision(rs({ last_sent: last(30) }), post(), 70, ctx()).action).toBe('queue');
    expect(deliveryDecision(rs({ last_sent: last(1) }), post({ breaking: true }), 70, ctx()).action).toBe('queue');
  });
  it('quiet hours: a normal post is held, breaking is held unless the reader allowed it', () => {
    const night = ctx({ now: Date.parse('2026-11-14T18:30:00Z') }); // 00:00 in Kolkata
    expect(deliveryDecision(rs(), post(), 70, night)).toEqual({ action: 'hold', reason: 'quiet', max: 5, hours: 6 });
    expect(deliveryDecision(rs(), post({ breaking: true }), 70, night).action).toBe('hold');
    expect(deliveryDecision(rs({ breaking_in_quiet: 1 }), post({ breaking: true }), 70, night).action).toBe('queue');
    expect(deliveryDecision(rs({ breaking_in_quiet: 1 }), post(), 70, night).action).toBe('hold'); // only breaking news may pass
    expect(deliveryDecision(rs({ quiet_start: null, quiet_end: null }), post(), 70, night).action).toBe('queue');
  });
  it('digest readers get a normal post held for the digest, but breaking news now', () => {
    expect(deliveryDecision(rs({ digest_mode: 'morning' }), post(), 70, ctx())).toEqual({ action: 'hold', reason: 'digest', max: 5, hours: 6 });
    expect(deliveryDecision(rs({ digest_mode: 'both' }), post({ breaking: true }), 70, ctx()).action).toBe('queue');
  });
  it('a story update replaces the old notification and uses no daily slot, no gap and no digest hold', () => {
    const recent = [{ ts: NOW - 5 * MIN, thread: 'iphon-17-launch' }];
    const d = deliveryDecision(rs({ sent_today: 4, last_sent: NOW - 5 * MIN, digest_mode: 'morning' }), post(), 70, ctx({ recent }));
    expect(d).toMatchObject({ action: 'queue', update: true, thread: 'iphon-17-launch' });
  });
  it('a story update is still held in quiet hours', () => {
    const recent = [{ ts: Date.parse('2026-11-14T16:00:00Z'), thread: 'iphon-17-launch' }];
    expect(deliveryDecision(rs(), post(), 70, ctx({ now: Date.parse('2026-11-14T18:30:00Z'), recent })).action).toBe('hold');
  });
  it('the same story only counts as an update for 12 hours, and another story is a new notification', () => {
    expect(deliveryDecision(rs(), post(), 70, ctx({ recent: [{ ts: NOW - 11 * 60 * MIN, thread: 'iphon-17-launch' }] })).update).toBe(true);
    expect(deliveryDecision(rs(), post(), 70, ctx({ recent: [{ ts: NOW - 12 * 60 * MIN, thread: 'iphon-17-launch' }] })).update).toBe(false);
    expect(deliveryDecision(rs(), post(), 70, ctx({ recent: [{ ts: NOW - 5 * MIN, thread: 'other-story' }] })).update).toBe(false);
  });
  it('a reader whose zone is wrong gets no quiet hours and a fresh counter, but never a crash', () => {
    expect(deliveryDecision(rs({ tz: '+05:30', sent_today: 9 }), post(), 70, ctx()).action).toBe('queue');
  });
});

describe('the notification text (PLAN 31.9)', () => {
  it('cuts at a word boundary inside the limit, with an ellipsis', () => {
    const t = cutText('The quick brown fox jumps over the lazy dog while the band plays on and on and on', 40);
    expect([...t].length).toBeLessThanOrEqual(40);
    expect(t.endsWith('\u2026')).toBe(true);
    expect(t).toBe('The quick brown fox jumps over the lazy\u2026');
    expect(cutText('Short text', 40)).toBe('Short text');
    expect(cutText('  spaced \n  out  ', 40)).toBe('spaced out');
    expect(cutText('', 10)).toBe('');
    expect([...cutText('x'.repeat(200), 70)].length).toBe(70);
  });
  it('builds the payload from the post: link with ?pn=1, story tag, breaking flags', () => {
    const r = buildPayload(post({ breaking: true }));
    expect(r.ok).toBe(true);
    expect(r.payload).toEqual({
      v: 1,
      title: 'Apple launches iPhone 17 with a faster chip',
      body: 'The new phone adds a brighter screen and better battery life.',
      url: 'https://news.test/2026/11/14/blogs/technology/apple-launches-iphone-17/?pn=1',
      tag: 'iphon-17-launch',
      breaking: true,
      renotify: true,
    });
    expect(JSON.parse(r.json)).toEqual(r.payload);
    expect(r.bytes).toBe(new TextEncoder().encode(r.json).length);
  });
  it('keeps other query parameters, sets pn once, and drops nothing else', () => {
    expect(buildPayload(post({ url: 'https://news.test/a/?x=1&pn=0' })).payload.url).toBe('https://news.test/a/?x=1&pn=1');
  });
  it('a thread given by the caller is the tag', () => {
    expect(buildPayload(post(), { thread: 'my-thread' }).payload.tag).toBe('my-thread');
  });
  it('pushTitle and pushBody replace the headline and the description', () => {
    const r = buildPayload(post({ pushTitle: 'Short title', pushBody: 'Short body' }));
    expect(r.payload).toMatchObject({ title: 'Short title', body: 'Short body' });
  });
  it('the title is cut to 70 and the body to 120 characters', () => {
    const r = buildPayload(post({ title: 'word '.repeat(40), description: 'text '.repeat(60) }));
    expect([...r.payload.title].length).toBeLessThanOrEqual(70);
    expect([...r.payload.body].length).toBeLessThanOrEqual(120);
    expect(r.payload.title.endsWith('\u2026')).toBe(true);
  });
  it('the longest allowed text, even in 4-byte characters, stays under 4,000 bytes', () => {
    const wide = '\u{20000}'; // a 4-byte character (not an emoji)
    const r = buildPayload(post({ title: wide.repeat(500), description: wide.repeat(500), url: 'https://news.test/' + 'a'.repeat(900) }));
    expect(r.ok).toBe(true);
    expect(r.bytes).toBeLessThan(4000);
    const plain = buildPayload(post({ title: 'a'.repeat(500), description: 'b'.repeat(500) }));
    expect(plain.bytes).toBeLessThan(4000);
  });
  it('the text shrinks when the link and the image are very long, and fails when nothing is left to shrink', () => {
    const long = buildPayload(post({ url: 'https://news.test/' + 'a'.repeat(950), image: 'https://news.test/' + 'i'.repeat(950), imageWidth: 1600, title: '\u{20000}'.repeat(100), description: '\u{20000}'.repeat(100), focus: 'x', tags: [] }));
    expect(long.ok).toBe(true);
    expect(long.bytes).toBeLessThan(4000);
    expect(buildPayload(post({ url: 'https://news.test/' + 'a'.repeat(2000) })).reason).toBe('bad_url');
    expect(buildPayload(post(), { thread: 'q'.repeat(5000) }).reason).toBe('too_big'); // a thread key from the caller that cannot fit
  });
  it('no emoji reaches the payload: in the title, description, pushTitle or pushBody (BUGS P9)', () => {
    for (const f of ['title', 'description', 'pushTitle', 'pushBody']) {
      for (const e of ['\u{1F600}', '\u26A0\uFE0F', '\u2705', '1\uFE0F\u20E3', '\u{1F1EE}\u{1F1F3}', '\u2764']) {
        const r = buildPayload(post({ [f]: `Plain text ${e} here` }));
        expect(r.ok, `${f} ${e}`).toBe(false);
        expect(r.reason).toBe('emoji');
      }
    }
  });
  it('an emoji hidden in text that would be cut off is still refused', () => {
    expect(buildPayload(post({ description: 'a '.repeat(200) + '\u{1F600}' })).reason).toBe('emoji');
  });
  it('plain symbols, quotes, dashes, Bengali and accents are fine', () => {
    const r = buildPayload(post({ title: 'Caf\u00E9 \u2014 \u201Cnew\u201D prices \u20B95\u00A9', description: 'বাংলা সংবাদ' }));
    expect(r.ok).toBe(true);
    expect(hasEmoji('plain')).toBe(false);
    expect(hasEmoji('\u00A9 \u00AE \u2122')).toBe(false);
    expect(hasEmoji(null)).toBe(false);
  });
  it('refuses a missing headline and a link that is not https or not a link', () => {
    expect(buildPayload(post({ title: '   ', pushTitle: '' })).reason).toBe('no_title');
    expect(buildPayload(post({ url: 'http://news.test/a/' })).reason).toBe('bad_url');
    expect(buildPayload(post({ url: 'javascript:alert(1)' })).reason).toBe('bad_url');
    expect(buildPayload(post({ url: 'not a url' })).reason).toBe('bad_url');
    expect(buildPayload(post({ url: undefined })).reason).toBe('bad_url');
  });
  it('the image is sent only when it is https and at least 1200 px wide', () => {
    const img = 'https://news.test/media/photo.webp';
    expect(buildPayload(post({ image: img, imageWidth: 1200 })).payload.image).toBe(img);
    expect(buildPayload(post({ image: img, imageWidth: 1199 })).payload.image).toBeUndefined();
    expect(buildPayload(post({ image: img })).payload.image).toBeUndefined();
    expect(buildPayload(post({ image: 'http://news.test/p.webp', imageWidth: 1600 })).payload.image).toBeUndefined();
    expect(buildPayload(post({ image: 'nonsense', imageWidth: 1600 })).payload.image).toBeUndefined();
  });
  it('the text comes only from the post: a reader keyword has no way in', () => {
    const r = buildPayload(post(), { keyword: '<script>alert(1)</script>', thread: undefined });
    expect(r.json).not.toContain('script');
  });
  it('control characters and line breaks become spaces', () => {
    const r = buildPayload(post({ title: 'Line one\nLine two\u0007\ttabbed' }));
    expect(r.payload.title).toBe('Line one Line two tabbed');
  });
});

describe('the push database file', () => {
  const sql = readFileSync(new URL('../../../workers/push/schema.sql', import.meta.url), 'utf8');
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  it('has the planned tables and each statement is safe to run again', () => {
    expect(tables).toEqual(['push_subs', 'push_terms', 'push_posts', 'push_queue', 'push_held', 'push_sent', 'push_audit', 'push_less']);
    const creates = sql.match(/CREATE (UNIQUE )?(TABLE|INDEX)\b/g) || [];
    const safe = sql.match(/CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS/g) || [];
    expect(creates.length).toBeGreaterThan(10);
    expect(safe.length).toBe(creates.length);
  });
  it('keeps no IP address, name, email, user agent or location (PLAN 31.3)', () => {
    const code = sql.replace(/--.*$/gm, '');
    for (const word of ['ip', 'ip_address', 'name', 'email', 'user_agent', 'ua', 'latitude', 'longitude', 'history']) expect(code, word).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
  });
  it('the post key and the browser address are unique (BUGS P2, P18)', () => {
    expect(sql).toMatch(/endpoint_hash\s+TEXT\s+NOT NULL UNIQUE/);
    expect(sql).toMatch(/key\s+TEXT\s+NOT NULL UNIQUE/);
    expect(sql).toMatch(/PRIMARY KEY \(sub_id, kind, term\)/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS push_terms_lookup ON push_terms \(kind, term\)/);
  });
  it('stores the zone name and quiet hours the way lib.js reads them', () => {
    expect(sql).toMatch(/tz\s+TEXT\s+NOT NULL DEFAULT 'UTC'/);
    expect(sql).toMatch(/quiet_start\s+INTEGER DEFAULT 1320/);
    expect(sql).toMatch(/quiet_end\s+INTEGER DEFAULT 420/);
    expect(sql).toMatch(/sent_day\s+TEXT/);
  });
  it('runs on a real SQLite, twice (skipped where node:sqlite does not exist)', async () => {
    let DatabaseSync: any;
    try {
      ({ DatabaseSync } = await import('node:sqlite'));
    } catch {
      return;
    }
    const db = new DatabaseSync(':memory:');
    db.exec(sql);
    db.exec(sql);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'push_%' ORDER BY name").all().map((r: any) => r.name);
    expect(names).toEqual([...tables].sort());
    // the same post key twice, and the same endpoint twice, are refused
    const now = Date.now();
    db.prepare("INSERT INTO push_posts (key,url,title,published_at,announced_at) VALUES ('k','u','t',?,?)").run(now, now);
    expect(() => db.prepare("INSERT INTO push_posts (key,url,title,published_at,announced_at) VALUES ('k','u','t',?,?)").run(now, now)).toThrow();
    const sub = "INSERT INTO push_subs (endpoint,endpoint_hash,p256dh,auth,token_hash,created,last_seen) VALUES ('e','h','p','a','t',?,?)";
    db.prepare(sub).run(now, now);
    expect(() => db.prepare(sub).run(now, now)).toThrow();
    const row = db.prepare('SELECT level, daily_limit, tz, quiet_start, quiet_end, breaking_all, breaking_in_quiet, learn_on, status FROM push_subs').get();
    expect({ ...row }).toEqual({ level: 'balanced', daily_limit: 4, tz: 'UTC', quiet_start: 1320, quiet_end: 420, breaking_all: 1, breaking_in_quiet: 0, learn_on: 0, status: 'active' });
    db.close();
  });
});

describe('the rules file', () => {
  it('the constants are the ones in LOGICS 19', () => {
    expect(P.MAX_AGE_MIN).toBe(120);
    expect(P.IMPORT_GUARD).toBe(3);
    expect(P.IMPORT_KEEP).toBe(2);
    expect(P.LEVEL_MIN).toEqual({ important: 65, balanced: 48, everything: 30 });
    expect(P.LEVEL_CAP).toMatchObject({ important: 2, balanced: 4, everything: 8 });
    expect(P.MIN_GAP_MIN).toBe(30);
    expect(P.EXTRA_BREAKING).toBe(2);
    expect(P.EXTRA_HIGH).toBe(1);
    expect(P.TTL_SEC).toEqual({ breaking: 7200, normal: 21600, digest: 43200 });
    expect(P.URGENCY).toEqual({ breaking: 'high', normal: 'normal', digest: 'low' });
    expect(P.MAX_TERMS).toBe(10);
    expect(P.MIN_FOLLOWERS_REPORT).toBe(5);
    expect(P.PAYLOAD_MAX_BYTES).toBe(4000);
    expect(P.TITLE_MAX).toBe(70);
    expect(P.BODY_MAX).toBe(120);
    expect(P.W.explicit).toBe(60);
    expect(P.W.implicit).toBe(8);
    expect(P.W.affinity).toBe(10);
    expect(P.W.fresh).toBe(7);
    expect(P.W.importance).toEqual({ breaking: 25, force: 25, featured: 12, trending: 10 });
  });
  it('has no network, no database and no clock of its own', () => {
    const code = readFileSync(new URL('../../../workers/push/lib.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bfetch\s*\(|\bDate\.now\b|new Date\(\)|\bMath\.random\b|\.prepare\(|\bconsole\./);
  });
});
