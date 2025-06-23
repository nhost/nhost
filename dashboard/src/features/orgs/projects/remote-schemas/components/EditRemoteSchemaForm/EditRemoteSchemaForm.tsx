import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import BaseRemoteSchemaForm, {
  type BaseRemoteSchemaFormProps,
  type BaseRemoteSchemaFormValues,
  baseRemoteSchemaValidationSchema,
} from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaForm/BaseRemoteSchemaForm';
import { useUpdateRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaMutation';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '@/features/orgs/projects/remote-schemas/utils/constants';
import { isRemoteSchemaFromUrlDefinition } from '@/features/orgs/projects/remote-schemas/utils/guards';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  Headers,
  RemoteSchemaInfo,
} from '@/utils/hasura-api/generated/schemas';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import EditGraphQLCustomizations from './sections/EditGraphQLCustomizations';

export interface EditRemoteSchemaFormProps
  extends Pick<BaseRemoteSchemaFormProps, 'onCancel' | 'location'> {
  /**
   * Remote schema to be edited.
   */
  originalSchema: RemoteSchemaInfo;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (args?: any) => Promise<any>;
}

export default function EditRemoteSchemaForm({
  originalSchema,
  onSubmit,
  ...props
}: EditRemoteSchemaFormProps) {
  const router = useRouter();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: updateRemoteSchema } = useUpdateRemoteSchemaMutation();

  const form = useForm<
    | BaseRemoteSchemaFormValues
    | Yup.InferType<typeof baseRemoteSchemaValidationSchema>
  >({
    defaultValues: {
      name: originalSchema.name,
      comment: originalSchema.comment,
      definition: {
        url: isRemoteSchemaFromUrlDefinition(originalSchema.definition)
          ? originalSchema.definition.url
          : originalSchema.definition.url_from_env,
        forward_client_headers:
          originalSchema.definition.forward_client_headers ?? false,
        headers: originalSchema.definition.headers ?? [],
        timeout_seconds:
          originalSchema.definition.timeout_seconds ??
          DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS,
        customization: originalSchema.definition?.customization ?? {
          root_fields_namespace: '',
          type_names: {},
          field_names: [],
        },
      },
    },
    shouldUnregister: true,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRemoteSchemaValidationSchema),
  });

  console.log(updateRemoteSchemaError);

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

    const remoteSchema: RemoteSchemaInfo = {
      ...originalSchema,
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
          await updateRemoteSchema({
            originalRemoteSchema: originalSchema,
            updatedRemoteSchema: remoteSchema,
            resourceVersion,
          });

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
        loadingMessage: 'Updating remote schema...',
        successMessage: 'The remote schema has been updated successfully.',
        errorMessage: 'An error occurred while updating the remote schema.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseRemoteSchemaForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        nameInputDisabled
        graphQLCustomizationsSlot={
          <EditGraphQLCustomizations remoteSchemaName={originalSchema.name} />
        }
        {...props}
      />
    </FormProvider>
  );
}
