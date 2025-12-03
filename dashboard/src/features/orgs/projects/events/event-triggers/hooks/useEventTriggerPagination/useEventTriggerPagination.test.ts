import { renderHook, waitFor } from '@/tests/testUtils';
import { vi } from 'vitest';
import useEventTriggerPagination from './useEventTriggerPagination';

describe('useEventTriggerPagination', () => {
  it('does not go below 0 when going to previous page', async () => {
    const { result } = renderHook(() =>
      useEventTriggerPagination({
        initialLimit: 10,
        useQueryHook: () => ({
          data: Array.from({ length: 10 }),
          isLoading: false,
          isInitialLoading: false,
          refetch: vi.fn(),
        }),
        getQueryArgs: () => ({}),
      }),
    );

    expect(result.current.offset).toBe(0);

    result.current.goPrev();
    await waitFor(() => expect(result.current.offset).toBe(0));

    result.current.goNext();
    await waitFor(() => expect(result.current.offset).toBe(10));

    result.current.goPrev();
    await waitFor(() => expect(result.current.offset).toBe(0));
  });

  it('cannot go next when current page is empty', () => {
    const { result } = renderHook(() =>
      useEventTriggerPagination({
        initialLimit: 10,
        useQueryHook: () => ({
          data: [],
          isLoading: false,
          isInitialLoading: false,
          refetch: vi.fn(),
        }),
        getQueryArgs: () => ({}),
      }),
    );

    expect(result.current.isLastPage).toBe(true);
    expect(result.current.hasNoNextPage).toBe(true);
  });

  it('cannot go next when current page has fewer rows than limit', () => {
    const { result } = renderHook(() =>
      useEventTriggerPagination({
        initialLimit: 10,
        useQueryHook: () => ({
          data: Array.from({ length: 3 }),
          isLoading: false,
          isInitialLoading: false,
          refetch: vi.fn(),
        }),
        getQueryArgs: () => ({}),
      }),
    );

    expect(result.current.isLastPage).toBe(true);
    expect(result.current.hasNoNextPage).toBe(true);
  });

  it('uses getPageLength for non-array responses', () => {
    type Resp = { items: string[] };
    const { result } = renderHook(() =>
      useEventTriggerPagination<unknown, Resp>({
        initialLimit: 10,
        useQueryHook: () => ({
          data: { items: ['a', 'b', 'c'] },
          isLoading: false,
          isInitialLoading: false,
          refetch: vi.fn(),
        }),
        getQueryArgs: () => ({}),
        getPageLength: (resp) => resp?.items.length,
      }),
    );

    expect(result.current.isLastPage).toBe(true);
    expect(result.current.hasNoNextPage).toBe(true);
  });

  it('calls getQueryArgs with current limit and offset', async () => {
    let lastArgs: { limit?: number; offset?: number } = {};

    const { result } = renderHook(() =>
      useEventTriggerPagination({
        initialLimit: 10,
        useQueryHook: () => ({
          data: Array.from({ length: 10 }),
          isLoading: false,
          isInitialLoading: false,
          refetch: vi.fn(),
        }),
        getQueryArgs: (limit, offset) => {
          lastArgs = { limit, offset };
          return lastArgs;
        },
      }),
    );

    expect(lastArgs).toEqual({ limit: 10, offset: 0 });

    result.current.goNext();
    await waitFor(() => expect(lastArgs).toEqual({ limit: 10, offset: 10 }));

    result.current.setLimitAndReset(25);
    await waitFor(() => expect(lastArgs).toEqual({ limit: 25, offset: 0 }));
  });
});
