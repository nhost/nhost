import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/features/projects/secrets/settings/components/BaseSecretForm';
import {
  BaseSecretForm,
  baseSecretFormValidationSchema,
} from '@/features/projects/secrets/settings/components/BaseSecretForm';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetSecretsDocument,
  useInsertSecretMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateSecretFormProps
  extends Pick<BaseSecretFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateSecretForm({
  onSubmit,
  ...props
}: CreateSecretFormProps) {
  const form = useForm<BaseSecretFormValues>({
    defaultValues: {
      name: '',
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseSecretFormValidationSchema),
  });

  const { currentProject } = useCurrentWorkspaceAndProject();
  const [insertSecret] = useInsertSecretMutation({
    refetchQueries: [GetSecretsDocument],
  });

  async function handleSubmit({ name, value }: BaseSecretFormValues) {
    const insertSecretPromise = insertSecret({
      variables: {
        appId: currentProject?.id,
        secret: {
          name,
          value,
        },
      },
    });

    try {
      await execPromiseWithErrorToast(
        async () => {
          await insertSecretPromise;
          onSubmit?.();
        },
        {
          loadingMessage: 'Creating secret...',
          successMessage: 'Secret has been created successfully.',
          errorMessage: 'An error occurred while creating the secret.',
        },
      );
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <FormProvider {...form}>
      <BaseSecretForm
        mode="create"
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
