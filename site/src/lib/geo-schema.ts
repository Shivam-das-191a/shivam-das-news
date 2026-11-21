/** v0.70.0: auto language and auto location for the JSON-LD of every post (PLAN 36, LOGICS 24). Pure, unit tested. */

export type PlaceType = 'Country' | 'City' | 'State' | 'Place';
export interface GazetteerEntry { name: string; type?: PlaceType; country?: string; aliases?: string[] }
export interface PlaceOut { type: PlaceType; name: string; country?: string }
export interface GeoResult { contentLocation: PlaceOut[]; locationCreated?: PlaceOut; source: 'manual' | 'dateline' | 'text' | 'none' }

/** "en_US" becomes "en-US". Anything unusable becomes "en" (English only site, PLAN 3.1). */
export function langTag(locale?: string): string {
  const m = /^([a-z]{2,3})(?:[_-]([A-Za-z]{2}))?$/.exec((locale ?? '').trim());
  return m ? (m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1]) : 'en';
}

const NOT_COUNTRIES = new Set(['ZZ', 'EU', 'UN', 'EZ', 'QO', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA']);
const ALIASES: Record<string, string> = {
  USA: 'US', 'U.S.': 'US', America: 'US', UK: 'GB', Britain: 'GB', 'Great Britain': 'GB', UAE: 'AE', Turkey: 'TR', 'T\u00fcrkiye': 'TR', Burma: 'MM', Holland: 'NL',
};
/** Names that are also people or common words: they count only when the post lists them as a tag or in the front matter. */
const AMBIGUOUS = new Set(['Georgia', 'Jordan', 'Chad', 'Turkey', 'Niger', 'Guinea', 'Mali', 'Nauru']);

let countryCache: { byName: Map<string, string>; names: Map<string, string> } | null = null;
/** All countries from the runtime's own ICU data (no list to maintain). */
export function countries() {
  if (countryCache) return countryCache;
  const byName = new Map<string, string>(); // name or alias to code
  const names = new Map<string, string>(); // code to display name
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { dn = null; }
  if (dn) {
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      let n: string | undefined;
      try { n = dn.of(code); } catch { n = undefined; }
      if (!n || n === code || /unknown|region/i.test(n)) continue;
      byName.set(n, code); names.set(code, n);
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) if (names.has(code)) byName.set(alias, code);
  return (countryCache = { byName, names });
}

const L = '[\\p{L}\\p{N}]';
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (name: string) => new RegExp(`(?<!${L})${escRe(name)}(?!${L})`, 'gu');
const count = (text: string, name: string) => (text.match(wordRe(name)) ?? []).length;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s.'\u2019-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()).trim();

interface Cand { name: string; type: PlaceType; country?: string; terms: string[] }

function candidates(gaz: GazetteerEntry[]): Cand[] {
  const out: Cand[] = [];
  const { byName, names } = countries();
  const seen = new Set<string>();
  for (const g of gaz ?? []) {
    if (!g || typeof g.name !== 'string' || !g.name.trim()) continue;
    const type: PlaceType = g.type === 'City' || g.type === 'State' || g.type === 'Country' ? g.type : 'Place';
    const cc = typeof g.country === 'string' && /^[A-Za-z]{2}$/.test(g.country) ? g.country.toUpperCase() : undefined;
    const terms = [g.name.trim(), ...((g.aliases ?? []).filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()))];
    out.push({ name: g.name.trim(), type, country: cc, terms });
    seen.add(g.name.trim().toLowerCase());
  }
  const byCode = new Map<string, string[]>();
  for (const [n, code] of byName) byCode.set(code, [...(byCode.get(code) ?? []), n]);
  for (const [code, n] of names) {
    if (seen.has(n.toLowerCase())) continue;
    const terms = byCode.get(code) ?? [n];
    out.push({ name: n, type: 'Country', country: code, terms });
  }
  return out;
}

/** Looks a typed name up in the owner list and the countries; unknown names stay a plain Place. */
function resolveName(raw: string, cands: Cand[]): PlaceOut {
  const n = raw.trim();
  const hit = cands.find((c) => c.terms.some((t) => t.toLowerCase() === n.toLowerCase()));
  return hit ? { type: hit.type, name: hit.name, country: hit.country } : { type: 'Place', name: n };
}

/** "KOLKATA, India (Reuters) \u2014 Text" at the very start of the body. Only a long dash counts, so a shouted headline is never a dateline. */
export function parseDateline(body: string): string | undefined {
  const first = (body ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim());
  if (!first) return undefined;
  const line = first.replace(/^[#>*_\s]+/, '').replace(/\*\*|__/g, '');
  const m = /^([A-Z][A-Z .'\u2019-]{1,40}?)(?:,\s*[A-Za-z][A-Za-z0-9 .'\u2019-]{1,30}?)?\s*(?:\([^)]{0,40}\)\s*)?(?:\u2014|\u2013|--)\s/.exec(line);
  if (!m) return undefined;
  const city = titleCase(m[1]);
  return /^[A-Za-z]/.test(city) && !/^(Breaking|Update|Exclusive|Live|Watch|Opinion|Analysis)$/i.test(city) ? city : undefined;
}

export interface GeoInput { title: string; tags: string[]; body: string; location?: string[] }

const FIRST_WORDS = 300;

export function detectLocations(inp: GeoInput, gaz: GazetteerEntry[] = []): GeoResult {
  const cands = candidates(gaz);
  const manual = (inp.location ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (manual.length === 1 && manual[0].toLowerCase() === 'none') return { contentLocation: [], source: 'none' };
  const dl = parseDateline(inp.body);
  const created = dl ? resolveName(dl, cands) : undefined;
  if (manual.length) return { contentLocation: dedupe(manual.slice(0, 3).map((m) => resolveName(m, cands))), locationCreated: created, source: 'manual' };

  const head = (inp.body ?? '').split(/\s+/).slice(0, FIRST_WORDS).join(' ');
  const scored: { c: Cand; score: number }[] = [];
  for (const c of cands) {
    let score = 0;
    for (const t of c.terms) {
      const tags = inp.tags.filter((x) => x.trim().toLowerCase() === t.toLowerCase()).length;
      if (AMBIGUOUS.has(t)) { score += tags * 3; continue; }
      score += (count(inp.title, t) > 0 ? 3 : 0) + tags * 2 + Math.min(count(head, t), 3);
    }
    if (created && created.name.toLowerCase() === c.name.toLowerCase()) score += 3;
    if (score >= 3) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  const picked = scored.slice(0, 3).map((s) => ({ type: s.c.type, name: s.c.name, country: s.c.country }) as PlaceOut);
  if (created && !picked.some((p) => p.name.toLowerCase() === created.name.toLowerCase())) picked.unshift(created);
  const final = dedupe(picked).slice(0, 3);
  return { contentLocation: final, locationCreated: created, source: final.length ? (created && !scored.length ? 'dateline' : 'text') : 'none' };
}

function dedupe(list: PlaceOut[]): PlaceOut[] {
  const seen = new Set<string>();
  return list.filter((p) => (seen.has(p.name.toLowerCase()) ? false : (seen.add(p.name.toLowerCase()), true)));
}

/** One place as JSON-LD. A city or state with a known country gets a postal address so the country is stated too. */
export function placeLd(p: PlaceOut): Record<string, unknown> {
  const countryName = p.country ? countries().names.get(p.country) : undefined;
  if (p.type === 'Country') return { '@type': 'Country', name: p.name };
  const type = p.type === 'State' ? 'AdministrativeArea' : p.type === 'City' ? 'City' : 'Place';
  const o: Record<string, unknown> = { '@type': type, name: p.name };
  if (countryName) o.address = { '@type': 'PostalAddress', addressCountry: p.country };
  return o;
}
