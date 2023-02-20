import type {
  BaseForeignKeyFormProps,
  BaseForeignKeyFormValues,
} from '@/components/dataBrowser/BaseForeignKeyForm';
import {
  BaseForeignKeyForm,
  baseForeignKeyValidationSchema,
} from '@/components/dataBrowser/BaseForeignKeyForm';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateForeignKeyFormProps
  extends Pick<BaseForeignKeyFormProps, 'onCancel' | 'availableColumns'> {
  /**
   * Column selected by default.
   */
  selectedColumn?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseForeignKeyFormValues) => Promise<void>;
}

export default function CreateForeignKeyForm({
  onSubmit,
  selectedColumn,
  ...props
}: CreateForeignKeyFormProps) {
  const [error, setError] = useState<Error>(null);

  const form = useForm<BaseForeignKeyFormValues>({
    defaultValues: {
      id: null,
      name: '',
      columnName: selectedColumn || '',
      disableOriginColumn: Boolean(selectedColumn),
      referencedSchema: 'public',
      referencedTable: '',
      referencedColumn: '',
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseForeignKeyValidationSchema),
  });

  async function handleSubmit(values: BaseForeignKeyFormValues) {
    setError(undefined);

    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (submitError) {
      if (submitError && submitError instanceof Error) {
        setError(submitError);
      } else {
        setError(new Error('Unknown error occurred. Please try again.'));
      }
    }
  }

  return (
    <FormProvider {...form}>
      {error && (
        <div className="mb-4 px-6">
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
              onClick={() => setError(null)}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseForeignKeyForm
        submitButtonText="Add"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
