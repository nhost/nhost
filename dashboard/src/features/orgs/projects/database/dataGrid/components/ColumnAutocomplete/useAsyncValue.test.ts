import { vi } from 'vitest';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { renderHook, waitFor } from '@/tests/testUtils';
import useAsyncValue from './useAsyncValue';

const makeTableData = (
  columnNames: string[],
): Partial<FetchTableReturnType> => ({
  columns: columnNames.map((name) => ({
    column_name: name,
    table_schema: 'public',
    table_name: 'users',
    udt_name: 'text',
  })),
});

describe('useAsyncValue', () => {
  it('initializes immediately when initialValue is empty string', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('initializes immediately when initialValue is undefined', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: undefined,
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('resolves a simple column from initialValue', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({
      value: 'name',
      label: 'name',
      group: 'columns',
    });
  });

  it('clears selection when initialValue column is not found in table', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'nonexistent',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('waits for table data before initializing', async () => {
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: true,
        isMetadataLoading: false,
        tableData: undefined as FetchTableReturnType | undefined,
        metadata: undefined,
      },
    });

    expect(result.current.initialized).toBe(false);
    expect(result.current.selectedColumn).toBeNull();

    rerender({
      selectedSchema: 'public',
      selectedTable: 'users',
      initialValue: 'name',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
      metadata: undefined,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({
      value: 'name',
      label: 'name',
    });
  });

  it('calls onInitialized with resolved column', async () => {
    const onInitialized = vi.fn();

    renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
        onInitialized,
      }),
    );

    await waitFor(() => {
      expect(onInitialized).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'name' }),
      );
    });
  });

  it('does not call onInitialized when initialValue is empty', async () => {
    const onInitialized = vi.fn();

    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
        metadata: undefined,
        onInitialized,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(onInitialized).not.toHaveBeenCalled();
  });
});
