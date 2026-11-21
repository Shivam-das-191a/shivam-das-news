/**
 * Picture details on the public site (PLAN 33.3, Phase 3b Part 7c, v0.101.29). Pure: no file reading here.
 * `config/media.json` keeps alt text, caption and credit per file path (Part 7a); the Files screen writes it (Part 7b).
 * The post's own value always wins (PLAN 33.3): imageAlt for the alt text, imageCredit for the credit.
 */
export type MediaEntry = { alt?: string; caption?: string; credit?: string };
export type MediaMap = Record<string, MediaEntry>;

const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim();

/** The key of a picture in config/media.json: its path under /media/ without a query or hash. Empty for any other address. */
export function mediaKey(src?: string): string {
  const s = String(src ?? '').split(/[?#]/)[0];
  return s.startsWith('/media/') && !s.includes('..') ? s : '';
}

/** The stored details of one picture, cleaned. Only alt, caption and credit are read; any other key is ignored. */
export function mediaEntry(map: unknown, src?: string): MediaEntry {
  const key = mediaKey(src);
  if (!key || !map || typeof map !== 'object' || Array.isArray(map)) return {};
  if (!Object.prototype.hasOwnProperty.call(map, key)) return {};
  const raw = (map as Record<string, unknown>)[key];
  if (!raw || typeof raw !== 'object') return {};
  const e = raw as Record<string, unknown>;
  const out: MediaEntry = {};
  for (const k of ['alt', 'caption', 'credit'] as const) {
    const v = typeof e[k] === 'string' ? clean(e[k]) : '';
    if (v) out[k] = v;
  }
  return out;
}

/** Alt text of a picture: the post's imageAlt, then the stored alt, then an empty string. */
export function pictureAlt(map: unknown, src: string | undefined, postAlt?: string): string {
  return clean(postAlt) || mediaEntry(map, src).alt || '';
}

/** Caption and credit of a picture: the credit is the post's imageCredit when it is filled, else the stored credit. */
export function pictureCaption(map: unknown, src: string | undefined, postCredit?: string): { caption: string; credit: string } {
  const e = mediaEntry(map, src);
  return { caption: e.caption || '', credit: clean(postCredit) || e.credit || '' };
}
