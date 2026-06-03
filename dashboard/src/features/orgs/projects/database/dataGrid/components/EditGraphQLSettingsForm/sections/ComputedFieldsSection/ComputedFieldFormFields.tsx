import { ExternalLink, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { singular } from 'pluralize';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormAutocomplete,
  type FormAutocompleteOption,
} from '@/components/form/FormAutocomplete';
import { FormInput } from '@/components/form/FormInput';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { isComputedFieldFunction } from '@/features/orgs/projects/database/dataGrid/utils/isComputedFieldFunction';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import type { ComputedFieldFormValues } from './computedFieldFormTypes';
import FunctionDefinitionPreview from './FunctionDefinitionPreview';

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
  const { query } = useRouter();
  const { control, watch, setValue } =
    useFormContext<ComputedFieldFormValues>();

  const selectedSchema = watch('functionSchema');
  const selectedFunctionName = watch('functionName');

  const schemaOptions: FormAutocompleteOption[] = useMemo(
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

  const functionOptions: FormAutocompleteOption[] = useMemo(
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

  // Clearing a stale function belongs to the schema-change event, not a render
  // effect: it fires only when the user picks a different schema, so a name
  // typed for the "Create function" CTA survives re-renders and a programmatic
  // form.reset() never wipes it. We match against the raw `functions` by the
  // incoming schema — `functionsInSelectedSchema` still reflects the old one here.
  const handleSchemaChange = (newSchema: string | null) => {
    if (!selectedFunctionName) {
      return;
    }
    const existsInNewSchema = functions.some(
      (fn) =>
        fn.function_schema === newSchema &&
        fn.function_name === selectedFunctionName &&
        isComputedFieldFunction(fn, table),
    );
    if (!existsInNewSchema) {
      setValue('functionName', '', { shouldDirty: true });
    }
  };

  const selectedFunction = useMemo(
    () =>
      functionsInSelectedSchema.find(
        (fn) => fn.function_name === selectedFunctionName,
      ),
    [functionsInSelectedSchema, selectedFunctionName],
  );

  const openSqlEditorWith = (sqlSource: string) => {
    const { orgSlug, appSubdomain, dataSourceSlug } = query;
    if (
      typeof orgSlug !== 'string' ||
      typeof appSubdomain !== 'string' ||
      typeof dataSourceSlug !== 'string'
    ) {
      return;
    }
    const url = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/editor?sql=${encodeURIComponent(sqlSource)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openCreateFunctionEditor = (functionName: string) => {
    const fnSchema = selectedSchema || table.schema;
    openSqlEditorWith(
      buildCreateFunctionTemplate({
        schema: fnSchema,
        table,
        functionName: functionName.trim() || DEFAULT_NEW_FUNCTION_NAME,
      }),
    );
  };

  const handleFunctionNameChange = (value: string | null) => {
    if (
      value &&
      !functionsInSelectedSchema.some((fn) => fn.function_name === value)
    ) {
      openCreateFunctionEditor(value);
    }
  };

  const handleEditSelectedFunction = () => {
    if (!selectedFunction?.function_definition) {
      return;
    }
    openSqlEditorWith(selectedFunction.function_definition);
  };

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
          <FormAutocomplete
            control={control}
            name="functionSchema"
            label="Function Schema"
            aria-label="Function Schema"
            placeholder="Select a schema"
            searchPlaceholder="Search schemas..."
            emptyText={
              isSchemasLoading ? 'Loading schemas...' : 'No schemas available.'
            }
            options={schemaOptions}
            disabled={fieldsDisabled || isSchemasLoading}
            onChange={handleSchemaChange}
          />
          <FormAutocomplete
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
            allowCustomValue
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
                <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </span>
            )}
            onChange={handleFunctionNameChange}
          />
        </div>
        {selectedFunction?.function_definition && (
          <FunctionDefinitionPreview
            functionLabel={`${selectedFunction.function_schema}.${selectedFunction.function_name}`}
            definition={selectedFunction.function_definition}
            onEditInSqlEditor={handleEditSelectedFunction}
          />
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
