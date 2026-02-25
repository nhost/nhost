import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useSetTableCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation';
import { useTableCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { convertSnakeToCamelCase } from '@/features/orgs/projects/database/dataGrid/utils/convertSnakeToCamelCase';
import { prepareCustomGraphQLColumnNameDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareCustomGraphQLColumnNameDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn, isEmptyValue } from '@/lib/utils';
import ColumnsNameCustomizationSectionSkeleton from './ColumnsNameCustomizationSectionSkeleton';

export interface ColumnsNameCustomizationSectionProps {
  disabled?: boolean;
  isUntracked?: boolean;
  schema: string;
  tableName: string;
}

type GraphQLFieldNamePath = `columns.${string}.graphqlFieldName`;

const validationSchema = z.object({
  columns: z.record(
    z.string(),
    z.object({
      graphqlFieldName: z.string().optional(),
    }),
  ),
});

export type ColumnsNameCustomizationFormValues = z.infer<
  typeof validationSchema
>;

export default function ColumnsNameCustomizationSection({
  disabled,
  isUntracked,
  schema,
  tableName,
}: ColumnsNameCustomizationSectionProps) {
  const form = useForm<ColumnsNameCustomizationFormValues>({
    defaultValues: {
      columns: {},
    },
    resolver: zodResolver(validationSchema),
  });

  const {
    data: tableCustomization,
    isLoading: isLoadingTableCustomization,
    refetch: refetchTableCustomization,
    error: tableCustomizationError,
    isError: isTableCustomizationError,
  } = useTableCustomizationQuery({
    table: {
      name: tableName,
      schema,
    },
    dataSource: 'default',
  });

  const columnConfig = tableCustomization?.column_config;

  const {
    data: tableData,
    error: tableDataError,
    isError: isTableDataError,
    isLoading: isLoadingTableQuery,
  } = useTableQuery([`default.${schema}.${tableName}`], {
    schema,
    table: tableName,
  });

  const tableColumns = tableData?.columns;

  const { formState, reset, getValues, setValue } = form;
  const { isDirty, isSubmitting } = formState;

  useEffect(() => {
    if (
      isLoadingTableCustomization ||
      isLoadingTableQuery ||
      isEmptyValue(tableColumns) ||
      isEmptyValue(columnConfig)
    ) {
      return;
    }

    const defaultColumnValues = tableColumns?.reduce<
      ColumnsNameCustomizationFormValues['columns']
    >((acc, column) => {
      const columnName = column?.column_name;

      if (typeof columnName !== 'string') {
        return acc;
      }

      const graphqlFieldName = columnConfig?.[columnName]?.custom_name || '';
      // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
      acc[columnName] = {
        graphqlFieldName,
      };

      return acc;
    }, {});

    reset({ columns: defaultColumnValues });
  }, [
    isLoadingTableQuery,
    isLoadingTableCustomization,
    tableColumns,
    columnConfig,
    reset,
  ]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: setTableCustomization } =
    useSetTableCustomizationMutation();

  const handleSubmit = form.handleSubmit(async (values) => {
    const dto = prepareCustomGraphQLColumnNameDTO(values, tableCustomization);
    const promise = setTableCustomization({
      resourceVersion,
      args: {
        table: {
          name: tableName,
          schema,
        },
        source: 'default',
        configuration: dto,
      },
      prevConfig: tableCustomization,
      customizationType: 'CUSTOM_COLUMN_NAMES',
    });
    await execPromiseWithErrorToast(() => promise, {
      loadingMessage: 'Setting GraphQL column names...',
      successMessage: 'GraphQL column names set successfully.',
      errorMessage: 'An error occurred while setting GraphQL column names.',
    });
    await refetchTableCustomization();
    form.reset(values, { keepValues: true, keepDirty: false });
  });

  const handleResetToDefaultClick = () => {
    const columns = getValues('columns');
    const newColumns = Object.fromEntries(
      Object.keys(columns).map((columnName) => [
        columnName,
        { graphqlFieldName: '' },
      ]),
    );
    setValue('columns', newColumns, {
      shouldDirty: true,
    });
  };

  const handleMakeCamelCaseClick = () => {
    const columns = getValues('columns');
    Object.entries(columns).forEach(([defaultFieldValue, value]) => {
      const currentValue = value.graphqlFieldName;
      const newValue = convertSnakeToCamelCase(
        currentValue || defaultFieldValue,
      );
      setValue(`columns.${defaultFieldValue}.graphqlFieldName`, newValue, {
        shouldDirty: true,
      });
    });
  };

  const isError = Boolean(isTableDataError || isTableCustomizationError);

  const tableDataErrorMessage =
    tableDataError instanceof Error
      ? tableDataError.message
      : 'An error occurred while loading the columns for this table.';
  const tableCustomizationErrorMessage =
    tableCustomizationError instanceof Error
      ? tableCustomizationError.message
      : 'An error occurred while loading the columns for this table.';

  const displayColumns = tableColumns ?? [];

  if (isLoadingTableQuery || isLoadingTableCustomization) {
    return <ColumnsNameCustomizationSectionSkeleton />;
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-4">
        <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
          <div className="grid grid-flow-col place-content-between gap-3 px-4">
            <div className="grid grid-flow-col gap-4">
              <div className="grid grid-flow-row gap-1">
                <h2 className="font-semibold text-lg">GraphQL Field Names</h2>

                <p className="text-muted-foreground text-sm+">
                  Expose each column with a different name in your GraphQL API.
                </p>
              </div>
            </div>
          </div>
          {isError ? (
            <div className="px-4">
              <Alert variant="destructive">
                <AlertTitle>Unable to load column field names</AlertTitle>
                <AlertDescription>
                  {tableDataErrorMessage && <p>{tableDataErrorMessage}</p>}
                  {tableCustomizationErrorMessage && (
                    <p>{tableCustomizationErrorMessage}</p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="px-4">
                <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  <span>Column</span>
                  <span>Data Type</span>
                  <span>GraphQL Field Name</span>
                </div>

                <div className="space-y-2 py-3">
                  {displayColumns.length === 0 && (
                    <div className="rounded-md px-4 py-8 text-center text-muted-foreground text-sm">
                      No columns were found for this table.
                    </div>
                  )}

                  {displayColumns.map((column) => {
                    const columnName: string = column.column_name;

                    if (isEmptyValue(columnName)) {
                      return null;
                    }

                    const dataType: string =
                      column.full_data_type || column.data_type || 'unknown';
                    const fieldPath =
                      `columns.${columnName}.graphqlFieldName` satisfies GraphQLFieldNamePath;

                    return (
                      <div
                        key={columnName}
                        className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-background py-3 pr-0 pl-4"
                      >
                        <div className="space-y-1">
                          <span className="font-medium text-foreground text-sm">
                            {columnName}
                          </span>
                        </div>

                        <span className="font-mono text-foreground text-sm">
                          {dataType}
                        </span>

                        <FormInput
                          disabled={disabled || isUntracked}
                          control={form.control}
                          name={fieldPath}
                          label=""
                          placeholder={`${columnName} (default)`}
                          className="pr-4 font-mono"
                          containerClassName="space-y-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {isUntracked && (
            <p className="px-4 text-muted-foreground text-sm">
              Track this table to customize its GraphQL settings.
            </p>
          )}
          {!disabled && !isUntracked && (
            <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  color="secondary"
                  type="button"
                  onClick={handleResetToDefaultClick}
                  disabled={isError || isSubmitting}
                >
                  Reset to default
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleMakeCamelCaseClick}
                  disabled={isError || isSubmitting}
                >
                  Make camelCase
                </Button>
              </div>
              <ButtonWithLoading
                variant={isDirty ? 'default' : 'outline'}
                type="submit"
                disabled={!isDirty || isError}
                loading={isSubmitting}
                className={cn('text-sm+', { 'text-white': isDirty })}
              >
                Save
              </ButtonWithLoading>
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
