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
  const columns = useGetDataColumns<{ dataType: string }>();
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
        const newDataType = columns.find((col) => col.id === newColumn)
          ?.columnDef.meta?.dataType;
        const availableOps = getAvailableOperators(newDataType);
        if (!availableOps.some((o) => o.op === currentOp)) {
          setOp(index, availableOps[0].op);
          setValue(index, '');
        }
      }}
    >
      <SelectTrigger className="h-8 w-[8rem]" ref={selectRef}>
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
            <Badge className="rounded-sm+ bg-secondary p-1 font-normal text-[0.75rem] leading-[0.75]">
              {column.columnDef.meta?.dataType}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGridFilterColumn;
