import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import BaseEnvironmentVariableForm, {
  baseEnvironmentVariableFormValidationSchema,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

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

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentApplication?.id },
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
        appId: currentApplication?.id,
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

    await toast.promise(
      updateConfigPromise,
      {
        loading: 'Creating environment variable...',
        success: 'Environment variable has been created successfully.',
        error: getServerError(
          'An error occurred while creating the environment variable.',
        ),
      },
      getToastStyleProps(),
    );

    onSubmit?.();
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
