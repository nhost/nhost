import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';

type DataFilterColumnProps = {
  value: string;
  onChange: (newValue: string) => void;
  columns: Array<{ id: string; dataType: string }>;
};

function DataGrdiFitlerColumn({
  value,
  onChange,
  columns,
}: DataFilterColumnProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="mp-2 h-8 max-w-[35%]">
        <span className="!inline-block w-4/5 justify-start overflow-ellipsis text-left">
          {value}
        </span>
      </SelectTrigger>
      <SelectContent>
        {columns.map((column) => (
          <SelectItem key={column.id} value={column.id}>
            {column.id}{' '}
            <Badge className="rounded-sm+ bg-secondary p-1 text-[0.75rem] font-normal leading-[0.75]">
              {/* TODO: Fix type */}
              {(column as any).dataType}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGrdiFitlerColumn;
