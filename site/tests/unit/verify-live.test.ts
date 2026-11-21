import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
// @ts-expect-error plain JS module without types
import { parseSpec, analyseHtml, judge, verifyOne, verifyAll, MAX_MS } from '../../scripts/verify-live-lib.mjs';

const BASE = 'https://news.test';
const URL1 = BASE + '/2026/11/16/blogs/world/story/';
const page = (o: { canonical?: string | null; head?: string; body?: string } = {}) =>
  `<!doctype html><html><head><title>t</title>${o.canonical === null ? '' : `<link rel="canonical" href="${o.canonical ?? URL1}">`}${o.head ?? ''}</head><body>${o.body ?? '<h1>x</h1>'}</body></html>`;
const H = (o: Record<string, string> = {}) => ({ get: (k: string) => ({ 'content-type': 'text/html; charset=utf-8', ...o })[k.toLowerCase()] ?? null });
const res = (body: string, o: { status?: number; ms?: number; headers?: Record<string, string> } = {}) => ({ status: o.status ?? 200, headers: H(o.headers), body, ms: o.ms ?? 120 });
const j = (body: string, o = {}, spec = { path: '/', status: 200 }, opts = {}) => judge(URL1, spec, res(body, o), opts);

describe('parseSpec', () => {
  it('reads a path and an optional status', () => {
    expect(parseSpec('/a/b/')).toEqual({ path: '/a/b/', status: 200 });
    expect(parseSpec('/old@301')).toEqual({ path: '/old', status: 301 });
  });
});

describe('analyseHtml', () => {
  it('finds canonical, robots, JSON-LD and mixed content', () => {
    const a = analyseHtml(page({ head: '<meta name="robots" content="noindex,follow"><script type="application/ld+json">{"a":1}</script><script type="application/ld+json">{bad</script>', body: '<img src="http://x.test/a.jpg"><a href="http://ok.test/">link</a>' }));
    expect(a.canonicals).toEqual([URL1]);
    expect(a.robots).toEqual(['noindex,follow']);
    expect(a.jsonld.map((x: any) => x.ok)).toEqual([true, false]);
    expect(a.mixed).toEqual(['http://x.test/a.jpg']);
  });
  it('does not call an http link a mixed content, nor anything on an http page', () => {
    expect(analyseHtml('<a href="http://ok.test/">x</a><link rel="canonical" href="http://a.test/">').mixed).toEqual([]);
    expect(analyseHtml('<img src="http://x.test/a.jpg">', false).mixed).toEqual([]);
  });
});

describe('judge: a good page', () => {
  it('passes', () => expect(j(page({ head: '<script type="application/ld+json">{"@type":"NewsArticle"}</script>' }))).toEqual([]));
  it('accepts a canonical with a hash or different host case only if it is the same address', () => {
    expect(j(page({ canonical: URL1 + '#top' }))).toEqual([]);
  });
});

describe('judge: problems, each named plainly', () => {
  it('wrong status', () => expect(j('', { status: 404 }).join()).toMatch(/status 404, expected 200/));
  it('too slow', () => expect(j(page(), { ms: MAX_MS + 1 }).join()).toMatch(/slow/));
  it('no canonical, two canonicals, another canonical', () => {
    expect(j(page({ canonical: null })).join()).toMatch(/no canonical/);
    expect(j(page({ head: `<link rel="canonical" href="${URL1}">` })).join()).toMatch(/2 canonical links/);
    expect(j(page({ canonical: BASE + '/other/' })).join()).toMatch(/not this address/);
  });
  it('noindex in the page or the header, unless allowed', () => {
    expect(j(page({ head: '<meta name="robots" content="noindex">' })).join()).toMatch(/meta robots says noindex/);
    expect(j(page(), { headers: { 'x-robots-tag': 'noindex' } }).join()).toMatch(/X-Robots-Tag/);
    expect(j(page({ head: '<meta name="robots" content="noindex">' }), {}, { path: '/', status: 200 }, { allowNoindex: true })).toEqual([]);
  });
  it('JSON-LD that does not parse', () => expect(j(page({ head: '<script type="application/ld+json">{oops</script>' })).join()).toMatch(/JSON-LD block 1 does not parse/));
  it('mixed content', () => expect(j(page({ body: '<script src="http://x.test/a.js"></script>' })).join()).toMatch(/mixed content: http:\/\/x\.test\/a\.js/));
  it('a redirect: expected status and a Location header', () => {
    expect(judge(URL1, { path: '/', status: 301 }, res('', { status: 301, headers: { location: '/new/' } }))).toEqual([]);
    expect(judge(URL1, { path: '/', status: 301 }, res('', { status: 301 })).join()).toMatch(/no Location/);
    expect(judge(URL1, { path: '/', status: 301 }, res(page())).join()).toMatch(/status 200, expected 301/);
  });
  it('a sitemap or JSON file only needs status, time and header', () => {
    expect(judge(BASE + '/sitemap.xml', { path: '/', status: 200 }, res('<urlset/>', { headers: { 'content-type': 'application/xml' } }))).toEqual([]);
  });
});

describe('verifyOne and verifyAll with a fake fetch', () => {
  const mk = (map: Record<string, any>) => async (u: string) => {
    const r = map[new URL(u).pathname];
    if (r instanceof Error) throw r;
    return { status: r.status ?? 200, headers: H(r.headers), text: async () => r.body ?? '' };
  };
  it('builds the address from base and path and says PASS with the status', async () => {
    const r = await verifyOne(mk({ '/a/': { body: page({ canonical: BASE + '/a/' }) } }), BASE, '/a/');
    expect(r.ok).toBe(true);
    expect(r.line).toMatch(/^PASS https:\/\/news\.test\/a\/ 200 \d+ms$/);
  });
  it('a network error is a FAIL line, not a crash', async () => {
    const r = await verifyOne(mk({ '/a/': new Error('boom') }), BASE, '/a/');
    expect(r).toMatchObject({ ok: false });
    expect(r.line).toMatch(/^FAIL .* could not open it: boom/);
  });
  it('the last line counts passes and fails', async () => {
    const f = mk({ '/a/': { body: page({ canonical: BASE + '/a/' }) }, '/b/': { status: 404 } });
    expect((await verifyAll(f, BASE, ['/a/'])).last).toBe('VERIFY-LIVE PASS (1 address)');
    expect((await verifyAll(f, BASE, ['/a/', '/b/'])).last).toBe('VERIFY-LIVE FAIL (1 of 2)');
    expect((await verifyAll(f, BASE, [])).last).toMatch(/no address given/);
  });
});

describe('npm run verify:live against a small local server', () => {
  it('prints one line per address and exits by the result', async () => {
    const server = createServer((req, rsp) => {
      const port = (server.address() as any).port;
      const self = `http://127.0.0.1:${port}`;
      if (req.url === '/ok/') { rsp.setHeader('content-type', 'text/html'); rsp.end(`<link rel="canonical" href="${self}/ok/">`); }
      else if (req.url === '/old') { rsp.statusCode = 301; rsp.setHeader('location', '/ok/'); rsp.end(); }
      else { rsp.statusCode = 404; rsp.end('no'); }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const run = (args: string[]) => new Promise<{ code: number; out: string }>((resolve) => {
      const p = spawn('node', ['scripts/verify-live.mjs', base, ...args]);
      let out = ''; p.stdout.on('data', (d) => (out += d)); p.on('close', (code) => resolve({ code: code ?? 1, out }));
    });
    const good = await run(['/ok/', '/old@301']);
    expect(good.code).toBe(0);
    expect(good.out).toMatch(/VERIFY-LIVE PASS \(2 addresses\)/);
    const badRun = await run(['/ok/', '/missing/']);
    expect(badRun.code).toBe(1);
    expect(badRun.out).toMatch(/FAIL .*\/missing\/ - status 404, expected 200/);
    expect(badRun.out).toMatch(/VERIFY-LIVE FAIL \(1 of 2\)/);
    server.close();
  });
});
