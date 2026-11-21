// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS module served to the browser
import { htmlToMarkdown } from '../../public/admin/js/html-to-md.js';
import { lintHeadings } from '../../src/lib/headings';

const md = (html: string) => htmlToMarkdown(html).markdown;

describe('htmlToMarkdown, text', () => {
  it('converts paragraphs, bold, italic and links', () => {
    expect(md('<p>One <b>bold</b> and <i>soft</i> with <a href="https://a.test/x">a link</a>.</p><p>Two</p>'))
      .toBe('One **bold** and *soft* with [a link](https://a.test/x).\n\nTwo\n');
  });
  it('keeps spaces outside the bold markers', () => {
    expect(md('<p>a<b> bold </b>b</p>')).toBe('a **bold** b\n');
  });
  it('turns loose text and divs into paragraphs, and double line breaks into a paragraph break', () => {
    expect(md('Loose text<div>Inside div</div>after')).toBe('Loose text\n\nInside div\n\nafter\n');
    expect(md('<p>first<br><br>second<br>third</p>')).toBe('first\n\nsecond  \nthird\n');
  });
  it('turns non-breaking spaces into normal spaces and drops empty paragraphs', () => {
    expect(md('<p>&nbsp;</p><p>a&nbsp;&nbsp;b</p><p> </p>')).toBe('a b\n');
  });
  it('escapes characters that would become Markdown by accident', () => {
    expect(md('<p>2 * 3 = 6 and snake_case and [x] and 5 &lt; 6</p>')).toBe('2 \\* 3 = 6 and snake\\_case and \\[x\\] and 5 \\< 6\n');
    expect(md('<p># not a heading</p><p>- not a list</p><p>1. not a list</p>')).toBe('\\# not a heading\n\n\\- not a list\n\n1\\. not a list\n');
  });
  it('keeps non-Latin text', () => {
    expect(md('<p>শিরোনাম – café</p>')).toBe('শিরোনাম – café\n');
  });
  it('returns an empty string for nothing', () => {
    expect(md('')).toBe('');
    expect(md('<p></p><div> </div>')).toBe('');
  });
});

describe('htmlToMarkdown, safety (BUGS I5)', () => {
  it('drops scripts, styles, forms, event handlers and inline styles', () => {
    const r = htmlToMarkdown('<p style="color:red" onclick="x()">Hi</p><script>alert(1)</script><style>p{}</style><form><input name="q"></form><p>Bye</p>');
    expect(r.markdown).toBe('Hi\n\nBye\n');
    expect(r.warnings.join(' ')).toContain('removed');
  });
  it('keeps only safe link targets', () => {
    expect(md('<p><a href="javascript:alert(1)">bad</a> <a href="/local/">ok</a> <a href="mailto:a@b.test">mail</a> <a href="//cdn.test/x">pr</a></p>'))
      .toBe('bad [ok](/local/) [mail](mailto:a@b.test) [pr](https://cdn.test/x)\n');
  });
  it('encodes spaces and brackets in addresses', () => {
    expect(md('<p><a href="https://a.test/a b(1)">x</a></p>')).toBe('[x](https://a.test/a%20b%281%29)\n');
  });
  it('turns embeds into plain links and counts them', () => {
    const r = htmlToMarkdown('<p><iframe src="https://www.youtube.com/embed/abc"></iframe></p>');
    expect(r.markdown).toBe('[Embedded content](https://www.youtube.com/embed/abc)\n');
    expect(r.warnings.join(' ')).toContain('1 embed');
  });
});

describe('htmlToMarkdown, headings (BUGS S1)', () => {
  it('starts at H2 and never skips a level, so the build linter accepts it', () => {
    const r = htmlToMarkdown('<h1>Big</h1><p>a</p><h4>Deep</h4><p>b</p><h2>Back</h2><h6>Deeper</h6>');
    expect(r.markdown).toBe('## Big\n\na\n\n### Deep\n\nb\n\n## Back\n\n### Deeper\n');
    expect(lintHeadings(r.markdown)).toEqual([]);
    expect(r.warnings.join(' ')).toContain('Heading levels were adjusted');
  });
  it('does not warn when headings are already fine', () => {
    expect(htmlToMarkdown('<h2>A</h2><h3>B</h3>').warnings).toEqual([]);
  });
  it('drops empty headings', () => {
    expect(md('<h2> </h2><p>x</p>')).toBe('x\n');
  });
});

describe('htmlToMarkdown, images', () => {
  it('lists images, keeps alt text, and counts missing alt text', () => {
    const r = htmlToMarkdown('<p><img src="https://img.test/a.jpg" alt="A cat"></p><p><img src="//img.test/b.jpg"></p>');
    expect(r.markdown).toBe('![A cat](https://img.test/a.jpg)\n\n![](https://img.test/b.jpg)\n');
    expect(r.images).toEqual([{ src: 'https://img.test/a.jpg', alt: 'A cat' }, { src: '//img.test/b.jpg'.replace('//', 'https://'), alt: '' }]);
    expect(r.warnings.join(' ')).toContain('1 image(s) have no alt text');
  });
  it('keeps only the picture when Blogger links it to the big picture', () => {
    const r = htmlToMarkdown('<div class="separator"><a href="https://img.test/big.jpg"><img src="https://img.test/small.jpg" alt="Pic"></a></div>');
    expect(r.markdown).toBe('![Pic](https://img.test/small.jpg)\n');
    expect(r.images).toHaveLength(1);
  });
  it('drops inline data images and pictures with no usable address', () => {
    const r = htmlToMarkdown('<p><img src="data:image/png;base64,AAAA"><img src="relative.jpg">text</p>');
    expect(r.markdown).toBe('text\n');
    expect(r.images).toEqual([]);
  });
});

describe('htmlToMarkdown, lists, quotes, code, tables', () => {
  it('converts nested lists', () => {
    expect(md('<ul><li>One<ul><li>Inner</li></ul></li><li>Two</li></ul><ol><li>First</li><li>Second</li></ol>'))
      .toBe('- One\n  - Inner\n- Two\n\n1. First\n2. Second\n');
  });
  it('converts block quotes with paragraphs', () => {
    expect(md('<blockquote><p>Said this.</p><p>And that.</p></blockquote>')).toBe('> Said this.\n>\n> And that.\n');
  });
  it('converts code blocks without touching their text', () => {
    expect(md('<pre>a *b* _c_\n  d</pre><p>Use <code>x * y</code> here</p>')).toBe('```\na *b* _c_\n  d\n```\n\nUse `x * y` here\n');
  });
  it('converts a table to GFM', () => {
    expect(md('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>x|y</td></tr></table>')).toBe('| A | B |\n| --- | --- |\n| 1 | x\\|y |\n');
  });
  it('converts a rule', () => {
    expect(md('<p>a</p><hr><p>b</p>')).toBe('a\n\n---\n\nb\n');
  });
});
