import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import type {
  BaseTableFormProps,
  BaseTableFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import {
  BaseTableForm,
  baseTableValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useCreateTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import { useTrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackTableMutation';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';

export interface CreateTableFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table should be created.
   */
  schema: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (args?: any) => Promise<any>;
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
    useTrackForeignKeyRelationsMutation();

  const error = createTableError || trackTableError || foreignKeyError;

  const form = useForm<
    BaseTableFormValues | Yup.InferType<typeof baseTableValidationSchema>
  >({
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
        `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/database/browser/${router.query.dataSourceSlug}/${schema}/${table.name}`,
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
