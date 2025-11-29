import { FormInput } from '@/components/form/FormInput';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Form } from '@/components/ui/v3/form';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useSetTableCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation';
import { useTableCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { prepareCustomGraphQLColumnNameDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareCustomGraphQLColumnNameDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import ColumnsCustomizationSectionSkeleton from './ColumnsCustomizationSectionSkeleton';

export interface ColumnsCustomizationSectionProps {
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

export type ColumnsCustomizationFormValues = z.infer<typeof validationSchema>;

export default function ColumnsCustomizationSection({
  schema,
  tableName,
}: ColumnsCustomizationSectionProps) {
  const form = useForm<ColumnsCustomizationFormValues>({
    defaultValues: {
      columns: {},
    },
    resolver: zodResolver(validationSchema),
  });

  const {
    data: tableConfig,
    isLoading: isLoadingTableCustomization,
    refetch: refetchTableCustomization,
  } = useTableCustomizationQuery({
    table: {
      name: tableName,
      schema,
    },
    dataSource: 'default',
  });

  const {
    data,
    status: columnsStatus,
    error: columnsError,
    isLoading,
  } = useTableQuery([`default.${schema}.${tableName}`], {
    schema,
    table: tableName,
  });

  const { formState } = form;
  const { isDirty, isSubmitting } = formState;
  const tableColumns = data?.columns;

  useEffect(() => {
    if (isLoadingTableCustomization || isLoading) {
      return;
    }

    const defaultColumnValues = tableColumns?.reduce<
      ColumnsCustomizationFormValues['columns']
    >((acc, column) => {
      const columnName = column?.column_name;

      if (typeof columnName !== 'string') {
        return acc;
      }

      const graphqlFieldName =
        tableConfig?.column_config?.[columnName]?.custom_name || '';

      acc[columnName] = {
        graphqlFieldName,
      };

      return acc;
    }, {});

    form.reset({ columns: defaultColumnValues });
  }, [
    tableConfig,
    form,
    isLoading,
    isLoadingTableCustomization,
    schema,
    tableColumns,
    tableName,
  ]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: setTableCustomization } =
    useSetTableCustomizationMutation();

  const handleSubmit = form.handleSubmit(async (values) => {
    const dto = prepareCustomGraphQLColumnNameDTO(values);
    const promise = setTableCustomization({
      resourceVersion,
      args: {
        table: {
          name: tableName,
          schema,
        },
        source: 'default',
        configuration: {
          ...tableConfig,
          column_config: dto,
        },
      },
    });
    await execPromiseWithErrorToast(() => promise, {
      loadingMessage: 'Setting GraphQL column names...',
      successMessage: 'GraphQL column names set successfully.',
      errorMessage: 'An error occurred while setting GraphQL column names.',
    });
    await refetchTableCustomization();
    form.reset(values, { keepValues: true, keepDirty: false });
  });

  const isError = columnsStatus === 'error';
  const displayColumns = tableColumns ?? [];

  const errorMessage =
    columnsError instanceof Error
      ? columnsError.message
      : 'Something went wrong while loading the columns for this table.';

  if (isLoading || isLoadingTableCustomization) {
    return <ColumnsCustomizationSectionSkeleton />;
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 pb-4">
        <SettingsContainer
          title="GraphQL Field Names"
          description="Expose each column with a different name in your GraphQL API."
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
              <div className="rounded-lg">
                <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Column</span>
                  <span>Data Type</span>
                  <span>GraphQL Field Name</span>
                </div>

                <div className="space-y-2 py-3">
                  {displayColumns.length === 0 && (
                    <div className="rounded-md px-4 py-8 text-center text-sm text-muted-foreground">
                      No columns were found for this table.
                    </div>
                  )}

                  {displayColumns.map((column) => {
                    const columnName = column.column_name as string;

                    if (!columnName) {
                      return null;
                    }

                    const dataType =
                      (column.full_data_type as string) ||
                      (column.data_type as string) ||
                      'unknown';
                    const fieldPath =
                      `columns.${columnName}.graphqlFieldName` as GraphQLFieldNamePath;

                    return (
                      <div
                        key={columnName}
                        className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-background px-4 py-3"
                      >
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-foreground">
                            {columnName}
                          </span>
                        </div>

                        <span className="font-mono text-sm text-foreground">
                          {dataType}
                        </span>

                        <FormInput
                          control={form.control}
                          name={fieldPath}
                          label=""
                          placeholder={`${columnName} (default)`}
                          className="font-mono"
                          containerClassName="space-y-0"
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
