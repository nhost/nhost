import { PlusIcon, Sigma } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { usePostgresFunctionsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { useTableComputedFieldsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableComputedFieldsQuery';
import AddComputedFieldPanel from './AddComputedFieldPanel';
import ComputedFieldRow from './ComputedFieldRow';
import ComputedFieldsSectionShell from './ComputedFieldsSectionShell';
import ComputedFieldsSectionSkeleton from './ComputedFieldsSectionSkeleton';

const DEFAULT_SOURCE = 'default';

export interface ComputedFieldsSectionProps {
  disabled?: boolean;
  isUntracked?: boolean;
  schema: string;
  tableName: string;
}

export default function ComputedFieldsSection({
  disabled,
  isUntracked,
  schema,
  tableName,
}: ComputedFieldsSectionProps) {
  const table = { name: tableName, schema };

  const {
    data: computedFields,
    isLoading: isLoadingComputedFields,
    error: computedFieldsError,
    isError: isComputedFieldsError,
  } = useTableComputedFieldsQuery({
    table,
    dataSource: DEFAULT_SOURCE,
  });

  const {
    data: functionsData,
    isLoading: isLoadingFunctions,
    error: functionsError,
    isError: isFunctionsError,
  } = usePostgresFunctionsQuery({
    dataSource: DEFAULT_SOURCE,
    queryOptions: {
      enabled: !isUntracked,
      refetchOnWindowFocus: 'always',
    },
  });

  const {
    data: databaseData,
    isLoading: isLoadingSchemas,
    error: schemasError,
    isError: isSchemasError,
  } = useDatabaseQuery([DEFAULT_SOURCE], {
    queryOptions: { enabled: !isUntracked },
  });

  const [expandedRowName, setExpandedRowName] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleRowOpenChange = (name: string) => (open: boolean) => {
    if (open) {
      setExpandedRowName(name);
      setIsAddingNew(false);
    } else if (expandedRowName === name) {
      setExpandedRowName(null);
    }
  };

  const openAddPanel = () => {
    setIsAddingNew(true);
    setExpandedRowName(null);
  };

  const closeAddPanel = () => {
    setIsAddingNew(false);
  };

  if (isLoadingComputedFields) {
    return <ComputedFieldsSectionSkeleton />;
  }

  const fields = computedFields ?? [];
  const functions = functionsData?.functions ?? [];
  const schemas = (databaseData?.schemas ?? []).map(
    ({ schema_name: schemaName }) => schemaName as string,
  );

  const computedFieldsErrorMessage =
    computedFieldsError instanceof Error
      ? computedFieldsError.message
      : 'An error occurred while loading the computed fields.';

  const functionsErrorMessage =
    functionsError instanceof Error
      ? functionsError.message
      : 'An error occurred while loading the available functions.';

  const schemasErrorMessage =
    schemasError instanceof Error
      ? schemasError.message
      : 'An error occurred while loading the available schemas.';

  const canAdd = !isUntracked && !isComputedFieldsError;

  const headerAction = canAdd ? (
    <Button
      type="button"
      onClick={openAddPanel}
      disabled={disabled || isAddingNew}
      className="text-white"
      data-testid="add-computed-field-trigger"
    >
      <PlusIcon className="mr-2 size-4" />
      New field
    </Button>
  ) : null;

  return (
    <ComputedFieldsSectionShell action={headerAction}>
      {isComputedFieldsError && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load computed fields</AlertTitle>
            <AlertDescription>{computedFieldsErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {isFunctionsError && !isUntracked && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load available functions</AlertTitle>
            <AlertDescription>{functionsErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {isSchemasError && !isUntracked && (
        <div className="px-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load available schemas</AlertTitle>
            <AlertDescription>{schemasErrorMessage}</AlertDescription>
          </Alert>
        </div>
      )}

      {canAdd && (
        <div className="grid gap-2 px-4">
          {isAddingNew && (
            <AddComputedFieldPanel
              table={table}
              source={DEFAULT_SOURCE}
              functions={functions}
              schemas={schemas}
              isFunctionsLoading={isLoadingFunctions}
              isSchemasLoading={isLoadingSchemas}
              disabled={disabled}
              onClose={closeAddPanel}
            />
          )}

          {fields.length === 0 && !isAddingNew && (
            <div className="flex flex-col items-center gap-3 rounded-md border-1 border-dashed bg-muted/20 px-6 py-8 text-center">
              <Sigma aria-hidden className="size-8 text-muted-foreground" />
              <div className="grid gap-1">
                <p className="font-medium text-sm">No computed fields yet</p>
                <p className="max-w-md text-muted-foreground text-sm">
                  Expose Postgres function results as virtual columns by adding
                  your first computed field.
                </p>
              </div>
              <Button
                type="button"
                onClick={openAddPanel}
                disabled={disabled}
                className="text-white"
                data-testid="add-computed-field-empty-cta"
              >
                <PlusIcon className="mr-2 size-4" />
                New field
              </Button>
            </div>
          )}

          {fields.length > 0 && (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_5.25rem] items-center gap-3 rounded-md bg-muted px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <span>Name</span>
                <span>Function</span>
                <span>Comment</span>
                <span className="sr-only">Actions</span>
              </div>
              {fields.map((field) => (
                <ComputedFieldRow
                  key={field.name}
                  field={field}
                  table={table}
                  source={DEFAULT_SOURCE}
                  functions={functions}
                  schemas={schemas}
                  isFunctionsLoading={isLoadingFunctions}
                  isSchemasLoading={isLoadingSchemas}
                  disabled={disabled}
                  isExpanded={expandedRowName === field.name}
                  onOpenChange={handleRowOpenChange(field.name)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {isUntracked && (
        <p className="px-4 text-muted-foreground text-sm">
          Track this table to manage its computed fields.
        </p>
      )}
    </ComputedFieldsSectionShell>
  );
}
