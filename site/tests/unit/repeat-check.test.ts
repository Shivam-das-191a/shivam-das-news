import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkRepeatedParagraphs } from '../../scripts/repeat-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const page = (body: string, head = '<title>A fine title</title>', lang = 'en') => `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${head}</head><body>${body}</body></html>`;
const c = (body: string, head?: string, lang?: string) => checkRepeatedParagraphs(page(body, head, lang));
const L = 'The city council voted on Monday to close the old bridge for repairs.';
const M = 'A second story tells how the harbour reopened after a long storm season.';
const p = (t: string) => `<p>${t}</p>`;
const one = /^1 place has a paragraph written twice in a row/;

describe('checkRepeatedParagraphs: good pages', () => {
  const passes: Array<[string, string, string?]> = [
    ['two different paragraphs', p(L) + p(M)],
    ['one paragraph', p(L)],
    ['no paragraph', '<h1>Title</h1><div>text</div>'],
    ['an empty page', ''],
    ['two equal short paragraphs of 7 words', p('One two three four five six seven.') + p('One two three four five six seven.')],
    ['two equal paragraphs of 3 words', p('Read more here') + p('Read more here')],
    ['two empty paragraphs', '<p></p><p></p>'],
    ['two paragraphs of blanks', '<p>&nbsp;</p><p>&nbsp;</p>'],
    ['two paragraphs of marks only', '<p>-----------</p><p>-----------</p>'],
    ['the same paragraph with another paragraph between', p(L) + p('Other short.') + p(L)],
    ['the same paragraph far apart', p(L) + p(M) + p('A third paragraph with enough words to count here.') + p(L)],
    ['the same text in two list items', `<ul><li>${L}</li><li>${L}</li></ul>`],
    ['the same text in two headings', `<h2>${L}</h2><h2>${L}</h2>`],
    ['the same text in two table cells', `<table><tr><td>${L}</td><td>${L}</td></tr></table>`],
    ['the same text in a paragraph and a list item', p(L) + `<ul><li>${L}</li></ul>`],
    ['a paragraph and a blockquote with the same text', p(L) + `<blockquote>${L}</blockquote>`],
    ['two paragraphs that differ by one word', p(L) + p(L.replace('Monday', 'Tuesday'))],
    ['two paragraphs that differ by a full stop only', p(L) + p(L.replace(/\.$/, '!'))],
    ['a paragraph that starts like the one before', p(L) + p(L + ' It will open again in May.')],
    ['a paragraph that is part of the one before', p(L + ' It will open again in May.') + p(L)],
    ['two paragraphs in comments', `<!-- ${p(L)}${p(L)} --><p>Fine text here and there for readers.</p>`],
    ['two paragraphs in a script, a style and a template', `<script>var a="${p(L)}${p(L)}";</script><style>.a:before{content:"x"}</style><template>${p(L)}${p(L)}</template>`],
    ['two paragraphs in a textarea and a noscript', `<textarea>${p(L)}${p(L)}</textarea><noscript>${p(L)}${p(L)}</noscript>`],
    ['two paragraphs in a pre, a code, a kbd and a samp', `<pre>${p(L)}${p(L)}</pre><code>${p(L)}${p(L)}</code><kbd>${p(L)}${p(L)}</kbd><samp>${p(L)}${p(L)}</samp>`],
    ['two paragraphs in an svg', `<svg>${p(L)}${p(L)}</svg>`],
    ['the text in an attribute', `<p title="${L}">${M}</p><p title="${L}">${M} More words follow in this one.</p>`],
    ['two equal paragraphs of digits and short words, 7 words', p('1 2 3 4 5 6 7') + p('1 2 3 4 5 6 7')],
    ['a paragraph repeated after a heading and a paragraph', p(L) + '<h2>Next</h2>' + p(M) + p(L)],
    ['paragraphs written with a longer tag name', `<pre>${L}</pre><pre>${L}</pre>`],
    ['paragraphs written as p-like tags', `<param name="a" value="${L}"><param name="a" value="${L}">`],
  ];
  for (const [name, body, lang] of passes) {
    it(`${name} passes`, () => { expect(c(body, undefined, lang)).toEqual(none); });
  }
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkRepeatedParagraphs(v as any).errors).toEqual(['the page is not text']);
  });
});

describe('checkRepeatedParagraphs: warnings', () => {
  const slips: Array<[string, string, string?]> = [
    ['the same paragraph twice', p(L) + p(L)],
    ['the same paragraph twice with a line break between the tags', p(L) + '\n' + p(L)],
    ['the same paragraph twice with spaces between the tags', p(L) + '   \n\t  ' + p(L)],
    ['the same paragraph twice with capitals changed', p(L) + p(L.toUpperCase())],
    ['the same paragraph twice with the spacing changed', p(L) + p('  The   city council\nvoted on Monday   to close the old bridge for repairs.  ')],
    ['the same paragraph twice with a blank written as nbsp', p(L) + p(L.replace(/ /g, '&nbsp;'))],
    ['the same paragraph twice with a number reference blank', p(L) + p(L.replace(/ /g, '&#160;'))],
    ['the same paragraph twice with an inline tag in one', p(L) + p(L.replace('city council', '<b>city council</b>'))],
    ['the same paragraph twice with a link in one', p(L) + p(L.replace('old bridge', '<a href="/bridge/">old bridge</a>'))],
    ['the same paragraph twice with a line break tag in one', p(L) + p(L.replace('close the', 'close<br>the'))],
    ['the same paragraph twice with attributes on the tags', '<p class="a" id="x">' + L + '</p><p class="b">' + L + '</p>'],
    ['the same paragraph twice with a capital P tag', '<P>' + L + '</P><P>' + L + '</P>'],
    ['the same paragraph twice with a comment in one', p(L) + p(L.replace('voted', 'voted<!-- note -->'))],
    ['the same paragraph twice where the second has no end tag', p(L) + '<p>' + L],
    ['the same paragraph twice where the first has no end tag', '<p>' + L + p(L)],
    ['the same paragraph twice in a main block', '<main>' + p(L) + p(L) + '</main>'],
    ['the same paragraph twice in an article', '<article>' + p(L) + p(L) + '</article>'],
    ['the same paragraph twice in a div', '<div>' + p(L) + p(L) + '</div>'],
    ['the same paragraph twice in two divs', '<div>' + p(L) + '</div><div>' + p(L) + '</div>'],
    ['the same paragraph twice in a footer', '<footer>' + p(L) + p(L) + '</footer>'],
    ['the same paragraph twice after a different one', p(M) + p(L) + p(L)],
    ['the same paragraph twice before a different one', p(L) + p(L) + p(M)],
    ['exactly 8 words twice', p('One two three four five six seven eight.') + p('One two three four five six seven eight.')],
    ['a long paragraph twice', p((L + ' ').repeat(10)) + p((L + ' ').repeat(10))],
    ['a paragraph in another script twice', p('\u4eca\u65e5 \u306f \u5929\u6c17 \u304c \u3088\u3044 \u3067\u3059 \u306d \u672c\u5f53 \u306b') + p('\u4eca\u65e5 \u306f \u5929\u6c17 \u304c \u3088\u3044 \u3067\u3059 \u306d \u672c\u5f53 \u306b')],
    ['a paragraph in a French page twice', p('Le conseil municipal a vot\u00e9 lundi pour fermer le vieux pont.') + p('Le conseil municipal a vot\u00e9 lundi pour fermer le vieux pont.'), 'fr'],
    ['a page with no lang', p(L) + p(L), ''],
    ['a paragraph twice with a heading in a paragraph before', '<h2>Title</h2>' + p(M) + p(L) + p(L)],
  ];
  for (const [name, body, lang] of slips) {
    it(`${name} is one warning`, () => {
      const r = c(body, undefined, lang);
      expect(r.errors).toEqual([]);
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0]).toMatch(one);
    });
  }
  it('shows the first five words of the first place', () => {
    expect(c(p(L) + p(L)).warnings[0]).toContain('(first: "the city council voted on ...")');
  });
  it('shows the first place, not a later one', () => {
    const r = c(p(L) + p(L) + p(M) + p(M));
    expect(r.warnings[0]).toMatch(/^2 places have/);
    expect(r.warnings[0]).toContain('(first: "the city council voted on ...")');
  });
  it('three copies in a row are two places', () => { expect(c(p(L) + p(L) + p(L)).warnings[0]).toMatch(/^2 places have a paragraph written twice in a row/); });
  it('four copies in a row are three places', () => { expect(c(p(L) + p(L) + p(L) + p(L)).warnings[0]).toMatch(/^3 places have/); });
  it('two separate repeats are two places in one message', () => {
    const r = c(p(L) + p(L) + p('Between these there is one short line of text.') + p(M) + p(M));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^2 places have/);
  });
  it('the warning never becomes an error', () => { expect(c(p(L) + p(L)).errors).toEqual([]); });
  it('the same page twice gives the same answer', () => {
    const h = page(p(L) + p(L));
    expect(checkRepeatedParagraphs(h)).toEqual(checkRepeatedParagraphs(h));
  });
  it('a repeat in the head text is not read as a paragraph', () => {
    expect(checkRepeatedParagraphs(`<!doctype html><html lang="en"><head><title>${L}</title><meta name="description" content="${L}"></head><body><p>Fine.</p></body></html>`)).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (bodyExtra: string, title = 'Test page') =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>${title}</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${bodyExtra}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a page with two different paragraphs passes with no message about a repeated paragraph', () => {
    const r = run(FULL(p(L) + p(M)));
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/written twice in a row/);
  });
  it('a paragraph written twice is a warning, not an error, and names the page', () => {
    const r = run(FULL(p(L) + p(L)));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 1 place has a paragraph written twice in a row/);
  });
  it('two repeats are counted in one message', () => {
    const r = run(FULL(p(L) + p(L) + p('A short line between the two repeated blocks here.') + p(M) + p(M)));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*index\.html: 2 places have a paragraph written twice in a row/);
  });
});
