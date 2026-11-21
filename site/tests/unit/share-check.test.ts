import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore
import { checkShareTags } from '../../scripts/share-check-lib.mjs';

const none = { errors: [] as string[], warnings: [] as string[] };
const og = (key: string, content: string) => `<meta property="${key}" content="${content}">`;
const tw = (key: string, content: string) => `<meta name="${key}" content="${content}">`;

describe('checkShareTags: good pages', () => {
  it('a plain page passes', () => { expect(checkShareTags('<main><h1>x</h1><p>hello</p></main>')).toEqual(none); });
  it('is not text: one error, no crash', () => {
    for (const v of [undefined, null, 5, {}]) expect(checkShareTags(v as any).errors).toEqual(['the page is not text']);
  });
  it('an empty page passes', () => { expect(checkShareTags('')).toEqual(none); });
  it('the real head of a story page of the site passes', () => {
    const head = og('og:type', 'article') + og('og:site_name', 'Shivam Das News') + og('og:title', 'A title') + og('og:description', 'A description')
      + og('og:url', 'https://news.example.org/x/') + og('og:locale', 'en_US') + og('og:image', 'https://news.example.org/og.png') + og('og:image:alt', 'A picture')
      + og('og:image:width', '1200') + og('og:image:height', '630')
      + og('article:published_time', '2026-11-20T09:17:00.000Z') + og('article:modified_time', '2026-11-20T10:00:00.000Z') + og('article:section', 'World') + og('article:tag', 'a') + og('article:tag', 'b')
      + tw('twitter:card', 'summary_large_image') + tw('twitter:title', 'A title') + tw('twitter:description', 'A description') + tw('twitter:image', 'https://news.example.org/og.png') + tw('twitter:image:alt', 'A picture');
    expect(checkShareTags(head)).toEqual(none);
  });
  it('the real head of a page with no picture passes', () => {
    expect(checkShareTags(og('og:type', 'website') + og('og:title', 'T') + og('og:locale', 'en_US') + tw('twitter:card', 'summary') + tw('twitter:title', 'T'))).toEqual(none);
  });
  it('every card type passes', () => {
    for (const c of ['summary', 'summary_large_image', 'app', 'player']) expect(checkShareTags(tw('twitter:card', c) + tw('twitter:image', 'https://a.example/x.png'))).toEqual(none);
  });
  it('every Open Graph type passes', () => {
    for (const t of ['website', 'article', 'book', 'profile', 'product', 'place', 'business.business', 'video.movie', 'video.episode', 'video.tv_show', 'video.other', 'music.song', 'music.album', 'music.playlist', 'music.radio_station']) expect(checkShareTags(og('og:type', t))).toEqual(none);
  });
  it('real locales pass', () => {
    for (const l of ['en_US', 'en_GB', 'bn_IN', 'hi_IN', 'es_ES', 'fil_PH']) expect(checkShareTags(og('og:locale', l) + og('og:locale:alternate', l))).toEqual(none);
  });
  it('real times pass: date only, with Z, with milliseconds, with an offset', () => {
    for (const t of ['2026-11-20', '2026-11-20T09:17Z', '2026-11-20T09:17:00Z', '2026-11-20T09:17:00.000Z', '2026-11-20T09:17:00+05:30', '2026-11-20T09:17:00-0500', '2026-11-20T09:17:00+05', '2026-11-20T09:17:00', '2024-02-29']) {
      expect(checkShareTags(og('article:published_time', t))).toEqual(none);
    }
  });
  it('an expiration time passes', () => { expect(checkShareTags(og('article:expiration_time', '2030-01-01T00:00:00Z'))).toEqual(none); });
  it('a real twitter:site and twitter:creator pass', () => {
    for (const h of ['@yourname', '@a', '@Your_Name_1', '783214']) expect(checkShareTags(tw('twitter:site', h) + tw('twitter:creator', h))).toEqual(none);
  });
  it('og:image and og:image:alt and article:tag may repeat', () => {
    expect(checkShareTags(og('og:image', 'https://a.example/1.png') + og('og:image', 'https://a.example/2.png') + og('og:image:alt', 'a') + og('og:image:alt', 'b') + og('article:tag', 'x') + og('article:tag', 'y'))).toEqual(none);
  });
  it('og:image:secure_url with https passes', () => { expect(checkShareTags(og('og:image:secure_url', 'https://a.example/x.png'))).toEqual(none); });
  it('the case of a name and of a value is not read', () => {
    expect(checkShareTags('<META PROPERTY="OG:TYPE" CONTENT="Article"><META NAME="Twitter:Card" CONTENT="Summary_Large_Image"><META NAME="twitter:image" CONTENT="https://a.example/x.png">')).toEqual(none);
  });
  it('single quotes and no quotes pass', () => {
    expect(checkShareTags("<meta property='og:type' content='article'>")).toEqual(none);
    expect(checkShareTags('<meta name=twitter:card content=summary>')).toEqual(none);
  });
  it('names a share tag is not close to are left alone', () => {
    expect(checkShareTags('<meta property="fb:app_id" content="123"><meta property="al:ios:url" content="x"><meta property="og:video:tag" content="x"><meta name="twitter:label1" content="x"><meta name="twitter:app:name:iphone" content="x"><meta property="article:publisher" content="https://f.example/x">')).toEqual(none);
  });
  it('another meta name with no colon is not read', () => {
    expect(checkShareTags('<meta name="description" content="og:titel artcle"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="author" content="x"><meta name="theme-color" content="#fff">')).toEqual(none);
  });
  it('a content written as a template expression is not read', () => {
    expect(checkShareTags('<meta property="og:type" content={ogType}><meta name="twitter:card" content={img ? \'summary_large_image\' : \'summary\'}><meta property="og:locale" content={site.locale}>')).toEqual(none);
  });
  it('a meta with no name is not read', () => { expect(checkShareTags('<meta charset="utf-8"><meta content="artcle">')).toEqual(none); });
  it('the words in text pass', () => { expect(checkShareTags('<p>Write &lt;meta property="og:titel" content="x"&gt; in the head.</p>')).toEqual(none); });
  it('a tag that only starts with meta is not read', () => { expect(checkShareTags('<meta-x property="og:titel" content="x"></meta-x>')).toEqual(none); });
  it('a data attribute is not read', () => { expect(checkShareTags('<meta property="og:type" data-content="artcle" content="article">')).toEqual(none); });
});

describe('checkShareTags: errors', () => {
  it('a typo of a tag name is an error with a plain message', () => {
    expect(checkShareTags(og('og:titel', 'x')).errors).toEqual(['<meta property="og:titel"> is a typo of "og:title", so the share tags of this page lose it']);
  });
  it('a typo of the prefix is an error', () => {
    expect(checkShareTags(tw('twiter:card', 'summary')).errors).toEqual(['<meta name="twiter:card"> is a typo of "twitter:card", so the share tags of this page lose it']);
  });
  it('other typos of a tag name are errors', () => {
    for (const k of ['og:imge', 'og:descripton', 'og:sitename', 'og:locle', 'twitter:crad', 'twitter:imag', 'article:publishd_time', 'article:modifed_time']) {
      expect(checkShareTags(og(k, 'x')).errors, k).toHaveLength(1);
    }
  });
  it('a typo of a card type is an error', () => {
    for (const c of ['summary_large_img', 'summary-large-image', 'summary large image', 'summery', 'sumary']) {
      expect(checkShareTags(tw('twitter:card', c) + tw('twitter:image', 'https://a.example/x.png')).errors, c).toHaveLength(1);
    }
    expect(checkShareTags(tw('twitter:card', 'summary_large_img')).errors[0]).toBe('twitter:card "summary_large_img" is a typo of "summary_large_image", so the card falls back to a plain link');
  });
  it('a typo of an Open Graph type is an error', () => {
    expect(checkShareTags(og('og:type', 'artcle')).errors).toEqual(['og:type "artcle" is a typo of "article", so the page is shared as a plain website']);
    for (const t of ['webiste', 'web site', 'articles', 'profil', 'video.movies']) expect(checkShareTags(og('og:type', t)).errors, t).toHaveLength(1);
  });
  it('an image size with px, text, a decimal, 0 or a minus is an error', () => {
    for (const v of ['1200px', 'wide', '12.5', '0', '-630', '1,200']) {
      expect(checkShareTags(og('og:image:width', v)).errors, v).toHaveLength(1);
      expect(checkShareTags(og('og:image:height', v)).errors, v).toHaveLength(1);
    }
    expect(checkShareTags(og('og:image:width', '1200px')).errors).toEqual(['og:image:width "1200px" is not a whole number of pixels; write 1200, not 1200px']);
  });
  it('a locale with a hyphen or a small territory is an error', () => {
    for (const v of ['en-US', 'en-us', 'en_us', 'EN_US']) expect(checkShareTags(og('og:locale', v)).errors, v).toHaveLength(1);
    expect(checkShareTags(og('og:locale', 'en-US')).errors[0]).toMatch(/write en_US/);
  });
  it('a locale that is not a locale is an error', () => {
    for (const v of ['english', 'United States', '1234', 'en_USA']) expect(checkShareTags(og('og:locale', v)).errors, v).toHaveLength(1);
  });
  it('og:locale:alternate is read the same way', () => { expect(checkShareTags(og('og:locale:alternate', 'bn-IN')).errors).toHaveLength(1); });
  it('an article time that is not a date is an error', () => {
    for (const v of ['yesterday', '20 Nov 2026', '2026/11/20', '11-20-2026', '2026-11', '2026-13-01', '2026-00-10', '2026-11-31', '2026-02-30', '2025-02-29', '2026-11-20T25:00:00Z', '2026-11-20T09:61:00Z', '2026-11-20T09:17:99Z', '2026-11-20T9:17']) {
      expect(checkShareTags(og('article:published_time', v)).errors, v).toHaveLength(1);
    }
    expect(checkShareTags(og('article:modified_time', '2026-02-30')).errors).toEqual(['article:modified_time "2026-02-30" is not a real ISO date or time; write it like 2026-11-20T09:17:00Z']);
  });
  it('a twitter:image that is not a full address is an error', () => {
    for (const v of ['/og.png', 'og.png', '//news.example.org/og.png', 'ftp://a.example/x.png']) expect(checkShareTags(tw('twitter:image', v)).errors, v).toHaveLength(1);
    expect(checkShareTags(tw('twitter:image', '/og.png')).errors).toEqual(['twitter:image is not a full http or https address: "/og.png"']);
  });
  it('an og:image:secure_url that is not https is an error', () => {
    for (const v of ['http://a.example/x.png', '/x.png']) expect(checkShareTags(og('og:image:secure_url', v)).errors, v).toHaveLength(1);
  });
  it('every error is reported once even when the tag is written twice', () => {
    expect(checkShareTags(og('og:titel', 'x') + og('og:titel', 'x')).errors).toHaveLength(1);
  });
  it('a long garbage value is cut in the message', () => {
    const r = checkShareTags(og('og:type', 'x'.repeat(400)));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].length).toBeLessThan(200);
  });
});

describe('checkShareTags: warnings', () => {
  it('an empty content is a warning', () => {
    expect(checkShareTags(og('og:title', '')).warnings).toEqual(['<meta property="og:title"> has an empty content, so it says nothing']);
    expect(checkShareTags('<meta name="twitter:card">').warnings).toEqual(['<meta name="twitter:card"> has an empty content, so it says nothing']);
    expect(checkShareTags(tw('twitter:title', '   ')).warnings).toHaveLength(1);
  });
  it('a card type no platform knows is a warning', () => {
    const r = checkShareTags(tw('twitter:card', 'gallery'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['twitter:card "gallery" is not a card type any platform knows; use summary, summary_large_image, app or player']);
  });
  it('a cut short card type that is far from every real one is a warning, not an error', () => {
    const r = checkShareTags(tw('twitter:card', 'summary_large'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it('an Open Graph type that is not in the list is a warning', () => {
    const r = checkShareTags(og('og:type', 'blog'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['og:type "blog" is not a type the Open Graph list has; use website or article for a news page']);
  });
  it('a locale with only a language is a warning', () => {
    const r = checkShareTags(og('og:locale', 'en'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['og:locale "en" holds only a language; write the territory too, like en_US']);
  });
  it('a time with a space instead of T is a warning', () => {
    const r = checkShareTags(og('article:published_time', '2026-11-20 09:17:00'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['article:published_time "2026-11-20 09:17:00" has a space between the date and the time; write a T there']);
  });
  it('a modified time before the published time is a warning', () => {
    const r = checkShareTags(og('article:published_time', '2026-11-20T10:00:00Z') + og('article:modified_time', '2026-11-19T10:00:00Z'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['article:modified_time (2026-11-19T10:00:00Z) is before article:published_time (2026-11-20T10:00:00Z)']);
  });
  it('the same time for published and modified is fine', () => {
    expect(checkShareTags(og('article:published_time', '2026-11-20T10:00:00Z') + og('article:modified_time', '2026-11-20T10:00:00Z'))).toEqual(none);
  });
  it('the order is not read when one time is wrong (that is the error)', () => {
    const r = checkShareTags(og('article:published_time', 'soon') + og('article:modified_time', '2026-11-19T10:00:00Z'));
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toEqual([]);
  });
  it('an http:// picture is a warning', () => {
    expect(checkShareTags(og('og:image', 'http://a.example/x.png')).warnings).toEqual(['og:image is an http:// address; share an https:// picture']);
    expect(checkShareTags(tw('twitter:image', 'http://a.example/x.png')).warnings).toEqual(['twitter:image is an http:// address; share an https:// picture']);
    expect(checkShareTags(tw('twitter:image', 'http://a.example/x.png')).errors).toEqual([]);
  });
  it('a tag that holds one value written twice is a warning', () => {
    for (const k of ['og:title', 'og:type', 'og:url', 'og:site_name', 'og:description', 'og:locale']) {
      expect(checkShareTags(og(k, k === 'og:locale' ? 'en_US' : 'website') + og(k, k === 'og:locale' ? 'en_US' : 'website')).warnings, k).toEqual([`the share tag ${k} is written 2 times; keep one`]);
    }
    expect(checkShareTags(tw('twitter:title', 'a') + tw('twitter:title', 'b')).warnings).toHaveLength(1);
  });
  it('an og: or article: tag written with name= is a warning', () => {
    expect(checkShareTags(tw('og:title', 'x')).warnings).toEqual(['<meta name="og:title"> is written with name=; Facebook and LinkedIn read property= for og:title']);
    expect(checkShareTags(tw('article:section', 'x')).warnings).toHaveLength(1);
  });
  it('a twitter: tag written with property= is left alone', () => { expect(checkShareTags(og('twitter:card', 'summary'))).toEqual(none); });
  it('a large image card with no picture tag is a warning', () => {
    expect(checkShareTags(tw('twitter:card', 'summary_large_image')).warnings).toEqual(['twitter:card is summary_large_image but the page has no twitter:image or og:image, so the card shows no picture']);
  });
  it('a large image card with an og:image or a twitter:image is fine', () => {
    expect(checkShareTags(tw('twitter:card', 'summary_large_image') + og('og:image', 'https://a.example/x.png'))).toEqual(none);
    expect(checkShareTags(tw('twitter:card', 'summary_large_image') + tw('twitter:image', 'https://a.example/x.png'))).toEqual(none);
  });
  it('a large image card with a picture tag written as a template expression is fine', () => {
    expect(checkShareTags(tw('twitter:card', 'summary_large_image') + '<meta name="twitter:image" content={img}>')).toEqual(none);
  });
  it('a twitter:site that is not an @name is a warning', () => {
    for (const v of ['yourname', 'https://x.com/yourname', '@your name', '@thisnameistoolongtowork']) expect(checkShareTags(tw('twitter:site', v)).warnings, v).toHaveLength(1);
    expect(checkShareTags(tw('twitter:creator', 'yourname')).warnings).toEqual(['twitter:creator "yourname" is not an @name; write it like @yourname']);
  });
});

describe('checkShareTags: what is left out', () => {
  it('what head-check reads is not read here', () => {
    expect(checkShareTags('<meta property="og:url" content="/relative/"><meta property="og:image" content="/og.png">')).toEqual(none);
    expect(checkShareTags('<meta name="theme-color" content="#fff">')).toEqual(none);
  });
  it('text inside comments, script, style and template is not read', () => {
    const extra = '<!-- <meta property="og:titel" content="x"> --><script>var s = \'<meta property="og:titel" content="x">\';</script><style>a:after{content:"<meta property=og:titel content=x>"}</style><template><meta property="og:titel" content="x"></template>';
    expect(checkShareTags(extra + '<p>ok</p>')).toEqual(none);
  });
  it('text after a comment and after a script is still read', () => {
    expect(checkShareTags('<!-- x -->' + og('og:titel', 'x')).errors).toHaveLength(1);
    expect(checkShareTags('<script>var a = 1;</script>' + og('og:titel', 'x')).errors).toHaveLength(1);
  });
  it('a very long page is read quickly', () => {
    const t = Date.now();
    checkShareTags('<main>' + '<p class="a b" id="i">text <a href="/x/">link</a></p><meta name="viewport" content="width=device-width"><meta property="og:image" content="https://a.example/x.png">'.repeat(15000) + '</main>');
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('the real templates', () => {
  it('the base layout passes', () => { expect(checkShareTags(readFileSync('src/layouts/Base.astro', 'utf8'))).toEqual(none); });
  it('the search page passes', () => { expect(checkShareTags(readFileSync('src/pages/search.astro', 'utf8'))).toEqual(none); });
  it('the 404 page passes', () => { expect(checkShareTags(readFileSync('src/pages/404.astro', 'utf8'))).toEqual(none); });
});

describe('validate-html.mjs uses it', () => {
  const FULL = (extra: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>@media print{a{color:#000}}:focus-visible{outline:3px solid #000}</style><title>Test page</title><meta property="og:title" content="Test page"><meta property="og:image" content="https://news.example.org/og.png"><meta name="twitter:card" content="summary"><meta name="theme-color" content="#fff"><link rel="canonical" href="https://news.example.org/x/"><meta name="robots" content="noindex,follow">${extra}</head><body data-page-type="404"><a class="skip" href="#main">Skip</a><header>h</header><main id="main"><h1>P</h1><p>x</p></main><footer>f</footer></body></html>`;
  const run = (h: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'share-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'index.html'), h);
    const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/validate-html.mjs')], { cwd: dir, encoding: 'utf8', env: { ...process.env, SITE_URL: 'https://news.example.org', CI: '', CF_PAGES: '' } });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  it('a good page passes', () => { expect(run(FULL(og('og:type', 'website') + og('og:locale', 'en_US'))).code).toBe(0); });
  it('a typo of a card type stops the build and names the page', () => {
    const r = run(FULL(tw('twitter:card', 'summary_large_img')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/index\.html: twitter:card "summary_large_img" is a typo of "summary_large_image"/);
  });
  it('a typo of a tag name stops the build', () => {
    const r = run(FULL(og('og:titel', 'x')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/og:titel/);
  });
  it('a wrong locale stops the build', () => {
    const r = run(FULL(og('og:locale', 'en-US')));
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/og:locale "en-US"/);
  });
  it('a tag written twice is a warning, not an error', () => {
    const r = run(FULL(og('og:type', 'website') + og('og:type', 'website')));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/warn: .*og:type is written 2 times/);
  });
});
