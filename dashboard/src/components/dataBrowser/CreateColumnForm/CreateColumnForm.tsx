import type {
  BaseColumnFormProps,
  BaseColumnFormValues,
} from '@/components/dataBrowser/BaseColumnForm';
import BaseColumnForm, {
  baseColumnValidationSchema,
} from '@/components/dataBrowser/BaseColumnForm';
import useCreateColumnMutation from '@/hooks/dataBrowser/useCreateColumnMutation';
import useTrackForeignKeyRelationsMutation from '@/hooks/dataBrowser/useTrackForeignKeyRelationsMutation';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateColumnFormProps
  extends Pick<BaseColumnFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateColumnForm({
  onSubmit,
  ...props
}: CreateColumnFormProps) {
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();

  const {
    mutateAsync: addColumn,
    error: addColumnError,
    reset: resetAddColumnError,
  } = useCreateColumnMutation();

  const {
    mutateAsync: trackForeignKeyRelation,
    error: foreignKeyError,
    reset: resetForeignKeyError,
  } = useTrackForeignKeyRelationsMutation();

  const error = addColumnError || foreignKeyError;

  function resetError() {
    resetAddColumnError();
    resetForeignKeyError();
  }

  const form = useForm<BaseColumnFormValues>({
    defaultValues: {
      name: '',
      type: null,
      defaultValue: null,
      isNullable: true,
      isUnique: false,
      isIdentity: false,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseColumnValidationSchema),
  });

  async function handleSubmit(values: BaseColumnFormValues) {
    try {
      await addColumn({ column: values });

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

      triggerToast('The column has been created successfully.');
    } catch {
      // This error is handled by the useCreateColumnMutation hook.
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
        submitButtonText="Insert"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
