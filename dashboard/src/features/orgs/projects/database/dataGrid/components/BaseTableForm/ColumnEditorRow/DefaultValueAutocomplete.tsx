import { Controller, useFormContext, useWatch } from 'react-hook-form';
import {
  FormAutocompleteCore,
  type FormAutocompleteOption,
} from '@/components/form/FormAutocomplete';
import { InlineCode } from '@/components/ui/v3/inline-code';
import type { ColumnDefaultValue } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { postgresFunctions } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { FieldArrayInputProps } from './ColumnEditorRow';

export default function DefaultValueAutocomplete({
  index,
}: FieldArrayInputProps) {
  const { control } = useFormContext();
  const type: string | null = useWatch({ name: `columns.${index}.type` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isIdentity = identityColumnIndex === index;
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const generationExpression = useWatch({
    name: `columns.${index}.generationExpression`,
  });

  const availableFunctions: FormAutocompleteOption[] = (
    postgresFunctions[type as keyof typeof postgresFunctions] ?? []
  ).map((functionName) => ({
    value: functionName,
    label: functionName,
    render: (
      <InlineCode className="bg-transparent px-0 text-xs dark:bg-transparent">
        {functionName}
      </InlineCode>
    ),
  }));

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
              {current.value}
            </InlineCode>
          )
        ) : undefined;
        return (
          <FormAutocompleteCore
            value={current?.value ?? null}
            triggerLabel={triggerLabel}
            onChange={(next, meta) => {
              if (next === null) {
                field.onChange(null);
                return;
              }
              field.onChange({
                value: next,
                custom: meta?.source === 'custom',
              });
            }}
            onBlur={field.onBlur}
            options={availableFunctions}
            placeholder="NULL"
            aria-label="Default Value"
            searchPlaceholder="Search functions..."
            emptyText="Enter a custom default value"
            allowCustomValue
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
