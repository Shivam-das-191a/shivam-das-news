// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { collectImages, stemOf, mediaPath, downloadAll, applyImages, chunks, CHUNK, MIN_FEATURED_WIDTH } from '../../public/admin/js/import-images.js';
// @ts-ignore
import { GitHub } from '../../public/admin/js/github.js';

const row = (o: any = {}) => ({ kind: 'post', status: 'published', skip: '', issues: [] as string[], newUrl: '/x/', markdown: '', images: [] as any[], image: '', ...o });
const bytes = new Uint8Array([1, 2, 3]);

describe('collectImages and names', () => {
  it('lists each remote address once, skips skipped items, local paths and already re-hosted images', () => {
    const rows = [
      row({ images: [{ src: 'https://a.test/1.jpg' }, { src: '/media/x.webp' }, { src: 'https://a.test/1.jpg' }] }),
      row({ skip: 'No title', images: [{ src: 'https://a.test/skipped.jpg' }] }),
      row({ images: [{ src: 'https://a.test/2.jpg', local: '/media/imported/2.webp' }, { src: 'https://a.test/3.png' }] }),
    ];
    expect(collectImages(rows)).toEqual(['https://a.test/1.jpg', 'https://a.test/3.png']);
  });
  it('makes a plain lowercase name and a unique path under public/media/imported', () => {
    expect(stemOf('https://x.test/s1600/My%20Photo_Final.JPG?x=1')).toBe('my-photo-final');
    expect(stemOf('https://x.test/')).toBe('image');
    const taken = new Set<string>();
    expect(mediaPath('site', 'https://x.test/a/pic.jpg', 'webp', taken)).toBe('site/public/media/imported/pic.webp');
    expect(mediaPath('site', 'https://y.test/b/pic.png', 'webp', taken)).toBe('site/public/media/imported/pic-2.webp');
  });
  it('splits into chunks', () => { expect(chunks(Array.from({ length: CHUNK + 1 }, (_, i) => i)).map((c: any) => c.length)).toEqual([CHUNK, 1]); });
});

describe('downloadAll', () => {
  it('downloads once, reports failures with a reason, and never gives two files one path', async () => {
    const calls: string[] = [];
    const fetchImage = async (u: string) => { calls.push(u); if (u.includes('bad')) throw new Error('HTTP 403'); return { bytes, ext: 'webp', width: 1600 }; };
    const r = await downloadAll(['https://a.test/p.jpg', 'https://b.test/p.jpg', 'https://a.test/bad.jpg'], fetchImage, { root: 'site', taken: new Set() });
    expect(calls).toHaveLength(3);
    expect(r.failed).toEqual([{ url: 'https://a.test/bad.jpg', reason: 'HTTP 403' }]);
    expect(new Set(r.files.map((f: any) => f.path)).size).toBe(2);
    expect(r.map.get('https://a.test/p.jpg').src).toMatch(/^\/media\/imported\/p(-2)?\.webp$/);
  });
  it('counts an empty file as a failure', async () => {
    const r = await downloadAll(['https://a.test/e.jpg'], async () => ({ bytes: new Uint8Array(), ext: 'webp', width: 10 }), { root: 'site' });
    expect(r.failed[0].reason).toBe('empty file');
  });
});

describe('applyImages', () => {
  const map = (w: number | null) => new Map([['https://a.test/p (1).jpg', { path: 'site/public/media/imported/p.webp', src: '/media/imported/p.webp', width: w }]]);
  const make = () => row({ markdown: 'Text\n\n![Pic](https://a.test/p%20%281%29.jpg)\n', images: [{ src: 'https://a.test/p (1).jpg', alt: 'Pic' }], image: 'https://a.test/p (1).jpg' });
  it('rewrites the Markdown image and the featured image, and marks the image as re-hosted', () => {
    const r = make(); applyImages([r], map(1600));
    expect(r.markdown).toBe('Text\n\n![Pic](/media/imported/p.webp)\n');
    expect(r.image).toBe('/media/imported/p.webp');
    expect(r.images[0].local).toBe('/media/imported/p.webp');
    expect(r.status).toBe('published');
    expect(collectImages([r])).toEqual([]);
  });
  it('turns a published post into a draft when the featured image is under 1200 px', () => {
    const r = make(); applyImages([r], map(MIN_FEATURED_WIDTH - 1));
    expect(r.status).toBe('draft'); expect(r.newUrl).toBe('');
    expect(r.issues[0]).toContain('only 1199 px');
  });
  it('only notes it when the width is unknown, and leaves a failed image alone', () => {
    const r = make(); applyImages([r], map(null));
    expect(r.status).toBe('published'); expect(r.issues[0]).toContain('could not be checked');
    const q = make(); applyImages([q], new Map());
    expect(q.markdown).toContain('https://a.test/p%20%281%29.jpg'); expect(q.image).toBe('https://a.test/p (1).jpg');
  });
});

describe('GitHub.commitFiles with an image', () => {
  it('makes a base64 blob for bytes and uses its sha in the tree', async () => {
    const calls: { method: string; path: string; body: any }[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: any = {}) => {
      const path = new URL(url).pathname;
      calls.push({ method: init.method || 'GET', path, body: init.body ? JSON.parse(init.body) : null });
      const j = (o: any) => new Response(JSON.stringify(o));
      if (path.endsWith('/git/ref/heads/main')) return j({ object: { sha: 'p1' } });
      if (path.endsWith('/git/commits/p1')) return j({ tree: { sha: 't0' } });
      if (path.endsWith('/git/blobs')) return j({ sha: 'blob1' });
      if (path.endsWith('/git/trees')) return j({ sha: 't1' });
      if (path.endsWith('/git/commits')) return j({ sha: 'c1' });
      return j({});
    }) as any;
    try { await new GitHub({ token: 't', repo: 'o/r', branch: 'main' }).commitFiles([{ path: 'm/a.webp', bytes }, { path: 'a.md', text: 'x' }], 'm'); } finally { globalThis.fetch = orig; }
    expect(calls.find((c) => c.path.endsWith('/git/blobs'))!.body).toEqual({ content: 'AQID', encoding: 'base64' });
    expect(calls.find((c) => c.path.endsWith('/git/trees'))!.body.tree).toEqual([
      { path: 'm/a.webp', mode: '100644', type: 'blob', sha: 'blob1' },
      { path: 'a.md', mode: '100644', type: 'blob', content: 'x' },
    ]);
  });
});
