import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkHeadingOrder } from '../../scripts/heading-order-lib.mjs';

const wrap = (body: string) => `<!doctype html><html lang="en"><head><title>T</title></head><body><main id="main">${body}</main></body></html>`;
const errs = (body: string) => checkHeadingOrder(wrap(body)).errors;
const warns = (body: string) => checkHeadingOrder(wrap(body)).warnings;

describe('checkHeadingOrder', () => {
  it('a page with no heading passes with no message', () => {
    expect(checkHeadingOrder(wrap('<p>Hello</p>'))).toEqual({ errors: [], warnings: [] });
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkHeadingOrder(v as any).errors.length).toBe(1);
  });
  it('h1 then h2 then h3 in order passes', () => {
    expect(checkHeadingOrder(wrap('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>'))).toEqual({ errors: [], warnings: [] });
  });
  it('going back up is fine: h4 then h2', () => {
    expect(warns('<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h2>E</h2><h3>F</h3>')).toEqual([]);
  });
  it('an h3 straight after the h1 warns and names both', () => {
    const w = warns('<h1>Top</h1><h3>Card</h3>');
    expect(w.length).toBe(1);
    expect(w[0]).toMatch(/h3 "Card" follows h1 "Top" and skips a level \(no h2 between them\)/);
  });
  it('an h4 straight after an h2 warns', () => {
    const w = warns('<h1>A</h1><h2>B</h2><h4>C</h4>');
    expect(w.length).toBe(1);
    expect(w[0]).toMatch(/h4 "C" follows h2 "B".*no h3/);
  });
  it('twelve cards in a row after a jump give one message, not twelve', () => {
    expect(warns('<h1>A</h1>' + '<h3>Card</h3>'.repeat(12)).length).toBe(1);
  });
  it('two separate jumps give two messages', () => {
    expect(warns('<h1>A</h1><h3>B</h3><h2>C</h2><h4>D</h4>').length).toBe(2);
  });
  it('a jump is never an error, only a warning', () => {
    expect(errs('<h1>A</h1><h4>B</h4>')).toEqual([]);
  });
  it('an empty heading is an error', () => {
    for (const b of ['<h1>A</h1><h2></h2>', '<h1>A</h1><h2>   </h2>', '<h1>A</h1><h2>&nbsp;</h2>', '<h1>A</h1><h2>&#8203;</h2>', '<h1>A</h1><h2><span></span></h2>', '<h1></h1>'])
      expect(errs(b).length).toBe(1);
    expect(errs('<h1>A</h1><h2></h2>')[0]).toMatch(/empty heading h2/);
  });
  it('a heading with only an icon svg is empty; with an aria-label it is not', () => {
    expect(errs('<h1>A</h1><h2><svg><path d="M0 0"/></svg></h2>').length).toBe(1);
    expect(errs('<h1>A</h1><h2 aria-label="Menu"><svg></svg></h2>')).toEqual([]);
    expect(errs('<h1>A</h1><h2><span role="img" aria-label="Menu"></span></h2>')).toEqual([]);
  });
  it('the alt text of a picture is a name; an empty alt is not', () => {
    expect(errs('<h1><img src="/a.png" alt="Shivam Das News"></h1>')).toEqual([]);
    expect(errs('<h1>A</h1><h2><img src="/a.png" alt=""></h2>').length).toBe(1);
  });
  it('headings that come before the h1 give one message with the first three named', () => {
    const w = warns('<h3>Categories</h3><h3>Colour style</h3><h1>Home</h1><h2>News</h2>');
    expect(w.length).toBe(1);
    expect(w[0]).toMatch(/^2 headings come before the h1 \(h3 "Categories", h3 "Colour style"\)/);
    const many = warns('<h3>a</h3><h3>b</h3><h3>c</h3><h3>d</h3><h1>Home</h1>');
    expect(many[0]).toMatch(/^4 headings.*"c", \.\.\.\)/);
  });
  it('one heading before the h1 says "comes" and not "come"', () => {
    expect(warns('<h2>x</h2><h1>A</h1>')[0]).toMatch(/^1 heading comes before the h1/);
  });
  it('the headings before the h1 do not count for the skipped levels after it', () => {
    expect(warns('<h3>Menu</h3><h1>A</h1><h2>B</h2>').length).toBe(1);
    expect(warns('<h3>Menu</h3><h1>A</h1><h3>B</h3>').length).toBe(2);
  });
  it('a page with no h1 reports only empty headings (the count of h1 is checked elsewhere)', () => {
    expect(checkHeadingOrder(wrap('<h2>A</h2><h4>B</h4>'))).toEqual({ errors: [], warnings: [] });
    expect(errs('<h2>A</h2><h4></h4>').length).toBe(1);
  });
  it('a heading with aria-hidden or hidden is not checked', () => {
    expect(errs('<h1>A</h1><h2 aria-hidden="true"></h2><h2 hidden></h2>')).toEqual([]);
    expect(warns('<h1>A</h1><h4 aria-hidden="true">x</h4><h2>B</h2>')).toEqual([]);
    expect(warns('<h1>A</h1><h4 hidden>x</h4>')).toEqual([]);
    expect(warns('<h1>A</h1><h4 hidden="">x</h4>')).toEqual([]);
    expect(errs('<h1>A</h1><h2 class="hidden"></h2>').length).toBe(1);
    expect(errs('<h1>A</h1><h2 data-hidden="x" title="a hidden b"></h2>').length).toBe(1);
  });
  it('headings inside script, style, template and comments are ignored', () => {
    expect(errs('<h1>A</h1><script>var h = "<h2></h2>";</script>')).toEqual([]);
    expect(errs('<h1>A</h1><style>/* <h2></h2> */</style>')).toEqual([]);
    expect(errs('<h1>A</h1><template><h2></h2></template>')).toEqual([]);
    expect(errs('<h1>A</h1><!-- <h2></h2> -->')).toEqual([]);
    expect(warns('<h1>A</h1><!-- <h4>x</h4> -->')).toEqual([]);
  });
  it('reads upper case tags, single quotes and unquoted values', () => {
    expect(warns('<H1>A</H1><H3 CLASS=x>B</H3>').length).toBe(1);
    expect(errs("<H1>A</H1><H2 ID='x'></H2>").length).toBe(1);
    expect(errs('<h1>A</h1><h2 aria-label=Menu></h2>')).toEqual([]);
  });
  it('a > sign inside an attribute does not break the reading', () => {
    expect(errs('<h1 data-x="a>b">A</h1><h2 data-x="a>b"></h2>').length).toBe(1);
    expect(errs('<h1>A</h1><h2 data-x="a>b" aria-label="B"></h2>')).toEqual([]);
  });
  it('a tag that only starts like a heading is not read', () => {
    expect(checkHeadingOrder(wrap('<h1>A</h1><header></header><hr><hgroup></hgroup><h7>x</h7>'))).toEqual({ errors: [], warnings: [] });
    expect(warns('<h1>A</h1><h3x>Z</h3x><h3>B</h3>')[0]).toMatch(/^h3 "B" follows h1 "A"/);
  });
  it('text with tags inside a heading counts as the name', () => {
    expect(errs('<h1><a href="/">Home</a></h1><h2><em>Big</em> news</h2>')).toEqual([]);
  });
  it('a long name is shortened in the message', () => {
    const w = warns(`<h1>A</h1><h3>${'x'.repeat(80)}</h3>`);
    expect(w[0]).toMatch(/h3 "x{37}\.\.\."/);
  });
  it('the real shapes of this site: menu h3 first, hidden h1 with class sr, h2 sections, card h3 inside the grid', () => {
    const body = '<h3>Categories</h3><h3>Colour style</h3><h1 class="sr">Shivam Das News</h1><h2>Welcome</h2><h2 class="sec" id="trending-title">Trending now</h2><h3>Card</h3>';
    const r = checkHeadingOrder(wrap(body));
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const shell = (body: string) =>
    '<!doctype html><html lang="en"><head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    `<body data-page-type="404"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'ho-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('headings in order pass with no heading message', () => {
    const r = run(shell('<h2>A</h2><h3>B</h3>'));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
    expect(r.stderr).not.toMatch(/skips a level|before the h1/);
  });
  it('an empty heading stops the build', () => {
    const r = run(shell('<h2></h2>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/an empty heading h2/);
  });
  it('a skipped level only warns', () => {
    const r = run(shell('<h3>Card</h3>'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn:.*h3 "Card" follows h1 "T" and skips a level/);
  });
});
