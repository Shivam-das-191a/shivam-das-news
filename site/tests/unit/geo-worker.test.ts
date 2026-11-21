import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS Worker
import worker, { decide, cleanCountry, blockedList, consentList, DEFAULT_CONSENT } from '../../../workers/geo/index.js';

const env = { SITE_ORIGIN: 'https://news.test' };
const call = (init: RequestInit = {}, path = '/geo', e: any = env) => worker.fetch(new Request('https://geo.test' + path, init), e);

describe('geo Worker: decision', () => {
  it('turns ads OFF in India and ON elsewhere (PLAN 13.2)', () => {
    expect(decide('IN', env)).toEqual({ ads: false, consent: false, country: 'IN', reason: 'blocked' });
    expect(decide('in', env).ads).toBe(false);
    expect(decide('US', env)).toEqual({ ads: true, consent: false, country: 'US', reason: 'allowed' });
  });
  it('turns ads OFF when the country is unknown, unless the owner sets ADS_ON_UNKNOWN=true (BUGS A1)', () => {
    for (const c of [undefined, null, '', 'XX', 'T1', 'USA', '1', 'I N']) expect(decide(c, env)).toEqual({ ads: false, consent: true, country: null, reason: 'unknown' });
    expect(decide(undefined, { ...env, ADS_ON_UNKNOWN: 'true' }).ads).toBe(true);
    expect(decide(undefined, { ...env, ADS_ON_UNKNOWN: 'yes' }).ads).toBe(false);
  });
  it('reads more blocked countries, and an empty list blocks nobody', () => {
    expect(blockedList({ BLOCKED_COUNTRIES: 'in, pk ,xx,bad' })).toEqual(['IN', 'PK']);
    expect(decide('PK', { BLOCKED_COUNTRIES: 'IN,PK' }).ads).toBe(false);
    expect(decide('IN', { BLOCKED_COUNTRIES: '' }).ads).toBe(true);
    expect(blockedList({})).toEqual(['IN']);
  });
  it('asks for consent in the EU, EEA, UK and Switzerland, and when the country is unknown (v0.25.0)', () => {
    for (const c of ['DE', 'FR', 'GB', 'CH', 'NO', 'IE', 'gb']) expect(decide(c, env)).toMatchObject({ ads: true, consent: true });
    for (const c of ['US', 'CA', 'AU', 'JP']) expect(decide(c, env)).toMatchObject({ ads: true, consent: false });
    expect(decide('IN', env).consent).toBe(false);
    expect(decide(undefined, { ...env, ADS_ON_UNKNOWN: 'true' })).toMatchObject({ ads: true, consent: true });
  });
  it('reads the consent list from the settings, and an empty list asks nobody', () => {
    expect(consentList({})).toHaveLength(32);
    expect(DEFAULT_CONSENT.split(',')).toHaveLength(32);
    expect(consentList({ CONSENT_COUNTRIES: 'de, br ,xx,bad' })).toEqual(['DE', 'BR']);
    expect(decide('BR', { CONSENT_COUNTRIES: 'DE,BR' }).consent).toBe(true);
    expect(decide('DE', { CONSENT_COUNTRIES: '' }).consent).toBe(false);
  });
  it('cleans country codes', () => {
    expect(cleanCountry(' gb ')).toBe('GB');
    expect(cleanCountry('XX')).toBeNull();
  });
});

describe('geo Worker: HTTP', () => {
  it('answers JSON from the CF-IPCountry header and is never cached', async () => {
    const res = await call({ headers: { 'CF-IPCountry': 'IN', Origin: 'https://news.test' } });
    expect(await res.json()).toEqual({ ads: false, consent: false, country: 'IN', reason: 'blocked' });
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Vary')).toBe('Origin');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://news.test');
    expect((await (await call({ headers: { 'CF-IPCountry': 'DE' } })).json()).consent).toBe(true);
  });
  it('gives no CORS header to another website', async () => {
    const res = await call({ headers: { 'CF-IPCountry': 'US', Origin: 'https://evil.test' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await call({ headers: { 'CF-IPCountry': 'US' } }, '/geo', {})).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('answers "no ads" when there is no country at all', async () => {
    expect((await (await call()).json()).ads).toBe(false);
  });
  it('handles preflight, other methods and other paths', async () => {
    const pre = await call({ method: 'OPTIONS', headers: { Origin: 'https://news.test' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('GET');
    expect((await call({ method: 'POST' })).status).toBe(405);
    expect((await call({}, '/other')).status).toBe(404);
  });
});
