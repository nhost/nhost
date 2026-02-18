import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import type { BaseRecordFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { BaseRecordForm } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { useCreateRecordMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRecordMutation';
import type { ColumnInsertOptions } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { createDynamicValidationSchema } from '@/features/orgs/projects/database/dataGrid/utils/validationSchemaHelpers';
import { triggerToast } from '@/utils/toast';

export interface CreateRecordFormProps
  extends Pick<BaseRecordFormProps, 'columns' | 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<unknown>;
  currentOffset: number;
}

export default function CreateRecordForm({
  onSubmit,
  currentOffset,
  ...props
}: CreateRecordFormProps) {
  const { mutateAsync: insertRow, error, reset } = useCreateRecordMutation();
  const validationSchema = createDynamicValidationSchema(props.columns);
  const currentTablePath = useTablePath();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: props.columns.reduce((defaultValues, column) => {
      if (column.meta?.defaultValue && column.meta?.type === 'boolean') {
        return {
          ...defaultValues,
          [column.id as string]: column.meta?.defaultValue,
        };
      }

      return { ...defaultValues, [column.id as string]: null };
    }, {}),
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  async function handleSubmit(values: Record<string, ColumnInsertOptions>) {
    try {
      await insertRow({ columnValues: values });

      if (onSubmit) {
        await onSubmit();
        await queryClient.invalidateQueries({
          queryKey: [currentTablePath, currentOffset],
        });
        await queryClient.refetchQueries({
          queryKey: [currentTablePath, currentOffset],
        });
      }

      triggerToast('The row has been inserted successfully.');
    } catch {
      // This error is handled by the useCreateRecordMutation hook.
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
        submitButtonText="Insert"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
