/** Phase 2: XML builders for sitemaps and the news sitemap (LOGICS 8, BUGS S3-S5). Pure functions. */
import { xmlEscape } from './seo';

export interface UrlEntry { loc: string; lastmod?: Date; images?: string[] }
export interface NewsEntry { loc: string; title: string; published: Date }

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

export function urlset(entries: UrlEntry[]): string {
  const hasImages = entries.some((e) => e.images?.length);
  const ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' + (hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '');
  const body = entries
    .map((e) => {
      const imgs = (e.images ?? []).map((i) => `<image:image><image:loc>${xmlEscape(i)}</image:loc></image:image>`).join('');
      return `<url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}${imgs}</url>`;
    })
    .join('\n');
  return `${XML}<urlset ${ns}>\n${body}\n</urlset>\n`;
}

export function sitemapIndex(items: { loc: string; lastmod?: Date }[]): string {
  const body = items.map((i) => `<sitemap><loc>${xmlEscape(i.loc)}</loc>${i.lastmod ? `<lastmod>${i.lastmod.toISOString()}</lastmod>` : ''}</sitemap>`).join('\n');
  return `${XML}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** Only posts younger than maxAgeHours, newest first, capped at 1000. */
export function newsFilter<T extends { published: Date }>(items: T[], now: Date, maxAgeHours = 48): T[] {
  const limit = now.getTime() - maxAgeHours * 3_600_000;
  return items
    .filter((i) => i.published.getTime() >= limit && i.published.getTime() <= now.getTime())
    .sort((a, b) => b.published.getTime() - a.published.getTime())
    .slice(0, 1000);
}

export function newsUrlset(entries: NewsEntry[], publication: string): string {
  const body = entries
    .map(
      (e) =>
        `<url><loc>${xmlEscape(e.loc)}</loc><news:news><news:publication><news:name>${xmlEscape(publication)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${e.published.toISOString()}</news:publication_date><news:title>${xmlEscape(e.title)}</news:title></news:news></url>`,
    )
    .join('\n');
  return `${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>\n`;
}
