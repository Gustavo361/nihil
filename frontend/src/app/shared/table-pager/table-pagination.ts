export const TABLE_PAGE_SIZE = 20;

export function pageItems<T>(items: readonly T[], page: number, pageSize = TABLE_PAGE_SIZE): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
