import { getCollection } from 'astro:content';

export async function authorNameMap() {
  const authors = await getCollection('authors');
  return new Map(authors.map((a) => [a.id, a.data.name]));
}
