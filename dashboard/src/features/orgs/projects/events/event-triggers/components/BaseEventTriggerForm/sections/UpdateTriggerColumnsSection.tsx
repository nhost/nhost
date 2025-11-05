import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/v3/field';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isEmptyValue } from '@/lib/utils';
import { Controller, useFormContext } from 'react-hook-form';

export default function UpdateTriggerColumnsSection() {
  const { watch, control } = useFormContext<BaseEventTriggerFormValues>();

  const selectedTableSchema = watch('tableSchema');
  const selectedTableName = watch('tableName');

  const { data: selectedTableData, isLoading } = useTableQuery(
    [`default.${selectedTableSchema}.${selectedTableName}`],
    {
      schema: selectedTableSchema,
      table: selectedTableName,
      queryOptions: {
        enabled: !!selectedTableSchema && !!selectedTableName,
      },
    },
  );

  console.log('selectedTableData', selectedTableData?.columns[0]?.data_type);

  const columns =
    selectedTableData?.columns
      ?.map((column) => (column.column_name as string) ?? null)
      .filter(Boolean) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full max-w-xs" />
        <div className="flex max-w-lg flex-row gap-6">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Controller
      name="updateTriggerColumns"
      control={control}
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label" className="text-foreground">
            List of columns to trigger
          </FieldLegend>
          <FieldGroup
            data-slot="checkbox-group"
            className="flex flex-row items-center justify-start !gap-8"
          >
            {isEmptyValue(columns) ? (
              <p className="text-muted-foreground">
                Select a table first to see the columns
              </p>
            ) : (
              columns.map((column) => (
                <Field
                  key={column}
                  orientation="horizontal"
                  data-invalid={fieldState.invalid}
                  className="w-auto"
                >
                  <Checkbox
                    id={`column-on-update-${column}`}
                    name={field.name}
                    aria-invalid={fieldState.invalid}
                    checked={field.value?.includes(column)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...(field.value ?? []), column]
                        : (field.value ?? []).filter(
                            (value) => value !== column,
                          );
                      field.onChange(newValue);
                    }}
                  />
                  <FieldLabel
                    htmlFor={`column-on-update-${column}`}
                    className="font-normal text-foreground"
                  >
                    {column}
                  </FieldLabel>
                </Field>
              ))
            )}
          </FieldGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </FieldSet>
      )}
    />
  );
}
