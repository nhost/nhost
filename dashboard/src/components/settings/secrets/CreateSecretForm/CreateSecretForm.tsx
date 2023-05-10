import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/components/settings/secrets/BaseSecretForm';
import BaseSecretForm, {
  baseSecretFormValidationSchema,
} from '@/components/settings/secrets/BaseSecretForm';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/useCurrentWorkspaceAndProject';
import {
  GetSecretsDocument,
  useInsertSecretMutation,
} from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

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
      await toast.promise(
        insertSecretPromise,
        {
          loading: 'Creating secret...',
          success: 'Secret has been created successfully.',
          error: (arg: Error) =>
            arg?.message
              ? `Error: ${arg?.message}`
              : 'An error occurred while creating the secret.',
        },
        getToastStyleProps(),
      );

      onSubmit?.();
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
