import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/components/settings/secrets/BaseSecretForm';
import BaseSecretForm, {
  BaseSecretFormValidationSchema,
} from '@/components/settings/secrets/BaseSecretForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useInsertSecretMutation } from '@/utils/__generated__/graphql';
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
    resolver: yupResolver(BaseSecretFormValidationSchema),
  });

  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [insertSecret] = useInsertSecretMutation();

  async function handleSubmit({ name, value }: BaseSecretFormValues) {
    const insertSecretPromise = insertSecret({
      variables: {
        appId: currentApplication?.id,
        secret: {
          name,
          value,
        },
      },
    });

    await toast.promise(
      insertSecretPromise,
      {
        loading: 'Creating secret...',
        success: 'Secret has been created successfully.',
        error: 'An error occurred while creating the secret.',
      },
      getToastStyleProps(),
    );

    onSubmit?.();
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
