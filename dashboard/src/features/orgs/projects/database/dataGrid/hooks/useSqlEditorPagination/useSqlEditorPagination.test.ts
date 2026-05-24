import { act } from 'react';
import { renderHook, waitFor } from '@/tests/testUtils';
import useSqlEditorPagination from './useSqlEditorPagination';

const makeRows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('useSqlEditorPagination', () => {
  describe('initial state', () => {
    it('starts at page 1 with the default limit of 100', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200) }),
      );

      expect(result.current.currentPage).toBe(1);
      expect(result.current.limit).toBe(100);
    });

    it('respects a custom initialLimit', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 25 }),
      );

      expect(result.current.limit).toBe(25);
    });
  });

  describe('totalNrOfPages', () => {
    it('computes total pages correctly', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(250), initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(3);
    });

    it('returns 1 when there are no rows', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: [] }),
      );

      expect(result.current.totalNrOfPages).toBe(1);
    });

    it('returns 1 when rows fit exactly on one page', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(100), initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(1);
    });
  });

  describe('paginatedRows', () => {
    it('returns the first slice on page 1', () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.paginatedRows).toEqual(rows.slice(0, 100));
    });

    it('returns the correct slice after navigating to the next page', async () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() =>
        expect(result.current.paginatedRows).toEqual(rows.slice(100, 200)),
      );
    });

    it('returns a partial last slice when rows do not divide evenly', async () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      act(() => result.current.goNext());
      await waitFor(() =>
        expect(result.current.paginatedRows).toEqual(rows.slice(200, 250)),
      );
    });
  });

  describe('navigation', () => {
    it('does not go below page 1 when calling goPrev on the first page', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      expect(result.current.currentPage).toBe(1);

      act(() => result.current.goPrev());
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('does not exceed the last page when calling goNext on the last page', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));
    });

    it('can go forward and then back to page 1', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(300), initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.goPrev());
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('setCurrentPage navigates to an arbitrary page', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(500), initialLimit: 100 }),
      );

      act(() => result.current.setCurrentPage(4));
      await waitFor(() => expect(result.current.currentPage).toBe(4));
    });
  });

  describe('boundary flags', () => {
    it('hasNoPreviousPage is true on the first page', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      expect(result.current.hasNoPreviousPage).toBe(true);
    });

    it('hasNoPreviousPage is false after navigating forward', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() =>
        expect(result.current.hasNoPreviousPage).toBe(false),
      );
    });

    it('hasNoNextPage is true on the last page', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.hasNoNextPage).toBe(true));
    });

    it('hasNoNextPage is false when not on the last page', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(200), initialLimit: 100 }),
      );

      expect(result.current.hasNoNextPage).toBe(false);
    });

    it('both flags are true when all rows fit on one page', () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(50), initialLimit: 100 }),
      );

      expect(result.current.hasNoPreviousPage).toBe(true);
      expect(result.current.hasNoNextPage).toBe(true);
    });
  });

  describe('setLimitAndReset', () => {
    it('changes the limit and resets to page 1', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(500), initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.setLimitAndReset(25));
      await waitFor(() => {
        expect(result.current.limit).toBe(25);
        expect(result.current.currentPage).toBe(1);
      });
    });

    it('recalculates totalNrOfPages after the limit changes', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(100), initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(1);

      act(() => result.current.setLimitAndReset(25));
      await waitFor(() => expect(result.current.totalNrOfPages).toBe(4));
    });
  });

  describe('handleLimitChange', () => {
    it('updates the limit when called with a valid PageSize value', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(500), initialLimit: 100 }),
      );

      act(() => result.current.handleLimitChange(null, 50));
      await waitFor(() => expect(result.current.limit).toBe(50));
    });

    it('does nothing when called with null', async () => {
      const { result } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(500), initialLimit: 100 }),
      );

      act(() => result.current.handleLimitChange(null, null));
      await waitFor(() => expect(result.current.limit).toBe(100));
    });
  });

  describe('resetKey', () => {
    it('resets to page 1 when the resetKey changes', async () => {
      let resetKey = 'query-a';
      const { result, rerender } = renderHook(() =>
        useSqlEditorPagination({ rows: makeRows(300), initialLimit: 100, resetKey }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      resetKey = 'query-b';
      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('does not reset when the resetKey stays the same', async () => {
      const { result, rerender } = renderHook(() =>
        useSqlEditorPagination({
          rows: makeRows(300),
          initialLimit: 100,
          resetKey: 'stable-key',
        }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(2));
    });
  });
});