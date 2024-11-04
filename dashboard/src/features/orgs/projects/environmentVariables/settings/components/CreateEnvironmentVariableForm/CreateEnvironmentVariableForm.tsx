import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/features/orgs/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import {
  BaseEnvironmentVariableForm,
  baseEnvironmentVariableFormValidationSchema,
} from '@/features/orgs/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import {
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface CreateEnvironmentVariableFormProps
  extends Pick<BaseEnvironmentVariableFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<any>;
}

export default function CreateEnvironmentVariableForm({
  onSubmit,
  ...props
}: CreateEnvironmentVariableFormProps) {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues: {
      name: '',
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  const { project } = useProject();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const availableEnvironmentVariables = data?.config?.global?.environment || [];

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const { setError } = form;

  async function handleSubmit({
    name,
    value,
  }: BaseEnvironmentVariableFormValues) {
    if (
      availableEnvironmentVariables?.some((variable) => variable.name === name)
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          global: {
            environment: [
              ...(availableEnvironmentVariables?.map((variable) => ({
                name: variable.name,
                value: variable.value,
              })) || []),
              {
                name,
                value,
              },
            ],
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
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
        loadingMessage: 'Creating environment variable...',
        successMessage: 'Environment variable has been created successfully.',
        errorMessage:
          'An error occurred while creating the environment variable.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm
        mode="create"
        submitButtonText="Create"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
