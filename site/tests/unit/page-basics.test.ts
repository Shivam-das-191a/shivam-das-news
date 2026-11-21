import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkPageBasics } from '../../scripts/page-basics-lib.mjs';

const GOOD = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1></main><footer>f</footer></body></html>';
const swap = (from: string, to: string) => GOOD.replace(from, to);

describe('checkPageBasics', () => {
  it('passes a good page with no message', () => {
    expect(checkPageBasics(GOOD)).toEqual({ errors: [], warnings: [] });
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkPageBasics(v as any).errors.length).toBe(1);
  });
  it('needs lang on the html tag, not empty', () => {
    expect(checkPageBasics(swap(' lang="en"', '')).errors.join()).toMatch(/lang/);
    expect(checkPageBasics(swap('lang="en"', 'lang=""')).errors.join()).toMatch(/lang/);
    expect(checkPageBasics(swap('lang="en"', 'lang="   "')).errors.join()).toMatch(/lang/);
    expect(checkPageBasics(swap('lang="en"', "lang='en-US'")).errors).toEqual([]);
    expect(checkPageBasics(swap('lang="en"', 'LANG=en')).errors).toEqual([]);
  });
  it('a lang on another tag does not count', () => {
    expect(checkPageBasics(swap('<html lang="en">', '<html><span lang="en"></span>')).errors.join()).toMatch(/lang/);
  });
  it('needs the viewport meta with width=device-width', () => {
    expect(checkPageBasics(swap('<meta name="viewport" content="width=device-width, initial-scale=1">', '')).errors.join()).toMatch(/viewport/);
    expect(checkPageBasics(swap('width=device-width, initial-scale=1', 'initial-scale=1')).errors.join()).toMatch(/viewport/);
    expect(checkPageBasics(swap('width=device-width, initial-scale=1', 'width = device-width')).errors).toEqual([]);
    expect(checkPageBasics(swap('name="viewport"', 'name="description"')).errors.join()).toMatch(/viewport/);
  });
  it('needs the skip link to #main', () => {
    expect(checkPageBasics(swap('<a class="skip" href="#main">Skip to content</a>', '')).errors.join()).toMatch(/Skip/);
    expect(checkPageBasics(swap('href="#main"', 'href="#content"')).errors.join()).toMatch(/Skip/);
    expect(checkPageBasics(swap('class="skip"', 'class="btn"')).errors.join()).toMatch(/Skip/);
    expect(checkPageBasics(swap('href="#main"', 'href="/main/"')).errors.join()).toMatch(/Skip/);
    expect(checkPageBasics(swap('href="#main"', 'href="#mainly"')).errors.join()).toMatch(/Skip/);
    expect(checkPageBasics(swap('class="skip"', 'class="btn skip big"')).errors).toEqual([]);
  });
  it('needs an element with id main', () => {
    expect(checkPageBasics(swap('<main id="main">', '<main>')).errors.join()).toMatch(/id "main"/);
    expect(checkPageBasics(swap('<main id="main">', '<main id="body">')).errors.join()).toMatch(/id "main"/);
    expect(checkPageBasics(swap('<main id="main">', '<main class="a" id=\'main\'>')).errors).toEqual([]);
  });
  it('needs exactly one main', () => {
    expect(checkPageBasics(swap('<main id="main"><h1>T</h1></main>', '<h1>T</h1><div id="main"></div>')).errors.join()).toMatch(/found 0/);
    expect(checkPageBasics(swap('</main>', '</main><main></main>')).errors.join()).toMatch(/found 2/);
  });
  it('a tag that only starts like main is not main', () => {
    expect(checkPageBasics(swap('<main id="main">', '<mainly id="main">')).errors.join()).toMatch(/found 0/);
  });
  it('needs a header and a footer', () => {
    expect(checkPageBasics(swap('<header>h</header>', '')).errors.join()).toMatch(/header/);
    expect(checkPageBasics(swap('<footer>f</footer>', '')).errors.join()).toMatch(/footer/);
    expect(checkPageBasics(swap('<header>h</header>', '<header class="top card">h</header>')).errors).toEqual([]);
  });
  it('skips text inside script, style and template', () => {
    const only = '<script>"<main></main><footer></footer>"</script>' + GOOD.replace('<footer>f</footer>', '');
    expect(checkPageBasics(only).errors.join()).toMatch(/footer/);
    const tpl = swap('</body>', '<template><main></main></template></body>');
    expect(checkPageBasics(tpl).errors).toEqual([]);
  });
  it('warns about two navs when one has no label', () => {
    const two = swap('<footer>', '<nav aria-label="Site pages">a</nav><nav>b</nav><footer>');
    expect(checkPageBasics(two).warnings.join()).toMatch(/aria-label/);
    expect(checkPageBasics(two).errors).toEqual([]);
    const labelled = swap('<footer>', '<nav aria-label="A">a</nav><nav aria-labelledby="x">b</nav><footer>');
    expect(checkPageBasics(labelled).warnings).toEqual([]);
    expect(checkPageBasics(swap('<footer>', '<nav>a</nav><footer>')).warnings).toEqual([]);
  });
  it('reads upper case tags and single quotes', () => {
    const up = GOOD.replace(/<(\/?)(main|header|footer)/g, (_m, s, n) => `<${s}${n.toUpperCase()}`);
    expect(checkPageBasics(up).errors).toEqual([]);
  });
  it('a > sign inside an attribute does not break the reading', () => {
    expect(checkPageBasics(swap('<main id="main">', '<main data-x="a>b" id="main">')).errors).toEqual([]);
  });
  it('gives every problem at once', () => {
    expect(checkPageBasics('<html><body></body></html>').errors.length).toBe(7);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const page = (shell: string) => `<!doctype html>${shell}`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'pb-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), page(html.replace('<head>', '<head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex">').replace('<body>', '<body data-page-type="404">')));
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  const good = GOOD.replace('<!doctype html>', '');
  it('a good page passes', () => {
    const r = run(good);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
  });
  it('no lang stops the build', () => {
    const r = run(good.replace(' lang="en"', ''));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/lang attribute/);
  });
  it('no skip link stops the build', () => {
    const r = run(good.replace('<a class="skip" href="#main">Skip to content</a>', ''));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Skip to content/);
  });
  it('two mains stop the build', () => {
    const r = run(good.replace('</main>', '</main><main></main>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/exactly one main/);
  });
  it('an unlabelled second nav only warns', () => {
    const r = run(good.replace('<footer>', '<nav aria-label="A">a</nav><nav>b</nav><footer>'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn:.*aria-label/);
  });
});
