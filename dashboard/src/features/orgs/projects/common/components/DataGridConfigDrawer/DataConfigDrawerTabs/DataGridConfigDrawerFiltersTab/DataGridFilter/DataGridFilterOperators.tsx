import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';
import {
  type DataGridFilterOperator,
  operators,
} from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';

type DataFilterProps = {
  value: DataGridFilterOperator;
  onChange: (newOp: DataGridFilterOperator) => void;
};

function DataGridOperators({ value, onChange }: DataFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[8rem] truncate overflow-ellipsis p-2">
        {value}
      </SelectTrigger>
      <SelectContent>
        {operators.map(({ op, label }) => (
          <SelectItem key={op} value={op}>
            <span>[{op}]</span> <span className="text-secondary">{label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGridOperators;
