// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { imagesScreen, imagesRows, NAME_WORDS, USE_WORDS } from '../../public/admin/js/images-screen.js';
// @ts-ignore
import { NAME_SOURCES, imagesDefaults } from '../../public/admin/js/images-setting.js';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const shipped = JSON.parse(src('config/images.json'));
const qa = (root: ParentNode, k: string) => [...root.querySelectorAll(`[data-f="${k}"]`)] as any[];
const q = (root: ParentNode, k: string) => root.querySelector(`[data-f="${k}"]`) as any;
const row = (rows: any[], key: string) => rows.find((r) => r.key === key);

const ORDER = ['enabled', 'askFirst', 'maxWidth', 'sizeWarnKb', 'quality', 'storage', 'askHosts', 'allowHosts', 'blockHosts', 'hardBlock', 'nameOrder'];

beforeEach(() => { document.body.innerHTML = ''; });

describe('the rows', () => {
  it('there are eleven rows, one for every key of the shipped config/images.json, in the order of the plan', () => {
    const rows = imagesRows(shipped);
    expect(rows.map((r: any) => r.key)).toEqual(ORDER);
    expect([...ORDER].sort()).toEqual(Object.keys(shipped).sort());
  });
  it('the shipped values read as plain words', () => {
    const rows = imagesRows(shipped);
    expect(row(rows, 'enabled').value).toBe('On');
    expect(row(rows, 'askFirst').value).toBe('Automatic');
    expect(row(rows, 'maxWidth').value).toBe('No limit');
    expect(row(rows, 'sizeWarnKb').value).toBe('No limit');
    expect(row(rows, 'quality').value).toBe('85 of 100');
    expect(row(rows, 'storage').value).toBe('In the repository');
    expect(row(rows, 'askHosts').value).toBe('None');
    expect(row(rows, 'allowHosts').value).toBe('None');
    expect(row(rows, 'blockHosts').value).toBe('None');
    expect(row(rows, 'hardBlock').value).toBe('Warning only');
    expect(row(rows, 'nameOrder').value).toBe('alt text, then caption, then nearest heading, then focus keyword and title words, then old file name, then post handle and a number');
  });
  it('values that are not the shipped ones read correctly', () => {
    const rows = imagesRows({ enabled: false, askFirst: true, maxWidth: 1200, sizeWarnKb: 500, quality: 70, storage: 'r2', hardBlock: true });
    expect(row(rows, 'enabled').value).toBe('Off');
    expect(row(rows, 'askFirst').value).toBe('Ask first');
    expect(row(rows, 'maxWidth').value).toBe('1200 px');
    expect(row(rows, 'sizeWarnKb').value).toBe('500 KB');
    expect(row(rows, 'quality').value).toBe('70 of 100');
    expect(row(rows, 'storage').value).toBe('Cloudflare R2 (not built yet)');
    expect(row(rows, 'hardBlock').value).toBe('Error');
  });
  it('a website list shows its names; more than ten show ten and the count of the rest', () => {
    const three = imagesRows({ blockHosts: ['a.example.com', 'b.example.com', 'c.example.com'] });
    expect(row(three, 'blockHosts').value).toBe('a.example.com, b.example.com, c.example.com');
    const many = Array.from({ length: 12 }, (_, i) => `site${i + 1}.example.com`);
    const twelve = row(imagesRows({ askHosts: many }), 'askHosts').value;
    expect(twelve.startsWith('site1.example.com, site2.example.com')).toBe(true);
    expect(twelve).toContain('site10.example.com');
    expect(twelve).not.toContain('site11.example.com');
    expect(twelve.endsWith('and 2 more')).toBe(true);
    expect(row(imagesRows({ allowHosts: ['cdn.example.com'] }), 'allowHosts').value).toBe('cdn.example.com');
  });
  it('a changed naming order shows its words in that order', () => {
    const v = row(imagesRows({ nameOrder: ['caption', 'alt', 'handle'] }), 'nameOrder').value;
    expect(v).toBe('caption, then alt text, then post handle and a number');
  });
  it('NAME_WORDS has a plain word for each of the six naming ways and no other', () => {
    expect(Object.keys(NAME_WORDS).sort()).toEqual([...NAME_SOURCES].sort());
    for (const w of Object.values(NAME_WORDS) as string[]) expect(w).toMatch(/^[a-z ]+$/);
  });
});

describe('bad input', () => {
  const same = imagesRows(imagesDefaults());
  it.each([[null], [undefined], [[]], ['text'], [42], [true]])('%s gives the shipped values and does not throw', (bad: any) => {
    expect(() => imagesRows(bad)).not.toThrow();
    expect(imagesRows(bad)).toEqual(same);
  });
  it('a wrong value gives its shipped words and does not spoil the other rows', () => {
    const rows = imagesRows({ quality: 500, maxWidth: -3, storage: 'ftp', hardBlock: 'yes', sizeWarnKb: 700 });
    expect(row(rows, 'quality').value).toBe('85 of 100');
    expect(row(rows, 'maxWidth').value).toBe('No limit');
    expect(row(rows, 'storage').value).toBe('In the repository');
    expect(row(rows, 'hardBlock').value).toBe('Warning only');
    expect(row(rows, 'sizeWarnKb').value).toBe('700 KB');
  });
  it('the input is never changed', () => {
    const input = { quality: 60, blockHosts: ['Bad Name', 'ok.example.com'], nameOrder: ['alt', 'handle'] };
    const copy = JSON.parse(JSON.stringify(input));
    imagesRows(input);
    expect(input).toEqual(copy);
  });
});

describe('what each row says about today', () => {
  it('every row has a label, a help sentence and a use that has words', () => {
    for (const r of imagesRows(shipped)) {
      expect(r.label.length).toBeGreaterThan(2);
      expect(r.help.length).toBeGreaterThan(10);
      expect(Object.keys(USE_WORDS)).toContain(r.use);
    }
  });
  it('the build rows are the ones the build check really reads', () => {
    const build = src('scripts/validate-content.mjs');
    for (const r of imagesRows(shipped)) {
      const read = new RegExp(`\\b${r.key}\\b`).test(build);
      expect(['build', 'buildSave', 'buildSaveOwn'].includes(r.use)).toBe(read); // Parts 7aa and 7ab: blockHosts and allowHosts are read by the build check and by the Save
    }
  });
  it('the quality, enabled, nameOrder, askHosts, askFirst, blockHosts and allowHosts rows are the ones the Save of the editor reads', () => {
    const hook = src('public/admin/js/hosting-hook.js');
    expect(row(imagesRows(shipped), 'quality').use).toBe('quality');
    expect(row(imagesRows(shipped), 'enabled').use).toBe('save');
    expect(hook).toContain('quality');
    expect(hook).toContain('readImagesForSave');
    expect(src('public/admin/js/images-setting.js')).toMatch(/p\.enabled === false/);
    expect(row(imagesRows(shipped), 'nameOrder').use).toBe('name'); // Part 7x: the Save gives the naming order to the picture names
    expect(hook).toContain('nameOrder');
    expect(row(imagesRows(shipped), 'askHosts').use).toBe('ask'); // Part 7y: the Save adds these websites to the agency list
    expect(row(imagesRows(shipped), 'askFirst').use).toBe('askFirst'); // Part 7z: the Save makes every picture that is not hosted yet wait
    expect(hook).toContain('askFirst');
    expect(row(imagesRows(shipped), 'blockHosts').use).toBe('buildSave'); // Part 7aa: the Save refuses pictures from these websites
    expect(hook).toContain('blockHosts');
    expect(row(imagesRows(shipped), 'allowHosts').use).toBe('buildSaveOwn'); // Part 7ab: the Save counts these websites as ours
    expect(hook).toContain('allowHosts');
    expect(row(imagesRows(shipped), 'storage').use).toBe('none');
    expect(new RegExp('\\bstorage\\b').test(hook)).toBe(false);
  });
});

describe('the screen', () => {
  it('draws eleven rows with a label, a value, a help line and a use line', () => {
    const s = imagesScreen({ settings: shipped });
    document.body.append(s.el);
    const rows = qa(s.el, 'row');
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.getAttribute('data-key'))).toEqual(ORDER);
    for (const r of rows) {
      for (const f of ['label', 'value', 'help', 'use']) expect(q(r, f).textContent.length).toBeGreaterThan(0);
    }
    expect(q(rows[4], 'value').textContent).toBe('85 of 100');
    expect(q(rows[4], 'use').textContent).toBe(USE_WORDS.quality);
  });
  it('is read only: no button, input, select, textarea, form or link', () => {
    const s = imagesScreen({ settings: shipped });
    expect(s.el.querySelectorAll('button, input, select, textarea, form, a')).toHaveLength(0);
    expect(q(s.el, 'intro').textContent).toContain('only shows them');
    expect(q(s.el, 'intro').textContent).toContain('config/images.json');
  });
  it('called with nothing, it shows the shipped values', () => {
    expect(() => imagesScreen()).not.toThrow();
    const s = imagesScreen(null as any);
    expect(qa(s.el, 'row')).toHaveLength(11);
    expect(q(qa(s.el, 'row')[1], 'value').textContent).toBe('Automatic');
  });
  it('the note is hidden unless it is given, and is shown as text', () => {
    expect(q(imagesScreen({ settings: shipped }).el, 'note').hidden).toBe(true);
    const s = imagesScreen({ settings: shipped, note: '<img src=x onerror=alert(1)>' });
    expect(q(s.el, 'note').hidden).toBe(false);
    expect(q(s.el, 'note').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(s.el.querySelector('img')).toBeNull();
  });
  it('update() draws again with new settings, never twice', () => {
    const s = imagesScreen({ settings: shipped });
    s.update({ quality: 60, hardBlock: true });
    const rows = qa(s.el, 'row');
    expect(rows).toHaveLength(11);
    expect(q(rows[4], 'value').textContent).toBe('60 of 100');
    expect(q(rows[9], 'value').textContent).toBe('Error');
    s.update(shipped, 'Settings were read again.');
    expect(q(s.el, 'note').hidden).toBe(false);
    expect(q(qa(s.el, 'row')[4], 'value').textContent).toBe('85 of 100');
    s.update(shipped);
    expect(q(s.el, 'note').hidden).toBe(true);
    expect(qa(s.el, 'row')).toHaveLength(11);
  });
  it('a website name that is not a clean name is dropped, and nothing in the box is built as HTML', () => {
    const s = imagesScreen({ settings: { blockHosts: ['<b>x</b>.example.com', '<img src=x onerror=1>', 'good.example.com'] } });
    expect(q(qa(s.el, 'row')[8], 'value').textContent).toBe('good.example.com');
    expect(s.el.querySelector('b, img, script')).toBeNull();
  });
});

describe('the file itself', () => {
  const file = src('public/admin/js/images-screen.js');
  it('has no emoji or other non-ASCII character', () => {
    expect(/[^\x00-\x7F]/.test(file)).toBe(false);
  });
  it('does not fetch, save, store, read a token or build HTML', () => {
    expect(file).not.toMatch(/\bfetch\s*\(/);
    expect(file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(file).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    expect(file).not.toMatch(/token|secret/i);
    expect(file).not.toMatch(/\.setItem\(|\.putFile|\.putText|\.commit/);
  });
  it('is called only by app.js (the menu item Picture settings), and by no other file', () => {
    expect(src('public/admin/js/app.js')).toContain("from './images-screen.js'");
    for (const f of ['hosting-hook.js', 'hosting-save.js', 'hosting-setup.js', 'hosting-screen.js', 'files-screen.js', 'main.js']) {
      expect(src('public/admin/js/' + f)).not.toContain('images-screen');
    }
  });
});
