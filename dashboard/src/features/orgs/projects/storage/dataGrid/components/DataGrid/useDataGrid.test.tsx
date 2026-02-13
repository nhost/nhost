import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@/tests/testUtils';
import useDataGrid from './useDataGrid';

const mocks = vi.hoisted(() => ({
  getColumnVisibility: vi.fn(),
  getColumnOrder: vi.fn(),
}));

vi.mock('@/features/orgs/projects/database/common/hooks/useTablePath', () => ({
  useTablePath: vi.fn(() => 'test-table-path'),
}));

vi.mock(
  '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage',
  async () => {
    const actual = await vi.importActual(
      '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage',
    );
    return {
      ...actual,
      convertToV8IfNeeded: vi.fn(),
      getColumnVisibility: mocks.getColumnVisibility,
      getColumnOrder: mocks.getColumnOrder,
    };
  },
);

describe('useDataGrid', () => {
  it('should initialize tableInitialized as false and then true', async () => {
    const { result } = renderHook(() =>
      useDataGrid({
        columns: [],
        data: [],
      }),
    );

    expect(result.current.tableInitialized).toBe(false);

    await waitFor(() => expect(result.current.tableInitialized).toBe(true), {
      timeout: 1000,
    });
  });

  it('should call PersistenDataTableConfigurationStorage to load configuration', async () => {
    renderHook(() =>
      useDataGrid({
        columns: [],
        data: [],
      }),
    );

    await waitFor(() =>
      expect(mocks.getColumnVisibility).toHaveBeenCalledWith('test-table-path'),
    );
    expect(mocks.getColumnOrder).toHaveBeenCalledWith('test-table-path');
  });
});
