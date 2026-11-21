import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { checkNewName, planFileRename, MAX_NAME, MAX_RENAME_PLACES } from '../../public/admin/js/file-rename.js';
// @ts-ignore
import { MAX_REDIRECTS } from '../../public/admin/js/import-save.js';
import { buildRedirects } from '../../src/lib/redirects';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const OLD = '/media/2026/11/img-1234.webp';
const NEW = '/media/2026/11/city-hall-vote.webp';
const OTHER = '/media/2026/10/senate-hearing.webp';
const TAKEN = [OLD, OTHER];
const POST = { file: 'site/content/blogs/news/vote.md', text: `---\ntitle: Vote\nimage: ${OLD}\n---\nSee ![hall](${OLD}) and again ${OLD}.` };
const AUTHOR = { file: 'site/content/authors/shivam-das.json', text: `{"photo":"${OLD}"}` };
const LONGER = { file: 'site/content/blogs/news/other.md', text: `image: ${OLD}.bak and ${OLD}-large` };
const NONE = { file: 'site/content/blogs/news/none.md', text: `image: ${OTHER}` };
const base = (o: any = {}) => ({ items: [POST, AUTHOR, LONGER, NONE], map: {}, redirects: [], taken: TAKEN, paths: { pub: 'site/public', mediaMeta: 'site/config/media.json', redirects: 'site/config/redirects.json' }, ...o });
const file = (plan: any, path: string) => plan.files.find((f: any) => f.path === path);

describe('checkNewName', () => {
  it('accepts a plain new name and keeps the folder and the ending', () => {
    const r = checkNewName(OLD, 'city-hall-vote', TAKEN);
    expect(r).toEqual({ ok: true, errors: [], warnings: [], newPath: NEW });
  });
  it('accepts the name typed with its ending, in any case, and keeps the ending of the old file', () => {
    expect(checkNewName(OLD, 'city-hall-vote.webp', TAKEN).newPath).toBe(NEW);
    expect(checkNewName(OLD, 'city-hall-vote.WEBP', TAKEN).newPath).toBe(NEW);
    expect(checkNewName('/media/2026/11/a1b.JPG', 'harbor-fire', ['/media/2026/11/a1b.JPG']).newPath).toBe('/media/2026/11/harbor-fire.JPG');
  });
  it('refuses an empty name and a name with a folder', () => {
    for (const n of ['', '   ', undefined, null]) expect(checkNewName(OLD, n as any, TAKEN).ok).toBe(false);
    for (const n of ['a/b', '../x', 'a\\b']) expect(checkNewName(OLD, n, TAKEN).errors[0]).toContain('folder stays the same');
  });
  it('refuses another ending, so the kind of picture never changes', () => {
    const r = checkNewName(OLD, 'city-hall-vote.png', TAKEN);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('ending stays .webp');
  });
  it('refuses capitals, spaces, underscores, symbols and double hyphens', () => {
    for (const n of ['City-Hall', 'city hall', 'city_hall', 'city@hall', 'city--hall', '-city', 'city-', 'caf\u00e9']) {
      const r = checkNewName(OLD, n, TAKEN);
      expect(r.ok, n).toBe(false);
      expect(r.errors[0]).toContain('lowercase letters, numbers and hyphens');
    }
  });
  it('allows exactly MAX_NAME characters and refuses one more', () => {
    expect(checkNewName(OLD, 'a'.repeat(MAX_NAME), TAKEN).ok).toBe(true);
    expect(checkNewName(OLD, 'a'.repeat(MAX_NAME + 1), TAKEN).errors.join()).toContain('the limit is 100');
  });
  it('refuses the same name and a name that exists, also when only the capitals differ', () => {
    expect(checkNewName(OLD, 'img-1234', TAKEN).errors[0]).toContain('same as the old one');
    expect(checkNewName(OLD, 'senate-hearing', [OLD, '/media/2026/11/senate-hearing.webp']).errors[0]).toContain('already exists');
    expect(checkNewName(OLD, 'senate-hearing', [OLD, '/media/2026/11/Senate-Hearing.webp']).errors[0]).toContain('already exists');
  });
  it('warns, but does not refuse, a name that says nothing', () => {
    const r = checkNewName(OLD, 'img-5678', TAKEN);
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toContain('does not say what the picture shows');
  });
  it('refuses anything that is not a file under /media/, and addresses a redirect cannot use', () => {
    for (const p of ['/icon-512.png', '/media/../x.webp', '/media/a.webp?x=1', '', undefined]) expect(checkNewName(p as any, 'new-name', []).ok).toBe(false);
    expect(checkNewName('/media/a:b.webp', 'new-name', []).errors[0]).toContain('redirect cannot use');
    expect(checkNewName('/media/a*b.webp', 'new-name', []).ok).toBe(false);
  });
});

describe('planFileRename: the text files', () => {
  it('moves the picture and names the new address in every file that used the old one', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base());
    expect(plan.oldPath).toBe(OLD);
    expect(plan.newPath).toBe(NEW);
    expect(plan.moves).toEqual([{ from: `site/public${OLD}`, to: `site/public${NEW}` }]);
    expect(file(plan, POST.file).text).toBe(POST.text.split(OLD).join(NEW));
    expect(file(plan, POST.file).text.split(NEW).length - 1).toBe(3);
    expect(file(plan, AUTHOR.file).text).toBe(`{"photo":"${NEW}"}`);
    expect(plan.counts.places).toBe(2);
  });
  it('leaves a file alone when it names no picture, or only a longer name that starts the same', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base());
    expect(file(plan, LONGER.file)).toBeUndefined();
    expect(file(plan, NONE.file)).toBeUndefined();
  });
  it('does not touch config/media.json and config/redirects.json as text', () => {
    const items = [...base().items, { file: 'site/config/media.json', text: JSON.stringify({ [OLD]: { alt: 'x' } }) }, { file: 'site/config/redirects.json', text: JSON.stringify([{ from: OLD, to: OTHER }]) }];
    const plan = planFileRename(OLD, 'city-hall-vote', base({ items }));
    expect(plan.counts.places).toBe(2);
    const redirects = JSON.parse(file(plan, 'site/config/redirects.json').text);
    expect(redirects.filter((e: any) => e.from === OLD)).toHaveLength(1);
  });
  it('does not change the input', () => {
    const o = base({ map: { [OLD]: { alt: 'a' } }, redirects: [{ from: '/media/x.webp', to: OLD }] });
    const copy = JSON.parse(JSON.stringify(o));
    planFileRename(OLD, 'city-hall-vote', o);
    expect(o).toEqual(copy);
  });
  it('a file with no prefix paths still works (the default repository paths)', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', { items: [POST], taken: TAKEN });
    expect(plan.moves).toEqual([{ from: OLD, to: NEW }]);
    expect(plan.files.map((f: any) => f.path)).toContain('config/redirects.json');
  });
  it('a new name with a dollar sign pattern in the old text cannot corrupt the replacement', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ items: [{ file: 'a.md', text: `$& ${OLD} $1` }] }));
    expect(file(plan, 'a.md').text).toBe(`$& ${NEW} $1`);
  });
  it('refuses more places than one commit can hold', () => {
    const items = Array.from({ length: MAX_RENAME_PLACES + 1 }, (_, i) => ({ file: `p${i}.md`, text: OLD }));
    expect(() => planFileRename(OLD, 'city-hall-vote', base({ items }))).toThrow('more than one safe save can hold');
    expect(planFileRename(OLD, 'city-hall-vote', base({ items: items.slice(0, MAX_RENAME_PLACES) })).counts.places).toBe(MAX_RENAME_PLACES);
  });
});

describe('planFileRename: the redirect', () => {
  it('adds a 301 from the old address to the new one', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base());
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([{ from: OLD, to: NEW }]);
    expect(plan.counts.redirect).toBe('added');
  });
  it('keeps other redirects and their extra keys', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: '/a/', to: '/b/', note: 'x' }] }));
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([{ from: '/a/', to: '/b/', note: 'x' }, { from: OLD, to: NEW }]);
  });
  it('a redirect that ended at the old address now ends at the new one (no chain)', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: '/media/2026/11/first.webp', to: OLD }] }));
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([{ from: '/media/2026/11/first.webp', to: NEW }, { from: OLD, to: NEW }]);
  });
  it('renaming back removes the redirect that starts at the new address (no loop)', () => {
    const plan = planFileRename(NEW, 'img-1234', base({ taken: [NEW], items: [], redirects: [{ from: OLD, to: NEW }] }));
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([{ from: NEW, to: OLD }]);
    expect(plan.counts.loopRemoved).toBe(1);
  });
  it('an old entry that starts at this address is pointed at the new one', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: OLD, to: OTHER }] }));
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([{ from: OLD, to: NEW }]);
    expect(plan.counts.redirect).toBe('updated');
  });
  it('writes no redirect file when the entry is already exactly right', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: OLD, to: NEW }] }));
    expect(plan.counts.redirect).toBe('kept');
    expect(file(plan, 'site/config/redirects.json')).toBeUndefined();
  });
  it('stops at the Cloudflare Pages limit, with nothing changed', () => {
    expect(() => planFileRename(OLD, 'city-hall-vote', base({ existingRedirects: MAX_REDIRECTS }))).toThrow(`allows ${MAX_REDIRECTS}`);
    expect(planFileRename(OLD, 'city-hall-vote', base({ existingRedirects: MAX_REDIRECTS - 1 })).counts.redirect).toBe('added');
  });
  it('a redirect removed by the loop guard makes room for the new one', () => {
    const plan = planFileRename(NEW, 'img-1234', base({ taken: [NEW], items: [], redirects: [{ from: OLD, to: NEW }], existingRedirects: MAX_REDIRECTS }));
    expect(plan.counts).toMatchObject({ redirect: 'added', loopRemoved: 1 });
  });
  it('a rename that only replaces an entry does not count against the limit', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: OLD, to: OTHER }], existingRedirects: MAX_REDIRECTS }));
    expect(plan.counts.redirect).toBe('updated');
  });
  it('the redirect builder keeps the old address, also for an older redirect that now ends at the new file', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ redirects: [{ from: '/media/2026/11/first.webp', to: OLD }] }));
    const entries = JSON.parse(file(plan, 'site/config/redirects.json').text);
    const { map, problems } = buildRedirects(entries, new Set([NEW]));
    expect(map).toEqual({ [OLD]: NEW, '/media/2026/11/first.webp': NEW });
    expect(problems).toEqual([]);
  });
});

describe('planFileRename: alt text, caption and credit', () => {
  it('moves the entry to the new name and keeps its place in the list', () => {
    const map = { '/media/a.webp': { alt: 'a' }, [OLD]: { alt: 'hall', caption: 'c', credit: 'AP' }, [OTHER]: { alt: 'z' } };
    const plan = planFileRename(OLD, 'city-hall-vote', base({ map }));
    const out = JSON.parse(file(plan, 'site/config/media.json').text);
    expect(Object.keys(out)).toEqual(['/media/a.webp', NEW, OTHER]);
    expect(out[NEW]).toEqual({ alt: 'hall', caption: 'c', credit: 'AP' });
    expect(plan.counts.mediaEntry).toBe(true);
  });
  it('writes nothing for config/media.json when the picture has no entry', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ map: { [OTHER]: { alt: 'z' } } }));
    expect(file(plan, 'site/config/media.json')).toBeUndefined();
    expect(plan.counts.mediaEntry).toBe(false);
  });
  it('the moved entry wins over a stale entry for the new name', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ map: { [OLD]: { alt: 'new one' }, [NEW]: { alt: 'stale' } } }));
    expect(JSON.parse(file(plan, 'site/config/media.json').text)).toEqual({ [NEW]: { alt: 'new one' } });
  });
});

describe('planFileRename: refusals', () => {
  it('throws the first plain error for a bad name', () => {
    expect(() => planFileRename(OLD, 'Bad Name', base())).toThrow('lowercase letters');
    expect(() => planFileRename(OLD, 'img-1234', base())).toThrow('same as the old one');
    expect(() => planFileRename(OLD, 'senate-hearing', base({ taken: [OLD, '/media/2026/11/senate-hearing.webp'] }))).toThrow('already exists');
  });
  it('throws when the picture is already gone', () => {
    expect(() => planFileRename(OLD, 'city-hall-vote', base({ taken: [OTHER] }))).toThrow('already gone');
  });
  it('throws for something that is not a picture under /media/', () => {
    expect(() => planFileRename('/og-default.png', 'new-name', base())).toThrow('not a file under /media/');
  });
  it('gives the warnings of the name back with a good plan', () => {
    expect(planFileRename(OLD, 'img-5678', base()).warnings[0]).toContain('does not say what the picture shows');
  });
});

describe('the file itself', () => {
  it('is a plain module: no network, no storage, no screen, no emoji', () => {
    const t = src('public/admin/js/file-rename.js');
    expect(t).not.toMatch(/fetch\(|localStorage|sessionStorage|document\.|window\.|XMLHttpRequest/);
    expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('the shared address pattern (usedIn, delete and rename)', () => {
  it('a full stop that ends a sentence still counts as a use, so a used picture cannot be deleted', async () => {
    // @ts-ignore
    const { usedIn, deleteCheck, pathPattern } = await import('../../public/admin/js/media-meta.js');
    const items = [{ file: 'a.md', text: `See ${OLD}.` }, { file: 'b.md', text: `${OLD}, and ${OLD}!` }, { file: 'c.md', text: `${OLD}.bak` }, { file: 'd.md', text: `${OLD}-large and ${OLD}_x` }];
    expect(usedIn(OLD, items)).toEqual(['a.md', 'b.md']);
    expect(deleteCheck(OLD, items).ok).toBe(false);
    expect(`see ${OLD}.`.replace(pathPattern(OLD, 'g'), 'N')).toBe('see N.');
  });
});

describe('planFileRename: the smaller copies move along (Part 4c-4c)', () => {
  const O480 = '/media/2026/11/img-1234.480w.webp';
  const O800 = '/media/2026/11/img-1234.800w.webp';
  const N480 = '/media/2026/11/city-hall-vote.480w.webp';
  const N800 = '/media/2026/11/city-hall-vote.800w.webp';
  const OTHER480 = '/media/2026/10/senate-hearing.480w.webp';
  const T = [OLD, O480, O800, OTHER, OTHER480];
  const withCopies = (o: any = {}) => base({ taken: T, ...o });

  it('moves the picture first, then each copy, narrowest first', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies());
    expect(plan.moves).toEqual([
      { from: 'site/public' + OLD, to: 'site/public' + NEW },
      { from: 'site/public' + O480, to: 'site/public' + N480 },
      { from: 'site/public' + O800, to: 'site/public' + N800 },
    ]);
    expect(plan.copies).toEqual([{ from: O480, to: N480 }, { from: O800, to: N800 }]);
    expect(plan.counts.copies).toBe(2);
  });
  it('a picture without copies moves alone and counts 0 copies', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base());
    expect(plan.moves).toHaveLength(1);
    expect(plan.copies).toEqual([]);
    expect(plan.counts.copies).toBe(0);
  });
  it('a copy of ANOTHER picture is never moved', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies());
    expect(JSON.stringify(plan)).not.toContain('senate-hearing.480w');
  });
  it('a copy that is not in the list of existing files is never invented', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', base({ taken: [OLD, O480, OTHER] }));
    expect(plan.copies).toEqual([{ from: O480, to: N480 }]);
  });
  it('adds one 301 for the picture and one for each copy', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies());
    expect(JSON.parse(file(plan, 'site/config/redirects.json').text)).toEqual([
      { from: OLD, to: NEW }, { from: O480, to: N480 }, { from: O800, to: N800 },
    ]);
    expect(plan.counts.redirect).toBe('added');
  });
  it('a redirect that ends at a copy now ends at its new name (no chain)', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies({ redirects: [{ from: '/media/2026/11/x.480w.webp', to: O480 }] }));
    const list = JSON.parse(file(plan, 'site/config/redirects.json').text);
    expect(list[0]).toEqual({ from: '/media/2026/11/x.480w.webp', to: N480 });
  });
  it('a stored redirect that starts at a NEW copy name is removed (loop guard)', () => {
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies({ redirects: [{ from: N480, to: '/media/2026/09/z.webp' }] }));
    const list = JSON.parse(file(plan, 'site/config/redirects.json').text);
    expect(list.some((e: any) => e.from === N480 && e.to !== N480)).toBe(false);
    expect(plan.counts.loopRemoved).toBe(1);
  });
  it('the redirect limit counts the copies', () => {
    const many = Array.from({ length: MAX_REDIRECTS - 2 }, (_, i) => ({ from: `/old-${i}`, to: `/new-${i}` }));
    expect(() => planFileRename(OLD, 'city-hall-vote', withCopies({ redirects: many }))).toThrow('needs 3 more redirects');
    const ok = Array.from({ length: MAX_REDIRECTS - 3 }, (_, i) => ({ from: `/old-${i}`, to: `/new-${i}` }));
    expect(() => planFileRename(OLD, 'city-hall-vote', withCopies({ redirects: ok }))).not.toThrow();
  });
  it('a post that names a copy gets the new copy name; the places count each file once', () => {
    const POST2 = { file: 'site/content/blogs/news/p2.md', text: `a ${O480} b ${OLD} c ${O800}` };
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies({ items: [POST2, NONE] }));
    expect(file(plan, POST2.file).text).toBe(`a ${N480} b ${NEW} c ${N800}`);
    expect(plan.counts.places).toBe(1);
  });
  it('the media entry (with its variants note) moves under the new name; the old key is gone', () => {
    const map = { [OLD]: { alt: 'Hall', variants: [480, 800] }, [OTHER]: { alt: 'Hearing' } };
    const plan = planFileRename(OLD, 'city-hall-vote', withCopies({ map }));
    const moved = JSON.parse(file(plan, 'site/config/media.json').text);
    expect(Object.keys(moved)).toEqual([NEW, OTHER]);
    expect(moved[NEW]).toEqual({ alt: 'Hall', variants: [480, 800] });
  });
  it('refuses a name when a copy of the new name already exists (nothing is overwritten)', () => {
    expect(() => planFileRename(OLD, 'city-hall-vote', withCopies({ taken: [...T, N480] }))).toThrow('city-hall-vote.480w.webp already exists');
  });
  it('does not change its input', () => {
    const o = withCopies({ redirects: [{ from: '/a', to: '/b' }], map: { [OLD]: { alt: 'x' } } });
    const before = JSON.stringify(o);
    planFileRename(OLD, 'city-hall-vote', o);
    expect(JSON.stringify(o)).toBe(before);
  });
  it('a GIF or JPEG never has copies, so it moves alone', () => {
    const J = '/media/2026/11/img-1.jpg';
    const plan = planFileRename(J, 'harbor-fire', base({ taken: [J, '/media/2026/11/img-1.480w.webp'], items: [] }));
    expect(plan.moves).toHaveLength(1);
  });
});
