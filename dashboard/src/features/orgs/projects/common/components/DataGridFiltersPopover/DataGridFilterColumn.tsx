import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { isNotEmptyValue } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { useDataGridFilters } from './DataGridFiltersProvider';

type DataFilterColumnProps = {
  value: string;
  index: number;
};

function DataGrdiFitlerColumn({ value, index }: DataFilterColumnProps) {
  const { columns } = useDataGridConfig<{ dataType: string }>();
  const { setColumn } = useDataGridFilters();
  const selectRef = useRef<HTMLButtonElement | null>(null);

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
            <Badge className="rounded-sm+ bg-secondary p-1 text-[0.75rem] font-normal leading-[0.75]">
              {/* biome-ignore lint/suspicious/noExplicitAny: TODO: https://github.com/nhost/nhost/issues/3728  */}
              {(column as any).dataType}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGrdiFitlerColumn;
