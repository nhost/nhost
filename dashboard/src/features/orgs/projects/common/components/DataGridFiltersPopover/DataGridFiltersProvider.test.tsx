import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { saveDataGridFilters } from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import { renderHook } from '@/tests/testUtils';
import DataGridFiltersProvider, {
  useDataGridFilters,
} from './DataGridFiltersProvider';

const filterA: DataGridFilter = {
  id: '1',
  column: 'name',
  op: '=',
  value: 'foo',
};
const filterB: DataGridFilter = {
  id: '2',
  column: 'id',
  op: '=',
  value: 'bar',
};

describe('DataGridFiltersProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads filters from storage on mount', () => {
    saveDataGridFilters('bucket-1', [filterA]);

    const { result } = renderHook(() => useDataGridFilters(), {
      wrapper: ({ children }) => (
        <DataGridFiltersProvider storageKey="bucket-1">
          {children}
        </DataGridFiltersProvider>
      ),
    });

    expect(result.current.filters).toEqual([filterA]);
  });

  it('does not update filters when storageKey changes without a key prop', () => {
    saveDataGridFilters('bucket-1', [filterA]);
    saveDataGridFilters('bucket-2', [filterB]);

    let storageKey = 'bucket-1';

    const { result, rerender } = renderHook(() => useDataGridFilters(), {
      wrapper: ({ children }) => (
        <DataGridFiltersProvider storageKey={storageKey}>
          {children}
        </DataGridFiltersProvider>
      ),
    });

    expect(result.current.filters).toEqual([filterA]);

    storageKey = 'bucket-2';
    rerender();

    // Without a key prop the provider does not remount, so stale filters remain.
    // This is why the parent must pass key={storageKey} to DataGridFiltersProvider.
    expect(result.current.filters).toEqual([filterA]);
  });

  it('resets filters when remounted via key prop on storageKey change', () => {
    saveDataGridFilters('bucket-1', [filterA]);
    saveDataGridFilters('bucket-2', [filterB]);

    let storageKey = 'bucket-1';

    const { result, rerender } = renderHook(() => useDataGridFilters(), {
      wrapper: ({ children }) => (
        <DataGridFiltersProvider key={storageKey} storageKey={storageKey}>
          {children}
        </DataGridFiltersProvider>
      ),
    });

    expect(result.current.filters).toEqual([filterA]);

    storageKey = 'bucket-2';
    rerender();

    expect(result.current.filters).toEqual([filterB]);
  });
});
