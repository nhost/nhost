import type { SyntheticEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface UseSQLPaginationOptions<TRow> {
  /**
   * Rows returned by the SQL query. The hook slices this array client-side.
   * A new array reference is treated as a new query result and resets the view
   * to the first page, so pass a referentially stable value between runs.
   */
  rows: TRow[];
  /**
   * Initial page size. Defaults to 100.
   */
  initialLimit?: PageSize;
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
}: UseSQLPaginationOptions<TRow>): UseSQLPaginationResult<TRow> {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState<PageSize>(initialLimit);
  const [prevRows, setPrevRows] = useState(rows);

  // Each query run yields a fresh `rows` reference. Restart at the first page
  // so the page you were on for a previous result never carries over.
  if (rows !== prevRows) {
    setPrevRows(rows);
    setCurrentPage(1);
  }

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
