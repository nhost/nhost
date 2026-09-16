import { Trash2 } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { FormField, FormMessage } from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import ConditionValue from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionValue';
import OperatorComboBox from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/OperatorComboBox';
import type { ConditionNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  isLogicalModelColumnComparisonOperator,
  normalizeLogicalModelScalar,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import { cn, isNotEmptyValue } from '@/lib/utils';
import LogicalModelComparisonFieldPicker from './LogicalModelComparisonFieldPicker';
import useLogicalModelCustomCheckEditor from './useLogicalModelCustomCheckEditor';

interface LogicalModelConditionRowProps {
  name: string;
  onRemove?: VoidFunction;
}

export default function LogicalModelConditionRow({
  name,
  onRemove,
}: LogicalModelConditionRowProps) {
  const { control, setValue, clearErrors } = useFormContext();
  const { fields, pathPrefix } = useLogicalModelCustomCheckEditor();
  const condition = useWatch({ name }) as ConditionNode | undefined;
  const fullPath = [...pathPrefix, condition?.column ?? '']
    .filter(Boolean)
    .join('.');
  const descriptor = fields.descriptors.find(
    (item) => item.selectable && item.path === fullPath,
  );
  const selectableFields = fields.descriptors.filter((item) => {
    if (!item.selectable) {
      return false;
    }
    const parts = item.path.split('.');
    return (
      parts.length === pathPrefix.length + 1 &&
      pathPrefix.every((part, index) => parts[index] === part)
    );
  });
  return (
    <div className="mt-4 flex flex-col gap-1 space-y-1 overflow-x-hidden rounded-md p-1 transition-colors focus-within:bg-accent/50 hover:bg-accent/50 xl:grid xl:grid-flow-row xl:grid-cols-[320px_160px_minmax(100px,_1fr)_40px] xl:space-y-0 xl:overflow-x-visible">
      <FormField
        name={`${name}.column`}
        control={control}
        render={({ field, fieldState }) => {
          const hasError = isNotEmptyValue(fieldState.error?.message);
          return (
            <div className="flex flex-col gap-2">
              <Select
                value={field.value ?? ''}
                onValueChange={(column) => {
                  setValue(`${name}.column`, column, { shouldDirty: true });
                  setValue(`${name}.operator`, '_eq', { shouldDirty: true });
                  setValue(`${name}.value`, null, { shouldDirty: true });
                  clearErrors(name);
                }}
              >
                <SelectTrigger
                  aria-label="Logical model field"
                  className={cn({
                    'border-destructive text-destructive': hasError,
                  })}
                >
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {selectableFields.map((item) => (
                    <SelectItem key={item.path} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </div>
          );
        }}
      />

      <OperatorComboBox
        name={name}
        selectedColumnType={normalizeLogicalModelScalar(descriptor?.scalar)}
      />
      {isLogicalModelColumnComparisonOperator(condition?.operator) ? (
        <FormField
          name={`${name}.value`}
          control={control}
          render={() => (
            <div className="flex w-full flex-col gap-2">
              <LogicalModelComparisonFieldPicker
                name={`${name}.value`}
                className="min-h-10"
              />
              <FormMessage />
            </div>
          )}
        />
      ) : (
        <ConditionValue selectedTablePath="" name={name} className="min-h-10" />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="w-full text-destructive xl:w-auto"
        onClick={onRemove}
        aria-label="Delete condition"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
