import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7l (PLAN 34.10, storage): the setting `storage` in config/images.json and its check. Nothing reads the value yet; only "repo" is built.
const SENTENCE = '"storage" must be the text "repo" or "r2" (with quotes), for example "repo"';

describe('the storage setting of config/images.json (Part 7l)', () => {
  it('the shipped file has storage "repo" and passes the check', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.storage).toBe('repo');
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts "repo", "r2" and a missing key', () => {
    for (const v of ['repo', 'r2']) expect(checkImagesConfig({ storage: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses everything else with one plain sentence', () => {
    for (const v of ['', 'REPO', 'R2', 'repo ', 's3', 'cloud', 0, 1, true, false, null, [], ['repo'], {}]) {
      const r = checkImagesConfig({ storage: v });
      expect(r).toHaveLength(1);
      expect(r[0]).toBe(SENTENCE);
    }
  });
  it('the other settings are still checked next to it', () => {
    const r = checkImagesConfig({ storage: 'repo', quality: 0, sizeWarnKb: -1 });
    expect(r).toHaveLength(2);
    expect(r.some((m: string) => m.includes('storage'))).toBe(false);
    expect(checkImagesConfig({ storage: 's3', quality: 0 })).toHaveLength(2);
  });
  it('the script: "repo", "r2" and a missing key pass quietly, a bad value fails with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"storage": "repo"}', '{"storage": "r2"}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('storage'); }
    for (const bad of ['{"storage": "s3"}', '{"storage": 1}', '{"storage": "REPO"}']) {
      const r = go(bad);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('ERROR config/images.json: ' + SENTENCE);
    }
  });
});
