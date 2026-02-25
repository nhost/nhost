import { ArrowRight, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button } from '@/components/ui/v3/button';
import { FormField, FormItem, FormMessage } from '@/components/ui/v3/form';
import { SelectItem, SelectSeparator } from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { BaseRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';

export default function TableRelationshipDetails() {
  const form = useFormContext<BaseRelationshipFormValues>();

  const { watch, control } = form;

  const selectedFromSource = watch('fromSource');
  const selectedToReference = watch('toReference');

  const {
    fields: fieldMappingFields,
    append: appendFieldMapping,
    remove: removeFieldMapping,
  } = useFieldArray({
    control,
    name: 'fieldMapping',
  });

  const { data: fromTableData } = useTableSchemaQuery(
    [
      `${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
    ],
    {
      dataSource: selectedFromSource?.source,
      schema: selectedFromSource?.schema,
      table: selectedFromSource?.table,
      queryOptions: {
        enabled: Boolean(
          selectedFromSource?.source &&
            selectedFromSource?.schema &&
            selectedFromSource?.table,
        ),
      },
    },
  );

  const { data: toTableData } = useTableSchemaQuery(
    [
      `${selectedToReference?.source}.${selectedToReference?.schema}.${selectedToReference?.table}`,
    ],
    {
      dataSource: selectedToReference?.source,
      schema: selectedToReference?.schema,
      table: selectedToReference?.table,
      queryOptions: {
        enabled: Boolean(
          selectedToReference?.source &&
            selectedToReference?.schema &&
            selectedToReference?.table,
        ),
      },
    },
  );

  const fromColumns = useMemo(
    () =>
      fromTableData?.columns
        ?.map((column: { column_name?: string }) => column.column_name ?? '')
        ?.filter(Boolean) ?? [],
    [fromTableData],
  );

  const toColumns = useMemo(
    () =>
      toTableData?.columns
        ?.map((column: { column_name?: string }) => column.column_name ?? '')
        ?.filter(Boolean) ?? [],
    [toTableData],
  );

  return (
    <>
      <FormSelect
        control={form.control}
        name="relationshipType"
        label="Relationship Type"
        placeholder="Select relationship type"
      >
        <SelectItem value="pg_create_object_relationship">
          Object Relationship
        </SelectItem>
        <SelectItem value="pg_create_array_relationship">
          Array Relationship
        </SelectItem>
      </FormSelect>

      <div className="space-y-2 rounded-md border p-4">
        <div className="grid grid-cols-12 items-center gap-2 font-semibold text-muted-foreground text-sm">
          <span className="col-span-5">Source Column</span>
          <div className="col-span-2 flex justify-center">
            <ArrowRight className="h-4 w-4" />
          </div>
          <span className="col-span-5 text-right">Reference Column</span>
        </div>
        <SelectSeparator />
        <div className="space-y-3">
          {fieldMappingFields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-12 items-center gap-2"
            >
              <FormSelect
                control={form.control}
                name={`fieldMapping.${index}.sourceColumn`}
                placeholder="Select source column"
                containerClassName="col-span-5"
                data-testid={`fieldMapping.${index}.sourceColumn`}
              >
                {fromColumns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
                {fromColumns.length === 0 && (
                  <SelectItem disabled value="__no-source-columns">
                    No columns available
                  </SelectItem>
                )}
              </FormSelect>

              <div className="col-span-2 flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <FormSelect
                control={form.control}
                name={`fieldMapping.${index}.referenceColumn`}
                placeholder="Select reference column"
                containerClassName="col-span-4 col-start-8"
                data-testid={`fieldMapping.${index}.referenceColumn`}
              >
                {toColumns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
                {toColumns.length === 0 && (
                  <SelectItem disabled value="__no-reference-columns">
                    No columns available
                  </SelectItem>
                )}
              </FormSelect>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeFieldMapping(index)}
                disabled={fieldMappingFields.length === 0}
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex justify-start">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              onClick={() =>
                appendFieldMapping({
                  sourceColumn: fromColumns[0] ?? '',
                  referenceColumn: toColumns[0] ?? '',
                })
              }
              disabled={fromColumns.length === 0 || toColumns.length === 0}
            >
              <PlusIcon className="h-4 w-4" /> Add New Mapping
            </Button>
          </div>

          <FormField
            control={form.control}
            name="fieldMapping"
            render={() => (
              <FormItem>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </>
  );
}
