// v0.82.0 (BOT_PROTECTION Part 5b, Rule 3): the ONE copy of the datacenter network list.
// The analytics Worker (counts such a visit as "unverified", v0.77.0) and the geo Worker (answers "no ads" to such a visit, v0.82.0) both import this file.
// Nothing here reads a request, a clock or a database: it only answers "is this network number a datacenter?".

/**
 * Autonomous system numbers (ASN) of big cloud and hosting companies. Real readers use home and phone lines; scripts run in cloud servers.
 * Honest limit: a short list, not a full one, and a real person on a company VPN inside a cloud network is treated as a datacenter too.
 * To add a company, add its number here once; both Workers follow at the next deploy.
 */
export const DATACENTER_ASNS = new Set([
  16509, 14618, // Amazon (AWS)
  15169, 396982, // Google Cloud
  8075, // Microsoft (Azure)
  14061, // DigitalOcean
  16276, // OVH
  24940, // Hetzner
  63949, // Linode (Akamai)
  20473, // Vultr
  45102, 37963, // Alibaba Cloud
  132203, // Tencent Cloud
  31898, // Oracle Cloud
  51167, // Contabo
]);

/** 1 when the number (or the text of a number) is an ASN of the list, else 0. Missing, text and negative numbers give 0. */
export function isDatacenterAsn(raw) {
  const n = typeof raw === 'string' && /^\d{1,10}$/.test(raw.trim()) ? Number(raw) : raw;
  return Number.isInteger(n) && DATACENTER_ASNS.has(n) ? 1 : 0;
}
