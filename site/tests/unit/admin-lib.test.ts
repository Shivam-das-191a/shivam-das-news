import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { parse, stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore
import * as aSlug from '../../public/admin/js/slug.js';
// @ts-ignore
import * as aUrl from '../../public/admin/js/url.js';
// @ts-ignore
import { analyze } from '../../public/admin/js/seo.js';
// @ts-ignore
import { validatePost } from '../../public/admin/js/validate.js';
// @ts-ignore
import { nextRedirects } from '../../public/admin/js/redirects.js';
// @ts-ignore
import { can, roleOf } from '../../public/admin/js/roles.js';
// @ts-ignore
import { renderMarkdown } from '../../public/admin/js/md.js';
// @ts-ignore
import { toBase64, decodeText } from '../../public/admin/js/github.js';
// @ts-ignore
import { mediaName } from '../../public/admin/js/image.js';
import * as tsSlug from '../../src/lib/slug';
import * as tsUrl from '../../src/lib/url';
import { lintHeadings } from '../../src/lib/headings';
import { clickbaitWarning } from '../../src/lib/gate';
// @ts-ignore
import * as aText from '../../public/admin/js/text.js';

const post = { title: 'New phone launched in India today', permalink: 'new-phone-launched', category: 'technology', tags: ['phones', 'launch'], date: '2026-11-13T09:30:00Z', author: 'shivam-das', description: 'A '.repeat(30) + 'phone.', image: '/media/2026/11/phone.webp', imageAlt: 'A phone', robots: 'index,follow', schemaType: 'NewsArticle', breaking: false, ads: { hideAll: false, hidePopunder: true }, redirects: [], status: 'published' };

describe('front matter (admin)', () => {
  it('round-trips a post, including quotes, unicode and nested ads', () => {
    const d = { ...post, title: 'He said "go" – café', keyPoints: ['one', 'two, three'] };
    const out = parse(stringify(d, 'Hello **world**\n'));
    expect(out.data).toEqual(d);
    expect(out.body).toBe('Hello **world**\n');
  });
  it('reads hand-written files: block lists, flow lists, single quotes, comments, folded text', () => {
    const t = `---\ntitle: 'It''s here'\ntags:\n  - a\n  - b\ncategory: tech\nbreaking: false # note\ndescription: >\n  one\n  two\nredirects: []\n---\nBody`;
    const { data } = parse(t);
    expect(data).toMatchObject({ title: "It's here", tags: ['a', 'b'], category: 'tech', breaking: false, description: 'one two', redirects: [] });
  });
  it('keeps dates unquoted so Astro reads them as dates', () => {
    expect(stringify({ date: '2026-11-13T09:30:00Z' }, 'x')).toContain('date: 2026-11-13T09:30:00Z');
  });
});

describe('admin copies match the site code', () => {
  it('slugify and uniqueSlug', () => {
    for (const s of ['The Café of the Future', 'word '.repeat(30), 'India beats Australia: 3-0!', '   ']) expect(aSlug.slugify(s)).toBe(tsSlug.slugify(s));
    expect(aSlug.uniqueSlug('a', new Set(['a', 'a-2']))).toBe('a-3');
  });
  it('post URL uses the site time zone', () => {
    const d = new Date('2026-11-13T19:30:00Z'); // 01:00 on 14 Nov in Kolkata
    expect(aUrl.postUrl('tech', 'x', d, 'Asia/Kolkata')).toBe(tsUrl.postUrl('tech', 'x', d, 'Asia/Kolkata'));
    expect(aUrl.postUrl('tech', 'x', d, 'Asia/Kolkata')).toBe('/2026/11/14/blogs/tech/x/');
  });
  it('heading lint and clickbait rules', () => {
    for (const md of ['## a\n### b', '# no\n## ok', '## a\n#### skip', '```\n# code\n```\n## fine']) expect(aText.lintHeadings(md)).toEqual(lintHeadings(md));
    for (const t of ['Shocking news', 'BIG NEWS TODAY', 'Calm headline']) expect(aText.clickbaitWarning(t)).toBe(clickbaitWarning(t));
  });
});

describe('time zones (BUGS U1)', () => {
  it('11:55 PM local keeps the local date in the URL', () => {
    const utc = aUrl.zonedToUtc('2026-11-13T23:55', 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2026-11-13T18:25:00.000Z');
    expect(aUrl.postUrl('c', 's', utc, 'Asia/Kolkata')).toContain('/2026/11/13/');
    expect(aUrl.utcToZoned(utc, 'Asia/Kolkata')).toBe('2026-11-13T23:55');
  });
  it('handles zones behind UTC and daylight saving', () => {
    expect(aUrl.zonedToUtc('2026-07-01T09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(aUrl.zonedToUtc('2026-12-01T09:00', 'America/New_York').toISOString()).toBe('2026-12-01T14:00:00.000Z');
    expect(aUrl.utcToZoned(new Date('2026-12-01T14:00:00Z'), 'America/New_York')).toBe('2026-12-01T09:00');
  });
});

describe('validation (mirrors the build rules)', () => {
  const body = '## Facts\nRead [more](/2026/11/12/blogs/technology/older/) here. ' + 'word '.repeat(320);
  it('accepts a good published post', () => {
    expect(validatePost(post, body, { imageWidth: 1600 }).errors).toEqual([]);
  });
  it('blocks the things that would break the build or hurt Discover', () => {
    const bad = { ...post, title: 'Hi', permalink: 'Bad Slug', image: '', description: 'short' };
    const e = validatePost(bad, '# H1\ntext', {}).errors.join(' | ');
    expect(e).toMatch(/Title/); expect(e).toMatch(/Permalink/); expect(e).toMatch(/featured image/); expect(e).toMatch(/50 to 160/); expect(e).toMatch(/H1/);
  });
  it('blocks a narrow featured image (S9) and duplicate permalinks (U2)', () => {
    expect(validatePost(post, body, { imageWidth: 800 }).errors.join()).toMatch(/1200/);
    expect(validatePost(post, body, { imageWidth: 1600, takenPermalinks: new Set(['new-phone-launched']) }).errors.join()).toMatch(/already used/);
  });
  it('lets a draft be saved without image or description', () => {
    expect(validatePost({ ...post, status: 'draft', image: '', description: '' }, '', {}).errors).toEqual([]);
  });
  it('blocks the first publish until the time zone is confirmed', () => {
    expect(validatePost(post, body, { imageWidth: 1600, timeZoneBlocked: true }).errors.join()).toMatch(/time zone/);
  });
});

describe('redirect history (U3, U4, U8)', () => {
  const tz = 'Asia/Kolkata';
  const p1 = { category: 'tech', permalink: 'a', date: '2026-11-13T09:30:00Z', status: 'published', redirects: [] };
  it('keeps every old URL as one hop to the latest', () => {
    const p2 = { ...p1, permalink: 'b', redirects: nextRedirects(p1, { ...p1, permalink: 'b' }, tz) };
    const p3 = { ...p2, permalink: 'c' };
    expect(nextRedirects(p2, p3, tz)).toEqual(['/2026/11/13/blogs/tech/a/', '/2026/11/13/blogs/tech/b/']);
  });
  it('removes a redirect that points to the live URL (rename A to B to A)', () => {
    const b = { ...p1, permalink: 'b', redirects: ['/2026/11/13/blogs/tech/a/'] };
    // A is live again, so A must not redirect anywhere; B now redirects to A (one hop).
    expect(nextRedirects(b, { ...b, permalink: 'a' }, tz)).toEqual(['/2026/11/13/blogs/tech/b/']);
  });
  it('covers category and date changes, and ignores drafts', () => {
    expect(nextRedirects(p1, { ...p1, category: 'world' }, tz)).toEqual(['/2026/11/13/blogs/tech/a/']);
    expect(nextRedirects(p1, { ...p1, date: '2026-11-15T09:30:00Z' }, tz)).toEqual(['/2026/11/13/blogs/tech/a/']);
    expect(nextRedirects({ ...p1, status: 'draft' }, { ...p1, permalink: 'z' }, tz)).toEqual([]);
  });
});

describe('SEO score', () => {
  const body = '## Facts\nThe new phone launch was big. ' + 'Short clear sentence. '.repeat(120) + '[More](/x/) and [source](https://other.org/a).';
  it('scores a complete post high and an empty one low', () => {
    const good = analyze({ ...post, focusKeyword: 'new phone', description: 'The new phone launch in India brings a faster chip, a brighter screen and a lower price for buyers.', body, imageWidth: 1600, imageHeight: 900 });
    const poor = analyze({ title: 'Hi', body: '', description: '' });
    expect(good.score).toBeGreaterThanOrEqual(85);
    expect(poor.score).toBeLessThan(35);
  });
  it('flags a narrow image and a bad heading order', () => {
    const r = analyze({ ...post, body: '## A\n#### B', imageWidth: 700, imageHeight: 400 });
    expect(r.checks.find((c: any) => c.id === 'img-w').status).toBe('bad');
    expect(r.checks.find((c: any) => c.id === 'headings').status).toBe('bad');
  });
});

describe('roles', () => {
  it('admin does all, editor cannot change settings, author saves drafts only', () => {
    expect(can('admin', 'settings')).toBe(true);
    expect(can('editor', 'settings')).toBe(false);
    expect(can('editor', 'post:publish')).toBe(true);
    expect(can('author', 'post:publish')).toBe(false);
    expect(can('author', 'post:draft')).toBe(true);
    expect(can(null, 'post:draft')).toBe(false);
  });
  it('config wins; a repo admin is admin; others have no role', () => {
    expect(roleOf({ roles: { sam: 'author' } }, 'sam', { admin: true })).toBe('author');
    expect(roleOf({ roles: {} }, 'owner', { admin: true })).toBe('admin');
    expect(roleOf({ roles: {} }, 'stranger', { push: true })).toBeNull();
  });
});

describe('preview and helpers', () => {
  it('escapes HTML and blocks javascript: links in the Markdown preview', () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) ![i](/media/a.webp)');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<img alt="i" src="/media/a.webp">');
  });
  it('never renders an H1 from the body', () => { expect(renderMarkdown('# Big')).toContain('<h2>'); });
  it('base64 round-trips unicode', () => { expect(decodeText(toBase64('café — বাংলা'))).toBe('café — বাংলা'); });
  it('makes safe media names', () => { expect(mediaName('My Photo (1).JPG')).toBe('my-photo-1'); });
});
