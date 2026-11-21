import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7n (PLAN 34.10, the agency host list): the setting `askHosts` in config/images.json and its check. Nothing reads the list yet.
describe('the askHosts setting of config/images.json (Part 7n)', () => {
  it('the shipped file has an empty askHosts and passes the check', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.askHosts).toEqual([]);
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts website names, an empty list and a missing key', () => {
    expect(checkImagesConfig({ askHosts: ['photos.example.com', 'Agency.example.org'] })).toEqual([]);
    expect(checkImagesConfig({ askHosts: [] })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses a value that is not a list', () => {
    for (const v of ['x.com', 3, null, true, {}]) {
      const r = checkImagesConfig({ askHosts: v });
      expect(r).toEqual(['"askHosts" must be a list of website names such as ["photos.example.com"]']);
    }
  });
  it('checkImagesConfig refuses a bad entry and more than 200 names', () => {
    for (const h of ['https://a.example.com', 'a.example.com/x', 'a b.com', '', 5, null]) {
      const r = checkImagesConfig({ askHosts: ['ok.example.com', h] });
      expect(r).toHaveLength(1);
      expect(r[0]).toContain('"askHosts" entry 2 must be a website name only');
    }
    expect(checkImagesConfig({ askHosts: Array.from({ length: 201 }, (_, i) => `h${i}.example.com`) })).toEqual(['"askHosts" may have at most 200 names']);
  });
  it('a name in both askHosts and blockHosts is refused; in askHosts and allowHosts it is fine', () => {
    expect(checkImagesConfig({ askHosts: ['a.example.com'], blockHosts: ['A.example.com'] })).toEqual(['"a.example.com" is in both "askHosts" and "blockHosts"; keep it in one list']);
    expect(checkImagesConfig({ askHosts: ['a.example.com'], allowHosts: ['a.example.com'] })).toEqual([]);
  });
  it('the script: a good list passes quietly, a bad one fails with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"askHosts": ["agency.example.com"]}', '{"askHosts": []}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('askHosts'); }
    const bad = go('{"askHosts": ["https://agency.example.com"]}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "askHosts" entry 1 must be a website name only');
    const notList = go('{"askHosts": "agency.example.com"}');
    expect(notList.status).toBe(1);
    expect(notList.stdout).toContain('ERROR config/images.json: "askHosts" must be a list of website names');
  });
});
