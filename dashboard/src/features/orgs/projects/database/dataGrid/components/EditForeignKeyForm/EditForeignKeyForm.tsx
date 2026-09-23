import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type {
  BaseForeignKeyFormProps,
  BaseForeignKeyFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';
import {
  BaseForeignKeyForm,
  baseForeignKeyValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { areStrArraysEqualOrdered } from '@/lib/utils';

export interface EditForeignKeyFormProps
  extends Pick<
    BaseForeignKeyFormProps,
    'onCancel' | 'availableColumns' | 'location'
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
  const referencedSchema = foreignKeyRelation.referencedSchema || 'public';
  const { referencedTable, referencedColumns } = foreignKeyRelation;

  const form = useForm<Yup.InferType<typeof baseForeignKeyValidationSchema>>({
    defaultValues: {
      id: foreignKeyRelation.id,
      name: foreignKeyRelation.name,
      columns: foreignKeyRelation.columns,
      referencedSchema,
      referencedTable,
      referencedKeyName: '',
      referencedColumns,
      updateAction: foreignKeyRelation.updateAction,
      deleteAction: foreignKeyRelation.deleteAction,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseForeignKeyValidationSchema),
  });

  const { resetField } = form;
  const { data: referencedTableData } = useTableSchemaQuery(
    [`${referencedSchema}.${referencedTable}`],
    {
      schema: referencedSchema,
      table: referencedTable,
      queryOptions: { enabled: !!referencedSchema && !!referencedTable },
    },
  );

  useEffect(() => {
    const candidateKey = referencedTableData?.candidateKeys.find(
      ({ columns }) => areStrArraysEqualOrdered(columns, referencedColumns),
    );

    if (candidateKey) {
      // Seed it as the field's default rather than a value change, so the
      // resolved key does not count as an unsaved edit.
      resetField('referencedKeyName', { defaultValue: candidateKey.name });
    }
  }, [referencedTableData, referencedColumns, resetField]);

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
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
