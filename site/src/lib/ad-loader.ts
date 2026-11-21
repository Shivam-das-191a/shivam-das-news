/** v0.20.0 (native banner added in v0.22.0, smartlink in v0.23.0, AdSense unit in v0.24.0, consent days in v0.28.0, consent text in v0.30.0, button labels in v0.31.0): settings check for the ad loader (PLAN 13.2, 13.3, 29.1; BUGS A1, A3, A6). Pure functions, unit tested.
 *  The file is config/ad-loader.json. Nothing is invented: with the default file no script is added to any page.
 *  A bad value stops the build with a plain message, so a typo never reaches the live site. */

import { cleanPublisherId } from './ads-txt';

export interface NativeBannerConfig { script?: string; containerId?: string; afterParagraph?: number | string }

/** v0.24.0: the AdSense in-article unit. The publisher id is NOT here: it comes from config/ads.json (one place only). */
export interface AdsenseConfig { slot?: string; afterParagraph?: number | string }

export interface AdLoaderConfig {
  complianceMode?: boolean;
  geoUrl?: string;
  adsterra?: { popunder?: string; socialBar?: string; nativeBanner?: NativeBannerConfig; smartlink?: string };
  adsense?: AdsenseConfig;
  /** v0.28.0: how long a reader's answer to the consent bar is kept (days). Empty = 180. */
  consentDays?: number | string;
  /** v0.30.0: the sentence shown in the consent bar. Empty = the built-in English sentence. */
  consentText?: string;
  /** v0.31.0: the words on the three consent buttons. Empty = the built-in English words. */
  consentAccept?: string;
  consentDecline?: string;
  consentChoices?: string;
}

/** The native banner needs a script address AND the id of the box (container) that Adsterra fills. */
export interface NativeBanner { script: string; containerId: string; afterParagraph: number }

/** The AdSense unit: publisher id in the form ca-pub-..., the ad slot number, and the paragraph after which it goes. */
export interface AdsenseUnit { client: string; slot: string; afterParagraph: number }

export interface AdLoaderPlan {
  geoUrl: string;
  popunder: string;
  socialBar: string;
  nativeBanner: NativeBanner | null;
  /** A plain link (not a script). '' when off. */
  smartlink: string;
  /** null when off. */
  adsense: AdsenseUnit | null;
  /** v0.28.0: days a saved consent answer stays valid (30 to 365). */
  consentDays: number;
  /** v0.30.0: only present when the owner wrote a text; otherwise the browser file uses its built-in sentence. */
  consentText?: string;
  /** v0.31.0: each is present only when the owner wrote a word. */
  consentAccept?: string;
  consentDecline?: string;
  consentChoices?: string;
  timeoutMs: number;
  idleMs: number;
}

export const NATIVE_AFTER_DEFAULT = 3;
export const NATIVE_AFTER_MAX = 20;
export const ADSENSE_AFTER_DEFAULT = 5;
export const CONSENT_DAYS_DEFAULT = 180;
export const CONSENT_DAYS_MIN = 30;
export const CONSENT_DAYS_MAX = 365;
export const CONSENT_TEXT_MIN = 20;
export const CONSENT_TEXT_MAX = 300;
export const CONSENT_LABEL_MIN = 2;
export const CONSENT_LABEL_MAX = 24;

/** '' for an empty value. Otherwise a clean https address, or an error with a plain message. */
export function cleanHttpsUrl(raw: unknown, label: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why: string) => new Error(`ad-loader.json: ${label} \"${text}\" is not valid: ${why}.`);
  if (/[\s"'<>\\]/.test(text)) throw bad('it has spaces or unsafe characters');
  let u: URL;
  try { u = new URL(text); } catch { throw bad('it is not a web address'); }
  if (u.protocol !== 'https:') throw bad('it must start with https://');
  if (u.username || u.password) throw bad('it must not hold a user name or password');
  if (!u.hostname.includes('.')) throw bad('the host name looks wrong');
  return u.href;
}

/** '' for an empty value. Otherwise a safe element id (letters, numbers, - and _, starting with a letter). */
export function cleanContainerId(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(text)) throw new Error(`ad-loader.json: nativeBanner.containerId \"${text}\" is not valid: use letters, numbers, - and _ only, starting with a letter (copy it from the Adsterra code, for example container-1a2b3c).`);
  return text;
}

/** The paragraph after which a box goes. Empty means the fallback (3 for the native banner, 5 for AdSense). Otherwise a whole number from 1 to 20. */
export function cleanAfterParagraph(raw: unknown, fallback: number = NATIVE_AFTER_DEFAULT, label = 'nativeBanner.afterParagraph'): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > NATIVE_AFTER_MAX) throw new Error(`ad-loader.json: ${label} \"${String(raw).trim()}\" is not valid: use a whole number from 1 to ${NATIVE_AFTER_MAX}.`);
  return n;
}

/** '' for an empty value. Otherwise the AdSense ad slot number (digits only, copied from the ad unit code: data-ad-slot="..."). */
export function cleanAdsenseSlot(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^\d{6,20}$/.test(text)) throw new Error(`ad-loader.json: adsense.slot \"${text}\" is not valid: use only the digits from data-ad-slot in the AdSense ad unit code, for example 1234567890.`);
  return text;
}

/** v0.28.0: days a consent answer is kept. Empty means 180. Otherwise a whole number from 30 to 365. */
export function cleanConsentDays(raw: unknown): number {
  if (raw === undefined || raw === null || String(raw).trim() === '') return CONSENT_DAYS_DEFAULT;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < CONSENT_DAYS_MIN || n > CONSENT_DAYS_MAX) throw new Error(`ad-loader.json: consentDays \"${String(raw).trim()}\" is not valid: use a whole number from ${CONSENT_DAYS_MIN} to ${CONSENT_DAYS_MAX}, or leave it empty for ${CONSENT_DAYS_DEFAULT}.`);
  return n;
}

/** v0.30.0: the sentence in the consent bar. '' for an empty value (built-in sentence). Otherwise 20 to 300 characters on one line, without < or >. */
export function cleanConsentText(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why: string) => new Error(`ad-loader.json: consentText \"${text.slice(0, 40)}\" is not valid: ${why}.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw bad('use one line without line breaks');
  if (/[<>]/.test(text)) throw bad('do not use < or >');
  if (text.length < CONSENT_TEXT_MIN || text.length > CONSENT_TEXT_MAX) throw bad(`use ${CONSENT_TEXT_MIN} to ${CONSENT_TEXT_MAX} characters, or leave it empty for the built-in sentence`);
  return text;
}

/** v0.31.0: the words on a consent button. '' for an empty value (built-in word). Otherwise 2 to 24 characters on one line, without < or >. */
export function cleanConsentLabel(raw: unknown, name = 'consentAccept'): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why: string) => new Error(`ad-loader.json: ${name} \"${text.slice(0, 40)}\" is not valid: ${why}.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw bad('use one line without line breaks');
  if (/[<>]/.test(text)) throw bad('do not use < or >');
  if (text.length < CONSENT_LABEL_MIN || text.length > CONSENT_LABEL_MAX) throw bad(`use ${CONSENT_LABEL_MIN} to ${CONSENT_LABEL_MAX} characters, or leave it empty for the built-in word`);
  return text;
}

/** The native banner, or null when it is not set. Script and container id must both be filled or both be empty. */
function nativePlan(cfg: AdLoaderConfig): NativeBanner | null {
  const nb = cfg.adsterra?.nativeBanner ?? {};
  const script = cleanHttpsUrl(nb.script, 'adsterra.nativeBanner.script');
  const containerId = cleanContainerId(nb.containerId);
  const afterParagraph = cleanAfterParagraph(nb.afterParagraph);
  if (!script && !containerId) return null;
  if (!script || !containerId) throw new Error('ad-loader.json: the native banner needs both the script address and the container id (both are in the Adsterra code). Fill in both or leave both empty.');
  return { script, containerId, afterParagraph };
}

/** The AdSense unit, or null when no slot is set. A slot needs the publisher id from ads.json (v0.24.0). */
function adsensePlan(cfg: AdLoaderConfig, publisherId: unknown): AdsenseUnit | null {
  const slot = cleanAdsenseSlot(cfg.adsense?.slot);
  const afterParagraph = cleanAfterParagraph(cfg.adsense?.afterParagraph, ADSENSE_AFTER_DEFAULT, 'adsense.afterParagraph');
  if (!slot) return null;
  const pub = cleanPublisherId(publisherId);
  if (!pub) throw new Error('ad-loader.json: an AdSense slot is set but ads.json has no adsensePublisherId. Fill in the AdSense id first (dashboard, Ads screen).');
  return { client: `ca-${pub}`, slot, afterParagraph };
}

/**
 * The plan for the loader, or null when no script may be added.
 * - Compliance mode is ON unless the file says `"complianceMode": false` (BUGS A6: clean pages while AdSense and Google News are applied for).
 * - Scripts without a geo address are refused: ads must never load without the country check (BUGS A1).
 */
export function adLoaderPlan(cfg: AdLoaderConfig = {}, adsensePublisherId?: unknown): AdLoaderPlan | null {
  const geoUrl = cleanHttpsUrl(cfg.geoUrl, 'geoUrl');
  const popunder = cleanHttpsUrl(cfg.adsterra?.popunder, 'adsterra.popunder');
  const socialBar = cleanHttpsUrl(cfg.adsterra?.socialBar, 'adsterra.socialBar');
  const nativeBanner = nativePlan(cfg);
  const smartlink = cleanHttpsUrl(cfg.adsterra?.smartlink, 'adsterra.smartlink');
  const adsense = adsensePlan(cfg, adsensePublisherId);
  const consentDays = cleanConsentDays(cfg.consentDays);
  const consentText = cleanConsentText(cfg.consentText);
  const consentAccept = cleanConsentLabel(cfg.consentAccept, 'consentAccept');
  const consentDecline = cleanConsentLabel(cfg.consentDecline, 'consentDecline');
  const consentChoices = cleanConsentLabel(cfg.consentChoices, 'consentChoices');
  if (nativeBanner && adsense && nativeBanner.afterParagraph === adsense.afterParagraph) throw new Error('ad-loader.json: the native banner and the AdSense unit use the same paragraph number. Give them different numbers so the two boxes are never side by side.');
  if (cfg.complianceMode !== false) return null;
  if (!popunder && !socialBar && !nativeBanner && !smartlink && !adsense) return null;
  if (!geoUrl) throw new Error('ad-loader.json: an ad script is set but geoUrl is empty. Ads never load without the country check. Deploy workers/geo and put its address (for example https://news-geo.yourname.workers.dev/geo) in geoUrl.');
  return { geoUrl, popunder, socialBar, nativeBanner, smartlink, adsense, consentDays, ...(consentText ? { consentText } : {}), ...(consentAccept ? { consentAccept } : {}), ...(consentDecline ? { consentDecline } : {}), ...(consentChoices ? { consentChoices } : {}), timeoutMs: 3000, idleMs: 4000 };
}
