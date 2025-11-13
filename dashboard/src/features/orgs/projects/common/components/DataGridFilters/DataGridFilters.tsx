import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  type DataGridFilter as Filter,
  useDataGridFilter,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridFilterProvider';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import DataGridFilter from './DataGridFilter';
import DataGridFilterTrigger from './DataGridFilterTrigger';

function hasErrors(filters: Filter[]) {
  return filters.reduce((errors, { op, value, column }, index) => {
    if (isEmptyValue(value)) {
      return { ...errors, [`${column}.${index}`]: 'Empty filter' };
    }
    if (['$in', '$nin'].includes(op)) {
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

function DataGridFilters() {
  const { filters, addFilter, appliedFilters, setFilters, setAppliedFilters } =
    useDataGridFilter();
  const { columns } = useDataGridConfig();
  const [errors, setErrors] = useState({});

  function resetFilters() {
    setFilters(appliedFilters);
  }

  function handleApplyFilter() {
    const filterErrors = hasErrors(filters);
    setErrors(filterErrors);
    if (isEmptyValue(filterErrors)) {
      setAppliedFilters(filters);
    }
  }

  function handleOpenChange(newOpenState: boolean) {
    if (!newOpenState) {
      resetFilters();
    }
  }

  function handleAddFilter() {
    addFilter({ column: columns[0].id, op: '$eq', value: '', id: uuidV4() });
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <DataGridFilterTrigger />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[40rem] flex-col gap-6 p-0">
        <div className="flex w-full flex-col gap-0 px-3 pb-0 pt-6">
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
        <div className="flex items-center justify-between border-t-1 border-t-[#e2e8f0] p-3 dark:border-t-[#2f363d]">
          <Button variant="outline" size="sm" onClick={handleAddFilter}>
            Add filter
          </Button>
          <Button variant="outline" size="sm" onClick={handleApplyFilter}>
            Apply filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DataGridFilters;
