import { ArrowRight, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useFieldArray, useFormContext, useFormState } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button } from '@/components/ui/v3/button';
import { SelectItem, SelectSeparator } from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { CustomTypeObjectField } from '@/utils/hasura-api/generated/schemas';
import type { ActionRelationshipFormValues } from './ActionRelationshipFormTypes';

export interface FieldMappingSectionProps {
  /**
   * Fields of the action's output type. These are the left-hand side of every
   * mapping (output type field -> remote table column).
   */
  outputTypeFields: CustomTypeObjectField[];
}

export default function FieldMappingSection({
  outputTypeFields,
}: FieldMappingSectionProps) {
  const { control, watch } = useFormContext<ActionRelationshipFormValues>();
  const { errors } = useFormState({ control, name: 'fieldMapping' });

  const source = watch('source');
  const schema = watch('schema');
  const table = watch('table');

  const {
    fields: fieldMappingFields,
    append: appendFieldMapping,
    remove: removeFieldMapping,
  } = useFieldArray({ control, name: 'fieldMapping' });

  const { data: tableData } = useTableSchemaQuery(
    [`${source}.${schema}.${table}`],
    {
      dataSource: source,
      schema,
      table,
      queryOptions: {
        enabled: Boolean(source && schema && table),
      },
    },
  );

  const referenceColumns = useMemo(
    () =>
      tableData?.columns
        ?.map((column: { column_name?: string }) => column.column_name ?? '')
        ?.filter(Boolean) ?? [],
    [tableData],
  );

  const sourceFieldNames = useMemo(
    () => outputTypeFields.map((field) => field.name),
    [outputTypeFields],
  );

  const watchedMappings = watch('fieldMapping') ?? [];
  const selectedSourceFields = new Set(
    watchedMappings
      .map((mapping) => mapping?.sourceField)
      .filter(Boolean) as string[],
  );
  const firstUnusedSourceField =
    sourceFieldNames.find((name) => !selectedSourceFields.has(name)) ?? '';
  const allSourceFieldsSelected =
    sourceFieldNames.length > 0 &&
    sourceFieldNames.every((name) => selectedSourceFields.has(name));

  const fieldMappingError =
    errors.fieldMapping?.root?.message ?? errors.fieldMapping?.message;

  return (
    <>
      <FormSelect
        control={control}
        name="type"
        label="Relationship Type"
        placeholder="Select relationship type"
      >
        <SelectItem value="object">Object Relationship</SelectItem>
        <SelectItem value="array">Array Relationship</SelectItem>
      </FormSelect>

      <div className="space-y-2 rounded-md border p-4">
        <div className="grid grid-cols-12 items-center gap-2 font-semibold text-muted-foreground text-sm">
          <span className="col-span-5">Source Field</span>
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
                control={control}
                name={`fieldMapping.${index}.sourceField`}
                placeholder="Select source field"
                containerClassName="col-span-5"
                data-testid={`fieldMapping.${index}.sourceField`}
              >
                {sourceFieldNames.map((fieldName) => (
                  <SelectItem
                    key={fieldName}
                    value={fieldName}
                    disabled={
                      selectedSourceFields.has(fieldName) &&
                      watchedMappings[index]?.sourceField !== fieldName
                    }
                  >
                    {fieldName}
                  </SelectItem>
                ))}
                {sourceFieldNames.length === 0 && (
                  <SelectItem disabled value="__no-source-fields">
                    No fields available
                  </SelectItem>
                )}
              </FormSelect>

              <div className="col-span-2 flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <FormSelect
                control={control}
                name={`fieldMapping.${index}.referenceColumn`}
                placeholder="Select reference column"
                containerClassName="col-span-4 col-start-8"
                data-testid={`fieldMapping.${index}.referenceColumn`}
              >
                {referenceColumns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
                {referenceColumns.length === 0 && (
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
                  sourceField: firstUnusedSourceField,
                  referenceColumn: referenceColumns[0] ?? '',
                })
              }
              disabled={
                sourceFieldNames.length === 0 ||
                referenceColumns.length === 0 ||
                allSourceFieldsSelected
              }
            >
              <PlusIcon className="h-4 w-4" /> Add New Mapping
            </Button>
          </div>

          {fieldMappingError && (
            <p className="font-medium text-destructive text-sm">
              {fieldMappingError}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
