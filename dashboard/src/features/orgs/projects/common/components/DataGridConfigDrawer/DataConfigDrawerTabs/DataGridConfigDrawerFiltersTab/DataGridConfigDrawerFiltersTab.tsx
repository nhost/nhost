import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import {
  type DataGridFilter as Filter,
  useDataGridQueryParams,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { createTableQueryKey } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import { DataGridFilter } from './DataGridFilter';

function hasErrors(filters: Filter[]) {
  return filters.reduce((errors, { op, value, column }, index) => {
    if (value !== 'null' && isEmptyValue(value)) {
      return { ...errors, [`${column}.${index}`]: 'Empty filter' };
    }
    if (['IN', 'NOT IN'].includes(op)) {
      try {
        JSON.parse(value);
      } catch {
        return {
          ...errors,
          [`${column}.${index}`]: 'Invalid format. ["item1","item 2"]',
        };
      }
    }

    return errors;
  }, {});
}
function DataGridConfigFiltersTabs() {
  const tablePath = useTablePath();
  const {
    filters,
    addFilter,
    appliedFilters,
    setFilters,
    setAppliedFilters,
    currentOffset,
    sortBy,
  } = useDataGridQueryParams();
  const isFetching = useIsFetching({
    queryKey: createTableQueryKey(
      tablePath,
      currentOffset,
      sortBy,
      appliedFilters,
    ),
  });

  const { columns } = useDataGridConfig();
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFilters(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilter() {
    const filterErrors = hasErrors(filters);
    setErrors(filterErrors);

    if (isEmptyValue(filterErrors)) {
      setAppliedFilters(filters);
    }
  }

  function handleAddFilter() {
    addFilter({ column: columns[0].id, op: '=', value: '', id: uuidV4() });
  }

  function clearAllFilters() {
    setFilters([]);
    setAppliedFilters([]);
  }

  return (
    <TabsContent value="filters" className="flex flex-col gap-6">
      <div className="flex h-full max-h-[20rem] w-full flex-col gap-0 overflow-y-scroll">
        {isNotEmptyValue(filters) &&
          filters.map((filter, index) => (
            <DataGridFilter
              {...filter}
              key={filter.id}
              index={index}
              columns={columns as any}
              error={errors[`${filter.column}.${index}`]}
            />
          ))}
        {isEmptyValue(filters) && (
          <p>
            <strong>No filters applied to this table</strong>
            <br />
            Add a filter below to filter the table
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t-1 border-t-[#e2e8f0] pt-6 dark:border-t-[#2f363d]">
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleAddFilter}>
            Add filter
          </Button>
          <Button variant="secondary" size="sm" onClick={clearAllFilters}>
            Clear filters
          </Button>
        </div>
        <ButtonWithLoading
          size="sm"
          loading={isFetching > 0}
          onClick={handleApplyFilter}
        >
          Apply filter
        </ButtonWithLoading>
      </div>
    </TabsContent>
  );
}

export default DataGridConfigFiltersTabs;
