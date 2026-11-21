import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
// @ts-ignore plain .mjs
import { checkPost, checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

const DESC = 'A clear description of this story that is long enough to pass the fifty character minimum.';
const post = (o: Record<string, string> = {}, body = '## First heading\nText.') => {
  const f: Record<string, string> = { title: 'A real story title', permalink: 'a-real-story', category: 'technology', date: '2026-11-12T09:00:00Z', author: 'shivam-das', description: DESC, image: '/media/a.webp', imageAlt: 'A clear alt text', status: 'published', ...o };
  return `---\n${Object.entries(f).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}\n`;
};
const pic = (w: number, h = 100) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 120, b: 200 } } }).webp().toBuffer();

describe('the width warning for pictures (maxWidth, PLAN 34.10, Part 7g)', () => {
  let heads: Record<string, Buffer>;
  const imageHead = (p: string) => heads[p];
  const run = (text: string, extra: Record<string, unknown> = {}) => checkPost({ text, imageExists: () => true, imageHead, maxWidth: 1000, ...extra });

  beforeAll(async () => {
    heads = {
      '/media/a.webp': await pic(400),
      '/media/wide.webp': await pic(1600),
      '/media/wide2.webp': await pic(2400),
      '/media/edge.webp': await pic(1000),
      '/media/notpic.webp': Buffer.from('this is not a picture at all'),
    };
  });

  it('checkImagesConfig accepts a whole number from 0 to 20000 and refuses the rest', () => {
    for (const v of [0, 1, 1600, 20000]) expect(checkImagesConfig({ maxWidth: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
    for (const v of ['1600', -1, 1.5, 20001, null, true]) {
      const r = checkImagesConfig({ maxWidth: v });
      expect(r).toHaveLength(1);
      expect(r[0]).toContain('"maxWidth" must be a whole number of pixels from 0 to 20000');
    }
  });
  it('a too wide top picture is a warning with its file, width and the limit', () => {
    const r = run(post({ image: '/media/wide.webp' }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the image /media/wide.webp is 1600 pixels wide, over the limit of 1000 pixels in config/images.json; make the picture narrower']);
  });
  it('a too wide share picture (ogImage) is a warning too', () => {
    const r = run(post({ ogImage: '/media/wide.webp' }));
    expect(r.warnings).toEqual(['the share picture /media/wide.webp is 1600 pixels wide, over the limit of 1000 pixels in config/images.json; make the picture narrower']);
  });
  it('pictures in the text are measured (Markdown and img), a narrow one and one exactly at the limit are not', () => {
    const r = run(post({}, '## First heading\n![x](/media/wide.webp)\n<img src="/media/wide2.webp" alt="y">\n![n](/media/a.webp)\n![e](/media/edge.webp)'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain('the picture in the text /media/wide.webp is 1600 pixels wide');
    expect(r.warnings[1]).toContain('the picture in the text /media/wide2.webp is 2400 pixels wide');
  });
  it('a file used as the top picture and in the text is reported once', () => {
    const r = run(post({ image: '/media/wide.webp' }, '## First heading\n![x](/media/wide.webp)'));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('the image /media/wide.webp is 1600 pixels wide');
  });
  it('the size warning and the width warning work together: size first, then width', () => {
    const r = run(post({ image: '/media/wide.webp' }), { sizeWarnKb: 1, imageBytes: () => 5 * 1024 });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain('is 5 KB, over the limit of 1 KB');
    expect(r.warnings[1]).toContain('is 1600 pixels wide');
  });
  it('off, a draft, a scheduled post, code, an unknown file and a file that is not a picture give no width warning', () => {
    const body = '## First heading\n![x](/media/wide.webp)';
    expect(run(post({}, body), { maxWidth: 0 }).warnings).toEqual([]);
    expect(run(post({}, body), { maxWidth: undefined }).warnings).toEqual([]);
    expect(run(post({ status: 'draft' }, body)).warnings).toEqual([]);
    expect(run(post({ status: 'scheduled' }, body)).warnings.join('|')).not.toContain('pixels wide');
    expect(run(post({}, '## First heading\n```\n![x](/media/wide.webp)\n```')).warnings).toEqual([]);
    expect(run(post({}, '## First heading\n![x](/media/unknown.webp)')).warnings).toEqual([]);
    expect(run(post({}, '## First heading\n![x](/media/notpic.webp)')).warnings).toEqual([]);
  });
  it('the script: a wide picture warns and still passes; a bigger limit, 0 and a missing key are quiet; a bad value fails', async () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    writeFileSync(join(d, 'public/media/a.webp'), await pic(400));
    writeFileSync(join(d, 'public/media/body.webp'), await pic(1200));
    writeFileSync(join(d, 'content/blogs/technology/a-real-story.md'), post({}, '## First heading\n![x](/media/body.webp)'));
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    const on = go('{"maxWidth": 800}');
    expect(on.status).toBe(0);
    expect(on.stdout).toContain('WARN  content/blogs/technology/a-real-story.md: the picture in the text /media/body.webp is 1200 pixels wide, over the limit of 800 pixels');
    expect(go('{"maxWidth": 1200}').stdout).not.toContain('pixels wide');
    expect(go('{"maxWidth": 0}').stdout).not.toContain('pixels wide');
    expect(go('{}').stdout).not.toContain('pixels wide');
    const bad = go('{"maxWidth": "800"}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "maxWidth" must be a whole number of pixels');
  });
});
