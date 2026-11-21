import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { imagesDefaults, imagesSettingsOf, imagesSettingsFromText, readImagesSettings, NAME_SOURCES as DASH_SOURCES, HOST_NAME as DASH_HOST } from '../../public/admin/js/images-setting.js';
// @ts-ignore plain .mjs
import { NAME_SOURCES, HOST_NAME, checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

// Phase 3c Part 7q (PLAN 34.10): the dashboard reader of ALL the settings of config/images.json. Nothing calls it yet.
const CFG = { contentRoot: 'site' };
const shipped = () => JSON.parse(readFileSync('config/images.json', 'utf8'));

describe('imagesDefaults', () => {
  it('equals the shipped file, so the two can not drift apart', () => {
    expect(imagesDefaults()).toEqual(shipped());
  });
  it('passes the build check and gives a fresh object each time', () => {
    expect(checkImagesConfig(imagesDefaults())).toEqual([]);
    const a = imagesDefaults(); a.blockHosts.push('x.com'); a.nameOrder.length = 0;
    expect(imagesDefaults().blockHosts).toEqual([]);
    expect(imagesDefaults().nameOrder).toHaveLength(6);
  });
  it('the six naming words are the same as in the build script', () => {
    expect(DASH_SOURCES).toEqual(NAME_SOURCES);
  });
  it('the website name rule is the same as in the build script', () => {
    expect(DASH_HOST.source).toBe(HOST_NAME.source);
  });
});

describe('imagesSettingsOf', () => {
  it('gives the shipped file back unchanged', () => {
    expect(imagesSettingsOf(shipped())).toEqual(shipped());
  });
  it('gives all shipped values for anything that is not an object', () => {
    for (const s of [null, undefined, 5, 'x', [], true]) expect(imagesSettingsOf(s as any)).toEqual(imagesDefaults());
    expect(imagesSettingsOf({})).toEqual(imagesDefaults());
  });
  it('keeps good values', () => {
    const good = { hardBlock: true, blockHosts: ['bad.test'], allowHosts: ['cdn.own.test'], sizeWarnKb: 300, maxWidth: 1600, quality: 70, storage: 'r2', askFirst: true, askHosts: ['agency.test'], nameOrder: ['caption', 'alt', 'handle'], enabled: false };
    expect(imagesSettingsOf(good)).toEqual(good);
  });
  it('checks every setting alone: one bad value does not spoil the others', () => {
    const r = imagesSettingsOf({ hardBlock: 'yes', quality: 500, sizeWarnKb: -1, maxWidth: 1.5, storage: 's3', askFirst: 1, enabled: null, nameOrder: ['alt'], askHosts: 'x.com', blockHosts: ['ok.test'], allowHosts: 7 });
    expect(r).toEqual({ ...imagesDefaults(), blockHosts: ['ok.test'] });
    expect(imagesSettingsOf({ quality: 60, hardBlock: 'yes' })).toEqual({ ...imagesDefaults(), quality: 60 });
  });
  it('lists: bad names are dropped, names are lower cased, repeats dropped, at most 200 kept', () => {
    expect(imagesSettingsOf({ blockHosts: ['  Photos.Example.com ', 'https://x.com', 'a b.com', '', 5, null, 'photos.example.com', 'ok.test'] }).blockHosts).toEqual(['photos.example.com', 'ok.test']);
    expect(imagesSettingsOf({ askHosts: ['Agency.Test', ' CDN.Own.Test '] }).askHosts).toEqual(['agency.test', 'cdn.own.test']);
    const many = Array.from({ length: 250 }, (_, i) => `h${i}.example.com`);
    expect(imagesSettingsOf({ askHosts: many }).askHosts).toHaveLength(200);
    expect(HOST_NAME.test('photos.example.com')).toBe(true);
  });
  it('the naming order is taken whole or not at all', () => {
    for (const v of [[], ['alt'], ['handle', 'alt'], ['alt', 'alt', 'handle'], ['title', 'handle'], 'alt', null, [...NAME_SOURCES, 'alt']]) expect(imagesSettingsOf({ nameOrder: v }).nameOrder).toEqual(NAME_SOURCES);
    expect(imagesSettingsOf({ nameOrder: ['handle'] }).nameOrder).toEqual(['handle']);
  });
  it('never changes its input', () => {
    const input = { blockHosts: ['A.test'], nameOrder: ['alt', 'handle'] };
    const copy = JSON.parse(JSON.stringify(input));
    imagesSettingsOf(input);
    expect(input).toEqual(copy);
  });
});

describe('imagesSettingsFromText and readImagesSettings', () => {
  it('read the text of the file; bad text gives all shipped values', () => {
    expect(imagesSettingsFromText('{ "quality": 70, "enabled": false }')).toEqual({ ...imagesDefaults(), quality: 70, enabled: false });
    for (const t of ['', '   ', 'not json', '[1]', 'null', '5', undefined, null, 7]) expect(imagesSettingsFromText(t as any)).toEqual(imagesDefaults());
  });
  it('readImagesSettings reads the file by its path and never throws', async () => {
    const gh: any = { getText: vi.fn().mockResolvedValue({ text: '{ "askFirst": true, "maxWidth": 1200 }', sha: 'x' }) };
    expect(await readImagesSettings(gh, CFG)).toEqual({ ...imagesDefaults(), askFirst: true, maxWidth: 1200 });
    expect(gh.getText).toHaveBeenCalledWith('site/config/images.json');
    const d = imagesDefaults();
    expect(await readImagesSettings({ getText: vi.fn().mockRejectedValue(new Error('404')) } as any, CFG)).toEqual(d);
    expect(await readImagesSettings({ getText: vi.fn().mockResolvedValue(null) } as any, CFG)).toEqual(d);
    expect(await readImagesSettings({ getText: vi.fn().mockResolvedValue({ text: 'oops' }) } as any, CFG)).toEqual(d);
    expect(await readImagesSettings({} as any, CFG)).toEqual(d);
    expect(await readImagesSettings(null as any, CFG)).toEqual(d);
  });
});
