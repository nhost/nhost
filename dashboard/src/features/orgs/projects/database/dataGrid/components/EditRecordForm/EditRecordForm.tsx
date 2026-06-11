import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import type { Row } from '@tanstack/react-table';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import type { BaseRecordFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { BaseRecordForm } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { useUpdateRecordWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import type {
  ColumnInsertOptions,
  ColumnUpdateOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { wrapResolverWithDefaultPlaceholder } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { createDynamicValidationSchema } from '@/features/orgs/projects/database/dataGrid/utils/validationSchemaHelpers';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { triggerToast } from '@/utils/toast';

export interface EditRecordFormProps
  extends Pick<BaseRecordFormProps, 'columns' | 'onCancel' | 'location'> {
  /**
   * The row to be edited.
   */
  row: Row<UnknownDataGridRow>;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<unknown>;
  currentOffset: number;
}

export default function EditRecordForm({
  row,
  onSubmit,
  currentOffset,
  ...props
}: EditRecordFormProps) {
  const {
    mutateAsync: updateRow,
    error,
    reset,
  } = useUpdateRecordWithToastMutation();
  const validationSchema = createDynamicValidationSchema(props.columns);
  const currentTablePath = useTablePath();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: props.columns.reduce((defaultValues, column) => {
      const value = row.original[column.id];
      return { ...defaultValues, [column.id]: value };
    }, {}),
    reValidateMode: 'onSubmit',
    resolver: wrapResolverWithDefaultPlaceholder(yupResolver(validationSchema)),
  });

  async function handleSubmit(values: Record<string, ColumnInsertOptions>) {
    try {
      const columnsToUpdate: Record<string, ColumnUpdateOptions> = {};

      for (const column of props.columns) {
        const key = column.id;
        const insertOptions = values[key];
        if (!insertOptions) {
          continue;
        }

        const originalValue = row.original[key];

        if (insertOptions.fallbackValue === 'DEFAULT') {
          columnsToUpdate[key] = { reset: 'default' };
          continue;
        }

        if (insertOptions.fallbackValue === 'NULL') {
          if (originalValue !== null) {
            columnsToUpdate[key] = { reset: 'null' };
          }
          continue;
        }

        const newValue = insertOptions.value;

        if (
          column.type === 'date' &&
          newValue !== null &&
          newValue !== undefined &&
          originalValue !== null &&
          originalValue !== undefined
        ) {
          try {
            const newTime = new Date(String(newValue)).getTime();
            const originalTime = new Date(String(originalValue)).getTime();
            if (newTime !== originalTime) {
              columnsToUpdate[key] = { value: newValue };
            }
          } catch {
            if (newValue !== originalValue) {
              columnsToUpdate[key] = { value: newValue };
            }
          }
          continue;
        }

        if (
          typeof newValue === 'object' &&
          newValue !== null &&
          typeof originalValue === 'object' &&
          originalValue !== null
        ) {
          if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
            columnsToUpdate[key] = { value: newValue };
          }
          continue;
        }

        if (newValue !== originalValue) {
          columnsToUpdate[key] = { value: newValue };
        }
      }

      if (Object.keys(columnsToUpdate).length > 0) {
        await updateRow({
          row,
          columnsToUpdate,
        });

        if (onSubmit) {
          await onSubmit();
          await queryClient.invalidateQueries({
            queryKey: [currentTablePath, currentOffset],
          });
        }
      }

      triggerToast('The row has been updated successfully.');
    } catch {
      // Error is handled by the mutation or toast wrapper.
    }
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error ? (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            variant="destructive"
            className="grid grid-flow-col items-center justify-between border-none bg-[#f1315433] px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>
            <Button
              onClick={reset}
              size="sm"
              variant="destructive"
              className="bg-transparent text-[#c91737] hover:bg-[#f131541a]"
            >
              Clear
            </Button>
          </Alert>
        </div>
      ) : null}

      <BaseRecordForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
