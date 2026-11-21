// v0.21.0 (native banner added in v0.22.0, smartlink in v0.23.0, AdSense unit in v0.24.0, consent days in v0.28.0, consent text in v0.30.0): helpers for the Ad loader screen (config/ad-loader.json, PLAN 13.2, 13.3; BUGS A1, A6, A7).
// Same rules as src/lib/ad-loader.ts (a test runs both on the same inputs, so they cannot drift apart). Pure, no DOM.
import { cleanPublisherId } from './ads-config.js';

/** '' for an empty value. Otherwise a clean https address, or an error with a plain message. */
export function cleanHttpsUrl(raw, label) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why) => new Error(`The ${label} "${text}" is not valid: ${why}.`);
  if (/[\s"'<>\\]/.test(text)) throw bad('it has spaces or unsafe characters');
  let u;
  try { u = new URL(text); } catch { throw bad('it is not a web address'); }
  if (u.protocol !== 'https:') throw bad('it must start with https://');
  if (u.username || u.password) throw bad('it must not hold a user name or password');
  if (!u.hostname.includes('.')) throw bad('the host name looks wrong');
  return u.href;
}

const NATIVE_AFTER_DEFAULT = 3;
const NATIVE_AFTER_MAX = 20;
const ADSENSE_AFTER_DEFAULT = 5;
const CONSENT_DAYS_DEFAULT = 180;
const CONSENT_DAYS_MIN = 30;
const CONSENT_DAYS_MAX = 365;
const CONSENT_TEXT_MIN = 20;
const CONSENT_TEXT_MAX = 300;
const CONSENT_LABEL_MIN = 2;
const CONSENT_LABEL_MAX = 24;

/** '' for an empty value. Otherwise a safe element id (letters, numbers, - and _, starting with a letter). */
export function cleanContainerId(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(text)) throw new Error(`The native banner container id "${text}" is not valid: use letters, numbers, - and _ only, starting with a letter (copy it from the Adsterra code, for example container-1a2b3c).`);
  return text;
}

/** The paragraph after which a box goes. Empty means the fallback (3 for the native banner, 5 for AdSense). Otherwise a whole number from 1 to 20. */
export function cleanAfterParagraph(raw, fallback = NATIVE_AFTER_DEFAULT) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1 || n > NATIVE_AFTER_MAX) throw new Error(`The paragraph number "${String(raw).trim()}" is not valid: use a whole number from 1 to ${NATIVE_AFTER_MAX}.`);
  return n;
}

/** '' for an empty value. Otherwise the AdSense ad slot number (digits only, from data-ad-slot in the ad unit code). */
export function cleanAdsenseSlot(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^\d{6,20}$/.test(text)) throw new Error(`The AdSense slot "${text}" is not valid: use only the digits from data-ad-slot in the AdSense ad unit code, for example 1234567890.`);
  return text;
}

/** Days a consent answer is kept. Empty means 180. Otherwise a whole number from 30 to 365. */
export function cleanConsentDays(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return CONSENT_DAYS_DEFAULT;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < CONSENT_DAYS_MIN || n > CONSENT_DAYS_MAX) throw new Error(`The number of days "${String(raw).trim()}" is not valid: use a whole number from ${CONSENT_DAYS_MIN} to ${CONSENT_DAYS_MAX}, or leave it empty for ${CONSENT_DAYS_DEFAULT}.`);
  return n;
}

/** The sentence in the consent bar. '' for an empty value (built-in sentence). Otherwise 20 to 300 characters on one line, without < or >. */
export function cleanConsentText(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why) => new Error(`The consent bar text "${text.slice(0, 40)}" is not valid: ${why}.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw bad('use one line without line breaks');
  if (/[<>]/.test(text)) throw bad('do not use < or >');
  if (text.length < CONSENT_TEXT_MIN || text.length > CONSENT_TEXT_MAX) throw bad(`use ${CONSENT_TEXT_MIN} to ${CONSENT_TEXT_MAX} characters, or leave it empty for the built-in sentence`);
  return text;
}

/** The words on a consent button. '' for an empty value (built-in word). Otherwise 2 to 24 characters on one line, without < or >. */
export function cleanConsentLabel(raw, name = 'consentAccept') {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const bad = (why) => new Error(`The consent button word "${text.slice(0, 40)}" is not valid: ${why}.`);
  if (/[\u0000-\u001f\u007f]/.test(text)) throw bad('use one line without line breaks');
  if (/[<>]/.test(text)) throw bad('do not use < or >');
  if (text.length < CONSENT_LABEL_MIN || text.length > CONSENT_LABEL_MAX) throw bad(`use ${CONSENT_LABEL_MIN} to ${CONSENT_LABEL_MAX} characters, or leave it empty for the built-in word`);
  return text;
}

function nativePlan(cfg) {
  const nb = cfg.adsterra?.nativeBanner ?? {};
  const script = cleanHttpsUrl(nb.script, 'native banner script address');
  const containerId = cleanContainerId(nb.containerId);
  const afterParagraph = cleanAfterParagraph(nb.afterParagraph);
  if (!script && !containerId) return null;
  if (!script || !containerId) throw new Error('The native banner needs both the script address and the container id (both are in the Adsterra code). Fill in both or leave both empty.');
  return { script, containerId, afterParagraph };
}

function adsensePlan(cfg, publisherId) {
  const slot = cleanAdsenseSlot(cfg.adsense?.slot);
  const afterParagraph = cleanAfterParagraph(cfg.adsense?.afterParagraph, ADSENSE_AFTER_DEFAULT);
  if (!slot) return null;
  const pub = cleanPublisherId(publisherId);
  if (!pub) throw new Error('An AdSense slot is filled in but there is no AdSense id yet. Fill in the AdSense id first (Ads screen).');
  return { client: `ca-${pub}`, slot, afterParagraph };
}

/** The plan the build makes from the file (and the AdSense id from ads.json), or null when no script may be added. Throws for a bad value. */
export function adLoaderPlan(cfg = {}, adsensePublisherId) {
  const geoUrl = cleanHttpsUrl(cfg.geoUrl, 'geo address');
  const popunder = cleanHttpsUrl(cfg.adsterra?.popunder, 'popunder script address');
  const socialBar = cleanHttpsUrl(cfg.adsterra?.socialBar, 'social bar script address');
  const nativeBanner = nativePlan(cfg);
  const smartlink = cleanHttpsUrl(cfg.adsterra?.smartlink, 'smartlink address');
  const adsense = adsensePlan(cfg, adsensePublisherId);
  const consentDays = cleanConsentDays(cfg.consentDays);
  const consentText = cleanConsentText(cfg.consentText);
  const consentAccept = cleanConsentLabel(cfg.consentAccept, 'consentAccept');
  const consentDecline = cleanConsentLabel(cfg.consentDecline, 'consentDecline');
  const consentChoices = cleanConsentLabel(cfg.consentChoices, 'consentChoices');
  if (nativeBanner && adsense && nativeBanner.afterParagraph === adsense.afterParagraph) throw new Error('The native banner and the AdSense unit use the same paragraph number. Give them different numbers so the two boxes are never side by side.');
  if (cfg.complianceMode !== false) return null;
  if (!popunder && !socialBar && !nativeBanner && !smartlink && !adsense) return null;
  if (!geoUrl) throw new Error('A script address is filled in but the geo address is empty. Ads never load without the country check. Deploy workers/geo and put its address (for example https://news-geo.yourname.workers.dev/geo) in the geo address.');
  return { geoUrl, popunder, socialBar, nativeBanner, smartlink, adsense, consentDays, ...(consentText ? { consentText } : {}), ...(consentAccept ? { consentAccept } : {}), ...(consentDecline ? { consentDecline } : {}), ...(consentChoices ? { consentChoices } : {}), timeoutMs: 3000, idleMs: 4000 };
}

const EMPTY = () => ({ complianceMode: true, geoUrl: '', adsterra: { popunder: '', socialBar: '', smartlink: '', nativeBanner: { script: '', containerId: '', afterParagraph: NATIVE_AFTER_DEFAULT } }, adsense: { slot: '', afterParagraph: ADSENSE_AFTER_DEFAULT }, consentDays: CONSENT_DAYS_DEFAULT });
const str = (v) => (typeof v === 'string' ? v : '');

/** Reads the file text. A broken file gives the safe default (compliance mode ON, everything empty). */
export function readLoader(text) {
  let j;
  try { j = JSON.parse(text); } catch { return EMPTY(); }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return EMPTY();
  const a = j.adsterra && typeof j.adsterra === 'object' && !Array.isArray(j.adsterra) ? j.adsterra : {};
  const n = a.nativeBanner && typeof a.nativeBanner === 'object' && !Array.isArray(a.nativeBanner) ? a.nativeBanner : {};
  const after = Number.isInteger(n.afterParagraph) && n.afterParagraph >= 1 && n.afterParagraph <= NATIVE_AFTER_MAX ? n.afterParagraph : NATIVE_AFTER_DEFAULT;
  const as = j.adsense && typeof j.adsense === 'object' && !Array.isArray(j.adsense) ? j.adsense : {};
  const asAfter = Number.isInteger(as.afterParagraph) && as.afterParagraph >= 1 && as.afterParagraph <= NATIVE_AFTER_MAX ? as.afterParagraph : ADSENSE_AFTER_DEFAULT;
  const days = Number.isInteger(j.consentDays) && j.consentDays >= CONSENT_DAYS_MIN && j.consentDays <= CONSENT_DAYS_MAX ? j.consentDays : CONSENT_DAYS_DEFAULT;
  let txt = '';
  try { txt = cleanConsentText(j.consentText); } catch { txt = ''; }
  const lab = (v) => { try { return cleanConsentLabel(v); } catch { return ''; } };
  const labels = { consentAccept: lab(j.consentAccept), consentDecline: lab(j.consentDecline), consentChoices: lab(j.consentChoices) };
  return { complianceMode: j.complianceMode !== false, geoUrl: str(j.geoUrl), adsterra: { popunder: str(a.popunder), socialBar: str(a.socialBar), smartlink: str(a.smartlink), nativeBanner: { script: str(n.script), containerId: str(n.containerId), afterParagraph: after } }, adsense: { slot: str(as.slot), afterParagraph: asAfter }, consentDays: days, ...(txt ? { consentText: txt } : {}), ...Object.fromEntries(Object.entries(labels).filter(([, x]) => x)) };
}

/** The checked config from the form values. Throws a plain message for a bad value. */
export function configFromForm(v, publisherId) {
  const cfg = {
    complianceMode: v.complianceMode !== false,
    geoUrl: cleanHttpsUrl(v.geoUrl, 'geo address'),
    adsterra: {
      popunder: cleanHttpsUrl(v.popunder, 'popunder script address'),
      socialBar: cleanHttpsUrl(v.socialBar, 'social bar script address'),
      smartlink: cleanHttpsUrl(v.smartlink, 'smartlink address'),
      nativeBanner: { script: cleanHttpsUrl(v.nativeScript, 'native banner script address'), containerId: cleanContainerId(v.nativeContainer), afterParagraph: cleanAfterParagraph(v.nativeAfter) },
    },
    adsense: { slot: cleanAdsenseSlot(v.adsenseSlot), afterParagraph: cleanAfterParagraph(v.adsenseAfter, ADSENSE_AFTER_DEFAULT) },
    consentDays: cleanConsentDays(v.consentDays),
    ...(cleanConsentText(v.consentText) ? { consentText: cleanConsentText(v.consentText) } : {}),
    ...(cleanConsentLabel(v.consentAccept, 'consentAccept') ? { consentAccept: cleanConsentLabel(v.consentAccept) } : {}),
    ...(cleanConsentLabel(v.consentDecline, 'consentDecline') ? { consentDecline: cleanConsentLabel(v.consentDecline) } : {}),
    ...(cleanConsentLabel(v.consentChoices, 'consentChoices') ? { consentChoices: cleanConsentLabel(v.consentChoices) } : {}),
  };
  adLoaderPlan(cfg, publisherId);
  return cfg;
}

/** One plain sentence about what the saved file would do. */
export function describePlan(cfg, publisherId) {
  const plan = adLoaderPlan(cfg, publisherId);
  if (cfg.complianceMode !== false) return 'OFF: compliance mode is on. No ad script is added to any page.';
  if (!plan) return 'OFF: no script address is filled in, so nothing is added.';
  const formats = [plan.socialBar ? 'social bar' : '', plan.nativeBanner ? `native banner (after paragraph ${plan.nativeBanner.afterParagraph}, only if the reader has not scrolled past it)` : '', plan.adsense ? `AdSense unit (after paragraph ${plan.adsense.afterParagraph}, only if the reader has not scrolled past it)` : '', plan.smartlink ? 'smartlink (opens one time when a reader clicks a picture in the article)' : '', plan.popunder ? 'popunder (from the 2nd article view of a session)' : ''].filter(Boolean).join(' and ');
  return `ON for article pages only: ${formats}. Only visitors from a country the geo Worker allows get it (India is off). Readers from the EU, EEA, UK and Switzerland must click Accept first; their answer is kept ${plan.consentDays} days${plan.consentText ? ' and the bar shows your own text' : ''}${plan.consentAccept || plan.consentDecline || plan.consentChoices ? ' and your own button words' : ''}. Any error means no ads.`;
}

export const writeLoader = (cfg) => JSON.stringify(cfg, null, 2) + '\n';
