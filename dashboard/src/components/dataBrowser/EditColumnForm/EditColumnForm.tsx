import type {
  BaseColumnFormProps,
  BaseColumnFormValues,
} from '@/components/dataBrowser/BaseColumnForm';
import BaseColumnForm, {
  baseColumnValidationSchema,
} from '@/components/dataBrowser/BaseColumnForm';
import useTrackForeignKeyRelationMutation from '@/hooks/dataBrowser/useTrackForeignKeyRelationsMutation';
import useUpdateColumnMutation from '@/hooks/dataBrowser/useUpdateColumnMutation';
import type { DataBrowserGridColumn } from '@/types/dataBrowser';
import { Alert } from '@/ui/Alert';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';
import Button from '@/ui/v2/Button';
import convertDataBrowserGridColumnToDatabaseColumn from '@/utils/dataBrowser/convertDataBrowserGridColumnToDatabaseColumn';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditColumnFormProps
  extends Pick<BaseColumnFormProps, 'onCancel'> {
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
  } = useTrackForeignKeyRelationMutation();

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

  const form = useForm<BaseColumnFormValues>({
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
