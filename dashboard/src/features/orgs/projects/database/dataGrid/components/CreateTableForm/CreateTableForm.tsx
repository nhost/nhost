import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import type {
  BaseTableFormProps,
  BaseTableFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import {
  BaseTableForm,
  baseTableValidationSchema,
} from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import { useCreateTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { useTrackForeignKeyRelationsMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

export interface CreateTableFormProps
  extends Pick<BaseTableFormProps, 'onCancel' | 'location'> {
  /**
   * Schema where the table should be created.
   */
  schema: string;
  /**
   * Function to be called when the form is submitted.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
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
    mutateAsync: setTableTracking,
    error: trackTableError,
    reset: resetTrackError,
  } = useSetTableTrackingMutation();

  const { mutateAsync: trackForeignKeyRelation, error: foreignKeyError } =
    useTrackForeignKeyRelationsMutation();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const error = createTableError || trackTableError || foreignKeyError;

  const form = useForm<
    BaseTableFormValues | Yup.InferType<typeof baseTableValidationSchema>
  >({
    defaultValues: {
      columns: [
        {
          type: { label: 'uuid', value: 'uuid' },
          name: 'id',
          defaultValue: {
            label: 'gen_random_uuid()',
            value: 'gen_random_uuid()',
          },
          isNullable: false,
          isUnique: false,
          isIdentity: false,
          comment: '',
        },
        {
          name: '',
          // biome-ignore lint/suspicious/noExplicitAny: TODO
          type: null as any,
          // biome-ignore lint/suspicious/noExplicitAny: TODO
          defaultValue: null as any,
          isNullable: false,
          isUnique: false,
          isIdentity: false,
          comment: '',
        },
      ],
      foreignKeyRelations: [],
      primaryKeyIndices: ['0'],
      identityColumnIndex: null,
    },
    shouldUnregister: false,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseTableValidationSchema),
  });

  async function handleSubmit(values: BaseTableFormValues) {
    const primaryKey = values.primaryKeyIndices.reduce<string[]>(
      (primaryKeys, primaryKeyIndex) => [
        ...primaryKeys,
        values.columns[primaryKeyIndex].name,
      ],
      [],
    );

    try {
      const table: DatabaseTable = {
        ...values,
        primaryKey,
        identityColumn:
          values.identityColumnIndex !== null &&
          typeof values.identityColumnIndex !== 'undefined'
            ? values.columns[values.identityColumnIndex]?.name
            : undefined,
      };

      await createTable({ table });
      await setTableTracking({
        tracked: true,
        resourceVersion,
        args: {
          source: router.query.dataSourceSlug as string,
          table: { name: table.name, schema },
        },
      });

      if (isNotEmptyValue(table.foreignKeyRelations)) {
        await trackForeignKeyRelation({
          unTrackedForeignKeyRelations: table.foreignKeyRelations,
          schema,
          table: table.name,
        });
      }

      if (onSubmit) {
        await onSubmit();
      }

      triggerToast('The table has been created successfully.');

      await router.push(
        `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/database/browser/${router.query.dataSourceSlug}/${schema}/tables/${table.name}`,
      );
    } catch {
      // This error is handled by the useCreateTableMutation hook.
    }
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error ? (
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
      ) : null}

      <BaseTableForm
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
