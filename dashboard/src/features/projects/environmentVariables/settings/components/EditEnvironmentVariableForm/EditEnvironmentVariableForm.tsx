import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/features/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import {
  BaseEnvironmentVariableForm,
  baseEnvironmentVariableFormValidationSchema,
} from '@/features/projects/environmentVariables/settings/components/BaseEnvironmentVariableForm';
import type { EnvironmentVariable } from '@/types/application';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
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
  onSubmit?: () => Promise<void>;
}

export default function EditEnvironmentVariableForm({
  originalEnvironmentVariable,
  onSubmit,
  ...props
}: EditEnvironmentVariableFormProps) {
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
    fetchPolicy: 'cache-only',
  });

  const availableEnvironmentVariables = data?.config?.global?.environment || [];

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetEnvironmentVariablesDocument],
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
        onSubmit?.();
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
