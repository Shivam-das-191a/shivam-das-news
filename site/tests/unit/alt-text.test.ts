import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkAltText } from '../../scripts/alt-text-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const img = (alt: string, extra = '') => `<img src="/m/a.jpg" width="640" height="360" alt="${alt}"${extra}>`;
const page = (b: string) => `<!doctype html><html lang="en"><head><title>x</title></head><body>${b}</body></html>`;

describe('checkAltText: good pages', () => {
  it('a page with no picture passes', () => { expect(checkAltText(page('<p>hi</p>'))).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkAltText(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkAltText('')).toEqual(none); });
  it('a real description passes', () => { expect(checkAltText(page(img('Firefighters carry a hose along a flooded street')))).toEqual(none); });
  it('an empty alt passes (decoration)', () => { expect(checkAltText(page(img('')))).toEqual(none); });
  it('an alt with no value passes (img-check-lib.mjs reads it)', () => { expect(checkAltText(page('<img src="/a.jpg" alt>'))).toEqual(none); });
  it('a picture with no alt attribute is left to img-check-lib.mjs', () => { expect(checkAltText(page('<img src="/a.jpg">'))).toEqual(none); });
  it('single quotes and no quotes are read', () => {
    expect(checkAltText(page("<img src='/a.jpg' alt='Mayor Lee speaks at city hall'>"))).toEqual(none);
    expect(checkAltText(page('<img src=/a.jpg alt=Harbour>'))).toEqual(none);
  });
  it('the word logo is a real name for a logo picture', () => {
    expect(checkAltText(page(img('Shivam Das News logo')))).toEqual(none);
    expect(checkAltText(page(img('logo')))).toEqual(none);
  });
  it('a one word alt that names a thing passes', () => { expect(checkAltText(page(img('Harbour')))).toEqual(none); });
  it('an alt that only starts with the word image as part of a name passes', () => { expect(checkAltText(page(img('Image Comics booth at the fair')))).toEqual(none); });
  it('an alt with a dot inside a sentence passes', () => { expect(checkAltText(page(img('Dr. Rao holds the 2026 report.')))).toEqual(none); });
  it('an alt of 125 characters passes', () => { expect(checkAltText(page(img('a'.repeat(5) + ' b'.repeat(60))))).toEqual(none); });
  it('a screenshot with a real sentence passes', () => { expect(checkAltText(page(img('Screenshot 5 shows the error message')))).toEqual(none); });
  it('a picture inside a script, a style, a template and a comment is not read', () => {
    expect(checkAltText(page('<script>var h=\'<img alt="IMG_1.jpg">\';</script><template><img alt="image"></template><!-- <img alt="photo.png"> -->'))).toEqual(none);
  });
  it('the case of names is not read', () => { expect(checkAltText(page('<IMG SRC="/a.jpg" ALT="Harbour at dawn">'))).toEqual(none); });
  it('a tag called imgs is not a picture', () => { expect(checkAltText(page('<imgs alt="image">'))).toEqual(none); });
  it('a letter with accents and other scripts passes', () => {
    expect(checkAltText(page(img('Café à Paris')))).toEqual(none);
    expect(checkAltText(page(img('কলকাতার হাওড়া ব্রিজ')))).toEqual(none);
  });
  it('an alt with an entity passes', () => { expect(checkAltText(page(img('Salt &amp; pepper stall at the market')))).toEqual(none); });
});

describe('checkAltText: errors', () => {
  it('a file name is an error', () => {
    for (const a of ['IMG_2041.jpg', 'photo.png', 'hero-final.webp', 'logo.svg', 'a.JPEG', 'scan.heic']) {
      const r = checkAltText(page(img(a)));
      expect(r.errors, a).toHaveLength(1);
      expect(r.errors[0]).toMatch(/which is a file name/);
    }
  });
  it('camera and screenshot names are errors', () => {
    for (const a of ['IMG_2041', 'IMG 2041', 'DSC00123', 'DSCN0456', 'PXL_20261120_101500', 'Screenshot 2026-11-20 at 10.15.22', 'Screenshot_20261120-101500', 'MVIMG_2026']) {
      const r = checkAltText(page(img(a)));
      expect(r.errors, a).toHaveLength(1);
    }
  });
  it('a file name with blanks around it is still an error', () => { expect(checkAltText(page(img('  IMG_2041.jpg  '))).errors).toHaveLength(1); });
  it('a long file name inside the alt is shortened in the message', () => {
    const r = checkAltText(page(img('this-is-a-very-long-file-name-from-a-phone-camera-roll-2026.jpg')));
    expect(r.errors[0]).toMatch(/\.\.\."/);
  });
  it('two bad pictures give two errors', () => { expect(checkAltText(page(img('a.png') + img('b.png'))).errors).toHaveLength(2); });
  it('an error does not also give a warning', () => { expect(checkAltText(page(img('IMG_2041.jpg'))).warnings).toEqual([]); });
});

describe('checkAltText: warnings', () => {
  it('a lone empty word is a warning', () => {
    for (const a of ['image', 'Image', 'PICTURE', 'photo', 'graphic', 'img', 'pic', 'thumbnail', 'banner', 'placeholder', 'untitled', 'screenshot', 'photo.', 'Image:']) {
      const r = checkAltText(page(img(a)));
      expect(r.errors, a).toEqual([]);
      expect(r.warnings, a).toHaveLength(1);
      expect(r.warnings[0]).toMatch(/says nothing about the picture/);
    }
  });
  it('such a word with a number is a warning', () => {
    for (const a of ['image 3', 'photo1', 'Figure 2', 'untitled-4', 'pic_7']) expect(checkAltText(page(img(a))).warnings, a).toHaveLength(1);
  });
  it('"image of" and its kin are warnings', () => {
    for (const a of ['Image of a flooded street', 'picture of the mayor', 'Photo of Howrah Bridge', 'A photo of the crowd', 'graphic of the budget', 'Screenshot of the dashboard']) {
      const r = checkAltText(page(img(a)));
      expect(r.errors, a).toEqual([]);
      expect(r.warnings, a).toHaveLength(1);
      expect(r.warnings[0]).toMatch(/already says "image"/);
    }
  });
  it('an alt over 125 characters is a warning', () => {
    const r = checkAltText(page(img('word '.repeat(30).trim())));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/alt of 149 characters/);
  });
  it('an alt of 126 characters is a warning and 125 is not', () => {
    expect(checkAltText(page(img('x'.repeat(125)))).warnings).toEqual([]);
    expect(checkAltText(page(img('x'.repeat(126)))).warnings).toHaveLength(1);
  });
  it('an alt of blanks only is a warning', () => {
    const r = checkAltText(page('<img src="/a.jpg" alt=" ">'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a picture has an alt of blanks only; write alt="" for a picture that is only decoration']);
  });
  it('a no break space alone is read as blanks', () => { expect(checkAltText(page('<img src="/a.jpg" alt="&nbsp;">')).warnings[0]).toMatch(/blanks only/); });
  it('an alt of marks only is a warning', () => {
    for (const a of ['-', '.', '...', '---', '*']) {
      const r = checkAltText(page(img(a)));
      expect(r.errors, a).toEqual([]);
      expect(r.warnings[0], a).toMatch(/holds no letter or number/);
    }
  });
  it('an alt that is the word with an entity is read as the word', () => { expect(checkAltText(page(img('&#73;mage'))).warnings).toEqual([]); });
});

describe('speed', () => {
  it('a big page is read in a fraction of a second', () => {
    const t = Date.now();
    checkAltText(page((img('A real description of a picture') + '<p class="a b" id="i">text <a href="/x/">link</a></p>').repeat(20000)));
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'alt-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good picture passes', () => { expect(run(FULL(img('Firefighters carry a hose along a flooded street'))).code).toBe(0); });
  it('a file name as alt stops the build and names the page', () => {
    const r = run(FULL(img('IMG_2041.jpg')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a picture has alt="IMG_2041\.jpg", which is a file name/);
  });
  it('a lone word as alt is a warning, not an error', () => {
    const r = run(FULL(img('image')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*says nothing about the picture/);
  });
});
