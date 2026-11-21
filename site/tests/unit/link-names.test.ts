import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkLinkNames } from '../../scripts/link-names-lib.mjs';

const wrap = (body: string) => `<!doctype html><html lang="en"><head><title>T</title></head><body><main id="main"><h1>T</h1>${body}</main></body></html>`;
const errs = (body: string) => checkLinkNames(wrap(body)).errors;
const warns = (body: string) => checkLinkNames(wrap(body)).warnings;

describe('checkLinkNames', () => {
  it('a page with no link and no button passes with no message', () => {
    expect(checkLinkNames(wrap('<p>Hello</p>'))).toEqual({ errors: [], warnings: [] });
  });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkLinkNames(v as any).errors.length).toBe(1);
  });
  it('a link with text has a name', () => {
    expect(checkLinkNames(wrap('<a href="/x/">Politics</a>'))).toEqual({ errors: [], warnings: [] });
  });
  it('a link with no text is an error that names the address', () => {
    const e = errs('<a href="/search/"></a>');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/link to "\/search\/" has no name/);
  });
  it('spaces, a non breaking space and a zero width space are not a name', () => {
    expect(errs('<a href="/x/">   </a>').length).toBe(1);
    expect(errs('<a href="/x/">&nbsp;</a>').length).toBe(1);
    expect(errs('<a href="/x/">&#8203;</a>').length).toBe(1);
    expect(errs('<a href="/x/">\u00a0\u200b</a>').length).toBe(1);
  });
  it('an icon only link with a svg and no name is an error; with aria-label it passes', () => {
    expect(errs('<a href="/x/"><svg viewBox="0 0 1 1"><path d="M0 0"/></svg></a>').length).toBe(1);
    expect(errs('<a href="/x/" aria-label="Search"><svg viewBox="0 0 1 1"><path d="M0 0"/></svg></a>')).toEqual([]);
  });
  it('a svg title is a name', () => {
    expect(errs('<a href="/x/"><svg><title>Search</title><path d="M0 0"/></svg></a>')).toEqual([]);
    expect(errs('<a href="/x/"><svg><title> </title></svg></a>').length).toBe(1);
  });
  it('an empty aria-label is not a name', () => {
    expect(errs('<a href="/x/" aria-label=""></a>').length).toBe(1);
    expect(errs('<a href="/x/" aria-label="   "></a>').length).toBe(1);
  });
  it('a title alone is not a name', () => {
    expect(errs('<a href="/x/" title="Search"></a>').length).toBe(1);
    expect(errs('<button title="Close"></button>').length).toBe(1);
  });
  it('aria-labelledby needs an id that exists on the page', () => {
    expect(errs('<span id="t">Search</span><a href="/x/" aria-labelledby="t"></a>')).toEqual([]);
    expect(errs('<a href="/x/" aria-labelledby="ghost"></a>').length).toBe(1);
    expect(errs('<span id="t">S</span><a href="/x/" aria-labelledby="ghost t"></a>')).toEqual([]);
  });
  it('the alt text of a picture inside the link is a name; an empty alt is not', () => {
    expect(errs('<a href="/x/"><img src="/a.png" alt="Home"></a>')).toEqual([]);
    expect(errs('<a href="/x/"><img src="/a.png" alt=""></a>').length).toBe(1);
    expect(errs('<a href="/x/"><img src="/a.png"></a>').length).toBe(1);
  });
  it('a part inside the link with its own aria-label is a name', () => {
    expect(errs('<a href="/x/"><span role="img" aria-label="RSS"></span></a>')).toEqual([]);
  });
  it('text hidden from a screen reader does not count, and what follows it does', () => {
    expect(errs('<a href="/x/"><span aria-hidden="true">Search</span></a>').length).toBe(1);
    expect(errs('<a href="/x/"><svg aria-hidden="true"><title>Search</title></svg></a>').length).toBe(1);
    expect(errs('<a href="/x/"><span aria-hidden="true">x</span><span class="sr-only">Search</span></a>')).toEqual([]);
  });
  it('a nested tag of the same name inside a hidden part does not cut it short', () => {
    expect(errs('<a href="/x/"><span aria-hidden="true"><span>in</span>still hidden</span></a>').length).toBe(1);
    expect(errs('<a href="/x/"><span aria-hidden="true"><span>in</span>still hidden</span>Visible</a>')).toEqual([]);
  });
  it('a hidden part that is never closed hides everything after it', () => {
    expect(errs('<a href="/x/"><span aria-hidden="true">Search</a>').length).toBe(1);
  });
  it('a link that is itself aria-hidden is not checked', () => {
    expect(errs('<a href="/x/" aria-hidden="true" tabindex="-1"></a>')).toEqual([]);
  });
  it('an anchor without href is not a link and is not checked', () => {
    expect(errs('<a id="top"></a><a name="x"></a>')).toEqual([]);
  });
  it('a button with text, aria-label or labelledby has a name; an empty one does not', () => {
    expect(errs('<button type="button">Open menu</button>')).toEqual([]);
    expect(errs('<button type="button" aria-label="Open menu"><svg></svg></button>')).toEqual([]);
    expect(errs('<span id="l">Menu</span><button aria-labelledby="l"></button>')).toEqual([]);
    const e = errs('<button type="button" id="menu-btn"><svg></svg></button>');
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/button \(id "menu-btn"\) has no name/);
  });
  it('the button message names the class when there is no id or name', () => {
    expect(errs('<button class="theme-toggle x"></button>')[0]).toMatch(/class "theme-toggle"/);
    expect(errs('<button></button>')[0]).toMatch(/no id, name or class/);
  });
  it('input submit and reset always have a name; input button needs a value or an aria-label', () => {
    expect(errs('<input type="submit"><input type="reset">')).toEqual([]);
    expect(errs('<input type="button" value="Go">')).toEqual([]);
    expect(errs('<input type="button" aria-label="Go">')).toEqual([]);
    expect(errs('<input type="button">').length).toBe(1);
    expect(errs('<input type="button" value="  ">').length).toBe(1);
  });
  it('input image needs an alt or an aria-label', () => {
    expect(errs('<input type="image" src="/a.png" alt="Search">')).toEqual([]);
    expect(errs('<input type="image" src="/a.png" aria-label="Search">')).toEqual([]);
    expect(errs('<input type="image" src="/a.png">').length).toBe(1);
  });
  it('other inputs are not checked here (8g checks fields)', () => {
    expect(errs('<input type="text"><input type="checkbox"><input type="hidden">')).toEqual([]);
  });
  it('links and buttons inside script, style, template and comments are ignored', () => {
    expect(errs('<script>var h = "<a href=\'/x/\'></a>";</script>')).toEqual([]);
    expect(errs('<style>/* <button></button> */</style>')).toEqual([]);
    expect(errs('<template><a href="/x/"></a></template>')).toEqual([]);
    expect(errs('<!-- <a href="/x/"></a> -->')).toEqual([]);
  });
  it('reads upper case tags, single quotes and unquoted values', () => {
    expect(errs("<A HREF='/x/'>Politics</A>")).toEqual([]);
    expect(errs('<A HREF=/x/></A>').length).toBe(1);
    expect(errs('<BUTTON TYPE=button ARIA-LABEL=Menu></BUTTON>')).toEqual([]);
    expect(errs('<A HREF="/x/"><IMG SRC="/a.png" ALT="Home"></A>')).toEqual([]);
    expect(errs('<INPUT TYPE="BUTTON">').length).toBe(1);
    expect(errs('<INPUT TYPE="Image" SRC="/a.png">').length).toBe(1);
  });
  it('a > sign inside an attribute does not break the reading', () => {
    expect(errs('<a href="/x/" data-x="a>b">Politics</a>')).toEqual([]);
    expect(errs('<a href="/x/" data-x="a>b"></a>').length).toBe(1);
    expect(errs('<button data-x="a>b" aria-label="Menu"></button>')).toEqual([]);
  });
  it('a tag that only starts like a or button is not read', () => {
    expect(errs('<abbr title="x"></abbr><article></article><buttons></buttons><aside></aside>')).toEqual([]);
  });
  it('two links in a row are read one at a time: one good one does not hide a bad one', () => {
    expect(errs('<a href="/a/">A</a><a href="/b/"></a><a href="/c/">C</a>').length).toBe(1);
  });
  it('a vague text only warns', () => {
    for (const t of ['click here', 'Click Here', 'here', 'more', 'Read more', 'Learn more', 'link', 'this link', 'Read more.', 'Read more >']) {
      expect(errs(`<a href="/x/">${t}</a>`)).toEqual([]);
      expect(warns(`<a href="/x/">${t}</a>`).length).toBe(1);
    }
    expect(warns('<a href="/x/">Read more about the vote</a>')).toEqual([]);
  });
  it('a vague text with an aria-label that says more does not warn', () => {
    expect(warns('<a href="/x/" aria-label="Read more about the vote">Read more</a>')).toEqual([]);
  });
  it('a long address is shortened in the message', () => {
    const e = errs(`<a href="/${'a'.repeat(100)}/"></a>`);
    expect(e[0].length).toBeLessThan(160);
    expect(e[0]).toMatch(/\.\.\."/);
  });
  it('the real shapes of this site pass: skip link, icon button with aria-label, link with a hidden icon and a text', () => {
    const body = '<a class="skip" href="#main">Skip to content</a>' +
      '<button type="button" id="menu" aria-label="Open menu" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"/></svg></button>' +
      '<a href="/feed.xml"><svg aria-hidden="true"><path d="M0 0"/></svg><span>RSS</span></a>' +
      '<form><input type="search" aria-label="Search"><button type="submit">Search</button></form>';
    expect(checkLinkNames(wrap(body))).toEqual({ errors: [], warnings: [] });
  });
});

describe('the build gate (validate-html.mjs) with a fake dist folder', () => {
  const shell = (body: string) =>
    '<!doctype html><html lang="en"><head><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    `<body data-page-type="404"><a class="skip" href="#main">Skip to content</a><header>h</header><main id="main"><h1>T</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (html: string) => {
    const d = mkdtempSync(join(tmpdir(), 'ln-')); mkdirSync(join(d, 'dist'), { recursive: true });
    writeFileSync(join(d, 'dist/index.html'), html);
    return spawnSync('node', [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: d, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org' } });
  };
  it('a page with named links and buttons passes', () => {
    const r = run(shell('<a href="/a/">Politics</a><button type="button" aria-label="Menu"><svg></svg></button>'));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Validation passed.');
  });
  it('a link with no name stops the build', () => {
    const r = run(shell('<a href="/search/"><svg></svg></a>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/link to "\/search\/" has no name/);
  });
  it('a button with no name stops the build', () => {
    const r = run(shell('<button type="button" id="menu"><svg></svg></button>'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/button \(id "menu"\) has no name/);
  });
  it('a vague link text only warns', () => {
    const r = run(shell('<a href="/a/">click here</a>'));
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warn:.*click here/);
  });
});
