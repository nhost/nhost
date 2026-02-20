import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';
import { SELECTION_COLUMN_ID } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { isNotEmptyValue } from '@/lib/utils';
import { useDataGridFilters } from './DataGridFiltersProvider';

type DataFilterColumnProps = {
  value: string;
  index: number;
};

function DataGridFilterColumn({ value, index }: DataFilterColumnProps) {
  const { getAllColumns } = useDataGridConfig<{ dataType: string }>();
  const { setColumn } = useDataGridFilters();
  const selectRef = useRef<HTMLButtonElement | null>(null);
  const columns = getAllColumns().filter(
    ({ id }) => id !== SELECTION_COLUMN_ID,
  );

  useEffect(() => {
    if (isNotEmptyValue(selectRef.current)) {
      selectRef.current.focus();
    }
  }, []);
  return (
    <Select
      value={value}
      onValueChange={(newColumn) => setColumn(index, newColumn)}
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
