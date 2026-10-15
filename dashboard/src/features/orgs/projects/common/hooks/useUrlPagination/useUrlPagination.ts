import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';

/**
 * Parse the `page` query param into a 1-based page number. Missing, non-numeric
 * or out-of-range-low values fall back to page 1.
 */
export function getPageNumberFromQuery(
  page: string | string[] | undefined,
): number {
  return Math.max(parseInt(page as string, 10) || 1, 1);
}

export interface UseUrlPaginationOptions {
  /**
   * 1-based current page. Derive it from the URL with `getPageNumberFromQuery`
   * so the same value drives the query offset and the pagination controls.
   */
  currentPage: number;
  /**
   * Number of rows per page.
   */
  elementsPerPage: number;
  /**
   * Total number of rows across all pages (the query's aggregate count).
   */
  totalNrOfElements: number;
  /**
   * Whether the underlying data is still loading. Guards the out-of-range
   * clamp so it never fires against a stale count mid-fetch.
   */
  loading?: boolean;
}

export interface UseUrlPaginationResult {
  /**
   * Total number of pages (always at least 1).
   */
  nrOfPages: number;
  /**
   * Navigate to a specific 1-based page.
   */
  goToPage: (page: number) => void;
  /**
   * Navigate to the next page.
   */
  goToNextPage: () => void;
  /**
   * Navigate to the previous page.
   */
  goToPreviousPage: () => void;
}

/**
 * URL-backed pagination controls. The `page` query param is the single source
 * of truth: the caller derives `currentPage` from it, navigation only writes
 * the URL, and the page re-renders from the new param. Page 1 is represented by
 * the absence of the param so the URL stays clean.
 */
export default function useUrlPagination({
  currentPage,
  elementsPerPage,
  totalNrOfElements,
  loading = false,
}: UseUrlPaginationOptions): UseUrlPaginationResult {
  // Stable across renders, so `goToPage` is too — callers pass it into
  // memoized/debounced handlers (e.g. search).
  const navigateTo = useNavigate();

  const nrOfPages = Math.max(1, Math.ceil(totalNrOfElements / elementsPerPage));

  const navigate = useCallback(
    (page: number, method: 'push' | 'replace') => {
      void navigateTo({
        to: '.',
        search: (prev) => ({
          ...prev,
          page: page <= 1 ? undefined : String(page),
        }),
        replace: method === 'replace',
      });
    },
    [navigateTo],
  );

  const goToPage = useCallback(
    (page: number) => navigate(page, 'push'),
    [navigate],
  );

  const goToNextPage = useCallback(
    () => navigate(currentPage + 1, 'push'),
    [navigate, currentPage],
  );

  const goToPreviousPage = useCallback(
    () => navigate(currentPage - 1, 'push'),
    [navigate, currentPage],
  );

  // Correct an out-of-range page in the URL (e.g. a stale deep link, or data
  // that shrank) once the real page count is known. `replace` keeps the bounce
  // out of history; the `!loading` guard stops it fighting an in-flight fetch.
  useEffect(() => {
    if (!loading && totalNrOfElements > 0 && currentPage > nrOfPages) {
      navigate(nrOfPages, 'replace');
    }
  }, [loading, totalNrOfElements, currentPage, nrOfPages, navigate]);

  return {
    nrOfPages,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
}
