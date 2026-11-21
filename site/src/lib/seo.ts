/** Phase 2: small SEO helpers (pure, unit tested). */
const RAW = (import.meta as any).env?.SITE || 'http://localhost:4321';
export const SITE_ORIGIN: string = String(RAW).replace(/\/+$/, '');

/** Absolute URL for a site path or an already absolute URL. */
export function absUrl(pathOrUrl: string, origin: string = SITE_ORIGIN): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return origin + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
}

/** Cut text at a word boundary, add an ellipsis only when cut. */
export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(' ');
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,.;:-]+$/, '') + '\u2026';
}

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const iso = (d: Date) => d.toISOString();

/**
 * Share card values (Open Graph and Twitter), v0.101.21. Empty fields fall back: ogTitle to the page title,
 * ogDescription to the description, ogImage to the featured image. The dashboard uses the same rule
 * (`shareCard` in public/admin/js/listing.js; tests/unit/share.test.ts keeps the two in sync).
 * `imageAlt` is the featured picture's alt text, and only when the share picture is that same picture.
 */
export function shareValues(p: { title: string; description?: string; image?: string; imageAlt?: string; ogTitle?: string; ogDescription?: string; ogImage?: string }) {
  const c = (s?: string) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const image = c(p.ogImage) || c(p.image);
  const sameAsFeatured = !c(p.ogImage) || c(p.ogImage) === c(p.image);
  return {
    title: c(p.ogTitle) || c(p.title),
    description: c(p.ogDescription) || c(p.description),
    image,
    imageAlt: sameAsFeatured ? c(p.imageAlt) : '',
  };
}

/**
 * Head values of a listing page (category, author), v0.101.23. An empty metaTitle falls back to the page title,
 * an empty metaDescription to the visible description. A page number is added after page 1, as before.
 * The dashboard rule `entryErrors` (public/admin/js/listing.js) uses the same limits.
 */
export function listingHead(p: { title: string; description?: string; metaTitle?: string; metaDescription?: string; page?: number }) {
  const c = (s?: string) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const base = c(p.metaTitle) || c(p.title);
  return {
    title: p.page && p.page > 1 ? `${base} - Page ${p.page}` : base,
    description: c(p.metaDescription) || c(p.description),
  };
}

/**
 * Head values of the home page, v0.101.25. `homeTitle` (config/site.json, optional) is the whole title as typed;
 * empty means "site name - tagline" (or the site name alone). The description is `description` of the site settings.
 * The dashboard rule `entryListing` (public/admin/js/listing.js) shows the same values.
 */
export function homeHead(site: { siteName: string; tagline?: string; description?: string; homeTitle?: string }) {
  const c = (s?: string) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const name = c(site.siteName);
  const tag = c(site.tagline);
  return {
    fullTitle: c(site.homeTitle) || (tag ? `${name} - ${tag}` : name),
    description: c(site.description),
  };
}
