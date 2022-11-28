import type {
  BaseForeignKeyFormProps,
  BaseForeignKeyFormValues,
} from '@/components/data-browser/BaseForeignKeyForm';
import {
  BaseForeignKeyForm,
  baseForeignKeyValidationSchema,
} from '@/components/data-browser/BaseForeignKeyForm';
import type { ForeignKeyRelation } from '@/types/data-browser';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditForeignKeyFormProps
  extends Pick<BaseForeignKeyFormProps, 'onCancel' | 'availableColumns'> {
  /**
   * Foreign key relation to be edited.
   */
  foreignKeyRelation: ForeignKeyRelation;
  /**
   * Column selected by default.
   */
  selectedColumn?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseForeignKeyFormValues) => Promise<void>;
}

export default function EditForeignKeyForm({
  foreignKeyRelation,
  selectedColumn,
  onSubmit,
  ...props
}: EditForeignKeyFormProps) {
  const [error, setError] = useState<Error>(null);

  const form = useForm<BaseForeignKeyFormValues>({
    defaultValues: {
      id: foreignKeyRelation.id,
      name: foreignKeyRelation.name,
      columnName: selectedColumn || foreignKeyRelation.columnName,
      referencedSchema: foreignKeyRelation.referencedSchema || 'public',
      referencedTable: foreignKeyRelation.referencedTable,
      referencedColumn: foreignKeyRelation.referencedColumn,
      disableOriginColumn: Boolean(selectedColumn),
      updateAction: foreignKeyRelation.updateAction,
      deleteAction: foreignKeyRelation.deleteAction,
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
              className="p-1 text-greyscaleDark hover:text-greyscaleDark"
              onClick={() => setError(null)}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseForeignKeyForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
