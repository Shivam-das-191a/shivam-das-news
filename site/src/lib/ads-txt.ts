/** v0.17.0: ads.txt builder (PLAN 13.5, BUGS A7). Pure functions, unit tested.
 *  The file is made from config/ads.json. Nothing is invented: with no publisher id and no extra lines the file is empty,
 *  and a value that is not valid stops the build with a plain message, so a typo never reaches the live site. */

export interface AdsConfig { adsensePublisherId?: string; extraLines?: string[] }

/** Google's own certification authority id for AdSense lines. It is the same for every publisher. */
export const GOOGLE_CERT = 'f08c47fec0942fa0';

const PUB = /^pub-\d{10,20}$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
const ACCOUNT = /^[A-Za-z0-9_.-]{1,64}$/;
const CERT = /^[a-f0-9]{6,32}$/;

/** "ca-pub-123" and "pub-123" both give "pub-123". Returns '' for an empty value, throws for anything else that is not an id. */
export function cleanPublisherId(raw: unknown): string {
  const v = String(raw ?? '').trim().toLowerCase().replace(/^ca-/, '');
  if (!v) return '';
  if (!PUB.test(v)) throw new Error(`ads.json: adsensePublisherId "${raw}" is not valid. Use the id from your AdSense account, for example ca-pub-1234567890123456.`);
  return v;
}

/** One ads.txt data line: domain, account id, DIRECT or RESELLER, optional certification id. Returns the cleaned line. */
export function cleanLine(raw: unknown): string {
  const text = String(raw ?? '').trim();
  const parts = text.split(',').map((x) => x.trim());
  const [domain, account, rel, cert, ...rest] = parts;
  const bad = (why: string) => new Error(`ads.json: extra line "${text}" is not valid: ${why}. Use: domain, account id, DIRECT or RESELLER, optional certification id.`);
  if (rest.length || parts.length < 3) throw bad('it needs 3 or 4 parts separated by commas');
  const d = (domain || '').toLowerCase();
  if (!DOMAIN.test(d)) throw bad('the first part must be a domain name');
  if (!ACCOUNT.test(account || '')) throw bad('the account id has unusual characters');
  const r = (rel || '').toUpperCase();
  if (r !== 'DIRECT' && r !== 'RESELLER') throw bad('the third part must be DIRECT or RESELLER');
  if (cert !== undefined && !CERT.test(cert.toLowerCase())) throw bad('the certification id must be hexadecimal');
  return [d, account, r, ...(cert !== undefined ? [cert.toLowerCase()] : [])].join(', ');
}

/** The whole file. AdSense first (when an id is set), then your own lines. Repeated lines are written once. Empty config gives ''. */
export function buildAdsTxt(cfg: AdsConfig = {}): { text: string; lines: string[] } {
  const lines: string[] = [];
  const pub = cleanPublisherId(cfg.adsensePublisherId);
  if (pub) lines.push(`google.com, ${pub}, DIRECT, ${GOOGLE_CERT}`);
  for (const raw of cfg.extraLines ?? []) lines.push(cleanLine(raw));
  const seen = new Set<string>();
  const unique = lines.filter((l) => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return { text: unique.length ? unique.join('\n') + '\n' : '', lines: unique };
}
