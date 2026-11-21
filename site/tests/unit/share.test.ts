import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS module served to the browser
import * as L from '../../public/admin/js/listing.js';
// @ts-ignore plain JS module served to the browser
import { can } from '../../public/admin/js/roles.js';
// @ts-ignore plain JS module served to the browser
import { parse, stringify } from '../../public/admin/js/frontmatter.js';
// @ts-ignore plain .mjs
import { checkPost } from '../../scripts/validate-content-lib.mjs';
import { shareValues } from '../../src/lib/seo';

const ctx = { siteName: 'Shivam Das News', origin: 'https://example.test', timeZone: 'Asia/Kolkata' };
const base = { title: 'New phone launched in India today', permalink: 'new-phone', metaTitle: '', description: 'A clear description of the story.', category: 'technology', date: '2026-11-13T09:30:00Z', body: '', status: 'draft', image: '/media/a.webp', imageAlt: 'A phone', ogTitle: '', ogDescription: '', ogImage: '', canonical: '' };
const x = (n: number) => 'a'.repeat(n);

describe('share card: fallbacks and the same rule as the page head', () => {
  it('with nothing typed it uses the page title, the description and the featured image', () => {
    const c = L.shareCard(base, ctx);
    expect(c.title).toBe(base.title);
    expect(c.description).toBe(base.description);
    expect(c.image).toBe('/media/a.webp');
    expect(c.imageUrl).toBe('https://example.test/media/a.webp');
    expect(c.host).toBe('example.test');
    expect(c.auto).toEqual({ title: true, description: true, image: true });
    expect(c.usesFeaturedImage).toBe(true);
  });
  it('metaTitle is the fallback before the headline; typed values win and are not auto', () => {
    expect(L.shareCard({ ...base, metaTitle: 'Meta' }, ctx).title).toBe('Meta');
    const c = L.shareCard({ ...base, metaTitle: 'Meta', ogTitle: 'Share', ogDescription: 'Share text', ogImage: '/media/b.webp' }, ctx);
    expect([c.title, c.description, c.image]).toEqual(['Share', 'Share text', '/media/b.webp']);
    expect(c.auto).toEqual({ title: false, description: false, image: false });
    expect(c.usesFeaturedImage).toBe(false);
  });
  it('an outside picture address stays as it is', () => {
    expect(L.shareCard({ ...base, ogImage: 'https://cdn.test/p.jpg' }, ctx).imageUrl).toBe('https://cdn.test/p.jpg');
  });
  it('shareCard equals shareValues of src/lib/seo.ts (what the page really writes)', () => {
    const cases = [base, { ...base, metaTitle: 'Meta' }, { ...base, ogTitle: 'T', ogDescription: 'D', ogImage: '/media/b.webp' }, { ...base, ogImage: '/media/a.webp' }, { ...base, image: '', ogImage: '' }, { ...base, ogTitle: '  spaced   out  ' }];
    for (const p of cases) {
      const c = L.shareCard(p, ctx);
      const s = shareValues({ title: p.metaTitle || p.title, description: p.description, image: p.image, imageAlt: p.imageAlt, ogTitle: p.ogTitle, ogDescription: p.ogDescription, ogImage: p.ogImage });
      expect([c.title, c.description, c.image]).toEqual([s.title, s.description, s.image]);
    }
  });
  it('shareValues: the alt text belongs to the featured picture only', () => {
    expect(shareValues({ title: 't', image: '/a.webp', imageAlt: 'alt' }).imageAlt).toBe('alt');
    expect(shareValues({ title: 't', image: '/a.webp', imageAlt: 'alt', ogImage: '/a.webp' }).imageAlt).toBe('alt');
    expect(shareValues({ title: 't', image: '/a.webp', imageAlt: 'alt', ogImage: '/b.webp' }).imageAlt).toBe('');
  });
});

describe('share card: limits (edges 70, 71, 320, 321, 160, 161)', () => {
  it('title levels', () => {
    const lv = (n: number) => L.shareCard({ ...base, ogTitle: x(n) }, ctx).levels.title;
    expect([lv(60), lv(61), lv(70), lv(71)]).toEqual(['ok', 'warn', 'warn', 'stop']);
  });
  it('description levels', () => {
    const lv = (n: number) => L.shareCard({ ...base, ogDescription: x(n) }, ctx).levels.description;
    expect([lv(160), lv(161), lv(320), lv(321)]).toEqual(['ok', 'warn', 'warn', 'stop']);
  });
  it('notes say the number and the limit; no picture gives a plain note', () => {
    expect(L.shareCard({ ...base, ogTitle: x(71) }, ctx).notes.join('|')).toMatch(/71 characters; the limit is 70/);
    expect(L.shareCard({ ...base, image: '', ogImage: '' }, ctx).notes.join('|')).toMatch(/No share picture/);
  });
});

describe('canonical check', () => {
  const self = 'https://example.test/2026/11/13/blogs/technology/new-phone/';
  const k = (v: string) => L.checkCanonical(v, { selfUrl: self, origin: 'https://example.test' });
  it('empty is fine and means the page names itself', () => {
    expect(k('')).toMatchObject({ level: 'ok', auto: true, effective: self });
  });
  it('spaces, a bad address and a wrong scheme stop', () => {
    expect(k('https://a.test/a b').level).toBe('stop');
    expect(k('not a url').level).toBe('stop');
    expect(k('/relative/').level).toBe('stop');
    expect(k('ftp://example.test/x/').level).toBe('stop');
  });
  it('the own address, http, a # part, another page and another website are warnings with a plain note', () => {
    expect(k(self)).toMatchObject({ level: 'warn' });
    expect(k(self).notes.join()).toMatch(/own address/);
    expect(k('http://example.test/x/').notes.join()).toMatch(/use https/);
    expect(k('https://example.test/x/#top').notes.join()).toMatch(/# part/);
    expect(k('https://example.test/other/').notes.join()).toMatch(/another page of this site/);
    expect(k('https://elsewhere.test/other/').notes.join()).toMatch(/another website/);
  });
});

describe('schema type and hard errors', () => {
  it('only the three types; empty means NewsArticle', () => {
    expect(L.checkSchemaType('').effective).toBe('NewsArticle');
    for (const t of ['NewsArticle', 'Article', 'BlogPosting']) expect(L.checkSchemaType(t).level).toBe('ok');
    expect(L.checkSchemaType('Story').level).toBe('stop');
  });
  it('hardErrors keeps the old result for a clean post and adds the new ones', () => {
    expect(L.hardErrors(base, ctx)).toEqual([]);
    expect(L.hardErrors({ ...base, canonical: 'nope' }, ctx).join('|')).toMatch(/full address/);
    expect(L.hardErrors({ ...base, schemaType: 'Story' }, ctx).join('|')).toMatch(/Schema type must be one of/);
    expect(L.hardErrors({ ...base, ogTitle: x(71) }, ctx).join('|')).toMatch(/Share title is 71/);
    expect(L.hardErrors({ ...base, ogDescription: x(321) }, ctx).join('|')).toMatch(/Share description is 321/);
    expect(L.hardErrors({ ...base, ogImage: 'media/b.webp' }, ctx).join('|')).toMatch(/must start with \//);
    expect(L.hardErrors({ ...base, ogTitle: 'Big news \u{1F525}' }, ctx).join('|')).toMatch(/must not contain emoji/);
  });
  it('a canonical that is only a warning does not block Publish', () => {
    expect(L.hardErrors({ ...base, canonical: 'https://elsewhere.test/a/' }, ctx)).toEqual([]);
  });
});

describe('roles and front matter', () => {
  it('only admins and editors may set a canonical', () => {
    expect(can('admin', 'post:canonical')).toBe(true);
    expect(can('editor', 'post:canonical')).toBe(true);
    expect(can('author', 'post:canonical')).toBe(false);
    expect(can(null, 'post:canonical')).toBe(false);
  });
  it('ogTitle, ogDescription and ogImage are written after canonical and read back', () => {
    const data = { title: 'A real story title', permalink: 'a-real-story', category: 'technology', canonical: '', ogTitle: 'Share "title"', ogDescription: 'Share text', ogImage: '/media/b.webp', robots: 'index,follow', status: 'draft' };
    const text = stringify(data, 'Body\n');
    expect(text.indexOf('ogTitle')).toBeGreaterThan(text.indexOf('permalink'));
    expect(text.indexOf('ogImage')).toBeLessThan(text.indexOf('robots'));
    const back = parse(text).data;
    expect([back.ogTitle, back.ogDescription, back.ogImage]).toEqual(['Share "title"', 'Share text', '/media/b.webp']);
  });
  it('empty share fields are not written', () => {
    const text = stringify({ title: 'A real story title', permalink: 'a-real-story', category: 'technology', ogTitle: '', ogDescription: '', ogImage: '' }, 'Body\n');
    expect(text).not.toMatch(/ogTitle|ogDescription|ogImage/);
  });
});

describe('npm run check:content knows the new fields', () => {
  const DESC = 'A clear description of this story that is long enough to pass the fifty character minimum.';
  const post = (o: Record<string, string> = {}) => {
    const f: Record<string, string> = { title: 'A real story title', permalink: 'a-real-story', category: 'technology', date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: DESC, image: '/media/a.webp', imageAlt: 'A picture', status: 'published', ...o };
    return `---\n${Object.entries(f).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n## First heading\nText.\n`;
  };
  const run = (text: string) => checkPost({ text, imageExists: (p: string) => p === '/media/a.webp' });
  it('good values pass', () => {
    const r = run(post({ canonical: 'https://example.test/a/', ogTitle: 'Share title', ogDescription: 'Share text', ogImage: '/media/a.webp' }));
    expect(r.errors).toEqual([]);
  });
  it('a bad canonical, a long share title or description and a missing share picture fail with plain lines', () => {
    expect(run(post({ canonical: 'nope' })).errors.join('|')).toMatch(/canonical must be a full address/);
    expect(run(post({ ogTitle: x(71) })).errors.join('|')).toMatch(/ogTitle must be at most 70/);
    expect(run(post({ ogDescription: x(321) })).errors.join('|')).toMatch(/ogDescription must be at most 320/);
    expect(run(post({ ogImage: '/media/missing.webp' })).errors.join('|')).toMatch(/ogImage file \/media\/missing.webp was not found/);
    expect(run(post({ ogImage: 'media/b.webp' })).errors.join('|')).toMatch(/ogImage must start with \//);
  });
  it('an outside share picture is only a warning; a draft may name a picture that does not exist yet', () => {
    const w = run(post({ ogImage: 'https://cdn.test/p.jpg' }));
    expect(w.errors).toEqual([]);
    expect(w.warnings.join('|')).toMatch(/outside address/);
    expect(run(post({ status: 'draft', ogImage: '/media/later.webp' })).errors).toEqual([]);
  });
  it('an emoji in the share title is caught by the whole-file emoji rule', () => {
    expect(run(post({ ogTitle: 'Big \u{1F525}' })).errors.join('|')).toMatch(/emoji/);
  });
});

describe('the build side: same numbers in the schema, the page head and the article page', () => {
  const cfg = readFileSync('src/content.config.ts', 'utf8');
  it('src/content.config.ts has the share fields with the limits the dashboard uses', () => {
    expect(cfg).toContain('ogTitle: z.string().max(70)');
    expect(cfg).toContain('ogDescription: z.string().max(320)');
    expect(cfg).toContain('ogImage: z.string()');
    expect(L.OG_TITLE_STOP).toBe(70);
    expect(L.OG_DESC_STOP).toBe(320);
  });
  it('Base.astro writes og and twitter tags from shareValues, and the article page passes the three fields', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toContain('shareValues(');
    expect(base).toContain('<meta property="og:title" content={share.title}>');
    expect(base).toContain('<meta name="twitter:title" content={share.title}>');
    expect(base).toContain('<meta property="og:description" content={share.description}>');
    const art = readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8');
    expect(art).toContain('ogTitle={d.ogTitle} ogDescription={d.ogDescription} ogImage={d.ogImage}');
  });
});
