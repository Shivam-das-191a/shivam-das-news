import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkTimes, isValidDatetime } from '../../scripts/time-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };

describe('isValidDatetime: good values', () => {
  it('year, month, date, yearless date and week', () => {
    for (const v of ['2026', '2026-11', '2026-11-19', '11-19', '2026-W47', '2026-W53', '2020-W53', '2024-02-29']) expect(isValidDatetime(v), v).toBe(true);
  });
  it('time, local date and time, date and time with an offset', () => {
    for (const v of ['10:30', '10:30:15', '10:30:15.250', '2026-11-19T10:30', '2026-11-19 10:30:15', '2026-11-17T01:55:00.000Z', '2026-11-19T10:30:00+05:30', '2026-11-19T10:30-0500', '2026-11-19T10:30+01'])
      expect(isValidDatetime(v), v).toBe(true);
  });
  it('offset alone and duration', () => {
    for (const v of ['Z', '+05:30', '-08:00', 'PT1H30M', 'P3D', 'P1W', 'PT45S', 'P1DT2H', '3h 20m', '1w 2d', '90m']) expect(isValidDatetime(v), v).toBe(true);
  });
  it('spaces around a value are allowed', () => { expect(isValidDatetime(' 2026-11-19 ')).toBe(true); });
});

describe('isValidDatetime: bad values', () => {
  it('a date that does not exist', () => {
    for (const v of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-32', '0000-01-01', '12345-01-01', '2021-W53', '2025-W53', '2026-W00', '2026-W54', '13-01', '02-30'])
      expect(isValidDatetime(v), v).toBe(false);
  });
  it('a time that does not exist', () => {
    for (const v of ['24:00', '10:60', '10:30:60', '2026-11-19T25:00', '2026-11-19T10:30+24:00', '2026-11-19T10:30+05:60']) expect(isValidDatetime(v), v).toBe(false);
  });
  it('words, other date orders and empty values', () => {
    for (const v of ['', ' ', 'November 19, 2026', '19/11/2026', '11/19/2026', '2026/11/19', '2026-11-19T', 'tomorrow', '2026-1-9', '20261119', '123', '--11-19', 'now'])
      expect(isValidDatetime(v), v).toBe(false);
  });
  it('a duration that is empty or broken', () => {
    for (const v of ['P', 'PT', 'PT1H2', 'P1H', '1x', 'h']) expect(isValidDatetime(v), v).toBe(false);
  });
});

describe('checkTimes: good pages', () => {
  it('a page with no time passes', () => { expect(checkTimes('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkTimes(v as any).errors).toEqual(['the page is not text']);
  });
  it('the story page pattern passes (an ISO string from toISOString)', () => {
    expect(checkTimes('<time datetime="2026-11-17T01:55:00.000Z">November 17, 2026</time> &middot; Updated <time datetime="2026-11-18T09:00:00.000Z">November 18, 2026</time>')).toEqual(none);
  });
  it('a time whose own text is a valid value needs no datetime', () => { expect(checkTimes('<time>2026-11-19</time><time>10:30</time>')).toEqual(none); });
  it('upper case tags and names, single quotes and no quotes are read', () => {
    expect(checkTimes("<TIME DATETIME='2026-11-19'>x</TIME><time datetime=2026-11-19>y</time>")).toEqual(none);
  });
  it('a time with nested tags and no datetime is left out', () => { expect(checkTimes('<time><b>Nov 19</b></time>')).toEqual(none); });
  it('words that only start with time are not read', () => { expect(checkTimes('<timeline datetime="zzz">a</timeline><timer datetime="">b</timer>')).toEqual(none); });
});

describe('checkTimes: errors', () => {
  it('a datetime that is not a real value is an error', () => {
    expect(checkTimes('<time datetime="19/11/2026">x</time>').errors).toEqual(['a <time> has datetime="19/11/2026", which is not a real date or time; write it like 2026-11-19 or 2026-11-19T10:30:00Z']);
  });
  it('a date that does not exist is an error', () => { expect(checkTimes('<time datetime="2026-02-30">x</time>').errors).toHaveLength(1); });
  it('an empty datetime is an error', () => {
    expect(checkTimes('<time datetime="">x</time>').errors).toHaveLength(1);
    expect(checkTimes('<time datetime>x</time>').errors).toHaveLength(1);
  });
  it('a very long value is cut in the message', () => { expect(checkTimes('<time datetime="' + '9'.repeat(300) + '">x</time>').errors[0].length).toBeLessThan(200); });
  it('the same message is not printed twice', () => { expect(checkTimes('<time datetime="bad">a</time><time datetime="bad">b</time>').errors).toHaveLength(1); });
});

describe('checkTimes: warnings', () => {
  it('a time with no datetime and words in it is a warning', () => {
    const r = checkTimes('<time>November 19, 2026</time>');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['a <time> with no datetime holds "November 19, 2026", which a machine cannot read; add datetime="2026-11-19"']);
  });
  it('spaces and line breaks in the text are squeezed', () => { expect(checkTimes('<time>\n  Nov   19\n</time>').warnings.join()).toMatch(/holds "Nov 19"/); });
  it('a time with a datetime is never warned about its text', () => { expect(checkTimes('<time datetime="2026-11-19">yesterday</time>')).toEqual(none); });
});

describe('checkTimes: what is left out', () => {
  it('text inside script, style, template and comments is not read', () => {
    const extra = '<script>var s=\'<time datetime="bad">\';</script><template><time datetime="bad"></time></template><!-- <time datetime="bad"></time> --><style>time[datetime="bad"]{}</style>';
    expect(checkTimes(extra + '<p>ok</p>')).toEqual(none);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkTimes('<main>' + '<time datetime="2026-11-17T01:55:00.000Z">Nov 17</time>'.repeat(30000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the story page writes datetime from toISOString()', () => {
    const t = readFileSync('src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro', 'utf8');
    expect(t).toMatch(/<time datetime=\{d\.date\.toISOString\(\)\}>/);
    expect(t).toMatch(/<time datetime=\{d\.updated\.toISOString\(\)\}>/);
  });
  it('an ISO string of a real date passes the check', () => {
    expect(checkTimes(`<time datetime="${new Date('2026-11-19T04:20:00Z').toISOString()}">x</time>`)).toEqual(none);
  });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (body: string) =>
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex"></head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1>${body}</main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'time-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good time passes', () => { expect(run(FULL('<time datetime="2026-11-19T10:30:00Z">Nov 19</time>')).code).toBe(0); });
  it('a date that does not exist stops the build and names the page', () => {
    const r = run(FULL('<time datetime="2026-02-30">x</time>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: a <time> has datetime="2026-02-30"/);
  });
  it('a typed day-first date stops the build', () => {
    const r = run(FULL('<time datetime="19/11/2026">x</time>'));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/not a real date or time/);
  });
  it('words with no datetime are a warning, not an error', () => {
    const r = run(FULL('<time>November 19, 2026</time>'));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*no datetime/);
  });
});
