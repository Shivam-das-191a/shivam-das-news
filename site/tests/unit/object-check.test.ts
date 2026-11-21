import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkObjects } from '../../scripts/object-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const WARN = "an <embed> is plug-in content, and the security rules of this site (object-src 'none') block it once they are enforced; use <img>, <video>, <audio> or an <iframe> instead";

describe('checkObjects: good pages', () => {
  it('a plain page passes', () => { expect(checkObjects('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkObjects(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkObjects('')).toEqual(none); });
  it('a picture, a video, an audio and an iframe are left alone', () => {
    expect(checkObjects('<img src="/a.png" alt="a"><video src="/a.mp4" controls></video><audio src="/a.mp3" controls></audio><iframe src="https://www.youtube-nocookie.com/embed/x" title="v"></iframe>')).toEqual(none);
  });
  it('a param with another name and value passes', () => { expect(checkObjects('<param name="quality" value="high">')).toEqual(none); });
  it('the word embed in text passes', () => { expect(checkObjects('<p>Use the embed code and the object tag as shown.</p>')).toEqual(none); });
});

describe('checkObjects: Flash is an error', () => {
  it('an embed with the Flash type is an error', () => {
    expect(checkObjects('<embed src="/a" type="application/x-shockwave-flash">').errors).toEqual(['an <embed> loads Flash (/a), which no browser runs any more; replace it with a video, a picture or an iframe']);
  });
  it('an embed with a .swf address is an error', () => { expect(checkObjects('<embed src="/media/a.swf" width="300">').errors).toHaveLength(1); });
  it('an object with a .swf address is an error', () => { expect(checkObjects('<object data="/media/a.swf"></object>').errors).toHaveLength(1); });
  it('a .swf address with a query or a hash is read', () => {
    expect(checkObjects('<embed src="/a.swf?x=1">').errors).toHaveLength(1);
    expect(checkObjects('<embed src="/a.swf#top">').errors).toHaveLength(1);
  });
  it('the case of the tag, the type and the extension is not read', () => {
    expect(checkObjects('<EMBED SRC="/A.SWF" TYPE="Application/X-Shockwave-Flash">').errors).toHaveLength(1);
  });
  it('an object with a classid is an error', () => {
    expect(checkObjects('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"></object>').errors).toEqual(['an <object> loads Flash, which no browser runs any more; replace it with a video, a picture or an iframe']);
  });
  it('a param called movie is an error', () => {
    expect(checkObjects('<object><param name="movie" value="/a.swf"></object>').errors.length).toBeGreaterThan(0);
  });
  it('a param called movie with another value is an error', () => {
    expect(checkObjects('<param name="Movie" value="/a">').errors).toEqual(['a <param> hands /a to Flash, which no browser runs any more; replace it with a video, a picture or an iframe']);
  });
  it('a param whose value ends in .swf is an error', () => { expect(checkObjects('<param name="src" value="/a.swf">').errors).toHaveLength(1); });
  it('an old Blogger player is an error and not also a warning', () => {
    const r = checkObjects('<object width="320" height="266"><param name="movie" value="https://x.org/p.swf"><embed src="https://x.org/p.swf" type="application/x-shockwave-flash"></object>');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.warnings).toEqual([]);
  });
  it('the same message is not printed twice', () => { expect(checkObjects('<embed src="/a.swf"><embed src="/a.swf">').errors).toHaveLength(1); });
  it('a long address is shortened in the message', () => {
    const r = checkObjects('<embed src="/' + 'a'.repeat(100) + '.swf">');
    expect(r.errors[0]).toContain('...');
    expect(r.errors[0].length).toBeLessThan(220);
  });
});

describe('checkObjects: http is an error', () => {
  it('an embed from http:// is an error', () => {
    expect(checkObjects('<embed src="http://x.org/a.pdf" type="application/pdf">').errors).toEqual(['an <embed> loads http://x.org/a.pdf, which is not https; the browser blocks it on an https page']);
  });
  it('an object from http:// is an error', () => { expect(checkObjects('<object data="http://x.org/a.svg" type="image/svg+xml"></object>').errors).toHaveLength(1); });
  it('the case of the scheme is not read', () => { expect(checkObjects('<embed src="HTTP://x.org/a.pdf">').errors).toHaveLength(1); });
  it('an http address is not also a warning', () => { expect(checkObjects('<embed src="http://x.org/a.pdf">').warnings).toEqual([]); });
  it('an embed reads src and an object reads data, not the other way', () => {
    expect(checkObjects('<embed data="http://x.org/a.pdf">').errors).toEqual([]);
    expect(checkObjects('<object src="http://x.org/a.pdf"></object>').errors).toEqual([]);
  });
});

describe('checkObjects: other plug-in content is a warning', () => {
  it('an embed of a PDF is a warning', () => {
    const r = checkObjects('<embed src="/media/a.pdf" type="application/pdf">');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([WARN]);
  });
  it('an object of a picture is a warning', () => { expect(checkObjects('<object data="/a.svg" type="image/svg+xml"></object>').warnings).toEqual([WARN.replace('<embed>', '<object>')]); });
  it('an embed with no address is a warning', () => { expect(checkObjects('<embed>').warnings).toHaveLength(1); });
  it('single quotes and no quotes are read', () => {
    expect(checkObjects("<embed src='/a.pdf'>").warnings).toHaveLength(1);
    expect(checkObjects('<embed src=/a.pdf>').warnings).toHaveLength(1);
  });
  it('the same warning is not printed twice', () => { expect(checkObjects('<embed src="/a.pdf"><embed src="/b.pdf">').warnings).toHaveLength(1); });
  it('an object and an embed give two warnings', () => { expect(checkObjects('<object data="/a.pdf"></object><embed src="/a.pdf">').warnings).toHaveLength(2); });
  it('a greater-than sign in a value does not cut the tag', () => { expect(checkObjects('<embed title="a > b" src="/a.swf">').errors).toHaveLength(1); });
});

describe('checkObjects: what is left out', () => {
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <embed src="/a.swf"> --><script>var s = \'<embed src="/a.swf">\';</script><style>a:after{content:"<object classid=x>"}</style><template><embed src="http://x.org/a.pdf"></template>';
    expect(checkObjects(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a custom element that starts with object, embed or param is not read', () => {
    expect(checkObjects('<object-box data="/a.swf"></object-box><embedded src="/a.swf"></embedded><params name="movie"></params>')).toEqual(none);
  });
  it('text after a comment is still read', () => { expect(checkObjects('<!-- x --><embed src="/a.swf">').errors).toHaveLength(1); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkObjects('<main>' + '<p class="a b">text <a href="/x/">link</a></p><img src="/a.png" alt="a">'.repeat(20000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout holds no object or embed', () => {
    expect(checkObjects(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'object-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL('<p>ok</p>')).code).toBe(0); });
  it('a Flash embed stops the build and names the page', () => {
    const r = run(FULL('<embed src="/media/a.swf">'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: an <embed> loads Flash \(\/media\/a\.swf\)/);
  });
  it('an object from http:// stops the build', () => {
    const r = run(FULL('<object data="http://x.org/a.pdf"></object>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/is not https; the browser blocks it/);
  });
  it('a PDF embed is a warning, not an error', () => {
    const r = run(FULL('<embed src="/media/a.pdf" type="application/pdf">'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*plug-in content/);
  });
});
