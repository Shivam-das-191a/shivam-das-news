import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7p (PLAN 34.10, on or off): the setting `enabled` in config/images.json and its check. Nothing reads the value yet.
const SENTENCE = '"enabled" must be true or false (without quotes)';

describe('the enabled setting of config/images.json (Part 7p)', () => {
  it('the shipped file has enabled true and passes the check', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.enabled).toBe(true);
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts true, false and a missing key', () => {
    for (const v of [true, false]) expect(checkImagesConfig({ enabled: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses everything else with one plain sentence', () => {
    for (const v of ['true', 'false', 'on', 'off', '', 0, 1, null, [], [true], {}]) {
      const r = checkImagesConfig({ enabled: v });
      expect(r).toHaveLength(1);
      expect(r[0]).toBe(SENTENCE);
    }
  });
  it('the other settings are still checked next to it', () => {
    const r = checkImagesConfig({ enabled: false, quality: 0, storage: 's3' });
    expect(r).toHaveLength(2);
    expect(r.some((m: string) => m.includes('"enabled"'))).toBe(false);
    expect(checkImagesConfig({ enabled: 'on', quality: 0 })).toHaveLength(2);
  });
  it('the script: true, false and a missing key pass quietly, a bad value fails with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"enabled": true}', '{"enabled": false}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('"enabled"'); }
    for (const bad of ['{"enabled": "on"}', '{"enabled": 1}', '{"enabled": null}']) {
      const r = go(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('ERROR config/images.json: ' + SENTENCE);
    }
  });
});
