import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import type {
  BaseTableFormProps,
  BaseTableFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import {
  BaseTableForm,
  baseTableValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import { useUpdateTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation';
import type {
  DatabaseTable,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
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
   * Table to be edited.
   */
  table: NormalizedQueryDataRow;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (tableName: string) => Promise<void>;
}

export default function EditTableForm({
  onSubmit,
  schema,
  table: originalTable,
  ...props
}: EditTableFormProps) {
  const [formInitialized, setFormInitialized] = useState(false);
  const router = useRouter();

  const {
    data,
    status: columnsStatus,
    error: columnsError,
  } = useTableQuery([`default.${schema}.${originalTable.table_name}`], {
    schema,
    table: originalTable.table_name,
  });

  const columns = data?.columns;
  const foreignKeyRelations = data?.foreignKeyRelations;

  const dataGridColumns = (columns || []).map((column) =>
    normalizeDatabaseColumn(column),
  );

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
      name: originalTable.table_name,
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
        name: originalTable.table_name,
        columns: dataGridColumns.map((column) => ({
          // ID can't be changed through the form, so we can use it to
          // identify the column in the original array.
          id: column.id,
          name: column.id,
          type: column.type,
          defaultValue: column.defaultValue,
          isNullable: column.isNullable,
          isUnique: column.isUnique,
          comment: column.comment || '',
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
    originalTable,
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
        originalTable,
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

      if (originalTable.table_name !== updatedTable.name) {
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
        <ActivityIndicator label="Loading columns..." delay={1000} />
      </div>
    );
  }

  if (!formInitialized) {
    return (
      <div className="px-6">
        <ActivityIndicator label="Loading..." delay={1000} />
      </div>
    );
  }

  if (columnsStatus === 'error') {
    return (
      <div className="-mt-3 px-6">
        <Alert severity="error" className="text-left">
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
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              size="small"
              onClick={resetError}
            >
              Clear
            </Button>
          </Alert>
        </div>
      ) : null}

      <BaseTableForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
