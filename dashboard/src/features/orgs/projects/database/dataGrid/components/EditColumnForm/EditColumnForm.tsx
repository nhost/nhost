import { Alert } from '@/components/ui/v2/Alert';
import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import { Button } from '@/components/ui/v2/Button';
import type {
  BaseColumnFormProps,
  BaseColumnFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseColumnForm';
import {
  BaseColumnForm,
  baseColumnValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseColumnForm';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import { useUpdateColumnMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateColumnMutation';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { convertDataBrowserGridColumnToDatabaseColumn } from '@/features/orgs/projects/database/dataGrid/utils/convertDataBrowserGridColumnToDatabaseColumn';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';

export interface EditColumnFormProps
  extends Pick<BaseColumnFormProps, 'onCancel' | 'location'> {
  /**
   * Column to be edited.
   */
  column: DataBrowserGridColumn;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditColumnForm({
  column: originalColumn,
  onSubmit,
  ...props
}: EditColumnFormProps) {
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();

  const {
    mutateAsync: updateColumn,
    error: updateColumnError,
    reset: resetUpdateColumnError,
  } = useUpdateColumnMutation();

  const {
    mutateAsync: trackForeignKeyRelation,
    error: foreignKeyError,
    reset: resetForeignKeyError,
  } = useTrackForeignKeyRelationsMutation();

  const error = updateColumnError || foreignKeyError;

  function resetError() {
    resetUpdateColumnError();
    resetForeignKeyError();
  }

  const defaultValue: AutocompleteOption = {
    value: originalColumn.defaultValue,
    label: originalColumn.defaultValue,
    custom: originalColumn.isDefaultValueCustom,
  };

  const columnValues: BaseColumnFormValues = {
    name: originalColumn.id,
    type: {
      value: originalColumn.specificType,
      label: originalColumn.specificType,
    },
    defaultValue,
    isNullable: originalColumn.isNullable || false,
    isUnique: originalColumn.isUnique || false,
    isIdentity: originalColumn.isIdentity || false,
    foreignKeyRelation: originalColumn.foreignKeyRelation || null,
    comment: originalColumn.comment || null,
  };

  const form = useForm<
    BaseColumnFormValues | Yup.InferType<typeof baseColumnValidationSchema>
  >({
    defaultValues: columnValues,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseColumnValidationSchema),
  });

  async function handleSubmit(values: BaseColumnFormValues) {
    try {
      await updateColumn({
        originalColumn:
          convertDataBrowserGridColumnToDatabaseColumn(originalColumn),
        column: values,
      });

      if (values.foreignKeyRelation) {
        await trackForeignKeyRelation({
          foreignKeyRelations: [values.foreignKeyRelation],
          schema: schemaSlug as string,
          table: tableSlug as string,
        });
      }

      if (onSubmit) {
        await onSubmit();
      }

      triggerToast('The column has been updated successfully.');
    } catch {
      // This error is handled by the useUpdateColumnMutation hook.
    }
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error && (
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
      )}

      <BaseColumnForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
