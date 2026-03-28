import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@/tests/testUtils';
import useDataGrid from './useDataGrid';

const mocks = vi.hoisted(() => ({
  getColumnVisibility: vi.fn(),
  getColumnOrder: vi.fn(),
  useTablePath: vi.fn(() => 'test-table-path'),
}));

vi.mock('@/features/orgs/projects/database/common/hooks/useTablePath', () => ({
  useTablePath: mocks.useTablePath,
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
