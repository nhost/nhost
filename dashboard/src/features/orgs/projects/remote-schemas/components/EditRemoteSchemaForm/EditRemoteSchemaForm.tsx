import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import BaseRemoteSchemaForm, {
  type BaseRemoteSchemaFormProps,
  type BaseRemoteSchemaFormValues,
  baseRemoteSchemaValidationSchema,
} from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaForm/BaseRemoteSchemaForm';
import type {
  RemoteSchemaHeaders,
  RemoteSchemaInfo,
  UpdateRemoteSchemaArgs,
} from '@/utils/hasura-api/generated/schemas';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import type * as Yup from 'yup';
import { useUpdateRemoteSchemaMutation } from '../../hooks/useUpdateRemoteSchemaMutation';
import { DEFAULT_REMOTE_SCHEMA_TIMEOUT_SECONDS } from '../../utils/constants';
import { isRemoteSchemaFromUrlDefinition } from '../../utils/guards';

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

  const {
    mutateAsync: updateRemoteSchema,
    error: updateRemoteSchemaError,
    reset: resetUpdateRemoteSchemaError,
  } = useUpdateRemoteSchemaMutation();

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
        customization: (originalSchema.definition as any)?.customization ?? {
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
    try {
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

      const remoteSchema: UpdateRemoteSchemaArgs = {
        name: values.name,
        comment: values.comment,
        definition: {
          ...values.definition,
          headers,
        },
      };

      await updateRemoteSchema({ args: remoteSchema });

      if (onSubmit) {
        await onSubmit();
      }

      triggerToast('The remote schema has been updated successfully.');

      await router.push(
        `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/graphql/remote-schemas/${values.name}`,
      );
    } catch {
      // This error is handled by the useUpdateRemoteSchemaMutation hook.
    }
  }

  return (
    <FormProvider {...form}>
      {updateRemoteSchemaError && updateRemoteSchemaError instanceof Error && (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {updateRemoteSchemaError.message}
            </span>

            <Button
              variant="borderless"
              color="secondary"
              className="p-1"
              onClick={() => {
                resetUpdateRemoteSchemaError();
              }}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseRemoteSchemaForm
        submitButtonText="Update"
        onSubmit={handleSubmit}
        nameInputDisabled
        {...props}
      />
    </FormProvider>
  );
}
