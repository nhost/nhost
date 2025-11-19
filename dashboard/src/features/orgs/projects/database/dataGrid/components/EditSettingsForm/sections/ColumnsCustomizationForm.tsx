import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

export interface ColumnsCustomizationFormProps {
  schema: string;
  tableName: string;
}

interface ColumnGraphQLFieldValue {
  graphqlFieldName: string;
}

interface ColumnsCustomizationFormValues {
  columns: Record<string, ColumnGraphQLFieldValue>;
}

type GraphQLFieldNamePath = `columns.${string}.graphqlFieldName`;

const COLUMN_SKELETON_KEYS = ['first', 'second', 'third', 'fourth'];

export default function ColumnsCustomizationForm({
  schema,
  tableName,
}: ColumnsCustomizationFormProps) {
  const form = useForm<ColumnsCustomizationFormValues>({
    defaultValues: {
      columns: {},
    },
  });

  const {
    data,
    status: columnsStatus,
    error: columnsError,
    isLoading,
    isFetching,
  } = useTableQuery([`default.${schema}.${tableName}`], {
    schema,
    table: tableName,
  });

  const { formState } = form;
  const { isDirty, isSubmitting } = formState;
  const tableKeyRef = useRef(`${schema}.${tableName}`);
  const tableColumns = data?.columns;

  useEffect(() => {
    const tableKey = `${schema}.${tableName}`;
    const hasTableChanged = tableKeyRef.current !== tableKey;

    if (!tableColumns || tableColumns.length === 0) {
      if (hasTableChanged) {
        form.reset({ columns: {} });
        tableKeyRef.current = tableKey;
      }

      return;
    }

    if (!hasTableChanged && isDirty) {
      return;
    }

    const defaultColumnValues = tableColumns.reduce<
      ColumnsCustomizationFormValues['columns']
    >((acc, column) => {
      const columnName = column?.column_name;

      if (typeof columnName !== 'string') {
        return acc;
      }

      acc[columnName] = {
        graphqlFieldName: columnName,
      };

      return acc;
    }, {});

    form.reset({ columns: defaultColumnValues });
    tableKeyRef.current = tableKey;
  }, [form, isDirty, schema, tableColumns, tableName]);

  const handleSubmit = form.handleSubmit(async () => {
    // TODO: Integrate with the data grid settings API.
  });

  const isLoadingColumns = isLoading || isFetching;
  const isError = columnsStatus === 'error';
  const displayColumns = tableColumns ?? [];

  const errorMessage =
    columnsError instanceof Error
      ? columnsError.message
      : 'Something went wrong while loading the columns for this table.';

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col gap-4 overflow-y-auto px-6 pb-4"
      >
        <SettingsContainer
          title="GraphQL Field Names"
          description="Align each column with the GraphQL field name exposed through your API."
          slotProps={{
            submitButton: {
              disabled: !isDirty,
              loading: isSubmitting,
            },
          }}
        >
          {isError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load columns</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border">
                <div className="grid grid-cols-[minmax(0,1fr),160px,minmax(0,1.2fr)] items-center gap-3 rounded-t-lg bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Column</span>
                  <span>Data Type</span>
                  <span>GraphQL Field Name</span>
                </div>

                <div className="space-y-2 px-4 py-3">
                  {isLoadingColumns &&
                    COLUMN_SKELETON_KEYS.map((placeholderKey) => (
                      <div
                        key={`column-skeleton-${placeholderKey}`}
                        className="h-[82px] animate-pulse rounded-md border border-border/60 bg-muted/50"
                      />
                    ))}

                  {!isLoadingColumns && displayColumns.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      No columns were found for this table.
                    </div>
                  )}

                  {!isLoadingColumns &&
                    displayColumns.map((column) => {
                      const columnName = column.column_name as string;

                      if (!columnName) {
                        return null;
                      }

                      const dataType =
                        (column.full_data_type as string) ||
                        (column.data_type as string) ||
                        'unknown';
                      const columnDescription =
                        (column.column_comment as string) || '';
                      const fieldPath =
                        `columns.${columnName}.graphqlFieldName` as GraphQLFieldNamePath;

                      return (
                        <div
                          key={columnName}
                          className="grid grid-cols-[minmax(0,1fr),160px,minmax(0,1.2fr)] items-start gap-3 rounded-md border border-border/80 bg-background px-4 py-3"
                        >
                          <div className="space-y-1">
                            <span className="text-sm font-medium text-foreground">
                              {columnName}
                            </span>
                            {columnDescription && (
                              <span className="text-xs text-muted-foreground">
                                {columnDescription}
                              </span>
                            )}
                          </div>

                          <Badge
                            variant="secondary"
                            className="justify-center whitespace-nowrap px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
                            title={dataType}
                          >
                            {dataType}
                          </Badge>

                          <FormField
                            control={form.control}
                            name={fieldPath}
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={columnName}
                                    className="font-mono"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </SettingsContainer>
      </form>
    </Form>
  );
}
