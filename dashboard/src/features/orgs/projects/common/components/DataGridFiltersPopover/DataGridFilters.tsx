import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import DataGridFilter from './DataGridFilter';
import { useDataGridFilters } from './DataGridFiltersProvider';

function DataGridFilters() {
  const { filters } = useDataGridFilters();

  return (
    <div className="flex h-full max-h-[calc(var(--radix-popover-content-available-height)-16rem)] w-full flex-col gap-0 overflow-y-scroll">
      {isNotEmptyValue(filters) &&
        filters.map((filter, index) => (
          <DataGridFilter key={filter.id} {...filter} index={index} />
        ))}
      {isEmptyValue(filters) && (
        <p className="text-sm">
          <strong>No filters applied to this table</strong>
          <br />
          Add a filter below to filter the table
        </p>
      )}
    </div>
  );
}

export default DataGridFilters;
