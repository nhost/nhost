import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  useDataGridFilter,
  type DataGridFilterOperator,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridFilterProvider';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { X } from 'lucide-react';
import DataGridFilterColumn from './DataGridFilterColumn';
import DataGridFilterOperators from './DataGridFilterOperators';

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
  const { setColumn, setOp, setValue, removeFilter } = useDataGridFilter();

  function handleOpChange(newOp: DataGridFilterOperator) {
    setOp(index, newOp);
    if (
      newOp === '$like' ||
      newOp === '$ilike' ||
      newOp === '$nlike' ||
      newOp === '$nilike'
    ) {
      setValue(index, '%%');
    } else if (newOp === '$in' || newOp === '$nin') {
      setValue(index, '[]');
    }
  }

  return (
    <div className="flex gap-2">
      <DataGridFilterColumn
        value={column}
        onChange={(newColumn) => setColumn(index, newColumn)}
        columns={columns}
      />
      <DataGridFilterOperators value={op} onChange={handleOpChange} />
      <div className="flex-1">
        <Input
          className={cn('h-8 p-2', {
            'border-destructive': isNotEmptyValue(error),
          })}
          placeholder="Enter a value"
          value={value}
          onChange={(event) => setValue(index, event.target.value)}
        />
        <span
          className={`inline-flex h-[0.875rem] text-xs- text-destructive ${isNotEmptyValue(error) ? 'visible' : 'invisible'}`}
        >
          {error}
        </span>
      </div>
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
