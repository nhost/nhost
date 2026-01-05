import BaseRemoteSchemaForm, {
  type BaseRemoteSchemaFormProps,
  type BaseRemoteSchemaFormValues,
  baseRemoteSchemaValidationSchema,
} from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaForm/BaseRemoteSchemaForm';
import { useCreateRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useCreateRemoteSchemaMutation';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '@/features/orgs/projects/remote-schemas/utils/constants';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  AddRemoteSchemaArgs,
  Headers,
} from '@/utils/hasura-api/generated/schemas';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';

export interface CreateRemoteSchemaFormProps
  extends Pick<BaseRemoteSchemaFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<unknown>;
}

export default function CreateRemoteSchemaForm({
  onSubmit,
  ...props
}: CreateRemoteSchemaFormProps) {
  const router = useRouter();

  const { mutateAsync: createRemoteSchema } = useCreateRemoteSchemaMutation();

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
        customization: {
          root_fields_namespace: '',
          type_prefix: '',
          type_suffix: '',
          query_root: {
            parent_type: '',
            prefix: '',
            suffix: '',
          },
          mutation_root: {
            parent_type: '',
            prefix: '',
            suffix: '',
          },
        },
      },
    },
    shouldUnregister: true,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRemoteSchemaValidationSchema),
  });

  async function handleSubmit(values: BaseRemoteSchemaFormValues) {
    const headers: Headers = values.definition.headers
      ?.map((header) => {
        if (header.value_from_env) {
          return {
            name: header.name,
            value_from_env: header.value_from_env,
          };
        }
        if (header.value) {
          return {
            name: header.name,
            value: header.value,
          };
        }
        return null;
      })
      .filter(Boolean) as Headers;

    const remoteSchema: AddRemoteSchemaArgs = {
      name: values.name,
      comment: values.comment,
      definition: {
        ...values.definition,
        headers,
      },
    };

    await execPromiseWithErrorToast(
      async () => {
        try {
          await createRemoteSchema({ args: remoteSchema });
          await onSubmit?.();

          await router.push(
            `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/graphql/remote-schemas/${values.name}`,
          );
        } catch (error) {
          if (error?.code === 'invalid-configuration') {
            throw new Error('cannot continue due to new inconsistent metadata');
          }
          throw error;
        }
      },
      {
        loadingMessage: 'Creating remote schema...',
        successMessage: 'The remote schema has been created successfully.',
        errorMessage:
          'An error occurred while creating the remote schema. Please try again.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseRemoteSchemaForm
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
