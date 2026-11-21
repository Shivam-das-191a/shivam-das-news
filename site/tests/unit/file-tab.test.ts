import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS module without types
import { rawText, parseRaw, rawGuard, rawUnchanged, RAW_ACTION, RAW_MAX } from '../../public/admin/js/file-tab.js';
// @ts-expect-error plain JS module without types
import { can } from '../../public/admin/js/roles.js';
// @ts-expect-error plain JS module without types
import { stringify, parse } from '../../public/admin/js/frontmatter.js';

const data = { title: 'A story', permalink: 'a-story', category: 'technology', tags: ['x'], date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: 'd'.repeat(60), status: 'published', robots: 'index,follow', canonical: '' };
const orig = { path: 'site/content/blogs/technology/a-story.md', status: 'published', permalink: 'a-story', category: 'technology', date: '2026-11-12T09:00:00Z', robots: 'index,follow', canonical: '' };
const file = (d = data, b = '## Body\ntext') => stringify(d, b);

describe('File tab: rawText', () => {
  it('shows exactly what a save would write', () => { expect(rawText(data, '## Body\ntext')).toBe(file()); });
  it('survives missing data and body', () => { expect(rawText(undefined, undefined)).toBe('---\n\n---\n\n'); });
  it('round trips through parseRaw', () => {
    const r = parseRaw(rawText(data, '## Body\ntext'));
    expect(r.ok).toBe(true);
    expect(r.data.title).toBe('A story');
    expect(r.body).toBe('## Body\ntext\n');
    expect(stringify(r.data, r.body)).toBe(file());
  });
});

describe('File tab: parseRaw', () => {
  it('refuses empty text', () => { expect(parseRaw('').ok).toBe(false); expect(parseRaw('   \n').errors[0]).toMatch(/empty/); });
  it('refuses null and undefined without throwing', () => { expect(parseRaw(null).ok).toBe(false); expect(parseRaw(undefined).ok).toBe(false); });
  it('refuses text with no opening dashes', () => { expect(parseRaw('title: x\n---\nbody').errors[0]).toMatch(/start with a line of three dashes/); });
  it('refuses text with no closing dashes', () => { expect(parseRaw('---\ntitle: "x"\n## body').errors[0]).toMatch(/second line of three dashes/); });
  it('refuses empty front matter', () => { expect(parseRaw('---\n# only a comment\n---\n## body').errors[0]).toMatch(/front matter is empty/); });
  it('refuses a first-level heading in the body', () => { expect(parseRaw(file(data, '# Big\ntext')).errors[0]).toMatch(/first-level heading/); });
  it('allows a # line inside a code fence', () => { expect(parseRaw(file(data, '## Code\n```\n# comment\n```\n')).ok).toBe(true); });
  it('allows ## and ### headings', () => { expect(parseRaw(file(data, '## A\n### B\ntext')).ok).toBe(true); });
  it('allows a hash tag that is not a heading', () => { expect(parseRaw(file(data, '## A\n#tag is fine')).ok).toBe(true); });
  it('drops a byte order mark at the start', () => { expect(parseRaw('\uFEFF' + file()).ok).toBe(true); });
  it('reads Windows line endings', () => { const r = parseRaw(file().replace(/\n/g, '\r\n')); expect(r.ok).toBe(true); expect(r.data.permalink).toBe('a-story'); });
  it('refuses a file longer than the limit', () => { expect(parseRaw('---\ntitle: "x"\n---\n' + 'a'.repeat(RAW_MAX)).errors[0]).toMatch(/longer than/); });
  it('keeps unknown keys so the content check can name them', () => { expect(parseRaw(file({ ...data, mystery: 'x' } as any)).data.mystery).toBe('x'); });
  it('reads true and false as booleans', () => { expect(parseRaw(file({ ...data, breaking: true } as any)).data.breaking).toBe(true); });
});

describe('File tab: rawGuard (roles checked again at save)', () => {
  const ok = (role: string, next: any = data, o: any = orig) => rawGuard({ role, orig: o, next });
  it('lets an admin save a plain change', () => { expect(ok('admin', { ...data, description: 'new text' })).toEqual([]); });
  it('adds the raw action to the admin role only', () => {
    expect(RAW_ACTION).toBe('post:raw');
    expect(can('admin', RAW_ACTION)).toBe(true);
    expect(can('editor', RAW_ACTION)).toBe(false);
    expect(can('author', RAW_ACTION)).toBe(false);
    expect(can(undefined, RAW_ACTION)).toBe(false);
  });
  it('refuses an editor', () => { expect(ok('editor')).toEqual(['Only admins can change the raw file.']); });
  it('refuses an author (a writer)', () => { expect(ok('author')).toEqual(['Only admins can change the raw file.']); });
  it('refuses an unknown role and no role', () => { expect(ok('stranger')).toHaveLength(1); expect(ok(null as any)).toHaveLength(1); });
  it('refuses a post that does not exist yet', () => { expect(rawGuard({ role: 'admin', orig: null, next: data })[0]).toMatch(/Save the post from the form first/); });
  it('refuses a new handle on a live post', () => { expect(ok('admin', { ...data, permalink: 'other' })[0]).toMatch(/handle of a live post/); });
  it('refuses a new category on a live post', () => { expect(ok('admin', { ...data, category: 'sports' })[0]).toMatch(/category of a live post/); });
  it('refuses a new date on a live post', () => { expect(ok('admin', { ...data, date: '2026-11-13T09:00:00Z' })[0]).toMatch(/date of a live post/); });
  it('refuses a new handle or category on a draft too (the form moves the file)', () => {
    const d = { ...orig, status: 'draft' };
    expect(ok('admin', { ...data, status: 'draft', permalink: 'other' }, d)[0]).toMatch(/handle and the category/);
    expect(ok('admin', { ...data, status: 'draft', category: 'sports' }, d)[0]).toMatch(/handle and the category/);
  });
  it('lets an admin change the date of a draft', () => { expect(ok('admin', { ...data, status: 'draft', date: '2026-12-01T09:00:00Z' }, { ...orig, status: 'draft' })).toEqual([]); });
  it('lets an admin change canonical and robots', () => { expect(ok('admin', { ...data, canonical: 'https://x.test/a', robots: 'noindex,follow' })).toEqual([]); });
  it('treats a missing robots as index,follow', () => { const { robots, ...rest } = data; expect(ok('admin', rest as any)).toEqual([]); });
  it('lets an admin publish a draft', () => { expect(ok('admin', { ...data, status: 'published' }, { ...orig, status: 'draft' })).toEqual([]); });
});

describe('File tab: rawUnchanged', () => {
  it('is true for the same text', () => { expect(rawUnchanged('a\nb\n', 'a\nb\n')).toBe(true); });
  it('ignores trailing blank lines and Windows line endings', () => { expect(rawUnchanged('a\nb\n', 'a\r\nb\r\n\r\n')).toBe(true); });
  it('is false for a real change', () => { expect(rawUnchanged('a\nb\n', 'a\nc\n')).toBe(false); });
  it('handles null', () => { expect(rawUnchanged(null, '')).toBe(true); });
});

describe('File tab: the shipped file', () => {
  it('parse and stringify agree on a real post file', () => {
    const text = file();
    expect(stringify(parse(text).data, parse(text).body)).toBe(text);
  });
});
