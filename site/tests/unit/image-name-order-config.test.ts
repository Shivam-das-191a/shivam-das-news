import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs
import { checkImagesConfig, NAME_SOURCES } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7o (PLAN 34.10 and 34.4, the naming order): the setting `nameOrder` in config/images.json and its check. Nothing reads it yet.
const WORDS = 'alt, caption, heading, keyword, oldName, handle';

describe('the nameOrder setting of config/images.json (Part 7o)', () => {
  it('the shipped file has the order of PLAN 34.4 and passes the check', () => {
    const cfg = JSON.parse(readFileSync('config/images.json', 'utf8'));
    expect(cfg.nameOrder).toEqual(['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle']);
    expect(cfg.nameOrder).toEqual(NAME_SOURCES);
    expect(checkImagesConfig(cfg)).toEqual([]);
  });
  it('checkImagesConfig accepts a shorter or reordered list that ends with handle, and a missing key', () => {
    for (const v of [['handle'], ['caption', 'alt', 'handle'], ['keyword', 'heading', 'alt', 'oldName', 'caption', 'handle']]) expect(checkImagesConfig({ nameOrder: v })).toEqual([]);
    expect(checkImagesConfig({})).toEqual([]);
  });
  it('checkImagesConfig refuses a value that is not a list', () => {
    for (const v of ['alt', 3, null, true, {}]) expect(checkImagesConfig({ nameOrder: v })).toEqual([`"nameOrder" must be a list of the words ${WORDS}`]);
  });
  it('checkImagesConfig refuses an unknown or badly written word', () => {
    for (const w of ['title', 'ALT', 'alt ', '', 5, null]) {
      const r = checkImagesConfig({ nameOrder: ['alt', w, 'handle'] });
      expect(r).toEqual([`"nameOrder" entry 2 must be one of ${WORDS}`]);
    }
  });
  it('checkImagesConfig refuses a word listed twice', () => {
    expect(checkImagesConfig({ nameOrder: ['alt', 'caption', 'alt', 'handle'] })).toEqual(['"nameOrder" lists "alt" twice']);
  });
  it('checkImagesConfig refuses a list that does not end with handle (also an empty list)', () => {
    for (const v of [[], ['alt'], ['handle', 'alt'], ['alt', 'caption']]) expect(checkImagesConfig({ nameOrder: v })).toEqual(['"nameOrder" must end with "handle" (the last way to make a name)']);
  });
  it('the other settings are still checked next to it', () => {
    expect(checkImagesConfig({ nameOrder: ['alt', 'handle'], quality: 0 })).toHaveLength(1);
    expect(checkImagesConfig({ nameOrder: ['alt'], quality: 0 })).toHaveLength(2);
  });
  it('the script: a good order passes quietly, bad ones fail with the sentence', () => {
    const d = mkdtempSync(join(tmpdir(), 'vc-'));
    for (const x of ['content/blogs/technology', 'content/pages', 'content/authors', 'config', 'public/media']) mkdirSync(join(d, x), { recursive: true });
    writeFileSync(join(d, 'config/site.json'), JSON.stringify({ siteName: 'S', timeZone: 'UTC' }));
    writeFileSync(join(d, 'config/redirects.json'), '[]');
    const go = (cfg: string) => { writeFileSync(join(d, 'config/images.json'), cfg); return spawnSync('node', [join(process.cwd(), 'scripts/validate-content.mjs'), '--root', d], { encoding: 'utf8', env: { ...process.env, SITE_URL: '' } }); };
    for (const ok of ['{"nameOrder": ["caption", "alt", "handle"]}', '{"nameOrder": ["handle"]}', '{}']) { const r = go(ok); expect(r.status).toBe(0); expect(r.stdout).not.toContain('nameOrder'); }
    const bad = go('{"nameOrder": ["alt", "title", "handle"]}');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('ERROR config/images.json: "nameOrder" entry 2 must be one of ' + WORDS);
    const last = go('{"nameOrder": ["alt", "caption"]}');
    expect(last.status).toBe(1);
    expect(last.stdout).toContain('ERROR config/images.json: "nameOrder" must end with "handle"');
  });
});
