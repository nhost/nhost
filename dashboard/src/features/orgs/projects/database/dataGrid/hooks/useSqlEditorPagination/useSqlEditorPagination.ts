import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface UseSQLPaginationOptions<TRow> {
  /**
   * Rows returned by the SQL query. The hook slices this array client-side.
   */
  rows: TRow[];
  /**
   * Initial page size. Defaults to 100.
   */
  initialLimit?: PageSize;
  /**
   * When this key changes the hook resets to page 1.
   * Pass the current query string or a run-counter so a new query always
   * starts at the top.
   */
  resetKey?: unknown;
}

export interface UseSQLPaginationResult<TRow> {
  currentPage: number;
  limit: PageSize;
  totalNrOfPages: number;
  paginatedRows: TRow[];
  setCurrentPage: (page: number) => void;
  setLimitAndReset: (newLimit: PageSize) => void;
  handleLimitChange: (_: SyntheticEvent | null, value: {} | null) => void;
  goPrev: () => void;
  goNext: () => void;
  hasNoPreviousPage: boolean;
  hasNoNextPage: boolean;
}

export default function useSQLEditorPagination<TRow>({
  rows,
  initialLimit = 100,
  resetKey,
}: UseSQLPaginationOptions<TRow>): UseSQLPaginationResult<TRow> {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(initialLimit);

  const totalNrOfPages = Math.max(1, Math.ceil(rows.length / limit));

  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * limit, currentPage * limit),
    [rows, currentPage, limit],
  );

  const setLimitAndReset = useCallback((newLimit: PageSize) => {
    setLimit(newLimit);
    setCurrentPage(1);
  }, []);

  const handleLimitChange = useCallback(
    (_: SyntheticEvent | null, value: {} | null) => {
      const pageSize = value as PageSize | null;
      if (pageSize) {
        setLimitAndReset(pageSize);
      }
    },
    [setLimitAndReset],
  );

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalNrOfPages, p + 1));
  }, [totalNrOfPages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset when key changes
  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  return {
    currentPage,
    limit,
    totalNrOfPages,
    paginatedRows,
    setCurrentPage,
    setLimitAndReset,
    handleLimitChange,
    goPrev,
    goNext,
    hasNoPreviousPage: currentPage <= 1,
    hasNoNextPage: currentPage >= totalNrOfPages,
  };
}