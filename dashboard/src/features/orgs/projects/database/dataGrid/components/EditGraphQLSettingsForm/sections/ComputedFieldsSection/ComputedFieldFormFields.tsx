import { Plus } from 'lucide-react';
import { singular } from 'pluralize';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import {
  FormFreeCombobox,
  type FormFreeComboboxOption,
} from '@/components/form/FormFreeCombobox';
import { FormInput } from '@/components/form/FormInput';
import type { ComboboxOption } from '@/components/ui/v3/combobox';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { isComputedFieldFunction } from '@/features/orgs/projects/database/dataGrid/utils/isComputedFieldFunction';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import type { ComputedFieldFormValues } from './computedFieldFormTypes';

const DEFAULT_NEW_FUNCTION_NAME = 'my_computed_field';

function buildCreateFunctionTemplate({
  schema,
  table,
  functionName,
}: {
  schema: string;
  table: QualifiedTable;
  functionName: string;
}) {
  const rowArgName = `${singular(table.name)}_row`;
  return `-- Computed field function for "${table.schema}.${table.name}"
-- The first argument "${rowArgName}" must accept a row of "${table.schema}.${table.name}".
CREATE OR REPLACE FUNCTION ${schema}.${functionName}(${rowArgName} ${table.schema}.${table.name})
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT ''::text;
$$;
`;
}

export interface ComputedFieldFormFieldsProps {
  functions: PostgresFunction[];
  schemas: string[];
  table: QualifiedTable;
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
}

export default function ComputedFieldFormFields({
  functions,
  schemas,
  table,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
}: ComputedFieldFormFieldsProps) {
  const { control, watch, setValue } =
    useFormContext<ComputedFieldFormValues>();

  const selectedSchema = watch('functionSchema');
  const selectedFunctionName = watch('functionName');

  const schemaOptions: ComboboxOption[] = useMemo(
    () =>
      [...schemas].sort().map((schema) => ({ value: schema, label: schema })),
    [schemas],
  );

  const functionsInSelectedSchema = useMemo(
    () =>
      functions.filter(
        (fn) =>
          fn.function_schema === selectedSchema &&
          isComputedFieldFunction(fn, table),
      ),
    [functions, selectedSchema, table],
  );

  const functionOptions: FormFreeComboboxOption[] = useMemo(
    () =>
      functionsInSelectedSchema.map((fn) => ({
        value: fn.function_name,
        label: fn.function_name,
        render: (
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="font-mono text-sm">{fn.function_name}</span>
            <span className="truncate text-muted-foreground text-xs">
              ({fn.function_arguments || 'no arguments'})
            </span>
          </span>
        ),
      })),
    [functionsInSelectedSchema],
  );

  const selectedFunction = useMemo(
    () =>
      functionsInSelectedSchema.find(
        (fn) => fn.function_name === selectedFunctionName,
      ),
    [functionsInSelectedSchema, selectedFunctionName],
  );

  const functionEditorSQL = useMemo(() => {
    if (selectedFunction) {
      return selectedFunction.function_definition ?? null;
    }
    if (selectedFunctionName) {
      return buildCreateFunctionTemplate({
        schema: selectedSchema || table.schema,
        table,
        functionName: selectedFunctionName.trim() || DEFAULT_NEW_FUNCTION_NAME,
      });
    }
    return null;
  }, [selectedFunction, selectedFunctionName, selectedSchema, table]);

  const commentPlaceholder =
    selectedSchema && selectedFunctionName
      ? `Executes function ${selectedSchema}.${selectedFunctionName}`
      : 'Computed field that executes a function';

  const fieldsDisabled = Boolean(disabled);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          control={control}
          name="name"
          label="Computed Field Name"
          placeholder="field_name"
          disabled={fieldsDisabled}
          autoComplete="off"
          className="!bg-background"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          control={control}
          name="comment"
          label="Comment"
          placeholder={commentPlaceholder}
          disabled={fieldsDisabled}
          autoComplete="off"
          className="!bg-background"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormCombobox
            control={control}
            name="functionSchema"
            label="Function Schema"
            options={schemaOptions}
            placeholder="Select a schema"
            searchPlaceholder="Search schemas..."
            emptyText={
              isSchemasLoading ? 'Loading schemas...' : 'No schemas available.'
            }
            disabled={fieldsDisabled || isSchemasLoading}
            onChange={(next) => {
              if (next !== selectedSchema) {
                setValue('functionName', '', { shouldDirty: true });
              }
            }}
          />
          <FormFreeCombobox
            control={control}
            name="functionName"
            label="Function Name"
            aria-label="Function Name"
            placeholder={
              selectedSchema ? 'Select a function' : 'Select a schema first'
            }
            searchPlaceholder="Search or type a new function name..."
            emptyText={
              isFunctionsLoading
                ? 'Loading functions...'
                : 'No compatible functions in this schema.'
            }
            options={functionOptions}
            disabled={fieldsDisabled || isFunctionsLoading || !selectedSchema}
            customValueLabel={(input) => (
              <span
                className="flex w-full min-w-0 items-center"
                data-testid="computed-field-new-function-action"
              >
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  Create function{' '}
                  <span className="font-mono">&quot;{input}&quot;</span>
                </span>
              </span>
            )}
          />
        </div>
        {functionEditorSQL !== null && (
          <div className="flex h-[420px] flex-col overflow-hidden rounded-md border">
            <SQLEditor
              key={`${selectedSchema}:${selectedFunctionName}`}
              initialSQL={functionEditorSQL}
              hideEmptyResults
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          control={control}
          name="tableArgument"
          label={
            <div className="flex flex-row items-center gap-2">
              Table Row Argument{' '}
              <InfoTooltip>
                The argument of the function that receives the table row.
                Defaults to the first argument.
              </InfoTooltip>
            </div>
          }
          placeholder="first argument (default)"
          disabled={fieldsDisabled}
          autoComplete="off"
          className="!bg-background"
        />
        <FormInput
          control={control}
          name="sessionArgument"
          label={
            <div className="flex flex-row items-center gap-2">
              Session Argument{' '}
              <InfoTooltip>
                The argument that receives the User Session as JSON.
              </InfoTooltip>
            </div>
          }
          placeholder="user_session"
          disabled={fieldsDisabled}
          autoComplete="off"
          className="!bg-background"
        />
      </div>
    </div>
  );
}
