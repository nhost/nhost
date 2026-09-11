import { useFormContext, useWatch } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { GroupOperatorRendererProps } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import type { LogicalOperator } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

export default function LogicalGroupOperator({
  name,
}: GroupOperatorRendererProps) {
  const { setValue } = useFormContext();
  const operator: LogicalOperator = useWatch({ name: `${name}.operator` });

  return (
    <Select
      value={operator}
      onValueChange={(value) =>
        setValue(`${name}.operator`, value, { shouldDirty: true })
      }
    >
      <SelectTrigger
        aria-label="Logical group operator"
        className="h-7 w-28 bg-background"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_implicit">Implicit</SelectItem>
        <SelectItem value="_and">AND</SelectItem>
        <SelectItem value="_or">OR</SelectItem>
        <SelectItem value="_not">NOT</SelectItem>
      </SelectContent>
    </Select>
  );
}
