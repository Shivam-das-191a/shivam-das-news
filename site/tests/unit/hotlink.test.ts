import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS modules served to the browser
import { findExternal, isOwnHost, checkAddress, checkRedirects, seoName, datePart, hostedPath, findHosted, MAX_FETCH_REDIRECTS, MAX_NAME_CHARS } from '../../public/admin/js/hotlink.js';
import { findEmoji } from '../../scripts/no-emoji-lib.mjs';

const OWN = ['shivam-das-news.pages.dev'];
const urls = (list: any[]) => list.map((x) => x.url);

describe('findExternal', () => {
  it('finds a Markdown picture, an img tag and every srcset address, each once, in order', () => {
    const body = [
      '![City hall](https://other.com/a.jpg "A title")',
      '<img src="https://cdn.example.org/b.png" alt="Crowd" srcset="https://cdn.example.org/b-480.png 480w, https://cdn.example.org/b-800.png 800w">',
      'again ![x](https://other.com/a.jpg)',
    ].join('\n\n');
    const r = findExternal({ body }, OWN);
    expect(urls(r)).toEqual(['https://other.com/a.jpg', 'https://cdn.example.org/b.png', 'https://cdn.example.org/b-480.png', 'https://cdn.example.org/b-800.png']);
    expect(r.map((x: any) => x.where)).toEqual(['markdown', 'img', 'srcset', 'srcset']);
    expect(r[0].alt).toBe('City hall');
    expect(r[1].alt).toBe('Crowd');
  });
  it('reads the front matter fields image and ogImage first', () => {
    const r = findExternal({ image: 'https://other.com/f.jpg', imageAlt: 'Front', ogImage: 'https://other.com/og.jpg', body: '![x](https://other.com/in.jpg)' }, OWN);
    expect(r.map((x: any) => [x.url, x.where, x.index])).toEqual([
      ['https://other.com/f.jpg', 'image', -1],
      ['https://other.com/og.jpg', 'ogImage', -1],
      ['https://other.com/in.jpg', 'markdown', expect.any(Number)],
    ]);
    expect(r[0].alt).toBe('Front');
  });
  it('lists a picture once even when it is the featured image and in the body', () => {
    const r = findExternal({ image: 'https://other.com/f.jpg', body: '![x](https://other.com/f.jpg)' }, OWN);
    expect(r).toHaveLength(1);
    expect(r[0].where).toBe('image');
  });
  it('skips our own host (with and without www, or given as an address), relative addresses and data pictures', () => {
    const body = [
      '![a](https://shivam-das-news.pages.dev/media/2026/11/a.webp)',
      '![b](https://www.shivam-das-news.pages.dev/media/b.webp)',
      '![c](/media/2026/11/c.webp)',
      '![d](media/d.webp)',
      '![e](data:image/png;base64,iVBORw0KGgo=)',
      '<img src="data:image/gif;base64,R0lGOD">',
      '![f](https://other.com/f.jpg)',
    ].join('\n');
    expect(urls(findExternal({ body }, OWN))).toEqual(['https://other.com/f.jpg']);
    expect(urls(findExternal({ body }, ['https://shivam-das-news.pages.dev/']))).toEqual(['https://other.com/f.jpg']);
    expect(isOwnHost('https://WWW.Shivam-Das-News.pages.dev/x', OWN)).toBe(true);
    expect(isOwnHost('https://shivam-das-news.pages.dev.evil.com/x', OWN)).toBe(false);
    expect(isOwnHost('not an address', OWN)).toBe(false);
  });
  it('keeps http pictures in the list (the address check refuses them later) and turns // into https', () => {
    const r = findExternal({ body: '![a](http://other.com/a.jpg)\n![b](//cdn.other.com/b.jpg)' }, OWN);
    expect(urls(r)).toEqual(['http://other.com/a.jpg', 'https://cdn.other.com/b.jpg']);
  });
  it('does not find a picture written inside a code block or inline code', () => {
    const body = 'Example: `![x](https://other.com/inline.jpg)`\n\n```md\n![y](https://other.com/fenced.jpg)\n```\n\n~~~\n<img src="https://other.com/tilde.jpg">\n~~~\n\n![z](https://other.com/real.jpg)';
    expect(urls(findExternal({ body }, OWN))).toEqual(['https://other.com/real.jpg']);
  });
  it('handles angle brackets, single quotes, unquoted attributes, a comma inside an address and &amp;', () => {
    const body = '![a](<https://other.com/a.jpg>)\n<img alt=\'Q\' src=\'https://other.com/b.jpg?x=1&amp;y=2\'>\n<img src=https://other.com/c.jpg>\n<img srcset="https://cdn.com/w_400,h_300/d.jpg 400w, https://cdn.com/w_800,h_600/d.jpg 800w">';
    expect(urls(findExternal({ body }, OWN))).toEqual([
      'https://other.com/a.jpg',
      'https://other.com/b.jpg?x=1&y=2',
      'https://other.com/c.jpg',
      'https://cdn.com/w_400,h_300/d.jpg',
      'https://cdn.com/w_800,h_600/d.jpg',
    ]);
  });
  it('gives the nearest heading above each picture (Markdown or HTML), and empty before the first heading', () => {
    const body = '![first](https://other.com/1.jpg)\n\n## Vote count\n\n![second](https://other.com/2.jpg)\n\n<h3>Next steps</h3>\n<img src="https://other.com/3.jpg">';
    const r = findExternal({ body }, OWN);
    expect(r.map((x: any) => x.heading)).toEqual(['', 'Vote count', 'Next steps']);
  });
  it('returns an empty list for an empty or missing post', () => {
    expect(findExternal({}, OWN)).toEqual([]);
    expect(findExternal(undefined as any, OWN)).toEqual([]);
    expect(findExternal({ body: 'No pictures here.' }, OWN)).toEqual([]);
  });
});

describe('checkAddress', () => {
  it('accepts a normal https address and drops the #fragment', () => {
    expect(checkAddress('https://images.other.com/a/b.jpg?w=900#top')).toEqual({ ok: true, url: 'https://images.other.com/a/b.jpg?w=900', host: 'images.other.com' });
    expect(checkAddress('https://other.com:443/a.jpg').ok).toBe(true);
    expect(checkAddress('https://8.8.8.8/a.jpg').ok).toBe(true);
    expect(checkAddress('https://[2606:4700:4700::1111]/a.jpg').ok).toBe(true);
  });
  const refused: [string, string][] = [
    ['http://other.com/a.jpg', 'not_https'],
    ['ftp://other.com/a.jpg', 'not_https'],
    ['https://other.com:8443/a.jpg', 'bad_port'],
    ['https://other.com:80/a.jpg', 'bad_port'],
    ['https://user:pass@other.com/a.jpg', 'credentials'],
    ['https://user@other.com/a.jpg', 'credentials'],
    ['https://localhost/a.jpg', 'private_host'],
    ['https://LOCALHOST./a.jpg', 'private_host'],
    ['https://printer.local/a.jpg', 'private_host'],
    ['https://db.internal/a.jpg', 'private_host'],
    ['https://metadata.google.internal/a', 'private_host'],
    ['https://intranet/a.jpg', 'private_host'],
    ['https://127.0.0.1/a.jpg', 'private_host'],
    ['https://127.1/a.jpg', 'private_host'],
    ['https://2130706433/a.jpg', 'private_host'],
    ['https://0x7f.0.0.1/a.jpg', 'private_host'],
    ['https://0.0.0.0/a.jpg', 'private_host'],
    ['https://10.0.0.5/a.jpg', 'private_host'],
    ['https://172.16.0.1/a.jpg', 'private_host'],
    ['https://172.31.255.255/a.jpg', 'private_host'],
    ['https://192.168.1.1/a.jpg', 'private_host'],
    ['https://169.254.169.254/latest/meta-data', 'private_host'],
    ['https://100.64.0.1/a.jpg', 'private_host'],
    ['https://224.0.0.1/a.jpg', 'private_host'],
    ['https://[::1]/a.jpg', 'private_host'],
    ['https://[::]/a.jpg', 'private_host'],
    ['https://[fe80::1]/a.jpg', 'private_host'],
    ['https://[fd00::1]/a.jpg', 'private_host'],
    ['https://[fc00::1]/a.jpg', 'private_host'],
    ['https://[::ffff:127.0.0.1]/a.jpg', 'private_host'],
    ['https://[::ffff:10.1.2.3]/a.jpg', 'private_host'],
    ['https://[64:ff9b::7f00:1]/a.jpg', 'private_host'],
    ['https://[2002:c0a8:0101::1]/a.jpg', 'private_host'],
    ['https://[ff02::1]/a.jpg', 'private_host'],
    ['', 'bad_url'],
    ['not an address', 'bad_url'],
    ['/media/a.webp', 'bad_url'],
    ['https://other.com/a b.jpg', 'bad_url'],
    ['https://', 'bad_url'],
  ];
  it.each(refused)('refuses %s (%s)', (url, reason) => {
    const r = checkAddress(url);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(reason);
    expect(typeof r.text).toBe('string');
  });
  it('does not refuse public neighbours of private ranges', () => {
    for (const ip of ['172.15.0.1', '172.32.0.1', '11.0.0.1', '100.63.0.1', '100.128.0.1', '169.253.0.1', '192.167.1.1', '198.20.0.1']) expect(checkAddress(`https://${ip}/a.jpg`).ok, ip).toBe(true);
  });
  it('refuses an address that is too long', () => {
    expect(checkAddress(`https://other.com/${'a'.repeat(2100)}.jpg`).reason).toBe('bad_url');
  });
  it('refuses a blocked host and its sub names, not a different name that ends the same way', () => {
    const o = { blockHosts: ['Bad.com'] };
    expect(checkAddress('https://bad.com/a.jpg', o).reason).toBe('blocked_host');
    expect(checkAddress('https://www.bad.com/a.jpg', o).reason).toBe('blocked_host');
    expect(checkAddress('https://cdn.bad.com/a.jpg', o).reason).toBe('blocked_host');
    expect(checkAddress('https://notbad.com/a.jpg', o).ok).toBe(true);
  });
});

describe('checkRedirects', () => {
  const A = 'https://a.com/x.jpg';
  it('accepts no redirect and up to three', () => {
    expect(checkRedirects([A])).toEqual({ ok: true, hops: 0 });
    expect(checkRedirects([A, 'https://b.com/1', 'https://c.com/2', 'https://d.com/3'])).toEqual({ ok: true, hops: MAX_FETCH_REDIRECTS });
  });
  it('refuses a fourth redirect', () => {
    const r = checkRedirects([A, 'https://b.com/1', 'https://c.com/2', 'https://d.com/3', 'https://e.com/4']);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_many_redirects');
  });
  it('checks every hop again: a redirect to a private address, to http, to another port', () => {
    expect(checkRedirects([A, 'https://169.254.169.254/latest'])).toMatchObject({ ok: false, reason: 'private_host', at: 1 });
    expect(checkRedirects([A, 'https://b.com/1', 'http://c.com/2'])).toMatchObject({ ok: false, reason: 'not_https', at: 2 });
    expect(checkRedirects([A, 'https://b.com:8443/1'])).toMatchObject({ ok: false, reason: 'bad_port', at: 1 });
    expect(checkRedirects([A, 'https://b.com/1', 'https://c.com/2', 'https://localhost/3'])).toMatchObject({ ok: false, reason: 'private_host', at: 3 });
  });
  it('refuses a bad first address and an empty chain', () => {
    expect(checkRedirects(['http://a.com/x.jpg'])).toMatchObject({ ok: false, reason: 'not_https', at: 0 });
    expect(checkRedirects([])).toMatchObject({ ok: false, reason: 'bad_url' });
  });
});

describe('seoName', () => {
  const POST = { title: 'Delhi hosts the big phone launch', focusKeyword: 'phone launch', handle: 'phone-launch' };
  it('uses the alt text first and drops stop words (the plan example)', () => {
    const r = seoName({ url: 'https://other.com/wp-content/uploads/IMG_20261113_0934.jpg?w=900', alt: 'New phone launch event in Delhi' }, POST, 1);
    expect(r).toEqual({ name: 'new-phone-launch-event-delhi', source: 'alt' });
  });
  it('falls back in order: caption, then the nearest heading, then focus keyword with the title, then a meaningful old file name', () => {
    expect(seoName({ url: 'https://o.com/IMG_1.jpg', caption: 'Crowd outside the venue' }, POST).source).toBe('caption');
    expect(seoName({ url: 'https://o.com/IMG_1.jpg', heading: 'Venue opens early today' }, POST).source).toBe('heading');
    expect(seoName({ url: 'https://o.com/IMG_1.jpg' }, POST)).toEqual({ name: 'phone-launch-delhi-hosts-big', source: 'title' });
    expect(seoName({ url: 'https://o.com/stadium-roof-repair-work.jpg' }, { handle: 'x' })).toEqual({ name: 'stadium-roof-repair-work', source: 'oldname' });
  });
  it('removes accents, drops other scripts and keeps only a-z, 0-9 and hyphens', () => {
    expect(seoName({ alt: 'Café São Paulo crowd 2026!' }, POST).name).toBe('cafe-sao-paulo-crowd-2026');
    expect(seoName({ alt: 'দিল্লি Delhi metro station opens' }, POST).name).toBe('delhi-metro-station-opens');
  });
  it('keeps at most 6 words and 60 characters, whole words only', () => {
    expect(seoName({ alt: 'one two three four five six seven eight' }, POST).name).toBe('one-two-three-four-five-six');
    const r = seoName({ alt: 'extraordinarily comprehensive investigation announcement regarding infrastructure modernization' }, POST).name;
    expect(r.length).toBeLessThanOrEqual(MAX_NAME_CHARS);
    expect(r).toBe('extraordinarily-comprehensive-investigation-announcement');
    expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r)).toBe(true);
  });
  it('adds title words when the text has fewer than 3 words, and uses the handle when that is still not enough', () => {
    expect(seoName({ alt: 'Crowd' }, POST).name).toBe('crowd-delhi-hosts-big-phone-launch');
    expect(seoName({ alt: 'Crowd' }, { handle: 'phone-launch' }, 2)).toEqual({ name: 'phone-launch-image-2', source: 'handle' });
    expect(seoName({}, { handle: 'phone-launch' }, 3)).toEqual({ name: 'phone-launch-image-3', source: 'handle' });
    expect(seoName({}, {}, 1).name).toBe('picture-image-1');
  });
  it('never uses a camera or random name, a hash, a long number or the other site name', () => {
    for (const alt of ['IMG_1234', 'DSC0001', 'Screenshot', 'untitled', 'download']) {
      const r = seoName({ alt, url: `https://o.com/${alt}.jpg` }, { handle: 'phone-launch' });
      expect(r.name, alt).not.toMatch(/img|dsc|screenshot|untitled|download|1234|0001/);
    }
    expect(seoName({ url: 'https://o.com/a1b2c3d4e5f60718a9b0c1d2e3f40516.jpg' }, { handle: 'phone-launch' })).toEqual({ name: 'phone-launch-image-1', source: 'handle' });
    expect(seoName({ alt: 'Photo 20261113093412 of market vendors today' }, POST).name).toBe('photo-market-vendors-today');
    const r = seoName({ alt: 'Reuters reporter at the venue', sourceHost: 'www.reuters.com' }, POST).name;
    expect(r).toBe('reporter-at-venue');
  });
  it('uses the handle fallback with a clean handle and never gives an empty name', () => {
    expect(seoName({}, { handle: 'Big News!' }, 1).name).toBe('big-news-image-1');
    expect(seoName({}, { handle: 'x'.repeat(100) }, 1).name.length).toBeLessThanOrEqual(MAX_NAME_CHARS);
  });
  it('writes no emoji', () => {
    expect(findEmoji(seoName({ alt: 'Crowd cheers \u{1F389} at the launch event' }, POST).name)).toEqual([]);
  });
});

describe('datePart and hostedPath', () => {
  const POST = { date: '2026-11-16T10:00:00+05:30' };
  it('takes YYYY/MM from the written post date, not from a time zone shift', () => {
    expect(datePart('2026-11-16T10:00:00+05:30')).toBe('2026/11');
    expect(datePart('2026-12-01T00:30:00+05:30')).toBe('2026/12');
    expect(datePart('2026-01-31')).toBe('2026/01');
  });
  it('throws a plain message for a missing or bad date', () => {
    for (const d of ['', undefined, 'yesterday', '2026-13-01', '2026-00-10']) expect(() => datePart(d as any)).toThrow(/valid date/);
  });
  it('builds the address and the repository path', () => {
    expect(hostedPath(POST, 'new-phone-launch', 'webp', [])).toEqual({ src: '/media/2026/11/new-phone-launch.webp', path: 'site/public/media/2026/11/new-phone-launch.webp', name: 'new-phone-launch' });
    expect(hostedPath(POST, 'spin', '.GIF', [], '').path).toBe('media/2026/11/spin.gif');
  });
  it('adds -2, -3 for a taken name, in the same folder only, ignoring case, and works with a Set', () => {
    const taken = ['/media/2026/11/a-b-c.webp', '/media/2026/11/A-B-C-2.webp'];
    expect(hostedPath(POST, 'a-b-c', 'webp', taken).src).toBe('/media/2026/11/a-b-c-3.webp');
    expect(hostedPath(POST, 'a-b-c', 'webp', new Set(['/media/2026/11/a-b-c.webp'])).src).toBe('/media/2026/11/a-b-c-2.webp');
    expect(hostedPath(POST, 'a-b-c', 'webp', ['/media/2026/10/a-b-c.webp']).src).toBe('/media/2026/11/a-b-c.webp');
    expect(hostedPath(POST, 'a-b-c', 'gif', ['/media/2026/11/a-b-c.webp']).src).toBe('/media/2026/11/a-b-c.gif');
  });
  it('refuses a bad extension, a bad name and a post without a date', () => {
    expect(() => hostedPath(POST, 'a-b-c', 'jpg', [])).toThrow(/webp/);
    expect(() => hostedPath(POST, 'A B', 'webp', [])).toThrow(/lowercase/);
    expect(() => hostedPath(POST, '../x', 'webp', [])).toThrow(/lowercase/);
    expect(() => hostedPath({}, 'a-b-c', 'webp', [])).toThrow(/valid date/);
  });
});

describe('findHosted', () => {
  const MAP = {
    '/media/2026/11/one.webp': { sourceUrl: 'https://other.com/a.jpg?w=900', sha256: 'ABCDEF0123' },
    '/media/2026/11/two.webp': { sourceUrl: 'https://other.com/b.jpg', sha256: '99aa' },
    '/media/2026/11/hand-made.webp': { alt: 'no source recorded' },
  };
  it('finds a known picture by the same outside address (the #fragment does not count)', () => {
    expect(findHosted(MAP, { url: 'https://other.com/a.jpg?w=900#x' })).toEqual({ path: '/media/2026/11/one.webp', by: 'url' });
  });
  it('finds a known picture by the same hash, in any letter case', () => {
    expect(findHosted(MAP, { url: 'https://mirror.com/z.jpg', sha256: 'abcdef0123' })).toEqual({ path: '/media/2026/11/one.webp', by: 'sha256' });
    expect(findHosted(MAP, { sha256: '99AA' })).toEqual({ path: '/media/2026/11/two.webp', by: 'sha256' });
  });
  it('a different query string is a different address', () => {
    expect(findHosted(MAP, { url: 'https://other.com/a.jpg?w=400' })).toBeNull();
  });
  it('returns null for an unknown picture, an empty map, no input and entries without a source', () => {
    expect(findHosted(MAP, { url: 'https://other.com/new.jpg', sha256: 'ffff' })).toBeNull();
    expect(findHosted({}, { url: 'https://other.com/a.jpg' })).toBeNull();
    expect(findHosted(undefined as any, {})).toBeNull();
    expect(findHosted(MAP)).toBeNull();
  });
});

describe('the rules never change their input', () => {
  it('leaves the post, the map and the taken list as they were', () => {
    const post = { body: '![a](https://other.com/a.jpg)', image: 'https://other.com/f.jpg' };
    const map = { '/media/2026/11/a.webp': { sourceUrl: 'https://other.com/a.jpg' } };
    const taken = ['/media/2026/11/a.webp'];
    const before = JSON.stringify([post, map, taken]);
    findExternal(post, OWN);
    findHosted(map, { url: 'https://other.com/a.jpg' });
    hostedPath({ date: '2026-11-16' }, 'a', 'webp', taken);
    expect(JSON.stringify([post, map, taken])).toBe(before);
  });
});
