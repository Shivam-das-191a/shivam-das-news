import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { imagesFormValues, imagesFromForm, imagesFileText, imagesChanges } from '../../public/admin/js/images-form.js';
// @ts-ignore
import { imagesDefaults, imagesSettingsOf } from '../../public/admin/js/images-setting.js';
// @ts-ignore build script, plain JS
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const shippedText = src('config/images.json');
const shipped = JSON.parse(shippedText);
const ok = (raw: any, current?: any) => { const r = imagesFromForm(raw, current); expect(r.ok, JSON.stringify(r)).toBe(true); return r.settings; };
const bad = (raw: any, current?: any) => { const r = imagesFromForm(raw, current); expect(r.ok).toBe(false); return r.errors as { key: string; message: string }[]; };

describe('imagesFormValues', () => {
  it('gives the shipped settings as form values: text for numbers, one website per line', () => {
    expect(imagesFormValues(shipped)).toEqual({ enabled: true, askFirst: false, maxWidth: '0', sizeWarnKb: '0', quality: '85', storage: 'repo', askHosts: '', allowHosts: '', blockHosts: '', hardBlock: false, nameOrder: ['alt', 'caption', 'heading', 'keyword', 'oldName', 'handle'] });
    expect(imagesFormValues({ blockHosts: ['a.example.com', 'b.example.com'], maxWidth: 1200 })).toMatchObject({ blockHosts: 'a.example.com\nb.example.com', maxWidth: '1200' });
  });
  it('bad or missing input gives the shipped form values and does not throw', () => {
    for (const x of [null, undefined, [], 'text', 7]) expect(imagesFormValues(x)).toEqual(imagesFormValues(imagesDefaults()));
  });
  it('the form values of any settings go back through imagesFromForm to the same settings (round trip)', () => {
    const many = [shipped, { quality: 60, maxWidth: 1600, sizeWarnKb: 300, storage: 'r2', askFirst: true, enabled: false, hardBlock: true, askHosts: ['agency.example.com'], allowHosts: ['cdn.example.com', 'img.example.org'], blockHosts: ['bad.example.net'], nameOrder: ['caption', 'alt', 'handle'] }];
    for (const s of many) expect(ok(imagesFormValues(s))).toEqual(imagesSettingsOf(s));
  });
});

describe('imagesFromForm: good input', () => {
  it('an empty form changes nothing: it keeps the current settings, or the shipped ones', () => {
    expect(ok({})).toEqual(imagesDefaults());
    expect(ok({}, { quality: 70, blockHosts: ['x.example.com'] })).toEqual(imagesSettingsOf({ quality: 70, blockHosts: ['x.example.com'] }));
    expect(ok(null)).toEqual(imagesDefaults());
  });
  it('only the keys that are given change; the others keep their current value', () => {
    const s = ok({ quality: '60' }, { maxWidth: 900, quality: 70 });
    expect(s.quality).toBe(60);
    expect(s.maxWidth).toBe(900);
  });
  it('reads numbers given as numbers or as text with spaces', () => {
    expect(ok({ quality: ' 85 ', maxWidth: '1200', sizeWarnKb: 300 })).toMatchObject({ quality: 85, maxWidth: 1200, sizeWarnKb: 300 });
    expect(ok({ maxWidth: '0', sizeWarnKb: 0, quality: 1 })).toMatchObject({ maxWidth: 0, sizeWarnKb: 0, quality: 1 });
    expect(ok({ maxWidth: '20000', quality: '100' })).toMatchObject({ maxWidth: 20000, quality: 100 });
  });
  it('website lists: lines, commas or spaces; lower case; repeats and empty lines dropped', () => {
    const s = ok({ blockHosts: 'A.Example.com,\n  b.example.com  \n\na.example.com', allowHosts: ['C.example.com', 'c.example.com'], askHosts: '' });
    expect(s.blockHosts).toEqual(['a.example.com', 'b.example.com']);
    expect(s.allowHosts).toEqual(['c.example.com']);
    expect(s.askHosts).toEqual([]);
  });
  it('the naming order as a list or as comma text', () => {
    expect(ok({ nameOrder: ['caption', 'alt', 'handle'] }).nameOrder).toEqual(['caption', 'alt', 'handle']);
    expect(ok({ nameOrder: 'heading, alt, handle' }).nameOrder).toEqual(['heading', 'alt', 'handle']);
    expect(ok({ nameOrder: ['handle'] }).nameOrder).toEqual(['handle']);
  });
  it('the switches and the storage', () => {
    expect(ok({ enabled: false, askFirst: true, hardBlock: true, storage: 'r2' })).toMatchObject({ enabled: false, askFirst: true, hardBlock: true, storage: 'r2' });
  });
  it('200 names are allowed', () => {
    const names = Array.from({ length: 200 }, (_, i) => `s${i}.example.com`);
    expect(ok({ askHosts: names.join('\n') }).askHosts).toHaveLength(200);
  });
});

describe('imagesFromForm: wrong input is an error with a plain sentence, never repaired', () => {
  it.each(['', '  ', 'abc', '1.0', '85.', '1.5', '1e3', '-5', '0', '101', '500', null, undefined, NaN, 85.5, 0.5, true, [], {}])('quality %j is refused', (v: any) => {
    const e = bad({ quality: v });
    expect(e).toHaveLength(1);
    expect(e[0].key).toBe('quality');
    expect(e[0].message).toBe('Picture quality must be a whole number from 1 to 100 (a percent).');
  });
  it.each(['', 'wide', '-1', '20001', '12.5', null, NaN])('maxWidth and sizeWarnKb %j are refused', (v: any) => {
    expect(bad({ maxWidth: v })[0].message).toContain('from 0 to 20000');
    expect(bad({ sizeWarnKb: v })[0].message).toContain('from 0 to 20000');
  });
  it('storage must be repo or r2', () => {
    for (const v of ['ftp', 'REPO', '', null, 1]) expect(bad({ storage: v })[0].key).toBe('storage');
  });
  it('the switches must be real booleans (not "true", not 1)', () => {
    for (const k of ['enabled', 'askFirst', 'hardBlock']) for (const v of ['true', 'on', 1, 0, null]) expect(bad({ [k]: v })[0].key).toBe(k);
  });
  it('a website name that is not a clean name is named in the sentence', () => {
    const e = bad({ blockHosts: 'good.example.com\nhttps://bad.example.com/x\nnospaces ok.com' });
    expect(e.length).toBeGreaterThanOrEqual(1);
    expect(e[0].message).toContain('"https://bad.example.com/x"');
    expect(e[0].message).toContain('no https://');
    for (const v of [42, { a: 1 }, null]) expect(bad({ askHosts: v })[0].message).toContain('must be a list of website names');
    expect(bad({ allowHosts: ['ok.example.com', 5] })[0].message).toContain('entry 2 is not a website name');
  });
  it('more than 200 names are refused', () => {
    const names = Array.from({ length: 201 }, (_, i) => `s${i}.example.com`);
    expect(bad({ blockHosts: names })[0].message).toContain('at most 200');
  });
  it('a long bad name is cut in the sentence', () => {
    const e = bad({ blockHosts: 'x'.repeat(500) + '!' });
    expect(e[0].message.length).toBeLessThan(260);
  });
  it('a website in two lists is refused, also when one list is kept from the current settings', () => {
    expect(bad({ allowHosts: 'a.example.com', blockHosts: 'A.example.com' })[0].message).toContain('is in both');
    expect(bad({ askHosts: 'a.example.com', blockHosts: 'a.example.com' })[0].message).toContain('is in both');
    expect(bad({ allowHosts: 'a.example.com' }, { blockHosts: ['a.example.com'] })[0].key).toBe('allowHosts');
    expect(ok({ allowHosts: 'a.example.com', askHosts: 'a.example.com' }).askHosts).toEqual(['a.example.com']); // ask and allow together are fine, as in the build check
  });
  it('the naming order: wrong word, repeat, empty, not ending with handle, not a list', () => {
    expect(bad({ nameOrder: ['alt', 'photo', 'handle'] })[0].message).toContain('entry 2 must be one of');
    expect(bad({ nameOrder: ['alt', 'alt', 'handle'] })[0].message).toContain('"alt" is listed twice');
    expect(bad({ nameOrder: [] })[0].message).toContain('must be a list of these words');
    expect(bad({ nameOrder: 'alt, caption' })[0].message).toContain('must end with "handle"');
    expect(bad({ nameOrder: 5 })[0].key).toBe('nameOrder');
    expect(bad({ nameOrder: ['alt', 3, 'handle'] })[0].message).toContain('entry 2');
  });
  it('every wrong key gives its own error (one error each) and the good keys are not lost in the report', () => {
    const e = bad({ quality: 'x', maxWidth: '-1', storage: 'ftp', enabled: 'yes', nameOrder: ['alt'], blockHosts: 'a.example.com', allowHosts: 'a.example.com' });
    expect(e.map((x) => x.key).sort()).toEqual(['allowHosts', 'enabled', 'maxWidth', 'nameOrder', 'quality', 'storage']);
  });
  it('a wrong value does not stop the check of the other keys, and nothing throws', () => {
    for (const raw of [null, undefined, 5, 'text', [], { quality: Symbol.iterator as any }, { toString: 1 }, Object.create(null)]) expect(() => imagesFromForm(raw as any)).not.toThrow();
  });
  it('no sentence has an emoji or a non-ASCII character', () => {
    const e = bad({ quality: 'x', maxWidth: 'x', sizeWarnKb: 'x', storage: 'x', enabled: 'x', askFirst: 'x', hardBlock: 'x', blockHosts: 'bad name', nameOrder: ['x'] });
    for (const x of e) expect(/[^\x20-\x7E]/.test(x.message)).toBe(false);
  });
  it('the inputs are never changed', () => {
    const raw = { quality: '60', blockHosts: 'B.example.com\nA.example.com', nameOrder: ['caption', 'handle'] };
    const cur = { quality: 70, allowHosts: ['c.example.com'] };
    const r = JSON.parse(JSON.stringify(raw)), c = JSON.parse(JSON.stringify(cur));
    imagesFromForm(raw, cur);
    expect(raw).toEqual(r);
    expect(cur).toEqual(c);
  });
});

describe('the form and the build check say the same thing', () => {
  it('quality, maxWidth, sizeWarnKb: for many raw values, the form accepts exactly what the build check accepts', () => {
    const raws: any[] = ['0', '1', '85', '100', '101', '-1', '1.5', 'abc', '', ' 60 ', 0, 1, 99, 100, 101, 20000, 20001, 85.5, null, '20000', '20001', '000085'];
    for (const k of ['quality', 'maxWidth', 'sizeWarnKb']) {
      for (const v of raws) {
        const form = imagesFromForm({ [k]: v });
        if (form.ok) expect(checkImagesConfig(form.settings), `${k} ${JSON.stringify(v)}`).toEqual([]);
        // and the other way: when the form refuses, the number it would have meant is not a good one for the build check either
        else {
          const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,6}\s*$/.test(v) ? Number(v.trim()) : NaN;
          expect(checkImagesConfig({ [k]: n }).length, `${k} ${JSON.stringify(v)}`).toBeGreaterThan(0);
        }
      }
    }
  });
  it('whatever the form accepts, the build check accepts the file text', () => {
    const cases: any[] = [
      {}, { quality: '1' }, { maxWidth: '1600', sizeWarnKb: '300' }, { blockHosts: 'a.example.com\nb.example.com', allowHosts: 'c.example.com', askHosts: 'd.example.com' },
      { nameOrder: ['handle'] }, { nameOrder: 'caption,alt,handle' }, { storage: 'r2', enabled: false, askFirst: true, hardBlock: true },
    ];
    for (const raw of cases) {
      const s = ok(raw);
      const text = imagesFileText(s);
      expect(checkImagesConfig(JSON.parse(text)), JSON.stringify(raw)).toEqual([]);
    }
  });
  it('lists: a website in two of the lists is refused by the form exactly where the build check refuses it', () => {
    const pairs: [string, string][] = [['allowHosts', 'blockHosts'], ['askHosts', 'blockHosts'], ['allowHosts', 'askHosts']];
    for (const [a, b] of pairs) {
      const raw = { [a]: 'x.example.com', [b]: 'x.example.com' };
      const form = imagesFromForm(raw);
      const build = checkImagesConfig({ [a]: ['x.example.com'], [b]: ['x.example.com'] });
      expect(form.ok).toBe(build.length === 0);
    }
  });
  it('names: the form refuses exactly the website names that the build check refuses', () => {
    for (const n of ['photos.example.com', 'a', 'a-b.example.org', '-bad.com', 'bad-.com', 'a..b.com', 'UPPER.COM', 'with space.com', 'https://x.com', 'x.com/path', 'x.com:80', 'ünï.com', '1.2.3.4']) {
      const form = imagesFromForm({ blockHosts: [n] });
      const build = checkImagesConfig({ blockHosts: [n] });
      expect(form.ok, n).toBe(build.length === 0);
    }
  });
});

describe('imagesFileText', () => {
  it('the shipped settings give exactly the keys and values of the shipped file, in the same order, two-space indent, one newline at the end', () => {
    const t = imagesFileText(shipped);
    expect(JSON.parse(t)).toEqual(shipped);
    expect(Object.keys(JSON.parse(t))).toEqual(Object.keys(shipped));
    expect(t.endsWith('}\n')).toBe(true);
    expect(t.endsWith('\n\n')).toBe(false);
    expect(t).toContain('\n  "hardBlock": false,\n');
  });
  it('writes the new values', () => {
    const t = JSON.parse(imagesFileText(ok({ quality: '60', blockHosts: 'a.example.com' })));
    expect(t.quality).toBe(60);
    expect(t.blockHosts).toEqual(['a.example.com']);
  });
  it('keeps the keys of the current file that it does not know, after the known ones, with their values', () => {
    const cur = JSON.stringify({ quality: 70, futureSetting: { a: [1, 2] }, another: 'x', enabled: true });
    const t = JSON.parse(imagesFileText(imagesDefaults(), cur));
    expect(Object.keys(t).slice(-2)).toEqual(['futureSetting', 'another']);
    expect(t.futureSetting).toEqual({ a: [1, 2] });
    expect(t.quality).toBe(85); // the new settings win over the current file for the known keys
  });
  it('a bad current file or a missing one writes only the known keys, and nothing throws', () => {
    for (const cur of [undefined, null, '', '{ bad', '[1]', '"x"', 5]) {
      expect(() => imagesFileText(imagesDefaults(), cur as any)).not.toThrow();
      expect(Object.keys(JSON.parse(imagesFileText(imagesDefaults(), cur as any)))).toEqual(Object.keys(shipped));
    }
  });
  it('a key named __proto__ in the current file is not copied', () => {
    const t = imagesFileText(imagesDefaults(), '{"__proto__": {"x": 1}, "keepme": 1}');
    expect(t).not.toContain('__proto__');
    expect(JSON.parse(t).keepme).toBe(1);
  });
  it('bad settings are repaired to their shipped values (the file is always one that passes the build check)', () => {
    const t = imagesFileText({ quality: 999, storage: 'ftp', blockHosts: ['Bad Name'] });
    expect(checkImagesConfig(JSON.parse(t))).toEqual([]);
    expect(JSON.parse(t).quality).toBe(85);
  });
});

describe('imagesChanges', () => {
  it('nothing changes: an empty list', () => {
    expect(imagesChanges(shipped, shipped)).toEqual([]);
    expect(imagesChanges(null, imagesDefaults())).toEqual([]);
  });
  it('lists each setting whose words change, with the old and the new words', () => {
    const c = imagesChanges(shipped, ok({ quality: '60', maxWidth: '1200', hardBlock: true, blockHosts: 'a.example.com' }));
    expect(c.map((x: any) => x.key)).toEqual(['maxWidth', 'quality', 'blockHosts', 'hardBlock']);
    expect(c[0]).toEqual({ key: 'maxWidth', label: 'Widest picture', from: 'No limit', to: '1200 px' });
    expect(c[1]).toEqual({ key: 'quality', label: 'Picture quality', from: '85 of 100', to: '60 of 100' });
    expect(c[3]).toEqual({ key: 'hardBlock', label: 'Outside pictures at publish', from: 'Warning only', to: 'Error' });
  });
  it('a change of the naming order is listed', () => {
    const c = imagesChanges(shipped, ok({ nameOrder: ['caption', 'alt', 'handle'] }));
    expect(c).toHaveLength(1);
    expect(c[0].key).toBe('nameOrder');
  });
  it('bad input does not throw', () => {
    expect(() => imagesChanges(null, 5 as any)).not.toThrow();
  });
});

describe('the file itself', () => {
  const file = src('public/admin/js/images-form.js');
  it('has no emoji or other non-ASCII character', () => { expect(/[^\x00-\x7F]/.test(file)).toBe(false); });
  it('has no page, fetch, storage, GitHub write, token or HTML', () => {
    expect(file).not.toMatch(/\bdocument\b|\bwindow\b|\bfetch\s*\(|localStorage|sessionStorage|indexedDB|innerHTML|insertAdjacentHTML/);
    expect(file).not.toMatch(/\.put\(|\.remove\(|\.commit|putFile|putText/);
    expect(file).not.toMatch(/token|secret/i);
  });
  it('is used only by images-form-screen.js (the form page), and by no other file', () => {
    expect(src('public/admin/js/images-form-screen.js')).toContain("from './images-form.js'");
    for (const f of ['app.js', 'images-screen.js', 'images-setting.js', 'hosting-hook.js', 'hosting-save.js', 'hosting-setup.js', 'hosting-screen.js', 'files-screen.js', 'main.js']) {
      expect(src('public/admin/js/' + f)).not.toContain("'./images-form.js'");
    }
  });
});
