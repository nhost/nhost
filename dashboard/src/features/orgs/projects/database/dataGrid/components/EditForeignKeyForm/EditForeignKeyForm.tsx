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
import resolveExistingReferencedTarget from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/resolveExistingReferencedTarget';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface EditForeignKeyFormProps
  extends Pick<
    BaseForeignKeyFormProps,
    'onCancel' | 'availableColumns' | 'constraintColumnSets' | 'location'
  > {
  /**
   * Foreign key relation to be edited.
   */
  foreignKeyRelation: ForeignKeyRelation;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseForeignKeyFormValues) => Promise<void> | void;
}

export default function EditForeignKeyForm({
  foreignKeyRelation,
  onSubmit,
  ...props
}: EditForeignKeyFormProps) {
  const [error, setError] = useState<Error | null>(null);

  const columnMappings =
    foreignKeyRelation.columns.length > 0
      ? foreignKeyRelation.columns.map((column, index) => ({
          column,
          referencedColumn: foreignKeyRelation.referencedColumns[index] ?? '',
        }))
      : [{ column: '', referencedColumn: '' }];
  const initialTarget = resolveExistingReferencedTarget(
    foreignKeyRelation.referencedColumns,
    [],
  );

  const form = useForm<Yup.InferType<typeof baseForeignKeyValidationSchema>>({
    defaultValues: {
      id: foreignKeyRelation.id,
      name: foreignKeyRelation.name,
      referencedSchema: foreignKeyRelation.referencedSchema || 'public',
      referencedTable: foreignKeyRelation.referencedTable,
      referencedKeyId: 'legacy',
      targetMode: 'legacy',
      preserveReferencedOrder: true,
      legacyLabel:
        initialTarget.mode === 'legacy' ? initialTarget.label : undefined,
      columnMappings,
      updateAction: foreignKeyRelation.updateAction,
      deleteAction: foreignKeyRelation.deleteAction,
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
        submitButtonText="Save"
        existingForeignKey={foreignKeyRelation}
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
