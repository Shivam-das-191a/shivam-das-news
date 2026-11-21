import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS modules served to the browser
import { saveImagesSettings } from '../../public/admin/js/images-save.js';
// @ts-ignore
import { imagesFileText, imagesFromForm } from '../../public/admin/js/images-form.js';
// @ts-ignore
import { imagesSettingsFromText, imagesDefaults } from '../../public/admin/js/images-setting.js';
// @ts-ignore build script, plain JS
import { checkImagesConfig } from '../../scripts/validate-content-lib.mjs';

const src = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const shippedText = src('config/images.json');
const PATH = 'site/config/images.json';
const cfg = { contentRoot: 'site' };

// A fake GitHub with one file. `files` maps a path to { text, sha }. Every call is recorded.
function fakeGh(files: Record<string, { text: string; sha: string }>, opts: { getErr?: any; putErr?: any } = {}) {
  const calls: { get: string[]; put: any[] } = { get: [], put: [] };
  const gh = {
    async getText(path: string) {
      calls.get.push(path);
      if ('getErr' in opts) throw opts.getErr;
      const f = files[path];
      if (!f) { const e: any = new Error('GitHub 404: Not Found'); e.status = 404; throw e; }
      return { text: f.text, sha: f.sha };
    },
    async put(path: string, content: string, message: string, sha?: string) {
      calls.put.push({ path, content, message, sha });
      if ('putErr' in opts) throw opts.putErr;
      files[path] = { text: content, sha: 'new-sha' };
      return { content: { sha: 'new-sha' } };
    },
  };
  return { gh, calls, files };
}
const err = (status: number, message = 'GitHub says no') => Object.assign(new Error(message), { status });

describe('saveImagesSettings: a good save', () => {
  it('writes the new text in ONE put, with the path, the message and the sha just read', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 'sha-1' } });
    const r = await saveImagesSettings(gh, cfg, { quality: '70' });
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(true);
    expect(calls.put).toHaveLength(1);
    expect(calls.put[0].path).toBe(PATH);
    expect(calls.put[0].message).toBe('admin: picture settings');
    expect(calls.put[0].sha).toBe('sha-1');
    expect(JSON.parse(calls.put[0].content).quality).toBe(70);
  });
  it('reads the file once and uses no other GitHub call', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    await saveImagesSettings(gh, cfg, { quality: 60 });
    expect(calls.get).toEqual([PATH]);
    expect(calls.put).toHaveLength(1);
  });
  it('gives settings, text, the change list and the new sha', async () => {
    const { gh } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 60, maxWidth: '1600' });
    expect(r.settings.quality).toBe(60);
    expect(r.settings.maxWidth).toBe(1600);
    expect(r.text.endsWith('\n')).toBe(true);
    expect(r.changes.map((c: any) => c.key).sort()).toEqual(['maxWidth', 'quality']);
    expect(r.sha).toBe('new-sha');
  });
  it('the text written is exactly imagesFileText of the checked settings', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    await saveImagesSettings(gh, cfg, { askFirst: true, allowHosts: 'CDN.Example.com\ncdn.example.com' });
    const want = imagesFileText(imagesFromForm({ askFirst: true, allowHosts: 'cdn.example.com' }, imagesSettingsFromText(shippedText)).settings, shippedText);
    expect(calls.put[0].content).toBe(want);
  });
  it('the written text passes the build check', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    await saveImagesSettings(gh, cfg, { quality: 90, sizeWarnKb: 400, maxWidth: 1800, hardBlock: true, blockHosts: 'bad.example.com', askHosts: 'agency.example.com', storage: 'r2', nameOrder: 'heading, alt, handle' });
    expect(checkImagesConfig(JSON.parse(calls.put[0].content))).toEqual([]);
  });
  it('a key that is missing from the form keeps the value of the file', async () => {
    const text = imagesFileText({ ...imagesDefaults(), quality: 55, blockHosts: ['x.example.com'] });
    const { gh, calls } = fakeGh({ [PATH]: { text, sha: 's' } });
    await saveImagesSettings(gh, cfg, { maxWidth: 1000 });
    const out = JSON.parse(calls.put[0].content);
    expect(out.quality).toBe(55);
    expect(out.blockHosts).toEqual(['x.example.com']);
    expect(out.maxWidth).toBe(1000);
  });
  it('keeps the keys of the file that this code does not know', async () => {
    const text = JSON.stringify({ ...imagesDefaults(), futureKey: { a: 1 } }, null, 2) + '\n';
    const { gh, calls } = fakeGh({ [PATH]: { text, sha: 's' } });
    await saveImagesSettings(gh, cfg, { quality: 50 });
    expect(JSON.parse(calls.put[0].content).futureKey).toEqual({ a: 1 });
  });
  it('uses the contentRoot of the config for the path', async () => {
    const files = { 'content/config/images.json': { text: shippedText, sha: 's' } };
    const { gh, calls } = fakeGh(files);
    const r = await saveImagesSettings(gh, { contentRoot: 'content' }, { quality: 50 });
    expect(r.ok).toBe(true);
    expect(calls.put[0].path).toBe('content/config/images.json');
  });
  it('a second save of the same values after the first writes nothing', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    await saveImagesSettings(gh, cfg, { quality: 70 });
    const again = await saveImagesSettings(gh, cfg, { quality: 70 });
    expect(again.ok).toBe(true);
    expect(again.changed).toBe(false);
    expect(calls.put).toHaveLength(1);
  });
});

describe('saveImagesSettings: nothing to save', () => {
  it('values equal to the file: ok, changed false, no put, no changes', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: '85', enabled: true });
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(r.changes).toEqual([]);
    expect(calls.put).toHaveLength(0);
  });
  it('a file that only differs in layout or key order is not written again', async () => {
    const compact = JSON.stringify(JSON.parse(shippedText));
    const reversed = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(shippedText)).reverse()), null, 4);
    for (const text of [compact, reversed, shippedText.replace(/\n/g, '\r\n')]) {
      const { gh, calls } = fakeGh({ [PATH]: { text, sha: 's' } });
      const r = await saveImagesSettings(gh, cfg, { quality: 85 });
      expect(r).toMatchObject({ ok: true, changed: false });
      expect(calls.put).toHaveLength(0);
    }
  });
  it('a real difference in a list or in the naming order is written', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { nameOrder: 'alt, handle' });
    expect(r.changed).toBe(true);
    expect(calls.put).toHaveLength(1);
    const { gh: gh2, calls: c2 } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    expect((await saveImagesSettings(gh2, cfg, { askHosts: 'a.example.com' })).changed).toBe(true);
    expect(c2.put).toHaveLength(1);
  });
  it('a file with a key this code does not know, otherwise equal, is not written again', async () => {
    const text = JSON.stringify({ ...JSON.parse(shippedText), futureKey: [1, { a: 2 }] });
    const { gh, calls } = fakeGh({ [PATH]: { text, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, {});
    expect(r.changed).toBe(false);
    expect(calls.put).toHaveLength(0);
  });
  it('an empty form changes nothing', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, {});
    expect(r.changed).toBe(false);
    expect(calls.put).toHaveLength(0);
  });
  it('a form that is not an object (null, text, list) changes nothing', async () => {
    for (const raw of [null, undefined, 'x', 7, []]) {
      const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
      const r = await saveImagesSettings(gh, cfg, raw);
      expect(r.ok).toBe(true);
      expect(r.changed).toBe(false);
      expect(calls.put).toHaveLength(0);
    }
  });
});

describe('saveImagesSettings: wrong values', () => {
  it('a wrong value is refused with its sentence and nothing is written', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: '150' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid');
    expect(r.errors[0].key).toBe('quality');
    expect(r.errors[0].message).toMatch(/whole number from 1 to 100/);
    expect(calls.put).toHaveLength(0);
  });
  it('one wrong value stops the whole save, even when the other values are good', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 60, maxWidth: 'abc' });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e: any) => e.key)).toEqual(['maxWidth']);
    expect(calls.put).toHaveLength(0);
  });
  it('gives every wrong key', async () => {
    const { gh } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 0, maxWidth: -1, storage: 'ftp', nameOrder: 'alt' });
    expect(r.errors.map((e: any) => e.key).sort()).toEqual(['maxWidth', 'nameOrder', 'quality', 'storage']);
  });
  it('a website in two lists is refused', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { allowHosts: 'a.example.com', blockHosts: 'a.example.com' });
    expect(r.ok).toBe(false);
    expect(calls.put).toHaveLength(0);
  });
  it('a website kept from the file that clashes with a new list is refused', async () => {
    const text = imagesFileText({ ...imagesDefaults(), blockHosts: ['a.example.com'] });
    const { gh, calls } = fakeGh({ [PATH]: { text, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { allowHosts: 'a.example.com' });
    expect(r.ok).toBe(false);
    expect(calls.put).toHaveLength(0);
  });
  it('the message of a refusal is the fixed sentence', async () => {
    const { gh } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 'x' });
    expect(r.message).toBe('Some values are wrong, so nothing was saved. Fix the lines marked in red.');
  });
  it('does not change the object it was given', async () => {
    const { gh } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const raw = { quality: '70', allowHosts: ['A.example.com'], nameOrder: ['alt', 'handle'] };
    const copy = JSON.parse(JSON.stringify(raw));
    await saveImagesSettings(gh, cfg, raw);
    expect(raw).toEqual(copy);
  });
});

describe('saveImagesSettings: the file is missing, broken or changed', () => {
  it('no file (404): writes a new file with no sha', async () => {
    const { gh, calls } = fakeGh({});
    const r = await saveImagesSettings(gh, cfg, { quality: 70 });
    expect(r).toMatchObject({ ok: true, changed: true });
    expect(calls.put[0].sha).toBeUndefined();
    expect(JSON.parse(calls.put[0].content)).toEqual({ ...imagesDefaults(), quality: 70 });
  });
  it('no file and no change in the form still writes the shipped file once', async () => {
    const { gh, calls } = fakeGh({});
    const r = await saveImagesSettings(gh, cfg, {});
    expect(r.changed).toBe(true);
    expect(calls.put).toHaveLength(1);
  });
  it('another read error (500, network) stops with read-failed and writes nothing', async () => {
    for (const e of [err(500), err(401), new Error('network down'), null]) {
      const { gh, calls } = fakeGh({}, { getErr: e });
      const r = await saveImagesSettings(gh, cfg, { quality: 70 });
      expect(r).toMatchObject({ ok: false, reason: 'read-failed' });
      expect(calls.put).toHaveLength(0);
    }
  });
  it('a broken file (not JSON) is replaced by the checked settings, with its sha', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: '{ broken', sha: 'sha-bad' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 70 });
    expect(r).toMatchObject({ ok: true, changed: true });
    expect(calls.put[0].sha).toBe('sha-bad');
    expect(JSON.parse(calls.put[0].content).quality).toBe(70);
  });
  it('loadedText equal to the file: saves', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 70 }, { loadedText: shippedText });
    expect(r.ok).toBe(true);
    expect(calls.put).toHaveLength(1);
  });
  it('loadedText different from the file: changed-meanwhile, nothing written', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText.replace('85', '60'), sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { maxWidth: 1000 }, { loadedText: shippedText });
    expect(r).toMatchObject({ ok: false, reason: 'changed-meanwhile' });
    expect(calls.put).toHaveLength(0);
  });
  it('loadedText null (form started with no file) but a file exists now: changed-meanwhile', async () => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
    const r = await saveImagesSettings(gh, cfg, { quality: 70 }, { loadedText: null });
    expect(r.reason).toBe('changed-meanwhile');
    expect(calls.put).toHaveLength(0);
  });
  it('loadedText null and still no file: saves', async () => {
    const { gh, calls } = fakeGh({});
    const r = await saveImagesSettings(gh, cfg, { quality: 70 }, { loadedText: null });
    expect(r.ok).toBe(true);
    expect(calls.put).toHaveLength(1);
  });
  it('loadedText a string but the file is gone now: changed-meanwhile', async () => {
    const { gh, calls } = fakeGh({});
    const r = await saveImagesSettings(gh, cfg, { quality: 70 }, { loadedText: shippedText });
    expect(r.reason).toBe('changed-meanwhile');
    expect(calls.put).toHaveLength(0);
  });
  it('no opts, an empty opts, or opts without loadedText: no such check', async () => {
    for (const o of [undefined, null, {}, { other: 1 }]) {
      const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
      const r = await saveImagesSettings(gh, cfg, { quality: 70 }, o);
      expect(r.ok).toBe(true);
      expect(calls.put).toHaveLength(1);
    }
  });
});

describe('saveImagesSettings: GitHub failures', () => {
  const failWith = async (e: any) => {
    const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } }, { putErr: e });
    const r = await saveImagesSettings(gh, cfg, { quality: 70 });
    return { r, calls };
  };
  it('409 and 422 become conflict', async () => {
    for (const s of [409, 422]) expect((await failWith(err(s))).r).toMatchObject({ ok: false, reason: 'conflict' });
  });
  it('401 and 403 become no-permission', async () => {
    for (const s of [401, 403]) expect((await failWith(err(s))).r).toMatchObject({ ok: false, reason: 'no-permission' });
  });
  it('any other error becomes failed', async () => {
    for (const e of [err(500), err(404), new Error('boom'), null, undefined]) expect((await failWith(e)).r).toMatchObject({ ok: false, reason: 'failed' });
  });
  it('a failure message is a fixed sentence and never repeats the GitHub text', async () => {
    const { r } = await failWith(err(500, 'Bearer ghp_SECRETTOKEN123 https://api.github.com/repos/x/y'));
    expect(r.message).toBe('The picture settings could not be saved. Nothing was changed. Try again.');
    expect(JSON.stringify(r)).not.toMatch(/ghp_|Bearer|api\.github/);
  });
  it('a read failure message never repeats the GitHub text either', async () => {
    const { gh } = fakeGh({}, { getErr: err(500, 'token ghp_SECRETTOKEN123') });
    const r = await saveImagesSettings(gh, cfg, { quality: 70 });
    expect(JSON.stringify(r)).not.toMatch(/ghp_|token/);
  });
  it('every reason has its own plain sentence', async () => {
    const msgs = new Set<string>();
    msgs.add((await saveImagesSettings(null, cfg, {})).message);
    msgs.add((await saveImagesSettings(fakeGh({}, { getErr: err(500) }).gh, cfg, {})).message);
    msgs.add((await saveImagesSettings(fakeGh({ [PATH]: { text: shippedText, sha: 's' } }).gh, cfg, { quality: 70 }, { loadedText: 'x' })).message);
    msgs.add((await saveImagesSettings(fakeGh({ [PATH]: { text: shippedText, sha: 's' } }).gh, cfg, { quality: 'x' })).message);
    msgs.add((await failWith(err(409))).r.message);
    msgs.add((await failWith(err(403))).r.message);
    msgs.add((await failWith(err(500))).r.message);
    expect(msgs.size).toBe(7);
    for (const m of msgs) expect(m).toMatch(/nothing/i);
  });
});

describe('saveImagesSettings: never throws', () => {
  it('no client, a client without the two methods, or junk: no-client', async () => {
    for (const gh of [null, undefined, {}, { getText() {} }, { put() {} }, 'x', 7]) {
      const r = await saveImagesSettings(gh as any, cfg, { quality: 70 });
      expect(r).toMatchObject({ ok: false, reason: 'no-client' });
    }
  });
  it('a bad cfg uses the default path', async () => {
    for (const c of [null, undefined, 'x', [], { contentRoot: 5 }]) {
      const { gh, calls } = fakeGh({ [PATH]: { text: shippedText, sha: 's' } });
      const r = await saveImagesSettings(gh, c as any, { quality: 70 });
      expect(r.ok).toBe(true);
      expect(calls.put[0].path).toBe(PATH);
    }
  });
  it('a getText that answers with junk is treated as no file', async () => {
    for (const junk of [null, undefined, 'text', { text: 5 }, []]) {
      const puts: any[] = [];
      const gh = { getText: async () => junk, put: async (...a: any[]) => { puts.push(a); return null; } };
      const r = await saveImagesSettings(gh as any, cfg, { quality: 70 });
      expect(r.ok).toBe(true);
      expect(puts).toHaveLength(1);
      expect(puts[0][3]).toBeUndefined();
    }
  });
  it('a put that answers with junk still counts as saved, without a sha', async () => {
    for (const junk of [null, undefined, 'x', {}, { content: null }, { content: { sha: 5 } }]) {
      const gh = { getText: async () => ({ text: shippedText, sha: 's' }), put: async () => junk };
      const r = await saveImagesSettings(gh as any, cfg, { quality: 70 });
      expect(r.ok).toBe(true);
      expect(r.sha).toBeUndefined();
    }
  });
  it('a getText that throws something odd is read-failed', async () => {
    for (const e of ['text', 5, { status: 'x' }, undefined]) {
      const gh = { getText: async () => { throw e; }, put: async () => null };
      expect((await saveImagesSettings(gh as any, cfg, {})).reason).toBe('read-failed');
    }
  });
});

describe('images-save.js: the file itself', () => {
  const code = src('public/admin/js/images-save.js');
  it('writes only through gh.put, once, and imports only the settings helpers', () => {
    const body = code.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect((body.match(/gh\.put\(/g) || []).length).toBe(1);
    expect(code).not.toMatch(/commitFiles|fetch\(|localStorage|sessionStorage|document\./);
    const imports = [...code.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1]).sort();
    expect(imports).toEqual(['./images-form.js', './images-setting.js']);
  });
  it('is called only by app.js (the Save button of the Picture settings screen, Part 7ad)', () => {
    expect(src('public/admin/js/app.js')).toMatch(/import \{ saveImagesSettings \} from '\.\/images-save\.js'/);
    for (const f of ['images-form-screen.js', 'images-screen.js', 'images-form.js', 'hosting-hook.js', 'hosting-save.js']) {
      expect(src('public/admin/js/' + f)).not.toMatch(/images-save/);
    }
  });
  it('has no emoji and no secret word', () => {
    expect(code).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(code).not.toMatch(/ghp_|Bearer /);
  });
});
