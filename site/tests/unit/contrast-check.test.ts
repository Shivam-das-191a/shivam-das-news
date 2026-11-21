import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkContrast, contrastRatio, parseColor } from '../../scripts/contrast-lib.mjs';

const errs = (css: string) => checkContrast(css).errors;
const warns = (css: string) => checkContrast(css).warnings;
const none = { errors: [], warnings: [] };

// A small good palette: light page, dark page, one colour style. Every pair is 4.5:1 or better.
const good =
  ':root{--acc:#cc4600;--acc-t:#cc4600;--bg:#fff;--card:#fff;--text:#12203a;--muted:#5a6b85}' +
  '@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#101a3a;--card:#16213f;--text:#eaf0ff;--muted:#a3b3d3;--acc-t:#e06b2e}}' +
  ':root[data-theme="dark"]{--bg:#101a3a;--card:#16213f;--text:#eaf0ff;--muted:#a3b3d3;--acc-t:#e06b2e}' +
  ':root[data-style="sky"]{--acc:#2e68f7;--acc-t:#2e68f7}' +
  ':root[data-theme="dark"][data-style="sky"]{--acc-t:#5486ff}';

describe('parseColor', () => {
  it('is not a colour: null, no crash', () => {
    for (const v of [undefined, null, 5, {}, '', '   ', 'red', 'inherit', 'currentColor', 'transparent', 'hsl(0 0% 0%)', 'linear-gradient(#fff,#000)', '#12', '#12345', '#1234567', '#ggg'])
      expect(parseColor(v as any), String(v)).toBeNull();
  });
  it('reads 3, 6 digit hex in any case', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#12203a')).toEqual({ r: 18, g: 32, b: 58 });
    expect(parseColor('  #CC4600 ')).toEqual({ r: 204, g: 70, b: 0 });
  });
  it('reads 4 and 8 digit hex only when the alpha is full', () => {
    expect(parseColor('#ffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#ffffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#fff8')).toBeNull();
    expect(parseColor('#ffffff80')).toBeNull();
  });
  it('reads rgb and rgba with commas or spaces', () => {
    expect(parseColor('rgb(18, 32, 58)')).toEqual({ r: 18, g: 32, b: 58 });
    expect(parseColor('rgb(18 32 58)')).toEqual({ r: 18, g: 32, b: 58 });
    expect(parseColor('rgba(18,32,58,1)')).toEqual({ r: 18, g: 32, b: 58 });
    expect(parseColor('rgb(18 32 58 / 100%)')).toEqual({ r: 18, g: 32, b: 58 });
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('a colour with alpha under 1 is not solid: null', () => {
    expect(parseColor('rgba(0,0,0,.5)')).toBeNull();
    expect(parseColor('rgb(0 0 0 / 50%)')).toBeNull();
    expect(parseColor('rgba(0,0,0,0)')).toBeNull();
  });
  it('a channel out of range is held at 0 and 255; a bad number is null', () => {
    expect(parseColor('rgb(300, -5, 0)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('rgb(a, 0, 0)')).toBeNull();
    expect(parseColor('rgb(1, 2)')).toBeNull();
    expect(parseColor('rgb(1, 2, 3, 4, 5)')).toBeNull();
  });
  it('white and black by name', () => {
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('BLACK')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('contrastRatio', () => {
  it('black on white is 21, white on white is 1', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
  });
  it('does not care which colour comes first', () => {
    expect(contrastRatio('#cc4600', '#fff')).toBeCloseTo(contrastRatio('#fff', '#cc4600') as number, 8);
  });
  it('the site accent with white text is 4.5 or better', () => {
    expect(contrastRatio('#cc4600', '#ffffff') as number).toBeGreaterThanOrEqual(4.5);
  });
  it('null when a colour cannot be read', () => {
    expect(contrastRatio('red', '#fff')).toBeNull();
    expect(contrastRatio('#fff', undefined as any)).toBeNull();
  });
  it('takes parsed colours too', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });
});

describe('checkContrast: the basics', () => {
  it('is not a style: one error, no crash', () => {
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(checkContrast(v as any).errors.length).toBe(1);
  });
  it('a style with no colours and no rule pairs gives no message', () => {
    expect(checkContrast('body{margin:0}.x{padding:4px}')).toEqual(none);
  });
  it('a good palette passes with no message', () => {
    expect(checkContrast(good)).toEqual(none);
  });
  it('a good palette with good rules passes', () => {
    expect(checkContrast(good + '.btn{color:var(--text);background:var(--card)}.hot{color:#fff;background:var(--acc)}')).toEqual(none);
  });
});

describe('checkContrast: the colour tokens (Part A)', () => {
  it('a weak --muted in light is one error per surface; the message names the pair and lists the looks where it fails', () => {
    const e = errs(good.replace('--muted:#5a6b85', '--muted:#aaaaaa'));
    expect(e.length).toBe(2); // on --bg and on --card
    expect(e[0]).toMatch(/^--muted on --bg is 2\.32:1 in the looks light, light \(sky\); text must keep 4\.5:1 \(WCAG 1\.4\.3\)/);
    expect(e[1]).toMatch(/^--muted on --card is 2\.32:1 in the looks light, light \(sky\)/);
  });
  it('a weak --text in dark is an error in dark only', () => {
    const e = errs(good.replace(/--text:#eaf0ff/g, '--text:#4a5a7a'));
    expect(e.length).toBeGreaterThan(0);
    for (const m of e) { expect(m).toMatch(/dark/); expect(m).not.toMatch(/light/); }
  });
  it('a weak --acc-t is an error', () => {
    const e = errs(good.replace('--acc-t:#cc4600', '--acc-t:#ffb08a'));
    expect(e.some((m: string) => /^--acc-t on --bg is [\d.]+:1 in the (light look|looks light)/.test(m))).toBe(true);
  });
  it('a weak fill with white text is an error', () => {
    const e = errs(good.replace('--acc:#cc4600', '--acc:#ffcc00'));
    expect(e.some((m: string) => /^white text on --acc is [\d.]+:1 in the (light look|looks light)/.test(m))).toBe(true);
  });
  it('a weak colour style is named', () => {
    const e = errs(good.replace('--acc:#2e68f7', '--acc:#9ab7ff'));
    expect(e.some((m: string) => /white text on --acc is [\d.]+:1 in the looks light \(sky\), dark \(sky\)/.test(m))).toBe(true); // --acc is not changed in dark, so it fails there too
  });
  it('a weak dark colour style text is named', () => {
    const e = errs(good.replace('--acc-t:#5486ff', '--acc-t:#1a2a6a'));
    expect(e.some((m: string) => /^--acc-t on --bg is [\d.]+:1 in the dark \(sky\) look|the looks .*dark \(sky\)/.test(m))).toBe(true);
  });
  it('4.5:1 exactly passes, 4.49 fails and is shown as 4.49 (never rounded up)', () => {
    // #767676 on white is 4.54:1; #777777 on white is 4.48:1
    expect(errs(':root{--bg:#fff;--card:#fff;--text:#767676}')).toEqual([]);
    const e = errs(':root{--bg:#fff;--card:#fff;--text:#777777}');
    expect(e.length).toBe(2);
    expect(e[0]).toMatch(/is 4\.4\d:1/);
    expect(e[0]).not.toMatch(/is 4\.5/);
  });
  it('a token that is not a colour is not judged', () => {
    expect(checkContrast(':root{--bg:#fff;--card:#fff;--text:red;--muted:var(--nothing)}')).toEqual(none);
  });
  it('a token with a var() chain is followed', () => {
    expect(errs(':root{--ink:#aaaaaa;--text:var(--ink);--bg:#fff;--card:#fff}').length).toBe(2);
    expect(checkContrast(':root{--ink:#12203a;--text:var(--ink);--bg:#fff;--card:#fff}')).toEqual(none);
  });
  it('a var() with a fallback uses the fallback when the name is missing', () => {
    expect(errs(':root{--text:var(--nope,#aaaaaa);--bg:#fff;--card:#fff}').length).toBe(2);
  });
  it('a token with an alpha colour is not solid and is not judged', () => {
    expect(checkContrast(':root{--text:rgba(0,0,0,.4);--bg:#fff;--card:#fff}')).toEqual(none);
  });
  it('rgb() tokens are judged like hex', () => {
    expect(errs(':root{--text:rgb(170,170,170);--bg:rgb(255,255,255);--card:#fff}').length).toBe(2);
  });
  it('a dark rule only changes the dark look; the light look keeps its own value', () => {
    const e = errs(':root{--bg:#fff;--card:#fff;--text:#12203a}:root[data-theme="dark"]{--bg:#101a3a;--card:#16213f;--text:#2a3a5a}');
    expect(e.length).toBe(2);
    for (const m of e) expect(m).toMatch(/in the dark look/);
  });
  it('the media query for dark is read as dark, and :not([data-theme=light]) is not read as light', () => {
    const e = errs(':root{--bg:#fff;--card:#fff;--text:#12203a}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#101a3a;--card:#16213f;--text:#2a3a5a}}');
    expect(e.length).toBe(2);
    for (const m of e) expect(m).toMatch(/in the dark look/);
  });
  it('a rule on another switch (a future look) is not mixed into the palettes', () => {
    expect(checkContrast(good + ':root[data-look="playful"]{--text:#ffffff;--bg:#ffffff}')).toEqual(none);
  });
  it('a custom property on a class is not a root token', () => {
    expect(checkContrast(good + '.card{--text:#ffffff}')).toEqual(none);
  });
  it('each message is given once, not once per rule that repeats it', () => {
    const e = errs(good.replace('--muted:#5a6b85', '--muted:#aaaaaa') + ':root{--muted:#aaaaaa}');
    expect(new Set(e).size).toBe(e.length);
  });
  it('a quoted attribute with single quotes is read like double quotes', () => {
    const e = errs(":root{--bg:#fff;--card:#fff;--text:#12203a}:root[data-theme='dark']{--bg:#101a3a;--card:#16213f;--text:#2a3a5a}");
    expect(e.length).toBe(2);
  });
  it('comments are ignored', () => {
    expect(checkContrast('/* :root{--text:#ffffff;--bg:#ffffff;--card:#ffffff} */' + good)).toEqual(none);
  });
});

describe('checkContrast: a rule with text and background (Part B)', () => {
  it('under 3:1 is an error that names the rule and both colours', () => {
    const e = errs('.tag{color:#cccccc;background:#ffffff}');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/^"\.tag" has text #cccccc on #ffffff, 1\.6:1; the least allowed is 3:1 \(WCAG 1\.4\.3\)$/);
  });
  it('between 3:1 and 4.5:1 is a warning only', () => {
    const r = checkContrast('.tag{color:#949494;background:#ffffff}'); // 3.03:1
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/^"\.tag" has text #949494 on #ffffff, 3\.0\d?:1; normal text needs 4\.5:1/);
  });
  it('4.5:1 or more gives no message', () => {
    expect(checkContrast('.tag{color:#767676;background:#fff}')).toEqual(none);
  });
  it('background-color is read like background', () => {
    expect(errs('.tag{color:#ccc;background-color:#fff}').length).toBe(1);
  });
  it('white on white by name', () => {
    expect(errs('.tag{color:white;background:white}').length).toBe(1);
  });
  it('rgb colours are judged', () => {
    expect(errs('.tag{color:rgb(200,200,200);background:rgb(255,255,255)}').length).toBe(1);
  });
  it('the last declaration wins', () => {
    expect(checkContrast('.tag{color:#ccc;color:#000;background:#fff}')).toEqual(none);
    expect(errs('.tag{color:#000;color:#ccc;background:#fff}').length).toBe(1);
  });
  it('a rule with only a text colour is not judged', () => {
    expect(checkContrast('.tag{color:#ffffff}')).toEqual(none);
  });
  it('a rule with only a background is not judged', () => {
    expect(checkContrast('.tag{background:#ffffff}')).toEqual(none);
  });
  it('var() is resolved for each look and the message says which look', () => {
    const e = errs(good + '.tag{color:var(--muted);background:var(--text)}');
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]).toMatch(/in the (light|dark)/);
  });
  it('a var() that fails only in dark is named dark', () => {
    // text is a fixed dark grey; on the light page it is fine, on the dark page it is not
    const e = errs(good + '.tag{color:#2a3a5a;background:var(--bg)}');
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]).toMatch(/in the dark look/);
  });
  it('a rule with only literal colours is named once, with no look', () => {
    const e = errs(good + '.tag{color:#ccc;background:#fff}');
    expect(e.length).toBe(1);
    expect(e[0]).not.toMatch(/ look/);
  });
  it('a var() with no value and no fallback is not judged', () => {
    expect(checkContrast(good + '.tag{color:var(--nothing);background:#fff}')).toEqual(none);
  });
  it('a var() with a fallback is judged with the fallback', () => {
    expect(errs(good + '.tag{color:var(--nothing,#ccc);background:#fff}').length).toBe(1);
  });
  it('a gradient, a picture or several layers are not judged', () => {
    expect(checkContrast('.a{color:#fff;background:linear-gradient(#fff,#eee)}.b{color:#fff;background:url(x.png) #fff}.c{color:#fff;background:#fff url(x.png)}')).toEqual(none);
  });
  it('currentColor, inherit, transparent and alpha are not judged', () => {
    expect(checkContrast('.a{color:inherit;background:#fff}.b{color:#fff;background:transparent}.c{color:#fff;background:rgba(255,255,255,.5)}.d{color:currentColor;background:#fff}')).toEqual(none);
  });
  it('display:none is not judged', () => {
    expect(checkContrast('.a{display:none;color:#fff;background:#fff}')).toEqual(none);
  });
  it('print, keyframes, font-face, page and property are not judged', () => {
    expect(checkContrast('@media print{.a{color:#fff;background:#fff}}@keyframes k{from{color:#fff;background:#fff}}@font-face{font-family:x;color:#fff;background:#fff}@page{color:#fff;background:#fff}@property --x{syntax:"*";color:#fff;background:#fff}')).toEqual(none);
  });
  it('a screen media query is judged', () => {
    expect(errs('@media(min-width:768px){.a{color:#fff;background:#fff}}').length).toBe(1);
  });
  it('inside the dark media query it is judged in the dark looks only', () => {
    // #2a3a5a on the light page is fine, on the dark page it is not
    const e = errs(good + '@media(prefers-color-scheme:dark){.a{color:#2a3a5a;background:var(--bg)}}');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/in the dark look/);
    // and a pair that only fails in the light looks is not reported from a dark only rule
    expect(checkContrast(good + '@media(prefers-color-scheme:dark){.a{color:#eaf0ff;background:var(--bg)}}')).toEqual(none);
  });
  it('[data-theme=dark] in the selector is dark only; [data-theme=light] is light only', () => {
    expect(errs(good + ':root[data-theme="dark"] .a{color:#2a3a5a;background:var(--bg)}').length).toBe(1);
    expect(checkContrast(good + ':root[data-theme="light"] .a{color:#2a3a5a;background:var(--bg)}')).toEqual(none);
  });
  it('a selector list is judged as one rule and reported once', () => {
    expect(errs('.a,.b{color:#ccc;background:#fff}').length).toBe(1);
  });
  it('between 2:1 and 3:1 is still an error (the line is 3:1, not lower)', () => {
    expect(errs('.tag{color:#b0b0b0;background:#fff}').length).toBe(1); // 2.17:1
    expect(warns('.tag{color:#b0b0b0;background:#fff}')).toEqual([]);
  });
  it('a rule on the root with a text colour and a background is judged too, not taken for a token rule', () => {
    expect(errs('html{color:#ccc;background:#fff}').length).toBe(1);
    expect(errs(':root{color:#ccc;background:#fff}').length).toBe(1);
  });
  it(':not([data-theme=dark]) does not make a rule dark', () => {
    const e = errs(':root{--bg:#fff;--card:#fff;--text:#12203a}:root:not([data-theme="dark"]){--text:#aaaaaa}');
    expect(e.length).toBe(2);
    for (const m of e) expect(m).toMatch(/light/);
  });
  it('colours inside a url() are not read as rules', () => {
    expect(checkContrast('.a{background-image:url(x{color:#ccc;background:#fff})}')).toEqual(none);
  });
  it('a long selector is cut in the message', () => {
    const sel = '.' + 'x'.repeat(80);
    const e = errs(`${sel}{color:#ccc;background:#fff}`);
    expect(e[0].length).toBeLessThan(200);
    expect(e[0]).toContain('...');
  });
  it('a hover rule is judged on its own colours', () => {
    expect(errs(good + '.btn:hover{background:var(--acc);color:#ffffff}')).toEqual([]);
    expect(errs(good + '.btn:hover{background:#ffcc00;color:#ffffff}').length).toBe(1);
  });
  it('a quoted value in a rule does not break the next rule', () => {
    expect(errs('.a::after{content:"}{";color:#000;background:#fff}.b{color:#ccc;background:#fff}').length).toBe(1);
  });
  it('a url with a brace does not break the next rule', () => {
    expect(errs('.a{background-image:url(data:image/svg+xml;utf8,<svg>{</svg>)}.b{color:#ccc;background:#fff}').length).toBe(1);
  });
  it('a style with no palette still judges literal rules', () => {
    expect(errs('.a{color:#ccc;background:#fff}').length).toBe(1);
  });
  it('minified css with no spaces and no last semicolon is read', () => {
    expect(errs('.a{color:#ccc;background:#fff}.b{color:#000;background:#fff}').length).toBe(1);
    expect(checkContrast('.b{color:#000;background:#fff}')).toEqual(none);
  });
  it('!important is ignored in the value', () => {
    expect(errs('.a{color:#ccc!important;background:#fff!important}').length).toBe(1);
  });
});

describe('checkContrast: the real style of the site', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');
  it('src/styles/global.css passes with no error and no warning', () => {
    expect(checkContrast(css)).toEqual(none);
  });
  it('the real style with a weak --muted in light stops', () => {
    expect(errs(css.replace('--muted:#5a6b85', '--muted:#b0b8c8')).length).toBeGreaterThan(0);
  });
  it('the real style with a weak mint dark accent text stops', () => {
    const weak = css.replace(/--acc-t:#349e72/g, '--acc-t:#1d5a40');
    expect(errs(weak).length).toBeGreaterThan(0);
  });
  it('the real style with a weak grape fill stops (white text on it)', () => {
    expect(errs(css.replace(/--acc:#7c3aed/g, '--acc:#c9a8ff')).length).toBeGreaterThan(0);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const shell = (css: string, body = '<p>t</p>') =>
    `<!doctype html><html lang="en"><head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}${css}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
    `<body data-page-type="404"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'cc-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('a good palette passes with no contrast message', () => {
    const r = run(shell(good));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
    expect(r.stderr).not.toMatch(/WCAG 1\.4\.3/);
  });
  it('a weak token stops the build and the message starts with dist:', () => {
    const r = run(shell(good.replace('--muted:#5a6b85', '--muted:#aaaaaa')));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/dist: --muted on --bg is 2\.32:1 in the looks light, light \(sky\)/);
  });
  it('a rule under 3:1 stops the build', () => {
    const r = run(shell('.tag{color:#ccc;background:#fff}'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/dist: "\.tag" has text #ccc on #fff/);
  });
  it('a rule between 3:1 and 4.5:1 only warns', () => {
    const r = run(shell('.tag{color:#949494;background:#fff}'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn: dist: "\.tag" has text #949494 on #fff/);
  });
  it('a weak colour in the style of a css file is judged too', () => {
    const d = mkdtempSync(join(tmpdir(), 'cc-')); mkdirSync(join(d, 'dist/_astro'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), shell(''));
    writeFileSync(join(d, 'dist/_astro/a.css'), '.tag{color:#ccc;background:#fff}');
    const r = spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/dist: "\.tag" has text #ccc on #fff/);
  });
});
