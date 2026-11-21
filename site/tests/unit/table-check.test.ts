import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTables } from '../../scripts/table-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const GOOD = '<table><caption>Results by city</caption><thead><tr><th scope="col">City</th><th scope="col">Votes</th></tr></thead><tbody><tr><th scope="row">Austin</th><td>10</td></tr></tbody></table>';

describe('checkTables: good tables', () => {
  it('a table with a caption, th cells and scopes passes with no message', () => { expect(checkTables(GOOD)).toEqual(none); });
  it('a page with no table passes', () => { expect(checkTables('<p>hello</p>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkTables(v as any).errors).toEqual(['the page is not text']);
  });
  it('upper case tags, single quotes and no quotes are read', () => {
    expect(checkTables("<TABLE><CAPTION>Totals</CAPTION><TR><TH SCOPE='col'>A</TH><TH scope=col>B</TH></TR></TABLE>")).toEqual(none);
  });
  it('a th with no closing tag is read', () => { expect(checkTables('<table aria-label="Totals"><tr><th>A<th>B<tr><td>1<td>2</table>')).toEqual(none); });
  it('aria-label, aria-labelledby and title are names for the table', () => {
    for (const n of ['aria-label="Totals"', 'aria-labelledby="t"', 'title="Totals"'])
      expect(checkTables(`<table ${n}><tr><th>A</th></tr></table>`), n).toEqual(none);
  });
  it('a th with a picture that has alt text, an aria-label or an svg title is named', () => {
    expect(checkTables('<table aria-label="T"><tr><th><img src="a.png" alt="Votes"></th></tr></table>')).toEqual(none);
    expect(checkTables('<table aria-label="T"><tr><th aria-label="Votes"></th></tr></table>')).toEqual(none);
    expect(checkTables('<table aria-label="T"><tr><th><svg><title>Votes</title></svg></th></tr></table>')).toEqual(none);
  });
  it('scope values are not case sensitive', () => { expect(checkTables('<table aria-label="T"><tr><th scope="COL">A</th></tr></table>')).toEqual(none); });
  it('colgroup and rowgroup are valid scopes', () => {
    expect(checkTables('<table aria-label="T"><tr><th scope="colgroup">A</th><th scope="rowgroup">B</th></tr></table>')).toEqual(none);
  });
});

describe('checkTables: scope', () => {
  it('a wrong scope is an error that says the value', () => {
    expect(checkTables('<table aria-label="T"><tr><th scope="column">A</th></tr></table>').errors).toEqual(['a <th> has scope="column"; scope is col, row, colgroup or rowgroup']);
  });
  it('an empty scope is an error', () => { expect(checkTables('<table aria-label="T"><tr><th scope="">A</th></tr></table>').errors).toHaveLength(1); });
  it('a wrong scope on a td is an error', () => {
    expect(checkTables('<table aria-label="T"><tr><th>A</th><td scope="x">1</td></tr></table>').errors.join()).toMatch(/<td> has scope="x"/);
  });
  it('the same message is not printed twice', () => {
    expect(checkTables('<table aria-label="T"><tr><th scope="x">A</th><th scope="x">B</th></tr></table>').errors).toHaveLength(1);
  });
});

describe('checkTables: layout tables', () => {
  it('role="presentation" with no th passes and needs no caption', () => {
    expect(checkTables('<table role="presentation"><tr><td>a</td><td>b</td></tr></table>')).toEqual(none);
    expect(checkTables('<table role="none"><tr><td>a</td></tr></table>')).toEqual(none);
  });
  it('role="presentation" with a th is an error', () => {
    expect(checkTables('<table role="presentation"><tr><th>a</th></tr></table>').errors.join()).toMatch(/role="presentation" but holds a th/);
  });
  it('the role is not case sensitive', () => { expect(checkTables('<table role="NONE"><tr><th>a</th></tr></table>').errors).toHaveLength(1); });
  it('a wrong scope in a layout table is still an error', () => {
    expect(checkTables('<table role="presentation"><tr><td scope="zz">a</td></tr></table>').errors).toHaveLength(1);
  });
});

describe('checkTables: warnings', () => {
  it('a table with no th is a warning, not an error', () => {
    const r = checkTables('<table aria-label="T"><tr><td>a</td></tr></table>');
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/has no th/);
  });
  it('a table with no caption is a warning', () => {
    expect(checkTables('<table><tr><th>A</th></tr></table>').warnings.join()).toMatch(/has no caption/);
  });
  it('an empty caption does not count', () => {
    expect(checkTables('<table><caption>  </caption><tr><th>A</th></tr></table>').warnings.join()).toMatch(/has no caption/);
  });
  it('an empty aria-label does not count', () => {
    expect(checkTables('<table aria-label=""><tr><th>A</th></tr></table>').warnings.join()).toMatch(/has no caption/);
  });
  it('an empty th is a warning', () => {
    expect(checkTables('<table aria-label="T"><tr><th></th><th>A</th></tr></table>').warnings.join()).toMatch(/a th has no text/);
  });
  it('a th with only spaces or &nbsp; is empty', () => {
    expect(checkTables('<table aria-label="T"><tr><th>&nbsp;</th></tr></table>').warnings.join()).toMatch(/a th has no text/);
    expect(checkTables('<table aria-label="T"><tr><th> <b> </b> </th></tr></table>').warnings.join()).toMatch(/a th has no text/);
  });
  it('a th with text inside a tag is not empty', () => { expect(checkTables('<table aria-label="T"><tr><th><b>A</b></th></tr></table>')).toEqual(none); });
  it('two tables with the same problem give one message', () => {
    expect(checkTables('<table aria-label="T"><tr><td>a</td></tr></table><table aria-label="T"><tr><td>b</td></tr></table>').warnings).toHaveLength(1);
  });
  it('two different problems give two messages', () => {
    expect(checkTables('<table><tr><td>a</td></tr></table>').warnings).toHaveLength(2);
  });
});

describe('checkTables: what is left out', () => {
  it('a hidden table is not read', () => {
    expect(checkTables('<table hidden><tr><td scope="x">a</td></tr></table>')).toEqual(none);
    expect(checkTables('<table aria-hidden="true"><tr><td>a</td></tr></table>')).toEqual(none);
  });
  it('tables inside script, style, template and comments are not read', () => {
    const extra = '<script>var s=\'<table><tr><td scope="x">\';</script><template><table><tr><td>a</td></tr></table></template><!-- <table><tr><td>a</td></tr></table> -->';
    expect(checkTables(extra + GOOD)).toEqual(none);
  });
  it('a word that only starts with table is not a table', () => { expect(checkTables('<tablet><tr><td>a</td></tr></tablet>')).toEqual(none); });
  it('a very long table is read quickly', () => {
    const t = Date.now();
    checkTables('<table aria-label="T"><tr><th>A</th></tr>' + '<tr><td class="x">y</td></tr>'.repeat(30000) + '</table>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('no template of the site writes a table by hand (tables come from posts and are checked at build)', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(/<table[\s>]/i.test(base)).toBe(false);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'table-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good table passes', () => { expect(run(FULL(GOOD)).code).toBe(0); });
  it('a wrong scope stops the build and names the page', () => {
    const r = run(FULL('<table aria-label="T"><tr><th scope="column">A</th></tr></table>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <th> has scope="column"/);
  });
  it('a th inside a layout table stops the build', () => {
    const r = run(FULL('<table role="presentation"><tr><th>A</th></tr></table>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/role="presentation" but holds a th/);
  });
  it('a table with no th and no caption is a warning, not an error', () => {
    const r = run(FULL('<table><tr><td>a</td></tr></table>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*has no th/);
  });
});
