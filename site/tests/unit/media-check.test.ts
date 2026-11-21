import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkMedia } from '../../scripts/media-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GV = '<video controls preload="metadata" poster="/p.jpg" width="640" height="360"><source src="/media/a.mp4" type="video/mp4"><track kind="captions" src="/media/a.vtt" srclang="en" label="English"></video>';
const GA = '<audio controls preload="none" src="/media/a.mp3"></audio>';

describe('checkMedia: good media', () => {
  it('a video with controls, captions, poster, size and preload passes with no message', () => { expect(checkMedia(GV)).toEqual(none); });
  it('an audio with controls and preload passes (no captions needed)', () => { expect(checkMedia(GA)).toEqual(none); });
  it('a page with no media passes', () => { expect(checkMedia('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkMedia(v as any).errors).toEqual(['the page is not text']);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkMedia("<VIDEO CONTROLS PRELOAD=none POSTER='/p.jpg' WIDTH=5 HEIGHT=5><TRACK KIND='subtitles' SRC='/a.vtt'></VIDEO>")).toEqual(none);
  });
  it('subtitles count as captions', () => {
    expect(checkMedia('<video controls preload="none" poster="/p.jpg" width="5" height="5"><track kind="subtitles" src="/a.vtt"></video>')).toEqual(none);
  });
  it('an aspect-ratio in the style takes the place of width and height', () => {
    expect(checkMedia('<video controls preload="none" poster="/p.jpg" style="aspect-ratio:16/9"><track kind="captions" src="/a.vtt"></video>')).toEqual(none);
  });
  it('a silent looping autoplay video with no controls is a picture and passes', () => {
    expect(checkMedia('<video autoplay muted loop playsinline preload="metadata" poster="/p.jpg" width="5" height="5"><source src="/a.mp4"></video>')).toEqual(none);
  });
});

describe('checkMedia: autoplay and controls', () => {
  it('autoplay with sound is an error that names the file', () => {
    expect(checkMedia('<video autoplay controls src="/a.mp4"></video>').errors).toEqual(['the video /a.mp4 plays by itself with sound; remove autoplay (or, for a silent video, add muted)']);
  });
  it('an audio with autoplay is an error even with muted', () => {
    expect(checkMedia('<audio autoplay muted controls src="/a.mp3"></audio>').errors.join()).toMatch(/audio \/a\.mp3 plays by itself/);
  });
  it('autoplay="false" is not autoplay', () => { expect(checkMedia('<video autoplay="false" controls src="/a.mp4"></video>').errors).toEqual([]); });
  it('a video with no controls is an error', () => {
    expect(checkMedia('<video src="/a.mp4"></video>').errors).toEqual(['the video /a.mp4 has no controls; the reader cannot play or pause it']);
  });
  it('a muted autoplay video with no loop and no controls is an error', () => {
    expect(checkMedia('<video autoplay muted src="/a.mp4"></video>').errors.join()).toMatch(/has no controls/);
  });
  it('a looping audio with no controls is an error', () => {
    expect(checkMedia('<audio autoplay loop muted src="/a.mp3"></audio>').errors.length).toBeGreaterThanOrEqual(1);
    expect(checkMedia('<audio loop src="/a.mp3"></audio>').errors.join()).toMatch(/has no controls/);
  });
  it('the address is read from the first source when there is no src', () => {
    expect(checkMedia('<video><source src="/m/a.webm"></video>').errors.join()).toMatch(/video \/m\/a\.webm has no controls/);
  });
  it('no address at all says (no address)', () => { expect(checkMedia('<video></video>').errors.join()).toMatch(/\(no address\)/); });
  it('the same message is not printed twice', () => {
    expect(checkMedia('<video src="/a.mp4"></video><video src="/a.mp4"></video>').errors).toHaveLength(1);
  });
});

describe('checkMedia: http addresses', () => {
  it('http:// on src is an error', () => {
    expect(checkMedia('<audio controls preload="none" src="http://a.org/a.mp3"></audio>').errors).toEqual(['the audio loads http://a.org/a.mp3 over http://; use https://']);
  });
  it('http:// on a source child is an error', () => {
    expect(checkMedia('<video controls><source src="HTTP://a.org/a.mp4"></video>').errors.join()).toMatch(/over http:\/\//);
  });
  it('https:// and relative addresses are fine', () => {
    expect(checkMedia('<audio controls preload="none" src="https://a.org/a.mp3"></audio>')).toEqual(none);
  });
});

describe('checkMedia: warnings', () => {
  it('a video with no captions is a warning, not an error', () => {
    const r = checkMedia('<video controls preload="none" poster="/p.jpg" width="5" height="5" src="/a.mp4"></video>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['the video /a.mp4 has no <track kind="captions">; people who cannot hear need captions']);
  });
  it('a track of another kind is not captions', () => {
    expect(checkMedia('<video controls preload="none" poster="/p.jpg" width="5" height="5" src="/a.mp4"><track kind="descriptions" src="/d.vtt"></video>').warnings.join()).toMatch(/no <track kind="captions">/);
  });
  it('no preload is a warning for video and audio', () => {
    expect(checkMedia('<audio controls src="/a.mp3"></audio>').warnings.join()).toMatch(/no preload/);
    expect(checkMedia('<video controls src="/a.mp4"></video>').warnings.join()).toMatch(/no preload/);
  });
  it('preload="auto" is a warning', () => { expect(checkMedia('<audio controls preload="auto" src="/a.mp3"></audio>').warnings).toHaveLength(1); });
  it('no poster is a warning', () => {
    expect(checkMedia('<video controls preload="none" width="5" height="5" src="/a.mp4"><track kind="captions" src="/a.vtt"></video>').warnings).toEqual(['the video /a.mp4 has no poster picture']);
  });
  it('no width and height is a warning; width only is too', () => {
    const v = (a: string) => `<video controls preload="none" poster="/p.jpg" ${a} src="/a.mp4"><track kind="captions" src="/a.vtt"></video>`;
    expect(checkMedia(v('')).warnings.join()).toMatch(/no width and height/);
    expect(checkMedia(v('width="5"')).warnings.join()).toMatch(/no width and height/);
  });
  it('an audio needs no poster, size or captions', () => { expect(checkMedia('<audio controls preload="metadata" src="/a.mp3"></audio>')).toEqual(none); });
  it('a silent looping video needs no captions', () => {
    expect(checkMedia('<video autoplay muted loop preload="none" poster="/p.jpg" width="5" height="5" src="/a.mp4"></video>')).toEqual(none);
  });
});

describe('checkMedia: what is left out', () => {
  it('hidden media is not read', () => {
    expect(checkMedia('<video hidden src="http://a.org/a.mp4"></video>')).toEqual(none);
    expect(checkMedia('<audio aria-hidden="true" autoplay src="/a.mp3"></audio>')).toEqual(none);
  });
  it('amp-video and amp-audio are other tags', () => { expect(checkMedia('<amp-video src="http://a.org/a.mp4"></amp-video><amp-audio autoplay></amp-audio>')).toEqual(none); });
  it('media inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<video autoplay src="/a.mp4"></video>\';</script><template><video src="/a"></video></template><!-- <audio autoplay src="/b"></audio> -->';
    expect(checkMedia(extra + GV)).toEqual(none);
  });
  it('a word that only starts with video is not a video', () => { expect(checkMedia('<videos src="http://a.org/x"></videos>')).toEqual(none); });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkMedia('<main>' + '<p class="x">y</p>'.repeat(40000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('no template of the site writes a video or audio by hand (they come from posts and are checked at build)', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(/<(video|audio)[\s>]/i.test(base)).toBe(false);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'media-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good video and a good audio pass', () => { expect(run(FULL(GV + GA)).code).toBe(0); });
  it('autoplay with sound stops the build and names the page', () => {
    const r = run(FULL('<video autoplay controls src="/a.mp4"></video>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: the video \/a\.mp4 plays by itself with sound/);
  });
  it('a video with no controls stops the build', () => {
    const r = run(FULL('<video src="/a.mp4"></video>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/has no controls/);
  });
  it('a video with no captions is a warning, not an error', () => {
    const r = run(FULL('<video controls preload="none" poster="/p.jpg" width="5" height="5" src="/a.mp4"></video>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*kind="captions"/);
  });
});
