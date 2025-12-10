import { useCallback, useEffect, useMemo, useState } from 'react';

type QueryResult<TData> = {
  data: TData | undefined;
  isLoading: boolean;
  isInitialLoading: boolean;
  refetch: () => Promise<unknown> | void;
};

export interface UseEventPaginationOptions<TArgs, TData = unknown[]> {
  initialLimit?: number;
  /**
   * Hook that performs the data fetching. Must be a hook.
   */
  useQueryHook: (args: TArgs) => QueryResult<TData>;
  /**
   * Builder that maps the current pagination state to the arguments expected by the query hook.
   */
  getQueryArgs: (limit: number, offset: number) => TArgs;
  /**
   * Optional function to compute the current page length from the returned data.
   * If omitted and data is an array, length will be derived automatically from data.length.
   */
  getPageLength?: (data: TData | undefined) => number | undefined;
  /**
   * When this key changes, the hook will reset the offset to 0.
   * Pass an identity of the listing (e.g., name of the event).
   */
  resetKey?: unknown;
}

export interface UseEventPaginationResult<TData = unknown[]> {
  offset: number;
  limit: number;
  setOffset: (value: number | ((prev: number) => number)) => void;
  setLimit: (value: number | ((prev: number) => number)) => void;
  setLimitAndReset: (newLimit: number) => void;
  goPrev: () => void;
  goNext: () => void;
  hasNoPreviousPage: boolean;
  hasNoNextPage: boolean;
  isLastPage: boolean;
  data: TData | undefined;
  isLoading: boolean;
  isInitialLoading: boolean;
  refetch: () => Promise<unknown> | void;
}

export default function useEventPagination<TArgs, TData = unknown[]>({
  initialLimit = 10,
  useQueryHook,
  getQueryArgs,
  getPageLength,
  resetKey,
}: UseEventPaginationOptions<TArgs, TData>): UseEventPaginationResult<TData> {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(initialLimit);

  const { data, isLoading, isInitialLoading, refetch } = useQueryHook(
    getQueryArgs(limit, offset),
  );

  const pageLength = useMemo(() => {
    if (getPageLength) {
      return getPageLength(data);
    }
    if (Array.isArray(data)) {
      return data.length;
    }
    return undefined;
  }, [data, getPageLength]);

  const goPrev = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - limit));
  }, [limit]);

  const goNext = useCallback(() => {
    setOffset((prev) => prev + limit);
  }, [limit]);

  const setLimitAndReset = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setOffset(0);
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [resetKey]);

  const isLastPage =
    typeof pageLength === 'number' ? pageLength < limit : false;

  const hasNoPreviousPage = !isLoading && offset <= 0;
  const hasNoNextPage = !isLoading && isLastPage;

  return {
    offset,
    limit,
    setOffset,
    setLimit,
    setLimitAndReset,
    goPrev,
    goNext,
    hasNoPreviousPage,
    hasNoNextPage,
    isLastPage,
    data,
    isLoading,
    isInitialLoading,
    refetch,
  };
}
