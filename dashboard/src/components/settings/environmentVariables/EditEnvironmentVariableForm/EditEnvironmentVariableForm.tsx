import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import BaseEnvironmentVariableForm, {
  baseEnvironmentVariableFormValidationSchema,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { EnvironmentVariable } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetEnvironmentVariablesQuery,
  useUpdateEnvironmentVariableMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditEnvironmentVariableFormProps
  extends Pick<BaseEnvironmentVariableFormProps, 'onCancel'> {
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
      devValue: originalEnvironmentVariable.devValue || '',
      prodValue: originalEnvironmentVariable.prodValue || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: {
      id: currentApplication?.id,
    },
    fetchPolicy: 'cache-only',
  });

  const [updateEnvironmentVariable] = useUpdateEnvironmentVariableMutation({
    refetchQueries: ['getEnvironmentVariables'],
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
    prodValue,
    devValue,
  }: BaseEnvironmentVariableFormValues) {
    if (
      data?.environmentVariables?.some(
        (environmentVariable) =>
          environmentVariable.name === name &&
          environmentVariable.name !== originalEnvironmentVariable.name,
      )
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const updateEnvironmentVariablePromise = updateEnvironmentVariable({
      variables: {
        id,
        environmentVariable: {
          prodValue,
          devValue,
        },
      },
    });

    await toast.promise(
      updateEnvironmentVariablePromise,
      {
        loading: 'Updating environment variable...',
        success: 'Environment variable has been updated successfully.',
        error: 'An error occurred while updating the environment variable.',
      },
      getToastStyleProps(),
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}
