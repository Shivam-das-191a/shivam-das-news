import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';
import { QUALITY } from '../../public/admin/js/image.js';

// Phase 3c Part 7i (PLAN 34.10, quality): the setting `quality` in config/images.json and its check. Nothing reads the value yet (the dashboard will, in a later part).

describe('the quality setting of config/images.json (Part 7i)', () => {
  it('the shipped file has quality 85, the same number as QUALITY of image.js', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.quality).toBe(85);
    expect(cfg.quality).toBe(QUALITY);
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts a whole number from 1 to 100 and a missing key', () => {
    for (const v of [1, 50, 85, 100]) expect(checkImagesConfig({ quality: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses everything else with one plain sentence', () => {
    for (const v of [0, -1, 101, 85.5, '85', null, true, [], {}]) {
      const r = checkImagesConfig({ quality: v });
      expect(r).toHaveLength(1);
      expect(r[0]).toBe('"quality" must be a whole number from 1 to 100 (a percent), for example 85');
    }
  });
  it('the other settings are still checked next to it', () => {
    const r = checkImagesConfig({ quality: 85, sizeWarnKb: -1, maxWidth: 'x' });
    expect(r).toHaveLength(2);
  });
  it('the script: quality 85 and a missing key pass quietly, a bad value fails with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"quality": 85}', '{"quality": 1}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('quality'); }
    for (const bad of ['{"quality": 0}', '{"quality": "85"}', '{"quality": 101}']) {
      const r = go(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('ERROR config/images.json: "quality" must be a whole number from 1 to 100 (a percent), for example 85');
    }
  });
});
