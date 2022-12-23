import type {
  BaseTableFormProps,
  BaseTableFormValues,
} from '@/components/dataBrowser/BaseTableForm';
import BaseTableForm, {
  baseTableValidationSchema,
} from '@/components/dataBrowser/BaseTableForm';
import useCreateTableMutation from '@/hooks/dataBrowser/useCreateTableMutation';
import useTrackForeignKeyRelationMutation from '@/hooks/dataBrowser/useTrackForeignKeyRelationsMutation';
import useTrackTableMutation from '@/hooks/dataBrowser/useTrackTableMutation';
import type { DatabaseTable } from '@/types/dataBrowser';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateTableFormProps
  extends Pick<BaseTableFormProps, 'onCancel'> {
  /**
   * Schema where the table should be created.
   */
  schema: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateTableForm({
  onSubmit,
  schema,
  ...props
}: CreateTableFormProps) {
  const router = useRouter();

  const {
    mutateAsync: createTable,
    error: createTableError,
    reset: resetCreateError,
  } = useCreateTableMutation({ schema });

  const {
    mutateAsync: trackTable,
    error: trackTableError,
    reset: resetTrackError,
  } = useTrackTableMutation({ schema });

  const { mutateAsync: trackForeignKeyRelation, error: foreignKeyError } =
    useTrackForeignKeyRelationMutation();

  const error = createTableError || trackTableError || foreignKeyError;

  const form = useForm<BaseTableFormValues>({
    defaultValues: {
      columns: [
        {
          name: '',
          type: null,
          defaultValue: null,
          isNullable: false,
          isUnique: false,
          isIdentity: false,
        },
      ],
      foreignKeyRelations: [],
      primaryKeyIndex: null,
      identityColumnIndex: null,
    },
    shouldUnregister: true,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseTableValidationSchema),
  });

  async function handleSubmit(values: BaseTableFormValues) {
    try {
      const table: DatabaseTable = {
        ...values,
        primaryKey: values.columns[values.primaryKeyIndex]?.name,
        identityColumn:
          values.identityColumnIndex !== null &&
          typeof values.identityColumnIndex !== 'undefined'
            ? values.columns[values.identityColumnIndex]?.name
            : undefined,
      };

      await createTable({ table });
      await trackTable({ table });

      if (table.foreignKeyRelations?.length > 0) {
        await trackForeignKeyRelation({
          foreignKeyRelations: table.foreignKeyRelations,
          schema,
          table: table.name,
        });
      }

      if (onSubmit) {
        await onSubmit();
      }

      triggerToast('The table has been created successfully.');

      await router.push(
        `/${router.query.workspaceSlug}/${router.query.appSlug}/database/browser/${router.query.dataSourceSlug}/${schema}/${table.name}`,
      );
    } catch {
      // This error is handled by the useCreateTableMutation hook.
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
              color="secondary"
              className="p-1"
              onClick={() => {
                resetCreateError();
                resetTrackError();
              }}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseTableForm
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
