import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import type {
  BaseForeignKeyFormProps,
  BaseForeignKeyFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';
import {
  BaseForeignKeyForm,
  baseForeignKeyValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';

export interface CreateForeignKeyFormProps
  extends Pick<
    BaseForeignKeyFormProps,
    'onCancel' | 'availableColumns' | 'location'
  > {
  /**
   * Column selected by default.
   */
  selectedColumn?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseForeignKeyFormValues) => Promise<void> | void;
}

export default function CreateForeignKeyForm({
  onSubmit,
  selectedColumn,
  ...props
}: CreateForeignKeyFormProps) {
  const [error, setError] = useState<Error | null>(null);

  const form = useForm<Yup.InferType<typeof baseForeignKeyValidationSchema>>({
    defaultValues: {
      referencedSchema: 'public',
      referencedTable: '',
      columnMappings: [{ column: selectedColumn || '', referencedColumn: '' }],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseForeignKeyValidationSchema),
  });

  async function handleSubmit(values: BaseForeignKeyFormValues) {
    setError(null);

    try {
      await onSubmit?.(values);
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
            variant="destructive"
            className="grid grid-flow-col items-center justify-between border-none bg-destructive/20 px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>

            <Button
              onClick={() => setError(null)}
              size="sm"
              variant="destructive"
              className="bg-transparent text-destructive hover:bg-destructive/10"
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
