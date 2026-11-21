/** LOGICS.md 11: /x/, /x/page/2/ ... */
export function paginate<T>(items: T[], perPage: number) {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: total }, (_, i) => ({
    page: i + 1,
    total,
    items: items.slice(i * perPage, (i + 1) * perPage),
  }));
}

export const pageSuffix = (n: number) => (n === 1 ? '' : `page/${n}/`);
export const restParam = (n: number) => (n === 1 ? undefined : `page/${n}`);
