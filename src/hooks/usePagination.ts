import { useEffect, useMemo, useState } from 'react';

export const ADMIN_PAGE_SIZE = 6;

export function usePagination<T>(items: T[], pageSize = ADMIN_PAGE_SIZE, resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, resetDeps);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    items: paginatedItems,
    page,
    setPage,
    totalPages,
    total,
    pageSize,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}
