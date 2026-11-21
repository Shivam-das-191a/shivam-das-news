// v0.18.0: helpers for the Ads screen (config/ads.json, PLAN 13.5, BUGS A7).
// Same rules as src/lib/ads-txt.ts (a test runs both on the same inputs, so they cannot drift apart). Pure, no DOM.

export const GOOGLE_CERT = 'f08c47fec0942fa0';
const PUB = /^pub-\d{10,20}$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const ACCOUNT = /^[A-Za-z0-9_.-]{1,64}$/;
const CERT = /^[a-f0-9]{6,32}$/;

export function cleanPublisherId(raw) {
  const v = String(raw ?? '').trim().toLowerCase().replace(/^ca-/, '');
  if (!v) return '';
  if (!PUB.test(v)) throw new Error(`The AdSense id "${raw}" is not valid. Use the id from your AdSense account, for example ca-pub-1234567890123456.`);
  return v;
}

export function cleanLine(raw) {
  const text = String(raw ?? '').trim();
  const parts = text.split(',').map((x) => x.trim());
  const [domain, account, rel, cert, ...rest] = parts;
  const bad = (why) => new Error(`The line "${text}" is not valid: ${why}. Use: domain, account id, DIRECT or RESELLER, optional certification id.`);
  if (rest.length || parts.length < 3) throw bad('it needs 3 or 4 parts separated by commas');
  const d = (domain || '').toLowerCase();
  if (!DOMAIN.test(d)) throw bad('the first part must be a domain name');
  if (!ACCOUNT.test(account || '')) throw bad('the account id has unusual characters');
  const r = (rel || '').toUpperCase();
  if (r !== 'DIRECT' && r !== 'RESELLER') throw bad('the third part must be DIRECT or RESELLER');
  if (cert !== undefined && !CERT.test(cert.toLowerCase())) throw bad('the certification id must be hexadecimal');
  return [d, account, r, ...(cert !== undefined ? [cert.toLowerCase()] : [])].join(', ');
}

/** { text, lines } exactly as the build writes /ads.txt. Throws a plain message for a bad value. */
export function buildAdsTxt(cfg = {}) {
  const lines = [];
  const pub = cleanPublisherId(cfg.adsensePublisherId);
  if (pub) lines.push(`google.com, ${pub}, DIRECT, ${GOOGLE_CERT}`);
  for (const raw of cfg.extraLines ?? []) lines.push(cleanLine(raw));
  const seen = new Set();
  const unique = lines.filter((l) => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return { text: unique.length ? unique.join('\n') + '\n' : '', lines: unique };
}

/** Reads the file text. A broken file gives the empty config. */
export function readAds(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { adsensePublisherId: '', extraLines: [] }; }
  return { adsensePublisherId: typeof j?.adsensePublisherId === 'string' ? j.adsensePublisherId : '', extraLines: Array.isArray(j?.extraLines) ? j.extraLines.filter((x) => typeof x === 'string') : [] };
}

/** The checked config as the file text, from the two form values (the lines box has one line per row; empty rows are ignored). */
export function configFromForm(publisherId, linesText) {
  const extra = String(linesText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cfg = { adsensePublisherId: cleanPublisherId(publisherId) ? `ca-${cleanPublisherId(publisherId)}` : '', extraLines: extra.map(cleanLine) };
  buildAdsTxt(cfg);
  return cfg;
}

export const writeAds = (cfg) => JSON.stringify(cfg, null, 2) + '\n';
