import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import BaseRemoteSchemaForm, {
  type BaseRemoteSchemaFormProps,
  type BaseRemoteSchemaFormValues,
  baseRemoteSchemaValidationSchema,
} from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaForm/BaseRemoteSchemaForm';
import { useCreateRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useCreateRemoteSchemaMutation';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '@/features/orgs/projects/remote-schemas/utils/constants';
import type {
  AddRemoteSchemaArgs,
  RemoteSchemaHeaders,
} from '@/utils/hasura-api/generated/schemas';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';

export interface CreateRemoteSchemaFormProps
  extends Pick<BaseRemoteSchemaFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (args?: any) => Promise<any>;
}

export default function CreateRemoteSchemaForm({
  onSubmit,
  ...props
}: CreateRemoteSchemaFormProps) {
  const router = useRouter();

  const {
    mutateAsync: createRemoteSchema,
    error: createRemoteSchemaError,
    reset: resetCreateRemoteSchemaError,
  } = useCreateRemoteSchemaMutation();

  const form = useForm<
    | BaseRemoteSchemaFormValues
    | Yup.InferType<typeof baseRemoteSchemaValidationSchema>
  >({
    defaultValues: {
      name: '',
      comment: '',
      definition: {
        url: '',
        forward_client_headers: false,
        headers: [],
        timeout_seconds: DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS,
      },
    },
    shouldUnregister: true,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRemoteSchemaValidationSchema),
  });

  async function handleSubmit(values: BaseRemoteSchemaFormValues) {
    try {
      // TODO: Parse the values to the correct type
      const headers: RemoteSchemaHeaders = values.definition.headers.map(
        (header) => {
          if (header.value_from_env) {
            return {
              name: header.name,
              value_from_env: header.value_from_env,
            };
          }
          return {
            name: header.name,
            value: header.value,
          };
        },
      );

      const remoteSchema: AddRemoteSchemaArgs = {
        name: values.name,
        comment: values.comment,
        definition: {
          ...values.definition,
          headers,
        },
      };

      await createRemoteSchema({ args: remoteSchema });

      if (onSubmit) {
        await onSubmit();
      }

      triggerToast('The remote schema has been created successfully.');

      await router.push(
        `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/graphql/remote-schemas/${values.name}`,
      );
    } catch {
      // This error is handled by the useCreateRemoteSchemaMutation hook.
    }
  }

  return (
    <FormProvider {...form}>
      {createRemoteSchemaError && createRemoteSchemaError instanceof Error && (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createRemoteSchemaError.message}
            </span>

            <Button
              variant="borderless"
              color="secondary"
              className="p-1"
              onClick={() => {
                resetCreateRemoteSchemaError();
              }}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseRemoteSchemaForm
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
