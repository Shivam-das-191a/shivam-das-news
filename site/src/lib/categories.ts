import map from '../../config/categories.json';

type Cat = { name?: string; description?: string; metaTitle?: string; metaDescription?: string };
const m = map as Record<string, Cat>;

export const catName = (slug: string) =>
  m[slug]?.name ?? slug.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
export const catDescription = (slug: string) => m[slug]?.description ?? '';
export const catMetaTitle = (slug: string) => m[slug]?.metaTitle ?? '';
export const catMetaDescription = (slug: string) => m[slug]?.metaDescription ?? '';
