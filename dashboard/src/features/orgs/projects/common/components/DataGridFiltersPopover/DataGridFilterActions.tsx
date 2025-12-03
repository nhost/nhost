import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { createTableQueryKey } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { useIsFetching } from '@tanstack/react-query';
import { v4 as uuidV4 } from 'uuid';
import { useDataGridFilters } from './DataGridFiltersProvider';

function DataGridFilterActions() {
  const {
    appliedFilters,
    setAppliedFilters,
    currentOffset,
    sortBy,
    setCurrentOffset,
  } = useDataGridQueryParams();

  const { addFilter, setFilters, filters } = useDataGridFilters();
  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  const tablePath = useTablePath();

  const isFetching = useIsFetching({
    queryKey: createTableQueryKey(
      tablePath,
      currentOffset,
      sortBy,
      appliedFilters,
    ),
  });

  const { columns } = useDataGridConfig();

  function handleAddFilter() {
    addFilter({ column: columns[0].id, op: '=', value: '', id: uuidV4() });
  }

  function handleClearAllFilters() {
    removeQueryParamsFromUrl('page');
    setCurrentOffset(0);
    setFilters([]);
    setAppliedFilters([]);
  }

  function handleApplyFilters() {
    removeQueryParamsFromUrl('page');
    setCurrentOffset(0);
    setAppliedFilters(filters);
  }

  return (
    <div className="flex w-full justify-between">
      <ButtonGroup className="flex w-full">
        <Button variant="outline" size="sm" onClick={handleAddFilter}>
          Add filter
        </Button>
        <Button variant="secondary" size="sm" onClick={handleClearAllFilters}>
          Clear filters
        </Button>
      </ButtonGroup>
      <ButtonWithLoading
        size="sm"
        loading={isFetching > 0}
        onClick={handleApplyFilters}
      >
        Apply filter
      </ButtonWithLoading>
    </div>
  );
}

export default DataGridFilterActions;
