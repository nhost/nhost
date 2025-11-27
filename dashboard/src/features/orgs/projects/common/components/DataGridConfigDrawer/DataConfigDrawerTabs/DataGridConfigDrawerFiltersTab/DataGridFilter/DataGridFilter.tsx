import { Button } from '@/components/ui/v3/button';
import {
  useDataGridQueryParams,
  type DataGridFilterOperator,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { X } from 'lucide-react';
import DataGridFilterColumn from './DataGridFilterColumn';
import DataGridFilterOperators from './DataGridFilterOperators';
import { DataGridFilterValue } from './DataGridFilterValue';

type FilterProps = {
  column: string;
  op: DataGridFilterOperator;
  value: string;
  index: number;
  columns: Array<{ id: string; dataType: string }>;
  error?: string;
};

function DataGridFilter({
  column,
  op,
  value,
  index,
  columns,
  error,
}: FilterProps) {
  const { setColumn, setOp, setValue, removeFilter } = useDataGridQueryParams();

  function handleOpChange(newOp: DataGridFilterOperator) {
    setOp(index, newOp);
    if (
      newOp === 'LIKE' ||
      newOp === 'NOT LIKE' ||
      newOp === 'ILIKE' ||
      newOp === 'NOT ILIKE'
    ) {
      setValue(index, '%%');
    } else if (newOp === 'IN' || newOp === 'NOT IN') {
      setValue(index, '[]');
    } else if (newOp === 'IS' || newOp === 'IS NOT') {
      setValue(index, 'NULL');
    }
  }

  return (
    <div className="flex gap-2 p-1">
      <DataGridFilterColumn
        value={column}
        onChange={(newColumn) => setColumn(index, newColumn)}
        columns={columns}
      />
      <DataGridFilterOperators value={op} onChange={handleOpChange} />
      <DataGridFilterValue
        value={value}
        error={error}
        index={index}
        disabled={op === 'IS' || op === 'IS NOT'}
      />
      <Button
        variant="outline"
        size="icon"
        className="flex-i h-8 w-8"
        onClick={() => removeFilter(index)}
      >
        <X width={12} height={12} />
      </Button>
    </div>
  );
}

export default DataGridFilter;
