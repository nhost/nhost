import { act } from 'react';
import { renderHook, waitFor } from '@/tests/testUtils';
import useSQLEditorPagination from './useSQLEditorPagination';

const makeRows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('useSQLEditorPagination', () => {
  describe('initial state', () => {
    it('starts at page 1 with the default limit of 100', () => {
      const rows = makeRows(200);
      const { result } = renderHook(() => useSQLEditorPagination({ rows }));

      expect(result.current.currentPage).toBe(1);
      expect(result.current.limit).toBe(100);
    });

    it('respects a custom initialLimit', () => {
      const rows = makeRows(200);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 25 }),
      );

      expect(result.current.limit).toBe(25);
    });
  });

  describe('totalNrOfPages', () => {
    it('computes total pages correctly', () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(3);
    });

    it('returns 1 when there are no rows', () => {
      const rows: number[] = [];
      const { result } = renderHook(() => useSQLEditorPagination({ rows }));

      expect(result.current.totalNrOfPages).toBe(1);
    });

    it('returns 1 when rows fit exactly on one page', () => {
      const rows = makeRows(100);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(1);
    });
  });

  describe('paginatedRows', () => {
    it('returns the first slice on page 1', () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.paginatedRows).toEqual(rows.slice(0, 100));
    });

    it('returns the correct slice after navigating to the next page', async () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() =>
        expect(result.current.paginatedRows).toEqual(rows.slice(100, 200)),
      );
    });

    it('returns a partial last slice when rows do not divide evenly', async () => {
      const rows = makeRows(250);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
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
      const rows = makeRows(200);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.currentPage).toBe(1);

      act(() => result.current.goPrev());
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('does not exceed the last page when calling goNext on the last page', async () => {
      const rows = makeRows(200);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));
    });

    it('can go forward and then back to page 1', async () => {
      const rows = makeRows(300);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.goPrev());
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('setCurrentPage navigates to an arbitrary page', async () => {
      const rows = makeRows(500);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.setCurrentPage(4));
      await waitFor(() => expect(result.current.currentPage).toBe(4));
    });
  });

  describe('handleLimitChange', () => {
    it('updates the limit when called with a valid PageSize value', async () => {
      const rows = makeRows(500);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.handleLimitChange(null, 50));
      await waitFor(() => expect(result.current.limit).toBe(50));
    });

    it('does nothing when called with null', async () => {
      const rows = makeRows(500);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.handleLimitChange(null, null));
      await waitFor(() => expect(result.current.limit).toBe(100));
    });

    it('changes the limit and resets to page 1', async () => {
      const rows = makeRows(500);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.goNext());
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      act(() => result.current.handleLimitChange(null, 25));
      await waitFor(() => {
        expect(result.current.limit).toBe(25);
        expect(result.current.currentPage).toBe(1);
      });
    });

    it('recalculates totalNrOfPages after the limit changes', async () => {
      const rows = makeRows(100);
      const { result } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      expect(result.current.totalNrOfPages).toBe(1);

      act(() => result.current.handleLimitChange(null, 25));
      await waitFor(() => expect(result.current.totalNrOfPages).toBe(4));
    });
  });

  describe('reset on new query', () => {
    it('restarts at the first page when a new result set arrives', async () => {
      let rows = makeRows(300);
      const { result, rerender } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.setCurrentPage(3));
      await waitFor(() => expect(result.current.currentPage).toBe(3));

      rows = makeRows(500);
      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('restarts at page 1 even when the previous page is still valid', async () => {
      let rows = makeRows(10_000);
      const { result, rerender } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.setCurrentPage(40));
      await waitFor(() => expect(result.current.currentPage).toBe(40));

      rows = makeRows(50);
      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(1));

      rows = makeRows(10_000);
      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(1));
    });

    it('keeps the current page when rows keep the same reference', async () => {
      const rows = makeRows(300);
      const { result, rerender } = renderHook(() =>
        useSQLEditorPagination({ rows, initialLimit: 100 }),
      );

      act(() => result.current.setCurrentPage(2));
      await waitFor(() => expect(result.current.currentPage).toBe(2));

      rerender();
      await waitFor(() => expect(result.current.currentPage).toBe(2));
    });
  });
});
