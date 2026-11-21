// Geo check for the ad loader (Cloudflare Worker, PLAN 13.2, BUGS A1).
// GET /geo answers { ads: true|false, country: "US"|null, reason } using the country Cloudflare already knows for the visitor.
// v0.25.0: the answer also has `consent: true|false`. true = the visitor must say yes before any ad loads (EU, EEA, UK and Switzerland by default, and also when the country is unknown).
// Rules: a blocked country (India by default) gets ads OFF; an unknown country gets ads OFF unless ADS_ON_UNKNOWN is "true".
// The answer is never cached, so one visitor's country is never given to another (BUGS A1). No IP address is read or stored.
// v0.82.0 (BOT_PROTECTION Part 5b): a visitor whose network (`request.cf.asn`) is on the datacenter list gets ads OFF, reason "datacenter". Real readers use home and phone lines; scripts run in cloud servers, and ads shown to them are invalid traffic.
// The list is the one in `../shared/datacenter.js`, the same one the analytics Worker uses. No network number is stored or sent back: only the word "datacenter".
// Vars: SITE_ORIGIN (required), BLOCKED_COUNTRIES (default "IN"), ADS_ON_UNKNOWN (default "false"), CONSENT_COUNTRIES (default: EU, EEA, UK, Switzerland), BLOCK_DATACENTERS (default "true").

import { isDatacenterAsn } from '../shared/datacenter.js';

/** Two letters or nothing. "XX" (unknown) and "T1" (Tor) are not real countries, so they count as unknown. */
export function cleanCountry(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
}

export function blockedList(env) {
  const raw = env.BLOCKED_COUNTRIES === undefined ? 'IN' : env.BLOCKED_COUNTRIES;
  return String(raw).split(',').map((s) => cleanCountry(s)).filter(Boolean);
}

/** v0.25.0: countries where the visitor must agree before ads load: the 27 EU states, Iceland, Liechtenstein, Norway, the UK and Switzerland. */
export const DEFAULT_CONSENT = 'AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO,GB,CH';

export function consentList(env) {
  const raw = env.CONSENT_COUNTRIES === undefined ? DEFAULT_CONSENT : env.CONSENT_COUNTRIES;
  return String(raw).split(',').map((s) => cleanCountry(s)).filter(Boolean);
}

/**
 * v0.82.0: true unless the owner wrote exactly false, 0, no or off (any case). Anything else, an empty text or a missing value keeps the datacenter rule ON (safe side).
 * The owner switches it off only to test the loader from a cloud server of their own.
 */
export function blockDatacenters(env = {}) {
  const raw = env.BLOCK_DATACENTERS;
  if (raw === undefined || raw === null) return true;
  return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

/**
 * { ads, consent, country, reason } for one visitor. reason: "datacenter", "blocked", "unknown" or "allowed". An unknown country needs consent (safe side).
 * `asn` (v0.82.0) is the network number from the edge. It is optional: without it (older callers, a request outside Cloudflare) nothing changes.
 * The datacenter rule comes first: such a visitor gets ads off and no consent question, because no ad is shown at all.
 */
export function decide(country, env = {}, asn) {
  const c = cleanCountry(country);
  if (blockDatacenters(env) && isDatacenterAsn(asn)) return { ads: false, consent: false, country: c, reason: 'datacenter' };
  if (!c) return { ads: String(env.ADS_ON_UNKNOWN).toLowerCase() === 'true', consent: true, country: null, reason: 'unknown' };
  if (blockedList(env).includes(c)) return { ads: false, consent: false, country: c, reason: 'blocked' };
  return { ads: true, consent: consentList(env).includes(c), country: c, reason: 'allowed' };
}

const headers = (env, origin) => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private',
  Vary: 'Origin',
  'X-Content-Type-Options': 'nosniff',
  // Only the site itself may read the answer. Any other origin gets no CORS header.
  ...(env.SITE_ORIGIN && origin === env.SITE_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}),
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (url.pathname !== '/geo') return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers(env, origin), 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' } });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } });
    const country = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry');
    const asn = request.cf && request.cf.asn; // v0.82.0: the network number from the edge (undefined outside Cloudflare, which counts as not a datacenter)
    return new Response(JSON.stringify(decide(country, env, asn)), { headers: headers(env, origin) });
  },
};
