/** Phase 2: JSON-LD generators (PLAN section 8). Empty values are dropped, never faked. */
import { absUrl } from './seo';
import { langTag, placeLd, type PlaceOut } from './geo-schema';
import siteCfg from '../../config/site.json';

/** v0.70.0: the language of every schema block comes from `config/site.json` locale (en_US gives en-US). */
export const SITE_LANG = langTag((siteCfg as { locale?: string }).locale);

type Obj = Record<string, unknown>;

export function clean<T extends Obj>(o: T): T {
  const out: Obj = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/** Safe to place inside <script type="application/ld+json">. */
export const jsonLdString = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export interface SiteCfg {
  siteName: string;
  description?: string;
  logo?: string;
  sameAs?: string[];
  publisherEmail?: string;
  publisherCountry?: string;
}

export function organization(s: SiteCfg) {
  return clean({
    '@type': 'NewsMediaOrganization',
    '@id': absUrl('/#organization'),
    name: s.siteName,
    url: absUrl('/'),
    logo: s.logo ? { '@type': 'ImageObject', url: absUrl(s.logo) } : undefined,
    sameAs: s.sameAs,
    email: s.publisherEmail,
    areaServed: s.publisherCountry,
  });
}

export function webSite(s: SiteCfg) {
  return {
    '@context': 'https://schema.org',
    ...clean({
      '@type': 'WebSite',
      '@id': absUrl('/#website'),
      name: s.siteName,
      url: absUrl('/'),
      description: s.description,
      inLanguage: SITE_LANG,
      publisher: { '@id': absUrl('/#organization') },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: absUrl('/search/') + '?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    }),
  };
}

export const organizationDoc = (s: SiteCfg) => ({ '@context': 'https://schema.org', ...organization(s) });

export function breadcrumb(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.url) })),
  };
}

export interface ArticleInput {
  type: 'NewsArticle' | 'Article' | 'BlogPosting';
  title: string;
  url: string;
  description: string;
  image?: string;
  published: Date;
  modified: Date;
  authorName: string;
  authorUrl: string;
  section: string;
  keywords: string[];
  wordCount: number;
  /** Places found by `detectLocations` (v0.70.0). Empty means none was found, and nothing is written. */
  locations?: PlaceOut[];
  /** The place named in the dateline at the start of the text, if any. */
  createdAt?: PlaceOut;
}

export function article(a: ArticleInput, s: SiteCfg) {
  return {
    '@context': 'https://schema.org',
    ...clean({
      '@type': a.type,
      headline: a.title.slice(0, 110),
      description: a.description,
      image: a.image ? [absUrl(a.image)] : undefined,
      datePublished: a.published.toISOString(),
      dateModified: a.modified.toISOString(),
      author: [{ '@type': 'Person', name: a.authorName, url: absUrl(a.authorUrl) }],
      publisher: clean({
        '@type': 'NewsMediaOrganization',
        name: s.siteName,
        logo: s.logo ? { '@type': 'ImageObject', url: absUrl(s.logo) } : undefined,
      }),
      mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(a.url) },
      articleSection: a.section,
      keywords: a.keywords.join(', '),
      wordCount: a.wordCount,
      inLanguage: SITE_LANG,
      contentLocation: a.locations && a.locations.length ? (a.locations.length === 1 ? placeLd(a.locations[0]) : a.locations.map(placeLd)) : undefined,
      locationCreated: a.createdAt ? placeLd(a.createdAt) : undefined,
    }),
  };
}

export function collectionPage(name: string, url: string, description: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    ...clean({
      '@type': 'CollectionPage',
      name,
      url: absUrl(url),
      description,
      inLanguage: SITE_LANG,
      mainEntity: items.length
        ? {
            '@type': 'ItemList',
            itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(it.url), name: it.name })),
          }
        : undefined,
    }),
  };
}

export function profilePage(name: string, url: string, bio: string, links: string[], photo?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: clean({ '@type': 'Person', name, url: absUrl(url), description: bio, image: photo ? absUrl(photo) : undefined, sameAs: links }),
  };
}

export function simplePage(kind: 'WebPage' | 'AboutPage' | 'ContactPage', name: string, url: string, description: string) {
  return { '@context': 'https://schema.org', ...clean({ '@type': kind, name, url: absUrl(url), description, inLanguage: SITE_LANG }) };
}

/** About and Contact pages get their own schema types (PLAN section 8). */
export const pageKind = (permalink: string): 'WebPage' | 'AboutPage' | 'ContactPage' =>
  /^about(-us)?$/.test(permalink) ? 'AboutPage' : /^contact(-us)?$/.test(permalink) ? 'ContactPage' : 'WebPage';
