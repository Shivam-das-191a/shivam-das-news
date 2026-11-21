import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-ignore plain JS dashboard code
import { validatePost, PUSH_VALUES, PUSH_TITLE_MAX, PUSH_BODY_MAX } from '../../public/admin/js/validate.js';
// @ts-ignore plain JS dashboard code
import { parse, stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain JS Worker code
import { TITLE_MAX, BODY_MAX } from '../../../workers/push/lib.js';
// @ts-expect-error plain .mjs helper
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';
// @ts-expect-error plain .mjs helper
import { postFromFile } from '../../scripts/push-announce-lib.mjs';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const config = read('../../src/content.config.ts');
const validateSrc = read('../../public/admin/js/validate.js');

const post = {
  title: 'New phone launched today', permalink: 'new-phone-launched', category: 'technology', tags: ['phones'], date: '2026-11-13T10:00', author: 'shivam-das',
  description: 'A description that is long enough to publish, between fifty and one hundred and sixty characters.', image: '/media/a.jpg', imageAlt: 'A phone', status: 'published',
};
const body = '## Facts\nRead [more](/2026/11/12/blogs/technology/older/) here. ' + 'word '.repeat(320);

describe('push fields in the post model (v0.95.0, part 7e-1)', () => {
  it('the schema has the three fields with the limits of the Worker', () => {
    expect(config).toContain("push: z.enum(['auto', 'off', 'force']).default('auto')");
    expect(config).toContain(`pushTitle: z.string().max(${TITLE_MAX}).default('')`);
    expect(config).toContain(`pushBody: z.string().max(${BODY_MAX}).default('')`);
    expect(PUSH_TITLE_MAX).toBe(TITLE_MAX);
    expect(PUSH_BODY_MAX).toBe(BODY_MAX);
  });
  it('the schema has an emoji rule on the notification text', () => {
    expect(config).toContain('pushTitle, pushBody');
    expect(config).toMatch(/\.refine\(\(d\) => !NOTE_EMOJI\.test\(/);
  });
  it('the emoji pattern in the schema and in the dashboard agrees with the site emoji finder', () => {
    const sources = [config, validateSrc].map((s) => /const NOTE_EMOJI = \/(.*)\/u;/.exec(s)![1]);
    expect(sources[0]).toBe(sources[1]);
    const re = new RegExp(sources[0], 'u');
    const samples = ['Fire ' + String.fromCodePoint(0x1f525), 'warn \u26A0\uFE0F', 'ok \u2705', '1\uFE0F\u20E3', '\u{1F1EE}\u{1F1F3}', 'plain headline', 'Brand\u2122 \u00A9 \u20B9500', 'caf\u00E9 \u2014 \u201Cquoted\u201D', 'বাংলা সংবাদ', 'র\u200D\u09CD\u09AFাব'];
    for (const t of samples) expect(re.test(t)).toBe(findEmoji(t).length > 0);
  });
  it('the allowed push values are the same as the Worker accepts', () => {
    expect(PUSH_VALUES).toEqual(['auto', 'off', 'force']);
  });
});

describe('push fields in the dashboard check', () => {
  it('accepts a post without the fields and with good fields', () => {
    expect(validatePost(post, body, { imageWidth: 1600 }).errors).toEqual([]);
    expect(validatePost({ ...post, push: 'force', pushTitle: 'Short title', pushBody: 'Short text for the phone.' }, body, { imageWidth: 1600 }).errors).toEqual([]);
    expect(validatePost({ ...post, push: '' }, body, { imageWidth: 1600 }).errors).toEqual([]);
  });
  it('blocks a wrong push value, a title over 70, a text over 120 and an emoji', () => {
    const e = (over: Record<string, string>) => validatePost({ ...post, ...over }, body, { imageWidth: 1600 }).errors.join(' | ');
    expect(e({ push: 'maybe' })).toMatch(/Push: choose/);
    expect(e({ pushTitle: 'x'.repeat(70) })).toBe('');
    expect(e({ pushTitle: 'x'.repeat(71) })).toMatch(/title is over 70/);
    expect(e({ pushBody: 'x'.repeat(120) })).toBe('');
    expect(e({ pushBody: 'x'.repeat(121) })).toMatch(/text is over 120/);
    expect(e({ pushTitle: 'Hot ' + String.fromCodePoint(0x1f525) })).toMatch(/emoji/);
    expect(e({ pushBody: 'Done \u2705' })).toMatch(/emoji/);
  });
  it('the limits also hold for a draft (the build reads every post)', () => {
    expect(validatePost({ ...post, status: 'draft', pushTitle: 'x'.repeat(71) }, '', {}).errors.join()).toMatch(/title is over 70/);
  });
  it('a copyright sign, a rupee sign and Bengali text are fine', () => {
    expect(validatePost({ ...post, pushTitle: '\u00A9 \u20B9500 \u09AC\u09BE\u0982\u09B2\u09BE' }, body, { imageWidth: 1600 }).errors).toEqual([]);
  });
});

describe('push fields in the front matter and in the announce job', () => {
  it('the fields are written after trending and before autoLinks, and read back the same', () => {
    const data = { ...post, trending: false, autoLinks: true, push: 'force', pushTitle: 'He said "yes" \\ then left', pushBody: 'Text' };
    const text = stringify(data, 'Body text here.');
    const keys = text.split('\n').map((l: string) => l.split(':')[0]);
    expect(keys.indexOf('push')).toBeGreaterThan(keys.indexOf('trending'));
    expect(keys.indexOf('pushTitle')).toBe(keys.indexOf('push') + 1);
    expect(keys.indexOf('pushBody')).toBe(keys.indexOf('push') + 2);
    expect(keys.indexOf('pushBody')).toBeLessThan(keys.indexOf('autoLinks'));
    expect(parse(text).data).toMatchObject({ push: 'force', pushTitle: 'He said "yes" \\ then left', pushBody: 'Text' });
  });
  it('empty fields are not written at all', () => {
    const text = stringify({ ...post, push: 'auto', pushTitle: '', pushBody: '' }, 'Body.');
    expect(text).toContain('push: "auto"');
    expect(text).not.toContain('pushTitle');
    expect(text).not.toContain('pushBody');
  });
  it('the announce job reads exactly what the dashboard writes, quotes and backslashes included', () => {
    const data = { ...post, date: '2026-11-16T11:30:00Z', push: 'force', pushTitle: 'He said "yes" \\ then left', pushBody: "It's done", tags: ['it\'s', 'a "b"'] };
    const text = stringify(data, 'Some words in the body of this story.');
    const p = postFromFile('content/blogs/technology/a.md', text, { timeZone: 'UTC', siteUrl: 'https://news.example' });
    expect(p).toMatchObject({ push: 'force', pushTitle: 'He said "yes" \\ then left', pushBody: "It's done", tags: ["it's", 'a "b"'] });
  });
});
