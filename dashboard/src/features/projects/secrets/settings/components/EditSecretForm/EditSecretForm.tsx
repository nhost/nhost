import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/features/projects/secrets/settings/components/BaseSecretForm';
import {
  BaseSecretForm,
  baseSecretFormValidationSchema,
} from '@/features/projects/secrets/settings/components/BaseSecretForm';
import type { Secret } from '@/types/application';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetSecretsDocument,
  useUpdateSecretMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditSecretFormProps
  extends Pick<BaseSecretFormProps, 'onCancel'> {
  /**
   * The secret to edit.
   */
  originalSecret: Secret;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditSecretForm({
  originalSecret,
  onSubmit,
  ...props
}: EditSecretFormProps) {
  const form = useForm<BaseSecretFormValues>({
    defaultValues: {
      name: originalSecret.name,
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseSecretFormValidationSchema),
  });

  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateSecret] = useUpdateSecretMutation({
    refetchQueries: [GetSecretsDocument],
  });

  async function handleSubmit({ name, value }: BaseSecretFormValues) {
    const updateSecretPromise = updateSecret({
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
          await updateSecretPromise;
          onSubmit?.();
        },
        {
          loadingMessage: 'Updating secret...',
          successMessage: 'Secret has been updated successfully.',
          errorMessage: 'An error occurred while updating the secret.',
        },
      );
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <FormProvider {...form}>
      <BaseSecretForm
        mode="edit"
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
