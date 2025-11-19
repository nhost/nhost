import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/v3/select';
import type { DataGridFilterOperator } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridFilterProvider';

const OPERATORS = [
  { op: '$eq', label: '[$eq] equals' },
  { op: '$ne', label: '[$ne] not equals' },
  { op: '$in', label: '[$in] in' },
  { op: '$nin', label: '[$nin] not in' },
  { op: '$gt', label: '[$gt] >' },
  { op: '$lt', label: '[$lt] <' },
  { op: '$gte', label: '[$gte] >=' },
  { op: '$lte', label: '[$lte] <=' },
  { op: '$like', label: '[$like] like' },
  { op: '$nlike', label: '[$nlike] not like' },
  { op: '$ilike', label: '[$ilike] like (case-insensitive)' },
  { op: '$nilike', label: '[$nilike] not like (case-insensitive)' },
  { op: '$similar', label: '[$similar] similar' },
  { op: '$nsimilar', label: '[$nsimilar] not similar' },
  { op: '$regex', label: '[$regex] ~' },
  { op: '$iregex', label: '[$iregex] ~*' },
  { op: '$nregex', label: '[$nregex] !~' },
  { op: '$niregex', label: '[$niregex] !~*' },
];

type DataFilterProps = {
  value: DataGridFilterOperator;
  onChange: (newOp: DataGridFilterOperator) => void;
};

function DataGridOperators({ value, onChange }: DataFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[6rem] p-2">{value}</SelectTrigger>
      <SelectContent>
        {OPERATORS.map(({ op, label }) => (
          <SelectItem key={op} value={op}>
            <span>[{op}]</span> <span className="text-secondary">{label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DataGridOperators;
