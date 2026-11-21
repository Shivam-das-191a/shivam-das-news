import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-ignore plain JS Worker
import worker, { decide, blockDatacenters } from '../../../workers/geo/index.js';
// @ts-ignore plain JS shared file
import { DATACENTER_ASNS, isDatacenterAsn } from '../../../workers/shared/datacenter.js';
// @ts-ignore plain JS rules of the analytics Worker
import * as analyticsLib from '../../../workers/analytics/lib.js';

// v0.82.0 (BOT_PROTECTION Part 5b): a visitor on a datacenter network gets "no ads" from the geo Worker.
// The list is ONE shared file used by the geo Worker and the analytics Worker.

const env = { SITE_ORIGIN: 'https://news.test' };
const AWS = 16509;
const HOME_LINE = 7922; // a big home internet provider: not a datacenter

/** A request with the edge data Cloudflare adds (`request.cf`). Plain Node requests have none, so it is added by hand. */
function req(cf: any, headers: Record<string, string> = {}) {
  const r: any = new Request('https://geo.test/geo', { headers });
  Object.defineProperty(r, 'cf', { value: cf });
  return r;
}
const ask = async (cf: any, e: any = env, headers: Record<string, string> = {}) => (await worker.fetch(req(cf, headers), e)).json();

describe('the shared datacenter list', () => {
  it('knows the big cloud companies and not a home line', () => {
    for (const n of [16509, 14618, 15169, 8075, 14061, 16276, 24940, 20473, 31898]) expect(isDatacenterAsn(n)).toBe(1);
    expect(isDatacenterAsn(HOME_LINE)).toBe(0);
    expect(isDatacenterAsn(13335)).toBe(0); // Cloudflare itself is not on the list (Private Relay and WARP readers are real people)
  });
  it('accepts the number as text, and gives 0 for junk', () => {
    expect(isDatacenterAsn('16509')).toBe(1);
    expect(isDatacenterAsn(' 16509 ')).toBe(1);
    for (const bad of [undefined, null, '', 'AS16509', '-16509', -16509, 16509.5, NaN, {}, [], true, '16509; DROP']) expect(isDatacenterAsn(bad)).toBe(0);
  });
  it('the list holds only whole positive numbers', () => {
    expect(DATACENTER_ASNS.size).toBeGreaterThan(10);
    for (const n of DATACENTER_ASNS) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });
  it('there is ONE copy: the analytics file re-exports the very same list and function', () => {
    expect(analyticsLib.DATACENTER_ASNS).toBe(DATACENTER_ASNS);
    expect(analyticsLib.isDatacenterAsn).toBe(isDatacenterAsn);
    const analytics = readFileSync('../workers/analytics/lib.js', 'utf8');
    const geo = readFileSync('../workers/geo/index.js', 'utf8');
    expect(analytics).toContain("from '../shared/datacenter.js'");
    expect(geo).toContain("from '../shared/datacenter.js'");
    // no second list of numbers is written in either Worker
    expect(analytics).not.toMatch(/new Set\(\[\s*16509/);
    expect(geo).not.toMatch(/16509/);
  });
});

describe('geo Worker: the datacenter rule in decide()', () => {
  it('turns ads OFF for a datacenter network, with the reason, and asks no consent', () => {
    expect(decide('US', env, AWS)).toEqual({ ads: false, consent: false, country: 'US', reason: 'datacenter' });
    expect(decide('DE', env, AWS)).toEqual({ ads: false, consent: false, country: 'DE', reason: 'datacenter' });
  });
  it('a datacenter with an unknown country has country null and still no ads', () => {
    expect(decide(undefined, env, AWS)).toEqual({ ads: false, consent: false, country: null, reason: 'datacenter' });
    expect(decide('XX', { ...env, ADS_ON_UNKNOWN: 'true' }, AWS).ads).toBe(false);
  });
  it('a datacenter in a blocked country still gets no ads (the datacenter reason comes first)', () => {
    expect(decide('IN', env, AWS)).toMatchObject({ ads: false, reason: 'datacenter' });
  });
  it('a home line behaves exactly as before', () => {
    expect(decide('US', env, HOME_LINE)).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
    expect(decide('IN', env, HOME_LINE)).toEqual({ ads: false, consent: false, country: 'IN', reason: 'blocked' });
    expect(decide('DE', env, HOME_LINE)).toMatchObject({ ads: true, consent: true });
  });
  it('without a network number nothing changes (older callers, a request outside Cloudflare)', () => {
    for (const asn of [undefined, null, '', 'junk', 0, -1]) {
      expect(decide('US', env, asn)).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
    }
    expect(decide('US', env)).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
  });
  it('the network number as text is understood', () => {
    expect(decide('US', env, '16509').reason).toBe('datacenter');
  });
});

describe('geo Worker: the BLOCK_DATACENTERS switch', () => {
  it('is ON when the setting is missing, true, empty or any unknown text (safe side)', () => {
    for (const v of [undefined, null, 'true', 'TRUE', '', ' ', 'yes', 'on', '1', 'maybe', 'flase']) expect(blockDatacenters({ BLOCK_DATACENTERS: v })).toBe(true);
    expect(blockDatacenters({})).toBe(true);
    expect(blockDatacenters()).toBe(true);
  });
  it('is OFF only for false, 0, no or off, in any case, with spaces', () => {
    for (const v of ['false', 'FALSE', ' False ', '0', 'no', 'NO', 'off', 'Off']) expect(blockDatacenters({ BLOCK_DATACENTERS: v })).toBe(false);
  });
  it('with the switch off, a datacenter is judged by its country like anyone else', () => {
    const off = { ...env, BLOCK_DATACENTERS: 'false' };
    expect(decide('US', off, AWS)).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
    expect(decide('IN', off, AWS).reason).toBe('blocked');
  });
  it('the switch is in the wrangler file and is on by default', () => {
    const toml = readFileSync('../workers/geo/wrangler.toml', 'utf8');
    expect(toml).toMatch(/^BLOCK_DATACENTERS = "true"/m);
  });
});

describe('geo Worker: HTTP answer', () => {
  it('answers no ads and the reason for a datacenter, and never sends the network number back', async () => {
    const res = await worker.fetch(req({ country: 'US', asn: AWS }, { Origin: 'https://news.test' }), env);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ads: false, consent: false, country: 'US', reason: 'datacenter' });
    expect(text).not.toContain(String(AWS));
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Vary')).toBe('Origin');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://news.test');
  });
  it('a request from a home line gets ads as before', async () => {
    expect(await ask({ country: 'US', asn: HOME_LINE })).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
  });
  it('a request with no edge data at all (no cf) and a country header still works', async () => {
    const r = await worker.fetch(new Request('https://geo.test/geo', { headers: { 'CF-IPCountry': 'US' } }), env);
    expect(await r.json()).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
  });
  it('the switch off in the environment lets a datacenter through the HTTP route too', async () => {
    expect(await ask({ country: 'US', asn: AWS }, { ...env, BLOCK_DATACENTERS: 'off' })).toMatchObject({ ads: true, reason: 'allowed' });
  });
  it('the other routes and methods are unchanged', async () => {
    expect((await worker.fetch(new Request('https://geo.test/other'), env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://geo.test/geo', { method: 'POST' }), env)).status).toBe(405);
  });
});

describe('the ad loader obeys a datacenter answer', () => {
  const source = readFileSync('src/lib/ads-client.js', 'utf8');
  const adsClient: any = new Function(source + '\nreturn adsClient;')();
  const cfg = { geoUrl: 'https://geo.test/geo', popunder: 'https://ads.test/pop.js', socialBar: 'https://ads.test/bar.js', timeoutMs: 40, hideAll: false, hidePopunder: false };
  const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));

  it('loads no ad script and no ad box when the Worker says datacenter', async () => {
    const added: any[] = [];
    const listeners: Record<string, any> = {};
    const w: any = {
      document: {
        body: { getAttribute: () => 'article', appendChild: (s: any) => added.push(s) },
        createElement: () => ({ attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }),
      },
      sessionStorage: { getItem: () => null, setItem: () => undefined },
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ads: false, consent: false, country: 'US', reason: 'datacenter' }) }),
      setTimeout: (f: any, ms: number) => setTimeout(f, ms),
      addEventListener: (e: string, f: any) => { listeners[e] = f; },
      removeEventListener: (e: string) => { delete listeners[e]; },
    };
    adsClient(w, cfg);
    listeners.pointerdown({ isTrusted: true });
    await wait(80);
    expect(added.length).toBe(0);
  });
});
