/** v0.48.0 (Phase 7 part 6): settings check for the contact form (PLAN 16; BUGS N6). Pure function, unit tested.
 *  The file is config/contact.json. With the default file (both values empty) no form is added to any page.
 *  A half-filled or wrong value stops the build with a plain message, so a typo never reaches the live site. */

export interface ContactConfig { endpoint?: string; turnstileSiteKey?: string }
export interface ContactPlan { endpoint: string; siteKey: string }

/** null when the form is off (both values empty). Otherwise the clean https address of the Worker's /contact and the Turnstile site key. */
export function contactPlan(cfg: ContactConfig | null | undefined): ContactPlan | null {
  const text = String(cfg?.endpoint ?? '').trim();
  const key = String(cfg?.turnstileSiteKey ?? '').trim();
  if (!text && !key) return null;
  if (!text) throw new Error('contact.json: endpoint is empty. Set both endpoint and turnstileSiteKey, or leave both empty.');
  if (!key) throw new Error('contact.json: turnstileSiteKey is empty. Set both endpoint and turnstileSiteKey, or leave both empty.');
  const bad = (why: string) => new Error(`contact.json: endpoint "${text}" is not valid: ${why}.`);
  if (/[\s"'<>\\]/.test(text)) throw bad('it has spaces or unsafe characters');
  let u: URL;
  try { u = new URL(text); } catch { throw bad('it is not a web address'); }
  if (u.protocol !== 'https:') throw bad('it must start with https://');
  if (u.username || u.password) throw bad('it must not hold a user name or password');
  if (!u.hostname.includes('.')) throw bad('the host name looks wrong');
  if (u.pathname !== '/contact') throw new Error(`contact.json: endpoint "${u.href}" must end with /contact (for example https://news-contact.yourname.workers.dev/contact).`);
  if (!/^[0-9A-Za-z_-]{10,64}$/.test(key)) throw new Error('contact.json: turnstileSiteKey must be 10 to 64 letters, numbers, - or _ (copy the Site Key from the Turnstile widget, not the secret key).');
  return { endpoint: u.href, siteKey: key };
}
