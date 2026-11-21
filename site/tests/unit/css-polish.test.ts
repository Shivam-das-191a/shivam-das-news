import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkCssPolish } from '../../scripts/css-polish-lib.mjs';

const GOOD = '@media print{a{color:#000}}:focus-visible{outline:3px solid #000}.b{transition:transform .2s}@media (prefers-reduced-motion:reduce){*{transition:none!important}}';
const without = (part: string) => GOOD.replace(part, '');

describe('checkCssPolish', () => {
  it('passes a good style with no message', () => {
    expect(checkCssPolish(GOOD)).toEqual({ errors: [], warnings: [] });
  });
  it('an empty or non-text style is one error, no crash', () => {
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(checkCssPolish(v as any).errors.length).toBe(1);
  });
  it('needs the print rule', () => {
    expect(checkCssPolish(without('@media print{a{color:#000}}')).errors.join()).toMatch(/print/);
    expect(checkCssPolish(GOOD.replace('@media print', '@media screen')).errors.join()).toMatch(/print/);
    expect(checkCssPolish(GOOD.replace('@media print', '@media only print and (min-width:1px)')).errors).toEqual([]);
    expect(checkCssPolish(GOOD.replace('@media print', '@media(print)')).errors).toEqual([]);
  });
  it('a word that only contains print is not print', () => {
    expect(checkCssPolish(GOOD.replace('@media print', '@media blueprint')).errors.join()).toMatch(/print/);
  });
  it('needs a visible focus ring', () => {
    expect(checkCssPolish(without(':focus-visible{outline:3px solid #000}')).errors.join()).toMatch(/focus/);
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'outline:none')).errors.join()).toMatch(/focus/);
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'outline:0')).errors.join()).toMatch(/focus/);
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'color:red')).errors.join()).toMatch(/focus/);
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'outline-width:2px')).errors).toEqual([]);
  });
  it('a property that only ends or starts like outline is not a ring', () => {
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'x-outline:3px solid red')).errors.join()).toMatch(/focus/);
    expect(checkCssPolish(GOOD.replace('outline:3px solid #000', 'outline-offset:2px')).errors.join()).toMatch(/focus/);
  });
  it('the focus rule may be in a list of selectors or inside a media query', () => {
    expect(checkCssPolish(GOOD.replace(':focus-visible{', 'a:focus-visible,button:focus-visible{')).errors).toEqual([]);
    expect(checkCssPolish(GOOD.replace(':focus-visible{outline:3px solid #000}', '@media (min-width:1px){a:focus-visible{outline:2px solid red}}')).errors).toEqual([]);
  });
  it('a focus rule with outline in another rule does not count', () => {
    expect(checkCssPolish(':focus-visible{color:red}.x{outline:2px solid red}@media print{a{color:#000}}').errors.join()).toMatch(/focus/);
  });
  it('motion needs the reduced motion rule', () => {
    expect(checkCssPolish(GOOD.replace('@media (prefers-reduced-motion:reduce){*{transition:none!important}}', '')).errors.join()).toMatch(/reduced-motion/);
    expect(checkCssPolish(GOOD.replace('.b{transition:transform .2s}', '.b{animation:spin 1s infinite}').replace('@media (prefers-reduced-motion:reduce){*{transition:none!important}}', '')).errors.join()).toMatch(/reduced-motion/);
    expect(checkCssPolish(GOOD.replace('.b{transition:transform .2s}', 'html{scroll-behavior:smooth}').replace('@media (prefers-reduced-motion:reduce){*{transition:none!important}}', '')).errors.join()).toMatch(/reduced-motion/);
  });
  it('no motion means no reduced motion rule is needed', () => {
    const calm = '@media print{a{color:#000}}:focus-visible{outline:3px solid #000}.b{transition:none}.c{animation:none}html{scroll-behavior:auto}';
    expect(checkCssPolish(calm).errors).toEqual([]);
  });
  it('a transition of zero is not motion', () => {
    expect(checkCssPolish('@media print{a{color:#000}}:focus-visible{outline:3px solid #000}.b{transition:0s}').errors).toEqual([]);
  });
  it('a property that only ends like transition is not motion', () => {
    expect(checkCssPolish('@media print{a{color:#000}}:focus-visible{outline:3px solid #000}.b{x-transition:all 1s}').errors).toEqual([]);
  });
  it('reads upper case and spaces', () => {
    expect(checkCssPolish(GOOD.replace('@media print', '@MEDIA  PRINT').replace(':focus-visible{outline:3px', ':FOCUS-VISIBLE { OUTLINE : 3px')).errors).toEqual([]);
  });
  it('a comment is not a rule', () => {
    expect(checkCssPolish('/* @media print{} :focus-visible{outline:1px solid red} */.a{color:red}').errors.length).toBe(2);
    expect(checkCssPolish(GOOD + '/* transition:x 1s */').errors).toEqual([]);
  });
  it('gives every problem at once', () => {
    expect(checkCssPolish('.a{transition:all 1s}').errors.length).toBe(3);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">S</a><header>h</header><main id="main"><h1>P</h1></main><footer>f</footer></body></html>';
  const run = (css: string, inBlock = false) => {
    const d = mkdtempSync(join(tmpdir(), 'cp-')); mkdirSync(join(d, 'dist/_astro'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), inBlock ? html.replace('</head>', `<style>${css}</style></head>`) : html);
    if (!inBlock) writeFileSync(join(d, 'dist/_astro/site.css'), css);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('a good style in a css file passes', () => {
    const r = run(GOOD);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
  });
  it('a good style in a style block passes', () => {
    expect(run(GOOD, true).status).toBe(0);
  });
  it('a style with no print rule stops the build', () => {
    const r = run(without('@media print{a{color:#000}}'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/print rule/);
  });
  it('a style with no focus ring stops the build', () => {
    const r = run(GOOD.replace('outline:3px solid #000', 'outline:none'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/focus ring/);
  });
  it('motion without the reduced motion rule stops the build', () => {
    const r = run(GOOD.replace('@media (prefers-reduced-motion:reduce){*{transition:none!important}}', ''));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/reduced-motion/);
  });
  it('a site with no style at all stops the build', () => {
    const r = run('');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no style was found/);
  });
});
