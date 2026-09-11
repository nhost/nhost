import { useController, useFormContext, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import ConditionValue from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionValue';
import type { ConditionValueRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import {
  displayInputValue,
  parseInputValue,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect/logicalInputValue';

export default function LogicalConditionValue({
  name,
  className,
}: ConditionValueRendererProps) {
  const { control, setValue } = useFormContext();
  const { field } = useController({ name: `${name}.value`, control });
  const operator = useWatch({ name: `${name}.operator` });

  if (operator === '_is_null') {
    return (
      <Select
        value={String(field.value)}
        onValueChange={(value) =>
          setValue(`${name}.value`, value === 'true', { shouldDirty: true })
        }
      >
        <SelectTrigger aria-label="Logical model value" className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (operator === '_in' || operator === '_nin') {
    return (
      <Input
        aria-label="Logical model value"
        className={className}
        value={displayInputValue(field.value)}
        placeholder="Value or X-Hasura-* variable"
        onChange={(event) =>
          setValue(`${name}.value`, parseInputValue(event.target.value), {
            shouldDirty: true,
          })
        }
      />
    );
  }

  return (
    <ConditionValue
      name={name}
      selectedTablePath=""
      className={className}
      ariaLabel="Logical model value"
      transformCreatedValue={parseInputValue}
    />
  );
}
