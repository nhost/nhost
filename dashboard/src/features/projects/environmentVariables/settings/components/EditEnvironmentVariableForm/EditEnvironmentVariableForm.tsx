import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/features/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import {
  BaseEnvironmentVariableForm,
  baseEnvironmentVariableFormValidationSchema,
} from '@/features/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import type { EnvironmentVariable } from '@/types/application';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditEnvironmentVariableFormProps
  extends Pick<BaseEnvironmentVariableFormProps, 'onCancel' | 'location'> {
  /**
   * The environment variable to edit.
   */
  originalEnvironmentVariable: EnvironmentVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<any>;
}

export default function EditEnvironmentVariableForm({
  originalEnvironmentVariable,
  onSubmit,
  ...props
}: EditEnvironmentVariableFormProps) {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues: {
      id: originalEnvironmentVariable.id || '',
      name: originalEnvironmentVariable.name || '',
      value: originalEnvironmentVariable.value || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const availableEnvironmentVariables = data?.config?.global?.environment || [];

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetEnvironmentVariablesDocument],
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
    id,
    name,
    value,
  }: BaseEnvironmentVariableFormValues) {
    if (
      availableEnvironmentVariables.some(
        (variable) =>
          variable.name === name &&
          variable.name !== originalEnvironmentVariable.name,
      )
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          global: {
            environment: [
              ...availableEnvironmentVariables
                .filter((variable) => variable.id !== id)
                .map((variable) => ({
                  name: variable.name,
                  value: variable.value,
                })),
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
        loadingMessage: 'Updating environment variable...',
        successMessage: 'Environment variable has been updated successfully.',
        errorMessage:
          'An error occurred while updating the environment variable.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}
