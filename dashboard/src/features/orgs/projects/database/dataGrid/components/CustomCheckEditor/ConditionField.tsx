import { useController, useFormContext } from 'react-hook-form';
import { FormField, FormMessage } from '@/components/ui/v3/form';
import { ColumnAutocomplete } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import type {
  ConditionFieldRendererProps,
  ConditionFieldSelection,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import useCustomCheckEditor from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import { cn, isNotEmptyValue } from '@/lib/utils';

interface ColumnChangeOptions {
  value: string;
  columnMetadata: Record<string, unknown>;
  disableReset?: boolean;
}

function getSelection(
  columnMetadata: Record<string, unknown>,
): ConditionFieldSelection {
  return {
    fieldPath: `${columnMetadata?.table_schema}.${columnMetadata?.table_name}`,
    fieldType: columnMetadata?.udt_name as string,
  };
}

export default function ConditionField({
  name,
  onFieldSelectionChange,
}: ConditionFieldRendererProps) {
  const { schema, table } = useCustomCheckEditor();
  const { control, setValue, clearErrors } = useFormContext();
  const { field } = useController({
    name: `${name}.column`,
    control,
  });

  function handleChange({
    value,
    columnMetadata,
    disableReset,
  }: ColumnChangeOptions) {
    onFieldSelectionChange(getSelection(columnMetadata));
    setValue(`${name}.column`, value, { shouldDirty: true });

    if (disableReset) {
      return;
    }

    setValue(`${name}.operator`, '_eq', { shouldDirty: true });
    setValue(`${name}.value`, null, { shouldDirty: true });
    clearErrors();
  }

  function handleInitialized({ value, columnMetadata }: ColumnChangeOptions) {
    onFieldSelectionChange(getSelection(columnMetadata));
    setValue(`${name}.column`, value, { shouldDirty: true });
  }

  return (
    <FormField
      name={`${name}.column`}
      control={control}
      render={({ fieldState }) => {
        const hasError = isNotEmptyValue(fieldState.error?.message);
        return (
          <div className="flex flex-col gap-2">
            <ColumnAutocomplete
              {...field}
              schema={schema}
              table={table}
              disableRelationships
              className={cn({
                'border-destructive text-destructive': hasError,
              })}
              onChange={handleChange}
              onInitialized={handleInitialized}
            />
            <FormMessage />
          </div>
        );
      }}
    />
  );
}
