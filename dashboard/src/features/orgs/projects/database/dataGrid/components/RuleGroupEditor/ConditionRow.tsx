import { X } from 'lucide-react';
import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { FormField, FormMessage } from '@/components/ui/v3/form';
import { ColumnAutocomplete } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import { cn, isNotEmptyValue } from '@/lib/utils';
import OperatorComboBox from './OperatorComboBox';
import RuleValueInput from './RuleValueInput';
import useRuleGroupEditor from './useRuleGroupEditor';

type ConditionRowProps = {
  name: string;
  onRemove?: VoidFunction;
  disableRemove?: boolean;
};

type OnHandlerOptions = {
  value: string;
  columnMetadata?: Record<string, unknown>;
  disableReset?: boolean;
};

export default function ConditionRow({
  name,
  onRemove,
  disableRemove,
}: ConditionRowProps) {
  const { schema, table, disabled } = useRuleGroupEditor();
  const { control, setValue, clearErrors } = useFormContext();

  const [selectedTablePath, setSelectedTablePath] = useState('');
  const [selectedColumnType, setSelectedColumnType] = useState('');
  const { field: autocompleteField } = useController({
    name: `${name}.column`,
    control,
  });

  function onHandleChange({
    value,
    columnMetadata,
    disableReset,
  }: OnHandlerOptions) {
    setSelectedTablePath(
      `${columnMetadata?.table_schema}.${columnMetadata?.table_name}`,
    );
    setSelectedColumnType(columnMetadata?.udt_name as string);
    setValue(`${name}.column`, value, { shouldDirty: true });

    if (disableReset) {
      return;
    }

    setValue(`${name}.operator`, '_eq', { shouldDirty: true });
    setValue(`${name}.value`, null, { shouldDirty: true });
    clearErrors();
  }

  function onInitialized({ value, columnMetadata }: OnHandlerOptions) {
    setSelectedTablePath(
      `${columnMetadata?.table_schema}.${columnMetadata?.table_name}`,
    );
    setSelectedColumnType(columnMetadata?.udt_name as string);
    setValue(`${name}.column`, value, { shouldDirty: true });
  }

  return (
    <div className="mt-4 flex flex-col gap-1 space-y-1 overflow-x-hidden xl:grid xl:grid-flow-row xl:grid-cols-[320px_160px_minmax(100px,_1fr)_40px] xl:space-y-0 xl:overflow-x-visible">
      <FormField
        name={`${name}.column`}
        control={control}
        render={({ fieldState }) => {
          const hasError = isNotEmptyValue(fieldState.error?.message);
          return (
            <div className="flex flex-col gap-2">
              <ColumnAutocomplete
                {...autocompleteField}
                disabled={disabled}
                schema={schema}
                table={table}
                className={cn({
                  'border-destructive text-destructive': hasError,
                })}
                onChange={onHandleChange}
                onInitialized={onInitialized}
              />
              <FormMessage />
            </div>
          );
        }}
      />

      <OperatorComboBox
        name={name}
        disabled={disabled}
        selectedColumnType={selectedColumnType}
      />
      <RuleValueInput
        selectedTablePath={selectedTablePath}
        name={name}
        className="min-h-10"
      />

      <Button
        variant="ghost"
        size="icon"
        className="w-full xl:w-auto"
        onClick={onRemove}
        disabled={disabled || disableRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
