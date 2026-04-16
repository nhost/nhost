import { v4 as uuidV4 } from 'uuid';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { ButtonGroup } from '@/components/ui/v3/button-group';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { useDataGridFilters } from './DataGridFiltersProvider';
import { useGetDataColumns } from './useGetDataColumns';

type DataGridFilterActionsProps = {
  isFetching: boolean;
};

function DataGridFilterActions({ isFetching }: DataGridFilterActionsProps) {
  const { setAppliedFilters } = useDataGridQueryParams();

  const { addFilter, setFilters, filters } = useDataGridFilters();
  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  const columns = useGetDataColumns();

  function handleAddFilter() {
    addFilter({ column: columns[0].id, op: '=', value: '', id: uuidV4() });
  }

  function handleClearAllFilters() {
    removeQueryParamsFromUrl('page');
    setFilters([]);
    setAppliedFilters([]);
  }

  function handleApplyFilters() {
    removeQueryParamsFromUrl('page');
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
        loading={isFetching}
        onClick={handleApplyFilters}
      >
        Apply filter
      </ButtonWithLoading>
    </div>
  );
}

export default DataGridFilterActions;
