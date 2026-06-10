import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type {
  BaseTableFormProps,
  BaseTableFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import {
  BaseTableForm,
  baseTableValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import { useUpdateTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { deriveConstraintColumnSets } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import { getUntrackedForeignKeyRelations } from '@/features/orgs/projects/database/dataGrid/utils/getUntrackedForeignKeyRelations';
import { normalizeDatabaseColumn } from '@/features/orgs/projects/database/dataGrid/utils/normalizeDatabaseColumn';
import { isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

export interface EditTableFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table to be edited's name.
   */
  tableName: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (tableName: string) => Promise<void>;
}

export default function EditTableForm({
  onSubmit,
  schema,
  tableName: originalTableName,
  ...props
}: EditTableFormProps) {
  const [formInitialized, setFormInitialized] = useState(false);
  const router = useRouter();

  const {
    data,
    status: columnsStatus,
    error: columnsError,
  } = useTableSchemaQuery([`default.${schema}.${originalTableName}`], {
    schema,
    table: originalTableName,
  });

  const columns = data?.columns;
  const foreignKeyRelations = data?.foreignKeyRelations;

  const dataGridColumns = (columns || []).map((column) =>
    normalizeDatabaseColumn(column),
  );

  const constraintColumnSets = deriveConstraintColumnSets(dataGridColumns);

  const {
    mutateAsync: trackForeignKeyRelations,
    error: foreignKeyError,
    reset: resetForeignKeyError,
  } = useTrackForeignKeyRelationsMutation();

  const {
    mutateAsync: updateTable,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateTableMutation({ schema });

  const error = columnsError || updateError || foreignKeyError;

  function resetError() {
    resetForeignKeyError();
    resetUpdateError();
  }

  const form = useForm<
    BaseTableFormValues | Yup.InferType<typeof baseTableValidationSchema>
  >({
    defaultValues: {
      name: originalTableName,
      columns: [],
      primaryKeyIndices: [],
      identityColumnIndex: null,
      foreignKeyRelations: [],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseTableValidationSchema),
  });

  // We are initializing the form values lazily, because columns are not
  // necessarily available immediately when the form is mounted.
  useEffect(() => {
    if (
      columnsStatus === 'success' &&
      dataGridColumns.length > 0 &&
      !formInitialized
    ) {
      const primaryKeyIndices = dataGridColumns.reduce<string[]>(
        (result, col, index) => {
          if (col.isPrimary) {
            return [...result, `${index}`];
          }

          return result;
        },
        [],
      );

      const identityColumnIndex = dataGridColumns.findIndex(
        (column) => column.isIdentity,
      );

      form.reset({
        name: originalTableName,
        columns: dataGridColumns.map((column) => ({
          id: column.id,
          name: column.id,
          type: column.type,
          defaultValue: column.defaultValue,
          isNullable: column.isNullable,
          isUnique: column.isUnique,
          comment: column.comment || '',
          isGenerated: column.isGenerated,
          generationExpression: column.generationExpression,
        })),
        primaryKeyIndices,
        identityColumnIndex:
          identityColumnIndex > -1 ? identityColumnIndex : null,
        foreignKeyRelations,
      });

      setFormInitialized(true);
    }
  }, [
    form,
    originalTableName,
    columnsStatus,
    foreignKeyRelations,
    dataGridColumns,
    formInitialized,
  ]);

  async function handleSubmit(values: BaseTableFormValues) {
    const primaryKey = values.primaryKeyIndices.map<string>(
      (primaryKeys) => values.columns[primaryKeys].name,
    );
    try {
      const updatedTable: DatabaseTable = {
        ...values,
        primaryKey,
        identityColumn:
          values.identityColumnIndex !== null &&
          typeof values.identityColumnIndex !== 'undefined'
            ? values.columns[values.identityColumnIndex]?.name
            : undefined,
      };

      await updateTable({
        originalTableName,
        originalColumns: dataGridColumns,
        originalForeignKeyRelations: foreignKeyRelations ?? [],
        updatedTable,
      });

      const unTrackedForeignKeyRelations = getUntrackedForeignKeyRelations(
        foreignKeyRelations,
        updatedTable.foreignKeyRelations,
      );

      if (isNotEmptyValue(unTrackedForeignKeyRelations)) {
        await trackForeignKeyRelations({
          unTrackedForeignKeyRelations,
          schema,
          table: updatedTable.name,
          trackedForeignKeyRelations: foreignKeyRelations,
        });
      }

      if (onSubmit) {
        await onSubmit(updatedTable.name);
      }

      if (originalTableName !== updatedTable.name) {
        await router.push(
          `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/database/browser/${router.query.dataSourceSlug}/${schema}/tables/${updatedTable.name}`,
        );
      }

      triggerToast('The table has been updated successfully.');
    } catch {
      // Errors are already handled by hooks.
    }
  }

  if (columnsStatus === 'loading') {
    return (
      <div className="px-6">
        <Spinner
          delay={1000}
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading columns...
        </Spinner>
      </div>
    );
  }

  if (!formInitialized) {
    return (
      <div className="px-6">
        <Spinner
          delay={1000}
          wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
          className="h-4 w-4 justify-center"
        >
          Loading...
        </Spinner>
      </div>
    );
  }

  if (columnsStatus === 'error') {
    return (
      <div className="-mt-3 px-6">
        <Alert
          variant="destructive"
          className="border-none bg-destructive/20 px-4 py-3 text-left"
        >
          <strong>Error:</strong>{' '}
          {columnsError && columnsError instanceof Error
            ? columnsError?.message
            : 'An error occurred while loading the columns. Please try again.'}
        </Alert>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error ? (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            variant="destructive"
            className="grid grid-flow-col items-center justify-between border-none bg-destructive/20 px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>

            <Button
              onClick={resetError}
              size="sm"
              variant="destructive"
              className="bg-transparent text-destructive hover:bg-destructive/10"
            >
              Clear
            </Button>
          </Alert>
        </div>
      ) : null}

      <BaseTableForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        schema={schema}
        tableName={originalTableName}
        constraintColumnSets={constraintColumnSets}
        {...props}
      />
    </FormProvider>
  );
}
