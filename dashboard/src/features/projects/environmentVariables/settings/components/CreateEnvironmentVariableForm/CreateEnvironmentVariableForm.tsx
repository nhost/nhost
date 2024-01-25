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
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateEnvironmentVariableFormProps
  extends Pick<BaseEnvironmentVariableFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateEnvironmentVariableForm({
  onSubmit,
  ...props
}: CreateEnvironmentVariableFormProps) {
  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues: {
      name: '',
      value: '',
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
        appId: currentProject?.id,
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
        onSubmit?.();
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
