// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { imagesFormScreen } from '../../public/admin/js/images-form-screen.js';
// @ts-ignore
import { imagesFileText } from '../../public/admin/js/images-form.js';
// @ts-ignore
import { imagesDefaults } from '../../public/admin/js/images-setting.js';
// @ts-ignore build script, plain JS
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const shippedText = src('config/images.json');
const shipped = JSON.parse(shippedText);

const ctl = (root: ParentNode, key: string) => root.querySelector(`[data-key="${key}"]`) as any;
function type(root: ParentNode, key: string, value: string) {
  const c = ctl(root, key); c.value = value; c.dispatchEvent(new Event('input', { bubbles: true }));
}
function tick(root: ParentNode, key: string) {
  const c = ctl(root, key); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true }));
}
const errs = (root: ParentNode) => [...root.querySelectorAll('[data-f="errors"] li')].map((e) => e.textContent);
const chg = (root: ParentNode) => [...root.querySelectorAll('[data-f="changes"] li')].map((e) => e.textContent);
const fileText = (root: ParentNode) => (root.querySelector('[data-f="filetext"]') as HTMLElement).textContent!;
const ORDER = ['enabled', 'askFirst', 'maxWidth', 'sizeWarnKb', 'quality', 'storage', 'askHosts', 'allowHosts', 'blockHosts', 'hardBlock', 'nameOrder'];

beforeEach(() => { document.body.innerHTML = ''; });

describe('drawing', () => {
  it('draws one control for each of the eleven settings, with the current values', () => {
    const s = imagesFormScreen({ settings: { quality: 70, maxWidth: 1200, askFirst: true, blockHosts: ['a.example.com', 'b.example.com'], storage: 'r2', nameOrder: ['caption', 'handle'] } });
    for (const k of ORDER) expect(ctl(s.el, k), k).not.toBeNull();
    expect(s.el.querySelectorAll('[data-key]:is(input, select, textarea)')).toHaveLength(11);
    expect(ctl(s.el, 'quality').value).toBe('70');
    expect(ctl(s.el, 'maxWidth').value).toBe('1200');
    expect(ctl(s.el, 'sizeWarnKb').value).toBe('0');
    expect(ctl(s.el, 'askFirst').checked).toBe(true);
    expect(ctl(s.el, 'enabled').checked).toBe(true);
    expect(ctl(s.el, 'hardBlock').checked).toBe(false);
    expect(ctl(s.el, 'storage').value).toBe('r2');
    expect(ctl(s.el, 'blockHosts').value).toBe('a.example.com\nb.example.com');
    expect(ctl(s.el, 'nameOrder').value).toBe('caption, handle');
  });
  it('at the start nothing is wrong and nothing changes; the text is the shipped file', () => {
    const s = imagesFormScreen({ settings: shipped, currentText: shippedText });
    expect((s.el.querySelector('[data-f="errors"]') as HTMLElement).hidden).toBe(true);
    expect(chg(s.el)).toEqual(['Nothing is changed.']);
    expect(JSON.parse(fileText(s.el))).toEqual(shipped);
    expect(s.read().ok).toBe(true);
    expect(s.text()).toBe(fileText(s.el));
    for (const c of s.el.querySelectorAll('[data-key]')) expect(c.hasAttribute('aria-invalid')).toBe(false);
  });
  it('called with nothing, or with a bad settings object, it shows the shipped values and does not throw', () => {
    for (const bad of [undefined, null, 5, 'x', [], { settings: 7 }, { settings: [] }, { settings: { quality: 9999 } }]) {
      expect(() => imagesFormScreen(bad as any)).not.toThrow();
      expect(ctl(imagesFormScreen(bad as any).el, 'quality').value).toBe('85');
    }
  });
  it('tells the person to press Save picture settings to write the file', () => {
    const t = imagesFormScreen({ settings: shipped }).el.querySelector('[data-f="intro"]')!.textContent!;
    expect(t).toContain('press Save picture settings');
    expect(t).not.toContain('not built yet');
    expect(t).toContain('config/images.json');
  });
  it('has no button, no form, no link', () => {
    const el = imagesFormScreen({ settings: shipped }).el;
    expect(el.querySelectorAll('button, form, a, input[type=submit], input[type=button]')).toHaveLength(0);
  });
});

describe('editing', () => {
  it('a good edit shows the change in plain words and the new text', () => {
    const s = imagesFormScreen({ settings: shipped, currentText: shippedText });
    type(s.el, 'quality', '60');
    expect(chg(s.el)).toEqual(['Picture quality: 85 of 100 -> 60 of 100']);
    expect(JSON.parse(fileText(s.el)).quality).toBe(60);
    expect(errs(s.el)).toEqual([]);
    expect(s.read()).toMatchObject({ ok: true, settings: { quality: 60 } });
  });
  it('changing it back says nothing is changed', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'quality', '60'); type(s.el, 'quality', '85');
    expect(chg(s.el)).toEqual(['Nothing is changed.']);
  });
  it('a wrong value shows its sentence, marks the box, hides the changes and the text, and read() and text() say so', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'quality', 'abc');
    expect(errs(s.el)).toEqual(['Picture quality must be a whole number from 1 to 100 (a percent).']);
    expect((s.el.querySelector('[data-f="errors"]') as HTMLElement).hidden).toBe(false);
    expect(ctl(s.el, 'quality').getAttribute('aria-invalid')).toBe('true');
    expect(ctl(s.el, 'maxWidth').hasAttribute('aria-invalid')).toBe(false);
    expect(chg(s.el)).toEqual(['Fix the lines above first.']);
    expect(fileText(s.el)).toBe('');
    expect(s.read().ok).toBe(false);
    expect(s.text()).toBeNull();
  });
  it('fixing the value clears the sentence and the mark', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'quality', '0');
    expect(errs(s.el)).toHaveLength(1);
    type(s.el, 'quality', '70');
    expect(errs(s.el)).toEqual([]);
    expect((s.el.querySelector('[data-f="errors"]') as HTMLElement).hidden).toBe(true);
    expect(ctl(s.el, 'quality').hasAttribute('aria-invalid')).toBe(false);
    expect(chg(s.el)).toEqual(['Picture quality: 85 of 100 -> 70 of 100']);
  });
  it('two wrong values show two sentences, each on its own box', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'maxWidth', '-1'); type(s.el, 'sizeWarnKb', 'x');
    expect(errs(s.el)).toHaveLength(2);
    expect(ctl(s.el, 'maxWidth').getAttribute('aria-invalid')).toBe('true');
    expect(ctl(s.el, 'sizeWarnKb').getAttribute('aria-invalid')).toBe('true');
    expect(ctl(s.el, 'quality').hasAttribute('aria-invalid')).toBe(false);
  });
  it('the switches and the storage', () => {
    const s = imagesFormScreen({ settings: shipped });
    tick(s.el, 'hardBlock'); tick(s.el, 'askFirst'); tick(s.el, 'enabled');
    const sel = ctl(s.el, 'storage'); sel.value = 'r2'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(chg(s.el)).toEqual([
      'Picture hosting: On -> Off', 'How it starts: Automatic -> Ask first', 'Where pictures are kept: In the repository -> Cloudflare R2 (not built yet)', 'Outside pictures at publish: Warning only -> Error',
    ]);
    expect(JSON.parse(fileText(s.el))).toMatchObject({ hardBlock: true, askFirst: true, enabled: false, storage: 'r2' });
  });
  it('website lists: lines are read, names are lower-cased, a clean list shows in the text', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'blockHosts', 'Bad.Example.com\n\nworse.example.com');
    expect(chg(s.el)).toEqual(['Websites never allowed: None -> bad.example.com, worse.example.com']);
    expect(JSON.parse(fileText(s.el)).blockHosts).toEqual(['bad.example.com', 'worse.example.com']);
  });
  it('a website name that is not clean is named in the sentence, on the right box', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'askHosts', 'https://x.example.com/p');
    expect(errs(s.el)[0]).toContain('"https://x.example.com/p"');
    expect(ctl(s.el, 'askHosts').getAttribute('aria-invalid')).toBe('true');
  });
  it('a website in two lists is an error on the allow box, and goes away when it is removed', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'blockHosts', 'a.example.com'); type(s.el, 'allowHosts', 'a.example.com');
    expect(errs(s.el)[0]).toContain('is in both');
    expect(ctl(s.el, 'allowHosts').getAttribute('aria-invalid')).toBe('true');
    type(s.el, 'allowHosts', '');
    expect(errs(s.el)).toEqual([]);
  });
  it('the naming order: a new order is shown in words; a missing handle is an error', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'nameOrder', 'caption, alt, handle');
    expect(chg(s.el)).toEqual(['Order of picture names: alt text, then caption, then nearest heading, then focus keyword and title words, then old file name, then post handle and a number -> caption, then alt text, then post handle and a number']);
    type(s.el, 'nameOrder', 'caption, alt');
    expect(errs(s.el)[0]).toContain('must end with "handle"');
    expect(ctl(s.el, 'nameOrder').getAttribute('aria-invalid')).toBe('true');
  });
  it('whatever the screen shows as the text passes the build check', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'quality', '60'); type(s.el, 'maxWidth', '1600'); type(s.el, 'sizeWarnKb', '300'); type(s.el, 'blockHosts', 'a.example.com'); tick(s.el, 'hardBlock');
    expect(checkImagesConfig(JSON.parse(fileText(s.el)))).toEqual([]);
    expect(checkImagesConfig(JSON.parse(s.text()!))).toEqual([]);
  });
  it('keys of the current file that the code does not know are kept in the text', () => {
    const cur = JSON.stringify({ ...shipped, futureSetting: { a: 1 } }, null, 2);
    const s = imagesFormScreen({ settings: shipped, currentText: cur });
    type(s.el, 'quality', '60');
    expect(JSON.parse(fileText(s.el)).futureSetting).toEqual({ a: 1 });
  });
  it('text shown in the boxes is never built as HTML', () => {
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'blockHosts', '<img/src=x/onerror=alert(1)>');
    expect(errs(s.el)[0]).toContain('<img/src=x/onerror=alert(1)>');
    expect(s.el.querySelector('img')).toBeNull();
    type(s.el, 'nameOrder', '<b>x</b>');
    expect(s.el.querySelector('b')).toBeNull();
  });
});

describe('onChange and update', () => {
  it('onChange gets the result after each edit, not at the start', () => {
    const seen: any[] = [];
    const s = imagesFormScreen({ settings: shipped, onChange: (r: any) => seen.push(r.ok) });
    expect(seen).toEqual([]);
    type(s.el, 'quality', '60'); type(s.el, 'quality', 'x'); tick(s.el, 'hardBlock');
    expect(seen).toEqual([true, false, false]);
  });
  it('a throwing onChange is not our concern, but a missing or wrong one is ignored', () => {
    for (const bad of [undefined, null, 5, 'x']) {
      const s = imagesFormScreen({ settings: shipped, onChange: bad as any });
      expect(() => type(s.el, 'quality', '60')).not.toThrow();
    }
  });
  it('update() puts new settings into the boxes, clears wrong marks, draws again and calls onChange', () => {
    const seen: any[] = [];
    const s = imagesFormScreen({ settings: shipped, onChange: (r: any) => seen.push(r.ok) });
    type(s.el, 'quality', 'x');
    expect(errs(s.el)).toHaveLength(1);
    seen.length = 0;
    s.update({ quality: 50, blockHosts: ['z.example.com'], nameOrder: ['alt', 'handle'], hardBlock: true });
    expect(ctl(s.el, 'quality').value).toBe('50');
    expect(ctl(s.el, 'blockHosts').value).toBe('z.example.com');
    expect(ctl(s.el, 'nameOrder').value).toBe('alt, handle');
    expect(ctl(s.el, 'hardBlock').checked).toBe(true);
    expect(errs(s.el)).toEqual([]);
    expect(chg(s.el)).toEqual(['Nothing is changed.']);
    expect(seen).toEqual([true]);
    type(s.el, 'quality', '60');
    expect(chg(s.el)).toEqual(['Picture quality: 50 of 100 -> 60 of 100']);
  });
  it('update() with new current text keeps its unknown keys', () => {
    const s = imagesFormScreen({ settings: shipped });
    s.update(shipped, JSON.stringify({ ...shipped, extra: 1 }));
    expect(JSON.parse(s.text()!).extra).toBe(1);
  });
});

describe('nothing leaves the page', () => {
  it('no fetch, no storage, no write while the person edits', () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const s = imagesFormScreen({ settings: shipped });
    type(s.el, 'quality', '60'); tick(s.el, 'enabled'); type(s.el, 'blockHosts', 'a.example.com');
    expect(f).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe('the file itself', () => {
  const file = src('public/admin/js/images-form-screen.js');
  it('has no emoji or other non-ASCII character', () => { expect(/[^\x00-\x7F]/.test(file)).toBe(false); });
  it('has no fetch, storage, GitHub write, token, HTML building, form or button', () => {
    expect(file).not.toMatch(/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(file).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    expect(file).not.toMatch(/\.put\(|\.remove\(|\.commit|putFile|putText/);
    expect(file).not.toMatch(/token|secret/i);
    expect(file).not.toMatch(/h\('(form|button|a)'/);
  });
  it('is called only by app.js (under the Picture settings screen), and by no other file', () => {
    expect(src('public/admin/js/app.js')).toContain("from './images-form-screen.js'");
    for (const f of ['images-screen.js', 'images-form.js', 'images-setting.js', 'hosting-hook.js', 'hosting-save.js', 'hosting-setup.js', 'hosting-screen.js', 'files-screen.js', 'main.js']) {
      expect(src('public/admin/js/' + f)).not.toContain('images-form-screen');
    }
  });
  it('uses only classes that admin.css already has', () => {
    const css = src('public/admin/admin.css');
    for (const c of ['card', 'errors', 'hint', 'mute']) expect(css).toMatch(new RegExp(`\\.${c}\\b`));
  });
});
