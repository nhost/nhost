import { X } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import type { DataGridFilterOperator } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import DataGridFilterColumn from './DataGridFilterColumn';
import DataGridFilterOperators from './DataGridFilterOperators';
import { useDataGridFilters } from './DataGridFiltersProvider';
import { DataGridFilterValue } from './DataGridFilterValue';
import { useGetDataColumns } from './useGetDataColumns';

type FilterProps = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  index: number;
};

function DataGridFilter({ column, op, value, index }: FilterProps) {
  const { removeFilter } = useDataGridFilters();
  const columns = useGetDataColumns<{ dataType: string }>();
  const selectedColumnDataType = columns.find((col) => col.id === column)
    ?.columnDef.meta?.dataType;

  return (
    <div className="flex gap-2 p-1">
      <DataGridFilterColumn value={column} index={index} currentOp={op} />
      <DataGridFilterOperators
        value={op}
        index={index}
        columnDataType={selectedColumnDataType}
      />
      <DataGridFilterValue
        value={value}
        index={index}
        disabled={op === 'IS' || op === 'IS NOT'}
      />
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 flex-i"
        onClick={() => removeFilter(index)}
      >
        <X width={12} height={12} />
      </Button>
    </div>
  );
}

export default DataGridFilter;
