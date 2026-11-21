import map from '../../config/tags.json';

// v0.101.26 (PLAN 33.2, Part 6d): optional search title and description of a tag page, kept by tag slug in config/tags.json.
// Empty or missing = the tag page head falls back to the tag name (listingHead in src/lib/seo.ts).
type Tag = { metaTitle?: string; metaDescription?: string };
const m = map as Record<string, Tag>;

export const tagMetaTitle = (slug: string) => m[slug]?.metaTitle ?? '';
export const tagMetaDescription = (slug: string) => m[slug]?.metaDescription ?? '';
