/** Phase 2: RSS 2.0 builder. */
import { xmlEscape } from './seo';

export interface FeedItem { title: string; link: string; description: string; published: Date; category: string; author: string }

export function rss(opts: { title: string; link: string; self: string; description: string; items: FeedItem[]; now: Date }): string {
  const items = opts.items
    .map(
      (i) =>
        `<item><title>${xmlEscape(i.title)}</title><link>${xmlEscape(i.link)}</link><guid isPermaLink="true">${xmlEscape(i.link)}</guid><pubDate>${i.published.toUTCString()}</pubDate><dc:creator>${xmlEscape(i.author)}</dc:creator><category>${xmlEscape(i.category)}</category><description>${xmlEscape(i.description)}</description></item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n<channel>\n<title>${xmlEscape(opts.title)}</title>\n<link>${xmlEscape(opts.link)}</link>\n<description>${xmlEscape(opts.description || opts.title)}</description>\n<language>en</language>\n<lastBuildDate>${opts.now.toUTCString()}</lastBuildDate>\n<atom:link href="${xmlEscape(opts.self)}" rel="self" type="application/rss+xml"/>\n${items}\n</channel>\n</rss>\n`;
}
