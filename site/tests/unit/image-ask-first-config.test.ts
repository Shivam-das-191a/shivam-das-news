import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7m (PLAN 34.10, automatic or ask first): the setting `askFirst` in config/images.json and its check. Nothing reads the value yet.
const SENTENCE = '"askFirst" must be true or false (without quotes)';

describe('the askFirst setting of config/images.json (Part 7m)', () => {
  it('the shipped file has askFirst false and passes the check', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.askFirst).toBe(false);
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts true, false and a missing key', () => {
    for (const v of [true, false]) expect(checkImagesConfig({ askFirst: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses everything else with one plain sentence', () => {
    for (const v of ['true', 'false', 'yes', '', 0, 1, null, [], [true], {}]) {
      const r = checkImagesConfig({ askFirst: v });
      expect(r).toHaveLength(1);
      expect(r[0]).toBe(SENTENCE);
    }
  });
  it('the other settings are still checked next to it', () => {
    const r = checkImagesConfig({ askFirst: true, quality: 0, storage: 's3' });
    expect(r).toHaveLength(2);
    expect(r.some((m: string) => m.includes('askFirst'))).toBe(false);
    expect(checkImagesConfig({ askFirst: 'yes', quality: 0 })).toHaveLength(2);
  });
  it('the script: true, false and a missing key pass quietly, a bad value fails with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"askFirst": true}', '{"askFirst": false}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('askFirst'); }
    for (const bad of ['{"askFirst": "true"}', '{"askFirst": 1}', '{"askFirst": null}']) {
      const r = go(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('ERROR config/images.json: ' + SENTENCE);
    }
  });
});
