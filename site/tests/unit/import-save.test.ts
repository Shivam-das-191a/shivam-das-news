// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { parseXml, planImport } from '../../public/admin/js/import-xml.js';
// @ts-ignore
import { buildImportFiles, batches, MAX_REDIRECTS, BATCH } from '../../public/admin/js/import-save.js';
// @ts-ignore
import { parse } from '../../public/admin/js/frontmatter.js';
// @ts-ignore
import { GitHub } from '../../public/admin/js/github.js';

const TEXT = 'Hello big world, this is a real looking story text that is long enough for a meta description.';
const esc = (h: string) => h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const withImg = `<p>${TEXT}</p><img src="https://img.test/a.jpg" alt="A picture"/>`;
const entry = (o: { kind?: string; title: string; labels?: string[]; published?: string; draft?: boolean; href?: string; content?: string }) => `
<entry>
  <category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#${o.kind ?? 'post'}"/>
  ${(o.labels ?? []).map((l) => `<category scheme="http://www.blogger.com/atom/ns#" term="${l}"/>`).join('')}
  <published>${o.published ?? '2020-05-01T10:00:00.000-07:00'}</published>
  <title type="text">${o.title}</title>
  <content type="html">${o.content ?? esc(withImg)}</content>
  ${o.draft ? '<app:control xmlns:app="http://purl.org/atom/app#"><app:draft>yes</app:draft></app:control>' : ''}
  ${o.href ? `<link rel="alternate" type="text/html" href="${o.href}"/>` : ''}
</entry>`;
const blogger = (...e: string[]) => `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">${e.join('')}</feed>`;
const planOf = (xml: string, ctx: any = {}) => planImport(parseXml(xml).items, { tz: 'Asia/Kolkata', existing: [], ...ctx });
const ROOT = { root: 'site', author: 'shivam-das', now: '2026-11-14T00:00:00Z' };

describe('buildImportFiles', () => {
  it('writes a live post with its old address in redirects, and the file passes the site rules', () => {
    const plan = planOf(blogger(entry({ title: 'Old Blogger story', labels: ['World', 'Asia'], href: 'https://old.blogspot.com/2020/05/old-blogger-story.html' })));
    const r = buildImportFiles(plan, ROOT);
    expect(r.files).toHaveLength(1);
    expect(r.files[0].path).toBe('site/content/blogs/world/old-blogger-story.md');
    const { data, body } = parse(r.files[0].text);
    expect(data).toMatchObject({ title: 'Old Blogger story', permalink: 'old-blogger-story', category: 'world', tags: ['Asia'], author: 'shivam-das', status: 'published', image: 'https://img.test/a.jpg', imageAlt: 'A picture' });
    expect(data.redirects).toEqual(['/2020/05/old-blogger-story.html']);
    expect(String(data.description).length).toBeGreaterThanOrEqual(50);
    expect(body).toContain('Hello big world');
    expect(r.saved).toMatchObject({ posts: 1, pages: 0, drafts: 0, redirects: 1 });
  });

  it('keeps the old address of a draft post, without using the redirect budget', () => {
    const plan = planOf(blogger(entry({ title: 'A draft story here', labels: ['News'], draft: true, href: 'https://old.blogspot.com/2020/05/draft-story.html' })));
    const r = buildImportFiles(plan, ROOT);
    const { data } = parse(r.files[0].text);
    expect(data.status).toBe('draft');
    expect(data.redirects).toEqual(['/2020/05/draft-story.html']);
    expect(r.saved).toMatchObject({ drafts: 1, redirects: 0 });
  });

  it('skips a post with no category, or saves it as a draft in the chosen category', () => {
    const plan = planOf(blogger(entry({ title: 'No label story here' })));
    const none = buildImportFiles(plan, ROOT);
    expect(none.files).toHaveLength(0);
    expect(none.skipped[0].reason).toContain('No category');
    const some = buildImportFiles(plan, { ...ROOT, fallbackCategory: 'news' });
    expect(some.files[0].path).toBe('site/content/blogs/news/no-label-story-here.md');
    expect(parse(some.files[0].text).data.status).toBe('draft');
    expect(buildImportFiles(plan, { ...ROOT, fallbackCategory: 'Not A Slug' }).files).toHaveLength(0);
  });

  it('writes a page to content/pages and its redirect to config/redirects.json, keeping the old list', () => {
    const plan = planOf(blogger(entry({ kind: 'page', title: 'About us', href: 'https://old.blogspot.com/p/about.html' })));
    const r = buildImportFiles(plan, { ...ROOT, manualRedirects: [{ from: '/a/', to: '/b/' }] });
    expect(r.files.map((f: any) => f.path)).toEqual(['site/content/pages/about.md', 'site/config/redirects.json']);
    expect(parse(r.files[0].text).data).toMatchObject({ title: 'About us', permalink: 'about', status: 'published' });
    expect(JSON.parse(r.files[1].text)).toEqual([{ from: '/a/', to: '/b/' }, { from: '/p/about.html', to: '/2020/05/01/pages/about/' }]);
  });

  it('never overwrites a file that exists, and page permalinks stay unique against existing pages', () => {
    const plan = planOf(blogger(entry({ kind: 'page', title: 'About us', href: 'https://old.blogspot.com/p/about.html' })), { existingPages: ['about'] });
    expect(plan.rows[0].permalink).toBe('about-2');
    const dup = buildImportFiles(plan, { ...ROOT, takenPaths: ['site/content/pages/about-2.md'] });
    expect(dup.files).toHaveLength(0);
    expect(dup.skipped[0].reason).toContain('already exists');
  });

  it('stops writing redirects at the Cloudflare limit and counts the rest', () => {
    const plan = planOf(blogger(entry({ title: 'Story number one', labels: ['News'], href: 'https://old.blogspot.com/2020/05/one.html' }), entry({ title: 'Story number two', labels: ['News'], href: 'https://old.blogspot.com/2020/05/two.html' })));
    const r = buildImportFiles(plan, { ...ROOT, existingRedirects: MAX_REDIRECTS - 1 });
    expect(r.saved).toMatchObject({ posts: 2, redirects: 1, noRedirect: 1 });
    expect(parse(r.files[1].text).data.redirects).toEqual([]);
  });

  it('uses the import time when an item has no date, and skips what the preview skipped', () => {
    const plan = planOf(blogger(entry({ title: 'Dateless story here', labels: ['News'], published: '' }), entry({ title: 'abc' })));
    const r = buildImportFiles(plan, ROOT);
    expect(r.files).toHaveLength(1);
    expect(parse(r.files[0].text).data.date).toBe('2026-11-14T00:00:00Z');
  });

  it('splits a long list into commits of at most BATCH files', () => {
    const files = Array.from({ length: BATCH * 2 + 1 }, (_, i) => ({ path: `f${i}`, text: '' }));
    expect(batches(files).map((b: any) => b.length)).toEqual([BATCH, BATCH, 1]);
    expect(batches([])).toEqual([]);
  });
});

describe('GitHub.commitFiles', () => {
  const run = async (patchStatus = 200) => {
    const calls: { method: string; path: string; body: any }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: any = {}) => {
      const path = new URL(url).pathname;
      calls.push({ method: init.method || 'GET', path, body: init.body ? JSON.parse(init.body) : null });
      const j = (o: any, status = 200) => new Response(JSON.stringify(o), { status });
      if (path.endsWith('/git/ref/heads/main')) return j({ object: { sha: 'parent1' } });
      if (path.endsWith('/git/commits/parent1')) return j({ tree: { sha: 'tree0' } });
      if (path.endsWith('/git/trees')) return j({ sha: 'tree1' });
      if (path.endsWith('/git/commits')) return j({ sha: 'commit1' });
      if (path.endsWith('/git/refs/heads/main')) return patchStatus === 200 ? j({}) : j({ message: 'Update is not a fast forward' }, patchStatus);
      return j({ message: 'unhandled' }, 500);
    }) as any;
    try { return { calls, result: await new GitHub({ token: 't', repo: 'o/r', branch: 'main' }).commitFiles([{ path: 'a/b.md', text: 'x' }], 'msg').catch((e: Error) => e) }; } finally { globalThis.fetch = orig; }
  };
  it('makes one tree, one commit and moves the branch once', async () => {
    const { calls, result } = await run();
    expect(result).toBe('commit1');
    const tree = calls.find((c) => c.path.endsWith('/git/trees'))!;
    expect(tree.body).toEqual({ base_tree: 'tree0', tree: [{ path: 'a/b.md', mode: '100644', type: 'blob', content: 'x' }] });
    expect(calls.find((c) => c.path.endsWith('/git/commits') && c.method === 'POST')!.body).toEqual({ message: 'msg', tree: 'tree1', parents: ['parent1'] });
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ sha: 'commit1', force: false });
  });
  it('gives a plain message when someone else saved in between', async () => {
    const { result } = await run(422);
    expect((result as Error).message).toContain('Someone else saved');
  });
});
