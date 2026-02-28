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
import { useDataGridFilters } from './DataGridFiltersProvider';

type DataFilterProps = {
  value: DataGridFilterOperator;
  index: number;
};

function DataGridOperators({ value, index }: DataFilterProps) {
  const { setOp, setValue } = useDataGridFilters();

  function handleOpChange(newOp: DataGridFilterOperator) {
    setOp(index, newOp);
    if (
      newOp === 'LIKE' ||
      newOp === 'NOT LIKE' ||
      newOp === 'ILIKE' ||
      newOp === 'NOT ILIKE'
    ) {
      setValue(index, '%%');
    } else if (newOp === 'IS' || newOp === 'IS NOT') {
      setValue(index, 'NULL');
    } else {
      setValue(index, '');
    }
  }

  return (
    <Select value={value} onValueChange={handleOpChange}>
      <SelectTrigger className="h-8 w-[8rem]">
        <span
          className="!inline-block w-4/5 overflow-ellipsis whitespace-nowrap text-left"
          title={value}
        >
          {value}
        </span>
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
