/** v0.42.0: the footer rows "Our other projects" and "Follow us" (PLAN 14: social links; PLAN 29.3: SVG icons only). Pure functions, unit tested.
 *  Projects come from config/footer.json. Social accounts come from `sameAs` in config/site.json (the same list also feeds the schema),
 *  so an account is written once. A bad value stops the build with a plain message, so a typo never reaches the live site. */
import { ICONS } from './svg-icons';

export interface ProjectLink { name: string; url: string; icon: string }
export interface SocialLink { url: string; label: string; icon: string | null }

export const MAX_PROJECTS = 8;

function httpsUrl(text: unknown, where: string): string {
  const t = String(text ?? '').trim();
  const bad = (why: string) => new Error(`${where}: "${t}" is not valid: ${why}.`);
  if (/[\s"'<>\\]/.test(t)) throw bad('it has spaces or unsafe characters');
  let u: URL;
  try { u = new URL(t); } catch { throw bad('it is not a web address'); }
  if (u.protocol !== 'https:') throw bad('it must start with https://');
  if (u.username || u.password) throw bad('it must not hold a user name or password');
  if (!u.hostname.includes('.')) throw bad('the host name looks wrong');
  return u.href;
}

/** The project list for the footer. An unknown icon name or a bad address stops the build. */
export function projectLinks(cfg: { projects?: unknown } | null | undefined): ProjectLink[] {
  const list = Array.isArray(cfg?.projects) ? (cfg!.projects as any[]) : [];
  if (list.length > MAX_PROJECTS) throw new Error(`footer.json: at most ${MAX_PROJECTS} projects (found ${list.length}).`);
  const seen = new Set<string>();
  return list.map((p, i) => {
    const name = String(p?.name ?? '').trim();
    if (!name) throw new Error(`footer.json: project ${i + 1} has no name.`);
    const url = httpsUrl(p?.url, `footer.json: project "${name}" address`);
    const icon = String(p?.icon ?? '').trim();
    if (!ICONS[icon]) throw new Error(`footer.json: project "${name}" uses the icon "${icon}", which does not exist (src/lib/svg-icons.ts).`);
    if (seen.has(url)) throw new Error(`footer.json: project "${name}" repeats the address ${url}.`);
    seen.add(url);
    return { name, url, icon };
  });
}

/** Social accounts for the footer, from `sameAs`. X (x.com, twitter.com) gets its SVG icon; any other site is shown by its host name. */
export function socialLinks(sameAs: unknown): SocialLink[] {
  const list = Array.isArray(sameAs) ? sameAs : [];
  const seen = new Set<string>();
  const out: SocialLink[] = [];
  for (const raw of list) {
    const url = httpsUrl(raw, 'site.json sameAs address');
    if (seen.has(url)) continue;
    seen.add(url);
    const host = new URL(url).hostname.replace(/^www\./, '').replace(/^mobile\./, '');
    const isX = host === 'x.com' || host === 'twitter.com';
    out.push({ url, label: isX ? 'X' : host, icon: isX ? 'x' : null });
  }
  return out;
}
