import { Controller, useFormContext, useWatch } from 'react-hook-form';
import {
  type ComboboxOption,
  FreeCombobox,
} from '@/components/ui/v3/free-combobox';
import { InlineCode } from '@/components/ui/v3/inline-code';
import type { ColumnDefaultValue } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getPostgresFunctionsKey } from '@/features/orgs/projects/database/dataGrid/utils/getPostgresFunctionsKey';
import {
  POSTGRESQL_FUNCTION_LABELS,
  postgresFunctions,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { FieldArrayInputProps } from './ColumnEditorRow';

const CLEAR_DEFAULT_SENTINEL = '__nhost_clear_default__';

export default function DefaultValueAutocomplete({
  index,
}: FieldArrayInputProps) {
  const { control } = useFormContext();
  const type: string | null = useWatch({ name: `columns.${index}.type` });
  const isNullable = useWatch({ name: `columns.${index}.isNullable` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isIdentity = identityColumnIndex === index;
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const generationExpression = useWatch({
    name: `columns.${index}.generationExpression`,
  });

  const clearLabel = isNullable ? 'NULL' : 'NO DEFAULT VALUE';
  const clearOption: ComboboxOption = {
    value: CLEAR_DEFAULT_SENTINEL,
    label: clearLabel,
    render: <span className="text-muted-foreground">{clearLabel}</span>,
  };

  const functionKey = getPostgresFunctionsKey(type ?? undefined);
  const functionOptions: ComboboxOption[] = (
    postgresFunctions[functionKey as keyof typeof postgresFunctions] ?? []
  ).map((functionName) => {
    const label = POSTGRESQL_FUNCTION_LABELS[functionName] ?? functionName;
    return {
      value: functionName,
      label,
      render: (
        <InlineCode className="bg-transparent px-0 text-xs dark:bg-transparent">
          {label}
        </InlineCode>
      ),
    };
  });

  const availableFunctions = [clearOption, ...functionOptions];

  if (isGenerated) {
    return (
      <div
        className="flex h-10 w-full cursor-not-allowed items-center rounded-md border bg-background px-4 py-2 text-sm opacity-50"
        data-testid={`columns.${index}.generationExpression`}
      >
        <span className="truncate">{generationExpression || ''}</span>
      </div>
    );
  }

  return (
    <Controller
      control={control}
      name={`columns.${index}.defaultValue`}
      render={({ field }) => {
        const current = field.value as ColumnDefaultValue | null;
        const triggerLabel = current ? (
          current.custom ? (
            <span className="italic">{`'${current.value}'`}</span>
          ) : (
            <InlineCode className="bg-transparent px-0 text-xs dark:bg-transparent">
              {POSTGRESQL_FUNCTION_LABELS[current.value] ?? current.value}
            </InlineCode>
          )
        ) : undefined;
        return (
          <FreeCombobox
            value={current?.value ?? null}
            triggerLabel={triggerLabel}
            onChange={(next, meta) => {
              if (next === CLEAR_DEFAULT_SENTINEL) {
                field.onChange(null);
                return;
              }
              field.onChange({
                value: next,
                custom: meta.source === 'custom',
              });
            }}
            onBlur={field.onBlur}
            options={availableFunctions}
            placeholder={isNullable ? 'NULL' : 'NO DEFAULT VALUE'}
            aria-label="Default Value"
            searchPlaceholder="Search..."
            emptyText="Enter a custom default value"
            customValueLabel={(input) => `Use '${input}' as a literal`}
            disabled={isIdentity}
            data-testid={`columns.${index}.defaultValue`}
            popoverContentClassName="w-80"
          />
        );
      }}
    />
  );
}
