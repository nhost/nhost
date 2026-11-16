import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';
import { getAvailableOperators } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isNotEmptyValue } from '@/lib/utils';
import { useDataGridFilters } from './DataGridFiltersProvider';
import { useGetDataColumns } from './useGetDataColumns';

type DataFilterColumnProps = {
  value: string;
  index: number;
  currentOp: string;
};

function DataGridFilterColumn({
  value,
  index,
  currentOp,
}: DataFilterColumnProps) {
  const columns = useGetDataColumns<{ specificType: string }>();
  const { setColumn, setOp, setValue } = useDataGridFilters();
  const selectRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isNotEmptyValue(selectRef.current)) {
      selectRef.current.focus();
    }
  }, []);
  return (
    <Select
      value={value}
      onValueChange={(newColumn) => {
        setColumn(index, newColumn);
        const newSpecificType = columns.find((col) => col.id === newColumn)
          ?.columnDef.meta?.specificType;
        const availableOps = getAvailableOperators(newSpecificType);
        if (!availableOps.some((o) => o.op === currentOp)) {
          setOp(index, availableOps[0].op);
          setValue(index, '');
        }
      }}
    >
      <SelectTrigger className="w-32" ref={selectRef}>
        <span
          className="!inline-block w-4/5 overflow-ellipsis text-left"
          title={value}
        >
          {value}
        </span>
      </SelectTrigger>
      <SelectContent>
        {columns.map((column) => (
          <SelectItem key={column.id} value={column.id}>
            {column.id}{' '}
            <Badge className="rounded-sm bg-secondary px-1 py-0.5 font-normal text-xs leading-none">
              {column.columnDef.meta?.displayType}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGridFilterColumn;
