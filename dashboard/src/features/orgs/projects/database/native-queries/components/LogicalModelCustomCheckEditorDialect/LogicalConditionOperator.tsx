import { useFormContext, useWatch } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { ConditionOperatorRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import { LOGICAL_MODEL_COMPARISON_OPERATORS } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

const DEFAULT_VALUE_BY_OPERATOR: Record<string, unknown> = {
  _is_null: true,
  _in: [],
  _nin: [],
};

export default function LogicalConditionOperator({
  name,
}: ConditionOperatorRendererProps) {
  const { setValue } = useFormContext();
  const operator = useWatch({ name: `${name}.operator` });

  return (
    <Select
      value={operator ?? ''}
      onValueChange={(nextOperator) => {
        const nextValue = DEFAULT_VALUE_BY_OPERATOR[nextOperator] ?? null;
        setValue(`${name}.operator`, nextOperator, { shouldDirty: true });
        setValue(`${name}.value`, nextValue, { shouldDirty: true });
      }}
    >
      <SelectTrigger aria-label="Logical model operator">
        <SelectValue placeholder="Select operator..." />
      </SelectTrigger>
      <SelectContent>
        {LOGICAL_MODEL_COMPARISON_OPERATORS.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
