// Part 8c: thumbnails are 16:9 and their style keeps aspect-ratio and object-fit (img-ratio-lib.mjs) and the build gate that uses them.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkThumbRatio, thumbCssProblem } from '../../scripts/img-ratio-lib.mjs';

const ok = '<img class="thumb" src="/a.webp" alt="A" width="1200" height="675">';
const css = '.thumb{aspect-ratio:16/9;width:100%;object-fit:cover;border-radius:12px}';

describe('checkThumbRatio', () => {
  it('passes 1200 x 675 and other exact 16:9 sizes', () => {
    expect(checkThumbRatio(ok)).toEqual([]);
    expect(checkThumbRatio('<img class="thumb" src="/a.webp" width="1600" height="900">')).toEqual([]);
    expect(checkThumbRatio('<img class="thumb" src="/a.webp" width="640" height="360">')).toEqual([]);
  });
  it('allows a small rounding difference such as 1200 x 676', () => { expect(checkThumbRatio('<img class="thumb" src="/a.webp" width="1200" height="676">')).toEqual([]); });
  it('errors on a square, a 4:3 and a very wide thumbnail', () => {
    for (const [w, h] of [[800, 800], [1200, 900], [1200, 400]]) expect(checkThumbRatio(`<img class="thumb" src="/a.webp" width="${w}" height="${h}">`)).toHaveLength(1);
  });
  it('names the size and the address in the sentence', () => {
    const e = checkThumbRatio('<img class="thumb" src="/media/x.webp" width="800" height="800">')[0];
    expect(e).toContain('800 x 800'); expect(e).toContain('/media/x.webp');
  });
  it('errors on a width or height that is not a whole number above 0', () => {
    for (const [w, h] of [['0', '675'], ['abc', '675'], ['1200', '-5'], ['12.5', '7']]) expect(checkThumbRatio(`<img class="thumb" src="/a.webp" width="${w}" height="${h}">`)).toHaveLength(1);
  });
  it('leaves a thumbnail with no width or height to the other check', () => {
    expect(checkThumbRatio('<img class="thumb" src="/a.webp">')).toEqual([]);
    expect(checkThumbRatio('<img class="thumb" src="/a.webp" width="1200">')).toEqual([]);
  });
  it('looks only at pictures with the class thumb as a whole word', () => {
    expect(checkThumbRatio('<img class="avatar" src="/a.webp" width="100" height="100">')).toEqual([]);
    expect(checkThumbRatio('<img class="thumbnail" src="/a.webp" width="100" height="100">')).toEqual([]);
    expect(checkThumbRatio('<img class="big thumb" src="/a.webp" width="100" height="100">')).toHaveLength(1);
  });
  it('skips pictures inside script and template and ignores a value that is not text', () => {
    expect(checkThumbRatio('<script>var s=\'<img class="thumb" width="1" height="1">\';</script><template><img class="thumb" width="1" height="1"></template>')).toEqual([]);
    expect(checkThumbRatio(undefined as any)).toEqual([]);
  });
  it('checks every thumbnail of the page', () => {
    expect(checkThumbRatio(ok + '<img class="thumb" src="/b.webp" width="10" height="10">' + '<img class="thumb" src="/c.webp" width="20" height="20">')).toHaveLength(2);
  });
});

describe('thumbCssProblem', () => {
  it('passes the real rule of the site', () => { expect(thumbCssProblem(css)).toBeNull(); });
  it('passes with spaces, upper case, !important and the rule in a list or a media query', () => {
    expect(thumbCssProblem('.thumb { aspect-ratio : 16 / 9 ; object-fit : COVER }')).toBeNull();
    expect(thumbCssProblem('.card .x,.thumb{aspect-ratio:16/9!important;object-fit:cover!important}')).toBeNull();
    expect(thumbCssProblem('@media (min-width:600px){.thumb{aspect-ratio:16/9;object-fit:cover}}')).toBeNull();
  });
  it('passes when the two lines are in two rules of .thumb', () => { expect(thumbCssProblem('.thumb{aspect-ratio:16/9}.thumb{object-fit:cover}')).toBeNull(); });
  it('says so when there is no rule for .thumb', () => {
    expect(thumbCssProblem('.card{color:red}')).toContain('no style');
    expect(thumbCssProblem('')).toContain('no style');
    expect(thumbCssProblem(undefined as any)).toContain('no style');
  });
  it('does not take .thumbnail or .card .thumb as the rule of .thumb', () => {
    expect(thumbCssProblem('.thumbnail{aspect-ratio:16/9;object-fit:cover}')).toContain('no style');
    expect(thumbCssProblem('.card .thumb{aspect-ratio:16/9;object-fit:cover}')).toContain('no style');
  });
  it('does not take a value that only starts like the right one', () => {
    expect(thumbCssProblem('.thumb{aspect-ratio:16/90;object-fit:cover}')).toContain('aspect-ratio 16/9');
    expect(thumbCssProblem('.thumb{aspect-ratio:16/9;object-fit:covering}')).toContain('object-fit cover');
  });
  it('says what was lost', () => {
    expect(thumbCssProblem('.thumb{object-fit:cover}')).toContain('aspect-ratio 16/9');
    expect(thumbCssProblem('.thumb{aspect-ratio:4/3;object-fit:cover}')).toContain('aspect-ratio 16/9');
    expect(thumbCssProblem('.thumb{aspect-ratio:16/9}')).toContain('object-fit cover');
    expect(thumbCssProblem('.thumb{aspect-ratio:16/9;object-fit:fill}')).toContain('object-fit cover');
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const page = (body: string, style: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex">${style ? `<style>${style}</style>` : ''}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>Page</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (body: string, style: string, cssFile = '') => {
    const d = mkdtempSync(join(tmpdir(), 'ir-')); mkdirSync(join(d, 'dist/_astro'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), page(body, style));
    if (cssFile) writeFileSync(join(d, 'dist/_astro/site.css'), cssFile);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('passes a 16:9 thumbnail with its style in a style block', () => { const r = run(ok, css); expect(r.stdout).toContain('Validation passed.'); expect(r.status).toBe(0); });
  it('passes a 16:9 thumbnail with its style in a css file', () => { expect(run(ok, '', css).status).toBe(0); });
  it('fails a thumbnail that is not 16:9', () => { const r = run('<img class="thumb" src="/a.webp" alt="A" width="800" height="800">', css); expect(r.stderr).toContain('not 16:9'); expect(r.status).toBe(1); });
  it('fails when the style of .thumb has lost the ratio', () => { const r = run(ok, '.thumb{object-fit:cover}'); expect(r.stderr).toContain('aspect-ratio 16/9'); expect(r.status).toBe(1); });
  it('does not look for the style when no page has a thumbnail', () => { const r = run('<p>no picture</p>', ''); expect(r.status).toBe(0); });
});
