import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/features/orgs/projects/secrets/settings/components/BaseSecretForm';
import {
  BaseSecretForm,
  baseSecretFormValidationSchema,
} from '@/features/orgs/projects/secrets/settings/components/BaseSecretForm';
import { useInsertSecretMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface CreateSecretFormProps
  extends Pick<BaseSecretFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<any>;
}

export default function CreateSecretForm({
  onSubmit,
  ...props
}: CreateSecretFormProps) {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const form = useForm<BaseSecretFormValues>({
    defaultValues: {
      name: '',
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseSecretFormValidationSchema),
  });

  const [insertSecret] = useInsertSecretMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  async function handleSubmit({ name, value }: BaseSecretFormValues) {
    const insertSecretPromise = insertSecret({
      variables: {
        appId: project?.id,
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
          await onSubmit?.();

          if (!isPlatform) {
            openDialog({
              title: 'Apply your changes',
              component: <ApplyLocalSettingsDialog />,
              props: {
                PaperProps: {
                  className: 'max-w-2xl',
                },
              },
            });
          }
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
