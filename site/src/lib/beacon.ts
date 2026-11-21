/** v0.34.0 (Phase 6 part 3): settings check for the analytics beacon (PLAN 15, LOGICS 9). Pure function, unit tested.
 *  The file is config/analytics.json. With the default file (empty endpoint) no script is added to any page.
 *  A bad address stops the build with a plain message, so a typo never reaches the live site. */


export interface AnalyticsConfig { endpoint?: string }
export interface BeaconPlan { endpoint: string }

/** null when analytics is off (empty endpoint). Otherwise the clean https address of the Worker's /collect. */
export function beaconPlan(cfg: AnalyticsConfig | null | undefined): BeaconPlan | null {
  const text = String(cfg?.endpoint ?? '').trim();
  if (!text) return null;
  const bad = (why: string) => new Error(`analytics.json: endpoint \"${text}\" is not valid: ${why}.`);
  if (/[\s"'<>\\]/.test(text)) throw bad('it has spaces or unsafe characters');
  let u: URL;
  try { u = new URL(text); } catch { throw bad('it is not a web address'); }
  if (u.protocol !== 'https:') throw bad('it must start with https://');
  if (u.username || u.password) throw bad('it must not hold a user name or password');
  if (!u.hostname.includes('.')) throw bad('the host name looks wrong');
  const endpoint = u.href;
  if (new URL(endpoint).pathname !== '/collect') throw new Error(`analytics.json: endpoint "${endpoint}" must end with /collect (for example https://news-analytics.yourname.workers.dev/collect).`);
  return { endpoint };
}
